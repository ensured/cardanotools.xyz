'use server'

import { kv } from '@vercel/kv'
import { currentUser } from '@clerk/nextjs/server'

async function checkAdmin() {
  const user = await currentUser()
  if (!user) return false

  return user.emailAddresses.some((email) => email.emailAddress === process.env.ADMIN_EMAIL)
}

interface Report {
  id: string
  spotId: string
  userId: string
  userEmail: string
  reason: string
  createdAt: number
  status: 'pending' | 'reviewed' | 'resolved' | 'pending' | 'resolved' | 'rejected'
  adminNotes?: string
  spotName?: string
}

interface Point {
  id: string
  name: string
  type: 'street' | 'park' | 'diy'
  coordinates: [number, number]
  createdBy: string
  address?: string
  description?: string
  editProposals?: EditProposal[]
  activeReports?: Report[]
  activeProposals?: EditProposal[]
  lastUpdated?: number
}

interface StoredProposal {
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
  spotName: string
  currentName: string
  currentType: 'street' | 'park' | 'diy'
  currentDescription?: string
}

interface EditProposalSubmission {
  spotId: string
  proposedName: string
  proposedType: 'street' | 'park' | 'diy'
  proposedDescription?: string
  reason: string
  userId: string
  userEmail: string
}

const POINTS_KEY = 'points:all'

export async function getReports() {
  try {
    const adminStatus = await checkAdmin()
    if (!adminStatus) {
      return { reports: [], error: 'Forbidden' }
    }
    // Read all points from points:all
    const points: any[] = (await kv.get(POINTS_KEY)) || []
    // Aggregate all activeReports from all points
    const reports: Report[] = []
    points.forEach((point) => {
      if (point.activeReports && Array.isArray(point.activeReports)) {
        point.activeReports.forEach((report: any) => {
          reports.push({
            ...report,
            spotId: point.id,
            spotName: point.name,
          })
        })
      }
    })
    // Sort by creation date (newest first)
    reports.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    return { reports, error: null }
  } catch (error) {
    console.error('Error fetching reports:', error)
    return { reports: [], error: 'Internal Server Error' }
  }
}

export async function getProposals(): Promise<EditProposal[]> {
  const isUserAdmin = await checkAdmin()
  if (!isUserAdmin) {
    throw new Error('Unauthorized')
  }
  try {
    // Read all points from points:all
    const points: any[] = (await kv.get(POINTS_KEY)) || []
    // Aggregate all activeProposals from all points
    const allProposals: EditProposal[] = []
    points.forEach((point) => {
      if (point.activeProposals && Array.isArray(point.activeProposals)) {
        point.activeProposals.forEach((p: any) => {
          allProposals.push({
            ...p,
            spotName: point.name,
            currentName: point.name,
            currentType: point.type,
            currentDescription: point.description,
          })
        })
      }
    })
    // Sort by creation date
    return allProposals.sort((a, b) => b.createdAt - a.createdAt)
  } catch (error) {
    console.error('Error fetching proposals:', error)
    throw new Error('Failed to fetch proposals')
  }
}

export async function updateReportStatus(
  reportId: string,
  status: 'accept' | 'deny',
  adminNotes?: string,
) {
  try {
    const adminStatus = await checkAdmin()
    if (!adminStatus) {
      return { success: false, error: 'Forbidden' }
    }
    // Read all points from points:all
    const points: any[] = (await kv.get(POINTS_KEY)) || []
    let foundReport = false
    let updatedPoints = points.map((point) => {
      if (point.activeReports && Array.isArray(point.activeReports)) {
        const reportIndex = point.activeReports.findIndex((r: any) => r.id === reportId)
        if (reportIndex !== -1) {
          foundReport = true
          // Remove the report from the array
          const updatedReports = point.activeReports.filter((r: any) => r.id !== reportId)
          // If accepted, remove the point entirely from the array
          if (status === 'accept') {
            return null
          } else {
            // Just update the activeReports array (removing the denied report)
            return {
              ...point,
              activeReports: updatedReports,
              lastUpdated: Date.now(),
            }
          }
        }
      }
      return point
    })
    // Remove nulls if any points were deleted
    updatedPoints = updatedPoints.filter(Boolean)
    if (!foundReport) {
      return {
        success: false,
        error: `Report not found: ${reportId}. Please check if this report still exists.`,
      }
    }
    await kv.set(POINTS_KEY, updatedPoints)
    return { success: true, error: null }
  } catch (error) {
    console.error('Error updating report status:', error)
    return { success: false, error: 'Internal Server Error' }
  }
}

