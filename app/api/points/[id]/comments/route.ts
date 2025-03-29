import { NextResponse } from 'next/server'
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

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = await params
    const comments = (await kv.get<Comment[]>(`comments:${id}`)) || []
    return NextResponse.json(comments)
  } catch (error) {
    console.error('Error fetching comments:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth()
    const { id } = await params

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
    const spot = await kv.get<MapPoint>(`point:${id}`)
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
    const comments = (await kv.get<Comment[]>(`comments:${id}`)) || []
    comments.push(newComment)

    // Store updated comments
    await kv.set(`comments:${id}`, comments)

    return NextResponse.json(newComment)
  } catch (error) {
    console.error('Error creating comment:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth()
    const { id } = await params
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
    const point = await kv.get<MapPoint>(`point:${id}`)
    if (!point) {
      return new NextResponse('Point not found', { status: 404 })
    }

    const comments = (await kv.get<Comment[]>(`comments:${id}`)) || []
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
    await kv.set(`comments:${id}`, comments)

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Error deleting comment:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth()
    const { id } = await params
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
    const point = await kv.get<MapPoint>(`point:${id}`)
    if (!point) {
      return new NextResponse('Point not found', { status: 404 })
    }

    const comments = (await kv.get<Comment[]>(`comments:${id}`)) || []
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

    await kv.set(`comments:${id}`, comments)

    return NextResponse.json(comments[commentIndex])
  } catch (error) {
    console.error('Error updating comment:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
