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
  status: 'pending' | 'reviewed' | 'resolved'
  adminNotes?: string
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

export async function getReports() {
  try {
    const adminStatus = await checkAdmin()
    if (!adminStatus) {
      return { reports: [], error: 'Forbidden' }
    }

    // New format for retrieving reports - scan all point keys and collect reports
    const reportKeys = await kv.keys('report:*')

    if (!reportKeys || reportKeys.length === 0) {
      // Fallback to checking pointwise reports for backward compatibility
      const pointKeys = await kv.keys('point:*')
      const reports: Array<Report & { spotName?: string }> = []

      // Process each point to extract its reports
      await Promise.all(
        pointKeys.map(async (key) => {
          const pointId = key.replace('point:', '')
          const pointReportsKey = `point:${pointId}:reports`

          try {
            const pointReports = await kv.get<Array<Report>>(pointReportsKey)
            if (pointReports && Array.isArray(pointReports)) {
              // Add spot name to reports
              const point = await kv.get<Point>(`point:${pointId}`)
              const reportsWithSpotName = pointReports.map((report) => ({
                ...report,
                spotId: pointId,
                spotName: point?.name || 'Unknown Spot',
              }))
              reports.push(...reportsWithSpotName)
            }
          } catch (e) {
            console.error(`Error fetching reports for point ${pointId}:`, e)
          }
        }),
      )

      return { reports, error: null }
    }

    // Process new format reports
    const reports = await Promise.all(
      reportKeys.map(async (key) => {
        const report = await kv.get<Report & { spotName?: string }>(key)
        if (!report) return null

        // Fetch spot name if not included in report
        if (report.spotId && !report.spotName) {
          try {
            const point = await kv.get<Point>(`point:${report.spotId}`)
            if (point) {
              return {
                ...report,
                id: key.replace('report:', ''),
                spotName: point.name,
              } as Report & { spotName: string }
            }
          } catch (e) {
            console.error(`Error fetching spot name for report ${key}:`, e)
          }
        }

        return {
          ...report,
          id: key.replace('report:', ''),
        } as Report
      }),
    )

    // Filter out null values and sort by creation date (newest first)
    const validReports = reports
      .filter((r): r is Report & { spotName?: string } => r !== null)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

    return { reports: validReports, error: null }
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
    // Get all point keys
    const pointKeys = await kv.keys('point:*')

    // Fetch all points and their proposals
    const points = await Promise.all(pointKeys.map(async (key) => await kv.get<Point>(key)))

    // Collect all pending proposals from all points
    const allProposals: EditProposal[] = []
    points.forEach((point) => {
      if (point?.editProposals) {
        const pendingProposals = point.editProposals
          .filter((p) => p.status === 'pending')
          .map((p) => ({
            ...p,
            spotName: point.name,
            currentName: point.name,
            currentType: point.type,
          }))
        allProposals.push(...pendingProposals)
      }
    })

    // Sort by creation date
    return allProposals.sort((a, b) => b.createdAt - a.createdAt)
  } catch (error) {
    console.error('Error fetching proposals:', error)
    throw new Error('Failed to fetch proposals')
  }
}

