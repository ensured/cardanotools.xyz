import { kv } from '@vercel/kv'
import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'

interface MapPoint {
  id: string
  name: string
  type: 'street' | 'park' | 'diy'
  coordinates: [number, number]
  createdBy: string
  lastUpdated?: number
}

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 45 * 60 * 1000 // 45 minutes in milliseconds
const MAX_POINTS_PER_WINDOW = 5 // Maximum points per 45 minutes
const CACHE_KEY = 'points:all'
const CACHE_TTL = 60 // Cache for 1 minute
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
    const { userId } = await auth()

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Try to get from cache first
    const cachedPoints = await kv.get<MapPoint[]>(CACHE_KEY)
    if (cachedPoints) {
      return NextResponse.json(cachedPoints)
    }

    // If not in cache, fetch from KV using batch operations
    const keys = await kv.keys('point:*')
    const points = await fetchPointsInBatches(keys)

    // Cache the results
    await kv.set(CACHE_KEY, points, { ex: CACHE_TTL })

    return NextResponse.json(points)
  } catch (error) {
    console.error('Error fetching points:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Check rate limit
    const rateLimit = await checkRateLimit(userId)
    if (!rateLimit.allowed) {
      return new NextResponse(
        JSON.stringify({
          message: 'Rate limit exceeded',
          remainingTime: rateLimit.remainingTime,
        }),
        { status: 429 },
      )
    }

    const body = await request.json()
    const point: MapPoint = {
      ...body,
      createdBy: body.createdBy,
      lastUpdated: Date.now(),
    }

    // Use pipeline for atomic operations
    const pipeline = kv.pipeline()
    pipeline.set(`point:${point.id}`, point)
    pipeline.del(CACHE_KEY)
    await pipeline.exec()

    return NextResponse.json(point)
  } catch (error) {
    console.error('Error creating point:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

// Add a new endpoint to get last update timestamp
export async function HEAD() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Get the last update timestamp from cache
    const lastUpdate = await kv.get<number>('points:last_update')
    if (!lastUpdate) {
      return new NextResponse(null, { status: 404 })
    }

    return new NextResponse(null, {
      status: 200,
      headers: {
        'Last-Modified': new Date(lastUpdate).toUTCString(),
      },
    })
  } catch (error) {
    console.error('Error getting last update:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
