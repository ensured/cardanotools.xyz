'use client'

import { toast } from 'sonner'
import React from 'react'
import { useEffect, useState, useRef } from 'react'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
  useMap,
  ZoomControl,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import '@/styles/map.css'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import debounce from 'lodash/debounce'
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
  Users,
  Calendar,
  RefreshCw,
  Settings,
  FileEdit,
  Trash,
  MessageSquare,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react'
import { importSpots } from '@/app/actions/import-spots'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { MeetupDialog } from './MeetupDialog'
import { MeetupsList } from './MeetupsList'
import {
  createMeetup,
  getMeetups,
  joinMeetup,
  leaveMeetup,
  deleteMeetup,
} from '@/app/actions/meetups'
import { useVirtualizer } from '@tanstack/react-virtual'
import MarkerClusterGroup from 'react-leaflet-cluster'
import {
  getReports,
  getProposals,
  submitEditProposal,
  updateProposalStatus,
} from '@/app/actions/admin'
import { isAdmin } from '@/lib/hooks/isAdmin'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { DeleteAllSpotsDialog } from '@/components/DeleteAllSpotsDialog'
// Import LeafletMouseEvent type
import type { LeafletMouseEvent } from 'leaflet'
import { ImportSpotsButton } from '@/app/components/ImportSpotsButton'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreVertical, Edit2, Trash2 } from 'lucide-react'

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
    className: `custom-marker-icon ${hasActiveSession ? 'active-session' : ''}`,
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
  description?: string
  lastUpdated?: number // Add this field to track updates
}

interface LocationMarkerProps {
  onLocationSelect: (lat: number, lng: number) => void
}

interface Comment {
  id: string
  content: string
  createdBy: string
  createdByName: string
  createdAt: number
  updatedAt?: number
  imageUrl?: string // Add this field to store commenter's profile image
}

interface LikeStatus {
  email: string
  name: string
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
  status: 'pending' | 'reviewed' | 'resolved' | 'rejected'
  spotId: string
  spotName?: string
  userEmail?: string
}

interface SearchResult {
  display_name: string
  lat: number
  lon: number
  type?: string
  address?: {
    city?: string
    town?: string
    village?: string
    suburb?: string
    neighbourhood?: string
    postcode?: string
  }
}

interface EditProposal {
  id: string
  spotId: string
  userId: string
  userEmail: string
  proposedName: string
  proposedType: 'street' | 'park' | 'diy'
  proposedDescription?: string
  reason: string
  createdAt: number
  status: 'pending' | 'approved' | 'rejected'
  adminNotes?: string
  spotName: string
  currentName: string
  currentType: 'street' | 'park' | 'diy'
  currentDescription?: string
}

interface NearbyMeetup {
  id: string
  title: string
  description: string
  date: number
  spotId: string
  spotName: string
  createdBy: string
  createdByEmail: string
  createdAt: number
  participants: string[]
  createdByName: string
  coordinates: [number, number]
  distance: number
}

// Component to handle map center updates
function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    // Only update the view if the coordinates or zoom level have actually changed
    // This prevents the map from resetting on popup opens
    if (
      map.getCenter().lat !== center[0] ||
      map.getCenter().lng !== center[1] ||
      map.getZoom() !== zoom
    ) {
      map.setView(center, zoom)
    }
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
        !target.closest('.search-results-container') && // Update this class name
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
    proposedDescription: string,
    editReason: string,
  ) => Promise<void>
  isSubmitting: boolean
}) {
  const [proposedName, setProposedName] = useState(spotToEdit?.name || '')
  const [proposedType, setProposedType] = useState<'street' | 'park' | 'diy'>(
    spotToEdit?.type || 'street',
  )
  const [proposedDescription, setProposedDescription] = useState(spotToEdit?.description || '')
  const [editReason, setEditReason] = useState('')

  // Reset form when spotToEdit changes
  useEffect(() => {
    if (spotToEdit) {
      setProposedName(spotToEdit.name)
      setProposedType(spotToEdit.type)
      setProposedDescription(spotToEdit.description || '')
      setEditReason('')
    }
  }, [spotToEdit])

  const handleSubmit = async () => {
    if (!proposedName || !proposedType || !editReason) return
    await onSubmit(proposedName, proposedType, proposedDescription, editReason)
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
            <Label htmlFor="proposedDescription">Proposed Description</Label>
            <Textarea
              id="proposedDescription"
              value={proposedDescription}
              onChange={(e) => setProposedDescription(e.target.value)}
              placeholder="Enter a description of this spot (optional)"
              className="min-h-[80px]"
            />
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

// Add this new component before the Map component
const SearchResults = React.memo(
  ({
    results,
    onSelect,
    isLoading,
  }: {
    results: SearchResult[]
    onSelect: (lat: number, lon: number) => void
    isLoading: boolean
  }) => {
    const parentRef = useRef<HTMLDivElement>(null)
    const rowVirtualizer = useVirtualizer({
      count: results.length,
      getScrollElement: () => parentRef.current,
      estimateSize: () => 40,
      overscan: 5,
    })

    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      )
    }

    return (
      <div ref={parentRef} className="h-[200px]">
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const result = results[virtualRow.index]
            return (
              <div
                key={`${result.lat}-${result.lon}`}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <CommandItem
                  value={result.display_name}
                  onSelect={() => onSelect(result.lat, result.lon)}
                  className="h-full cursor-pointer px-2 py-2 hover:bg-gray-100"
                >
                  <Search className="mt-1 h-4 w-4 shrink-0" />
                  <span className="flex-1 whitespace-normal break-words">
                    {result.display_name}
                  </span>
                </CommandItem>
              </div>
            )
          })}
        </div>
      </div>
    )
  },
)

SearchResults.displayName = 'SearchResults'

// Update the PopupContent component to receive the state setters
const PopupContent = React.memo(
  ({
    point,
    onPopupOpen,
    onDelete,
    onReport,
    onEdit,
    onLike,
    onComment,
    onMeetup,
    isDeleting,
    isReporting,
    isLoadingAddress,
    likes,
    isLoadingLikes,
    isLoadingComments,
    hasActiveSession,
    user,
    isAdmin,
    proposals,
    activeReports,
    commentCounts,
    setSpotToDelete,
    setIsDeleteConfirmOpen,
  }: {
    point: MapPoint
    onPopupOpen: (id: string) => void
    onDelete: (id: string) => void
    onReport: (id: string) => void
    onEdit: (point: MapPoint) => void
    onLike: (id: string, status: 'like' | 'dislike' | null) => void
    onComment: () => void
    onMeetup: () => void
    isDeleting: boolean
    isReporting: boolean
    isLoadingAddress: boolean
    likes: LikeStatus[]
    isLoadingLikes: boolean
    isLoadingComments: boolean
    hasActiveSession: boolean
    user: any
    isAdmin: boolean
    proposals: EditProposal[]
    activeReports: Report[]
    commentCounts: number
    setSpotToDelete: (spot: MapPoint | null) => void
    setIsDeleteConfirmOpen: (open: boolean) => void
  }) => {
    // Add function to generate Google Maps directions URL
    const getGoogleMapsDirectionsUrl = () => {
      const { coordinates } = point
      return `https://www.google.com/maps/dir/?api=1&destination=${coordinates[0]},${coordinates[1]}`
    }

    // Is social data loading
    const isSocialLoading = isLoadingLikes || isLoadingComments

    return (
      <div className="space-y-2">
        <h3 className="font-semibold">{point.name}</h3>
        <p className="text-sm text-gray-600">{point.type}</p>
        {point.description && (
          <p className="border-l-2 border-gray-300 pl-2 text-sm italic text-gray-700">
            {point.description}
          </p>
        )}
        {isLoadingAddress ? (
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
              onMeetup()
            }}
          >
            <div className="h-4 w-4 rounded-full bg-purple-500 text-purple-500"></div>
            Skate Sessions
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation()
              window.open(getGoogleMapsDirectionsUrl(), '_blank')
            }}
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
              <path d="M12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
            </svg>
            Directions
          </Button>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <Settings className="mr-1 h-4 w-4" />
              Spot Actions
              <ChevronDown className="ml-1 h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-0">
            <div className="flex flex-col">
              <Button
                variant="ghost"
                size="sm"
                className="flex w-full justify-start rounded-none"
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit(point)
                }}
              >
                <Edit className="mr-2 h-4 w-4" />
                Propose Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="flex w-full justify-start rounded-none"
                onClick={(e) => {
                  e.stopPropagation()
                  onReport(point.id)
                }}
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                Report
              </Button>

              {(point.createdBy === user!.primaryEmailAddress?.emailAddress || isAdmin) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex w-full justify-start rounded-none text-red-500 hover:bg-red-50 hover:text-red-600"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSpotToDelete(point)
                    setIsDeleteConfirmOpen(true)
                  }}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash className="mr-2 h-4 w-4" />
                      Delete Spot
                    </>
                  )}
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {proposals?.filter((p) => p.status === 'pending').length > 0 && (
          <div className="mt-2 rounded-md border border-yellow-200 bg-yellow-50 p-0.5">
            <p className="text-sm text-yellow-800">⚠️ This spot has pending edit proposals</p>
            <p className="mt-1 text-xs text-yellow-600">
              {proposals.filter((p) => p.status === 'pending').length} proposal
              {proposals.filter((p) => p.status === 'pending').length !== 1 ? 's' : ''}
            </p>
          </div>
        )}

        {activeReports?.length > 0 && (
          <div className="mt-2 rounded-md border border-yellow-200 bg-yellow-50 p-0.5">
            <p className="text-sm text-yellow-800">⚠️ This spot has been reported for removal</p>
            <p className="mt-1 text-xs text-yellow-600">
              {activeReports.length} report{activeReports.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}

        {isSocialLoading ? (
          <div className="mt-2 flex justify-center py-2">
            <div className="flex flex-col items-center gap-1">
              <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
            </div>
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap items-center justify-evenly gap-2">
            <Button
              variant="ghost"
              size="sm"
              className={`flex items-center gap-1 ${likes?.find((l) => l.email === user?.primaryEmailAddress?.emailAddress)?.status === 'like' ? 'text-green-500' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                onLike(
                  point.id,
                  likes?.find((l) => l.email === user?.primaryEmailAddress?.emailAddress)
                    ?.status === 'like'
                    ? null
                    : 'like',
                )
              }}
            >
              <ThumbsUp className="animate-thumb-click h-4 w-4 transition-transform duration-200" />
              <span>{likes?.filter((l) => l.status === 'like').length || 0}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`flex items-center gap-1 ${likes?.find((l) => l.email === user?.primaryEmailAddress?.emailAddress)?.status === 'dislike' ? 'text-red-500' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                onLike(
                  point.id,
                  likes?.find((l) => l.email === user?.primaryEmailAddress?.emailAddress)
                    ?.status === 'dislike'
                    ? null
                    : 'dislike',
                )
              }}
            >
              <ThumbsDown className="animate-thumb-click h-4 w-4 transition-transform duration-200" />
              <span>{likes?.filter((l) => l.status === 'dislike').length || 0}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-1"
              onClick={(e) => {
                e.stopPropagation()
                onComment()
              }}
            >
              <MessageSquare className="h-4 w-4" />
              Comments ({commentCounts})
            </Button>
          </div>
        )}
      </div>
    )
  },
)