export async function updateReportStatus(reportId: string, status: 'accept' | 'deny') {
  try {
    const adminStatus = await checkAdmin()
    if (!adminStatus) {
      return { success: false, error: 'Forbidden' }
    }

    let foundReport = false
    let spotId: string | null = null

    // Try to find the report in the new format first
    const reportData = await kv.get<Report>(`report:${reportId}`)
    console.log(
      `Checking for report:${reportId} in new format:`,
      reportData ? 'Found' : 'Not found',
    )

    if (reportData) {
      foundReport = true
      spotId = reportData.spotId

      // If accepting the report, delete the spot
      if (status === 'accept') {
        await kv.del(`point:${spotId}`)
      }

      // Delete the individual report
      await kv.del(`report:${reportId}`)
    }

    // Even if found in new format, check legacy format as well for cleanup
    const legacyReportData = await kv.hget('reports', reportId)
    console.log(
      `Checking for report ${reportId} in legacy format:`,
      legacyReportData ? 'Found' : 'Not found',
    )

    if (legacyReportData) {
      foundReport = true
      const legacySpotId = (legacyReportData as Report).spotId
      spotId = spotId || legacySpotId

      // Process legacy report
      if (status === 'accept') {
        await kv.hdel('points', legacySpotId)
      }

      await kv.hdel('reports', reportId)
    }

    // Check if the report might be stored within a point's reports array
    if (!foundReport || !spotId) {
      // Search all points for this report ID
      const pointKeys = await kv.keys('point:*')

      for (const key of pointKeys) {
        const pointId = key.replace('point:', '')

        // Check in point:${id}:reports
        const reportsKey = `point:${pointId}:reports`
        const pointReports = await kv.get<Report[]>(reportsKey)

        if (pointReports) {
          const reportIndex = pointReports.findIndex((r) => r.id === reportId)
          if (reportIndex >= 0) {
            foundReport = true
            spotId = pointId
            console.log(`Found report ${reportId} in point:${pointId}:reports`)

            // Remove from the reports collection
            const updatedReports = pointReports.filter((r) => r.id !== reportId)
            await kv.set(reportsKey, updatedReports)
            break
          }
        }

        // Check in the point itself
        const point = await kv.get<any>(key)
        if (point?.reports && Array.isArray(point.reports)) {
          const reportIndex = point.reports.findIndex((r: any) => r.id === reportId)
          if (reportIndex >= 0) {
            foundReport = true
            spotId = pointId
            console.log(`Found report ${reportId} in point:${pointId} data`)

            // Remove from the point's reports array
            const updatedPoint = {
              ...point,
              reports: point.reports.filter((r: any) => r.id !== reportId),
              lastUpdated: Date.now(),
            }
            await kv.set(key, updatedPoint)
            break
          }
        }
      }
    }

    // If we have a spotId but the report wasn't found in point:${spotId}:reports,
    // check there anyway as an extra safety measure
    if (spotId) {
      try {
        const reportsKey = `point:${spotId}:reports`
        const pointReports = (await kv.get<Report[]>(reportsKey)) || []
        if (pointReports.some((r) => r.id === reportId)) {
          foundReport = true
          console.log(
            `Found report ${reportId} in point:${spotId}:reports (spot ID from other location)`,
          )
          const updatedReports = pointReports.filter((r) => r.id !== reportId)
          await kv.set(reportsKey, updatedReports)
        }

        // Also check in the point itself
        const point = await kv.get<any>(`point:${spotId}`)
        if (point?.reports && Array.isArray(point.reports)) {
          if (point.reports.some((r: any) => r.id === reportId)) {
            foundReport = true
            console.log(
              `Found report ${reportId} in point:${spotId} data (spot ID from other location)`,
            )
            const updatedPoint = {
              ...point,
              reports: point.reports.filter((r: any) => r.id !== reportId),
              lastUpdated: Date.now(),
            }
            await kv.set(`point:${spotId}`, updatedPoint)
          }
        }
      } catch (e) {
        console.error(`Error cleaning up report ${reportId} in point:${spotId} locations:`, e)
        // Continue execution even if this fails
      }
    }

    if (!foundReport) {
      // Check if this report ID pattern is a UUID v7 (starts with timestamp part)
      const isV7Format =
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reportId)
      console.log(`Report not found in any storage location. Using UUID v7 format: ${isV7Format}`)

      return {
        success: false,
        error: `Report not found: ${reportId}. Please check if this report still exists.`,
      }
    }

    console.log(`Successfully processed report ${reportId} with status ${status}`)
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

    const spotData = await kv.get<Point>(`point:${submission.spotId}`)
    if (!spotData) {
      console.error(`Spot not found in KV store: ${submission.spotId}`)
      throw new Error(`Spot not found: ${submission.spotId}`)
    }

    const newProposal: EditProposal = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2)}`,
      ...submission,
      createdAt: Date.now(),
      status: 'pending',
      spotName: spotData.name,
      currentName: spotData.name,
      currentType: spotData.type,
      currentDescription: spotData.description,
    }

    // Log the proposal being created
    console.log(`Creating new proposal for spot ${spotData.name} (${submission.spotId})`)

    // Add the proposal to the point's editProposals array
    const updatedPoint: Point = {
      ...spotData,
      editProposals: [...(spotData.editProposals || []), newProposal],
    }

    // Store the updated point
    await kv.set(`point:${submission.spotId}`, updatedPoint)

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
    const point = await kv.get<Point>(`point:${spotId}`)
    if (!point) {
      throw new Error('Point not found')
    }

    const proposal = point.editProposals?.find((p) => p.id === proposalId)
    if (!proposal) {
      throw new Error('Proposal not found')
    }

    // Update the proposal's status and admin notes
    const updatedProposals =
      point.editProposals?.map((p) => (p.id === proposalId ? { ...p, status, adminNotes } : p)) ||
      []

    // If approving, update the point with proposed changes
    if (status === 'approved') {
      await kv.set(`point:${spotId}`, {
        ...point,
        name: proposal.proposedName,
        type: proposal.proposedType,
        description: proposal.proposedDescription,
        lastUpdated: Date.now(),
        editProposals: updatedProposals,
      })
    } else {
      // If rejecting, just update the proposals array
      await kv.set(`point:${spotId}`, {
        ...point,
        editProposals: updatedProposals,
      })
    }

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
