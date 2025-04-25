'use server'

import { currentUser } from '@clerk/nextjs/server'
import { kv } from '@vercel/kv'

interface Report {
  id: string
  userId: string
  reason: string
  createdAt: number
  status: 'pending' | 'reviewed' | 'resolved'
  spotId: string
}

export async function checkAdminStatus() {
  try {
    const user = await currentUser()
    if (!user) {
      return { isAdmin: false, error: 'Unauthorized' }
    }

    const isAdmin = user.emailAddresses.some(
      (email) => email.emailAddress === process.env.ADMIN_EMAIL,
    )
    return { isAdmin, error: null }
  } catch (error) {
    console.error('Error checking admin status:', error)
    return { isAdmin: false, error: 'Internal Server Error' }
  }
}

export async function getReports() {
  try {
    const user = await currentUser()
    if (!user) {
      return { reports: [], error: 'Unauthorized' }
    }

    const isAdmin = user.emailAddresses.some(
      (email) => email.emailAddress === process.env.ADMIN_EMAIL,
    )
    if (!isAdmin) {
      return { reports: [], error: 'Forbidden' }
    }

    const reports = await kv.hgetall('reports')
    if (!reports) {
      return { reports: [], error: null }
    }

    const reportsArray = Object.entries(reports).map(([id, report]) => ({
      id,
      ...(report as Omit<Report, 'id'>),
    }))

    return { reports: reportsArray, error: null }
  } catch (error) {
    console.error('Error fetching reports:', error)
    return { reports: [], error: 'Internal Server Error' }
  }
}

export async function updateReportStatus(reportId: string, status: 'accept' | 'deny') {
  try {
    const user = await currentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const isAdmin = user.emailAddresses.some(
      (email) => email.emailAddress === process.env.ADMIN_EMAIL,
    )
    if (!isAdmin) {
      return { success: false, error: 'Forbidden' }
    }

    const reportData = await kv.hget('reports', reportId)
    if (!reportData) {
      return { success: false, error: 'Report not found' }
    }

    if (status === 'accept') {
      await kv.hdel('points', (reportData as Report).spotId)
    }

    await kv.hdel('reports', reportId)
    return { success: true, error: null }
  } catch (error) {
    console.error('Error updating report status:', error)
    return { success: false, error: 'Internal Server Error' }
  }
}
