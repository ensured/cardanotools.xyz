import { NextResponse } from 'next/server'
import { kv } from '@vercel/kv'
import { auth } from '@clerk/nextjs/server'
import { isAdmin } from '@/lib/admin'

export async function POST() {
  try {
    // Check if the user is authenticated
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if the user is an admin
    const adminStatus = await isAdmin()
    if (!adminStatus) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Find and delete all reports in the new format
    const reportKeys = await kv.keys('report:*')
    if (reportKeys.length > 0) {
      // Delete all reports with the report: prefix
      await Promise.all(reportKeys.map((key) => kv.del(key)))
    }

    // Clear legacy reports too for backward compatibility
    await kv.del('reports')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error denying all reports:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
