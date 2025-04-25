'use server'

import { currentUser } from '@clerk/nextjs/server'

export async function isAdmin() {
  const user = await currentUser()
  const adminEmail = process.env.ADMIN_EMAIL

  if (!user || !adminEmail) return false

  const userEmail = user.primaryEmailAddress?.emailAddress
  return userEmail === adminEmail
}
