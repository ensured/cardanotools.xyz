import { NextRequest, NextResponse } from 'next/server'
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

interface EditProposal {
  id: string
  spotId: string
  userId: string
  userEmail: string
  proposedName: string
  proposedType: 'street' | 'park' | 'diy'
  reason: string
  createdAt: number
  status: 'pending' | 'approved' | 'rejected'
  adminNotes?: string
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

    const body = await request.json()
    const { proposedName, proposedType, reason } = body

    // Validate input
    if (!proposedName || !proposedType || !reason) {
      return new NextResponse('Missing required fields', { status: 400 })
    }

    // Check if spot exists
    const spot = await kv.get<MapPoint>(`point:${params.id}`)
    if (!spot) {
      return new NextResponse('Spot not found', { status: 404 })
    }

    // Create proposal
    const proposal: EditProposal = {
      id: Date.now().toString(),
      spotId: params.id,
      userId,
      userEmail,
      proposedName,
      proposedType,
      reason,
      createdAt: Date.now(),
      status: 'pending',
    }

    // Store proposal
    await kv.lpush(`proposals:${params.id}`, proposal)

    // Clear the admin proposals cache since we added a new proposal
    await kv.del('admin:proposals')

    return NextResponse.json(proposal)
  } catch (error) {
    console.error('Error creating proposal:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    const params = await context.params

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Get all proposals for this spot
    const proposals = await kv.lrange(`proposals:${params.id}`, 0, -1)

    return NextResponse.json(proposals)
  } catch (error) {
    console.error('Error fetching proposals:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId || !(await isAdmin())) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { proposalId, status, adminNotes } = await request.json()
    const params = await context.params
    const id = await params.id
    const key = `proposals:${id}`

    // Get all proposals for this spot
    const proposals = (await kv.lrange(key, 0, -1)) as EditProposal[]

    // Find the proposal to update
    const proposalIndex = proposals.findIndex((p) => p.id === proposalId)
    if (proposalIndex === -1) {
      return new NextResponse('Proposal not found', { status: 404 })
    }

    const proposal = proposals[proposalIndex]

    // If approving, update the point
    if (status === 'approved') {
      const pointKey = `point:${id}`
      const point = await kv.get<MapPoint>(pointKey)
      if (point) {
        await kv.set(pointKey, {
          ...point,
          name: proposal.proposedName,
          type: proposal.proposedType,
        })
      }
    }

    // Remove the proposal from the list
    await kv.lrem(key, 1, JSON.stringify(proposal))

    // Clear the admin proposals cache since we modified the proposals
    await kv.del('admin:proposals')

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Error updating proposal:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
