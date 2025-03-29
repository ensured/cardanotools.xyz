'use client'

import {
  createMeetupServer,
  getMeetupsServer,
  joinMeetupServer,
  leaveMeetupServer,
  deleteMeetupServer,
  editMeetupServer,
  type Meetup,
} from './meetups-server'

export type { Meetup }

export async function createMeetup(meetup: Omit<Meetup, 'id' | 'createdAt' | 'participants'>) {
  return createMeetupServer(meetup)
}

export async function getMeetups(spotId: string) {
  return getMeetupsServer(spotId)
}

export async function joinMeetup(meetupId: string) {
  return joinMeetupServer(meetupId)
}

export async function leaveMeetup(meetupId: string) {
  return leaveMeetupServer(meetupId)
}

export async function deleteMeetup(meetupId: string) {
  return deleteMeetupServer(meetupId)
}

export async function editMeetup(meetupId: string, updates: Partial<Meetup>) {
  return editMeetupServer(meetupId, updates)
}
