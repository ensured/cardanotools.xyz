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

async function setupDataStructure() {
  try {
    console.log('Setting up data structure...')

    // Check if points:ids exists
    const pointsIdsExists = await kv.exists('points:ids')
    if (!pointsIdsExists) {
      // Initialize points list if it doesn't exist
      await kv.lpush('points:ids', 'init')
      await kv.lrem('points:ids', 0, 'init')
      console.log('Created new points:ids list')
    } else {
      // Get current count for logging
      const pointsCount = await kv.llen('points:ids')
      console.log(`Current points count: ${pointsCount}`)
    }

    console.log('Data structure setup complete!')
    return true
  } catch (error) {
    console.error('Error setting up data structure:', error)
    return false
  }
}

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

    // First, setup the data structure
    const setupSuccess = await setupDataStructure()
    if (!setupSuccess) {
      throw new Error('Failed to set up data structure')
    }

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

      // Get current points to check for duplicates
      const existingPointIds = await kv.lrange('points:ids', 0, -1)
      const existingPoints = await Promise.all(
        existingPointIds.map((id) => kv.get<MapPoint>(`point:${id}`)),
      )

      // Create a Set of existing coordinates strings for quick lookup
      const existingCoords = new Set()
      existingPoints.forEach((point) => {
        if (point && point.coordinates) {
          existingCoords.add(`${point.coordinates[0]},${point.coordinates[1]}`)
        }
      })

      let successCount = 0
      let skipCount = 0
      let errorCount = 0

      // Process spots in batches to avoid overwhelming the KV store
      const batchSize = 100
      const allSpots = Object.entries(spotsData)
      const totalBatches = Math.ceil(allSpots.length / batchSize)

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const batchStart = batchIndex * batchSize
        const batchEnd = Math.min((batchIndex + 1) * batchSize, allSpots.length)
        const batch = allSpots.slice(batchStart, batchEnd)

        console.log(`Processing batch ${batchIndex + 1}/${totalBatches} (${batch.length} spots)`)

        // Create a multi-pipeline for the batch
        const pipeline = kv.pipeline()
        const newPointIds = []

        // Process each spot in the batch
        for (const [key, spot] of batch) {
          try {
            // Skip if coordinates already exist
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

            // Add to pipeline - store with no expiration
            pipeline.set(`point:${pointId}`, point)
            newPointIds.push(pointId)

            // Add to our tracking set
            existingCoords.add(coordKey)

            successCount++
          } catch (error) {
            errorCount++
            console.error(`Failed to import spot ${key}:`, error)
          }
        }

        // Add all new points to the points:ids list
        if (newPointIds.length > 0) {
          pipeline.lpush('points:ids', ...newPointIds)
        }

        // Execute the batch
        try {
          await pipeline.exec()
          console.log(`Batch ${batchIndex + 1} complete: ${newPointIds.length} spots added`)
        } catch (error) {
          console.error(`Error executing batch ${batchIndex + 1}:`, error)
          errorCount += newPointIds.length
          successCount -= newPointIds.length
        }
      }

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
