import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { kv } from '@vercel/kv'

interface LikeStatus {
  email: string
  name: string
  status: 'like' | 'dislike' | null
}

interface MapPoint {
  id: string
  name: string
  type: 'street' | 'park' | 'diy'
  coordinates: [number, number]
  createdBy: string
  lastUpdated?: number
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params
    const pointId = params.id

    // Get the point to verify it exists
    const point = await kv.get<MapPoint>(`point:${pointId}`)
    if (!point) {
      return new NextResponse('Spot not found', { status: 404 })
    }

    // Get likes from a separate collection instead of from the point object
    const likes = (await kv.get<LikeStatus[]>(`point:${pointId}:likes`)) || []

    return NextResponse.json(likes)
  } catch (error) {
    console.error('[LIKES_GET]', error)
    return new NextResponse('Internal Error', { status: 500 })
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    const params = await context.params
    const pointId = params.id

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const user = await currentUser()
    const userEmail = user?.emailAddresses[0]?.emailAddress
    const userName =
      user?.firstName && user?.lastName
        ? `${user.firstName} ${user.lastName}`
        : user?.firstName || user?.username || 'Anonymous'

    if (!userEmail) {
      return new NextResponse('User email not found', { status: 400 })
    }

    const { status } = await request.json()

    if (status !== 'like' && status !== 'dislike' && status !== null) {
      return new NextResponse('Invalid status', { status: 400 })
    }

    // Get the point to verify it exists
    const point = await kv.get<MapPoint>(`point:${pointId}`)
    if (!point) {
      return new NextResponse('Spot not found', { status: 404 })
    }

    // Get existing likes from separate collection
    const likes = (await kv.get<LikeStatus[]>(`point:${pointId}:likes`)) || []
    const userLikeIndex = likes.findIndex((like) => like.email === userEmail)

    let updatedLikes: LikeStatus[] = [...likes]

    if (userLikeIndex === -1) {
      // Add new like
      if (status !== null) {
        updatedLikes.push({ email: userEmail, name: userName, status })
      }
    } else {
      // Update existing like
      if (status === null) {
        // Remove like if status is null
        updatedLikes.splice(userLikeIndex, 1)
      } else {
        // Update like status
        updatedLikes[userLikeIndex].status = status
      }
    }

    // Use pipeline for atomic operations
    const pipeline = kv.pipeline()

    // Store likes in a separate key
    pipeline.set(`point:${pointId}:likes`, updatedLikes)

    // Update the point's last updated timestamp
    pipeline.set(`point:${pointId}`, {
      ...point,
      lastUpdated: Date.now(),
    })

    // Execute all operations atomically
    await pipeline.exec()

    return NextResponse.json(updatedLikes)
  } catch (error) {
    console.error('[LIKES_POST]', error)
    return new NextResponse('Internal Error', { status: 500 })
  }
}
