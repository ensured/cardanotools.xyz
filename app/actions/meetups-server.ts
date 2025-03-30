'use server'

import { auth } from '@clerk/nextjs/server'
import { kv } from '@vercel/kv'

export interface Meetup {
  id: string
  title: string
  description: string
  date: number
  spotId: string
  spotName: string
  createdBy: string
  participants: string[]
  createdAt: number
}

export async function createMeetupServer(
  meetup: Omit<Meetup, 'id' | 'createdAt' | 'participants'>,
) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const id = crypto.randomUUID()
  const now = Date.now()

  const newMeetup: Meetup = {
    ...meetup,
    id,
    createdAt: now,
    participants: [userId],
    createdBy: userId,
  }

  await kv.set(`meetup:${id}`, newMeetup)
  await kv.lpush(`spot:${meetup.spotId}:meetups`, id)
  await kv.lpush(`user:${userId}:meetups`, id)

  return newMeetup
}

export async function getMeetupsServer(spotId: string) {
  const meetupIds = await kv.lrange(`spot:${spotId}:meetups`, 0, -1)
  const meetups = await Promise.all(
    meetupIds.map(async (id) => {
      const meetup = await kv.get<Meetup>(`meetup:${id}`)
      return meetup
    }),
  )

  const now = Date.now()
  const oneDayInMs = 12 * 60 * 60 * 1000 // 12 hours in milliseconds

  // Filter out expired meetups and delete them
  const validMeetups = meetups.filter((m): m is Meetup => {
    if (!m) return false
    const isExpired = m.date + oneDayInMs < now
    if (isExpired) {
      // Delete the expired meetup and its references
      kv.del(`meetup:${m.id}`)
      kv.lrem(`spot:${m.spotId}:meetups`, 0, m.id)
      kv.lrem(`user:${m.createdBy}:meetups`, 0, m.id)
      // Remove meetup from all participants' lists
      m.participants.forEach((participantId) => {
        kv.lrem(`user:${participantId}:meetups`, 0, m.id)
      })
    }
    return !isExpired
  })

  return validMeetups
}

export async function joinMeetupServer(meetupId: string) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const meetup = await kv.get<Meetup>(`meetup:${meetupId}`)
  if (!meetup) throw new Error('Meetup not found')

  if (meetup.participants.includes(userId)) {
    throw new Error('Already joined')
  }

  meetup.participants.push(userId)
  await kv.set(`meetup:${meetupId}`, meetup)
  await kv.lpush(`user:${userId}:meetups`, meetupId)

  return meetup
}

export async function leaveMeetupServer(meetupId: string) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const meetup = await kv.get<Meetup>(`meetup:${meetupId}`)
  if (!meetup) throw new Error('Meetup not found')

  if (!meetup.participants.includes(userId)) {
    throw new Error('Not joined')
  }

  meetup.participants = meetup.participants.filter((id) => id !== userId)
  await kv.set(`meetup:${meetupId}`, meetup)
  await kv.lrem(`user:${userId}:meetups`, 0, meetupId)

  return meetup
}

export async function deleteMeetupServer(meetupId: string) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const meetup = await kv.get<Meetup>(`meetup:${meetupId}`)
  if (!meetup) throw new Error('Meetup not found')

  // Check if user is creator or admin
  if (meetup.createdBy !== userId) {
    const isAdmin = await kv.get<boolean>(`admin:${userId}`)
    if (!isAdmin) throw new Error('Unauthorized')
  }

  // Delete meetup and its references
  await kv.del(`meetup:${meetupId}`)
  await kv.lrem(`spot:${meetup.spotId}:meetups`, 0, meetupId)
  await kv.lrem(`user:${meetup.createdBy}:meetups`, 0, meetupId)

  // Remove meetup from all participants' lists
  for (const participantId of meetup.participants) {
    await kv.lrem(`user:${participantId}:meetups`, 0, meetupId)
  }

  return meetup
}

export async function editMeetupServer(meetupId: string, updates: Partial<Meetup>) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const meetup = await kv.get<Meetup>(`meetup:${meetupId}`)
  if (!meetup) throw new Error('Meetup not found')

  // Check if user is creator
  if (meetup.createdBy !== userId) {
    throw new Error('Unauthorized')
  }

  // Update meetup with new values
  const updatedMeetup: Meetup = {
    ...meetup,
    ...updates,
  }

  await kv.set(`meetup:${meetupId}`, updatedMeetup)

  return updatedMeetup
}
