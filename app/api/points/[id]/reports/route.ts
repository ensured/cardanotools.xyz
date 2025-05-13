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
    const pointId = params.id
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
    const { reason } = await request.json()
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return new NextResponse('Invalid report reason', { status: 400 })
    }
    const reportId = uuidv7()
    const report: Report = {
      id: reportId,
      reason: reason.trim(),
      createdBy: userEmail,
      createdByName: userName,
      createdAt: Date.now(),
      status: 'pending',
    }
    const points: MapPoint[] = (await kv.get(POINTS_KEY)) || []
    const pointIndex = points.findIndex((p) => p.id === pointId)
    if (pointIndex === -1) {
      return new NextResponse('Spot not found', { status: 404 })
    }
    const point = points[pointIndex]
    const reports = point.reports || []
    points[pointIndex] = {
      ...point,
      reports: [...reports, report],
      lastUpdated: Date.now(),
    }
    await kv.set(POINTS_KEY, points)
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
    const pointId = params.id
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
    const points: MapPoint[] = (await kv.get(POINTS_KEY)) || []
    const pointIndex = points.findIndex((p) => p.id === pointId)
    if (pointIndex === -1) {
      return new NextResponse('Spot not found', { status: 404 })
    }
    const point = points[pointIndex]
    const reports = point.reports || []
    const reportIndex = reports.findIndex((r) => r.id === reportId)
    if (reportIndex === -1) {
      return new NextResponse('Report not found', { status: 404 })
    }
    const updatedReport: Report = {
      ...reports[reportIndex],
      status,
      resolution,
      resolvedBy: userEmail,
      resolvedByName: userName,
      resolvedAt: Date.now(),
    }
    const updatedReports = [...reports]
    updatedReports[reportIndex] = updatedReport
    points[pointIndex] = {
      ...point,
      reports: updatedReports,
      lastUpdated: Date.now(),
    }
    await kv.set(POINTS_KEY, points)
    return NextResponse.json(updatedReport)
  } catch (error) {
    console.error('[REPORTS_PATCH]', error)
    return new NextResponse('Internal Error', { status: 500 })
  }
}
