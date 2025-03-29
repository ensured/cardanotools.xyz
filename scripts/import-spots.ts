import { kv } from '@vercel/kv'

interface Spot {
  lat: number
  lng: number
  key: string
  spotcount: string
  shortId: string
}

async function importSpots() {
  console.log('Starting import...')
  let successCount = 0
  let errorCount = 0

  try {
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

    // Process each spot
    for (const [key, spot] of Object.entries(spotsData)) {
      try {
        const point = {
          id: `legacy_${spot.shortId}`,
          name: `Skate Spot ${spot.shortId}`,
          type: 'street' as const,
          coordinates: [spot.lat, spot.lng] as [number, number],
          createdBy: 'system',
        }

        await kv.set(`point:${point.id}`, point)
        successCount++
        console.log(`Imported spot: ${point.id}`)
      } catch (error) {
        errorCount++
        console.error(`Failed to import spot ${key}:`, error)
      }
    }

    console.log(`Import complete! Success: ${successCount}, Errors: ${errorCount}`)
  } catch (error) {
    console.error('Failed to fetch spots:', error)
  }
}

importSpots().catch(console.error)
