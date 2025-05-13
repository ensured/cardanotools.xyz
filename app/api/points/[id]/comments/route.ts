import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { kv } from '@vercel/kv'
import { v7 as uuidv7 } from 'uuid'

interface Comment {
  id: string
  content: string
  createdBy: string
  createdByName: string
  createdAt: number
  updatedAt?: number
  imageUrl?: string
}

interface MapPoint {
  id: string
  name: string
  type: 'street' | 'park' | 'diy'
  coordinates: [number, number]
  createdBy: string
  lastUpdated?: number
  comments?: Comment[]
}

const POINTS_KEY = 'points:all'

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params
    const pointId = params.id
    const points: MapPoint[] = (await kv.get(POINTS_KEY)) || []
    const point = points.find((p) => p.id === pointId)
    if (!point) {
      return new NextResponse('Spot not found', { status: 404 })
    }
    const comments = point.comments || []
    return NextResponse.json(comments)
  } catch (error) {
    console.error('[COMMENTS_GET]', error)
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
    const { content, imageUrl } = await request.json()
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return new NextResponse('Invalid comment content', { status: 400 })
    }
    const commentId = uuidv7()
    const comment: Comment = {
      id: commentId,
      content: content.trim(),
      createdBy: userEmail,
      createdByName: userName,
      createdAt: Date.now(),
      imageUrl: imageUrl,
    }
    const points: MapPoint[] = (await kv.get(POINTS_KEY)) || []
    const pointIndex = points.findIndex((p) => p.id === pointId)
    if (pointIndex === -1) {
      return new NextResponse('Spot not found', { status: 404 })
    }
    const point = points[pointIndex]
    const comments = point.comments || []
    const updatedComments = [...comments, comment]
    points[pointIndex] = {
      ...point,
      comments: updatedComments,
      lastUpdated: Date.now(),
    }
    await kv.set(POINTS_KEY, points)
    return NextResponse.json(comment)
  } catch (error) {
    console.error('[COMMENTS_POST] Error:', error)
    return new NextResponse('Internal Error', { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    const params = await context.params
    const pointId = params.id
    const { commentId } = await request.json()
    if (!userId || !commentId) {
      return new NextResponse('Unauthorized or missing comment ID', { status: 401 })
    }
    const user = await currentUser()
    const userEmail = user?.emailAddresses[0]?.emailAddress
    if (!userEmail) {
      return new NextResponse('User email not found', { status: 400 })
    }
    const points: MapPoint[] = (await kv.get(POINTS_KEY)) || []
    const pointIndex = points.findIndex((p) => p.id === pointId)
    if (pointIndex === -1) {
      return new NextResponse('Spot not found', { status: 404 })
    }
    const point = points[pointIndex]
    const comments = point.comments || []
    const comment = comments.find((c) => c.id === commentId)
    if (!comment) {
      return new NextResponse('Comment not found', { status: 404 })
    }
    // Check if user owns the comment or is admin
    const isAdmin = process.env.ADMIN_EMAIL && userEmail === process.env.ADMIN_EMAIL
    if (comment.createdBy !== userEmail && !isAdmin) {
      return new NextResponse('Unauthorized', { status: 403 })
    }
    const updatedComments = comments.filter((c) => c.id !== commentId)
    points[pointIndex] = {
      ...point,
      comments: updatedComments,
      lastUpdated: Date.now(),
    }
    await kv.set(POINTS_KEY, points)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('[COMMENTS_DELETE] Error:', error)
    return new NextResponse('Internal Error', { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    const params = await context.params
    const pointId = params.id
    const { commentId, content } = await request.json()
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }
    if (!commentId || typeof commentId !== 'string') {
      return new NextResponse('Invalid comment ID', { status: 400 })
    }
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return new NextResponse('Invalid comment content', { status: 400 })
    }
    const user = await currentUser()
    const userEmail = user?.emailAddresses[0]?.emailAddress
    if (!userEmail) {
      return new NextResponse('User email not found', { status: 400 })
    }
    const points: MapPoint[] = (await kv.get(POINTS_KEY)) || []
    const pointIndex = points.findIndex((p) => p.id === pointId)
    if (pointIndex === -1) {
      return new NextResponse('Spot not found', { status: 404 })
    }
    const point = points[pointIndex]
    const comments = point.comments || []
    const commentIndex = comments.findIndex((c) => c.id === commentId)
    if (commentIndex === -1) {
      return new NextResponse('Comment not found', { status: 404 })
    }
    // Check if user owns the comment or is admin
    const isAdmin = process.env.ADMIN_EMAIL && userEmail === process.env.ADMIN_EMAIL
    if (comments[commentIndex].createdBy !== userEmail && !isAdmin) {
      return new NextResponse('Unauthorized', { status: 403 })
    }
    const updatedComment: Comment = {
      ...comments[commentIndex],
      content: content.trim(),
      updatedAt: Date.now(),
    }
    const updatedComments = [...comments]
    updatedComments[commentIndex] = updatedComment
    points[pointIndex] = {
      ...point,
      comments: updatedComments,
      lastUpdated: Date.now(),
    }
    await kv.set(POINTS_KEY, points)
    return NextResponse.json(updatedComment)
  } catch (error) {
    console.error('[COMMENTS_PATCH] Error:', error)
    return new NextResponse('Internal Error', { status: 500 })
  }
}
