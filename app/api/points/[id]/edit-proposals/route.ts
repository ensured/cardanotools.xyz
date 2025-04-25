import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { kv } from '@vercel/kv'
import { v7 as uuidv7 } from 'uuid'
import { isAdmin } from '@/lib/admin'

interface EditProposal {
  id: string
  spotId: string
  userId: string
  userEmail: string
  proposedName: string
  proposedType: 'street' | 'park' | 'diy'
  proposedDescription?: string
  reason: string
  createdAt: number
  status: 'pending' | 'approved' | 'rejected'
  adminNotes?: string
}

interface Point {
  id: string
  name: string
  type: 'street' | 'park' | 'diy'
  coordinates: [number, number]
  createdBy: string
  description?: string
  lastUpdated: number
  editProposals?: EditProposal[]
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params

    const point = await kv.get<Point>(`point:${id}`)
    if (!point) {
      return NextResponse.json({ error: 'Point not found' }, { status: 404 })
    }

    // Get all edit proposals for this point
    return NextResponse.json(point.editProposals || [])
  } catch (error) {
    console.error('Error fetching edit proposals:', error)
    return NextResponse.json({ error: 'Failed to fetch edit proposals' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
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
    const { proposedName, proposedType, proposedDescription, reason } = await request.json()

    if (!proposedName || !proposedType || !reason) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get the point data
    const point = await kv.get<Point>(`point:${id}`)
    if (!point) {
      return NextResponse.json({ error: 'Point not found' }, { status: 404 })
    }

    // Create the proposal
    const proposal: EditProposal = {
      id: uuidv7(),
      spotId: id,
      userId,
      userEmail: user.emailAddresses[0].emailAddress,
      proposedName,
      proposedType,
      proposedDescription,
      reason,
      createdAt: Date.now(),
      status: 'pending',
    }

    // Update the point with the new proposal
    const editProposals = [...(point.editProposals || []), proposal]

    await kv.set(`point:${id}`, {
      ...point,
      editProposals,
    })

    return NextResponse.json(proposal)
  } catch (error) {
    console.error('Error creating edit proposal:', error)
    return NextResponse.json({ error: 'Failed to create edit proposal' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const adminCheck = await isAdmin()
    if (!adminCheck) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 })
    }

    const { id } = params
    const { proposalId, status, adminNotes } = await request.json()

    if (!proposalId || !['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 })
    }

    // Get the point data
    const point = await kv.get<Point>(`point:${id}`)
    if (!point) {
      return NextResponse.json({ error: 'Point not found' }, { status: 404 })
    }

    // Find the proposal
    const proposal = point.editProposals?.find((p) => p.id === proposalId)
    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    }

    // Update the proposal status
    const updatedProposals =
      point.editProposals?.map((p) =>
        p.id === proposalId ? { ...p, status, adminNotes: adminNotes || p.adminNotes } : p,
      ) || []

    // If approved, update the point with the proposed changes
    if (status === 'approved') {
      await kv.set(`point:${id}`, {
        ...point,
        name: proposal.proposedName,
        type: proposal.proposedType,
        description: proposal.proposedDescription,
        lastUpdated: Date.now(),
        editProposals: updatedProposals,
      })
    } else {
      // Just update the proposals if rejected
      await kv.set(`point:${id}`, {
        ...point,
        editProposals: updatedProposals,
      })
    }

    return NextResponse.json({ success: true, status })
  } catch (error) {
    console.error('Error updating edit proposal:', error)
    return NextResponse.json({ error: 'Failed to update edit proposal' }, { status: 500 })
  }
}
