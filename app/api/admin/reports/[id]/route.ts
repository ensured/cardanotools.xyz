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

    if (status !== 'accept' && status !== 'deny') {
      return new NextResponse('Invalid status', { status: 400 })
    }

    // Get all report keys
    const reportKeys = await kv.keys('reports:*')

    // Find the report and its associated spot
    let reportFound = false
    let spotId: string | null = null
    let report: Report | null = null

    // Use Promise.all to fetch all reports in parallel
    const reportPromises = reportKeys.map(async (key) => {
      const reports = await kv.get<Report[]>(key)
      const foundReport = reports?.find((r) => r.id === params.id)
      if (foundReport) {
        spotId = key.replace('reports:', '')
        report = foundReport
        return true
      }
      return false
    })

    const results = await Promise.all(reportPromises)
    reportFound = results.some((found) => found)

    if (!reportFound || !spotId || !report) {
      return new NextResponse('Report not found', { status: 404 })
    }

    if (status === 'accept') {
      // Remove the spot
      await kv.del(`point:${spotId}`)
      // Remove all reports for this spot
      await kv.del(`reports:${spotId}`)
    } else {
      // Get current reports and remove the specific report
      const currentReports = (await kv.get<Report[]>(`reports:${spotId}`)) || []
      const updatedReports = currentReports.filter((r) => r.id !== params.id)
      await kv.set(`reports:${spotId}`, updatedReports)
    }

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('[REPORT_PATCH]', error)
    return new NextResponse('Internal Error', { status: 500 })
  }
}
