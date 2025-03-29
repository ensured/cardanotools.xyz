import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { kv } from '@vercel/kv'
import { isAdmin } from 'lib/admin'

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

    // Get all points and report keys in parallel
    const [points, reportKeys] = await Promise.all([
      kv.mget<MapPoint[]>(await kv.keys('point:*')),
      kv.keys('reports:*'),
    ])

    // Create a map of point IDs to point data for quick lookup
    const pointsMap = new Map(points.map((point) => [point.id, point]))

    // Get all reports in parallel
    const reports = await Promise.all(
      reportKeys.map(async (key) => {
        const pointId = key.replace('reports:', '')
        const reports = (await kv.get<Report[]>(key)) || []

        // Get point data if it exists, otherwise use a default name
        const point = pointsMap.get(pointId)
        const spotName = point?.name || 'Unknown Spot'

        return reports.map((report) => ({
          ...report,
          spotId: pointId,
          spotName,
        }))
      }),
    )

    // Flatten and filter out null values
    const allReports = reports.flat().filter((r): r is Report => r !== null)

    // Sort by creation date, newest first
    allReports.sort((a, b) => b.createdAt - a.createdAt)

    return NextResponse.json(allReports)
  } catch (error) {
    console.error('Error fetching reports:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
