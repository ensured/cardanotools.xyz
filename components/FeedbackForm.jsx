'use client'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from './ui/textarea'
import { MessageCircleIcon, SendIcon } from 'lucide-react'
import { toast } from 'sonner'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { Controller } from 'react-hook-form'
import { Input } from './ui/input'
import { Label } from './ui/label'

// Add validation schema
const feedbackSchema = z.object({
  feedback: z
    .string()
    .min(1, 'Feedback cannot be empty')
    .max(2000, 'Feedback cannot exceed 2000 characters'),
  email: z.string().email('Please enter a valid email address').optional(),
})

export function FeedbackForm() {
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm({
    resolver: zodResolver(feedbackSchema),
    defaultValues: { feedback: '', email: '' },
  })

  const onSubmit = async (data) => {
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': window.cardano?.selectedAddress || '',
        },
        body: JSON.stringify({
          feedback: data.feedback,
          email: data.email || undefined,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit feedback')
      }

      reset()
      setIsSubmitted(true)
      setTimeout(() => setIsSubmitted(false), 1600)
    } catch (error) {
      toast.error(error.message)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-10 sm:w-10">
          <MessageCircleIcon className="size-5 sm:size-6" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Feedback</DialogTitle>
        </DialogHeader>
        {isSubmitted ? (
          <div className="p-4 text-center text-green-600">Thank you for your feedback!</div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email (optional)</Label>
              <Controller
                name="email"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    id="email"
                    type="email"
                    placeholder="your.email@example.com"
                    className="w-full"
                  />
                )}
              />
              {errors.email && <p className="text-sm text-red-600">{errors.email.message}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="feedback-text">Your Feedback</Label>
              <Controller
                name="feedback"
                control={control}
                render={({ field }) => (
                  <Textarea
                    {...field}
                    id="feedback-text"
                    placeholder="Your feedback..."
                    className="min-h-[150px] w-full rounded-md border p-2 text-sm"
                  />
                )}
              />
              {errors.feedback && <p className="text-sm text-red-600">{errors.feedback.message}</p>}
            </div>
            <div className="flex justify-end gap-1.5">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Sending...' : 'Send'}
                {!isSubmitting && <SendIcon className="ml-1.5 size-3.5" />}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
