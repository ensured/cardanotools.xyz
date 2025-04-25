import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'

interface Meetup {
  id: string
  title: string
  description: string
  date: number
  spotId: string
  spotName: string
  createdBy: string
  createdByName: string
  createdByEmail: string
  coordinates?: [number, number]
  participants: string[]
  createdAt: number
}

interface MapPoint {
  id: string
  name: string
  type: 'street' | 'park' | 'diy'
  coordinates: [number, number]
  createdBy: string
}

interface NearbyMeetup extends Omit<Meetup, 'coordinates'> {
  coordinates: [number, number]
  distance: number
}

// Cache the coordinates for 10 minutes
let spotCoordinatesCache: Map<string, [number, number]> | null = null
let spotCoordinatesCacheTime = 0
const COORDINATES_CACHE_DURATION = 10 * 60 * 1000 // 10 minutes

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const lat = parseFloat(searchParams.get('lat') || '0')
    const lng = parseFloat(searchParams.get('lng') || '0')
    const radius = parseFloat(searchParams.get('radius') || '50') // Default 50km radius

    // Generate a cache key based on request parameters
    // Round coordinates to 2 decimal places for cache efficiency
    const roundedLat = Math.round(lat * 100) / 100
    const roundedLng = Math.round(lng * 100) / 100
    const cacheKey = `nearby:${roundedLat},${roundedLng}:${radius}`

    // Check if we have a cached response
    const cachedResponse = await kv.get<NearbyMeetup[]>(cacheKey)
    if (cachedResponse) {
      console.log('Returning cached nearby meetups')
      return NextResponse.json(cachedResponse, {
        headers: {
          'Cache-Control': 'public, max-age=300', // 5 minutes browser cache
          'X-Data-Source': 'cache',
        },
      })
    }

    console.log('Searching for meetups near:', { lat, lng, radius })

    // Get all meetups
    const meetupKeys = await kv.keys('meetup:*')
    console.log('Found meetup keys:', meetupKeys.length)

    if (meetupKeys.length === 0) {
      return NextResponse.json([], {
        headers: {
          'Cache-Control': 'public, max-age=60', // 1 minute browser cache
        },
      })
    }

    const now = Date.now()
    const sixHoursAgo = now - 6 * 60 * 60 * 1000
    const oneDayInMs = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

    // Fetch all meetups in parallel, with error handling
    const meetupPromises = meetupKeys.map(async (key) => {
      try {
        return await kv.get<Meetup>(key)
      } catch (error) {
        console.error(`Error fetching meetup ${key}:`, error)
        return null
      }
    })

    const meetups = await Promise.all(meetupPromises)

    // Filter valid meetups and expired meetups
    const validMeetups: Meetup[] = []
    const expiredKeys: string[] = []

    meetups.forEach((meetup, index) => {
      if (!meetup) return

      // Check if meetup is expired
      if (meetup.date + oneDayInMs < now) {
        expiredKeys.push(meetupKeys[index])
        return
      }

      // Check if meetup is too old (more than 6 hours ago)
      if (meetup.date < sixHoursAgo) {
        return
      }

      validMeetups.push(meetup)
    })

    // Delete expired meetups in the background
    if (expiredKeys.length > 0) {
      Promise.all(expiredKeys.map((key) => kv.del(key)))
        .then(() => console.log(`Deleted ${expiredKeys.length} expired meetups`))
        .catch((error) => console.error('Error deleting expired meetups:', error))
    }

    console.log('Valid meetups count:', validMeetups.length)

    // If we don't have cached coordinates or the cache is expired, fetch them
    if (!spotCoordinatesCache || now - spotCoordinatesCacheTime > COORDINATES_CACHE_DURATION) {
      console.log('Refreshing coordinates cache')
      spotCoordinatesCache = new Map<string, [number, number]>()
      spotCoordinatesCacheTime = now

      // Get spots data for coordinates
      const spotIds = await kv.lrange('points:ids', 0, -1)
      console.log('Found spot IDs:', spotIds.length)

      if (spotIds.length === 0) {
        return NextResponse.json([])
      }

      // Fetch spots in batches to avoid memory issues with large datasets
      const batchSize = 100
      for (let i = 0; i < spotIds.length; i += batchSize) {
        const batch = spotIds.slice(i, i + batchSize)
        const spotPromises = batch.map(async (id) => {
          try {
            return await kv.get<MapPoint>(`point:${id}`)
          } catch (error) {
            console.error(`Error fetching spot ${id}:`, error)
            return null
          }
        })

        const spots = await Promise.all(spotPromises)

        // Add valid coordinates to cache
        spots.forEach((spot) => {
          if (spot && spot.coordinates && spot.coordinates.length === 2) {
            spotCoordinatesCache!.set(spot.id, spot.coordinates)
          }
        })
      }

      console.log('Cached coordinates for spots:', spotCoordinatesCache.size)
    } else {
      console.log('Using cached coordinates')
    }

    // Calculate distances and find nearby meetups
    const meetupsWithCoordinates: NearbyMeetup[] = []

    for (const meetup of validMeetups) {
      const spotCoords = spotCoordinatesCache!.get(meetup.spotId)
      if (!spotCoords) {
        continue
      }

      // Calculate distance using Haversine formula
      const R = 6371 // Earth's radius in km
      const dLat = (spotCoords[0] - lat) * (Math.PI / 180)
      const dLon = (spotCoords[1] - lng) * (Math.PI / 180)
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat * (Math.PI / 180)) *
          Math.cos(spotCoords[0] * (Math.PI / 180)) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      const distance = R * c

      // Only include meetups within the radius
      if (distance <= radius) {
        meetupsWithCoordinates.push({
          ...meetup,
          coordinates: spotCoords,
          distance,
        })
      }
    }

    // Sort by distance
    const nearbyMeetups = meetupsWithCoordinates.sort((a, b) => a.distance - b.distance)

    console.log(`Found ${nearbyMeetups.length} nearby meetups within ${radius}km`)

    // Cache the result for 5 minutes
    if (nearbyMeetups.length > 0) {
      await kv.set(cacheKey, nearbyMeetups, { ex: 300 }) // 5 minutes
    }

    return NextResponse.json(nearbyMeetups, {
      headers: {
        'Cache-Control': 'public, max-age=300', // 5 minutes browser cache
        'X-Data-Source': 'fresh',
      },
    })
  } catch (error) {
    console.error('[NEARBY_MEETUPS]', error)
    return new NextResponse('Internal Error', { status: 500 })
  }
}
