'use client'

import { toast } from 'sonner'
import { useEffect, useState, useRef } from 'react'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
  useMap,
  LayersControl,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import '@/styles/map.css'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useUser } from '@clerk/nextjs'
import L from 'leaflet'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatDistanceToNow } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Loader2,
  ThumbsUp,
  ThumbsDown,
  Flag,
  Search,
  Edit,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import { useAdmin } from '@/lib/hooks/useAdmin'
import { importSpots } from '@/app/actions/importSpots'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { MeetupDialog } from './MeetupDialog'
import { MeetupsList } from './MeetupsList'
import { createMeetup, getMeetups } from '@/app/actions/meetups'

// Fix for default marker icons in Next.js
const icon = L.icon({
  iconUrl: '/marker-icon.png',
  shadowUrl: '/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  shadowAnchor: [20, 41],
  className: 'leaflet-marker-icon',
  tooltipAnchor: [0, -41],
})

// Set the default icon for all markers
L.Marker.prototype.options.icon = icon

interface MapPoint {
  id: string
  name: string
  type: 'street' | 'park' | 'diy'
  coordinates: [number, number]
  createdBy: string
}

interface LocationMarkerProps {
  onLocationSelect: (lat: number, lng: number) => void
}

interface Comment {
  id: string
  content: string
  createdBy: string
  createdAt: number
}

interface LikeStatus {
  userId: string
  status: 'like' | 'dislike' | null
}

interface Report {
  id: string
  userId: string
  reason: string
  createdAt: number
  status: 'pending' | 'reviewed' | 'resolved'
}

interface AdminReport {
  id: string
  userId: string
  reason: string
  createdAt: number
  status: 'pending' | 'reviewed' | 'resolved'
  spotId: string
  spotName: string
}

interface SearchResult {
  display_name: string
  lat: number
  lon: number
}

interface EditProposal {
  id: string
  spotId: string
  userId: string
  userEmail: string
  proposedName: string
  proposedType: 'street' | 'park' | 'diy'
  reason: string
  createdAt: number
  status: 'pending' | 'approved' | 'rejected'
  adminNotes?: string
  spotName: string
  currentName: string
  currentType: 'street' | 'park' | 'diy'
}

// Component to handle map center updates
function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, zoom)
  }, [center, zoom, map])
  return null
}

function LocationMarker({ onLocationSelect }: LocationMarkerProps) {
  useMapEvents({
    click(e: L.LeafletMouseEvent) {
      // Check if click is on a control element, popup, location display, or search results
      const target = e.originalEvent.target as HTMLElement
      if (
        !document.querySelector('.leaflet-popup') &&
        !target.closest('.leaflet-control') &&
        !target.closest('.leaflet-bar') &&
        !target.closest('.location-display') &&
        !target.closest('.cmdk-list') // Add this to prevent clicks on search results
      ) {
        onLocationSelect(e.latlng.lat, e.latlng.lng)
      }
    },
  })
  return null
}

