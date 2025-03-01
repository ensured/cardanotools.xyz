import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'

// Set the runtime to edge for better performance
export const runtime = 'edge'

/**
 * This route handles receiving callbacks from the image generation API
 * It can be used to update UI in real-time when results are ready
 */
export async function POST(request: NextRequest) {
  try {
    // Parse the incoming webhook data
    const data = await request.json()
    const { jobId, status, imageData, metadata, error } = data

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 })
    }

    // Store the callback in KV for the client to retrieve
    // This creates a bridge between the server-side callback and client-side polling
    const callbackKey = `flux:callback:${jobId}`

    // Store the callback data
    await kv.set(
      callbackKey,
      {
        received: Date.now(),
        status,
        imageData,
        metadata,
        error,
      },
      { ex: 60 * 30 },
    ) // 30 minute expiration

    // Send event to any connected SSE clients (future enhancement)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error handling callback:', error)
    return NextResponse.json({ error: 'Failed to process callback' }, { status: 500 })
  }
}

// Clients can check if a callback was received via GET request
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 })
    }

    // Check if we have received a callback for this job
    const callbackData = await kv.get(`flux:callback:${jobId}`)

    if (!callbackData) {
      return NextResponse.json({
        status: 'waiting',
        message: 'No callback received yet',
      })
    }

    return NextResponse.json(callbackData)
  } catch (error) {
    console.error('Error checking callback status:', error)
    return NextResponse.json({ error: 'Failed to check callback status' }, { status: 500 })
  }
}
