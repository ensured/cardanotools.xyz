import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { kv } from '@vercel/kv'
import { v7 as uuidv7 } from 'uuid'

interface Spot {
  lat: number
  lng: number
  key: string
  spotcount: string
  shortId: string
}

interface MapPoint {
  id: string
  name: string
  type: 'street' | 'park' | 'diy'
  coordinates: [number, number]
  createdBy: string
  lastUpdated: number
}

async function setupDataStructure() {
  console.log('Setting up data structure...')

  // Initialize points array if it doesn't exist
  const points = (await kv.get<MapPoint[]>('points:array')) || []
  await kv.set('points:array', points)

  // Initialize points index
  const pointIndex: Record<string, number> = {}
  for (const point of points) {
    pointIndex[point.id] = 1
  }
  await kv.hset('points:index', pointIndex)

  console.log('Data structure setup complete!')
}

export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // First, setup the data structure
    await setupDataStructure()

    // Fetch spots from the API
    const response = await fetch(
      'https://findskatespots.com/api/pins?xmin=-191.43888502981835&ymin=9.44906182688142&xmax=-29.368572529818348&ymax=58.63121664342478&retired=false&zoom=3',
      {
        headers: {
          accept: 'application/json, text/plain, */*',
          'accept-language': 'en-US,en;q=0.8',
          priority: 'u=1, i',
          referer: 'https://findskatespots.com/spots?lat=34.04014&lng=-110.40373&zoom=3',
          'sec-ch-ua': '"Chromium";v="134", "Not:A-Brand";v="24", "Brave";v="134"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin',
          'sec-gpc': '1',
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
          cookie: '__client_uat=0; __client_uat_bBj16ib0=0',
        },
      },
    )

    if (!response.ok) {
      throw new Error('Failed to fetch spots')
    }

    const spotsData = (await response.json()) as Record<string, Spot>
    console.log(`Fetched ${Object.keys(spotsData).length} spots`)

    // Get current points array
    const existingPoints = (await kv.get<MapPoint[]>('points:array')) || []
    const existingPointIds = new Set(existingPoints.map((p) => p.id))

    let successCount = 0
    let errorCount = 0

    // Process each spot
    for (const [key, spot] of Object.entries(spotsData)) {
      try {
        // Generate a new UUID for each spot
        const pointId = uuidv7()

        const point: MapPoint = {
          id: pointId,
          name: `Skate Spot ${spot.shortId}`,
          type: 'street',
          coordinates: [spot.lat, spot.lng],
          createdBy: 'system',
          lastUpdated: Date.now(),
        }

        // Use pipeline for atomic operations
        const pipeline = kv.pipeline()

        // Add to points array if not already present
        if (!existingPointIds.has(pointId)) {
          existingPoints.push(point)
          pipeline.set('points:array', existingPoints)
        }

        // Add to point index
        pipeline.hset('points:index', { [pointId]: 1 })

        // Store individual point data
        pipeline.set(`point:${pointId}`, point)

        // Execute all operations atomically
        await pipeline.exec()

        successCount++
      } catch (error) {
        errorCount++
        console.error(`Failed to import spot ${key}:`, error)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Import complete! Success: ${successCount}, Errors: ${errorCount}`,
    })
  } catch (error) {
    console.error('Import failed:', error)
    return NextResponse.json({ success: false, error: 'Failed to import spots' }, { status: 500 })
  }
}
