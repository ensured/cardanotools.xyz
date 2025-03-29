import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'

interface MeetupDialogProps {
  isOpen: boolean
  onClose: () => void
  spotId: string
  spotName: string
  onCreateMeetup: (meetup: {
    title: string
    description: string
    date: Date
    spotId: string
    spotName: string
  }) => Promise<void>
}

export function MeetupDialog({
  isOpen,
  onClose,
  spotId,
  spotName,
  onCreateMeetup,
}: MeetupDialogProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState<Date>()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const hours = Array.from({ length: 12 }, (_, i) => i + 1)

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      setDate(selectedDate)
    }
  }

  const handleTimeChange = (type: 'hour' | 'minute' | 'ampm', value: string) => {
    if (date) {
      const newDate = new Date(date)
      if (type === 'hour') {
        newDate.setHours((parseInt(value) % 12) + (newDate.getHours() >= 12 ? 12 : 0))
      } else if (type === 'minute') {
        newDate.setMinutes(parseInt(value))
      } else if (type === 'ampm') {
        const currentHours = newDate.getHours()
        newDate.setHours(value === 'PM' ? currentHours + 12 : currentHours - 12)
      }
      setDate(newDate)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!date) return

    setIsSubmitting(true)
    try {
      await onCreateMeetup({
        title,
        description,
        date,
        spotId,
        spotName,
      })
      onClose()
    } catch (error) {
      console.error('Error creating meetup:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[90vw] sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Skate Session</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter session title"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter session description"
              required
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
                    !date && 'text-muted-foreground',
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'MM/dd/yyyy hh:mm aa') : <span>MM/DD/YYYY hh:mm aa</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <div className="sm:flex">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={handleDateSelect}
                    initialFocus
                  />
                  <div className="flex flex-col divide-y sm:h-[300px] sm:flex-row sm:divide-x sm:divide-y-0">
                    <ScrollArea className="w-64 sm:w-auto">
                      <div className="flex p-2 sm:flex-col">
                        {hours.reverse().map((hour) => (
                          <Button
                            key={hour}
                            size="icon"
                            variant={
                              date && date.getHours() % 12 === hour % 12 ? 'default' : 'ghost'
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
                            variant={date && date.getMinutes() === minute ? 'default' : 'ghost'}
                            className="aspect-square shrink-0 sm:w-full"
                            onClick={() => handleTimeChange('minute', minute.toString())}
                          >
                            {minute}
                          </Button>
                        ))}
                      </div>
                      <ScrollBar orientation="horizontal" className="sm:hidden" />
                    </ScrollArea>
                    <ScrollArea className="">
                      <div className="flex p-2 sm:flex-col">
                        {['AM', 'PM'].map((ampm) => (
                          <Button
                            key={ampm}
                            size="icon"
                            variant={
                              date &&
                              ((ampm === 'AM' && date.getHours() < 12) ||
                                (ampm === 'PM' && date.getHours() >= 12))
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
                    </ScrollArea>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !date}>
              {isSubmitting ? 'Creating...' : 'Create Session'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
