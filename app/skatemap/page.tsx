'use client'
import dynamic from 'next/dynamic'

const ProtectedMap = dynamic(() => import('@/components/ProtectedMap'), {
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
      Too many read/writes to firestore. Rewrite later (use local db)
      {/* <ProtectedMap />  */}
    </div>
  )
}
