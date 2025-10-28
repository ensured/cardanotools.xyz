'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useWallet } from '@/contexts/WalletContext'
import { CheckCircle } from 'lucide-react'

type AdaHandlesDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AdaHandlesDialog({ open, onOpenChange }: AdaHandlesDialogProps) {
  const { walletState, updateDefaultHandle } = useWallet()
  const handles = walletState.adaHandle.allHandles || []
  const currentHandle = walletState.adaHandle.handle

  const handleUpdateDefaultHandle = async (handleName: string) => {
    try {
      await updateDefaultHandle(handleName)
      // Close the dialog after a short delay
      setTimeout(() => onOpenChange(false), 300)
    } catch (error) {
      console.error('Failed to update default handle:', error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Your AdaHandles</DialogTitle>
          <DialogDescription>
            You have {handles.length} AdaHandle{handles.length !== 1 ? 's' : ''} connected to this
            wallet.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-2">
            {handles.map((handle, index) => {
              const isCurrent = handle.name === currentHandle
              return (
                <button
                  key={index}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleUpdateDefaultHandle(handle.name)
                  }}
                  className={`flex w-full items-center justify-between rounded-md border p-3 text-left transition-colors hover:bg-accent ${isCurrent ? 'bg-accent' : ''}`}
                >
                  <span className="font-mono">${handle.name}</span>
                  <div className="flex items-center gap-2">
                    {isCurrent && (
                      <span className="text-sm text-green-500">
                        <CheckCircle className="h-4 w-4" />
                      </span>
                    )}
                    <span className="text-sm text-muted-foreground">
                      {isCurrent ? 'Current' : 'Set as default'}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