export async function submitEditProposal(submission: EditProposalSubmission) {
  const user = await currentUser()
  if (!user) {
    throw new Error('Unauthorized - User not authenticated')
  }

  if (!submission.spotId) {
    throw new Error('Invalid submission: spotId is required')
  }

  try {
    // Log the attempt
    console.log(`Attempting to submit proposal for spot ${submission.spotId}`)

    // Read all points from points:all
    const points: Point[] = (await kv.get(POINTS_KEY)) || []
    const pointIndex = points.findIndex((p) => p.id === submission.spotId)
    if (pointIndex === -1) {
      console.error(`Spot not found in points:all: ${submission.spotId}`)
      throw new Error(`Spot not found: ${submission.spotId}`)
    }
    const point = points[pointIndex]

    const newProposal: EditProposal = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2)}`,
      ...submission,
      createdAt: Date.now(),
      status: 'pending',
      spotName: point.name,
      currentName: point.name,
      currentType: point.type,
      currentDescription: point.description,
    }

    // Add the proposal to the point's activeProposals array
    const updatedActiveProposals = [...(point.activeProposals || []), newProposal]
    points[pointIndex] = {
      ...point,
      activeProposals: updatedActiveProposals,
      lastUpdated: Date.now(),
    }

    // Store the updated points array
    await kv.set(POINTS_KEY, points)

    return { success: true, proposal: newProposal }
  } catch (error) {
    console.error('Error submitting proposal:', error)
    throw new Error(
      `Failed to submit proposal: ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}

export async function updateProposalStatus(
  spotId: string,
  proposalId: string,
  status: 'approved' | 'rejected',
  adminNotes?: string,
) {
  const isUserAdmin = await checkAdmin()
  if (!isUserAdmin) {
    throw new Error('Unauthorized')
  }

  try {
    // Read all points from points:all
    const points: Point[] = (await kv.get(POINTS_KEY)) || []
    const pointIndex = points.findIndex((p) => p.id === spotId)
    if (pointIndex === -1) {
      throw new Error('Point not found')
    }
    const point = points[pointIndex]
    const proposal = point.activeProposals?.find((p) => p.id === proposalId)
    if (!proposal) {
      throw new Error('Proposal not found')
    }
    // Remove the proposal from the list
    const updatedActiveProposals = (point.activeProposals || []).filter((p) => p.id !== proposalId)
    // If approving, update the point with proposed changes
    if (status === 'approved') {
      points[pointIndex] = {
        ...point,
        name: proposal.proposedName,
        type: proposal.proposedType,
        description: proposal.proposedDescription,
        lastUpdated: Date.now(),
        activeProposals: updatedActiveProposals,
      }
    } else {
      // If rejecting, just update the proposals array
      points[pointIndex] = {
        ...point,
        lastUpdated: Date.now(),
        activeProposals: updatedActiveProposals,
      }
    }
    await kv.set(POINTS_KEY, points)
    return { success: true }
  } catch (error) {
    console.error('Error updating proposal:', error)
    throw new Error('Failed to update proposal')
  }
}

export async function deleteLegacyPoints() {
  const isUserAdmin = await checkAdmin()
  if (!isUserAdmin) {
    throw new Error('Unauthorized')
  }

  try {
    // Get all keys matching the legacy pattern
    const legacyKeys = await kv.keys('point:legacy_*')
    console.log('Found legacy keys:', legacyKeys)

    if (legacyKeys.length === 0) {
      return { success: true, deletedCount: 0, message: 'No legacy points found' }
    }

    // Delete legacy keys
    for (const key of legacyKeys) {
      await kv.del(key)
      console.log(`Deleted legacy point: ${key}`)
    }

    return {
      success: true,
      deletedCount: legacyKeys.length,
      message: `Successfully deleted ${legacyKeys.length} legacy points`,
    }
  } catch (error) {
    console.error('Error deleting legacy points:', error)
    throw new Error(
      `Failed to delete legacy points: ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}
