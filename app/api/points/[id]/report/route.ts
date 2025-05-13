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
  activeReports?: Report[]
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

const POINTS_KEY = 'points:all'

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
    // Get all points
    const points: MapPoint[] = (await kv.get(POINTS_KEY)) || []
    const pointIndex = points.findIndex((p) => p.id === spotId)
    if (pointIndex === -1) {
      return new NextResponse('Spot not found', { status: 404 })
    }
    const point = points[pointIndex]
    const activeReports = point.activeReports || []
    // Check if user has already reported this spot
    const hasExistingReport = activeReports.some((report) => report.userId === userId)
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
      spotName: point.name,
      userEmail,
    }
    // Add new report to activeReports array
    const updatedActiveReports = [...activeReports, newReport]
    points[pointIndex] = {
      ...point,
      activeReports: updatedActiveReports,
      lastUpdated: Date.now(),
    }
    await kv.set(POINTS_KEY, points)
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
    // Get all points
    const points: MapPoint[] = (await kv.get(POINTS_KEY)) || []
    const point = points.find((p) => p.id === spotId)
    if (!point) {
      return new NextResponse('Spot not found', { status: 404 })
    }
    const activeReports = point.activeReports || []
    return NextResponse.json(activeReports)
  } catch (error) {
    console.error('Error fetching reports:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
