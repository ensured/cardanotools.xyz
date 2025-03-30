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
  coordinates?: [number, number]
  participants: string[]
  createdAt: number
}

interface MapPoint {
  id: string
  name: string
  type: string
  coordinates: [number, number]
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const lat = parseFloat(searchParams.get('lat') || '0')
    const lng = parseFloat(searchParams.get('lng') || '0')
    const radius = parseFloat(searchParams.get('radius') || '50') // Default 50km radius

    console.log('Searching for meetups near:', { lat, lng, radius })

    // Get all meetups
    const meetupKeys = await kv.keys('meetup:*')
    console.log('Found meetup keys:', meetupKeys)

    const meetups = await Promise.all(
      meetupKeys.map(async (key) => {
        const meetup = await kv.get<Meetup>(key)
        return meetup
      }),
    )
    console.log('Raw meetups:', meetups)

    // Clean up expired meetups
    const now = Date.now()
    const oneDayInMs = 12 * 60 * 60 * 1000 // 12 hours in milliseconds

    for (const meetup of meetups) {
      if (!meetup) continue
      const isExpired = meetup.date + oneDayInMs < now
      const timeUntilDeletion = meetup.date + oneDayInMs - now
      console.log('Meetup cleanup check:', {
        meetupId: meetup.id,
        meetupDate: meetup.date,
        isExpired,
        timeUntilDeletion:
          timeUntilDeletion > 0
            ? `${Math.round(timeUntilDeletion / (1000 * 60 * 60))} hours`
            : 'past deletion time',
      })
      if (isExpired) {
        // Delete the expired meetup and its references
        await kv.del(`meetup:${meetup.id}`)
        await kv.lrem(`spot:${meetup.spotId}:meetups`, 0, meetup.id)
        await kv.lrem(`user:${meetup.createdBy}:meetups`, 0, meetup.id)
        // Remove meetup from all participants' lists
        for (const participantId of meetup.participants) {
          await kv.lrem(`user:${participantId}:meetups`, 0, meetup.id)
        }
        console.log('Deleted expired meetup:', meetup.id)
      }
    }

    // Get all spots for coordinates
    const spotKeys = await kv.keys('point:*')
    const spots = await Promise.all(
      spotKeys.map(async (key) => {
        const spot = await kv.get<MapPoint>(key)
        return spot
      }),
    )

    // Create a map of spot IDs to their coordinates
    const spotCoordinates = new Map(
      spots
        .filter((spot): spot is MapPoint => spot !== null)
        .map((spot) => [spot.id, spot.coordinates]),
    )

    // Filter out invalid meetups and get current time
    const validMeetups = meetups
      .filter((m): m is Meetup => m !== null)
      .filter((m) => {
        const isExpired = m.date + oneDayInMs < now
        return !isExpired
      })
      .map((meetup) => ({
        ...meetup,
        coordinates: spotCoordinates.get(meetup.spotId),
      }))
      .filter(
        (m): m is Meetup & { coordinates: [number, number] } =>
          m.coordinates !== undefined &&
          Array.isArray(m.coordinates) &&
          m.coordinates.length === 2 &&
          typeof m.coordinates[0] === 'number' &&
          typeof m.coordinates[1] === 'number',
      )

    console.log('Valid meetups with coordinates:', validMeetups)

    const threeHoursAgo = now - 3 * 60 * 60 * 1000
    console.log('Time filter:', { now, threeHoursAgo })

    // Filter meetups based on time and calculate distances
    const nearbyMeetups = validMeetups
      .filter((meetup) => {
        // Only show future meetups or those within last 3 hours
        const isValid = meetup.date > threeHoursAgo
        console.log('Meetup time check:', {
          meetupId: meetup.id,
          meetupDate: meetup.date,
          isValid,
        })
        return isValid
      })
      .map((meetup) => {
        // Calculate distance using Haversine formula
        const R = 6371 // Earth's radius in km
        const dLat = (meetup.coordinates[0] - lat) * (Math.PI / 180)
        const dLon = (meetup.coordinates[1] - lng) * (Math.PI / 180)
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat * (Math.PI / 180)) *
            Math.cos(meetup.coordinates[0] * (Math.PI / 180)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2)
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        const distance = R * c

        console.log('Distance calculation:', {
          meetupId: meetup.id,
          meetupCoords: meetup.coordinates,
          distance,
          isWithinRadius: distance <= radius,
        })

        return {
          ...meetup,
          distance,
        }
      })
      .filter((meetup) => meetup.distance <= radius)
      .sort((a, b) => a.distance - b.distance)

    console.log('Final nearby meetups:', nearbyMeetups)
    return NextResponse.json(nearbyMeetups)
  } catch (error) {
    console.error('[NEARBY_MEETUPS]', error)
    return new NextResponse('Internal Error', { status: 500 })
  }
}
