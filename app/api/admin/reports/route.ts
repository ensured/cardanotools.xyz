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

interface Report {
  id: string
  userId: string
  reason: string
  createdAt: number
  status: 'pending' | 'reviewed' | 'resolved'
  spotId: string
  spotName: string
}

export async function GET() {
  try {
    const { userId } = await auth()

    // Only allow admin access
    if (!userId || !(await isAdmin())) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Get all points
    const points = await kv.keys('point:*')
    const allReports: Report[] = []

    // Fetch reports for each point
    for (const pointKey of points) {
      const pointId = pointKey.replace('point:', '')
      const point = await kv.get<MapPoint>(pointKey)
      const reports = (await kv.get<Report[]>(`reports:${pointId}`)) || []

      // Skip if point doesn't exist
      if (!point) continue

      // Add spot information to each report
      const reportsWithSpotInfo = reports.map((report) => ({
        ...report,
        spotId: pointId,
        spotName: point.name,
      }))

      allReports.push(...reportsWithSpotInfo)
    }

    // Sort by creation date, newest first
    allReports.sort((a, b) => b.createdAt - a.createdAt)

    return NextResponse.json(allReports)
  } catch (error) {
    console.error('Error fetching reports:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
