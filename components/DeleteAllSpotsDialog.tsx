'use client'

import { useState } from 'react'
import { deleteAllSpots } from '@/app/actions/delete-all-spots'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Trash } from 'lucide-react'
import { toast } from 'sonner'

interface DeleteAllSpotsDialogProps {
  onDeleteSuccess: () => void
}

export function DeleteAllSpotsDialog({ onDeleteSuccess }: DeleteAllSpotsDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    try {
      setIsDeleting(true)
      toast.info('Deleting all spots...')

      const result = await deleteAllSpots()

      if (result.success) {
        toast.success(`${result.message} (${result.count} spots removed)`)
        onDeleteSuccess()
      } else {
        toast.error(result.error || 'Failed to delete spots')
      }
    } catch (error) {
      console.error('Error deleting spots:', error)
      toast.error('An error occurred while deleting spots')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700"
        >
          <Trash className="mr-1 h-4 w-4" />
          <span className="hidden sm:inline">Delete All Spots</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete all skate spots from the
            database.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700"
          >
            {isDeleting ? 'Deleting...' : 'Delete All Spots'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
