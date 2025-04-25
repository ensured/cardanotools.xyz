import { NextResponse } from 'next/server'
import { getReports } from '@/app/actions/admin'
import { auth } from '@clerk/nextjs/server'
import { isAdmin } from '@/lib/admin'

export async function GET() {
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

    // Get reports
    const { reports, error } = await getReports()

    if (error) {
      return NextResponse.json({ error }, { status: 500 })
    }

    return NextResponse.json(reports)
  } catch (error) {
    console.error('Error in admin reports API:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
