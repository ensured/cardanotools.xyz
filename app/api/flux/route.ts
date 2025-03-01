import { NextRequest, NextResponse } from 'next/server'
import { HfInference } from '@huggingface/inference'
import { kv } from '@vercel/kv'

// Set the runtime to edge for better performance with image generation
export const runtime = 'edge'

// Initialize the Hugging Face inference client
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY)

// Rate limit configuration
const RATE_LIMIT = 10 // 10 images per hour
const RATE_LIMIT_WINDOW = 60 * 60 // 1 hour in seconds

// Default image dimensions if not specified
const DEFAULT_WIDTH = 1024
const DEFAULT_HEIGHT = 1024

// Quality settings
const STANDARD_QUALITY = {
  guidance_scale: 5.0,
  num_inference_steps: 30,
}

const HIGH_QUALITY = {
  guidance_scale: 7.5,
  num_inference_steps: 50,
}

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

// Check rate limit for the given IP address
async function checkRateLimit(ip: string): Promise<{ allowed: boolean; remaining: number }> {
  const key = `flux:${ip}`

  // Get current usage from Vercel KV
  let usage = (await kv.get<number[]>(key)) || []

  // Current timestamp in seconds
  const now = Math.floor(Date.now() / 1000)

  // Filter out timestamps older than the rate limit window
  usage = usage.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW)

  // Check if the rate limit has been exceeded
  if (usage.length >= RATE_LIMIT) {
    return { allowed: false, remaining: 0 }
  }

  // For HEAD requests, we don't add a timestamp (just checking status)
  return { allowed: true, remaining: RATE_LIMIT - usage.length }
}

// Add a timestamp to the usage array (only for actual image generation requests)
async function incrementRateLimit(ip: string): Promise<number> {
  const key = `flux:${ip}`

  // Get current usage from Vercel KV
  let usage = (await kv.get<number[]>(key)) || []

  // Current timestamp in seconds
  const now = Math.floor(Date.now() / 1000)

  // Filter out timestamps older than the rate limit window
  usage = usage.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW)

  // Add current timestamp to usage
  usage.push(now)

  // Update the KV store with the new usage array
  // Set TTL to expire the key after the rate limit window
  await kv.set(key, usage, { ex: RATE_LIMIT_WINDOW })

  return RATE_LIMIT - usage.length
}

// Handler for HEAD requests - check rate limit without generating an image
export async function HEAD(request: NextRequest) {
  try {
    // Get client IP address
    const clientIp = getClientIp(request)

    // Check rate limit status (without incrementing)
    const { allowed, remaining } = await checkRateLimit(clientIp)

    // Calculate reset time
    const resetTime = Math.floor(Date.now() / 1000) + RATE_LIMIT_WINDOW

    // Return rate limit headers with empty response
    return new NextResponse(null, {
      status: 200,
      headers: {
        'X-RateLimit-Limit': RATE_LIMIT.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': resetTime.toString(),
      },
    })
  } catch (error) {
    console.error('Error checking rate limit:', error)
    return new NextResponse(null, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get client IP address
    const clientIp = getClientIp(request)

    // Check rate limit
    const { allowed, remaining } = await checkRateLimit(clientIp)

    // If rate limit exceeded, return error
    if (!allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded. Try again later.',
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': RATE_LIMIT.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': (Math.floor(Date.now() / 1000) + RATE_LIMIT_WINDOW).toString(),
          },
        },
      )
    }

    // Parse the request body
    const body = await request.json()
    const { prompt, width, height, highQuality } = body

    // Validate input
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    // Use requested dimensions or defaults
    const imageWidth = width || DEFAULT_WIDTH
    const imageHeight = height || DEFAULT_HEIGHT

    // Determine quality settings based on user preference
    const qualitySettings = highQuality ? HIGH_QUALITY : STANDARD_QUALITY

    // Call the FLUX.1-dev model for image generation with selected parameters
    const response = await hf.textToImage({
      model: 'black-forest-labs/FLUX.1-dev',
      inputs: prompt,
      parameters: {
        height: imageHeight,
        width: imageWidth,
        guidance_scale: qualitySettings.guidance_scale,
        num_inference_steps: qualitySettings.num_inference_steps,
      },
    })

    // Increment rate limit usage
    const remainingAfterRequest = await incrementRateLimit(clientIp)

    // The response is a Blob containing the image data
    const imageBytes = await response.arrayBuffer()
    const base64Image = Buffer.from(imageBytes).toString('base64')

    // Return the generated image as a base64 string along with metadata
    return NextResponse.json(
      {
        success: true,
        imageData: `data:image/jpeg;base64,${base64Image}`,
        metadata: {
          width: imageWidth,
          height: imageHeight,
          prompt,
          timestamp: new Date().toISOString(),
          highQuality: !!highQuality,
        },
      },
      {
        headers: {
          'X-RateLimit-Limit': RATE_LIMIT.toString(),
          'X-RateLimit-Remaining': remainingAfterRequest.toString(),
          'X-RateLimit-Reset': (Math.floor(Date.now() / 1000) + RATE_LIMIT_WINDOW).toString(),
        },
      },
    )
  } catch (error) {
    console.error('Error calling FLUX.1-dev model:', error)

    // Handle different error types
    if (error instanceof Error) {
      // Check if it's an API key error
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { success: false, error: 'Invalid or missing Hugging Face API key' },
          { status: 401 },
        )
      }

      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json(
      { success: false, error: 'An unknown error occurred' },
      { status: 500 },
    )
  }
}
