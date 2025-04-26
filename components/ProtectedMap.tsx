'use client'

import { useUser } from '@clerk/nextjs'
import Map from './Map'
import SignInPage from './SignInPage'

export default function ProtectedMap() {
  const { isSignedIn, isLoaded } = useUser()

  // Show loading state while checking auth
  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="border-t-blue-500 border-b-pink-500 h-12 w-12 animate-spin rounded-full border-4 border-l-yellow-500 border-r-green-500"></div>
      </div>
    )
  }

  // Show sign-in page if not signed in
  if (!isSignedIn) {
    return <SignInPage />
  }

  // Show the map if signed in
  return <Map />
}
