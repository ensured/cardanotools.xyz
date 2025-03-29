import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { format } from 'date-fns'
import { joinMeetup, leaveMeetup, deleteMeetup, editMeetup } from '@/app/actions/meetups'
import { useUser } from '@clerk/nextjs'
import { useAdmin } from '@/lib/hooks/useAdmin'
import { Loader2, Trash2, Edit2 } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DateTimePicker } from '@/components/ui/date-time-picker'

interface Meetup {
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
}

interface MeetupsListProps {
  spotId: string
  meetups: Meetup[]
  onMeetupsChange: () => void
}

export function MeetupsList({ spotId, meetups, onMeetupsChange }: MeetupsListProps) {
  const { user } = useUser()
  const isAdmin = useAdmin()
  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState<Record<string, boolean>>({})
  const [isEditing, setIsEditing] = useState<Record<string, boolean>>({})
  const [editingMeetup, setEditingMeetup] = useState<Meetup | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editDate, setEditDate] = useState<Date | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  const handleJoin = async (meetupId: string) => {
    if (!user) return
    setIsLoading(true)
    try {
      await joinMeetup(meetupId)
      onMeetupsChange()
    } catch (error) {
      console.error('Error joining meetup:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLeave = async (meetupId: string) => {
    if (!user) return
    setIsLoading(true)
    try {
      await leaveMeetup(meetupId)
      onMeetupsChange()
    } catch (error) {
      console.error('Error leaving meetup:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (meetupId: string) => {
    if (!user) return
    setIsDeleting((prev) => ({ ...prev, [meetupId]: true }))
    try {
      await deleteMeetup(meetupId)
      onMeetupsChange()
      toast.success('Skate session deleted successfully')
    } catch (error) {
      console.error('Error deleting meetup:', error)
      toast.error('Failed to delete skate session')
    } finally {
      setIsDeleting((prev) => ({ ...prev, [meetupId]: false }))
    }
  }

  const handleEdit = async (meetup: Meetup) => {
    if (!user) return
    setEditingMeetup(meetup)
    setEditTitle(meetup.title)
    setEditDescription(meetup.description)
    setEditDate(new Date(meetup.date))
    setIsEditing((prev) => ({ ...prev, [meetup.id]: true }))
    setIsEditDialogOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!editingMeetup || !editTitle || !editDescription || !editDate) return

    try {
      await editMeetup(editingMeetup.id, {
        title: editTitle,
        description: editDescription,
        date: editDate.getTime(),
      })
      onMeetupsChange()
      toast.success('Skate session updated successfully')
      setEditingMeetup(null)
      setIsEditing((prev) => ({ ...prev, [editingMeetup.id]: false }))
      setIsEditDialogOpen(false)
    } catch (error) {
      console.error('Error updating meetup:', error)
      toast.error('Failed to update skate session')
    }
  }

  const handleCloseEditDialog = () => {
    setIsEditDialogOpen(false)
    if (editingMeetup) {
      setIsEditing((prev) => ({ ...prev, [editingMeetup.id]: false }))
    }
  }

  if (meetups.length === 0) {
    return (
      <div className="text-center text-sm text-gray-500">
        No skate sessions planned yet. Be the first to create one!
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {meetups.map((meetup) => {
        const isParticipant = user && meetup.participants.includes(user.id)
        const canDelete = user && (meetup.createdBy === user.id || isAdmin)
        const canEdit = user && meetup.createdBy === user.id
        return (
          <Card key={meetup.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{meetup.title}</CardTitle>
                <div className="flex gap-2">
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-blue-500 hover:text-blue-700"
                      onClick={() => handleEdit(meetup)}
                      disabled={isEditing[meetup.id]}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => handleDelete(meetup.id)}
                      disabled={isDeleting[meetup.id]}
                    >
                      {isDeleting[meetup.id] ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">{meetup.description}</p>
              <div className="mt-2 flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  {format(meetup.date, 'MM/dd/yyyy hh:mm aa')} • {meetup.participants.length}{' '}
                  participants
                </div>
                {user && (
                  <Button
                    variant={isParticipant ? 'outline' : 'default'}
                    size="sm"
                    onClick={() => (isParticipant ? handleLeave(meetup.id) : handleJoin(meetup.id))}
                    disabled={isLoading}
                  >
                    {isParticipant ? 'Leave' : 'Join'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={handleCloseEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Skate Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Enter session title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Enter session description"
              />
            </div>
            <div className="space-y-2">
              <Label>Date & Time</Label>
              <DateTimePicker date={editDate} setDate={setEditDate} />
            </div>
            <Button
              onClick={handleSaveEdit}
              className="w-full"
              disabled={!editTitle || !editDescription || !editDate}
            >
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
