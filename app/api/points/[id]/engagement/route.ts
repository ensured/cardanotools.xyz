import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { kv } from '@vercel/kv'
import { v7 as uuidv7 } from 'uuid'

interface Comment {
  id: string
  userId: string
  userEmail: string
  text: string
  createdAt: number
}

interface Like {
  userId: string
  timestamp: number
}

interface EngagementData {
  likes: Like[]
  dislikes: Like[]
  comments: Comment[]
}

interface Point {
  id: string
  name: string
  type: 'street' | 'park' | 'diy'
  coordinates: [number, number]
  createdBy: string
  description?: string
  lastUpdated: number
  likes?: Like[]
  dislikes?: Like[]
  comments?: Comment[]
}

// Cache duration in seconds (5 minutes)
const CACHE_DURATION = 300

// Helper function to get cache key
const getEngagementCacheKey = (spotId: string) => `cache:spot:${spotId}:engagement`

// GET endpoint to fetch engagement data with caching
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const cacheKey = getEngagementCacheKey(id)

    // Try to get from cache first
    const cachedData = await kv.get<EngagementData>(cacheKey)
    if (cachedData) {
      // Return cached data if available
      return NextResponse.json(cachedData)
    }

    // If not in cache, fetch from database
    const point = await kv.get<Point>(`point:${id}`)
    if (!point) {
      return NextResponse.json({ error: 'Point not found' }, { status: 404 })
    }

    // Extract engagement data
    const engagementData: EngagementData = {
      likes: point.likes || [],
      dislikes: point.dislikes || [],
      comments: point.comments || [],
    }

    // Store in cache with 5-minute expiration
    await kv.set(cacheKey, engagementData, { ex: CACHE_DURATION })

    return NextResponse.json(engagementData)
  } catch (error) {
    console.error('Error fetching spot engagement data:', error)
    return NextResponse.json({ error: 'Failed to fetch engagement data' }, { status: 500 })
  }
}

// POST endpoint to add a like
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await currentUser()
    if (!user?.emailAddresses?.length) {
      return NextResponse.json({ error: 'No email address found for user' }, { status: 401 })
    }

    const { id } = params
    const { action, comment } = await request.json()

    const point = await kv.get<Point>(`point:${id}`)
    if (!point) {
      return NextResponse.json({ error: 'Point not found' }, { status: 404 })
    }

    let updated = false

    // Handle different actions
    if (action === 'like') {
      // Add like if not already liked
      const likes = point.likes || []
      if (!likes.some((like) => like.userId === userId)) {
        likes.push({ userId, timestamp: Date.now() })
        point.likes = likes
        updated = true
      }
    } else if (action === 'dislike') {
      // Add dislike if not already disliked
      const dislikes = point.dislikes || []
      if (!dislikes.some((dislike) => dislike.userId === userId)) {
        dislikes.push({ userId, timestamp: Date.now() })
        point.dislikes = dislikes
        updated = true
      }
    } else if (action === 'comment' && comment) {
      // Add new comment
      const comments = point.comments || []
      const newComment: Comment = {
        id: uuidv7(),
        userId,
        userEmail: user.emailAddresses[0].emailAddress,
        text: comment,
        createdAt: Date.now(),
      }
      comments.push(newComment)
      point.comments = comments
      updated = true
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    if (updated) {
      // Update the point data
      await kv.set(`point:${id}`, point)

      // Invalidate cache
      const cacheKey = getEngagementCacheKey(id)
      await kv.del(cacheKey)

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false, message: 'No changes made' })
  } catch (error) {
    console.error('Error updating engagement:', error)
    return NextResponse.json({ error: 'Failed to update engagement' }, { status: 500 })
  }
}

// DELETE endpoint to remove likes or comments
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const { action, commentId } = await request.json()

    const point = await kv.get<Point>(`point:${id}`)
    if (!point) {
      return NextResponse.json({ error: 'Point not found' }, { status: 404 })
    }

    let updated = false

    if (action === 'unlike') {
      // Remove like
      const likes = point.likes || []
      const updatedLikes = likes.filter((like) => like.userId !== userId)
      if (likes.length !== updatedLikes.length) {
        point.likes = updatedLikes
        updated = true
      }
    } else if (action === 'undislike') {
      // Remove dislike
      const dislikes = point.dislikes || []
      const updatedDislikes = dislikes.filter((dislike) => dislike.userId !== userId)
      if (dislikes.length !== updatedDislikes.length) {
        point.dislikes = updatedDislikes
        updated = true
      }
    } else if (action === 'deleteComment' && commentId) {
      // Remove comment (allow only if user is the comment owner)
      const comments = point.comments || []
      const comment = comments.find((c) => c.id === commentId)

      if (comment && comment.userId === userId) {
        point.comments = comments.filter((c) => c.id !== commentId)
        updated = true
      } else {
        return NextResponse.json({ error: 'Unauthorized to delete this comment' }, { status: 403 })
      }
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    if (updated) {
      // Update the point data
      await kv.set(`point:${id}`, point)

      // Invalidate cache
      const cacheKey = getEngagementCacheKey(id)
      await kv.del(cacheKey)

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false, message: 'No changes made' })
  } catch (error) {
    console.error('Error removing engagement:', error)
    return NextResponse.json({ error: 'Failed to remove engagement' }, { status: 500 })
  }
}
