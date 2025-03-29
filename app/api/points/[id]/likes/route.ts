import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { kv } from '@vercel/kv'

interface MapPoint {
  id: string
  name: string
  type: 'street' | 'park' | 'diy'
  coordinates: [number, number]
  createdBy: string
}

interface LikeStatus {
  userId: string
  status: 'like' | 'dislike' | null
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params
    const likes = (await kv.get<LikeStatus[]>(`likes:${params.id}`)) || []
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

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { status } = await request.json()

    if (status !== 'like' && status !== 'dislike' && status !== null) {
      return new NextResponse('Invalid status', { status: 400 })
    }

    // Check if the spot exists
    const spot = await kv.get<MapPoint>(`point:${params.id}`)
    if (!spot) {
      return new NextResponse('Spot not found', { status: 404 })
    }

    // Get existing likes
    const likes = (await kv.get<LikeStatus[]>(`likes:${params.id}`)) || []
    const userLikeIndex = likes.findIndex((like) => like.userId === userId)

    if (userLikeIndex === -1) {
      // Add new like
      likes.push({ userId, status })
    } else {
      // Update existing like
      if (status === null) {
        // Remove like if status is null
        likes.splice(userLikeIndex, 1)
      } else {
        // Update like status
        likes[userLikeIndex].status = status
      }
    }

    // Store updated likes
    await kv.set(`likes:${params.id}`, likes)

    return NextResponse.json(likes)
  } catch (error) {
    console.error('[LIKES_POST]', error)
    return new NextResponse('Internal Error', { status: 500 })
  }
}
