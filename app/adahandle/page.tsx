'use client'
import Animation from '@/components/Animation'
import { toast } from 'sonner'
import ResolveHandleForm from '@/components/ResolveHandleForm'
import { useState, useEffect } from 'react'
import { getAddressFromHandle } from '../actions'
import { useWallet } from '@/contexts/WalletContext'

const Page = () => {
  const [handleName, setHandleName] = useState('')
  const [walletAddress, setWalletAddress] = useState<{
    stakeAddress: string
    image: string
    address: string
  } | null>(null)
  const [loadingAdahandle, setLoadingAdahandle] = useState(false)
  const [adahandleStats, setAdahandleStats] = useState<any>(null)

  const { walletState } = useWallet()

  const handleSubmit = async () => {
    setLoadingAdahandle(true) // Set loading state to true
    try {
      const { stakeAddress, image, address, error } = await getAddressFromHandle(handleName)
      // Check for rate limit error
      if (error || !stakeAddress) {
        toast.error(error || 'No wallet address found') // Show toast notification
        return
      }

      setWalletAddress({ stakeAddress, image, address })
      const newHandleName = handleName.toLowerCase().replace('$', '')
      setHandleName(newHandleName)
    } catch (error) {
      toast.error('Something went wrong, please try again with a new handle')
    } finally {
      setLoadingAdahandle(false)
    }
  }

  const getAdahandleStats = async () => {
    const response = await fetch('https://api.handle.me/stats', {
      headers: {
        accept: 'application/json',
      },
    })
    const data = await response.json()
    return data
  }

  useEffect(() => {
    getAdahandleStats().then((data) => {
      setAdahandleStats(data)
    })
  }, [])

  return (
    <Animation>
      <div className="flex min-h-[calc(100vh-4rem)] flex-col">
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg">
            <ResolveHandleForm
              handleSubmit={handleSubmit}
              walletAddress={walletAddress}
              loadingAdahandle={loadingAdahandle}
              handleName={handleName}
              setHandleName={setHandleName}
              walletState={walletState}
            />
          </div>
        </div>
        <div className="flex flex-col justify-center bg-gradient-to-b from-background to-secondary/10 backdrop-blur-sm">
          <div className="border-t-2 border-primary/10 p-6">
            <h3 className="text-center text-xl font-semibold text-primary">
              ADA Handle Statistics
            </h3>

            <div className="mx-4 flex flex-col items-center justify-center gap-4 p-2 sm:mx-auto sm:max-w-2xl sm:flex-row sm:gap-6 sm:p-4">
              <div className="flex w-full min-w-[200px] max-w-[260px] flex-col items-center rounded-lg bg-card p-4 shadow-lg transition-all hover:shadow-xl sm:p-6">
                <span className="text-3xl font-bold text-primary sm:text-4xl">
                  {adahandleStats?.total_handles?.toLocaleString()}
                </span>
                <span className="mt-2 text-xs text-muted-foreground sm:text-sm">Total Handles</span>
              </div>
              <div className="flex w-full min-w-[200px] max-w-[260px] flex-col items-center rounded-lg bg-card p-4 shadow-lg transition-all hover:shadow-xl sm:p-6">
                <span className="text-3xl font-bold text-primary sm:text-4xl">
                  {adahandleStats?.total_holders?.toLocaleString()}
                </span>
                <span className="mt-2 text-xs text-muted-foreground sm:text-sm">Total Holders</span>
              </div>
            </div>
          </div>
        </div>
        {/*
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg">
            <Chat />
          </div>
        </div>
        */}
      </div>
    </Animation>
  )
}

export default Page
