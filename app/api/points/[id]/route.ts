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

    // Fetch all points from the single key
    const points: MapPoint[] = (await kv.get('points:all')) || []
    const pointIndex = points.findIndex((p) => p.id === params.id)
    if (pointIndex === -1) {
      return new NextResponse('Point not found', { status: 404 })
    }
    const point = points[pointIndex]

    // Check if user owns the point or is admin
    if (point.createdBy !== userEmail && !(await isAdmin())) {
      return new NextResponse('Unauthorized', { status: 403 })
    }

    // Remove the point from the array
    points.splice(pointIndex, 1)
    await kv.set('points:all', points)

    // TODO: If you have meetups or other data tied to this spot, handle their cleanup here as needed

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Error deleting point:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
