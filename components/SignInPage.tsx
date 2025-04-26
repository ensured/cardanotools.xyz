'use client'

import { useSignIn } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'

export default function SignInPage() {
  const { signIn } = useSignIn()

  const handleSignIn = () => {
    signIn?.authenticateWithRedirect({
      strategy: 'oauth_google',
      redirectUrl: '/sso-callback',
      redirectUrlComplete: '/skatemap',
    })
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      {/* Animated Rainbow Background */}
      <div className="via-pink-500 to-blue-500 fixed inset-0 bg-gradient-to-br from-purple-600 opacity-80">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0)_0,rgba(0,0,0,0.5)_100%)]"></div>
      </div>

      {/* Animated Rainbow Stripes */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="animate-slow-spin absolute -inset-[10%] bg-[conic-gradient(from_0deg,#ff1493,#f0f,#9370db,#0ff,#0f0,#ff0,#f00,#ff1493)] opacity-30 blur-[40px]"></div>
      </div>

      {/* Content Card */}
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-black/30 p-8 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col items-center text-center">
          {/* Skateboard Icon */}
          <div className="relative mb-6 text-[120px]">
            <div className="via-pink-500 absolute -inset-4 animate-pulse rounded-full bg-gradient-to-r from-cyan-400 to-yellow-300 opacity-70 blur-xl"></div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              className="relative h-32 w-32"
            >
              <path
                d="M21 16.5C21 18.9853 18.9853 21 16.5 21C14.0147 21 12 18.9853 12 16.5C12 14.0147 14.0147 12 16.5 12C18.9853 12 21 14.0147 21 16.5Z"
                stroke="white"
                strokeWidth="2"
              />
              <path
                d="M12 16.5C12 18.9853 9.98528 21 7.5 21C5.01472 21 3 18.9853 3 16.5C3 14.0147 5.01472 12 7.5 12C9.98528 12 12 14.0147 12 16.5Z"
                stroke="white"
                strokeWidth="2"
              />
              <path d="M20.5 7.5L3.5 7.5" stroke="#00ffff" strokeWidth="2" strokeLinecap="round" />
              <path d="M19 5L5 5" stroke="#ff00ff" strokeWidth="2" strokeLinecap="round" />
              <path
                d="M15.9199 10L8.07983 10"
                stroke="#ffff00"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* Text Content */}
          <h1 className="via-pink-500 mb-2 bg-gradient-to-r from-cyan-400 to-yellow-300 bg-clip-text text-4xl font-bold text-transparent">
            Skate Explorer
          </h1>
          <p className="mb-8 text-xl text-white/90">Please sign in to view the map</p>

          {/* Sign In Button */}
          <Button
            onClick={handleSignIn}
            className="group relative w-full overflow-hidden bg-black py-6 text-lg font-medium"
          >
            <div className="via-pink-500 absolute inset-0 bg-gradient-to-r from-cyan-400 to-yellow-300 opacity-70 transition-opacity group-hover:opacity-100"></div>
            <span className="relative text-white">Sign In with Google</span>
          </Button>

          {/* Alternative Sign In */}
          <div className="mt-6 text-white/60">
            <p>Want to use another method?</p>
            <div className="mt-4 flex justify-center space-x-4">
              <button
                onClick={() =>
                  signIn?.authenticateWithRedirect({
                    strategy: 'oauth_github',
                    redirectUrl: '/sso-callback',
                    redirectUrlComplete: '/skatemap',
                  })
                }
                className="text-white transition-colors hover:text-cyan-400"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
              </button>
              <button
                onClick={() =>
                  signIn?.authenticateWithRedirect({
                    strategy: 'oauth_facebook',
                    redirectUrl: '/sso-callback',
                    redirectUrlComplete: '/skatemap',
                  })
                }
                className="hover:text-pink-500 text-white transition-colors"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9.19795 21.5H13.198V13.4901H16.8021L17.198 9.50977H13.198V7.5C13.198 6.94772 13.6457 6.5 14.198 6.5H17.198V2.5H14.198C11.4365 2.5 9.19795 4.73858 9.19795 7.5V9.50977H7.19795L6.80206 13.4901H9.19795V21.5Z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
