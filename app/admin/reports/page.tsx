'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useAdmin } from '@/lib/hooks/useAdmin'

interface Report {
  id: string
  userId: string
  reason: string
  createdAt: number
  status: 'pending' | 'reviewed' | 'resolved'
  spotId: string
  spotName: string
}

export default function AdminReports() {
  const { user } = useUser()
  const isAdmin = useAdmin()
  const [reports, setReports] = useState<Report[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (isAdmin) {
      fetchReports()
    }
  }, [isAdmin])

  const fetchReports = async () => {
    try {
      const response = await fetch('/api/admin/reports')
      if (response.ok) {
        const data = await response.json()
        setReports(data)
      }
    } catch (error) {
      console.error('Error fetching reports:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateStatus = async (reportId: string, newStatus: 'reviewed' | 'resolved') => {
    setIsUpdating((prev) => ({ ...prev, [reportId]: true }))
    try {
      const response = await fetch(`/api/admin/reports/${reportId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok) {
        setReports((prev) =>
          prev.map((report) =>
            report.id === reportId ? { ...report, status: newStatus } : report,
          ),
        )
      }
    } catch (error) {
      console.error('Error updating report status:', error)
    } finally {
      setIsUpdating((prev) => ({ ...prev, [reportId]: false }))
    }
  }

  const handleDeleteSpot = async (spotId: string) => {
    try {
      const response = await fetch(`/api/points/${spotId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        // Remove all reports for this spot
        setReports((prev) => prev.filter((report) => report.spotId !== spotId))
      }
    } catch (error) {
      console.error('Error deleting spot:', error)
    }
  }

  if (!user || !isAdmin) {
    return <div className="p-4">Unauthorized</div>
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="mb-6 text-2xl font-bold">Spot Reports</h1>

      <div className="grid gap-4">
        {reports.map((report) => (
          <Card key={report.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{report.spotName}</span>
                <span
                  className={`text-sm ${
                    report.status === 'pending'
                      ? 'text-yellow-500'
                      : report.status === 'reviewed'
                        ? 'text-blue-500'
                        : 'text-green-500'
                  }`}
                >
                  {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-gray-700">{report.reason}</p>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Reported {formatDistanceToNow(report.createdAt, { addSuffix: true })}
                </p>
                <div className="flex gap-2">
                  {report.status === 'pending' && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUpdateStatus(report.id, 'reviewed')}
                        disabled={isUpdating[report.id]}
                      >
                        {isUpdating[report.id] ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Mark as Reviewed'
                        )}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteSpot(report.spotId)}
                      >
                        Delete Spot
                      </Button>
                    </>
                  )}
                  {report.status === 'reviewed' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUpdateStatus(report.id, 'resolved')}
                      disabled={isUpdating[report.id]}
                    >
                      {isUpdating[report.id] ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Mark as Resolved'
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
