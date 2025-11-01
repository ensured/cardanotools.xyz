import { useState, useEffect } from 'react'
import { decode as cborDecode } from 'cbor-js'
import { Address, BaseAddress } from '@emurgo/cardano-serialization-lib-asmjs'
import { toast } from 'sonner'
import { isNaN } from '@/utils/helper'

export interface WalletState {
  network: number | null
  wallet: any | null
  api: any | null
  supportedWallets: string[]
  walletIcon: string | null
  walletName: string | null
  walletAddress: string | null
  unusedAddresses: string[]
  adaHandle: {
    handle: string | null
    total_handles: number | null
    allHandles: any[]
  }
  stakeAddress: string | null
  balance: number | null
  paymentKeyHash: string | null
}

const initialWalletState: WalletState = {
  network: null,
  wallet: null,
  api: null,
  supportedWallets: [],
  walletIcon: null,
  walletName: null,
  walletAddress: null,
  unusedAddresses: [],
  adaHandle: {
    handle: null,
    total_handles: null,
    allHandles: [],
  },
  stakeAddress: null,
  balance: null,
  paymentKeyHash: null,
}

// interface WalletConnectProps {
// 	setExpiresAt: (time: string | null) => void
// }

// Add this type at the top with other interfaces
type WalletError = {
  code?: string
  message: string
}

// Add this helper function
const handleWalletError = (error: unknown): WalletError => {
  if (error instanceof Error) {
    if (error.message.includes('account changed')) {
      return { code: 'ACCOUNT_CHANGED', message: 'Wallet account changed' }
    }
    return { message: error.message }
  }
  return { message: 'Unknown wallet error occurred' }
}

export const signData = async (api: any, address: string, stakeAddress: string) => {
  const message = `Login to cardanotools.xyz`
  const messageHex = Buffer.from(message).toString('hex')

  try {
    const signedMessage = await api.signData(address, messageHex)
    if (Object.keys(signedMessage).length === 0) return null

    return {
      body: message,
      signature: signedMessage,
      key: address,
      stakeKey: stakeAddress,
    }
  } catch (error) {
    console.error('Failed to sign message:', error)
    return null
  }
}

