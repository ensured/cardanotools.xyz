'use server'

import { kv } from '@vercel/kv'
import { auth, currentUser } from '@clerk/nextjs/server'
import { isAdmin } from '@/lib/hooks/isAdmin'

interface MapPoint {
  id: string
  name: string
  type: 'street' | 'park' | 'diy'
  coordinates: [number, number]
  createdBy: string
  lastUpdated?: number
}

export async function deleteAllSpots() {
  try {
    const { userId } = await auth()
    if (!userId) {
      throw new Error('Unauthorized')
    }

    // Check if user is admin
    const admin = await isAdmin()
    if (!admin) {
      throw new Error('Unauthorized - Admin access required')
    }

    console.log('Starting deletion of all spots...')

    // Get all point IDs
    const pointIds = await kv.lrange('points:ids', 0, -1)
    console.log(`Found ${pointIds.length} points to delete`)

    if (pointIds.length === 0) {
      return {
        success: true,
        message: 'No spots to delete',
        count: 0,
      }
    }

    // Use pipeline for atomic operations
    const pipeline = kv.pipeline()

    // Delete all individual points
    for (const id of pointIds) {
      pipeline.del(`point:${id}`)
    }

    // Delete the points list
    pipeline.del('points:ids')

    // Execute all operations atomically
    await pipeline.exec()
    console.log('All spot data deleted successfully')

    return {
      success: true,
      message: `Successfully deleted all spots`,
      count: pointIds.length,
    }
  } catch (error) {
    console.error('Error deleting spots:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete spots',
    }
  }
}
