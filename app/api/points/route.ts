import { kv } from '@vercel/kv'
import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { v7 as uuidv7 } from 'uuid'

const POINTS_KEY = 'points:all'

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

export async function GET() {
  try {
    // Fetch all points from the single key
    const points = (await kv.get<MapPoint[]>(POINTS_KEY)) || []
    return NextResponse.json(points, {
      headers: {
        'Last-Update': Date.now().toString(),
      },
    })
  } catch (error) {
    console.error('Error fetching points:', error)
    return NextResponse.error()
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const user = await currentUser()
    const userEmail = user?.emailAddresses[0]?.emailAddress
    if (!userEmail) {
      return NextResponse.json({ error: 'No email address found for user' }, { status: 400 })
    }
    const point = await req.json()
    if (!point.name || !point.type || !point.coordinates) {
      return NextResponse.json(
        { error: 'Missing required fields: name, type, or coordinates' },
        { status: 400 },
      )
    }
    point.id = uuidv7()
    point.lastUpdated = Date.now()
    point.createdBy = userEmail

    // Fetch all points, add new, and write back
    const points = (await kv.get<MapPoint[]>(POINTS_KEY)) || []
    points.push(point)
    await kv.set(POINTS_KEY, points)

    return NextResponse.json(point)
  } catch (error) {
    console.error('Error adding point:', error)
    return NextResponse.json({ error: 'Failed to add point' }, { status: 500 })
  }
}

// Add a new endpoint to get last update timestamp
export async function HEAD() {
  try {
    const pointIds = await kv.lrange('points:ids', 0, -1)

    if (!pointIds || pointIds.length === 0) {
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Last-Update': '0',
          'Content-Type': 'application/json',
        },
      })
    }

    // Fetch all points in parallel
    const pointPromises = pointIds.map(async (id) => {
      try {
        return await kv.get<MapPoint>(`point:${id}`)
      } catch (error) {
        console.error(`Error fetching point ${id} for timestamp:`, error)
        return null
      }
    })

    const points = await Promise.all(pointPromises)

    const lastUpdate = points
      .filter((point): point is MapPoint => point !== null)
      .reduce((max, point) => Math.max(max, point.lastUpdated || 0), 0)

    return new NextResponse(null, {
      status: 200,
      headers: {
        'Last-Update': lastUpdate.toString(),
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    })
  } catch (error) {
    console.error('Error getting last update:', error)
    return new NextResponse(null, { status: 500 })
  }
}
