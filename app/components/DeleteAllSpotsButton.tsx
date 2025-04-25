'use client'

import { useState } from 'react'
import { deleteAllSpots } from '@/app/actions/delete-all-spots'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function DeleteAllSpotsButton() {
  const [isLoading, setIsLoading] = useState(false)

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete ALL spots? This action cannot be undone.')) {
      return
    }

    try {
      setIsLoading(true)
      const result = await deleteAllSpots()

      if (result.success) {
        toast.success(result.message)
      } else {
        toast.error(result.error || 'Failed to delete spots')
      }
    } catch (error) {
      toast.error('An error occurred while deleting spots')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button onClick={handleDelete} disabled={isLoading} variant="destructive">
      {isLoading ? 'Deleting...' : 'Delete All Spots'}
    </Button>
  )
}
