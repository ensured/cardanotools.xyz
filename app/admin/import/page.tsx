'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAdmin } from '@/lib/hooks/useAdmin'
import { useRouter } from 'next/navigation'

export default function ImportPage() {
  const [isImporting, setIsImporting] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    imported: number
    errors?: string[]
  } | null>(null)
  const isAdmin = useAdmin()
  const router = useRouter()

  useEffect(() => {
    if (!isAdmin) {
      router.push('/')
    }
  }, [isAdmin, router])

  const handleImport = async () => {
    setIsImporting(true)
    try {
      const response = await fetch('/api/points/import', {
        method: 'POST',
      })
      const data = await response.json()
      setResult(data)
    } catch (error) {
      console.error('Error importing points:', error)
      setResult({ success: false, imported: 0, errors: ['Failed to import points'] })
    } finally {
      setIsImporting(false)
    }
  }

  if (!isAdmin) {
    return null
  }

  return (
    <div className="container mx-auto max-w-2xl p-4">
      <h1 className="mb-4 text-2xl font-bold">Import Pre-existing Spots</h1>
      <div className="space-y-4">
        <Button onClick={handleImport} disabled={isImporting}>
          {isImporting ? 'Importing...' : 'Import Spots'}
        </Button>

        {result && (
          <div className="rounded-lg border p-4">
            <h2 className="mb-2 text-lg font-semibold">
              {result.success ? 'Import Successful' : 'Import Failed'}
            </h2>
            <p>Imported {result.imported} spots</p>
            {result.errors && result.errors.length > 0 && (
              <div className="mt-2">
                <h3 className="font-semibold text-red-500">Errors:</h3>
                <ul className="list-inside list-disc">
                  {result.errors.map((error, index) => (
                    <li key={index} className="text-sm text-red-600">
                      {error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
