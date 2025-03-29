import { NextResponse } from 'next/server'
import { isAdmin } from '@/lib/admin'

export async function GET() {
  try {
    const admin = await isAdmin()
    return admin
      ? new NextResponse(null, { status: 200 })
      : new NextResponse('Unauthorized', { status: 401 })
  } catch (error) {
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