export default function Map() {
  const { user, isLoaded } = useUser()
  const [points, setPoints] = useState<MapPoint[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(
    null,
  )
  const [newPointName, setNewPointName] = useState('')
  const [newPointType, setNewPointType] = useState<'street' | 'park' | 'diy'>('street')
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null)
  const [zoom, setZoom] = useState(2)
  const [mapType, setMapType] = useState<'satellite' | 'street'>('satellite')
  const [comments, setComments] = useState<Record<string, Comment[]>>({})
  const [newComment, setNewComment] = useState('')
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null)
  const [isCommentsDialogOpen, setIsCommentsDialogOpen] = useState(false)
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})
  const [isLoadingPoints, setIsLoadingPoints] = useState(true)
  const [isLoadingComments, setIsLoadingComments] = useState<Record<string, boolean>>({})
  const [isDeletingPoint, setIsDeletingPoint] = useState<Record<string, boolean>>({})
  const [isAddingComment, setIsAddingComment] = useState(false)
  const [likes, setLikes] = useState<Record<string, LikeStatus[]>>({})
  const [isLoadingLikes, setIsLoadingLikes] = useState<Record<string, boolean>>({})
  const [isReporting, setIsReporting] = useState<Record<string, boolean>>({})
  const [reportReason, setReportReason] = useState('')
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false)
  const [spotToReport, setSpotToReport] = useState<string | null>(null)
  const [reports, setReports] = useState<Record<string, Report[]>>({})
  const [isLoadingReports, setIsLoadingReports] = useState<Record<string, boolean>>({})
  const isAdmin = useAdmin()
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<{
    success: boolean
    imported?: number
    errors?: number
    error?: string
  } | null>(null)
  const [isReportsDialogOpen, setIsReportsDialogOpen] = useState(false)
  const [adminReports, setAdminReports] = useState<AdminReport[]>([])
  const [isLoadingAdminReports, setIsLoadingAdminReports] = useState(false)
  const [isUpdatingReport, setIsUpdatingReport] = useState<Record<string, boolean>>({})
  const [isUpdatingProposal, setIsUpdatingProposal] = useState<Record<string, boolean>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const [isEditProposalDialogOpen, setIsEditProposalDialogOpen] = useState(false)
  const [spotToEdit, setSpotToEdit] = useState<MapPoint | null>(null)
  const [proposedName, setProposedName] = useState('')
  const [proposedType, setProposedType] = useState<'street' | 'park' | 'diy'>('street')
  const [editReason, setEditReason] = useState('')
  const [isSubmittingProposal, setIsSubmittingProposal] = useState(false)
  const [proposals, setProposals] = useState<Record<string, EditProposal[]>>({})
  const [isLoadingProposals, setIsLoadingProposals] = useState<Record<string, boolean>>({})
  const [isAdminProposalsDialogOpen, setIsAdminProposalsDialogOpen] = useState(false)
  const [adminProposals, setAdminProposals] = useState<EditProposal[]>([])
  const [isLoadingAdminProposals, setIsLoadingAdminProposals] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const mapRef = useRef<L.Map | null>(null)
  const [isMeetupDialogOpen, setIsMeetupDialogOpen] = useState(false)
  const [isMeetupsListDialogOpen, setIsMeetupsListDialogOpen] = useState(false)
  const [selectedSpotForMeetup, setSelectedSpotForMeetup] = useState<{
    id: string
    name: string
  } | null>(null)
  const [meetups, setMeetups] = useState<any[]>([])

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          setUserLocation([latitude, longitude])
          setZoom(13) // Zoom in to city level
        },
        (error) => {
          console.error('Error getting location:', error)
        },
      )
    }
  }, [])

  // Add debounced search function
  useEffect(() => {
    const searchLocation = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([])
        return
      }

      setIsSearching(true)
      try {
        // Format the search query for postal codes
        const formattedQuery = searchQuery.trim().match(/^\d{5}$/)
          ? `${searchQuery}, Oregon, USA` // Add state and country for postal codes
          : searchQuery.trim()

        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(formattedQuery)}&limit=5&addressdetails=1&countrycodes=us`,
          {
            headers: {
              'Accept-Language': 'en-US,en;q=0.9',
            },
          },
        )
        if (response.ok) {
          const data = await response.json()
          // Sort results to prioritize exact postal code matches
          const sortedData = data.sort((a: any, b: any) => {
            const aIsExactZip = a.address?.postcode === searchQuery.trim()
            const bIsExactZip = b.address?.postcode === searchQuery.trim()
            if (aIsExactZip && !bIsExactZip) return -1
            if (!aIsExactZip && bIsExactZip) return 1
            return 0
          })
          setSearchResults(sortedData)
        }
      } catch (error) {
        console.error('Error searching location:', error)
      } finally {
        setIsSearching(false)
      }
    }

    const timeoutId = setTimeout(searchLocation, 300)
    return () => clearTimeout(timeoutId)
  }, [searchQuery])

  const handleLocationSelect = (lat: number, lon: number) => {
    setSelectedLocation({ lat, lng: lon })
    setIsDialogOpen(true)
  }

  const handleAddPoint = async () => {
    if (!selectedLocation || !newPointName || !user) return

    const userEmail = user.primaryEmailAddress?.emailAddress
    if (!userEmail) {
      console.error('No email address found for user')
      return
    }

    const newPoint: MapPoint = {
      id: Date.now().toString(),
      name: newPointName,
      type: newPointType,
      coordinates: [selectedLocation.lat, selectedLocation.lng],
      createdBy: userEmail,
    }

    // Optimistic update
    setPoints((prevPoints) => [...prevPoints, newPoint])
    setNewPointName('')
    setSelectedLocation(null)
    setIsDialogOpen(false)

    try {
      const response = await fetch('/api/points', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newPoint),
      })

      if (!response.ok) {
        // Revert optimistic update on error
        setPoints((prevPoints) => prevPoints.filter((p) => p.id !== newPoint.id))
        if (response.status === 429) {
          const errorData = await response.json()
          const remainingMinutes = Math.ceil(errorData.remainingTime / (60 * 1000))
          toast.error(
            `You have reached the maximum number of points (5) you can add in 45 minutes. Please wait ${remainingMinutes} minutes before adding more.`,
          )
        } else {
          const errorText = await response.text()
          console.error('Failed to add point:', errorText)
          toast.error('Failed to add point. Please try again.')
        }
      }
    } catch (error) {
      // Revert optimistic update on error
      setPoints((prevPoints) => prevPoints.filter((p) => p.id !== newPoint.id))
      console.error('Error adding point:', error)
      toast.error('An error occurred. Please try again.')
    }
  }

  const handleDeletePoint = async (pointId: string) => {
    if (!user) return

    // Optimistic update
    setIsDeletingPoint((prev) => ({ ...prev, [pointId]: true }))
    setPoints((prevPoints) => prevPoints.filter((p) => p.id !== pointId))

    try {
      const response = await fetch(`/api/points/${pointId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        // Revert optimistic update on error
        const deletedPoint = points.find((p) => p.id === pointId)
        if (deletedPoint) {
          setPoints((prevPoints) => [...prevPoints, deletedPoint])
        }
        toast.error('Failed to delete point. Please try again.')
      }
    } catch (error) {
      // Revert optimistic update on error
      const deletedPoint = points.find((p) => p.id === pointId)
      if (deletedPoint) {
        setPoints((prevPoints) => [...prevPoints, deletedPoint])
      }
      console.error('Error deleting point:', error)
      toast.error('An error occurred. Please try again.')
    } finally {
      setIsDeletingPoint((prev) => ({ ...prev, [pointId]: false }))
    }
  }

  const fetchComments = async (spotId: string) => {
    setIsLoadingComments((prev) => ({ ...prev, [spotId]: true }))
    try {
      const response = await fetch(`/api/points/${spotId}/comments`)
      if (response.ok) {
        const data = await response.json()
        setComments((prev) => ({ ...prev, [spotId]: data }))
        setCommentCounts((prev) => ({ ...prev, [spotId]: data.length }))
      }
    } catch (error) {
      console.error('Error fetching comments:', error)
    } finally {
      setIsLoadingComments((prev) => ({ ...prev, [spotId]: false }))
    }
  }

  const handleAddComment = async (spotId: string) => {
    if (!newComment.trim() || !user) return

    const newCommentObj: Comment = {
      id: Date.now().toString(),
      content: newComment.trim(),
      createdBy: user.primaryEmailAddress?.emailAddress || '',
      createdAt: Date.now(),
    }

    // Optimistic update
    setIsAddingComment(true)
    setComments((prev) => ({
      ...prev,
      [spotId]: [...(prev[spotId] || []), newCommentObj],
    }))
    setCommentCounts((prev) => ({
      ...prev,
      [spotId]: (prev[spotId] || 0) + 1,
    }))
    setNewComment('')

    try {
      const response = await fetch(`/api/points/${spotId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: newComment }),
      })

      if (!response.ok) {
        // Revert optimistic update on error
        setComments((prev) => ({
          ...prev,
          [spotId]: prev[spotId].filter((c) => c.id !== newCommentObj.id),
        }))
        setCommentCounts((prev) => ({
          ...prev,
          [spotId]: (prev[spotId] || 1) - 1,
        }))
        toast.error('Failed to add comment. Please try again.')
      }
    } catch (error) {
      // Revert optimistic update on error
      setComments((prev) => ({
        ...prev,
        [spotId]: prev[spotId].filter((c) => c.id !== newCommentObj.id),
      }))
      setCommentCounts((prev) => ({
        ...prev,
        [spotId]: (prev[spotId] || 1) - 1,
      }))
      console.error('Error adding comment:', error)
      toast.error('An error occurred. Please try again.')
    } finally {
      setIsAddingComment(false)
    }
  }

  const handleDeleteComment = async (spotId: string, commentId: string) => {
    // Optimistic update
    setComments((prev) => ({
      ...prev,
      [spotId]: prev[spotId].filter((c) => c.id !== commentId),
    }))
    setCommentCounts((prev) => ({
      ...prev,
      [spotId]: (prev[spotId] || 1) - 1,
    }))

    try {
      const response = await fetch(`/api/points/${spotId}/comments`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ commentId }),
      })

      if (!response.ok) {
        // Revert optimistic update on error
        const deletedComment = comments[spotId]?.find((c) => c.id === commentId)
        if (deletedComment) {
          setComments((prev) => ({
            ...prev,
            [spotId]: [...(prev[spotId] || []), deletedComment],
          }))
          setCommentCounts((prev) => ({
            ...prev,
            [spotId]: (prev[spotId] || 0) + 1,
          }))
        }
        toast.error('Failed to delete comment. Please try again.')
      }
    } catch (error) {
      // Revert optimistic update on error
      const deletedComment = comments[spotId]?.find((c) => c.id === commentId)
      if (deletedComment) {
        setComments((prev) => ({
          ...prev,
          [spotId]: [...(prev[spotId] || []), deletedComment],
        }))
        setCommentCounts((prev) => ({
          ...prev,
          [spotId]: (prev[spotId] || 0) + 1,
        }))
      }
      console.error('Error deleting comment:', error)
      toast.error('An error occurred. Please try again.')
    }
  }

  const fetchLikes = async (spotId: string) => {
    setIsLoadingLikes((prev) => ({ ...prev, [spotId]: true }))
    try {
      const response = await fetch(`/api/points/${spotId}/likes`)
      if (response.ok) {
        const data = await response.json()
        setLikes((prev) => ({ ...prev, [spotId]: data }))
      }
    } catch (error) {
      console.error('Error fetching likes:', error)
    } finally {
      setIsLoadingLikes((prev) => ({ ...prev, [spotId]: false }))
    }
  }

  const handleLike = async (spotId: string, status: 'like' | 'dislike' | null) => {
    if (!user) return

    // Optimistic update
    const currentLikes = likes[spotId] || []
    const userLikeIndex = currentLikes.findIndex((like) => like.userId === user.id)

    let newLikes: LikeStatus[]
    if (userLikeIndex === -1) {
      newLikes = [...currentLikes, { userId: user.id, status }]
    } else {
      newLikes = [...currentLikes]
      if (status === null) {
        newLikes.splice(userLikeIndex, 1)
      } else {
        newLikes[userLikeIndex].status = status
      }
    }

    setLikes((prev) => ({ ...prev, [spotId]: newLikes }))

    try {
      const response = await fetch(`/api/points/${spotId}/likes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      })

      if (!response.ok) {
        // Revert optimistic update on error
        setLikes((prev) => ({ ...prev, [spotId]: currentLikes }))
        toast.error('Failed to update like status. Please try again.')
      }
    } catch (error) {
      // Revert optimistic update on error
      setLikes((prev) => ({ ...prev, [spotId]: currentLikes }))
      console.error('Error updating like status:', error)
      toast.error('An error occurred. Please try again.')
    }
  }

  const handleReport = async () => {
    if (!spotToReport || !reportReason.trim() || !user) return

    setIsReporting((prev) => ({ ...prev, [spotToReport]: true }))

    try {
      const response = await fetch(`/api/points/${spotToReport}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: reportReason }),
      })

      if (response.ok) {
        setIsReportDialogOpen(false)
        setReportReason('')
        setSpotToReport(null)
        toast.success('Thank you for reporting. We will review this spot.')
      } else {
        const errorText = await response.text()
        toast.error(errorText || 'Failed to submit report. Please try again.')
      }
    } catch (error) {
      console.error('Error submitting report:', error)
      toast.error('An error occurred. Please try again.')
    } finally {
      setIsReporting((prev) => ({ ...prev, [spotToReport]: false }))
    }
  }

  // Add function to fetch reports
  const fetchReports = async (spotId: string) => {
    setIsLoadingReports((prev) => ({ ...prev, [spotId]: true }))
    try {
      const response = await fetch(`/api/points/${spotId}/report`)
      if (response.ok) {
        const data = await response.json()
        setReports((prev) => ({ ...prev, [spotId]: data }))
      }
    } catch (error) {
      console.error('Error fetching reports:', error)
    } finally {
      setIsLoadingReports((prev) => ({ ...prev, [spotId]: false }))
    }
  }

  // Add function to fetch proposals
  const fetchProposals = async (spotId: string) => {
    setIsLoadingProposals((prev) => ({ ...prev, [spotId]: true }))
    try {
      const response = await fetch(`/api/points/${spotId}/proposals`)
      if (response.ok) {
        const data = await response.json()
        setProposals((prev) => ({ ...prev, [spotId]: data }))
      }
    } catch (error) {
      console.error('Error fetching proposals:', error)
    } finally {
      setIsLoadingProposals((prev) => ({ ...prev, [spotId]: false }))
    }
  }

  // Update handlePopupOpen to fetch proposals
  const handlePopupOpen = (pointId: string) => {
    setSelectedSpotId(pointId)
    fetchComments(pointId)
    fetchLikes(pointId)
    fetchReports(pointId)
    fetchProposals(pointId)
  }

  const handleImport = async () => {
    setIsImporting(true)
    try {
      const result = await importSpots()
      setImportResult(result)
      if (result.success) {
        // Refresh points after successful import
        const response = await fetch('/api/points')
        if (response.ok) {
          const data = await response.json()
          setPoints(data)
        }
      }
    } catch (error) {
      console.error('Error importing spots:', error)
      setImportResult({ success: false, error: 'Failed to import spots' })
    } finally {
      setIsImporting(false)
    }
  }

  const fetchAdminReports = async () => {
    setIsLoadingAdminReports(true)
    try {
      const response = await fetch('/api/admin/reports')
      if (response.ok) {
        const data = await response.json()
        setAdminReports(data)
      }
    } catch (error) {
      console.error('Error fetching admin reports:', error)
    } finally {
      setIsLoadingAdminReports(false)
    }
  }

  const handleUpdateReportStatus = async (
    reportId: string,
    newStatus: 'pending' | 'reviewed' | 'resolved',
  ) => {
    setIsUpdatingReport((prev) => ({ ...prev, [reportId]: true }))
    try {
      const response = await fetch(`/api/points/${reportId}/report`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok) {
        setAdminReports((prev) =>
          prev.map((report) =>
            report.id === reportId ? { ...report, status: newStatus } : report,
          ),
        )
      } else {
        toast.error('Failed to update report status')
      }
    } catch (error) {
      console.error('Error updating report status:', error)
      toast.error('An error occurred while updating the report status')
    } finally {
      setIsUpdatingReport((prev) => ({ ...prev, [reportId]: false }))
    }
  }

  useEffect(() => {
    const fetchPoints = async () => {
      setIsLoadingPoints(true)
      try {
        const response = await fetch('/api/points')
        if (response.ok) {
          const data = await response.json()
          setPoints(data)
        } else {
          console.error('Failed to fetch points:', await response.text())
        }
      } catch (error) {
        console.error('Error fetching points:', error)
      } finally {
        setIsLoadingPoints(false)
      }
    }

    fetchPoints()
  }, [])

  const handleProposeEdit = async () => {
    if (!spotToEdit || !proposedName || !proposedType || !editReason) return

    setIsSubmittingProposal(true)
    try {
      const response = await fetch(`/api/points/${spotToEdit.id}/proposals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          proposedName,
          proposedType,
          reason: editReason,
        }),
      })

      if (response.ok) {
        setIsEditProposalDialogOpen(false)
        setSpotToEdit(null)
        setProposedName('')
        setProposedType('street')
        setEditReason('')
        toast.success('Edit proposal submitted successfully!')
      } else {
        toast.error('Failed to submit edit proposal. Please try again.')
      }
    } catch (error) {
      console.error('Error submitting proposal:', error)
      toast.error('An error occurred. Please try again.')
    } finally {
      setIsSubmittingProposal(false)
    }
  }

  const handleUpdateProposal = async (
    spotId: string,
    proposalId: string,
    status: 'approved' | 'rejected',
    adminNotes?: string,
  ) => {
    setIsUpdatingProposal((prev) => ({ ...prev, [proposalId]: true }))
    try {
      const response = await fetch(`/api/points/${spotId}/proposals`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          proposalId,
          status,
          adminNotes,
        }),
      })

      if (response.ok) {
        // Update UI immediately
        setAdminProposals((prev) => prev.filter((p) => p.id !== proposalId))

        // Refresh points if proposal was approved
        if (status === 'approved') {
          const pointsResponse = await fetch('/api/points')
          if (pointsResponse.ok) {
            const data = await pointsResponse.json()
            setPoints(data)
          }
        }
      } else {
        toast.error('Failed to update proposal. Please try again.')
      }
    } catch (error) {
      console.error('Error updating proposal:', error)
      toast.error('An error occurred. Please try again.')
    } finally {
      setIsUpdatingProposal((prev) => ({ ...prev, [proposalId]: false }))
    }
  }

  const fetchAdminProposals = async () => {
    if (isLoadingAdminProposals) return // Prevent multiple simultaneous fetches

    setIsLoadingAdminProposals(true)
    try {
      const response = await fetch('/api/admin/proposals', {
        headers: {
          'Cache-Control': 'no-cache',
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch proposals: ${response.statusText}`)
      }

      const data = await response.json()
      setAdminProposals(data)
    } catch (error) {
      console.error('Error fetching admin proposals:', error)
      // Optionally show an error message to the user
    } finally {
      setIsLoadingAdminProposals(false)
    }
  }

  // Add fullscreen toggle function
  const toggleFullscreen = () => {
    const mapContainer = document.querySelector('.leaflet-container')
    if (!document.fullscreenElement) {
      mapContainer?.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  // Add fullscreen change event listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
      // Force a map resize when exiting fullscreen
      if (!document.fullscreenElement && mapRef.current) {
        setTimeout(() => {
          mapRef.current?.invalidateSize()
        }, 100)
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  const handleCreateMeetup = async (meetup: {
    title: string
    description: string
    date: Date
    spotId: string
    spotName: string
  }) => {
    try {
      await createMeetup({
        ...meetup,
        date: meetup.date.getTime(), // Convert Date to timestamp
        createdBy: user?.id || '',
      })
      // Refresh meetups list
      const updatedMeetups = await getMeetups(meetup.spotId)
      setMeetups(updatedMeetups)
    } catch (error) {
      console.error('Error creating meetup:', error)
    }
  }

  // Update popup content to include meetup button
  const renderPopupContent = (point: MapPoint) => {
    return (
      <div className="space-y-2">
        <h3 className="font-semibold">{point.name}</h3>
        <p className="text-sm text-gray-600">{point.type}</p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => {
              setSelectedSpotForMeetup({ id: point.id, name: point.name })
              setIsMeetupsListDialogOpen(true)
              // Fetch meetups for this spot
              getMeetups(point.id).then(setMeetups)
            }}
          >
            Skate Sessions
          </Button>
        </div>
      </div>
    )
  }

  if (!isLoaded) {
    return <div>Loading...</div>
  }

  if (!user) {
    return <div>Please sign in to view the map</div>
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Header Section */}
      <div className="border-b bg-white/90 backdrop-blur-sm">
        <div className="px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <h1 className="text-xl font-bold">Skate Spot Map</h1>
            <div className="flex items-center gap-2">
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-[200px] justify-start"
                  >
                    <Search className="mr-2 h-4 w-4" />
                    {searchQuery || 'Search location...'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
                  <Command>
                    <CommandInput
                      placeholder="Search for a location..."
                      value={searchQuery}
                      onValueChange={setSearchQuery}
                    />
                    <CommandEmpty>No location found.</CommandEmpty>
                    <CommandGroup>
                      {isSearching ? (
                        <div className="flex items-center justify-center py-4">
                          <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-gray-900"></div>
                        </div>
                      ) : (
                        searchResults.map((result) => (
                          <CommandItem
                            key={`${result.lat}-${result.lon}`}
                            value={result.display_name}
                            onSelect={() => handleLocationSelect(result.lat, result.lon)}
                          >
                            <Search className="mr-2 h-4 w-4" />
                            {result.display_name}
                          </CommandItem>
                        ))
                      )}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
              {isAdmin && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsReportsDialogOpen(true)
                      fetchAdminReports()
                    }}
                  >
                    Manage Reports
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsAdminProposalsDialogOpen(true)
                      fetchAdminProposals()
                    }}
                  >
                    Review Proposals
                  </Button>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-gray-500">
            <span>• Click map to add spot</span>
            <span>• Delete your own spots</span>
            <span>• Categorized by type (Street/Park/DIY)</span>
            <span>• Toggle between satellite/street view</span>
          </div>
        </div>
      </div>

      {/* Map container */}
      <div className="w-full flex-1">
        <MapContainer
          center={userLocation || [0, 0]}
          zoom={zoom}
          className="h-full w-full"
          style={{ height: '100%', width: '100%' }}
          ref={mapRef}
          scrollWheelZoom={true}
        >
          <ChangeView center={userLocation || [0, 0]} zoom={zoom} />
          {mapType === 'satellite' ? (
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
            />
          ) : (
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
          )}
          <LocationMarker onLocationSelect={handleLocationSelect} />

          {/* Map Controls */}
          <div className="leaflet-top leaflet-right">
            <div className="leaflet-control leaflet-bar flex gap-1 rounded-lg bg-white p-1 shadow-md">
              <Select
                value={mapType}
                onValueChange={(value: 'satellite' | 'street') => setMapType(value)}
              >
                <SelectTrigger className="h-8 w-[100px] border-0 bg-white text-black">
                  <SelectValue placeholder="Map Type" />
                </SelectTrigger>
                <SelectContent className="bg-white text-black">
                  <SelectItem
                    className="!focus:bg-zinc-300 focus:text-black dark:focus:text-white"
                    value="satellite"
                  >
                    Satellite
                  </SelectItem>
                  <SelectItem
                    className="!focus:bg-zinc-300 focus:text-black dark:focus:text-white"
                    value="street"
                  >
                    Street
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 border-0 bg-white text-black hover:bg-gray-100"
                onClick={toggleFullscreen}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {isLoadingPoints ? (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/50">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900"></div>
            </div>
          ) : (
            points.map((point) => (
              <Marker
                key={point.id}
                position={point.coordinates}
                icon={icon}
                eventHandlers={{
                  popupopen: () => {
                    handlePopupOpen(point.id)
                  },
                }}
              >
                <Popup className="max-w-[90vw] md:max-w-[300px]">
                  <div className="p-2">
                    {renderPopupContent(point)}

                    {/* Edit Proposal Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 w-full"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSpotToEdit(point)
                        setProposedName(point.name)
                        setProposedType(point.type)
                        setEditReason('')
                        setIsEditProposalDialogOpen(true)
                      }}
                    >
                      <Edit className="mr-1 h-4 w-4" />
                      Propose Edit
                    </Button>

                    {/* Pending Proposals */}
                    {proposals[point.id]?.filter((p) => p.status === 'pending').length > 0 && (
                      <div className="mt-2 rounded-md border border-yellow-200 bg-yellow-50 p-2">
                        <p className="text-sm text-yellow-800">
                          ⚠️ This spot has pending edit proposals
                        </p>
                        <p className="mt-1 text-xs text-yellow-600">
                          {proposals[point.id].filter((p) => p.status === 'pending').length}{' '}
                          proposal
                          {proposals[point.id].filter((p) => p.status === 'pending').length !== 1
                            ? 's'
                            : ''}
                        </p>
                      </div>
                    )}

                    {/* Report Status */}
                    {reports[point.id]?.length > 0 && (
                      <div className="mt-2 rounded-md border border-yellow-200 bg-yellow-50 p-2">
                        <p className="text-sm text-yellow-800">
                          ⚠️ This spot has been reported as potentially unavailable
                        </p>
                        <p className="mt-1 text-xs text-yellow-600">
                          {reports[point.id].length} report
                          {reports[point.id].length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    )}

                    {/* Likes Section */}
                    <div className="mt-2 flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`flex items-center gap-1 ${likes[point.id]?.find((l) => l.userId === user?.id)?.status === 'like' ? 'text-green-500' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleLike(
                            point.id,
                            likes[point.id]?.find((l) => l.userId === user?.id)?.status === 'like'
                              ? null
                              : 'like',
                          )
                        }}
                        disabled={isLoadingLikes[point.id]}
                      >
                        <ThumbsUp className="h-4 w-4" />
                        <span>
                          {likes[point.id]?.filter((l) => l.status === 'like').length || 0}
                        </span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`flex items-center gap-1 ${likes[point.id]?.find((l) => l.userId === user?.id)?.status === 'dislike' ? 'text-red-500' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleLike(
                            point.id,
                            likes[point.id]?.find((l) => l.userId === user?.id)?.status ===
                              'dislike'
                              ? null
                              : 'dislike',
                          )
                        }}
                        disabled={isLoadingLikes[point.id]}
                      >
                        <ThumbsDown className="h-4 w-4" />
                        <span>
                          {likes[point.id]?.filter((l) => l.status === 'dislike').length || 0}
                        </span>
                      </Button>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 w-full"
                      onClick={(e) => {
                        e.stopPropagation()
                        setIsCommentsDialogOpen(true)
                      }}
                    >
                      Show Comments (
                      {isLoadingComments[point.id] ? (
                        <Loader2 className="inline-block h-4 w-4 animate-spin" />
                      ) : (
                        comments[point.id]?.length || 0
                      )}
                      )
                    </Button>

                    {/* Report Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 w-full text-gray-500 hover:text-red-500"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSpotToReport(point.id)
                        setIsReportDialogOpen(true)
                      }}
                    >
                      <Flag className="mr-1 h-4 w-4" />
                      Report Spot
                    </Button>

                    {(point.createdBy === user.primaryEmailAddress?.emailAddress || isAdmin) && (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="mt-2 w-full"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeletePoint(point.id)
                        }}
                        disabled={isDeletingPoint[point.id]}
                      >
                        {isDeletingPoint[point.id] ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Deleting...
                          </>
                        ) : (
                          'Delete Spot'
                        )}
                      </Button>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))
          )}
        </MapContainer>
      </div>

      {/* Comments Dialog */}
      <Dialog open={isCommentsDialogOpen} onOpenChange={setIsCommentsDialogOpen}>
        <DialogContent className="max-h-[80vh] w-[90vw] sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {points.find((p) => p.id === selectedSpotId)?.name} - Comments
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Add a Comment</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Share your thoughts about this spot..."
                    className="min-h-[100px]"
                    disabled={isAddingComment}
                  />
                  <Button
                    onClick={() => selectedSpotId && handleAddComment(selectedSpotId)}
                    className="w-full"
                    disabled={!newComment.trim() || isAddingComment}
                  >
                    {isAddingComment ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Posting...
                      </>
                    ) : (
                      'Post Comment'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Comments</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px] pr-4">
                  {selectedSpotId && isLoadingComments[selectedSpotId] ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-gray-900"></div>
                    </div>
                  ) : (
                    <>
                      {selectedSpotId &&
                        comments[selectedSpotId]?.map((comment) => (
                          <div key={comment.id} className="mb-4 border-b pb-4 last:border-0">
                            <div className="flex items-start justify-between">
                              <p className="text-gray-700">{comment.content}</p>
                              {(comment.createdBy === user.primaryEmailAddress?.emailAddress ||
                                isAdmin) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-500 hover:text-red-700"
                                  onClick={() =>
                                    selectedSpotId &&
                                    handleDeleteComment(selectedSpotId, comment.id)
                                  }
                                >
                                  Delete
                                </Button>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-gray-500">
                              {formatDistanceToNow(comment.createdAt, { addSuffix: true })}
                            </p>
                          </div>
                        ))}
                      {selectedSpotId &&
                        (!comments[selectedSpotId] || comments[selectedSpotId].length === 0) && (
                          <p className="py-4 text-center text-gray-500">
                            No comments yet. Be the first to comment!
                          </p>
                        )}
                    </>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[90vw] sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Location</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Location Name</Label>
              <Input
                id="name"
                value={newPointName}
                onChange={(e) => setNewPointName(e.target.value)}
                placeholder="Enter location name"
                required
                className="w-full"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="type">Location Type</Label>
              <Select
                value={newPointType}
                onValueChange={(value: 'street' | 'park' | 'diy') => setNewPointType(value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="street">Street</SelectItem>
                  <SelectItem value="park">Park</SelectItem>
                  <SelectItem value="diy">DIY</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAddPoint} className="w-full">
              Add Location
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Report Dialog */}
      <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
        <DialogContent className="w-[90vw] sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Report Spot</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="reason">Reason for Report</Label>
              <Textarea
                id="reason"
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Please explain why this spot should be removed..."
                className="min-h-[100px]"
                required
              />
            </div>
            <Button
              onClick={handleReport}
              className="w-full"
              disabled={!reportReason.trim() || isReporting[spotToReport || '']}
            >
              {isReporting[spotToReport || ''] ? 'Submitting...' : 'Submit Report'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reports Dialog */}
      <Dialog open={isReportsDialogOpen} onOpenChange={setIsReportsDialogOpen}>
        <DialogContent className="max-h-[80vh] w-[90vw] sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Manage Reports</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {isLoadingAdminReports ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900"></div>
              </div>
            ) : adminReports.length === 0 ? (
              <p className="text-center text-gray-500">No reports to manage</p>
            ) : (
              <ScrollArea className="h-[60vh] pr-4">
                {adminReports.map((report) => (
                  <Card key={report.id} className="mb-4">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{report.spotName}</CardTitle>
                          <p className="text-sm text-gray-500">
                            Reported {formatDistanceToNow(report.createdAt, { addSuffix: true })}
                          </p>
                        </div>
                        <Select
                          value={report.status}
                          onValueChange={(value: 'pending' | 'reviewed' | 'resolved') =>
                            handleUpdateReportStatus(report.id, value)
                          }
                          disabled={isUpdatingReport[report.id]}
                        >
                          <SelectTrigger className="w-[120px]">
                            <SelectValue />
                            {isUpdatingReport[report.id] && (
                              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                            )}
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="reviewed">Reviewed</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-700">{report.reason}</p>
                    </CardContent>
                  </Card>
                ))}
              </ScrollArea>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Proposal Dialog */}
      <Dialog open={isEditProposalDialogOpen} onOpenChange={setIsEditProposalDialogOpen}>
        <DialogContent className="w-[90vw] sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Propose Edit</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="proposedName">Proposed Name</Label>
              <Input
                id="proposedName"
                value={proposedName}
                onChange={(e) => setProposedName(e.target.value)}
                placeholder="Enter proposed name"
                required
                className="w-full"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="proposedType">Proposed Type</Label>
              <Select
                value={proposedType}
                onValueChange={(value: 'street' | 'park' | 'diy') => setProposedType(value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="street">Street</SelectItem>
                  <SelectItem value="park">Park</SelectItem>
                  <SelectItem value="diy">DIY</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editReason">Reason for Edit</Label>
              <Textarea
                id="editReason"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Please explain why this spot needs to be edited..."
                className="min-h-[100px]"
                required
              />
            </div>
            <Button
              onClick={handleProposeEdit}
              className="w-full"
              disabled={!proposedName || !proposedType || !editReason || isSubmittingProposal}
            >
              {isSubmittingProposal ? 'Submitting...' : 'Submit Proposal'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {importResult && (
        <div
          className={`absolute left-1/2 top-40 z-50 -translate-x-1/2 rounded-lg bg-white/95 p-4 shadow-lg ${
            importResult.success
              ? 'border border-green-600 text-green-600'
              : 'border-red-500 text-red-500'
          }`}
        >
          <h3 className="font-semibold">
            {importResult.success ? 'Import Successful' : 'Import Failed'}
          </h3>
          {importResult.success ? (
            <p>Imported {importResult.imported} spots</p>
          ) : (
            <p className="text-red-500">{importResult.error}</p>
          )}
        </div>
      )}

      {/* Admin Proposals Dialog */}
      <Dialog open={isAdminProposalsDialogOpen} onOpenChange={setIsAdminProposalsDialogOpen}>
        <DialogContent className="max-h-[80vh] w-[90vw] sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Review Edit Proposals</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {isLoadingAdminProposals ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900"></div>
              </div>
            ) : adminProposals.length === 0 ? (
              <p className="text-center text-gray-500">No proposals to review</p>
            ) : (
              <ScrollArea className="h-[60vh] pr-4">
                {adminProposals.map((proposal) => (
                  <Card key={proposal.id} className="mb-4">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{proposal.spotName}</CardTitle>
                          <p className="text-sm text-gray-500">
                            Proposed by {proposal.userEmail}{' '}
                            {formatDistanceToNow(proposal.createdAt, { addSuffix: true })}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleUpdateProposal(proposal.spotId, proposal.id, 'approved')
                            }
                            disabled={isUpdatingProposal[proposal.id]}
                          >
                            {isUpdatingProposal[proposal.id] ? 'Approving...' : 'Approve'}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() =>
                              handleUpdateProposal(proposal.spotId, proposal.id, 'rejected')
                            }
                            disabled={isUpdatingProposal[proposal.id]}
                          >
                            {isUpdatingProposal[proposal.id] ? 'Rejecting...' : 'Reject'}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-medium">Current Details</h4>
                          <p className="text-sm text-gray-600">
                            Name: {proposal.currentName}
                            <br />
                            Type: {proposal.currentType}
                          </p>
                        </div>
                        <div>
                          <h4 className="font-medium">Proposed Changes</h4>
                          <p className="text-sm text-gray-600">
                            Name: {proposal.proposedName}
                            <br />
                            Type: {proposal.proposedType}
                          </p>
                        </div>
                        <div>
                          <h4 className="font-medium">Reason</h4>
                          <p className="text-sm text-gray-600">{proposal.reason}</p>
                        </div>
                        {proposal.adminNotes && (
                          <div>
                            <h4 className="font-medium">Admin Notes</h4>
                            <p className="text-sm text-gray-600">{proposal.adminNotes}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </ScrollArea>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Meetup Dialog */}
      {selectedSpotForMeetup && (
        <MeetupDialog
          isOpen={isMeetupDialogOpen}
          onClose={() => {
            setIsMeetupDialogOpen(false)
            setSelectedSpotForMeetup(null)
          }}
          spotId={selectedSpotForMeetup.id}
          spotName={selectedSpotForMeetup.name}
          onCreateMeetup={handleCreateMeetup}
        />
      )}

      {/* Meetups List Dialog */}
      <Dialog open={isMeetupsListDialogOpen} onOpenChange={setIsMeetupsListDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Skate Sessions at {selectedSpotForMeetup?.name}</DialogTitle>
          </DialogHeader>
          {selectedSpotForMeetup && (
            <MeetupsList
              spotId={selectedSpotForMeetup.id}
              meetups={meetups}
              onMeetupsChange={() => getMeetups(selectedSpotForMeetup.id).then(setMeetups)}
            />
          )}
          <div className="mt-4 flex justify-end">
            <Button
              onClick={() => {
                setIsMeetupDialogOpen(true)
                setIsMeetupsListDialogOpen(false)
              }}
            >
              Create New Session
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
