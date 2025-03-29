import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { kv } from '@vercel/kv'
import { isAdmin } from '@/lib/admin'

interface Report {
  id: string
  userId: string
  reason: string
  createdAt: number
  status: 'pending' | 'reviewed' | 'resolved'
}

export async function PATCH(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const { userId } = await auth()

    // Only allow admin access
    if (!userId || !(await isAdmin())) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { id } = context.params
    const { status } = await request.json()

    if (!status || !['reviewed', 'resolved'].includes(status)) {
      return new NextResponse('Invalid status', { status: 400 })
    }

    // Get all points
    const points = await kv.keys('point:*')
    let reportFound = false

    // Find and update the report
    for (const pointKey of points) {
      const pointId = pointKey.replace('point:', '')
      const reports = (await kv.get<Report[]>(`reports:${pointId}`)) || []

      const updatedReports = reports.map((report) => {
        if (report.id === id) {
          reportFound = true
          return { ...report, status }
        }
        return report
      })

      if (reportFound) {
        await kv.set(`reports:${pointId}`, updatedReports)
        break
      }
    }

    if (!reportFound) {
      return new NextResponse('Report not found', { status: 404 })
    }

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Error updating report:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
