import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { kv } from '@vercel/kv'

interface Report {
  id: string
  userId: string
  reason: string
  createdAt: number
  status: 'pending' | 'reviewed' | 'resolved'
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const params = await context.params
    const body = await request.json()
    const { status } = body

    // Get all points
    const points = await kv.keys('point:*')
    let reportFound = false

    // Find and update the report
    for (const pointKey of points) {
      const pointId = pointKey.replace('point:', '')
      const reports = (await kv.get<Report[]>(`reports:${pointId}`)) || []

      const updatedReports = reports.map((report) => {
        if (report.id === params.id) {
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
    console.error('[REPORT_PATCH]', error)
    return new NextResponse('Internal Error', { status: 500 })
  }
}
