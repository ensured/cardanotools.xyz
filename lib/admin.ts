import { currentUser } from '@clerk/nextjs/server'

export async function isAdmin() {
  const user = await currentUser()
  const userEmail = user?.emailAddresses[0]?.emailAddress
  return userEmail === process.env.ADMIN_EMAIL
}
