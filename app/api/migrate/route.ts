import { NextResponse } from 'next/server'
import { migrateSpots } from '@/scripts/migrate-spot-ids'

export async function POST() {
  try {
    await migrateSpots()
    return NextResponse.json({ success: true, message: 'Migration completed successfully' })
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({ success: false, error: 'Migration failed' }, { status: 500 })
  }
}
