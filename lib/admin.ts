'use server'

import { currentUser } from '@clerk/nextjs/server'

export async function isAdmin() {
  const user = await currentUser()
  if (!user) return false

  return user.emailAddresses.some((email) => email.emailAddress === process.env.ADMIN_EMAIL)
}
