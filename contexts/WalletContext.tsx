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
}

// Create context with the correct type
const WalletContext = createContext<WalletContextType | undefined>(undefined)

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const wallet = useWalletConnect()

  useEffect(() => {
    const handleWalletStateChange = (event: CustomEvent<WalletState>) => {
      wallet.walletState = event.detail
    }

    window.addEventListener('walletStateChanged', handleWalletStateChange as EventListener)

    return () => {
      window.removeEventListener('walletStateChanged', handleWalletStateChange as EventListener)
    }
  }, [])

  const contextValue = {
    walletState: wallet.walletState,
    loading: wallet.loading,
    connect: wallet.connect,
    disconnect: wallet.disconnect,
    getSupportedWallets: wallet.getSupportedWallets,
    network: wallet.walletState.network,
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
