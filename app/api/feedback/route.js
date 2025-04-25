import { Resend } from 'resend'
import { kv } from '@vercel/kv'
import { z } from 'zod'

// Check if we have the required environment variables
const RESEND_API_KEY = process.env.RESEND_API_KEY
const RESEND_EMAIL_FROM = process.env.RESEND_EMAIL_FROM
const RESEND_EMAIL_TO = process.env.RESEND_EMAIL_TO

// Initialize Resend only if we have an API key
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null

// Update rate limit configuration
const RATE_LIMITS = [
  {
    name: 'short',
    window: 600,
    maxRequests: 2,
    errorMessage: (ttl) =>
      `Please try again in ${Math.floor(ttl / 60)}m ${ttl % 60}s. Limit 2 requests per 10 minutes.`,
  },
  {
    name: 'long',
    window: 86400,
    maxRequests: 10,
    errorMessage: (ttl) =>
      `Maximum 10 requests per 12 hours. Please try again in ${Math.floor(ttl / 3600)}h ${Math.floor((ttl % 3600) / 60)}m ${ttl % 60}s.`,
  },
]

// Add validation schema matching client-side
const feedbackSchema = z.object({
  feedback: z.string().min(1).max(2000),
  email: z.string().email().optional(), // Add optional email field
})

export async function POST(request) {
  try {
    // Check if required environment variables are set
    if (!resend || !RESEND_EMAIL_FROM || !RESEND_EMAIL_TO) {
      console.error('Missing required environment variables for feedback system')
      return new Response(JSON.stringify({ error: 'Feedback system not properly configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Parse request body before using it
    let body
    try {
      body = await request.json()
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Get user identifier (wallet address, email or IP)
    const identifier =
      request.headers.get('x-wallet-address') ||
      body.email ||
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      'anonymous'

    // Check all rate limits
    for (const limit of RATE_LIMITS) {
      const tierKey = `feedback:${identifier}:${limit.name}`
      const current = await kv.get(tierKey)

      if (current && current.count >= limit.maxRequests) {
        const ttl = await kv.ttl(tierKey)
        return new Response(JSON.stringify({ error: limit.errorMessage(ttl) }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    // Increment all rate limits
    for (const limit of RATE_LIMITS) {
      const tierKey = `feedback:${identifier}:${limit.name}`
      const current = await kv.get(tierKey)

      await kv.set(
        tierKey,
        {
          count: current ? current.count + 1 : 1,
          lastRequest: Date.now(),
        },
        { ex: limit.window, nx: !current },
      )
    }

    // Validate request body
    const validation = feedbackSchema.safeParse(body)

    if (!validation.success) {
      return new Response(
        JSON.stringify({
          error: 'Invalid feedback',
          issues: validation.error.issues,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Use validated data
    const { feedback, email } = validation.data

    // Add user identifier info to the email
    const emailText = `
Feedback from: ${identifier}
${email ? `Email: ${email}` : ''}

${feedback}
    `

    try {
      const { data, error } = await resend.emails.send({
        from: RESEND_EMAIL_FROM,
        to: RESEND_EMAIL_TO,
        subject: 'New Feedback!',
        text: emailText,
      })

      if (error) {
        console.error('Resend error:', error)
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to send feedback email' }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (emailError) {
      console.error('Email sending error:', emailError)
      return new Response(JSON.stringify({ success: false, error: 'Email service error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  } catch (error) {
    // Update error handling to include Zod errors
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({
          error: 'Validation failed',
          issues: error.issues,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }
    console.error('Server error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        message: error.message,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}
