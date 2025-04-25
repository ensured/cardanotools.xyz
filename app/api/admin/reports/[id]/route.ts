import { NextResponse } from 'next/server'
import { updateReportStatus } from '@/app/actions/admin'
import { auth } from '@clerk/nextjs/server'
import { isAdmin } from '@/lib/admin'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const resolvedParams = await params
    const { id } = resolvedParams
    const { status } = await request.json()

    if (!['accept', 'deny'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const result = await updateReportStatus(id, status as 'accept' | 'deny')

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in admin reports API:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
