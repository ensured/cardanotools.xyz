import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { kv } from '@vercel/kv'
import { v7 as uuidv7 } from 'uuid'

interface MapPoint {
  id: string
  name: string
  type: 'street' | 'park' | 'diy'
  coordinates: [number, number]
  createdBy: string
  lastUpdated?: number
}

interface Report {
  id: string
  userId: string
  reason: string
  createdAt: number
  status: 'pending' | 'reviewed' | 'resolved'
  spotId: string
  spotName?: string
  userEmail?: string
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    const params = await context.params
    const spotId = params.id

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { reason } = await request.json()

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return new NextResponse('Invalid reason', { status: 400 })
    }

    // Check if the spot exists
    const spot = await kv.get<MapPoint>(`point:${spotId}`)
    if (!spot) {
      return new NextResponse('Spot not found', { status: 404 })
    }

    // Get existing reports for this spot
    const reports = (await kv.get<Report[]>(`point:${spotId}:reports`)) || []

    // Check if user has already reported this spot
    const hasExistingReport = reports.some((report) => report.userId === userId)

    if (hasExistingReport) {
      return new NextResponse('You have already reported this spot', { status: 400 })
    }

    // Get user email for admin display
    const user = await currentUser()
    const userEmail = user?.emailAddresses[0]?.emailAddress || 'unknown'

    const reportId = uuidv7()

    const newReport: Report = {
      id: reportId,
      userId,
      reason: reason.trim(),
      createdAt: Date.now(),
      status: 'pending',
      spotId,
      spotName: spot.name,
      userEmail,
    }

    // Add new report to reports collection for this spot
    const updatedReports = [...reports, newReport]
    await kv.set(`point:${spotId}:reports`, updatedReports)

    // Store the report in the new format - individual report with report: prefix
    await kv.set(`report:${reportId}`, newReport)

    // Update the point's last updated timestamp
    await kv.set(`point:${spotId}`, {
      ...spot,
      lastUpdated: Date.now(),
    })

    return NextResponse.json(newReport)
  } catch (error) {
    console.error('Error creating report:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params
    const spotId = params.id

    // Check if the spot exists
    const spot = await kv.get<MapPoint>(`point:${spotId}`)
    if (!spot) {
      return new NextResponse('Spot not found', { status: 404 })
    }

    // Get all reports for this spot
    const reports = (await kv.get<Report[]>(`point:${spotId}:reports`)) || []

    return NextResponse.json(reports)
  } catch (error) {
    console.error('Error fetching reports:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
