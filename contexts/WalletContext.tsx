'use client'
import { createContext, useContext, useState, useEffect } from 'react'
import { useWalletConnect } from '@/hooks/useWalletConnect'
import { type WalletState } from '@/hooks/useWalletConnect'

export type WalletContextType = {
  walletState: WalletState
  loading: boolean
  connect: (walletKey: string) => Promise<boolean>
  disconnect: () => void
  getSupportedWallets: () => string[]
  network: number | null
  updateDefaultHandle: (handleName: string) => void
}

// Create context with the correct type
const WalletContext = createContext<WalletContextType | undefined>(undefined)

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const wallet = useWalletConnect()

  useEffect(() => {
    // Skip if window is not available (SSR)
    if (typeof window === 'undefined') return

    const handleWalletStateChange = (event: CustomEvent<WalletState>) => {
      wallet.walletState = event.detail
    }

    window.addEventListener('walletStateChanged', handleWalletStateChange as EventListener)

    return () => {
      window.removeEventListener('walletStateChanged', handleWalletStateChange as EventListener)
    }
  }, [])

  const updateDefaultHandle = (handleName: string) => {
    const updatedHandles =
      wallet.walletState.adaHandle.allHandles?.map((h) => ({
        ...h,
        isDefault: h.name === handleName,
      })) || []

    // Update the wallet state using the updateWalletState function
    wallet.updateWalletState({
      ...wallet.walletState,
      adaHandle: {
        ...wallet.walletState.adaHandle,
        handle: handleName,
        allHandles: updatedHandles,
      },
    })
  }

  const contextValue = {
    walletState: wallet.walletState,
    loading: wallet.loading,
    connect: wallet.connect,
    disconnect: wallet.disconnect,
    getSupportedWallets: wallet.getSupportedWallets,
    network: wallet.walletState.network,
    updateDefaultHandle,
  }

  return <WalletContext.Provider value={contextValue}>{children}</WalletContext.Provider>
}

export function useWallet() {
  const context = useContext(WalletContext)
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider')
  }
  return context
}
