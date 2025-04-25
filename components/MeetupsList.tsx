import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { format } from 'date-fns'
import { joinMeetup, leaveMeetup, deleteMeetup, editMeetup } from '@/app/actions/meetups'
import { useUser } from '@clerk/nextjs'
import { isAdmin as isAdminHook } from '@/lib/hooks/isAdmin'
import { Loader2, Trash2, Edit2, CalendarIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

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
  createdByName: string
}

interface MeetupsListProps {
  spotId: string
  meetups: Meetup[]
  onMeetupsChange: () => void
}

export function MeetupsList({ spotId, meetups, onMeetupsChange }: MeetupsListProps) {
  const { user } = useUser()
  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState<Record<string, boolean>>({})
  const [isEditing, setIsEditing] = useState<Record<string, boolean>>({})
  const [editingMeetup, setEditingMeetup] = useState<Meetup | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editDate, setEditDate] = useState<Date | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const checkAdmin = async () => {
      const isAdmin = await isAdminHook()
      setIsAdmin(isAdmin)
    }
    checkAdmin()
  }, [])

  const hours = Array.from({ length: 12 }, (_, i) => i + 1)

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

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      setEditDate(selectedDate)
    }
  }

  const handleTimeChange = (type: 'hour' | 'minute' | 'ampm', value: string) => {
    if (editDate) {
      const newDate = new Date(editDate)
      if (type === 'hour') {
        newDate.setHours((parseInt(value) % 12) + (newDate.getHours() >= 12 ? 12 : 0))
      } else if (type === 'minute') {
        newDate.setMinutes(parseInt(value))
      } else if (type === 'ampm') {
        const currentHours = newDate.getHours()
        newDate.setHours(value === 'PM' ? currentHours + 12 : currentHours - 12)
      }
      setEditDate(newDate)
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
          <Card key={meetup.id} className="mb-4">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{meetup.title}</CardTitle>
                  <p className="text-sm text-gray-500">Created by {meetup.createdByName}</p>
                </div>
                {(meetup.createdBy === user?.id || isAdmin) && (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-blue-500 hover:text-blue-700"
                      onClick={() => handleEdit(meetup)}
                      disabled={isEditing[meetup.id]}
                    >
                      <Edit2 className="mr-1 h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => handleDelete(meetup.id)}
                      disabled={isDeleting[meetup.id]}
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                )}
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
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !editDate && 'text-muted-foreground',
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editDate ? (
                      format(editDate, 'MM/dd/yyyy hh:mm aa')
                    ) : (
                      <span>MM/DD/YYYY hh:mm aa</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <div className="sm:flex">
                    <Calendar
                      mode="single"
                      selected={editDate || undefined}
                      onSelect={handleDateSelect}
                      initialFocus
                    />
                    <ScrollArea className="w-64 sm:w-auto">
                      <div className="flex p-2 sm:flex-col">
                        {hours.reverse().map((hour) => (
                          <Button
                            key={hour}
                            size="icon"
                            variant={
                              editDate && editDate.getHours() % 12 === hour % 12
                                ? 'default'
                                : 'ghost'
                            }
                            className="aspect-square shrink-0 sm:w-full"
                            onClick={() => handleTimeChange('hour', hour.toString())}
                          >
                            {hour}
                          </Button>
                        ))}
                      </div>
                      <ScrollBar orientation="horizontal" className="sm:hidden" />
                    </ScrollArea>
                    <ScrollArea className="w-64 sm:w-auto">
                      <div className="flex p-2 sm:flex-col">
                        {Array.from({ length: 12 }, (_, i) => i * 5).map((minute) => (
                          <Button
                            key={minute}
                            size="icon"
                            variant={
                              editDate && editDate.getMinutes() === minute ? 'default' : 'ghost'
                            }
                            className="aspect-square shrink-0 sm:w-full"
                            onClick={() => handleTimeChange('minute', minute.toString())}
                          >
                            {minute}
                          </Button>
                        ))}
                      </div>
                      <ScrollBar orientation="horizontal" className="sm:hidden" />
                    </ScrollArea>
                    <ScrollArea className="w-64 sm:w-auto">
                      <div className="flex p-2 sm:flex-col">
                        {['AM', 'PM'].map((ampm) => (
                          <Button
                            key={ampm}
                            size="icon"
                            variant={
                              editDate &&
                              ((ampm === 'AM' && editDate.getHours() < 12) ||
                                (ampm === 'PM' && editDate.getHours() >= 12))
                                ? 'default'
                                : 'ghost'
                            }
                            className="aspect-square shrink-0 sm:w-full"
                            onClick={() => handleTimeChange('ampm', ampm)}
                          >
                            {ampm}
                          </Button>
                        ))}
                      </div>
                      <ScrollBar orientation="horizontal" className="sm:hidden" />
                    </ScrollArea>
                  </div>
                </PopoverContent>
              </Popover>
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
