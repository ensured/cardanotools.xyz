'use client'
import dynamic from 'next/dynamic'
import { Suspense } from 'react'

const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900"></div>
    </div>
  ),
})

export default function MapPage() {
  return (
    <div className="h-screen w-full" suppressHydrationWarning>
      <Suspense
        fallback={
          <div className="flex h-screen items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900"></div>
          </div>
        }
      >
        <Map />
      </Suspense>
    </div>
  )
}
