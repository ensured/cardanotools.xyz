import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { kv } from '@vercel/kv'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Get all report keys
    const reportKeys = await kv.keys('reports:*')

    // Delete all report entries
    await Promise.all(reportKeys.map((key) => kv.del(key)))

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('[REPORTS_DENY_ALL]', error)
    return new NextResponse('Internal Error', { status: 500 })
  }
}
