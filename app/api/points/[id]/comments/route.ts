import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { kv } from '@vercel/kv'
import { isAdmin } from '@/lib/admin'

interface Comment {
  id: string
  content: string
  createdBy: string
  createdAt: number
  updatedAt?: number
}

interface MapPoint {
  id: string
  name: string
  type: 'street' | 'park' | 'diy'
  coordinates: [number, number]
  createdBy: string
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params
    const comments = (await kv.get<Comment[]>(`comments:${params.id}`)) || []
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

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const user = await currentUser()
    const userEmail = user?.emailAddresses[0]?.emailAddress

    if (!userEmail) {
      return new NextResponse('User email not found', { status: 400 })
    }

    const { content } = await request.json()

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return new NextResponse('Invalid comment content', { status: 400 })
    }

    // Check if the spot exists
    const spot = await kv.get<MapPoint>(`point:${params.id}`)
    if (!spot) {
      return new NextResponse('Spot not found', { status: 404 })
    }

    const newComment: Comment = {
      id: Date.now().toString(),
      content: content.trim(),
      createdBy: userEmail,
      createdAt: Date.now(),
    }

    // Get existing comments and add the new one
    const comments = (await kv.get<Comment[]>(`comments:${params.id}`)) || []
    comments.push(newComment)

    // Store updated comments
    await kv.set(`comments:${params.id}`, comments)

    return NextResponse.json(newComment)
  } catch (error) {
    console.error('[COMMENTS_POST]', error)
    return new NextResponse('Internal Error', { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    const params = await context.params
    const { commentId } = await request.json()

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const user = await currentUser()
    const userEmail = user?.emailAddresses[0]?.emailAddress

    if (!userEmail) {
      return new NextResponse('User email not found', { status: 400 })
    }

    // Get the point and its comments
    const point = await kv.get<MapPoint>(`point:${params.id}`)
    if (!point) {
      return new NextResponse('Point not found', { status: 404 })
    }

    const comments = (await kv.get<Comment[]>(`comments:${params.id}`)) || []
    const commentIndex = comments.findIndex((c) => c.id === commentId)

    if (commentIndex === -1) {
      return new NextResponse('Comment not found', { status: 404 })
    }

    // Check if user owns the comment or is admin
    if (comments[commentIndex].createdBy !== userEmail && !(await isAdmin())) {
      return new NextResponse('Unauthorized', { status: 403 })
    }

    // Remove the comment
    comments.splice(commentIndex, 1)
    await kv.set(`comments:${params.id}`, comments)

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('[COMMENTS_DELETE]', error)
    return new NextResponse('Internal Error', { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    const params = await context.params
    const { commentId, content } = await request.json()

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const user = await currentUser()
    const userEmail = user?.emailAddresses[0]?.emailAddress

    if (!userEmail) {
      return new NextResponse('User email not found', { status: 400 })
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return new NextResponse('Invalid comment content', { status: 400 })
    }

    // Get the point and its comments
    const point = await kv.get<MapPoint>(`point:${params.id}`)
    if (!point) {
      return new NextResponse('Point not found', { status: 404 })
    }

    const comments = (await kv.get<Comment[]>(`comments:${params.id}`)) || []
    const commentIndex = comments.findIndex((c) => c.id === commentId)

    if (commentIndex === -1) {
      return new NextResponse('Comment not found', { status: 404 })
    }

    // Check if user owns the comment or is admin
    if (comments[commentIndex].createdBy !== userEmail && !(await isAdmin())) {
      return new NextResponse('Unauthorized', { status: 403 })
    }

    // Update the comment
    comments[commentIndex] = {
      ...comments[commentIndex],
      content: content.trim(),
      updatedAt: Date.now(),
    }

    await kv.set(`comments:${params.id}`, comments)

    return NextResponse.json(comments[commentIndex])
  } catch (error) {
    console.error('[COMMENTS_PATCH]', error)
    return new NextResponse('Internal Error', { status: 500 })
  }
}
