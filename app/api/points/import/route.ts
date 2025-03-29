import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { kv } from '@vercel/kv'
import { isAdmin } from '@/lib/admin'

interface MapPoint {
  id: string
  name: string
  type: 'street' | 'park' | 'diy'
  coordinates: [number, number]
  createdBy: string
}

const PRE_EXISTING_SPOTS = {
  '9mg': {
    lat: 33.74431610107422,
    lng: -118.2805404663086,
    key: '9mg',
    spotcount: '1',
    shortId: 'PMYKZq-Iq',
  },
  '9mt': {
    lat: 31.865251541137695,
    lng: -116.61643981933594,
    key: '9mt',
    spotcount: '2',
    shortId: 'J-7ODrRWu',
  },
  // ... add all other spots here
}

export async function POST() {
  try {
    const { userId } = await auth()

    // Only allow admin access
    if (!userId || !(await isAdmin())) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const importedPoints: MapPoint[] = []
    const errors: string[] = []

    // Process each spot
    for (const [key, spot] of Object.entries(PRE_EXISTING_SPOTS)) {
      try {
        const point: MapPoint = {
          id: `legacy_${spot.shortId}`,
          name: `Skate Spot ${spot.shortId}`,
          type: 'street',
          coordinates: [spot.lat, spot.lng],
          createdBy: 'system',
        }

        // Save to KV
        await kv.set(`point:${point.id}`, point)
        importedPoints.push(point)
      } catch (error) {
        errors.push(`Failed to import spot ${key}: ${error}`)
      }
    }

    return NextResponse.json({
      success: true,
      imported: importedPoints.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Error importing points:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
