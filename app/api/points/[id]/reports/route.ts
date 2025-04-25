import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { kv } from '@vercel/kv'
import { v7 as uuidv7 } from 'uuid'

interface Report {
  id: string
  reason: string
  createdBy: string
  createdByName: string
  createdAt: number
  status: 'pending' | 'resolved' | 'rejected'
  resolution?: string
  resolvedBy?: string
  resolvedByName?: string
  resolvedAt?: number
}

interface MapPoint {
  id: string
  name: string
  type: 'street' | 'park' | 'diy'
  coordinates: [number, number]
  createdBy: string
  lastUpdated?: number
  reports?: Report[]
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params

    // Get the point
    const point = await kv.get<MapPoint>(`point:${params.id}`)
    if (!point) {
      return new NextResponse('Spot not found', { status: 404 })
    }

    // Return reports sorted by creation date (newest first)
    const reports = point.reports || []
    reports.sort((a, b) => b.createdAt - a.createdAt)

    return NextResponse.json(reports)
  } catch (error) {
    console.error('[REPORTS_GET]', error)
    return new NextResponse('Internal Error', { status: 500 })
  }
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
    const userName =
      user?.firstName && user?.lastName
        ? `${user.firstName} ${user.lastName}`
        : user?.firstName || user?.username || 'Anonymous'

    if (!userEmail) {
      return new NextResponse('User email not found', { status: 400 })
    }

    // Get the point
    const point = await kv.get<MapPoint>(`point:${params.id}`)
    if (!point) {
      return new NextResponse('Spot not found', { status: 404 })
    }

    const { reason } = await request.json()

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return new NextResponse('Invalid report reason', { status: 400 })
    }

    // Generate a new UUID v7 for the report
    const reportId = uuidv7()

    // Create the report
    const report: Report = {
      id: reportId,
      reason: reason.trim(),
      createdBy: userEmail,
      createdByName: userName,
      createdAt: Date.now(),
      status: 'pending',
    }

    // Use pipeline for atomic operations
    const pipeline = kv.pipeline()

    // Add the report to the point's reports array
    const updatedPoint: MapPoint = {
      ...point,
      reports: [...(point.reports || []), report],
      lastUpdated: Date.now(),
    }

    // Update the point with the new report
    pipeline.set(`point:${params.id}`, updatedPoint)

    // Execute all operations atomically
    await pipeline.exec()

    return NextResponse.json(report)
  } catch (error) {
    console.error('[REPORTS_POST]', error)
    return new NextResponse('Internal Error', { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    const params = await context.params
    const { reportId, status, resolution } = await request.json()

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    if (!reportId || typeof reportId !== 'string') {
      return new NextResponse('Invalid report ID', { status: 400 })
    }

    if (!status || !['resolved', 'rejected'].includes(status)) {
      return new NextResponse('Invalid status', { status: 400 })
    }

    const user = await currentUser()
    const userEmail = user?.emailAddresses[0]?.emailAddress
    const userName =
      user?.firstName && user?.lastName
        ? `${user.firstName} ${user.lastName}`
        : user?.firstName || user?.username || 'Anonymous'

    if (!userEmail) {
      return new NextResponse('User email not found', { status: 400 })
    }

    // Check if user is admin
    const isAdmin = user.emailAddresses.some(
      (email) => email.emailAddress === process.env.ADMIN_EMAIL,
    )
    if (!isAdmin) {
      return new NextResponse('Unauthorized', { status: 403 })
    }

    // Get the point
    const point = await kv.get<MapPoint>(`point:${params.id}`)
    if (!point) {
      return new NextResponse('Spot not found', { status: 404 })
    }

    // Find the report
    const reportIndex = point.reports?.findIndex((r) => r.id === reportId)
    if (reportIndex === -1 || reportIndex === undefined) {
      return new NextResponse('Report not found', { status: 404 })
    }

    // Update the report
    const updatedReport: Report = {
      ...point.reports![reportIndex],
      status,
      resolution,
      resolvedBy: userEmail,
      resolvedByName: userName,
      resolvedAt: Date.now(),
    }

    // Use pipeline for atomic operations
    const pipeline = kv.pipeline()

    // Update the point with the resolved report
    const updatedPoint: MapPoint = {
      ...point,
      reports: point.reports?.map((r, i) => (i === reportIndex ? updatedReport : r)),
      lastUpdated: Date.now(),
    }

    // Update the point with the resolved report
    pipeline.set(`point:${params.id}`, updatedPoint)

    // Execute all operations atomically
    await pipeline.exec()

    return NextResponse.json(updatedReport)
  } catch (error) {
    console.error('[REPORTS_PATCH]', error)
    return new NextResponse('Internal Error', { status: 500 })
  }
}
