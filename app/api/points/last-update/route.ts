import { kv } from '@vercel/kv'
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Get the last update timestamp from cache
    const lastUpdate = await kv.get<number>('points:last_update')

    // If no last update timestamp exists, return current timestamp
    if (!lastUpdate) {
      return NextResponse.json({ lastUpdate: Date.now() })
    }

    return NextResponse.json({ lastUpdate })
  } catch (error) {
    console.error('Error getting last update:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
