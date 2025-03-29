import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { kv } from '@vercel/kv';

interface MapPoint {
  id: string;
  name: string;
  type: 'street' | 'park' | 'diy';
  coordinates: [number, number];
  createdBy: string;
}

interface LikeStatus {
  userId: string;
  status: 'like' | 'dislike' | null;
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const likes = await kv.get<LikeStatus[]>(`likes:${id}`) || [];
    return NextResponse.json(likes);
  } catch (error) {
    console.error('Error fetching likes:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    const { id } = await params;
    
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { status } = await request.json();

    if (!['like', 'dislike', null].includes(status)) {
      return new NextResponse('Invalid status', { status: 400 });
    }

    // Get existing likes
    const likes = await kv.get<LikeStatus[]>(`likes:${id}`) || [];
    
    // Find user's existing vote
    const userVoteIndex = likes.findIndex(like => like.userId === userId);
    
    if (userVoteIndex === -1) {
      // Add new vote
      likes.push({ userId, status });
    } else {
      // Update existing vote
      if (status === null) {
        // Remove vote
        likes.splice(userVoteIndex, 1);
      } else {
        // Update vote
        likes[userVoteIndex].status = status;
      }
    }
    
    // Store updated likes
    await kv.set(`likes:${id}`, likes);

    return NextResponse.json(likes);
  } catch (error) {
    console.error('Error updating likes:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 