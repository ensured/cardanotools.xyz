import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { kv } from '@vercel/kv'
import { isAdmin } from '@/lib/admin'

interface MapPoint {
  id: string
  name: string
  type: 'street' | 'park' | 'diy'
  coordinates: [number, number]
  createdBy: string
  lastUpdated?: number
}

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
  participants: string[]
  createdAt: number
}

const CACHE_KEY = 'points:all'

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    const params = await context.params

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const user = await currentUser()
    const userEmail = user?.emailAddresses[0]?.emailAddress

    if (!userEmail) {
      return new NextResponse('User email not found', { status: 400 })
    }

    // Get the point to check ownership
    const point = await kv.get<MapPoint>(`point:${params.id}`)

    if (!point) {
      return new NextResponse('Point not found', { status: 404 })
    }

    // Check if user owns the point or is admin
    if (point.createdBy !== userEmail && !(await isAdmin())) {
      return new NextResponse('Unauthorized', { status: 403 })
    }

    // Get all meetups for this spot
    const meetupIds = await kv.lrange(`spot:${params.id}:meetups`, 0, -1)

    // Get current cached points
    const cachedPoints = await kv.get<MapPoint[]>(CACHE_KEY)

    // Use pipeline for atomic operations
    const pipeline = kv.pipeline()

    // Delete the point
    pipeline.del(`point:${params.id}`)

    // Update the cache by removing the deleted point
    if (cachedPoints) {
      const updatedPoints = cachedPoints.filter((p) => p.id !== params.id)
      pipeline.set(CACHE_KEY, updatedPoints)
    }

    // Update last update timestamp
    pipeline.set('points:last_update', Date.now())

    // Delete all meetups and their references
    for (const meetupId of meetupIds) {
      const meetup = await kv.get<Meetup>(`meetup:${meetupId}`)
      if (meetup) {
        // Delete the meetup
        pipeline.del(`meetup:${meetupId}`)

        // Remove meetup from spot's list
        pipeline.lrem(`spot:${params.id}:meetups`, 0, meetupId)

        // Remove meetup from creator's list
        pipeline.lrem(`user:${meetup.createdBy}:meetups`, 0, meetupId)

        // Remove meetup from all participants' lists
        for (const participantId of meetup.participants) {
          pipeline.lrem(`user:${participantId}:meetups`, 0, meetupId)
        }
      }
    }

    // Execute all operations atomically
    await pipeline.exec()

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Error deleting point:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
