export interface MapPoint {
  id: string
  name: string
  type: 'street' | 'park' | 'diy'
  coordinates: [number, number]
  createdBy: string
}

export interface Comment {
  id: string
  content: string
  createdBy: string
  createdAt: number
  updatedAt?: number
}

export interface LikeStatus {
  userId: string
  status: 'like' | 'dislike' | null
}

export interface Report {
  id: string
  userId: string
  reason: string
  createdAt: number
  status: 'pending' | 'reviewed' | 'resolved'
}

export interface AdminReport {
  id: string
  userId: string
  reason: string
  createdAt: number
  status: 'pending' | 'reviewed' | 'resolved'
  spotId: string
  spotName: string
}

export interface SearchResult {
  display_name: string
  lat: number
  lon: number
}

export interface EditProposal {
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
