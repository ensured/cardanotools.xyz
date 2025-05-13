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

interface MapPoint {
  id: string
  name: string
  type: 'street' | 'park' | 'diy'
  coordinates: [number, number]
  createdBy: string
  lastUpdated?: number
  editProposals?: EditProposal[]
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
    const editProposals = point.editProposals || []
    editProposals.sort((a, b) => b.createdAt - a.createdAt)
    return NextResponse.json(editProposals)
  } catch (error) {
    console.error('[EDIT_PROPOSALS_GET]', error)
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
    if (!userEmail) {
      return new NextResponse('User email not found', { status: 400 })
    }
    const { proposedName, proposedType, proposedDescription, reason } = await request.json()
    if (!proposedName || !proposedType || !reason) {
      return new NextResponse('Missing required fields', { status: 400 })
    }
    const proposal: EditProposal = {
      id: uuidv7(),
      spotId: pointId,
      userId,
      userEmail,
      proposedName,
      proposedType,
      proposedDescription,
      reason,
      createdAt: Date.now(),
      status: 'pending',
    }
    const points: MapPoint[] = (await kv.get(POINTS_KEY)) || []
    const pointIndex = points.findIndex((p) => p.id === pointId)
    if (pointIndex === -1) {
      return new NextResponse('Spot not found', { status: 404 })
    }
    const point = points[pointIndex]
    const editProposals = point.editProposals || []
    points[pointIndex] = {
      ...point,
      editProposals: [...editProposals, proposal],
      lastUpdated: Date.now(),
    }
    await kv.set(POINTS_KEY, points)
    return NextResponse.json(proposal)
  } catch (error) {
    console.error('[EDIT_PROPOSALS_POST]', error)
    return new NextResponse('Internal Error', { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    const params = await context.params
    const pointId = params.id
    const { proposalId, status, adminNotes } = await request.json()
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }
    if (!proposalId || typeof proposalId !== 'string') {
      return new NextResponse('Invalid proposal ID', { status: 400 })
    }
    if (!status || !['approved', 'rejected', 'pending'].includes(status)) {
      return new NextResponse('Invalid status', { status: 400 })
    }
    const user = await currentUser()
    const userEmail = user?.emailAddresses[0]?.emailAddress
    if (!userEmail) {
      return new NextResponse('User email not found', { status: 400 })
    }
    // Check if user is admin
    const isUserAdmin = await isAdmin()
    if (!isUserAdmin) {
      return new NextResponse('Unauthorized', { status: 403 })
    }
    const points: MapPoint[] = (await kv.get(POINTS_KEY)) || []
    const pointIndex = points.findIndex((p) => p.id === pointId)
    if (pointIndex === -1) {
      return new NextResponse('Spot not found', { status: 404 })
    }
    const point = points[pointIndex]
    const editProposals = point.editProposals || []
    const proposalIndex = editProposals.findIndex((p) => p.id === proposalId)
    if (proposalIndex === -1) {
      return new NextResponse('Proposal not found', { status: 404 })
    }
    const updatedProposal: EditProposal = {
      ...editProposals[proposalIndex],
      status,
      adminNotes,
    }
    const updatedProposals = [...editProposals]
    updatedProposals[proposalIndex] = updatedProposal
    points[pointIndex] = {
      ...point,
      editProposals: updatedProposals,
      lastUpdated: Date.now(),
    }
    await kv.set(POINTS_KEY, points)
    return NextResponse.json(updatedProposal)
  } catch (error) {
    console.error('[EDIT_PROPOSALS_PATCH]', error)
    return new NextResponse('Internal Error', { status: 500 })
  }
}
