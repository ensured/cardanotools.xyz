import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
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
  spotName: string
  currentName: string
  currentType: 'street' | 'park' | 'diy'
}

export async function GET() {
  try {
    const { userId } = await auth()

    // Only allow admin access
    if (!userId || !(await isAdmin())) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Try to get from cache first
    const cachedProposals = await kv.get<EditProposal[]>('admin:proposals')
    if (cachedProposals) {
      return NextResponse.json(cachedProposals)
    }

    // Get all points and proposals in parallel
    const [points, proposalKeys] = await Promise.all([
      kv.mget<MapPoint[]>(await kv.keys('point:*')),
      kv.keys('proposals:*'),
    ])

    // Create a map of point IDs to point data for quick lookup
    const pointsMap = new Map(points.map((point) => [point.id, point]))

    // Get all proposals in parallel
    const proposals = await Promise.all(
      proposalKeys.map(async (key) => {
        const pointId = key.replace('proposals:', '')
        const point = pointsMap.get(pointId)
        if (!point) return null

        const proposals = (await kv.lrange(key, 0, -1)) as EditProposal[]
        return proposals.map((proposal) => ({
          ...proposal,
          spotName: point.name,
          currentName: point.name,
          currentType: point.type,
        }))
      }),
    )

    // Flatten and filter out null values
    const allProposals = proposals.flat().filter((p): p is EditProposal => p !== null)

    // Sort by creation date, newest first
    allProposals.sort((a, b) => b.createdAt - a.createdAt)

    // Cache the results for 5 minutes
    await kv.set('admin:proposals', allProposals, { ex: 300 })

    return NextResponse.json(allProposals)
  } catch (error) {
    console.error('Error fetching proposals:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
