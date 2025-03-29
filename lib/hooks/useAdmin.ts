import { useUser } from '@clerk/nextjs'
import { useEffect, useState } from 'react'

export function useAdmin() {
  const { user } = useUser()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const response = await fetch('/api/admin/check')
        setIsAdmin(response.ok)
      } catch (error) {
        setIsAdmin(false)
      }
    }
    checkAdmin()
  }, [user])

  return isAdmin
}
