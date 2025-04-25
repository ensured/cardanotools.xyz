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

    // Get comments from a separate collection
    const comments = (await kv.get<Comment[]>(`point:${pointId}:comments`)) || []

    // Return comments sorted by creation date (newest first)
    comments.sort((a, b) => b.createdAt - a.createdAt)

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

    // Get the point to verify it exists
    const point = await kv.get<MapPoint>(`point:${pointId}`)
    if (!point) {
      console.error('[COMMENTS_POST] Point not found:', pointId)
      return new NextResponse('Spot not found', { status: 404 })
    }

    const { content } = await request.json()

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      console.error('[COMMENTS_POST] Invalid content:', content)
      return new NextResponse('Invalid comment content', { status: 400 })
    }

    // Generate a new UUID v7 for the comment
    const commentId = uuidv7()

    // Create the comment
    const comment: Comment = {
      id: commentId,
      content: content.trim(),
      createdBy: userEmail,
      createdByName: userName,
      createdAt: Date.now(),
    }

    // Get existing comments
    const comments = (await kv.get<Comment[]>(`point:${pointId}:comments`)) || []

    // Add the new comment to the array
    const updatedComments = [...comments, comment]

    // Use pipeline for atomic operations
    const pipeline = kv.pipeline()

    // Store comments in a separate collection
    pipeline.set(`point:${pointId}:comments`, updatedComments)

    // Update the point's last updated timestamp
    pipeline.set(`point:${pointId}`, {
      ...point,
      lastUpdated: Date.now(),
    })

    // Execute all operations atomically
    await pipeline.exec()

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

    console.log('[COMMENTS_DELETE] User ID:', userId)
    console.log('[COMMENTS_DELETE] Comment ID:', commentId)

    if (!userId || !commentId) {
      console.error('[COMMENTS_DELETE] Missing userId or commentId:', { userId, commentId })
      return new NextResponse('Unauthorized or missing comment ID', { status: 401 })
    }

    const user = await currentUser()
    const userEmail = user?.emailAddresses[0]?.emailAddress

    console.log('[COMMENTS_DELETE] User email:', userEmail)

    if (!userEmail) {
      console.error('[COMMENTS_DELETE] User email not found')
      return new NextResponse('User email not found', { status: 400 })
    }

    // Get the point to verify it exists
    const point = await kv.get<MapPoint>(`point:${pointId}`)
    if (!point) {
      console.error('[COMMENTS_DELETE] Point not found:', pointId)
      return new NextResponse('Spot not found', { status: 404 })
    }

    // Get all comments for this point
    const comments = (await kv.get<Comment[]>(`point:${pointId}:comments`)) || []

    // Find the comment
    const comment = comments.find((c) => c.id === commentId)
    if (!comment) {
      console.error('[COMMENTS_DELETE] Comment not found:', commentId)
      return new NextResponse('Comment not found', { status: 404 })
    }

    console.log('[COMMENTS_DELETE] Comment creator:', comment.createdBy)
    console.log('[COMMENTS_DELETE] Current user:', userEmail)

    // Check if user owns the comment or is admin
    const isAdmin = process.env.ADMIN_EMAIL && userEmail === process.env.ADMIN_EMAIL
    if (comment.createdBy !== userEmail && !isAdmin) {
      console.error('[COMMENTS_DELETE] Unauthorized: User does not own the comment')
      return new NextResponse('Unauthorized', { status: 403 })
    }

    // Filter out the deleted comment
    const updatedComments = comments.filter((c) => c.id !== commentId)

    // Use pipeline for atomic operations
    const pipeline = kv.pipeline()

    // Store the updated comments
    pipeline.set(`point:${pointId}:comments`, updatedComments)

    // Update the point's last updated timestamp
    pipeline.set(`point:${pointId}`, {
      ...point,
      lastUpdated: Date.now(),
    })

    // Execute all operations atomically
    await pipeline.exec()

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

    // Get the point
    const point = await kv.get<MapPoint>(`point:${pointId}`)
    if (!point) {
      console.error('[COMMENTS_PATCH] Point not found:', pointId)
      return new NextResponse('Spot not found', { status: 404 })
    }

    // Get all comments for this point
    const comments = (await kv.get<Comment[]>(`point:${pointId}:comments`)) || []

    // Find the comment to update
    const commentIndex = comments.findIndex((c) => c.id === commentId)
    if (commentIndex === -1) {
      console.error('[COMMENTS_PATCH] Comment not found:', commentId)
      return new NextResponse('Comment not found', { status: 404 })
    }

    // Check if user owns the comment or is admin
    const isAdmin = process.env.ADMIN_EMAIL && userEmail === process.env.ADMIN_EMAIL
    if (comments[commentIndex].createdBy !== userEmail && !isAdmin) {
      return new NextResponse('Unauthorized', { status: 403 })
    }

    // Create updated comment
    const updatedComment: Comment = {
      ...comments[commentIndex],
      content: content.trim(),
      updatedAt: Date.now(),
    }

    // Create a new array with the updated comment
    const updatedComments = [...comments]
    updatedComments[commentIndex] = updatedComment

    // Use pipeline for atomic operations
    const pipeline = kv.pipeline()

    // Store updated comments
    pipeline.set(`point:${pointId}:comments`, updatedComments)

    // Update the point's last updated timestamp
    pipeline.set(`point:${pointId}`, {
      ...point,
      lastUpdated: Date.now(),
    })

    // Execute all operations atomically
    await pipeline.exec()

    return NextResponse.json(updatedComment)
  } catch (error) {
    console.error('[COMMENTS_PATCH] Error:', error)
    return new NextResponse('Internal Error', { status: 500 })
  }
}
