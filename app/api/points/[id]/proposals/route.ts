import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { kv } from '@vercel/kv'
import { isAdmin } from '@/lib/admin'
import { v7 as uuidv7 } from 'uuid'

interface MapPoint {
  id: string
  name: string
  type: 'street' | 'park' | 'diy'
  coordinates: [number, number]
  createdBy: string
  lastUpdated?: number
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
  // Additional fields to store current values
  currentName: string
  currentType: 'street' | 'park' | 'diy'
  spotName: string
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

    if (!userEmail) {
      return new NextResponse('User email not found', { status: 400 })
    }

    const body = await request.json()
    const { proposedName, proposedType, reason } = body

    // Validate input
    if (!proposedName || !proposedType || !reason) {
      return new NextResponse('Missing required fields', { status: 400 })
    }

    // Check if spot exists using the new key format
    const spot = await kv.get<MapPoint>(`point:${pointId}`)
    if (!spot) {
      return new NextResponse('Spot not found', { status: 404 })
    }

    // Create proposal with UUID
    const proposal: EditProposal = {
      id: uuidv7(),
      spotId: pointId,
      userId,
      userEmail,
      proposedName,
      proposedType,
      reason,
      createdAt: Date.now(),
      status: 'pending',
      // Store current values for reference
      currentName: spot.name,
      currentType: spot.type,
      spotName: spot.name,
    }

    // Get existing proposals
    const proposals = (await kv.get<EditProposal[]>(`point:${pointId}:proposals`)) || []

    // Add new proposal
    const updatedProposals = [...proposals, proposal]

    // Use pipeline for atomic operations
    const pipeline = kv.pipeline()

    // Store proposals in a separate key
    pipeline.set(`point:${pointId}:proposals`, updatedProposals)

    // Add to admin proposal list
    pipeline.lpush('admin:proposals', proposal)

    // Update the point's last updated timestamp
    pipeline.set(`point:${pointId}`, {
      ...spot,
      lastUpdated: Date.now(),
    })

    // Execute all operations atomically
    await pipeline.exec()

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
    const pointId = params.id

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Check if spot exists
    const spot = await kv.get<MapPoint>(`point:${pointId}`)
    if (!spot) {
      return new NextResponse('Spot not found', { status: 404 })
    }

    // Get all proposals for this spot
    const proposals = (await kv.get<EditProposal[]>(`point:${pointId}:proposals`)) || []

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
    const pointId = params.id

    // Get the point
    const point = await kv.get<MapPoint>(`point:${pointId}`)
    if (!point) {
      return new NextResponse('Spot not found', { status: 404 })
    }

    // Get all proposals for this spot
    const proposals = (await kv.get<EditProposal[]>(`point:${pointId}:proposals`)) || []

    // Find the proposal to update
    const proposalIndex = proposals.findIndex((p) => p.id === proposalId)
    if (proposalIndex === -1) {
      return new NextResponse('Proposal not found', { status: 404 })
    }

    const proposal = proposals[proposalIndex]

    // Update the proposal with new status and notes
    const updatedProposal = {
      ...proposal,
      status,
      adminNotes: adminNotes || '',
    }

    // Remove the proposal from the list
    const updatedProposals = proposals.filter((p) => p.id !== proposalId)

    // Use pipeline for atomic operations
    const pipeline = kv.pipeline()

    // Update proposal store
    pipeline.set(`point:${pointId}:proposals`, updatedProposals)

    // If approving, update the point
    if (status === 'approved') {
      pipeline.set(`point:${pointId}`, {
        ...point,
        name: proposal.proposedName,
        type: proposal.proposedType,
        lastUpdated: Date.now(),
      })
    } else {
      // Just update the timestamp
      pipeline.set(`point:${pointId}`, {
        ...point,
        lastUpdated: Date.now(),
      })
    }

    // Remove from admin proposals list by re-fetching all and filtering
    const adminProposals = await kv.lrange('admin:proposals', 0, -1)
    if (adminProposals && adminProposals.length > 0) {
      const filteredProposals = adminProposals.filter((p: any) => p.id !== proposalId)
      // Clear and re-add all admin proposals
      pipeline.del('admin:proposals')
      if (filteredProposals.length > 0) {
        pipeline.lpush('admin:proposals', ...filteredProposals)
      }
    }

    // Execute all operations atomically
    await pipeline.exec()

    return NextResponse.json(updatedProposal)
  } catch (error) {
    console.error('Error updating proposal:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
