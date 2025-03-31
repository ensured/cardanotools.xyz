import { kv } from '@vercel/kv'
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

interface MapPoint {
  id: string
  name: string
  type: 'street' | 'park' | 'diy'
  coordinates: [number, number]
  createdBy: string
  lastUpdated?: number
}

// Cache duration in seconds (5 minutes)
const CACHE_DURATION = 300

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 45 * 60 * 1000 // 45 minutes in milliseconds
const MAX_POINTS_PER_WINDOW = 5 // Maximum points per 45 minutes
const CACHE_KEY = 'points:all'
const BATCH_SIZE = 100 // Number of points to process in each batch

// Helper function to calculate distance between two points
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLon = (lon2 - lon1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

async function checkRateLimit(
  userId: string,
): Promise<{ allowed: boolean; remainingTime?: number }> {
  const key = `rate_limit:${userId}`
  const now = Date.now()

  // Get existing points in the time window
  const points = (await kv.get<{ timestamp: number }[]>(key)) || []

  // Filter out old points
  const recentPoints = points.filter((p) => now - p.timestamp < RATE_LIMIT_WINDOW)

  if (recentPoints.length >= MAX_POINTS_PER_WINDOW) {
    // Calculate remaining time based on oldest point
    const oldestPoint = Math.min(...recentPoints.map((p) => p.timestamp))
    const remainingTime = RATE_LIMIT_WINDOW - (now - oldestPoint)
    return { allowed: false, remainingTime }
  }

  // Add new point
  recentPoints.push({ timestamp: now })
  await kv.set(key, recentPoints, { ex: 2700 }) // Expire after 45 minutes

  return { allowed: true }
}

// Helper function to fetch points in batches
async function fetchPointsInBatches(keys: string[]): Promise<MapPoint[]> {
  const points: MapPoint[] = []
  for (let i = 0; i < keys.length; i += BATCH_SIZE) {
    const batch = keys.slice(i, i + BATCH_SIZE)
    const batchPoints = await kv.mget<MapPoint[]>(batch)
    points.push(...batchPoints.filter((p): p is MapPoint => p !== null))
  }
  return points
}

export async function GET() {
  try {
    // Try to get from cache first
    const cachedPoints = await kv.get('points:all')
    if (cachedPoints) {
      return NextResponse.json(cachedPoints)
    }

    // If not in cache, get all points
    const points = await kv.hgetall('points')

    // Store in cache for future requests
    await kv.set('points:all', points, { ex: CACHE_DURATION })

    return NextResponse.json(points)
  } catch (error) {
    console.error('Error fetching points:', error)
    return NextResponse.json({ error: 'Failed to fetch points' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const point = await req.json()

    // Add the point to the hash
    await kv.hset('points', { [point.id]: JSON.stringify(point) })

    // Invalidate the cache
    await kv.del('points:all')

    return NextResponse.json(point)
  } catch (error) {
    console.error('Error adding point:', error)
    return NextResponse.json({ error: 'Failed to add point' }, { status: 500 })
  }
}

// Add a new endpoint to get last update timestamp
export async function HEAD() {
  try {
    const lastUpdate = (await kv.get('points:lastUpdate')) || Date.now()
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Last-Update': lastUpdate.toString(),
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('Error getting last update:', error)
    return new NextResponse(null, { status: 500 })
  }
}
