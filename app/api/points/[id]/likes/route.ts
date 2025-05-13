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
  likes?: LikeStatus[]
}

const POINTS_KEY = 'points:all'

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params
    const pointId = params.id

    // Get all points
    const points: MapPoint[] = (await kv.get(POINTS_KEY)) || []
    const point = points.find((p) => p.id === pointId)
    if (!point) {
      return new NextResponse('Spot not found', { status: 404 })
    }
    const likes = point.likes || []
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

    // Get all points
    const points: MapPoint[] = (await kv.get(POINTS_KEY)) || []
    const pointIndex = points.findIndex((p) => p.id === pointId)
    if (pointIndex === -1) {
      return new NextResponse('Spot not found', { status: 404 })
    }
    const point = points[pointIndex]
    const likes = point.likes || []
    const userLikeIndex = likes.findIndex((like) => like.email === userEmail)
    let updatedLikes: LikeStatus[] = [...likes]
    if (userLikeIndex === -1) {
      if (status !== null) {
        updatedLikes.push({ email: userEmail, name: userName, status })
      }
    } else {
      if (status === null) {
        updatedLikes.splice(userLikeIndex, 1)
      } else {
        updatedLikes[userLikeIndex].status = status
      }
    }
    // Update the point's likes and lastUpdated
    points[pointIndex] = {
      ...point,
      likes: updatedLikes,
      lastUpdated: Date.now(),
    }
    await kv.set(POINTS_KEY, points)
    return NextResponse.json(updatedLikes)
  } catch (error) {
    console.error('[LIKES_POST]', error)
    return new NextResponse('Internal Error', { status: 500 })
  }
}
