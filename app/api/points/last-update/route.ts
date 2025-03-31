import { NextResponse } from 'next/server'
import { kv } from '@vercel/kv'

export async function GET() {
  try {
    // Get the last update timestamp from KV
    const lastUpdate = await kv.get<number>('points:last_update')

    if (!lastUpdate) {
      return new NextResponse(null, { status: 404 })
    }

    return new NextResponse(null, {
      status: 200,
      headers: {
        'Last-Modified': new Date(lastUpdate).toUTCString(),
      },
    })
  } catch (error) {
    console.error('Error getting last update:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
