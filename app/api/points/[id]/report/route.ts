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

interface Report {
  id: string;
  userId: string;
  reason: string;
  createdAt: number;
  status: 'pending' | 'reviewed' | 'resolved';
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

    const { reason } = await request.json();

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return new NextResponse('Invalid reason', { status: 400 });
    }

    // Check if the spot exists
    const spot = await kv.get<MapPoint>(`point:${id}`);
    if (!spot) {
      return new NextResponse('Spot not found', { status: 404 });
    }

    // Check if user has already reported this spot
    const reports = await kv.get<Report[]>(`reports:${id}`) || [];
    if (reports.some(report => report.userId === userId)) {
      return new NextResponse('You have already reported this spot', { status: 400 });
    }

    const newReport: Report = {
      id: Date.now().toString(),
      userId,
      reason: reason.trim(),
      createdAt: Date.now(),
      status: 'pending'
    };

    // Add new report
    reports.push(newReport);
    await kv.set(`reports:${id}`, reports);

    return NextResponse.json(newReport);
  } catch (error) {
    console.error('Error creating report:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// Add GET endpoint to fetch reports
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const reports = await kv.get<Report[]>(`reports:${id}`) || [];
    return NextResponse.json(reports);
  } catch (error) {
    console.error('Error fetching reports:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 