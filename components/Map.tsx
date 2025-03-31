'use client'

import { toast } from 'sonner'
import React from 'react'
import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
  CardDescription,
} from '@/components/ui/card'
import {
  Loader2,
  ThumbsUp,
  ThumbsDown,
  Flag,
  Search,
  Edit,
  Maximize2,
  Minimize2,
  Shield,
  X,
  Users,
  Calendar,
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
  CommandList,
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

// Create a custom marker icon with session indicator
const createMarkerIcon = (hasActiveSession: boolean) => {
  return L.divIcon({
    className: 'custom-marker-icon',
    html: `
      <div class="relative">
        <img src="/marker-icon.png" class="w-[25px] h-[41px]" />
        ${
          hasActiveSession
            ? `
          <div class="absolute left-1/2 top-[33.3%] -translate-x-1/2 -translate-y-1/2 w-[0.865rem] h-[0.865rem] bg-purple-500 rounded-full border-2 border-white cursor-pointer session-indicator"></div>
        `
            : ''
        }
      </div>
    `,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  })
}

// Set the default icon for all markers
L.Marker.prototype.options.icon = icon

interface MapPoint {
  id: string
  name: string
  type: 'street' | 'park' | 'diy'
  coordinates: [number, number]
  createdBy: string
  address?: string
  lastUpdated?: number // Add this field to track updates
}

interface LocationMarkerProps {
  onLocationSelect: (lat: number, lng: number) => void
}

interface Comment {
  id: string
  content: string
  createdBy: string
  createdAt: number
  updatedAt?: number
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

interface NearbyMeetup {
  id: string
  title: string
  description: string
  date: number
  spotId: string
  spotName: string
  createdBy: string
  createdByName: string
  createdByEmail: string
  coordinates: [number, number]
  distance: number
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
      // Check if click is on a control element, popup, location display, search results, or any button
      const target = e.originalEvent.target as HTMLElement
      if (
        !document.querySelector('.leaflet-popup') &&
        !target.closest('.leaflet-control') &&
        !target.closest('.leaflet-bar') &&
        !target.closest('.location-display') &&
        !target.closest('.cmdk-list') && // Add this to prevent clicks on search results
        !target.closest('button') // Add this to prevent clicks on any button
      ) {
        onLocationSelect(e.latlng.lat, e.latlng.lng)
      }
    },
  })
  return null
}

