'use client'

import { useState } from 'react'
import { importSpots } from '@/app/actions/import-spots'
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
import { Upload } from 'lucide-react'
import { toast } from 'sonner'

interface ImportSpotsDialogProps {
  onImportSuccess: () => void
}

export function ImportSpotsDialog({ onImportSuccess }: ImportSpotsDialogProps) {
  const [isImporting, setIsImporting] = useState(false)

  const handleImport = async () => {
    try {
      setIsImporting(true)
      toast.info('Importing skate spots... This may take a moment.')

      const result = await importSpots()

      if (result.success) {
        const count = result.count || 0
        toast.success(`${result.message}`)
        onImportSuccess()
      } else {
        toast.error(result.error || 'Failed to import spots')
      }
    } catch (error) {
      console.error('Error importing spots:', error)
      toast.error('An error occurred while importing spots')
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <Upload className="mr-1 h-4 w-4" />
          <span className="hidden sm:inline">Import Spots</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Import Skate Spots</AlertDialogTitle>
          <AlertDialogDescription>
            This will import skate spots from an external source. This might take a few moments to
            complete. Duplicate spots will be skipped.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleImport} disabled={isImporting}>
            {isImporting ? 'Importing...' : 'Import Spots'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
