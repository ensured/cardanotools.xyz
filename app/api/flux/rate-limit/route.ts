import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'

// Rate limit configuration
const RATE_LIMIT = 10 // 10 images per hour
const RATE_LIMIT_WINDOW = 60 * 60 // 1 hour in seconds

// Helper function to get the client IP address from Vercel request
function getClientIp(request: NextRequest): string {
  // Vercel-specific headers for IP address
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  // Fallback to Vercel-specific header
  const vercelForwardedFor = request.headers.get('x-vercel-forwarded-for')
  if (vercelForwardedFor) {
    return vercelForwardedFor
  }

  // Fallback to real IP
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  // Default fallback
  return '127.0.0.1'
}

// Get rate limit status for the given IP address
async function getRateLimitStatus(ip: string): Promise<{
  limit: number
  remaining: number
  resetTime: number
}> {
  const key = `flux:${ip}`

  // Get current usage from Vercel KV
  let usage = (await kv.get<number[]>(key)) || []

  // Current timestamp in seconds
  const now = Math.floor(Date.now() / 1000)

  // Filter out timestamps older than the rate limit window
  usage = usage.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW)

  // Calculate when the oldest timestamp will expire
  let resetTime: number

  if (usage.length === 0) {
    // If no usage, reset time is now (already reset)
    resetTime = now
  } else if (usage.length < RATE_LIMIT) {
    // If under the limit, reset time is when the window ends from now
    resetTime = now + RATE_LIMIT_WINDOW
  } else {
    // If at the limit, reset time is when the oldest timestamp expires
    const oldestTimestamp = Math.min(...usage)
    resetTime = oldestTimestamp + RATE_LIMIT_WINDOW
  }

  return {
    limit: RATE_LIMIT,
    remaining: Math.max(0, RATE_LIMIT - usage.length),
    resetTime: resetTime * 1000, // Convert to milliseconds for JavaScript Date
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get client IP address
    const clientIp = getClientIp(request)

    // Get rate limit status
    const status = await getRateLimitStatus(clientIp)

    // Return rate limit information
    return NextResponse.json(status)
  } catch (error) {
    console.error('Error fetching rate limit status:', error)
    return NextResponse.json({ error: 'Failed to fetch rate limit status' }, { status: 500 })
  }
}
