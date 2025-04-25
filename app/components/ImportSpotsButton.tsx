'use client'

import { ImportSpotsDialog } from '@/components/ImportSpotsDialog'
import { useRouter } from 'next/navigation'

interface ImportSpotsButtonProps {
  onImportSuccess?: () => void
}

export function ImportSpotsButton({ onImportSuccess }: ImportSpotsButtonProps) {
  const router = useRouter()

  const handleImportSuccess = () => {
    router.refresh()
    onImportSuccess?.()
  }

  return <ImportSpotsDialog onImportSuccess={handleImportSuccess} />
}