PopupContent.displayName = 'PopupContent'

// Add this new component before the Map component
const DescriptionInput = React.memo(
  ({
    value,
    onChange,
    disabled,
  }: {
    value: string
    onChange: (value: string) => void
    disabled?: boolean
  }) => {
    const inputRef = React.useRef<HTMLTextAreaElement>(null)
    const localValueRef = React.useRef(value)

    React.useEffect(() => {
      if (inputRef.current && value !== localValueRef.current) {
        inputRef.current.value = value
        localValueRef.current = value
      }
    }, [value])

    return (
      <Textarea
        ref={inputRef}
        id="description"
        defaultValue={value}
        onBlur={(e) => {
          const newValue = e.target.value
          if (newValue !== localValueRef.current) {
            localValueRef.current = newValue
            onChange(newValue)
          }
        }}
        placeholder="Enter a description of this spot"
        className="min-h-[80px]"
        disabled={disabled}
      />
    )
  },
  (prevProps, nextProps) => {
    return prevProps.disabled === nextProps.disabled && prevProps.value === nextProps.value
  },
)
DescriptionInput.displayName = 'DescriptionInput'

export default function Map() {
  const { user, isLoaded } = useUser()
  const [points, setPoints] = useState<MapPoint[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(
    null,
  )
  const [newPointName, setNewPointName] = useState('')
  const [newPointType, setNewPointType] = useState<'street' | 'park' | 'diy'>('street')
  const [newPointDescription, setNewPointDescription] = useState('')
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
  const [activeReports, setActiveReports] = useState<Record<string, Report[]>>({})
  const [isLoadingActiveReports, setIsLoadingActiveReports] = useState<Record<string, boolean>>({})
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<{
    success: boolean
    message: string
    count?: number
  } | null>(null)
  const [isReportsDialogOpen, setIsReportsDialogOpen] = useState(false)
  const [adminReports, setAdminReports] = useState<AdminReport[]>([])
  const [isLoadingAdminReports, setIsLoadingAdminReports] = useState(false)
  const [isUpdatingReport, setIsUpdatingReport] = useState<Record<string, boolean>>({})
  const [isUpdatingProposal, setIsUpdatingProposal] = useState<Record<string, boolean>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout>()
  const searchCache = useRef<Record<string, SearchResult[]>>({})
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
  const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours
  const STALE_WHILE_REVALIDATE = 2 * 24 * 60 * 60 * 1000 // 48 hours
  const [isCacheValid, setIsCacheValid] = useState(true)
  const [userState, setUserState] = useState<string | null>(null)
  const [userStateBounds, setUserStateBounds] = useState<{
    north: number
    south: number
    east: number
    west: number
  } | null>(null)
  const mapMoveTimeoutRef = useRef<NodeJS.Timeout>()
  // Add this near the top of the component with other state declarations
  const [clusterKey, setClusterKey] = useState(0)
  const [isAdminReportsDialogOpen, setIsAdminReportsDialogOpen] = useState(false)
  const [isUserAdmin, setIsUserAdmin] = useState(false)
  const STORAGE_KEY = 'map_points_cache'
  const STORAGE_TIMESTAMP_KEY = 'map_points_cache_timestamp'

  // Add cache for nearby sessions
  const nearbySessionsCache = useRef<{
    lat: number
    lng: number
    radius: number
    timestamp: number
    sessions: NearbyMeetup[]
  } | null>(null)

  // Define cache duration in milliseconds (5 minutes)
  const SESSION_CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

  // Add state for the spot to delete confirmation
  const [spotToDelete, setSpotToDelete] = useState<MapPoint | null>(null)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)

  // Add function to handle map move end
  const handleMapMoveEnd = async () => {
    if (!mapRef.current) return

    const center = mapRef.current.getCenter()
    const state = await getStateFromCoordinates(center.lat, center.lng)

    if (state && state !== userState) {
      setUserState(state)
      const bounds = await getStateBounds(state)
      if (bounds) {
        setUserStateBounds(bounds)
      }
    }
  }

  // Add effect to handle map move events
  useEffect(() => {
    if (!mapRef.current) return

    const handleMoveStart = () => {
      // Clear any existing timeout
      if (mapMoveTimeoutRef.current) {
        clearTimeout(mapMoveTimeoutRef.current)
      }
    }

    const handleMoveEnd = () => {
      // Set a new timeout
      mapMoveTimeoutRef.current = setTimeout(handleMapMoveEnd, 1500) // 1.5 seconds delay
    }

    mapRef.current.on('movestart', handleMoveStart)
    mapRef.current.on('moveend', handleMoveEnd)

    return () => {
      if (mapRef.current) {
        mapRef.current.off('movestart', handleMoveStart)
        mapRef.current.off('moveend', handleMoveEnd)
      }
      if (mapMoveTimeoutRef.current) {
        clearTimeout(mapMoveTimeoutRef.current)
      }
    }
  }, [mapRef.current])

  // Remove debounced handler and use direct state update
  const handleNameChange = (value: string) => {
    setNewPointName(value)
  }

  // Add a similar handler for description field
  const handleDescriptionChange = (value: string) => {
    setNewPointDescription(value)
  }

  // Add a similar handler for report reason field
  const handleReportReasonChange = (value: string) => {
    setReportReason(value)
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

  // Add function to get state from coordinates
  const getStateFromCoordinates = async (lat: number, lon: number) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'en-US,en;q=0.9',
          },
        },
      )
      if (response.ok) {
        const data = await response.json()
        // Check if address exists and has state property
        if (data.address && data.address.state) {
          return data.address.state
        }
        // If no state, try to get country or region
        if (data.address && (data.address.country || data.address.region)) {
          return data.address.country || data.address.region
        }
      }
      return null
    } catch (error) {
      console.error('Error getting state:', error)
      return null
    }
  }

  // Add function to get state bounds
  const getStateBounds = async (state: string) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(state)}, USA&limit=1&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'en-US,en;q=0.9',
          },
        },
      )
      if (response.ok) {
        const data = await response.json()
        if (data[0]) {
          // Get the bounding box for the state
          const bbox = data[0].boundingbox
          return {
            south: parseFloat(bbox[0]),
            north: parseFloat(bbox[1]),
            west: parseFloat(bbox[2]),
            east: parseFloat(bbox[3]),
          }
        }
      }
      return null
    } catch (error) {
      console.error('Error getting state bounds:', error)
      return null
    }
  }

  // Update the geolocation effect to get state
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords
          setUserLocation([latitude, longitude])
          setZoom(13) // Zoom in to city level
          setShowNearbySessions(true) // Automatically show sessions on load/location found

          // Get user's state
          const state = await getStateFromCoordinates(latitude, longitude)
          if (state) {
            setUserState(state)
            // Get state bounds
            const bounds = await getStateBounds(state)
            if (bounds) {
              setUserStateBounds(bounds)
            }
          }
        },
        (error) => {
          console.error('Error getting location:', error)
        },
      )
    }
  }, [])

  // Update the search effect
  useEffect(() => {
    const searchLocation = async () => {
      if (!searchQuery.trim() || searchQuery.trim().length < 3) {
        setSearchResults([])
        return
      }

      // Use simple query for cache key
      const cacheKey = searchQuery.trim()
      if (searchCache.current[cacheKey]) {
        setSearchResults(searchCache.current[cacheKey])
        return
      }

      setIsSearching(true)
      try {
        let query = searchQuery.trim()
        const isZipCode = /^\d{5}(-\d{4})?$/.test(query) // Regex for US zip codes (5 or 5+4 digits)

        let searchUrlParams = new URLSearchParams()

        if (isZipCode) {
          // Use structured query for zip codes
          searchUrlParams.set('format', 'json')
          searchUrlParams.set('postalcode', query)
          searchUrlParams.set('country', 'USA') // Assume US zip codes for now
          searchUrlParams.set('limit', '5') // Limit results for zip codes, usually only one expected
          searchUrlParams.set('addressdetails', '1')
        } else {
          // Add "skatepark" to query if it's not already there to improve skatepark matches
          const isSearchingForSkatepark =
            /(skate|skating|skatepark|park|bowl)/i.test(query) &&
            !/(school|restaurant|mall)/i.test(query)

          // Use general query for other searches
          searchUrlParams.set('format', 'json')
          searchUrlParams.set('q', query)
          searchUrlParams.set('limit', '20')
          searchUrlParams.set('addressdetails', '1')
          searchUrlParams.set('extratags', '1')

          // Add specialized search for skateparks
          if (isSearchingForSkatepark) {
            // Try a second search specifically for skateparks
            const skateparkParams = new URLSearchParams()
            skateparkParams.set('format', 'json')
            skateparkParams.set('q', `${query} skatepark`)
            skateparkParams.set('limit', '10')
            skateparkParams.set('addressdetails', '1')
            skateparkParams.set('extratags', '1')
          }
        }

        let searchUrl = `https://nominatim.openstreetmap.org/search?${searchUrlParams.toString()}`

        const response = await fetch(searchUrl, {
          headers: {
            'Accept-Language': 'en-US,en;q=0.9',
          },
        })

        if (!response.ok) {
          throw new Error('Search failed')
        }

        const data = await response.json()

        // Try a second search specifically for skateparks if we didn't get skatepark results
        let combinedResults = [...data]

        const hasSkatepark = data.some(
          (result: SearchResult) =>
            result.display_name.toLowerCase().includes('skate') ||
            (result.type && result.type.toLowerCase().includes('leisure')),
        )

        if (!hasSkatepark && !isZipCode && data.length < 5) {
          try {
            const skateparkParams = new URLSearchParams()
            skateparkParams.set('format', 'json')
            skateparkParams.set('q', `${query} skatepark`)
            skateparkParams.set('limit', '10')
            skateparkParams.set('addressdetails', '1')

            const skateparkResponse = await fetch(
              `https://nominatim.openstreetmap.org/search?${skateparkParams.toString()}`,
              {
                headers: {
                  'Accept-Language': 'en-US,en;q=0.9',
                },
              },
            )

            if (skateparkResponse.ok) {
              const skateparkData = await skateparkResponse.json()
              combinedResults = [...data, ...skateparkData]
            }
          } catch (error) {
            console.error('Error fetching skatepark results:', error)
          }
        }

        // Prioritize results:
        // 1. Skateparks first
        // 2. Then results with the query term in the name
        // 3. Then by default Nominatim relevance
        const prioritizedResults = combinedResults.sort((a: SearchResult, b: SearchResult) => {
          const aIsSkatepark =
            a.display_name.toLowerCase().includes('skate') ||
            (a.type && a.type.toLowerCase().includes('leisure'))

          const bIsSkatepark =
            b.display_name.toLowerCase().includes('skate') ||
            (b.type && b.type.toLowerCase().includes('leisure'))

          if (aIsSkatepark && !bIsSkatepark) return -1
          if (!aIsSkatepark && bIsSkatepark) return 1

          // Next priority: exact name match
          const queryLower = query.toLowerCase()
          const aHasExactMatch = a.display_name.toLowerCase().includes(queryLower)
          const bHasExactMatch = b.display_name.toLowerCase().includes(queryLower)

          if (aHasExactMatch && !bHasExactMatch) return -1
          if (!aHasExactMatch && bHasExactMatch) return 1

          return 0 // Let Nominatim handle the rest of the sorting
        })

        // Filter out duplicates based on display_name
        const uniqueResults = prioritizedResults.filter(
          (result: SearchResult, index: number, self: SearchResult[]) =>
            index === self.findIndex((r: SearchResult) => r.display_name === result.display_name),
        )

        if (uniqueResults.length === 0) {
          toast.error('No locations found. Try a different search term.')
        }

        searchCache.current[cacheKey] = uniqueResults
        setSearchResults(uniqueResults)
      } catch (error) {
        console.error('Error searching location:', error)
        setSearchResults([])
        toast.error('Failed to search location. Please try again.')
      } finally {
        setIsSearching(false)
      }
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Increase debounce time to give users more time to type
    searchTimeoutRef.current = setTimeout(searchLocation, 800)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
    // Simplified dependencies: only trigger on query change
  }, [searchQuery])

  const handleLocationSelect = (lat: number, lon: number) => {
    setSelectedLocation({ lat, lng: lon })
    setIsDialogOpen(true)
  }

  // Add function to handle search result selection
  const handleSearchResultSelect = (lat: number, lon: number, displayName: string) => {
    setUserLocation([lat, lon])

    // Zoom in closer for better spot placement precision
    setZoom(18) // Zoom in to a closer level (street level)

    // Check if this is likely a skatepark based on the name
    const isLikelySkatepark = /skate|skating|park|bowl/i.test(displayName)

    // Clear the search UI
    setSearchQuery('')
    setSearchResults([])

    // If it's likely a skatepark, offer to add it as a spot
    if (isLikelySkatepark) {
      // Set a timeout to allow the map to zoom/pan first
      setTimeout(() => {
        // Extract a name for the skatepark
        let spotName = 'Skate Spot'
        const nameMatch = displayName.match(/^(.*?)(?:,|$)/)
        if (nameMatch && nameMatch[1]) {
          spotName = nameMatch[1].trim()
        }

        // Pre-fill the spot name and open the dialog
        setSelectedLocation({ lat, lng: lon })
        setNewPointName(spotName)
        setNewPointType('park') // Default to park for skateparks
        setIsDialogOpen(true)

        toast.success(`Found "${spotName}". You can now add it as a skate spot!`)
      }, 500)
    } else {
      toast.info('Location found! Click on the map to add a skate spot here.')
    }
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
    setIsLoadingPoints(true)

    try {
      // First try to use localStorage cache
      const storedData = localStorage.getItem(STORAGE_KEY)
      const storedTimestamp = localStorage.getItem(STORAGE_TIMESTAMP_KEY)

      if (!forceRefresh && storedData && storedTimestamp) {
        const timestamp = parseInt(storedTimestamp, 10)
        const isStale = now - timestamp > CACHE_DURATION
        const isTooOld = now - timestamp > STALE_WHILE_REVALIDATE

        // If data is not too old, use it immediately
        if (!isTooOld) {
          const parsedPoints = JSON.parse(storedData)
          setPoints(parsedPoints)
          pointsCache.current = parsedPoints

          // If data is stale but not too old, use it but refresh in background
          if (isStale) {
            fetchPoints(true).catch(console.error)
          }

          setIsLoadingPoints(false)
          return
        }
      }

      // If no cache or cache too old, fetch fresh data
      const response = await fetch('/api/points', {
        headers: {
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      })

      if (response.ok) {
        const data = await response.json()
        setPoints(data)
        pointsCache.current = data

        // Update localStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
        localStorage.setItem(STORAGE_TIMESTAMP_KEY, now.toString())
      }
    } catch (error) {
      console.error('Error fetching points:', error)
    } finally {
      setIsLoadingPoints(false)
    }
  }

  // Update useEffect to use the new fetchPoints function with cache expiration check
  useEffect(() => {
    if (isMounted) {
      // If the cache is invalid, force a refresh, otherwise use cache if available
      fetchPoints(!isCacheValid)

      // Set up periodic cache check
      const interval = setInterval(() => {
        const now = Date.now()
        const lastFetch = parseInt(localStorage.getItem(STORAGE_TIMESTAMP_KEY) || '0', 10)

        // If cache is expired or manually invalidated, force refresh
        if (now - lastFetch > CACHE_DURATION || !isCacheValid) {
          fetchPoints(true)
          // Reset cache validity after forced refresh
          setIsCacheValid(true)
        }
      }, CACHE_DURATION / 2) // Check halfway through cache lifetime

      return () => clearInterval(interval)
    }
  }, [isMounted, isCacheValid]) // Add isCacheValid as a dependency

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
  const handleAddPoint = async (e: LeafletMouseEvent | React.MouseEvent) => {
    // For button click, we need to check if there's a selected location
    if (!('latlng' in e) && !selectedLocation) {
      toast.error('Please select a location on the map first')
      return
    }

    // Set isAddingPoint to true at the beginning to show loading state
    setIsAddingPoint(true)

    try {
      // Get coordinates - either from Leaflet event or use the selected location
      let coordinates: [number, number]
      if ('latlng' in e) {
        // This is a LeafletMouseEvent
        const latlng = e.latlng
        coordinates = [latlng.lat, latlng.lng]
      } else if (selectedLocation) {
        // This is a button click, use the selectedLocation
        coordinates = [selectedLocation.lat, selectedLocation.lng]
      } else {
        throw new Error('No location selected')
      }

      // Create a temporary spot ID to use until we get the real one from the API
      const tempSpotId = Math.random().toString(36).substring(2, 15)

      // Add the new point to our state so it appears immediately
      const newPoint: MapPoint = {
        id: tempSpotId,
        name: newPointName || 'New Spot',
        coordinates,
        type: newPointType || 'street',
        description: newPointDescription || undefined,
        createdBy: user?.primaryEmailAddress?.emailAddress || '',
        lastUpdated: Date.now(),
      }

      // Add the new point to the map
      setPoints((prevPoints) => [...prevPoints, newPoint])

      // Update points cache
      pointsCache.current = [...pointsCache.current, newPoint]

      // Force the cluster group to re-render
      setClusterKey((prev) => prev + 1)

      // Submit the new point to the API
      const response = await fetch('/api/points', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newPointName || 'New Spot',
          coordinates,
          type: newPointType || 'street',
          description: newPointDescription || undefined,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to add point')
      }

      const responseData = await response.json()
      const realSpotId = responseData.id

      // Update our temporary point with the real ID
      setPoints((prevPoints) =>
        prevPoints.map((p) => (p.id === tempSpotId ? { ...p, id: realSpotId } : p)),
      )

      // Update pointsCache as well
      pointsCache.current = pointsCache.current.map((p) =>
        p.id === tempSpotId ? { ...p, id: realSpotId } : p,
      )

      // Update localStorage with the new points
      try {
        const updatedPoints = pointsCache.current
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedPoints))
        localStorage.setItem(STORAGE_TIMESTAMP_KEY, Date.now().toString())
      } catch (error) {
        console.error('Error updating localStorage after adding new point:', error)
      }

      // Show success message
      toast.success('Your new map point has been added successfully.')

      // Reset the spot name, type, and description
      setNewPointName('')
      setNewPointType('street')
      setNewPointDescription('')

      // No need to invalidate cache or force a refresh - we've already updated the local state
      // This prevents unnecessary reloading of all spots after adding a new one
    } catch (error) {
      console.error('Error adding point:', error)
      toast.error('Failed to add point. Please try again.')
    } finally {
      setIsLoadingPoints(false)
      setIsAddingPoint(false)
      // Close the dialog after successfully adding a point
      setIsDialogOpen(false)
    }
  }

  // Update the handleDeletePoint function to return success status
  const handleDeletePoint = async (pointId: string): Promise<boolean> => {
    if (!user) return false

    // Optimistic update
    setIsDeletingPoint((prev) => ({ ...prev, [pointId]: true }))
    const deletedPoint = points.find((p) => p.id === pointId)
    if (!deletedPoint) return false

    // Create a new array without the deleted point
    const newPoints = points.filter((p) => p.id !== pointId)
    setPoints(newPoints)
    pointsCache.current = newPoints
    setClusterKey((prev) => prev + 1) // Force cluster group to re-render

    try {
      const response = await fetch(`/api/points/${pointId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        // Revert optimistic update on error
        setPoints((prevPoints) => [...prevPoints, deletedPoint])
        pointsCache.current = [...pointsCache.current, deletedPoint]
        setClusterKey((prev) => prev + 1) // Force cluster group to re-render
        toast.error('Failed to delete point. Please try again.')
        return false
      } else {
        // Invalidate cache on successful deletion
        setIsCacheValid(false)

        // Update localStorage with the new points array (without the deleted point)
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newPoints))
          localStorage.setItem(STORAGE_TIMESTAMP_KEY, Date.now().toString())
        } catch (error) {
          console.error('Error updating localStorage after deletion:', error)
        }

        toast.success('Spot deleted successfully')
        return true
      }
    } catch (error) {
      // Revert optimistic update on error
      setPoints((prevPoints) => [...prevPoints, deletedPoint])
      pointsCache.current = [...pointsCache.current, deletedPoint]
      setClusterKey((prev) => prev + 1) // Force cluster group to re-render
      console.error('Error deleting point:', error)
      toast.error('An error occurred. Please try again.')
      return false
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

  // First, fix the handleAddComment function to properly maintain the commenter order
  const handleAddComment = async (spotId: string) => {
    if (!newComment.trim()) return
    if (!user) {
      toast.error('Please sign in to add a comment')
      return
    }

    setIsAddingComment(true)

    try {
      const response = await fetch(`/api/points/${spotId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: newComment,
          imageUrl: user.imageUrl, // Add the user's profile image URL
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to add comment')
      }

      const data = await response.json()

      // Fetch the updated comments to ensure we're displaying data correctly
      await fetchComments(spotId)

      // Reset the comment field
      setNewComment('')
      toast.success('Comment added')
    } catch (error) {
      console.error('Error adding comment:', error)
      toast.error('Failed to add comment. Please try again.')
    } finally {
      setIsAddingComment(false)
    }
  }

  const handleDeleteComment = async (spotId: string, commentId: string) => {
    if (!user?.primaryEmailAddress?.emailAddress) {
      toast.error('Please wait while we verify your account...')
      return
    }

    // Store the comment being deleted for potential rollback
    const commentToDelete = comments[spotId]?.find((c) => c.id === commentId)
    if (!commentToDelete) {
      toast.error('Comment not found')
      return
    }

    // Optimistic update
    setComments((prev) => ({
      ...prev,
      [spotId]: prev[spotId]?.filter((c) => c.id !== commentId) || [],
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
        setComments((prev) => ({
          ...prev,
          [spotId]: [...(prev[spotId] || []), commentToDelete],
        }))
        setCommentCounts((prev) => ({
          ...prev,
          [spotId]: (prev[spotId] || 0) + 1,
        }))
        const errorText = await response.text()
        toast.error(errorText || 'Failed to delete comment. Please try again.')
      } else {
        toast.success('Comment deleted successfully')
      }
    } catch (error) {
      // Revert optimistic update on error
      setComments((prev) => ({
        ...prev,
        [spotId]: [...(prev[spotId] || []), commentToDelete],
      }))
      setCommentCounts((prev) => ({
        ...prev,
        [spotId]: (prev[spotId] || 0) + 1,
      }))
      console.error('Error deleting comment:', error)
      toast.error('An error occurred. Please try again.')
    }
  }

  const fetchLikes = async (spotId: string) => {
    setIsLoadingLikes((prev) => ({ ...prev, [spotId]: true }))
    try {
      const response = await fetch(`/api/points/${spotId}/likes`)
      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`Point ${spotId} not found when fetching likes. It may be newly created.`)
          // Set empty likes array for newly created points
          setLikes((prev) => ({ ...prev, [spotId]: [] }))
        } else {
          throw new Error('Failed to fetch likes')
        }
      } else {
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

    // Get the current user's email
    const userEmail = user.primaryEmailAddress?.emailAddress
    if (!userEmail) {
      toast.error('Please wait while we verify your account...')
      return
    }

    // Verify the spot exists
    const spot = points.find((p) => p.id === spotId)
    if (!spot) {
      toast.error('Spot not found')
      return
    }

    // Optimistic update
    const currentLikes = likes[spotId] || []
    const userLikeIndex = currentLikes.findIndex((like) => like.email === userEmail)

    let newLikes: LikeStatus[]
    if (userLikeIndex === -1) {
      newLikes = [
        ...currentLikes,
        { email: userEmail, name: user.firstName || 'Anonymous', status },
      ]
    } else {
      newLikes = [...currentLikes]
      if (status === null) {
        newLikes.splice(userLikeIndex, 1)
      } else {
        newLikes[userLikeIndex].status = status
      }
    }

    // Update UI optimistically
    setLikes((prev) => ({ ...prev, [spotId]: newLikes }))

    try {
      const response = await fetch(`/api/points/${spotId}/likes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
        }),
      })

      if (!response.ok) {
        // Revert optimistic update on error
        setLikes((prev) => ({ ...prev, [spotId]: currentLikes }))
        const errorText = await response.text()
        toast.error(errorText || 'Failed to update like status. Please try again.')
      } else {
        // Success! No need to re-fetch, we already updated the UI optimistically
        const statusText =
          status === 'like' ? 'liked' : status === 'dislike' ? 'disliked' : 'removed like from'
        toast.success(`You ${statusText} this spot!`, { id: `like-${spotId}` })
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
        setActiveReports((prev) => ({
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
    setIsLoadingActiveReports((prev) => ({ ...prev, [spotId]: true }))
    try {
      const response = await fetch(`/api/points/${spotId}/report`)
      if (response.ok) {
        const data = await response.json()
        setActiveReports((prev) => ({ ...prev, [spotId]: data }))
      }
    } catch (error) {
      console.error('Error fetching reports:', error)
    } finally {
      setIsLoadingActiveReports((prev) => ({ ...prev, [spotId]: false }))
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

    // Check if this is a newly created point
    const point = points.find((p) => p.id === pointId)
    const isNewPoint = point && Date.now() - (point.lastUpdated || 0) < 5000 // If created less than 5 seconds ago

    if (isNewPoint) {
      // For new points, delay fetching likes to allow time for the point to be stored
      setIsLoadingLikes((prev) => ({ ...prev, [pointId]: true }))
      setTimeout(() => {
        fetchLikes(pointId)
      }, 2000) // 2 second delay
    } else {
      // For existing points, fetch likes immediately
      fetchLikes(pointId)
    }

    fetchReports(pointId)
    fetchProposals(pointId)

    // Find the point in our points array
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
    if (!user) return
    setIsImporting(true)
    setImportResult(null) // Reset previous result

    try {
      toast.info('Importing skate spots... This may take a moment.')
      const result = await importSpots()

      if (result.success) {
        const count = result.count || 0
        setImportResult({
          success: true,
          message: result.message || `Successfully imported spots (${count} added)`,
          count,
        })

        toast.success(result.message || 'Successfully imported spots')

        // Force refresh points to show the new data
        await fetchPoints(true)

        // Refresh the cluster after import to show new markers
        setClusterKey((prev) => prev + 1)
      } else {
        setImportResult({
          success: false,
          message: result.error || 'Failed to import spots',
        })

        toast.error(result.error || 'Failed to import spots')
      }
    } catch (error) {
      console.error('Error importing spots:', error)
      setImportResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to import spots',
      })

      toast.error('Error importing spots. Please try again.')
    } finally {
      setIsImporting(false)
    }
  }

  const fetchAdminReports = async () => {
    if (!isUserAdmin || isLoadingAdminReports) return // Prevent API calls if not admin

    setIsLoadingAdminReports(true)
    try {
      const response = await fetch('/api/admin/reports')
      if (!response.ok) {
        throw new Error(response.status === 403 ? 'Unauthorized' : 'Failed to fetch admin reports')
      }
      const reports = await response.json()
      setAdminReports(reports)
    } catch (error) {
      console.error('Error fetching admin reports:', error)
      // Only show error if it's not an unauthorized error
      if (!(error instanceof Error && error.message === 'Unauthorized')) {
        toast.error('Failed to fetch reports')
      }
    } finally {
      setIsLoadingAdminReports(false)
    }
  }

  const handleUpdateReportStatus = async (reportId: string, newStatus: 'accept' | 'deny') => {
    setIsUpdatingReport((prev) => ({ ...prev, [reportId]: true }))
    try {
      // Get the report details before making the API call
      // This way if the API call fails but we already have the report data locally, we can still use it
      const report = adminReports.find((r) => r.id === reportId)
      if (!report) {
        toast.error('Report not found in local state')
        console.error(`Report ${reportId} not found in local state before API call`)
        return
      }

      const response = await fetch(`/api/admin/reports/${reportId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        const errorText = await response.text()

        // Special handling for "Report not found" errors
        if (errorText.includes('Report not found')) {
          console.error(
            `API returned "Report not found" for ID ${reportId}. This could mean the report was already processed.`,
          )

          // Remove the report from the UI anyway since it doesn't exist on the backend
          setAdminReports((prev) => prev.filter((r) => r.id !== reportId))

          if (newStatus === 'accept') {
            // If accepting, we'll still try to remove the spot from the local state
            setPoints((prev) => prev.filter((p) => p.id !== report.spotId))

            // Update pointsCache.current and localStorage
            pointsCache.current = pointsCache.current.filter((p) => p.id !== report.spotId)
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(pointsCache.current))
              localStorage.setItem(STORAGE_TIMESTAMP_KEY, Date.now().toString())
            } catch (error) {
              console.error('Error updating localStorage after spot removal:', error)
            }

            toast.success('Report processed and spot removed from view')
          } else {
            toast.success('Report removed from queue')
          }

          // Refresh admin reports to ensure our UI is in sync with the backend
          // This will update the UI properly if the report still exists somewhere
          await fetchAdminReports()

          return
        }

        throw new Error(errorText || 'Failed to update report status')
      }

      // If we got here, the API call was successful

      // If accepted, remove the spot
      if (newStatus === 'accept') {
        // Remove the spot from the points list
        setPoints((prev) => prev.filter((p) => p.id !== report.spotId))

        // Update pointsCache.current and localStorage
        pointsCache.current = pointsCache.current.filter((p) => p.id !== report.spotId)
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(pointsCache.current))
          localStorage.setItem(STORAGE_TIMESTAMP_KEY, Date.now().toString())
        } catch (error) {
          console.error('Error updating localStorage after spot removal:', error)
        }

        toast.success('Spot removed successfully')
      } else {
        // Update the local reports state to remove the denied report
        setActiveReports((prev) => ({
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

  const handleEditComment = async (spotId: string, commentId: string) => {
    if (!editingComment || !editingComment.content.trim()) return

    // Store the original comment for potential rollback
    const originalComment = comments[spotId]?.find((c) => c.id === commentId)
    if (!originalComment) {
      toast.error('Comment not found')
      return
    }

    // Optimistic update
    setComments((prev) => ({
      ...prev,
      [spotId]:
        prev[spotId]?.map((c) =>
          c.id === commentId ? { ...c, content: editingComment.content, updatedAt: Date.now() } : c,
        ) || [],
    }))

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
          [spotId]: prev[spotId]?.map((c) => (c.id === commentId ? updatedComment : c)) || [],
        }))
        setEditingComment(null)
        toast.success('Comment updated successfully')
      } else {
        // Revert optimistic update on error
        setComments((prev) => ({
          ...prev,
          [spotId]: prev[spotId]?.map((c) => (c.id === commentId ? originalComment : c)) || [],
        }))
        const errorText = await response.text()
        toast.error(errorText || 'Failed to update comment')
      }
    } catch (error) {
      // Revert optimistic update on error
      setComments((prev) => ({
        ...prev,
        [spotId]: prev[spotId]?.map((c) => (c.id === commentId ? originalComment : c)) || [],
      }))
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
    if (!isAdmin) return
    setIsDenyingAll(true)
    try {
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

  // Helper function to calculate distance between two points
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371 // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLon = ((lon2 - lon1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  const fetchNearbySessions = async () => {
    setIsLoadingNearbySessions(true)
    try {
      // Get current map bounds
      const bounds = mapRef.current?.getBounds()
      if (!bounds) {
        throw new Error('Map bounds not available')
      }

      // Filter points that are within the current map bounds
      const pointsInBounds = points.filter((point) => {
        const [lat, lng] = point.coordinates
        return bounds.contains([lat, lng])
      })

      // Fetch meetups for points within bounds
      const allMeetups: NearbyMeetup[] = []
      for (const point of pointsInBounds) {
        try {
          const meetups = await getMeetups(point.id)
          if (Array.isArray(meetups)) {
            for (const m of meetups) {
              // Calculate distance from center of map
              const [lat, lng] = point.coordinates
              const center = mapRef.current?.getCenter()
              const distance = center ? calculateDistance(center.lat, center.lng, lat, lng) : 0

              allMeetups.push({
                ...m,
                coordinates: point.coordinates,
                spotName: point.name,
                distance,
              } as NearbyMeetup)
            }
          }
        } catch (error) {
          console.error(`Error fetching meetups for point ${point.id}:`, error)
          // Continue with other points even if one fails
          continue
        }
      }

      // Remove duplicates by meetup id and sort by distance
      const seen = new Set<string>()
      const uniqueMeetups = allMeetups
        .filter((meetup) => {
          if (seen.has(meetup.id)) {
            return false
          }
          seen.add(meetup.id)
          return true
        })
        .sort((a, b) => (a as NearbyMeetup).distance - (b as NearbyMeetup).distance)

      setNearbySessions(uniqueMeetups as NearbyMeetup[])
    } catch (error) {
      console.error('Error fetching nearby sessions:', error)
      toast.error('Failed to fetch nearby sessions')
    } finally {
      setIsLoadingNearbySessions(false)
    }
  }

  // Update effect to fetch nearby sessions when toggle is changed
  useEffect(() => {
    if (showNearbySessions && mapRef.current) {
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

  useEffect(() => {
    // Only run this effect when isUserAdmin changes to true
    if (isUserAdmin) {
      // Fetch admin reports
      fetchAdminReports()

      // Fetch admin proposals
      fetchAdminProposals()
    }
  }, [isUserAdmin])

  const handleUpdateProposal = async (
    spotId: string,
    proposalId: string,
    status: 'approved' | 'rejected',
    adminNotes?: string,
  ) => {
    setIsUpdatingProposal((prev) => ({ ...prev, [proposalId]: true }))
    try {
      await updateProposalStatus(spotId, proposalId, status, adminNotes)

      // Update UI immediately
      setAdminProposals((prev) => prev.filter((p) => p.id !== proposalId))

      // If approved, update the points including cache and localStorage
      if (status === 'approved') {
        // Instead of calling fetchPoints, do the direct cache update for immediate feedback
        const response = await fetch('/api/points', {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache',
          },
        })

        if (response.ok) {
          const data = await response.json()
          if (Array.isArray(data)) {
            // Update state and cache
            pointsCache.current = data
            setPoints(data)
            setLastFetchTime(Date.now())

            // Update localStorage
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
              localStorage.setItem(STORAGE_TIMESTAMP_KEY, Date.now().toString())
            } catch (error) {
              console.error('Error saving points to localStorage:', error)
            }
          }
        }

        toast.success('Proposal approved and changes applied')
      } else {
        toast.success('Proposal rejected')
      }
    } catch (error) {
      console.error('Error updating proposal:', error)
      toast.error('Failed to update proposal. Please try again.')
    } finally {
      setIsUpdatingProposal((prev) => ({ ...prev, [proposalId]: false }))
    }
  }

  const fetchAdminProposals = async () => {
    if (!isUserAdmin || isLoadingAdminProposals) return // Prevent API calls if not admin

    setIsLoadingAdminProposals(true)
    try {
      const proposals = await getProposals()
      setAdminProposals(proposals)
    } catch (error) {
      console.error('Error fetching admin proposals:', error)
      // Only show error if it's not an unauthorized error
      if (!(error instanceof Error && error.message === 'Unauthorized')) {
        toast.error('Failed to fetch proposals')
      }
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

  // Update the renderPopupContent function to use the memoized component
  const renderPopupContent = (point: MapPoint) => {
    const hasActiveSession = nearbySessions.some((session) => session.spotId === point.id)
    const userLike = likes[point.id]?.find(
      (like) => like.email === user?.primaryEmailAddress?.emailAddress,
    )
    const totalLikes = likes[point.id]?.filter((like) => like.status === 'like').length || 0
    const totalDislikes = likes[point.id]?.filter((like) => like.status === 'dislike').length || 0

    return (
      <PopupContent
        point={point}
        onPopupOpen={handlePopupOpen}
        onDelete={handleDeletePoint}
        onReport={() => {
          setSpotToReport(point.id)
          setIsReportDialogOpen(true)
        }}
        onEdit={() => {
          setSpotToEdit(point)
          setIsEditProposalDialogOpen(true)
        }}
        onLike={(id, status) => handleLike(id, status)}
        onComment={() => {
          setSelectedSpotId(point.id)
          setIsCommentsDialogOpen(true)
        }}
        onMeetup={() => {
          setSelectedSpotForMeetup({
            id: point.id,
            name: point.name,
          })
          // Load existing meetups for this spot
          getMeetups(point.id).then(setMeetups).catch(console.error)
          setIsMeetupsListDialogOpen(true)
        }}
        isDeleting={!!isDeletingPoint[point.id]}
        isReporting={!!isReporting[point.id]}
        isLoadingAddress={!!isLoadingAddress[point.id]}
        likes={likes[point.id] || []}
        isLoadingLikes={!!isLoadingLikes[point.id]}
        isLoadingComments={!!isLoadingComments[point.id]}
        hasActiveSession={hasActiveSession}
        user={user}
        isAdmin={isUserAdmin}
        proposals={proposals[point.id] || []}
        activeReports={activeReports[point.id] || []}
        commentCounts={commentCounts[point.id] || 0}
        setSpotToDelete={setSpotToDelete}
        setIsDeleteConfirmOpen={setIsDeleteConfirmOpen}
      />
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
        const response = await fetch('/api/points', { method: 'HEAD' })
        if (!response.ok) throw new Error('Failed to check for updates')

        const serverLastUpdate = parseInt(response.headers.get('Last-Update') || '0', 10)
        const localLastUpdate = parseInt(localStorage.getItem(STORAGE_TIMESTAMP_KEY) || '0', 10)

        // Only fetch if server data is newer
        if (serverLastUpdate > localLastUpdate) {
          await fetchPoints(true)
        }
      } catch (error) {
        console.error('Error checking for updates:', error)
      }
    }

    // Check less frequently
    const interval = setInterval(checkForUpdates, CACHE_DURATION)

    // Initial check
    checkForUpdates()

    return () => clearInterval(interval)
  }, [isMounted])

  // Add effect to check admin status
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (user) {
        const adminStatus = await isAdmin()
        setIsUserAdmin(adminStatus)
      }
    }
    checkAdminStatus()
  }, [user])

  // Create a CSS class with transition for markers
  const markerAnimationClass = 'transition-all duration-300 ease-in-out transform hover:scale-110'

  // Add effect to update marker clusters when nearbySessions or points change
  useEffect(() => {
    // Force update cluster markers to refresh the purple dots
    if (mapRef.current) {
      setClusterKey((prevKey) => prevKey + 1)
    }
  }, [nearbySessions, points.length])

  // Add effect to fetch nearby sessions when map moves or zoom changes
  useEffect(() => {
    if (!mapRef.current || !showNearbySessions) return

    let lastLat = 0
    let lastLng = 0
    let lastZoom = 0
    let timeout: NodeJS.Timeout

    const handleMapChange = () => {
      if (timeout) clearTimeout(timeout)

      timeout = setTimeout(() => {
        if (!mapRef.current) return

        const center = mapRef.current.getCenter()
        const zoom = mapRef.current.getZoom()

        // Only fetch if moved significantly (more than 0.05 degrees or ~5km) or zoom changed
        const latDiff = Math.abs(center.lat - lastLat)
        const lngDiff = Math.abs(center.lng - lastLng)
        const zoomChanged = zoom !== lastZoom

        const moveThreshold = 0.05 // Increased threshold to reduce updates

        if (zoomChanged || latDiff > moveThreshold || lngDiff > moveThreshold) {
          lastLat = center.lat
          lastLng = center.lng
          lastZoom = zoom
          fetchNearbySessions()
        }
      }, 2000) // 2 second debounce
    }

    mapRef.current.on('moveend', handleMapChange)
    mapRef.current.on('zoomend', handleMapChange)

    return () => {
      if (mapRef.current) {
        mapRef.current.off('moveend', handleMapChange)
        mapRef.current.off('zoomend', handleMapChange)
      }
      if (timeout) clearTimeout(timeout)
    }
  }, [mapRef.current, showNearbySessions])

  // Add a handler for the newComment field
  const handleCommentChange = (value: string) => {
    setNewComment(value)
  }

  // Add a handler for the editingComment field
  const handleEditingCommentChange = (value: string) => {
    setEditingComment((prev) => (prev ? { ...prev, content: value } : null))
  }

  // Create a new function to handle the confirmation and actual deletion
  const handleConfirmDelete = async () => {
    if (!spotToDelete) return

    try {
      const success = await handleDeletePoint(spotToDelete.id)
      if (!success) {
        console.error('Deletion failed')
      }
      // No need to fetch all points again since handleDeletePoint already does optimistic updates
    } catch (error) {
      console.error('Error during spot deletion:', error)
      toast.error('An error occurred while deleting the spot.')
    } finally {
      setSpotToDelete(null)
      setIsDeleteConfirmOpen(false)
    }
  }

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
      <header className="sticky top-0 z-10 w-full border-b bg-white shadow-md backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 overflow-hidden px-2 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-0 sm:px-6 lg:px-8">
          {/* Left: Logo/Brand */}
          <div className="flex min-w-max flex-shrink-0 items-center justify-center gap-2 py-1 sm:max-w-xs sm:justify-start sm:py-0">
            <h1
              className="bg-gradient-to-r from-blue to-purple-400 bg-clip-text text-2xl font-extrabold tracking-tight text-transparent drop-shadow-sm sm:text-3xl"
              aria-label="SkateSpot Home"
            >
              SkateSpot
            </h1>
            {isUserAdmin && (
              <span className="bg-blue-100 text-blue-700 ml-2 rounded px-2 py-0.5 text-xs font-semibold shadow-sm">
                Admin
              </span>
            )}
          </div>

          {/* Center: Search (always centered on desktop) */}
          <div className="order-3 mt-2 flex w-full min-w-0 flex-col items-center gap-2 sm:order-none sm:mt-0 sm:w-auto sm:flex-1 sm:px-6 lg:px-12">
            <div className="flex w-full min-w-[180px] max-w-xl items-center gap-2 rounded-lg bg-white/90 px-2 py-1 shadow-sm ring-1 ring-border focus-within:ring-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  toast.success('Refreshing skate spots...')
                  fetchPoints(true)
                }}
                disabled={isLoadingPoints}
                title="Refresh skate spots"
                className="h-9 w-9 shrink-0 border-none bg-transparent"
                aria-label="Refresh skate spots"
                tabIndex={0}
              >
                <RefreshCw className={`h-5 w-5 ${isLoadingPoints ? 'animate-spin' : ''}`} />
              </Button>
              <div className="relative min-w-0 flex-1">
                <Command
                  className="rounded-lg border-none bg-transparent shadow-none"
                  shouldFilter={false}
                >
                  <CommandInput
                    placeholder="Search for a skatepark by name or location..."
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                    className="h-11 w-full border-none bg-transparent px-4 text-base shadow-none ring-0 focus:outline-none"
                    aria-label="Search for a skatepark by name or location"
                  />
                  {searchQuery && (
                    <div className="search-results-container absolute left-0 right-0 top-full z-[9999] mt-0.5 max-h-[300px] overflow-auto rounded-md border bg-background shadow-lg">
                      <CommandList className="max-h-[300px] overflow-auto">
                        {isSearching ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="ml-2">Searching...</span>
                          </div>
                        ) : searchResults.length === 0 ? (
                          <div className="py-4 text-center text-sm text-muted-foreground">
                            {searchQuery.length < 3
                              ? 'Type at least 3 characters to search'
                              : 'No skateparks or locations found. Try a different search term.'}
                          </div>
                        ) : (
                          <CommandGroup heading="Locations">
                            {searchResults.map((result) => (
                              <CommandItem
                                key={`${result.lat}-${result.lon}`}
                                value={result.display_name}
                                onSelect={() =>
                                  handleSearchResultSelect(
                                    result.lat,
                                    result.lon,
                                    result.display_name,
                                  )
                                }
                                className="flex w-full cursor-pointer items-start gap-2 px-2 py-2 hover:bg-accent"
                              >
                                <Search className="mt-1 h-4 w-4 shrink-0" />
                                <div className="flex-1">
                                  <div className="font-medium">
                                    {result.display_name.split(',')[0]}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {result.display_name}
                                  </div>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                      </CommandList>
                    </div>
                  )}
                </Command>
                {isSearching && (
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Admin Controls as Dropdown */}
          {isUserAdmin && (
            <div className="order-2 flex min-w-max flex-shrink-0 items-center justify-center gap-2 sm:order-none sm:max-w-sm sm:justify-end sm:gap-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 px-3" aria-label="Admin Menu">
                    <Settings className="mr-1 h-4 w-4" />
                    <span className="hidden sm:inline">Admin Menu</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2">
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="justify-start"
                      onClick={() => {
                        // Import Spots
                        if (typeof window !== 'undefined') {
                          document
                            .querySelector('[data-import-spots]')
                            ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
                        }
                      }}
                    >
                      <span className="flex items-center gap-2">
                        <RefreshCw className="h-4 w-4" /> Import Spots
                      </span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="justify-start text-red-600"
                      onClick={() => {
                        // Delete All Spots
                        if (typeof window !== 'undefined') {
                          document
                            .querySelector('[data-delete-all-spots]')
                            ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
                        }
                      }}
                    >
                      <span className="flex items-center gap-2">
                        <Trash className="h-4 w-4" /> Delete All Spots
                      </span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="justify-start"
                      onClick={() => {
                        setIsReportsDialogOpen(true)
                        fetchAdminReports()
                      }}
                    >
                      <span className="flex items-center gap-2">
                        <Flag className="h-4 w-4" /> Reports
                        {adminReports.length > 0 && (
                          <span className="bg-blue-100 ml-1 rounded-full px-1.5 py-0.5 text-xs font-semibold text-blue">
                            {adminReports.length}
                          </span>
                        )}
                      </span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="justify-start"
                      onClick={() => {
                        setIsAdminProposalsDialogOpen(true)
                        fetchAdminProposals()
                      }}
                    >
                      <span className="flex items-center gap-2">
                        <FileEdit className="h-4 w-4" /> Proposals
                        {adminProposals.length > 0 && (
                          <span className="bg-blue-100 ml-1 rounded-full px-1.5 py-0.5 text-xs font-semibold text-blue">
                            {adminProposals.length}
                          </span>
                        )}
                      </span>
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              {/* Hidden triggers for ImportSpotsButton and DeleteAllSpotsDialog */}
              <span className="hidden">
                <ImportSpotsButton data-import-spots onImportSuccess={() => fetchPoints(true)} />
                <DeleteAllSpotsDialog
                  data-delete-all-spots
                  onDeleteSuccess={() => fetchPoints(true)}
                />
              </span>
            </div>
          )}
        </div>
      </header>

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
          zoomControl={false} // Custom zoom controls in bottomright position
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
          <ZoomControl position="bottomright" />
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
                const newShowState = !showNearbySessions
                setShowNearbySessions(newShowState)
                if (newShowState) {
                  fetchNearbySessions()
                  setIsNearbySessionsDialogOpen(true)
                } else {
                  setNearbySessions([])
                  setIsNearbySessionsDialogOpen(false)
                }
              }}
            >
              <Users className="h-4 w-4" />
              {showNearbySessions ? 'Hide nearby sessions' : 'Show nearby sessions'}
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
                  if (
                    !session.coordinates ||
                    !Array.isArray(session.coordinates) ||
                    session.coordinates.length !== 2 ||
                    typeof session.coordinates[0] !== 'number' ||
                    typeof session.coordinates[1] !== 'number'
                  ) {
                    console.warn('Skipping session with invalid coordinates:', session)
                    return null
                  }
                  const point = points.find((p) => p.id === session.spotId)
                  if (!point) return null
                  return (
                    <Marker
                      key={session.id}
                      position={session.coordinates}
                      icon={createMarkerIcon(true)}
                      eventHandlers={{
                        popupopen: () => {
                          // Set loading states before triggering fetch operations
                          setIsLoadingComments((prev) => ({ ...prev, [point.id]: true }))
                          setIsLoadingLikes((prev) => ({ ...prev, [point.id]: true }))
                          handlePopupOpen(point.id)
                        },
                        click: (e: L.LeafletMouseEvent) => {
                          // Prevent the click from propagating to the map
                          L.DomEvent.stopPropagation(e)
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
            <MarkerClusterGroup
              key={clusterKey}
              chunkedLoading
              maxClusterRadius={80}
              spiderfyOnMaxZoom={true}
              showCoverageOnHover={false}
              zoomToBoundsOnClick={true}
              disableClusteringAtZoom={16}
            >
              {points.map((point) => {
                // Add check for valid coordinates
                if (
                  !point.coordinates ||
                  !Array.isArray(point.coordinates) ||
                  point.coordinates.length !== 2 ||
                  typeof point.coordinates[0] !== 'number' ||
                  typeof point.coordinates[1] !== 'number'
                ) {
                  console.warn('Invalid coordinates for point:', point.id)
                  return null
                }
                const hasActiveSession = nearbySessions.some(
                  (session) => session.spotId === point.id,
                )
                return (
                  <Marker
                    key={point.id}
                    position={point.coordinates}
                    icon={createMarkerIcon(hasActiveSession)}
                    eventHandlers={{
                      popupopen: () => {
                        // Set loading states before triggering fetch operations
                        setIsLoadingComments((prev) => ({ ...prev, [point.id]: true }))
                        setIsLoadingLikes((prev) => ({ ...prev, [point.id]: true }))
                        handlePopupOpen(point.id)
                      },
                      click: (e: L.LeafletMouseEvent) => {
                        // Prevent the click from propagating to the map
                        L.DomEvent.stopPropagation(e)
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
              })}
            </MarkerClusterGroup>
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
                    onChange={(e) => handleCommentChange(e.target.value)}
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
                    <div className="flex h-full items-center justify-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-gray-900"></div>
                        <p className="text-sm text-gray-500">Loading comments...</p>
                      </div>
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
                                    onChange={(e) => handleEditingCommentChange(e.target.value)}
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
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gray-200">
                                      {comment.imageUrl ? (
                                        <img
                                          src={comment.imageUrl}
                                          alt={comment.createdByName}
                                          className="h-full w-full object-cover"
                                        />
                                      ) : (
                                        <span className="text-sm font-medium text-gray-600">
                                          {comment.createdByName.charAt(0).toUpperCase()}
                                        </span>
                                      )}
                                    </div>
                                    <div>
                                      <p className="font-medium text-gray-900">
                                        {comment.createdByName}
                                      </p>
                                      <p className="text-sm text-gray-700">{comment.content}</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                              {(comment.createdBy === user.primaryEmailAddress?.emailAddress ||
                                isUserAdmin) && (
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
            <div className="grid gap-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <DescriptionInput
                value={newPointDescription}
                onChange={handleDescriptionChange}
                disabled={isAddingPoint}
              />
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
            <DialogTitle>Report Spot for Removal</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="reason">Reason for Report</Label>
              <Textarea
                id="reason"
                value={reportReason}
                onChange={(e) => handleReportReasonChange(e.target.value)}
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
        <DialogContent className="z-[9999] max-h-[80vh] w-[95vw] p-0 md:max-w-[700px]">
          <DialogHeader className="px-6 pb-2 pt-6">
            <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
              <Flag className="h-6 w-6 text-red-500" />
              Manage Spot Reports
            </DialogTitle>
            <DialogDescription className="mt-1 text-base text-muted-foreground">
              Review and take action on reported skate spots.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-6">
            {isLoadingAdminReports ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-red-500" />
                <span className="ml-3 text-lg text-muted-foreground">Loading reports...</span>
              </div>
            ) : adminReports.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Flag className="mb-2 h-10 w-10 text-muted-foreground" />
                <p className="text-lg text-muted-foreground">No reports to review 🎉</p>
                <p className="mt-1 text-sm text-muted-foreground">All clear for now!</p>
              </div>
            ) : (
              <ScrollArea className="h-[60vh] pr-2">
                <div className="space-y-4">
                  {adminReports.map((adminReport) => (
                    <Card
                      key={adminReport.id}
                      className="border border-red-200/60 shadow-sm transition-shadow hover:shadow-lg"
                    >
                      <CardHeader className="flex flex-row items-center gap-3 rounded-t-md bg-red-50/60 p-4">
                        <Flag className="h-5 w-5 text-red-400" />
                        <div className="flex-1">
                          <CardTitle className="text-lg font-semibold text-red-700">
                            {adminReport.spotName}
                          </CardTitle>
                          <CardDescription className="mt-1 text-sm text-red-600">
                            {adminReport.reason}
                          </CardDescription>
                        </div>
                        <span className="inline-block rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-600">
                          Pending
                        </span>
                      </CardHeader>
                      <CardContent className="p-4">
                        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                          <span>
                            <span className="font-medium text-gray-700">Reported by:</span>{' '}
                            {adminReport.userEmail || 'Unknown'}
                          </span>
                          <span>
                            <span className="font-medium text-gray-700">Reported:</span>{' '}
                            {adminReport.createdAt
                              ? new Date(adminReport.createdAt).toLocaleString()
                              : 'Unknown'}
                          </span>
                        </div>
                      </CardContent>
                      <CardFooter className="flex justify-end gap-2 rounded-b-md bg-gray-50 p-4">
                        <Button
                          variant="destructive"
                          size="sm"
                          className="font-semibold"
                          onClick={() => handleUpdateReportStatus(adminReport.id, 'accept')}
                        >
                          <Trash className="mr-1 h-4 w-4" /> Remove Spot
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-gray-300 font-semibold"
                          onClick={() => handleUpdateReportStatus(adminReport.id, 'deny')}
                        >
                          Dismiss
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
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
        onSubmit={async (proposedName, proposedType, proposedDescription, editReason) => {
          if (!spotToEdit || !user) return
          setIsSubmittingProposal(true)
          try {
            await submitEditProposal({
              spotId: spotToEdit.id,
              proposedName,
              proposedType,
              proposedDescription,
              reason: editReason,
              userId: user.id,
              userEmail: user.primaryEmailAddress?.emailAddress || '',
            })
            setIsEditProposalDialogOpen(false)
            toast.success('Edit proposal submitted successfully!')
          } catch (error) {
            console.error('Error submitting proposal:', error)
            toast.error('Failed to submit edit proposal. Please try again.')
          } finally {
            setIsSubmittingProposal(false)
          }
        }}
        isSubmitting={isSubmittingProposal}
      />

      {importResult && (
        <div className={`mt-2 text-sm ${importResult.success ? 'text-green-500' : 'text-red-500'}`}>
          {importResult.message}
          {importResult.count !== undefined && ` (${importResult.count} spots)`}
        </div>
      )}

      {/* Admin Proposals Dialog */}
      <Dialog open={isAdminProposalsDialogOpen} onOpenChange={setIsAdminProposalsDialogOpen}>
        <DialogContent className="max-h-[80vh] w-[95vw] overflow-x-auto p-0 md:max-w-[700px]">
          <DialogHeader className="px-6 pb-2 pt-6">
            <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
              <FileEdit className="text-blue-500 h-6 w-6" />
              Review Edit Proposals
            </DialogTitle>
            <DialogDescription className="mt-1 text-base text-muted-foreground">
              Review and take action on proposed spot edits.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-6">
            {isLoadingAdminProposals ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="text-blue-500 h-8 w-8 animate-spin" />
                <span className="ml-3 text-lg text-muted-foreground">Loading proposals...</span>
              </div>
            ) : adminProposals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <FileEdit className="mb-2 h-10 w-10 text-muted-foreground" />
                <p className="text-lg text-muted-foreground">No proposals to review 🎉</p>
                <p className="mt-1 text-sm text-muted-foreground">All clear for now!</p>
              </div>
            ) : (
              <ScrollArea className="h-[60vh] overflow-x-auto pr-2">
                <div className="space-y-4">
                  {adminProposals.map((proposal) => (
                    <Card
                      key={proposal.id}
                      className="border-blue-200/60 mb-4 w-full max-w-full overflow-x-auto break-words border shadow-sm transition-shadow hover:shadow-lg"
                    >
                      <CardHeader className="bg-blue-50/60 flex flex-row items-center gap-3 rounded-t-md p-4">
                        <FileEdit className="text-blue-400 h-5 w-5" />
                        <div className="flex-1">
                          <CardTitle className="text-blue-700 w-full max-w-full break-words text-lg font-semibold">
                            {proposal.spotName}
                          </CardTitle>
                          <CardDescription className="text-blue-600 mt-1 w-full max-w-full break-words text-sm">
                            Proposed by {proposal.userEmail || 'Unknown'}
                          </CardDescription>
                        </div>
                        <span className="bg-blue-100 text-blue-600 inline-block rounded-full px-3 py-1 text-xs font-semibold">
                          {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
                        </span>
                      </CardHeader>
                      <CardContent className="p-4">
                        <div className="w-full max-w-full space-y-4">
                          <div>
                            <h4 className="font-medium">Current Details</h4>
                            <p className="w-full max-w-full break-words text-sm text-gray-600">
                              Name: {proposal.currentName}
                              <br />
                              Type: {proposal.currentType}
                            </p>
                          </div>
                          <div>
                            <h4 className="font-medium">Proposed Changes</h4>
                            <p className="w-full max-w-full break-words text-sm text-gray-600">
                              Name: {proposal.proposedName}
                              <br />
                              Type: {proposal.proposedType}
                            </p>
                          </div>
                          <div>
                            <h4 className="font-medium">Reason</h4>
                            <p
                              className="w-full max-w-full whitespace-pre-line break-words text-sm text-gray-600"
                              style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                            >
                              {proposal.reason}
                            </p>
                          </div>
                          {proposal.adminNotes && (
                            <div>
                              <h4 className="font-medium">Admin Notes</h4>
                              <p className="w-full max-w-full break-words text-sm text-gray-600">
                                {proposal.adminNotes}
                              </p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                      <CardFooter className="flex justify-end gap-2 rounded-b-md bg-gray-50 p-4">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-gray-300 font-semibold"
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
                          className="font-semibold"
                          onClick={() =>
                            handleUpdateProposal(proposal.spotId, proposal.id, 'rejected')
                          }
                          disabled={isUpdatingProposal[proposal.id]}
                        >
                          {isUpdatingProposal[proposal.id] ? 'Rejecting...' : 'Reject'}
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
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
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">{session.title}</CardTitle>
                          <CardDescription>
                            {session.spotName} • Created by {session.createdByName}
                          </CardDescription>
                        </div>
                        {user && session.createdBy === user.id && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedSpotForMeetup({
                                    id: session.spotId,
                                    name: session.spotName,
                                  })
                                  setIsMeetupsListDialogOpen(true)
                                  getMeetups(session.spotId).then(setMeetups)
                                }}
                              >
                                <Edit2 className="mr-2 h-4 w-4" />
                                Edit Session
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={async () => {
                                  try {
                                    await deleteMeetup(session.id)
                                    toast.success('Session deleted successfully')
                                    fetchNearbySessions()
                                  } catch (error) {
                                    console.error('Error deleting session:', error)
                                    toast.error('Failed to delete session')
                                  }
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Session
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{session.description}</p>
                      <div className="mt-2 flex items-center justify-between text-sm">
                        <div className="space-y-1">
                          <div className="text-muted-foreground">
                            Started {formatDistanceToNow(session.date, { addSuffix: true })}
                          </div>
                          <div className="text-muted-foreground">
                            {(session.distance * 0.621371).toFixed(1)} miles away
                          </div>
                        </div>
                        {user && (
                          <Button
                            variant={
                              session.participants?.includes(user.id) ? 'outline' : 'default'
                            }
                            size="sm"
                            onClick={async () => {
                              try {
                                if (session.participants?.includes(user.id)) {
                                  await leaveMeetup(session.id)
                                  toast.success('Left session successfully')
                                } else {
                                  await joinMeetup(session.id)
                                  toast.success('Joined session successfully')
                                }
                                // Refresh nearby sessions
                                fetchNearbySessions()
                              } catch (error) {
                                console.error('Error joining/leaving session:', error)
                                toast.error('Failed to join/leave session')
                              }
                            }}
                          >
                            {session.participants?.includes(user.id) ? 'Leave' : 'Join'}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {isUserAdmin && (
        <>
          <Dialog open={isAdminReportsDialogOpen} onOpenChange={setIsAdminReportsDialogOpen}>
            <DialogContent className="max-h-[80vh] w-[90vw] sm:max-w-[800px]">
              <DialogHeader>
                <DialogTitle>Manage Reports</DialogTitle>
              </DialogHeader>
              <div className="mt-4">
                {isLoadingAdminReports ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : adminReports.length === 0 ? (
                  <p className="text-center text-gray-500">No reports to manage</p>
                ) : (
                  <ScrollArea className="h-[60vh] pr-4">
                    {adminReports.map((adminReport) => (
                      <div key={adminReport.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{adminReport.spotName}</p>
                            <p className="text-sm text-gray-500">{adminReport.reason}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUpdateReportStatus(adminReport.id, 'accept')}
                            >
                              Accept
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUpdateReportStatus(adminReport.id, 'deny')}
                            >
                              Deny
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </ScrollArea>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* Add the confirmation dialog */}
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the skate spot &nbsp;{spotToDelete?.name}&nbsp;. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