export function useWalletConnect() {
  const [walletState, setWalletState] = useState<WalletState>(initialWalletState)
  const [loading, setLoading] = useState(false)

  // Auto-connect to last used wallet on page load
  useEffect(() => {
    const lastWallet = localStorage.getItem('lastWallet')
    if (lastWallet && !walletState.api) {
      connect(lastWallet)
    }
  }, [])

  // Check for wallet account changes
  useEffect(() => {
    if (!walletState.api) return

    let isChecking = false
    const checkWalletState = async () => {
      if (isChecking) return

      try {
        isChecking = true
        const api = walletState.api

        // Get stake address first
        const stakeAddresses = await api.getRewardAddresses()
        const decodedStakeAddr = decodeHexAddress(stakeAddresses[0])

        // Only proceed if stake address has changed
        if (decodedStakeAddr !== walletState.stakeAddress) {
          // Get other wallet details
          const { address: decodedAddress, balance: decodedBalance } = await getWalletDetails(api)
          const unusedAddresses = []
          for (const address of await api.getUnusedAddresses()) {
            unusedAddresses.push(decodeHexAddress(address))
          }

          // Fetch handle only when stake address changes
          const newWalletState = {
            ...walletState,
            walletAddress: decodedAddress,
            balance: decodedBalance,
            networkId: walletState.network,
            stakeAddress: decodedStakeAddr,
            unusedAddresses: unusedAddresses,
          }

          await updateWalletStateWithHandle(
            newWalletState,
            decodedStakeAddr,
            walletState.network ?? 1,
          )
        }
      } catch (error) {
        const { code, message } = handleWalletError(error)
        if (code === 'ACCOUNT_CHANGED') {
          const lastWallet = localStorage.getItem('lastWallet')
          if (lastWallet) {
            await connect(lastWallet)
          }
        } else {
          console.error('Error checking wallet state:', message)
        }
      } finally {
        isChecking = false
      }
    }

    const intervalId = setInterval(checkWalletState, 2000)
    return () => clearInterval(intervalId)
  }, [walletState.api, walletState.stakeAddress])

  const decodeHexAddress = (hexAddress: string): string => {
    try {
      const bytes = new Uint8Array(Buffer.from(hexAddress, 'hex'))
      const address = Address.from_bytes(bytes)
      const baseAddress = BaseAddress.from_address(address)
      return baseAddress ? baseAddress.to_address().to_bech32() : address.to_bech32()
    } catch (error) {
      console.error('Error decoding address:', error)
      return hexAddress
    }
  }

  const updateWalletState = (newState: Partial<WalletState>, dispatchEvent: boolean = true) => {
    const updatedState = { ...walletState, ...newState }
    setWalletState(updatedState)

    if (dispatchEvent) {
      window.dispatchEvent(new CustomEvent('walletStateChanged', { detail: updatedState }))
    }
    return updatedState
  }

  const updateWalletStateWithHandle = async (
    currentState: WalletState,
    stakeAddress: string,
    networkId: number,
  ) => {
    let handleData = null
    try {
      handleData = await getAdaHandle(stakeAddress, networkId)
    } catch (error) {
      console.error('Error fetching AdaHandle:', error)
    }

    return updateWalletState({
      ...currentState,
      adaHandle: {
        handle: handleData?.defaultHandle,
        total_handles: handleData?.handles?.length,
        allHandles: handleData?.handles,
      },
    })
  }

  const getWalletDetails = async (api: any) => {
    // Get addresses
    const walletAddresses = await api.getUsedAddresses()
    const unusedAddresses = await api.getUnusedAddresses()
    const primaryAddress = walletAddresses.length > 0 ? walletAddresses[0] : unusedAddresses[0]

    const decodedAddress = decodeHexAddress(primaryAddress)

    if (!decodedAddress) throw new Error('No address found')

    // Get balance
    const balanceResponse = await api.getBalance()
    const balanceBytes = Buffer.from(balanceResponse, 'hex')
    const decodedBalance = Number(
      (cborDecode(new Uint8Array(balanceBytes).buffer)[0] / 1000000).toFixed(0),
    )

    return {
      address: decodedAddress,
      balance: isNaN(decodedBalance) ? 0 : decodedBalance,
    }
  }

  const connect = async (walletKey: string): Promise<boolean> => {
    setLoading(true)
    try {
      const walletInstance = window.cardano?.[walletKey]
      if (!walletInstance || !walletKey || !window.cardano) {
        throw new Error('Wallet not found or not supported')
      }

      const api = await walletInstance.enable()

      // Store wallet name for auto-connect
      localStorage.setItem('lastWallet', walletKey)

      // Get primary address
      const { address: decodedAddress, balance: decodedBalance } = await getWalletDetails(api)

      // Get wallet details
      const [stakeAddress, networkId] = await Promise.all([
        api.getRewardAddresses(),
        api.getNetworkId(),
      ])

      // Get stake address and handle for initial connection
      const decodedStakeAddr = decodeHexAddress(stakeAddress[0])

      const baseWalletState = {
        ...initialWalletState,
        wallet: walletInstance,
        api: api,
        walletName: walletInstance.name,
        walletAddress: decodedAddress,
        walletIcon: walletInstance.icon,
        balance: decodedBalance,
        network: networkId,
        stakeAddress: decodedStakeAddr,
        unusedAddresses: [],
      }

      await updateWalletStateWithHandle(baseWalletState, decodedStakeAddr, networkId)

      return true
    } catch (error) {
      const { message } = handleWalletError(error)
      toast.error(message)
      return false
    } finally {
      setLoading(false)
    }
  }

  const disconnect = () => {
    localStorage.removeItem('lastWallet')
    updateWalletState(initialWalletState)
    setLoading(false)
  }

  const getSupportedWallets = () => {
    if (window.cardano) {
      const walletNames = Object.keys(window.cardano).filter(
        (key) => window.cardano?.[key]?.apiVersion !== undefined,
      )
      updateWalletState({ supportedWallets: walletNames }, false)
      return walletNames
    }
    return []
  }

  const getAdaHandle = async (stakeAddress: string, networkId: number) => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000) // 3 second timeout

    try {
      const res = await fetch(
        `https://${networkId === 1 ? 'api' : 'preview.api'}.handle.me/holders/${stakeAddress}`,
        {
          signal: controller.signal,
        },
      )

      if (!res.ok) {
        if (res.status === 504) {
          toast.error('adahandle API is currently unavailable')
        }
        return { default_handle: null, total_handles: null }
      }

      const data = await res.json()
      console.log(data)
      return data
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          toast.error('adahandle API request timed out')
        } else {
          toast.error('Failed to fetch handle data')
        }
      }
      return { default_handle: null, total_handles: null }
    } finally {
      clearTimeout(timeoutId)
    }
  }

  return {
    walletState,
    loading,
    connect,
    disconnect,
    getSupportedWallets,
    network: walletState.network,
    updateWalletState,
  }
}
