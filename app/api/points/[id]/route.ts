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

    // Get the point to check ownership
    const point = await kv.get<MapPoint>(`point:${params.id}`)

    if (!point) {
      return new NextResponse('Point not found', { status: 404 })
    }

    // Check if user owns the point or is admin
    if (point.createdBy !== userEmail && !(await isAdmin())) {
      return new NextResponse('Unauthorized', { status: 403 })
    }

    // Delete the point
    await kv.del(`point:${params.id}`)

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Error deleting point:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
