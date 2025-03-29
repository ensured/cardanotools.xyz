'use client'

import * as React from 'react'
import { format } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DayPicker } from 'react-day-picker'

interface DateTimePickerProps {
  date: Date | null
  setDate: (date: Date | null) => void
}

export function DateTimePicker({ date, setDate }: DateTimePickerProps) {
  const [selectedHour, setSelectedHour] = React.useState<string>('12')
  const [selectedMinute, setSelectedMinute] = React.useState<string>('00')
  const [selectedPeriod, setSelectedPeriod] = React.useState<'AM' | 'PM'>('AM')
  const isUserInteraction = React.useRef(false)

  // Generate hours (1-12)
  const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'))
  // Generate minutes (00-59)
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'))

  // Handle date changes from calendar
  const handleDateSelect: (day: Date | undefined) => void = (day) => {
    if (day) {
      const newDate = new Date(day)
      // Preserve the current time if it exists
      if (date) {
        newDate.setHours(date.getHours(), date.getMinutes())
      } else {
        // Set default time to current time
        const now = new Date()
        newDate.setHours(now.getHours(), now.getMinutes())
      }
      setDate(newDate)
    } else {
      setDate(null)
    }
  }

  // Handle time component changes
  const handleTimeChange = (type: 'hour' | 'minute' | 'period', value: string) => {
    isUserInteraction.current = true
    if (type === 'hour') {
      setSelectedHour(value)
    } else if (type === 'minute') {
      setSelectedMinute(value)
    } else if (type === 'period') {
      setSelectedPeriod(value as 'AM' | 'PM')
    }
  }

  // Update time components when date changes (only if not from user interaction)
  React.useEffect(() => {
    if (date && !isUserInteraction.current) {
      const hours = date.getHours()
      const minutes = date.getMinutes()

      // Convert to 12-hour format
      let hours12 = hours % 12
      if (hours12 === 0) hours12 = 12
      const period = hours >= 12 ? 'PM' : 'AM'

      setSelectedHour(hours12.toString().padStart(2, '0'))
      setSelectedMinute(minutes.toString().padStart(2, '0'))
      setSelectedPeriod(period)
    }
    isUserInteraction.current = false
  }, [date])

  // Update the date when time components change
  React.useEffect(() => {
    if (date && isUserInteraction.current) {
      const newDate = new Date(date)
      const hour = parseInt(selectedHour)
      const minute = parseInt(selectedMinute)
      const period = selectedPeriod

      // Convert to 24-hour format
      let hours24 = hour
      if (period === 'PM' && hour !== 12) {
        hours24 = hour + 12
      } else if (period === 'AM' && hour === 12) {
        hours24 = 0
      }

      newDate.setHours(hours24, minute)
      setDate(newDate)
    }
  }, [selectedHour, selectedMinute, selectedPeriod, date, setDate])

  return (
    <div className="flex flex-col gap-2">
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
            {date ? format(date, 'PPP') : <span>Pick a date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date || undefined}
            onSelect={handleDateSelect}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      <div className="flex gap-2">
        <Select value={selectedHour} onValueChange={(value) => handleTimeChange('hour', value)}>
          <SelectTrigger className="w-[80px]">
            <SelectValue placeholder="Hour" />
          </SelectTrigger>
          <SelectContent>
            {hours.map((hour) => (
              <SelectItem key={hour} value={hour}>
                {hour}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedMinute} onValueChange={(value) => handleTimeChange('minute', value)}>
          <SelectTrigger className="w-[80px]">
            <SelectValue placeholder="Minute" />
          </SelectTrigger>
          <SelectContent>
            {minutes.map((minute) => (
              <SelectItem key={minute} value={minute}>
                {minute}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedPeriod} onValueChange={(value) => handleTimeChange('period', value)}>
          <SelectTrigger className="w-[80px]">
            <SelectValue placeholder="AM/PM" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AM">AM</SelectItem>
            <SelectItem value="PM">PM</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