// Add this new component before the Map component
function EditProposalDialog({
  isOpen,
  onOpenChange,
  spotToEdit,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  spotToEdit: MapPoint | null
  onSubmit: (
    proposedName: string,
    proposedType: 'street' | 'park' | 'diy',
    editReason: string,
  ) => Promise<void>
  isSubmitting: boolean
}) {
  const [proposedName, setProposedName] = useState(spotToEdit?.name || '')
  const [proposedType, setProposedType] = useState<'street' | 'park' | 'diy'>(
    spotToEdit?.type || 'street',
  )
  const [editReason, setEditReason] = useState('')

  // Reset form when spotToEdit changes
  useEffect(() => {
    if (spotToEdit) {
      setProposedName(spotToEdit.name)
      setProposedType(spotToEdit.type)
      setEditReason('')
    }
  }, [spotToEdit])

  const handleSubmit = async () => {
    if (!proposedName || !proposedType || !editReason) return
    await onSubmit(proposedName, proposedType, editReason)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
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
            onClick={handleSubmit}
            className="w-full"
            disabled={!proposedName || !proposedType || !editReason || isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Proposal'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Add this new component before the Map component
const LocationNameInput = React.memo(
  ({
    value,
    onChange,
    disabled,
  }: {
    value: string
    onChange: (value: string) => void
    disabled?: boolean
  }) => {
    const inputRef = useRef<HTMLInputElement>(null)
    const localValueRef = useRef(value)

    // Update local value when prop changes
    useEffect(() => {
      if (inputRef.current && value !== localValueRef.current) {
        inputRef.current.value = value
        localValueRef.current = value
      }
    }, [value])

    return (
      <Input
        ref={inputRef}
        id="name"
        defaultValue={value}
        onBlur={(e) => {
          const newValue = e.target.value
          if (newValue !== localValueRef.current) {
            localValueRef.current = newValue
            onChange(newValue)
          }
        }}
        placeholder="Enter location name"
        required
        className="w-full"
        disabled={disabled}
      />
    )
  },
  (prevProps, nextProps) => {
    // Only re-render if disabled state or value changes
    return prevProps.disabled === nextProps.disabled && prevProps.value === nextProps.value
  },
)

LocationNameInput.displayName = 'LocationNameInput'

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
  const [editingComment, setEditingComment] = useState<{ id: string; content: string } | null>(null)
  const [isEditingComment, setIsEditingComment] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [mapKey, setMapKey] = useState(0)
  const [showWelcomeMessage, setShowWelcomeMessage] = useState(true)
  const [isDenyingAll, setIsDenyingAll] = useState(false)
  const [showNearbySessions, setShowNearbySessions] = useState(false)
  const [nearbySessions, setNearbySessions] = useState<NearbyMeetup[]>([])
  const [isLoadingNearbySessions, setIsLoadingNearbySessions] = useState(false)
  const [isNearbySessionsDialogOpen, setIsNearbySessionsDialogOpen] = useState(false)
  const [isAddingPoint, setIsAddingPoint] = useState(false)
  const [isLoadingAddress, setIsLoadingAddress] = useState<Record<string, boolean>>({})
  const [lastFetchTime, setLastFetchTime] = useState<number>(0)
  const pointsCache = useRef<MapPoint[]>([])
  const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes in milliseconds
  const [isCacheValid, setIsCacheValid] = useState(true)

  // Remove debounced handler and use direct state update
  const handleNameChange = (value: string) => {
    setNewPointName(value)
  }

  useEffect(() => {
    // Only set mounted state if we're in the browser
    if (typeof window !== 'undefined') {
      setIsMounted(true)
      // Generate a new key for the map container
      setMapKey(Date.now())
    }

    return () => {
      // Cleanup function
      if (mapRef.current) {
        mapRef.current.remove()
      }
      // Clean up any existing map instances
      const mapContainer = document.querySelector('.leaflet-container')
      if (mapContainer) {
        mapContainer.innerHTML = ''
      }
      // Reset mounted state
      setIsMounted(false)
    }
  }, [])

  // Add a separate effect for map initialization
  useEffect(() => {
    if (isMounted && mapRef.current) {
      // Force a map resize when mounted
      setTimeout(() => {
        mapRef.current?.invalidateSize()
      }, 100)
    }
  }, [isMounted])

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

  // Add new function for handling search result selection
  const handleSearchResultSelect = (lat: number, lon: number) => {
    setUserLocation([lat, lon])
    setZoom(13) // Zoom in to city level
    setOpen(false) // Close the search dropdown
    setSearchQuery('') // Clear the search query
  }

  // Add this new function for address lookup
  const lookupAddress = async (lat: number, lng: number): Promise<string> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'en-US,en;q=0.9',
          },
        },
      )

      if (response.ok) {
        const data = await response.json()
        return data.display_name || ''
      }
      return ''
    } catch (error) {
      console.error('Error fetching address:', error)
      return ''
    }
  }

  // Add function to fetch points with caching
  const fetchPoints = async (forceRefresh = false) => {
    const now = Date.now()
    const shouldUseCache = !forceRefresh && isCacheValid && now - lastFetchTime < CACHE_DURATION

    if (shouldUseCache && pointsCache.current.length > 0) {
      setPoints(pointsCache.current)
      setIsLoadingPoints(false)
      return
    }

    setIsLoadingPoints(true)
    try {
      const response = await fetch('/api/points')
      if (response.ok) {
        const data = await response.json()
        pointsCache.current = data
        setPoints(data)
        setLastFetchTime(now)
        setIsCacheValid(true)
      } else {
        console.error('Failed to fetch points:', await response.text())
      }
    } catch (error) {
      console.error('Error fetching points:', error)
    } finally {
      setIsLoadingPoints(false)
    }
  }

  // Update useEffect to use the new fetchPoints function
  useEffect(() => {
    if (isMounted) {
      fetchPoints()
    }
  }, [isMounted])

  // Add function to handle point updates
  const handlePointUpdate = async (newPoint: MapPoint) => {
    // Optimistically update the UI
    setPoints((prevPoints) => [...prevPoints, newPoint])
    pointsCache.current = [...pointsCache.current, newPoint]

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
        pointsCache.current = pointsCache.current.filter((p) => p.id !== newPoint.id)
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
      } else {
        // Update the lastUpdated timestamp
        newPoint.lastUpdated = Date.now()
      }
    } catch (error) {
      // Revert optimistic update on error
      setPoints((prevPoints) => prevPoints.filter((p) => p.id !== newPoint.id))
      pointsCache.current = pointsCache.current.filter((p) => p.id !== newPoint.id)
      console.error('Error adding point:', error)
      toast.error('An error occurred. Please try again.')
    }
  }

  // Update handleAddPoint to use the new handlePointUpdate function
  const handleAddPoint = async () => {
    if (!selectedLocation || !newPointName || !user || isAddingPoint) return

    const userEmail = user.primaryEmailAddress?.emailAddress
    if (!userEmail) {
      console.error('No email address found for user')
      return
    }

    setIsAddingPoint(true)

    // Create the new point without address initially
    const newPoint: MapPoint = {
      id: Date.now().toString(),
      name: newPointName,
      type: newPointType,
      coordinates: [selectedLocation.lat, selectedLocation.lng],
      createdBy: userEmail,
    }

    // Start address lookup in the background
    const addressPromise = lookupAddress(selectedLocation.lat, selectedLocation.lng)

    // Update the point with the address once we have it
    const address = await addressPromise
    if (address) {
      newPoint.address = address
    }

    await handlePointUpdate(newPoint)
    setNewPointName('')
    setSelectedLocation(null)
    setIsDialogOpen(false)
    setIsAddingPoint(false)
  }

  const handleDeletePoint = async (pointId: string) => {
    if (!user) return

    // Optimistic update
    setIsDeletingPoint((prev) => ({ ...prev, [pointId]: true }))
    setPoints((prevPoints) => prevPoints.filter((p) => p.id !== pointId))
    pointsCache.current = pointsCache.current.filter((p) => p.id !== pointId)

    try {
      const response = await fetch(`/api/points/${pointId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        // Revert optimistic update on error
        const deletedPoint = points.find((p) => p.id === pointId)
        if (deletedPoint) {
          setPoints((prevPoints) => [...prevPoints, deletedPoint])
          pointsCache.current = [...pointsCache.current, deletedPoint]
        }
        toast.error('Failed to delete point. Please try again.')
      } else {
        // Invalidate cache on successful deletion
        setIsCacheValid(false)
        toast.success('Spot deleted successfully')

        // Force a refresh of the points
        fetchPoints(true)
      }
    } catch (error) {
      // Revert optimistic update on error
      const deletedPoint = points.find((p) => p.id === pointId)
      if (deletedPoint) {
        setPoints((prevPoints) => [...prevPoints, deletedPoint])
        pointsCache.current = [...pointsCache.current, deletedPoint]
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
    if (!user?.primaryEmailAddress?.emailAddress) {
      toast.error('Please wait while we verify your account...')
      return
    }

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
        const errorText = await response.text()
        toast.error(errorText || 'Failed to delete comment. Please try again.')
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
        const newReport = await response.json()
        // Update the local reports state
        setReports((prev) => ({
          ...prev,
          [spotToReport]: [...(prev[spotToReport] || []), newReport],
        }))
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

  // Update handlePopupOpen to fetch proposals and address
  const handlePopupOpen = async (pointId: string) => {
    setSelectedSpotId(pointId)
    fetchComments(pointId)
    fetchLikes(pointId)
    fetchReports(pointId)
    fetchProposals(pointId)

    // Find the point in our points array
    const point = points.find((p) => p.id === pointId)
    if (point && !point.address) {
      setIsLoadingAddress((prev) => ({ ...prev, [pointId]: true }))
      try {
        // Fetch address from coordinates
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${point.coordinates[0]}&lon=${point.coordinates[1]}&addressdetails=1`,
          {
            headers: {
              'Accept-Language': 'en-US,en;q=0.9',
            },
          },
        )

        if (response.ok) {
          const data = await response.json()
          if (data.display_name) {
            // Update the point with the address
            setPoints((prevPoints) =>
              prevPoints.map((p) => (p.id === pointId ? { ...p, address: data.display_name } : p)),
            )
          }
        }
      } catch (error) {
        console.error('Error fetching address:', error)
      } finally {
        setIsLoadingAddress((prev) => ({ ...prev, [pointId]: false }))
      }
    }
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

  const handleUpdateReportStatus = async (reportId: string, newStatus: 'accept' | 'deny') => {
    setIsUpdatingReport((prev) => ({ ...prev, [reportId]: true }))
    try {
      const response = await fetch(`/api/admin/reports/${reportId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Failed to update report status')
      }

      // Get the report details before removing it
      const report = adminReports.find((r) => r.id === reportId)
      if (!report) throw new Error('Report not found')

      // If accepted, remove the spot
      if (newStatus === 'accept') {
        // Remove the spot from the points list
        setPoints((prev) => prev.filter((p) => p.id !== report.spotId))
        toast.success('Spot removed successfully')
      } else {
        // Update the local reports state to remove the denied report
        setReports((prev) => ({
          ...prev,
          [report.spotId]: prev[report.spotId]?.filter((r) => r.id !== reportId) || [],
        }))
        toast.success('Report denied')
      }

      // Refresh the admin reports list
      await fetchAdminReports()
    } catch (error) {
      console.error('Error updating report status:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update report status')
    } finally {
      setIsUpdatingReport((prev) => ({ ...prev, [reportId]: false }))
    }
  }

  useEffect(() => {
    // If user is admin, fetch admin data
    const fetchAdminData = async () => {
      if (isAdmin) {
        try {
          // Fetch admin reports
          const reportsResponse = await fetch('/api/admin/reports')
          if (reportsResponse.ok) {
            const reportsData = await reportsResponse.json()
            setAdminReports(reportsData)
          }

          // Fetch admin proposals
          const proposalsResponse = await fetch('/api/admin/proposals')
          if (proposalsResponse.ok) {
            const proposalsData = await proposalsResponse.json()
            setAdminProposals(proposalsData)
          }
        } catch (error) {
          console.error('Error fetching admin data:', error)
        }
      }
    }

    fetchAdminData()
  }, [isAdmin])

  const handleEditComment = async (spotId: string, commentId: string) => {
    if (!editingComment || !editingComment.content.trim()) return

    setIsEditingComment(true)
    try {
      const response = await fetch(`/api/points/${spotId}/comments`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          commentId,
          content: editingComment.content,
        }),
      })

      if (response.ok) {
        const updatedComment = await response.json()
        setComments((prev) => ({
          ...prev,
          [spotId]: prev[spotId].map((c) => (c.id === commentId ? updatedComment : c)),
        }))
        setEditingComment(null)
        toast.success('Comment updated successfully')
      } else {
        toast.error('Failed to update comment')
      }
    } catch (error) {
      console.error('Error updating comment:', error)
      toast.error('An error occurred while updating the comment')
    } finally {
      setIsEditingComment(false)
    }
  }

  // Add effect to check localStorage for welcome message preference
  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem('hasSeenWelcome')
    if (hasSeenWelcome === 'true') {
      setShowWelcomeMessage(false)
    }
  }, [])

  // Add function to handle welcome message dismissal
  const handleDismissWelcome = () => {
    setShowWelcomeMessage(false)
    localStorage.setItem('hasSeenWelcome', 'true')
  }

  const handleDenyAllReports = async () => {
    try {
      setIsDenyingAll(true)
      const response = await fetch('/api/admin/reports/deny-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to deny all reports')
      }

      // Refresh the reports list
      const updatedReports = await fetch('/api/admin/reports').then((res) => res.json())
      setAdminReports(updatedReports)
      toast.success('All reports have been denied')
    } catch (error) {
      console.error('Error denying all reports:', error)
      toast.error('Failed to deny all reports')
    } finally {
      setIsDenyingAll(false)
    }
  }

  // Add function to fetch nearby sessions
  const fetchNearbySessions = async () => {
    if (!mapRef.current) return

    // Don't fetch if zoomed out too far (zoom level less than 8)
    if (mapRef.current.getZoom() < 8) {
      setNearbySessions([])
      return
    }

    setIsLoadingNearbySessions(true)
    try {
      const center = mapRef.current.getCenter()
      const response = await fetch(
        `/api/meetups/nearby?lat=${center.lat}&lng=${center.lng}&radius=50`,
      )
      if (response.ok) {
        const data = await response.json()
        setNearbySessions(data)
      }
    } catch (error) {
      console.error('Error fetching nearby sessions:', error)
    } finally {
      setIsLoadingNearbySessions(false)
    }
  }

  // Add effect to fetch nearby sessions when toggle is changed
  useEffect(() => {
    if (showNearbySessions) {
      fetchNearbySessions()
    } else {
      setNearbySessions([])
    }
  }, [showNearbySessions])

  // Update the marker color based on active sessions
  const getMarkerColor = (point: MapPoint) => {
    const hasActiveSession = nearbySessions.some((session) => session.spotId === point.id)
    return hasActiveSession ? '#9333ea' : '#ef4444' // Purple for active sessions, red for others
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

  // Add this function before the renderPopupContent function
  const handleSessionRemoval = async (sessionId: string) => {
    try {
      // Optimistically update the UI
      setNearbySessions((prev) => prev.filter((session) => session.id !== sessionId))
      setMeetups((prev) => prev.filter((meetup) => meetup.id !== sessionId))

      // Call the API to delete the session
      const response = await fetch(`/api/meetups/${sessionId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        // Revert optimistic update on error
        const deletedSession = nearbySessions.find((session) => session.id === sessionId)
        if (deletedSession) {
          setNearbySessions((prev) => [...prev, deletedSession])
          setMeetups((prev) => [...prev, deletedSession])
        }
        throw new Error('Failed to delete session')
      }

      toast.success('Session removed successfully')
    } catch (error) {
      console.error('Error removing session:', error)
      toast.error('Failed to remove session')
    }
  }

  // Update handleCreateMeetup to refresh both states
  const handleCreateMeetup = async (meetup: {
    title: string
    description: string
    date: Date
    spotId: string
    spotName: string
  }) => {
    try {
      const newMeetup = await createMeetup({
        ...meetup,
        date: meetup.date.getTime(),
        createdBy: user?.id || '',
        createdByName: user?.firstName
          ? `${user.firstName} ${user.lastName || ''}`.trim()
          : 'Anonymous',
        createdByEmail: user?.primaryEmailAddress?.emailAddress || '',
      })

      // Update both states immediately
      setMeetups((prev) => [...prev, newMeetup])

      // If showing nearby sessions, update that state too
      if (showNearbySessions) {
        const nearbyMeetup: NearbyMeetup = {
          ...newMeetup,
          coordinates: points.find((p) => p.id === meetup.spotId)?.coordinates || [0, 0],
          distance: 0, // This will be calculated by the server
        }
        setNearbySessions((prev) => [...prev, nearbyMeetup])
      }

      toast.success('Session created successfully')
    } catch (error) {
      console.error('Error creating meetup:', error)
      toast.error('Failed to create session')
    }
  }

  // Update the renderPopupContent function
  const renderPopupContent = (point: MapPoint) => {
    const activeSession = nearbySessions.find((session) => session.spotId === point.id)

    return (
      <div className="space-y-2">
        <h3 className="font-semibold">{point.name}</h3>
        <p className="text-sm text-gray-600">{point.type}</p>
        {isLoadingAddress[point.id] ? (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-7 w-7 animate-spin" />
          </div>
        ) : (
          point.address && (
            <p className="text-sm text-gray-500">
              <span className="font-medium">Address:</span> {point.address}
            </p>
          )
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation()
              setSelectedSpotForMeetup({ id: point.id, name: point.name })
              setIsMeetupsListDialogOpen(true)
              // Fetch meetups for this spot
              getMeetups(point.id).then(setMeetups)
            }}
          >
            <div className="h-4 w-4 rounded-full bg-purple-500 text-purple-500"></div>
            Skate Sessions
          </Button>
        </div>

        {/* Edit Proposal Button */}
        <Button
          variant="outline"
          size="sm"
          className="mt-2 w-full"
          onClick={(e) => {
            e.stopPropagation()
            setSpotToEdit(point)
            setIsEditProposalDialogOpen(true)
          }}
        >
          <Edit className="mr-1 h-4 w-4" />
          Propose Edit
        </Button>

        {/* Pending Proposals */}
        {proposals[point.id]?.filter((p) => p.status === 'pending').length > 0 && (
          <div className="mt-2 rounded-md border border-yellow-200 bg-yellow-50 p-0.5">
            <p className="text-sm text-yellow-800">⚠️ This spot has pending edit proposals</p>
            <p className="mt-1 text-xs text-yellow-600">
              {proposals[point.id].filter((p) => p.status === 'pending').length} proposal
              {proposals[point.id].filter((p) => p.status === 'pending').length !== 1 ? 's' : ''}
            </p>
          </div>
        )}

        {/* Report Status */}
        {reports[point.id]?.length > 0 && (
          <div className="mt-2 rounded-md border border-yellow-200 bg-yellow-50 p-0.5">
            <p className="text-sm text-yellow-800">⚠️ This spot has been reported for removal</p>
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
            <span>{likes[point.id]?.filter((l) => l.status === 'like').length || 0}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`flex items-center gap-1 ${likes[point.id]?.find((l) => l.userId === user?.id)?.status === 'dislike' ? 'text-red-500' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              handleLike(
                point.id,
                likes[point.id]?.find((l) => l.userId === user?.id)?.status === 'dislike'
                  ? null
                  : 'dislike',
              )
            }}
            disabled={isLoadingLikes[point.id]}
          >
            <ThumbsDown className="h-4 w-4" />
            <span>{likes[point.id]?.filter((l) => l.status === 'dislike').length || 0}</span>
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

        {(point.createdBy === user!.primaryEmailAddress?.emailAddress || isAdmin) && (
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
    )
  }

  // Add this effect before the return statement
  useEffect(() => {
    if (!mapRef.current) return

    const handleClick = (e: L.LeafletMouseEvent) => {
      const target = e.originalEvent.target as HTMLElement
      if (target.classList.contains('session-indicator')) {
        const markerElement = target.closest('.leaflet-marker-icon')
        if (markerElement) {
          const spotId = markerElement.getAttribute('data-spot-id')

          if (spotId) {
            const point = points.find((p) => p.id === spotId)
            if (point) {
              // Open the popup for the spot
              const marker = mapRef.current
                ?.getPane('overlayPane')
                ?.querySelector(`[data-spot-id="${spotId}"]`)
              if (marker) {
                const popupContent = document.createElement('div')
                const content = renderPopupContent(point)
                if (content instanceof HTMLElement) {
                  popupContent.appendChild(content)
                } else {
                  popupContent.innerHTML = content.toString()
                }
                const popup = L.popup()
                  .setLatLng(point.coordinates)
                  .setContent(popupContent)
                  .openOn(mapRef.current!)
              }
            }
          }
        }
      }
    }

    mapRef.current.on('click', handleClick)
    return () => {
      mapRef.current?.off('click', handleClick)
    }
  }, [points])

  // Add effect to periodically check for updates
  useEffect(() => {
    if (!isMounted) return

    const checkForUpdates = async () => {
      try {
        const response = await fetch('/api/points/last-update')
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const data = await response.json()

        if (!data || typeof data.lastUpdate !== 'number') {
          console.error('Invalid response format:', data)
          return
        }

        const oldestPoint = Math.min(...pointsCache.current.map((p) => p.lastUpdated || 0))

        if (data.lastUpdate > oldestPoint) {
          setIsCacheValid(false)
          fetchPoints(true)
        }
      } catch (error) {
        console.error('Error checking for updates:', error)
      }
    }

    const interval = setInterval(checkForUpdates, CACHE_DURATION)
    return () => clearInterval(interval)
  }, [isMounted])

  if (!isLoaded || !isMounted) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <div>Please sign in to view the map</div>
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Header Section */}
      <div className="sticky top-0 border-b shadow-sm backdrop-blur-sm">
        <div className="container mx-auto px-2 py-1.5 sm:px-4 sm:py-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex items-center gap-2">
              <h1 className="bg-gradient-to-r from-blue to-purple-400 bg-clip-text text-xl font-bold text-transparent sm:text-2xl">
                SkateSpot
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-[250px]">
                <Command className="rounded-lg border shadow-sm">
                  <CommandInput
                    placeholder="Search for skate spots..."
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                    className="h-10"
                  />
                  {searchQuery && (
                    <div className="absolute left-0 right-0 top-full mt-1">
                      <CommandList className="max-h-[200px] w-full overflow-auto rounded-md bg-white shadow-md">
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
                                onSelect={() => handleSearchResultSelect(result.lat, result.lon)}
                              >
                                <Search className="mr-2 h-4 w-4" />
                                {result.display_name}
                              </CommandItem>
                            ))
                          )}
                        </CommandGroup>
                      </CommandList>
                    </div>
                  )}
                </Command>
              </div>
              {isAdmin && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white/50 hover:bg-white"
                    onClick={() => {
                      setIsReportsDialogOpen(true)
                      fetchAdminReports()
                    }}
                  >
                    Manage Reports ({adminReports.length})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white/50 hover:bg-white"
                    onClick={() => {
                      setIsAdminProposalsDialogOpen(true)
                      fetchAdminProposals()
                    }}
                  >
                    Review Proposals ({adminProposals.length})
                  </Button>
                </div>
              )}
            </div>
          </div>
          {showWelcomeMessage && (
            <div className="bg-blue-50 text-blue-700 mt-4 rounded-lg p-3 text-sm">
              <div className="flex items-start justify-between">
                <p>
                  Welcome to SkateSpot! Find, add, and share your favorite skate spots. Click
                  anywhere on the map to add a new spot, or use the search to find existing
                  locations.
                </p>
                <button
                  onClick={handleDismissWelcome}
                  className="text-blue-400 hover:text-blue-600 ml-2"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Map container */}
      <div className="relative w-full flex-1">
        <MapContainer
          key={`map-${mapKey}`}
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
          <div className="absolute right-4 top-4 z-[1000] flex flex-col gap-2">
            <Button
              variant="outline"
              size="sm"
              className={`h-8 border-0 bg-white hover:bg-gray-100 ${
                showNearbySessions ? 'border border-blue' : 'border border-transparent'
              }`}
              onClick={() => {
                setShowNearbySessions(!showNearbySessions)
                if (!showNearbySessions) {
                  fetchNearbySessions()
                  setIsNearbySessionsDialogOpen(true)
                }
              }}
            >
              <Users className="h-4 w-4" />
              {showNearbySessions ? 'Hide Sessions' : 'Show Sessions'}
            </Button>
            <Select
              value={mapType}
              onValueChange={(value: 'satellite' | 'street') => setMapType(value)}
            >
              <SelectTrigger className="w-[140px] bg-white/90 backdrop-blur-sm">
                <SelectValue placeholder="Map Type" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                sideOffset={5}
                align="end"
                className="z-[1000]"
                style={{ zIndex: 1000 }}
              >
                <SelectItem value="street">Street View</SelectItem>
                <SelectItem value="satellite">Satellite</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 border-0 bg-white text-black hover:bg-gray-100"
              onClick={toggleFullscreen}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>

          {/* Nearby Sessions Markers */}
          {showNearbySessions && (
            <>
              {isLoadingNearbySessions ? (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/50">
                  <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900"></div>
                </div>
              ) : (
                nearbySessions.map((session) => {
                  const point = points.find((p) => p.id === session.spotId)
                  if (!point) return null
                  return (
                    <Marker
                      key={session.id}
                      position={session.coordinates}
                      icon={createMarkerIcon(true)}
                      eventHandlers={{
                        popupopen: () => {
                          handlePopupOpen(point.id)
                        },
                        add: (e) => {
                          const markerElement = e.target.getElement()
                          if (markerElement) {
                            markerElement.setAttribute('data-lat', point.coordinates[0].toString())
                            markerElement.setAttribute('data-lng', point.coordinates[1].toString())
                            markerElement.setAttribute('data-spot-id', point.id)
                          }
                        },
                      }}
                    >
                      <Popup className="max-w-[90vw] md:max-w-[300px]">
                        <div className="p-2">{renderPopupContent(point)}</div>
                      </Popup>
                    </Marker>
                  )
                })
              )}
            </>
          )}

          {isLoadingPoints ? (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/50">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900"></div>
            </div>
          ) : (
            points.map((point) => {
              const hasActiveSession = nearbySessions.some((session) => session.spotId === point.id)
              return (
                <Marker
                  key={point.id}
                  position={point.coordinates}
                  icon={createMarkerIcon(hasActiveSession)}
                  eventHandlers={{
                    popupopen: () => {
                      handlePopupOpen(point.id)
                    },
                    add: (e) => {
                      const markerElement = e.target.getElement()
                      if (markerElement) {
                        markerElement.setAttribute('data-lat', point.coordinates[0].toString())
                        markerElement.setAttribute('data-lng', point.coordinates[1].toString())
                        markerElement.setAttribute('data-spot-id', point.id)
                      }
                    },
                  }}
                >
                  <Popup className="max-w-[90vw] md:max-w-[300px]">
                    <div className="p-2">{renderPopupContent(point)}</div>
                  </Popup>
                </Marker>
              )
            })
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
                              {editingComment?.id === comment.id ? (
                                <div className="flex-1 space-y-2">
                                  <Textarea
                                    value={editingComment.content}
                                    onChange={(e) =>
                                      setEditingComment((prev) =>
                                        prev ? { ...prev, content: e.target.value } : null,
                                      )
                                    }
                                    className="min-h-[100px]"
                                    disabled={isEditingComment}
                                  />
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      onClick={() =>
                                        selectedSpotId &&
                                        handleEditComment(selectedSpotId, comment.id)
                                      }
                                      disabled={!editingComment.content.trim() || isEditingComment}
                                    >
                                      {isEditingComment ? (
                                        <>
                                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                          Saving...
                                        </>
                                      ) : (
                                        'Save'
                                      )}
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setEditingComment(null)}
                                      disabled={isEditingComment}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-gray-700">{comment.content}</p>
                              )}
                              {(comment.createdBy === user.primaryEmailAddress?.emailAddress ||
                                isAdmin) && (
                                <div className="flex gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-blue-500 hover:text-blue-700"
                                    onClick={() =>
                                      setEditingComment({
                                        id: comment.id,
                                        content: comment.content,
                                      })
                                    }
                                  >
                                    Edit
                                  </Button>
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
                                </div>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-gray-500">
                              {comment.updatedAt
                                ? `Updated ${formatDistanceToNow(comment.updatedAt, { addSuffix: true })}`
                                : `Posted ${formatDistanceToNow(comment.createdAt, { addSuffix: true })}`}
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
              <LocationNameInput
                value={newPointName}
                onChange={handleNameChange}
                disabled={isAddingPoint}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="type">Location Type</Label>
              <Select
                value={newPointType}
                onValueChange={(value: 'street' | 'park' | 'diy') => setNewPointType(value)}
                disabled={isAddingPoint}
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
            <Button onClick={handleAddPoint} className="w-full" disabled={isAddingPoint}>
              {isAddingPoint ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding Location...
                </>
              ) : (
                'Add Location'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Report Dialog */}
      <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
        <DialogContent className="z-[9999] w-[90vw] sm:max-w-[425px]">
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
        <DialogContent className="z-[9999] max-h-[52vh] w-[90vw] md:max-h-[80vh] md:max-w-[800px]">
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
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {adminReports.length} reports pending review
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDenyAllReports}
                    disabled={isDenyingAll || adminReports.length === 0}
                  >
                    {isDenyingAll ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Denying All...
                      </>
                    ) : (
                      <>
                        <X className="mr-2 h-4 w-4" />
                        Deny All Reports
                      </>
                    )}
                  </Button>
                </div>
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
                        <div className="flex gap-2">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleUpdateReportStatus(report.id, 'accept')}
                            disabled={isUpdatingReport[report.id]}
                          >
                            {isUpdatingReport[report.id] ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Removing...
                              </>
                            ) : (
                              'Remove Spot'
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUpdateReportStatus(report.id, 'deny')}
                            disabled={isUpdatingReport[report.id]}
                          >
                            {isUpdatingReport[report.id] ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Denying...
                              </>
                            ) : (
                              'Deny Report'
                            )}
                          </Button>
                        </div>
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
      <EditProposalDialog
        isOpen={isEditProposalDialogOpen}
        onOpenChange={setIsEditProposalDialogOpen}
        spotToEdit={spotToEdit}
        onSubmit={async (proposedName, proposedType, editReason) => {
          if (!spotToEdit) return
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
        }}
        isSubmitting={isSubmittingProposal}
      />

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
          onCreateMeetup={async (meetup) => {
            try {
              await handleCreateMeetup(meetup)
            } catch (error) {
              console.error('Error creating meetup:', error)
            }
          }}
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

      {/* Nearby Sessions Dialog */}
      <Dialog open={isNearbySessionsDialogOpen} onOpenChange={setIsNearbySessionsDialogOpen}>
        <DialogContent className="mt-7 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Nearby Skate Sessions
            </DialogTitle>
            <DialogDescription>Find and join skate sessions near you</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {nearbySessions.length} active sessions found
            </div>
            <ScrollArea className="h-[400px] rounded-md border p-4">
              {nearbySessions.length === 0 ? (
                <div className="text-center text-muted-foreground">
                  No active sessions found nearby
                </div>
              ) : (
                nearbySessions.map((session) => (
                  <Card key={session.id} className="mb-4">
                    <CardHeader>
                      <CardTitle className="text-lg">{session.title}</CardTitle>
                      <CardDescription>
                        {session.spotName} • Created by {session.createdByName}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{session.description}</p>
                      <div className="mt-2 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {formatDistanceToNow(session.date, { addSuffix: true })}
                        </span>
                        <span className="text-muted-foreground">
                          {(session.distance * 0.621371).toFixed(1)} miles away
                        </span>
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          setSelectedSpotForMeetup({
                            id: session.spotId,
                            name: session.spotName,
                          })
                          setIsMeetupsListDialogOpen(true)
                          getMeetups(session.spotId).then(setMeetups)
                        }}
                      >
                        View Details
                      </Button>
                    </CardFooter>
                  </Card>
                ))
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
