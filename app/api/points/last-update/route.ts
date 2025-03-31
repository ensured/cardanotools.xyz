import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    // Get the most recent lastUpdated timestamp from all points
    const result = await db.query('SELECT MAX(last_updated) as last_update FROM points')

    const lastUpdate = result.rows[0]?.last_update || Date.now()

    return NextResponse.json({ lastUpdate })
  } catch (error) {
    console.error('Error fetching last update:', error)
    return NextResponse.json({ error: 'Failed to fetch last update' }, { status: 500 })
  }
}
