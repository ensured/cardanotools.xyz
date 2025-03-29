'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
const Map = dynamic(() => import('./Map'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[calc(100vh-4rem)] flex items-center justify-center">
      <Loader2 className="animate-spin size-10" />
    </div>
  ),
});

export default function MapWrapper() {
  return <Map />;
} 