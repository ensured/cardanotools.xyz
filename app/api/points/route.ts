import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';

interface MapPoint {
  id: string;
  name: string;
  type: 'street' | 'park' | 'diy';
  coordinates: [number, number];
  createdBy: string;
}

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 45 * 60 * 1000; // 45 minutes in milliseconds
const MAX_POINTS_PER_WINDOW = 5; // Maximum points per 45 minutes

async function checkRateLimit(userId: string): Promise<{ allowed: boolean; remainingTime?: number }> {
  const key = `rate_limit:${userId}`;
  const now = Date.now();
  
  // Get existing points in the time window
  const points = await kv.get<{ timestamp: number }[]>(key) || [];
  
  // Filter out old points
  const recentPoints = points.filter(p => now - p.timestamp < RATE_LIMIT_WINDOW);
  
  if (recentPoints.length >= MAX_POINTS_PER_WINDOW) {
    // Calculate remaining time based on oldest point
    const oldestPoint = Math.min(...recentPoints.map(p => p.timestamp));
    const remainingTime = RATE_LIMIT_WINDOW - (now - oldestPoint);
    return { allowed: false, remainingTime };
  }
  
  // Add new point
  recentPoints.push({ timestamp: now });
  await kv.set(key, recentPoints, { ex: 2700 }); // Expire after 45 minutes
  
  return { allowed: true };
}

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const keys = await kv.keys('point:*');
    const points = await Promise.all(
      keys.map(async (key) => {
        const point = await kv.get<MapPoint>(key);
        return point;
      })
    );

    return NextResponse.json(points);
  } catch (error) {
    console.error('Error fetching points:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Check rate limit
    const rateLimit = await checkRateLimit(userId);
    if (!rateLimit.allowed) {
      return new NextResponse(
        JSON.stringify({ 
          message: 'Rate limit exceeded', 
          remainingTime: rateLimit.remainingTime 
        }), 
        { status: 429 }
      );
    }

    const body = await request.json();
    const point: MapPoint = {
      ...body,
      createdBy: body.createdBy
    };

    await kv.set(`point:${point.id}`, point);
    return NextResponse.json(point);
  } catch (error) {
    console.error('Error creating point:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 