'use server'

import { kv } from '@vercel/kv'
import { v7 as uuidv7 } from 'uuid'
import { auth, currentUser } from '@clerk/nextjs/server'

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
  type: 'street' | 'park' | 'diy' | 'N/A'
  coordinates: [number, number]
  createdBy: string
  lastUpdated: number
}

const POINTS_KEY = 'points:all'

export async function importSpots() {
  try {
    const { userId } = await auth()
    if (!userId) {
      throw new Error('Unauthorized')
    }

    // Get user's email
    const user = await currentUser()
    const userEmail = user?.emailAddresses[0]?.emailAddress

    if (!userEmail) {
      throw new Error('No email address found for user')
    }

    console.log('Starting import with user:', userEmail)

    // Fetch spots from the API with timeout
    console.log('Fetching spots from API...')
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    try {
      const response = await fetch(
        'https://findskatespots.com/api/pins?xmin=-191.43888502981835&ymin=9.44906182688142&xmax=-29.368572529818348&ymax=58.63121664342478&retired=false&zoom=3',
        {
          headers: {
            accept: 'application/json, text/plain, */*',
            'accept-language': 'en-US,en;q=0.8',
            priority: 'u=1, i',
            'sec-ch-ua': '"Chromium";v="134", "Not:A-Brand";v="24", "Brave";v="134"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
          },
          signal: controller.signal,
        },
      )

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`Failed to fetch spots: ${response.status} ${response.statusText}`)
      }

      const spotsData = (await response.json()) as Record<string, Spot>
      console.log(`Fetched ${Object.keys(spotsData).length} spots`)

      // Fetch all existing points from the single key
      const existingPoints: MapPoint[] = (await kv.get(POINTS_KEY)) || []
      // Create a Set of existing coordinates strings for quick lookup
      const existingCoords = new Set(
        existingPoints.map((point) => `${point.coordinates[0]},${point.coordinates[1]}`),
      )

      let successCount = 0
      let skipCount = 0
      let errorCount = 0

      // Prepare new points to add
      const newPoints: MapPoint[] = []
      for (const [key, spot] of Object.entries(spotsData)) {
        try {
          const coordKey = `${spot.lat},${spot.lng}`
          if (existingCoords.has(coordKey)) {
            skipCount++
            continue
          }

          // Generate a new UUID for each spot
          const pointId = uuidv7()

          // Choose a random type for the spot
          const validTypes = ['street', 'park', 'diy'] as const
          const randomType = validTypes[Math.floor(Math.random() * validTypes.length)]

          const point: MapPoint = {
            id: pointId,
            name: `Unknown Spot ${spot.shortId.slice(0, 5)}`,
            type: randomType,
            coordinates: [spot.lat, spot.lng],
            createdBy: userEmail,
            lastUpdated: Date.now(),
          }

          newPoints.push(point)
          existingCoords.add(coordKey)
          successCount++
        } catch (error) {
          errorCount++
          console.error(`Failed to import spot ${key}:`, error)
        }
      }

      // Write back the combined array to the single key
      const updatedPoints = [...existingPoints, ...newPoints]
      await kv.set(POINTS_KEY, updatedPoints)

      console.log(
        `Import finished. Success: ${successCount}, Skipped: ${skipCount}, Errors: ${errorCount}`,
      )
      return {
        success: true,
        message: `Import complete! Added: ${successCount}, Skipped (duplicates): ${skipCount}, Errors: ${errorCount}`,
        count: successCount,
      }
    } catch (error) {
      clearTimeout(timeoutId)
      throw error
    }
  } catch (error) {
    console.error('Import failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to import spots',
    }
  }
}
