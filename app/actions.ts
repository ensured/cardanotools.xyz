'use server'

import { MAX_FAVORITES } from '@/utils/consts'
import { extractRecipeId } from '@/utils/helper'
import { currentUser } from '@clerk/nextjs/server'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import {
  getDownloadURL,
  getMetadata,
  listAll,
  ref as storageRef,
  uploadBytes,
} from 'firebase/storage'
import { db, deleteObject, storage } from '../components/firebase/firebase'
import { kv } from '@vercel/kv'
import { sql } from '@vercel/postgres'
import { revalidatePath } from 'next/cache'

export async function checkUserAuthentication() {
  const user = await currentUser()
  if (!user) return
  return user?.emailAddresses[0].emailAddress
}

export async function removeItemsFirebase(userEmail: string, keys: string[]) {
  if (!userEmail) {
    return { error: 'User email is required' }
  }

  // remove all keys from firebase db
  const res = await Promise.all(
    keys.map(async (key) => {
      try {
        const imageFileRef = storageRef(storage, `images/${userEmail}/${key}`)
        await deleteObject(imageFileRef)
      } catch (error) {
        return { error: 'Error deleting item from favorites' }
      }
    }),
  )

  await handleSetMaxImagesCount(false, userEmail, {
    decrement: true,
    amount: keys.length,
  })

  return res
}

export async function getFavoritesFirebase(userEmail: string) {
  const folderRef = storageRef(storage, `images/${userEmail}/`)
  const results = await listAll(folderRef)

  // Create an object to hold the favorite items
  const favorites: {
    [key: string]: { name: string; url: string; link: string }
  } = {}

  // Temporary array to store items along with timeCreated for sorting purposes
  const itemsWithTimeCreated: {
    name: string
    url: string
    link: string
    timeCreated: string
  }[] = []

  // Use Promise.all with map to wait for all download URLs and metadata
  await Promise.all(
    results.items.map(async (itemRef) => {
      try {
        const downloadUrl = await getDownloadURL(itemRef) // Get the download URL of the file
        const metadata = await getMetadata(itemRef) // Get the metadata of the file

        itemsWithTimeCreated.push({
          link: metadata?.customMetadata?.link ?? '',
          name: metadata?.customMetadata?.name ?? '',
          url: downloadUrl,
          timeCreated: metadata.timeCreated, // Add the timeCreated for sorting
        })
      } catch (error) {
        console.error('Error fetching download URL or metadata:', error)
      }
    }),
  )

  // Sort items by timeCreated in ascending order (oldest first)
  itemsWithTimeCreated.sort(
    (a, b) => new Date(a.timeCreated).getTime() - new Date(b.timeCreated).getTime(),
  )

  // Build the favorites object
  itemsWithTimeCreated.forEach(({ name, url, link }) => {
    // Use the link as the key and create an object for the value
    favorites[link] = { name, url, link }
  })

  return favorites // Return the favorites object
}

export async function deleteAllFavoritesFirebase(userKey: string) {
  if (!userKey) {
    return { error: 'No valid address or user email found' }
  }

  const key = `images/${userKey}/`
  const userFolderRef = storageRef(storage, key)

  try {
    // List all items in the user's folder
    const result = await listAll(userFolderRef)
    const itemsCount = result.items.length

    // Loop through all files and delete them
    const deletePromises = result.items.map((fileRef) => {
      return deleteObject(fileRef)
    })

    // Wait for all delete operations to complete
    await Promise.all(deletePromises)

    // Call function to reset image count
    await handleSetMaxImagesCount(true, userKey)

    // Return an object with total items deleted
    return { total: itemsCount } // << Change here: return an object
  } catch (err) {
    console.error('Error deleting all favorites:', err)
    return { error: 'Failed to delete all favorites.' }
  }
}

export async function removeFavoriteFirebase(recipeName: string, needFormatting: boolean = true) {
  const userEmail = await checkUserAuthentication()
  if (!userEmail) {
    return { error: 'User email is required' }
  }

  let key
  if (needFormatting) {
    key = `images/${userEmail}/${extractRecipeId(recipeName)}`
  } else {
    key = `images/${userEmail}/${recipeName}`
  }

  // Create a reference to the file to delete
  const imageRef = storageRef(storage, key)

  try {
    // Delete the image from Firebase Storage
    await deleteObject(imageRef)
    await handleSetMaxImagesCount(false, userEmail, { decrement: true })
    return {
      success: true,
    }
  } catch (error) {
    console.error('Error deleting image:', error)
    return {
      success: false,
      error: 'Failed to delete image, try again.',
    }
  }
}

interface SetMaxImagesCountOptions {
  increment?: boolean
  decrement?: boolean
  amount?: number
}

const handleSetMaxImagesCount = async (
  delAll: boolean,
  userKey: string,
  options: SetMaxImagesCountOptions = {},
) => {
  const { increment = false, decrement = false, amount = 1 } = options

  // Firestore reference to the user's document
  const userDocRef = doc(db, 'users', userKey)

  if (delAll) {
    // If delAll is true, reset the image count to 0
    await setDoc(userDocRef, { imageCount: 0 }, { merge: true })
    return
  }

  // Get the current image count from Firestore
  const userDoc = await getDoc(userDocRef)
  const currentImageCount = userDoc.exists() ? userDoc.data().imageCount : 0

  // Handle increment logic
  if (increment) {
    if (currentImageCount >= MAX_FAVORITES) {
      return {
        error: `Maximum limit of ${MAX_FAVORITES} favorites reached. Remove some to add more.`,
      }
    }
    // Increment the image count by the specified amount
    await setDoc(
      userDocRef,
      { imageCount: Math.min(currentImageCount + amount, MAX_FAVORITES) }, // Prevent going over MAX_FAVORITES
      { merge: true },
    )
    return
  }

  // Handle decrement logic
  if (decrement) {
    if (currentImageCount === 0) {
      return {
        error: 'Cannot decrement. The image count is already at 0.',
      }
    }
    // Decrement the image count by the specified amount, ensuring it doesn't go below 0
    await setDoc(
      userDocRef,
      { imageCount: Math.max(currentImageCount - amount, 0) },
      { merge: true },
    )
    return
  }

  // Error handling for both increment and decrement being true
  if (increment && decrement) {
    console.error('Both increment and decrement cannot be true at the same time.')
    return {
      error: 'Both increment and decrement cannot be true at the same time.',
    }
  }
}

// Add this new server action
export async function addItemsFirebase(
  userKey: string,
  items: Array<{
    name: string
    url: string
    link: string
    metadata: any
  }>,
) {
  if (!userKey) {
    return { error: 'User key is required' }
  }

  try {
    // Get current favorites count
    const userDocRef = doc(db, 'users', userKey)
    const userDoc = await getDoc(userDocRef)
    const currentImageCount = userDoc.exists() ? userDoc.data().imageCount : 0

    // Calculate how many items we can actually add
    const remainingSlots = MAX_FAVORITES - currentImageCount
    if (remainingSlots <= 0) {
      return {
        error: `Maximum limit of ${MAX_FAVORITES} favorites reached.`,
        results: items.map((item) => ({
          success: false,
          link: item.link,
          error: 'Maximum favorites limit reached',
        })),
      }
    }

    // Only process items that fit within the limit
    const itemsToProcess = items.slice(0, remainingSlots)

    // Fetch all images in parallel
    const imagePromises = itemsToProcess.map(async ({ url }) => {
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch image')
      return response.blob()
    })

    // Wait for all image fetches to complete
    const imageBlobs = await Promise.all(imagePromises)

    // Process uploads in batches of 5 to avoid overwhelming the server
    const batchSize = 5
    const results = []

    for (let i = 0; i < itemsToProcess.length; i += batchSize) {
      const batch = itemsToProcess.slice(i, i + batchSize)
      const batchBlobs = imageBlobs.slice(i, i + batchSize)

      const batchPromises = batch.map(async ({ name, link, metadata }, index) => {
        try {
          const imageRef = storageRef(storage, `images/${userKey}/${extractRecipeId(link)}`)

          const uploadResult = await uploadBytes(imageRef, batchBlobs[index], metadata)
          const downloadUrl = await getDownloadURL(uploadResult.ref)

          return {
            success: true,
            link,
            url: downloadUrl,
            name,
          }
        } catch (error) {
          return {
            success: false,
            link,
            error: 'Failed to upload image',
          }
        }
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
    }

    // Add failed results for items that weren't processed due to limit
    const allResults = [
      ...results,
      ...items.slice(remainingSlots).map((item) => ({
        success: false,
        link: item.link,
        error: 'Exceeded maximum favorites limit',
      })),
    ]

    // Update the image count in a single operation
    const successfulUploads = results.filter((r) => r.success).length
    if (successfulUploads > 0) {
      await setDoc(
        userDocRef,
        { imageCount: currentImageCount + successfulUploads },
        { merge: true },
      )
    }

    return {
      results: allResults,
      successCount: successfulUploads,
      partialSuccess: itemsToProcess.length < items.length,
      message:
        itemsToProcess.length < items.length
          ? `Only ${successfulUploads} items were added due to favorites limit`
          : undefined,
    }
  } catch (error) {
    console.error('Error in batch upload:', error)
    return {
      error: 'Failed to process batch upload',
      results: items.map((item) => ({
        success: false,
        link: item.link,
        error: 'Batch upload failed',
      })),
    }
  }
}

// Modify the getImagesBase64 function to report progress
export async function getImagesBase64(urls: string[]) {
  try {
    // Process all images in parallel
    const imagePromises = urls.map(async (url) => {
      try {
        const response = await fetch(url, {
          headers: {
            Accept: 'image/webp,image/jpeg,image/png,image/*',
          },
          cache: 'force-cache',
        })

        if (!response.ok) {
          return [url, null]
        }

        const contentType = response.headers.get('content-type') || 'image/jpeg'
        const buffer = await response.arrayBuffer()
        const base64 = `data:${contentType};base64,${Buffer.from(buffer).toString('base64')}`

        return [url, base64]
      } catch (error) {
        console.error('Error processing image:', url, error)
        return [url, null]
      }
    })

    // Wait for all images to be processed
    const results = await Promise.all(imagePromises)

    // Convert results array to object, filtering out failed images
    return Object.fromEntries(results.filter(([_, base64]) => base64 !== null))
  } catch (error) {
    console.error('Error in batch image processing:', error)
    return {}
  }
}

export async function getEpochData() {
  const blockfrostApiKey = process.env.BLOCKFROST_API_KEY
  if (!blockfrostApiKey) {
    return { error: 'Blockfrost API key not found' }
  }
  try {
    const url = `https://cardano-mainnet.blockfrost.io/api/v0/epochs/latest`
    const response = await fetch(url, {
      headers: {
        project_id: blockfrostApiKey,
      },
    })
    const data = await response.json()
    // console.log('epoch: ', data.epoch, 'start_time: ', data.start_time, 'tx_count: ', data.tx_count)
    return data
  } catch (error) {
    console.error('Error fetching epoch data:', error)
    return { error: 'Failed to fetch epoch data' }
  }
}

const cache: { [key: string]: { data: any; timestamp: number } } = {}
const RATE_LIMIT = 3 // Maximum number of requests allowed
const RATE_LIMIT_WINDOW_MS = 12000 // Time window in milliseconds (20 seconds)
let requestCount = 0 // Counter for requests
let firstRequestTime: number | null = null // Timestamp of the first request in the current window

export const getAddressFromHandle = async (handleName: string) => {
  let error = null

  // Check if the handleName starts with $
  if (handleName.startsWith('$')) {
    handleName = handleName.slice(1)
  }
  const lowerCaseHandleName = handleName.toLowerCase()

  // Check cache first
  if (cache[lowerCaseHandleName]) {
    const cachedData = cache[lowerCaseHandleName]
    // Return cached data if it's still valid
    return cachedData.data
  }

  // Rate limiting logic
  const now = Date.now()
  if (firstRequestTime === null || now - firstRequestTime > RATE_LIMIT_WINDOW_MS) {
    // Reset the counter and timestamp if the time window has passed
    firstRequestTime = now
    requestCount = 0
  }

  if (requestCount >= RATE_LIMIT) {
    // Calculate time left until the next request can be made
    const timeLeft = RATE_LIMIT_WINDOW_MS - (now - firstRequestTime)
    return {
      error: `Rate limit exceeded. Please try again in ${Math.ceil(timeLeft / 1000)} seconds.`,
    }
  }

  // Increment the request count
  requestCount++

  const url = `https://api.handle.me/handles/${lowerCaseHandleName}`
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
    },
    next: {
      revalidate: 120,
    },
  })

  // Check if the response indicates a rate limit error
  if (response.status === 429) {
    // Rate limit exceeded
    const retryAfter = response.headers.get('Retry-After') // Get the retry time from headers if available
    return {
      error: 'Rate limit exceeded. Please try again later.',
      timeLeft: retryAfter ? parseInt(retryAfter, 10) : null, // Return time left if provided
    }
  }

  const data = await response.json()

  if (data.error) {
    error = data.error
  }
  let stakeAddress, image, address
  try {
    stakeAddress = data.holder
    image = data.image
    address = data.resolved_addresses.ada
  } catch (error) {
    return { error: 'No $handle found' }
  }

  const errors: string[] = []

  if (!stakeAddress) {
    errors.push('No stake address found')
  }

  if (!address) {
    errors.push('No address found')
  }

  if (!image) {
    errors.push('No image found')
  }

  // Check if there are any errors
  if (errors.length > 0) {
    return { error: 'error something went wrong' } // Return all error messages as a single string
  }

  // Cache the result
  cache[lowerCaseHandleName] = {
    data: { stakeAddress, image, address, error },
    timestamp: Date.now(),
  }

  return { stakeAddress, image, address, error }
}

// interface WalletAuth {
// 	stakeKey: string
// 	timestamp: number
// }

// export async function storeWalletAuth(
// 	stakeKey: string,
// 	timestamp: number,
// ): Promise<{ success: boolean; error?: string }> {
// 	try {
// 		const authData: WalletAuth = {
// 			stakeKey,
// 			timestamp,
// 		}

// 		// Convert CARDANO_WALLET_MAX_AGE from milliseconds to seconds for KV storage
// 		const expirationInSeconds = Math.floor(CARDANO_WALLET_MAX_AGE / 1000)

// 		// Store in KV with expiration in seconds
// 		await kv.set(`wallet:${stakeKey}`, authData, { ex: expirationInSeconds })

// 		// Verify it was stored
// 		const stored = await getWalletAuth(stakeKey)
// 		if (!stored) {
// 			return { success: false, error: 'Failed to verify storage' }
// 		}

// 		return { success: true }
// 	} catch (error) {
// 		console.error('Error storing wallet auth:', error)
// 		return { success: false, error: 'Failed to store wallet authentication' }
// 	}
// }

// export const getWalletAuth = async (stakeKey: string) => {
// 	try {
// 		const walletAuth = await kv.get(`wallet:${stakeKey}`)

// 		if (!walletAuth) {
// 			return { error: 'No auth found' }
// 		}

// 		// Type guard to ensure walletAuth has the correct shape
// 		if (!isWalletAuth(walletAuth)) {
// 			console.error('Invalid wallet auth format')
// 			await kv.del(`wallet:${stakeKey}`)
// 			return { error: 'Invalid auth format' }
// 		}

// 		const expirationTime = walletAuth.timestamp + CARDANO_WALLET_MAX_AGE
// 		const hasExpired = Date.now() > expirationTime

// 		if (hasExpired) {
// 			console.log('Auth has expired')
// 			await kv.del(`wallet:${stakeKey}`)
// 			return {
// 				error: 'Auth expired',
// 				expiredAt: new Date(expirationTime).toISOString(),
// 			}
// 		}

// 		return {
// 			...walletAuth,
// 			expiresAt: new Date(expirationTime).toISOString(),
// 		}
// 	} catch (error) {
// 		return { error: 'Server error' }
// 	}
// }

// // Type guard function
// function isWalletAuth(auth: any): auth is WalletAuth {
// 	return (
// 		auth && typeof auth === 'object' && 'stakeKey' in auth && 'timestamp' in auth && typeof auth.timestamp === 'number'
// 	)
// }

// export const removeWalletAuth = async (stakeKey: string) => {
// 	await kv.del(`wallet:${stakeKey}`)
// }

type CacheData = {
  addresses: string[]
  timestamp: number
}

const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

// Add this new server action
export async function getContractAddresses(): Promise<{ addresses: string[]; error?: string }> {
  try {
    // Try to get cached data from KV
    const cached = await kv.get('contract-addresses')
    if (cached) {
      const { addresses, timestamp } = cached as CacheData
      if (Date.now() - timestamp < CACHE_DURATION) {
        return { addresses }
      }
    }

    // Fetch fresh data if no cache or expired
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout

    try {
      const response = await fetch(
        'https://api.github.com/repos/Cardano-Fans/crfa-offchain-data-registry/contents/dApps',
        {
          headers: {
            Accept: 'application/vnd.github+json',
          },
          signal: controller.signal,
        },
      )

      const files: any[] = await response.json()
      const dAppFiles = files.filter((file: any) => file.name.endsWith('.json'))

      const addresses = new Set<string>()

      for (const file of dAppFiles) {
        const dAppController = new AbortController()
        const dAppTimeoutId = setTimeout(() => dAppController.abort(), 10000) // 10 second timeout for individual files

        try {
          const dAppRes = await fetch(
            `https://raw.githubusercontent.com/Cardano-Fans/crfa-offchain-data-registry/main/dApps/${file.name}`,
            {
              headers: {
                Accept: 'application/vnd.github.raw',
              },
              signal: dAppController.signal,
            },
          )

          const dAppData = await dAppRes.json()

          dAppData.scripts?.forEach((script: any) => {
            script.versions?.forEach((version: any) => {
              if (version.contractAddress) {
                addresses.add(version.contractAddress)
              }
            })
          })
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            console.error(`Timeout processing ${file.name}`)
          } else {
            console.error(`Error processing ${file.name}:`, error)
          }
        } finally {
          clearTimeout(dAppTimeoutId)
        }
      }

      // Cache the new data
      const cacheData: CacheData = {
        addresses: Array.from(addresses),
        timestamp: Date.now(),
      }
      await kv.set('contract-addresses', cacheData, { ex: CACHE_DURATION / 1000 })

      return { addresses: Array.from(addresses) }
    } finally {
      clearTimeout(timeoutId)
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('Timeout fetching GitHub data')
      return { addresses: [], error: 'Request timeout' }
    }
    console.error('Error fetching blacklist:', error)
    return { addresses: [], error: 'Failed to fetch contract addresses' }
  }
}

export const fetchAddressesFromPolicy = async (policyId: string, network: string) => {
  let fetchUrl: string
  if (network === 'preview') {
    fetchUrl = `https://preview.koios.rest/api/v1/policy_asset_addresses?_asset_policy=${policyId}`
  } else {
    fetchUrl = `https://api.koios.rest/api/v1/policy_asset_addresses?_asset_policy=${policyId}`
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout

  try {
    const response = await fetch(fetchUrl, {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${process.env.KOIOS_BEARER_TOKEN}`,
      },
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout')
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function storeWebhookIdInVercelKV(
  webHookId: string,
  email: string,
  userTimezone: string,
): Promise<{
  success: boolean
  webhookId?: string
  error?: string
  exists?: boolean
  userTimezone?: string
}> {
  try {
    // Validate email format
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { success: false, error: 'Invalid email address' }
    }

    // Check if webhook ID already exists
    const existingWebhook = await kv.get(`webhook:${webHookId}`)
    if (existingWebhook) {
      // Update webhook if it exists
      await kv.set(`webhook:${webHookId}`, {
        id: webHookId,
        email,
        created: (existingWebhook as any).created,
        updated: Date.now(),
        timezone: userTimezone,
      })
      return {
        success: true,
        webhookId: webHookId,
        exists: true,
        userTimezone,
      }
    }

    // Store new webhook in Vercel KV
    await kv.set(`webhook:${webHookId}`, {
      id: webHookId,
      email,
      created: Date.now(),
      updated: Date.now(),
      timezone: userTimezone,
    })

    // Verify storage
    const webhook = await kv.get(`webhook:${webHookId}`)
    if (!webhook) {
      return { success: false, error: 'Failed to verify storage' }
    }

    return {
      success: true,
      webhookId: webHookId,
      exists: false,
      userTimezone,
    }
  } catch (error) {
    console.error('Webhook creation failed:', error)
    return { success: false, error: 'Internal server error' }
  }
}

export async function validateWebhookId(blockfrostAuthKey: string) {
  const webhook = await kv.get(`webhook:${blockfrostAuthKey}`)
  if (!webhook) {
    return false
  }
  return true
}

export interface WebhookData {
  id: string
  email: string
  timezone: string
  created: number
  updated: number
}

export async function getWebhookData(webhookId: string): Promise<WebhookData | null> {
  try {
    const webhook = await kv.get(`webhook:${webhookId}`)
    return webhook as WebhookData | null
  } catch (error) {
    console.error('Error fetching webhook data:', error)
    return null
  }
}

export async function getWebhooksCount() {
  try {
    // Get all keys that start with 'webhook:'
    const keys = await kv.keys('webhook:*')
    return { count: keys.length }
  } catch (error) {
    console.error('Error getting webhook count:', error)
    return { count: 0, error: 'Failed to get webhook count' }
  }
}

export async function submitScore(username: string, score: number) {
  try {
    // First check if user already has a score
    const { rows: existingScores } = await sql`
      SELECT id, score
      FROM leaderboard
      WHERE username = ${username}
    `
    let updated_at = null
    let newScore
    if (existingScores.length > 0) {
      // If existing score is lower, update it
      if (existingScores[0].score < score) {
        const {
          rows: [updated],
        } = await sql`
          UPDATE leaderboard
          SET score = ${score}, updated_at = NOW()
          WHERE username = ${username}
          RETURNING id, username, score, created_at, updated_at
        `
        newScore = updated
        updated_at = updated.updated_at
      } else {
        // If existing score is higher, return it with current rank
        newScore = existingScores[0]
      }
    } else {
      // Insert new score if user doesn't have one
      const {
        rows: [inserted],
      } = await sql`
        INSERT INTO leaderboard (username, score)
        VALUES (${username}, ${score})
        RETURNING id, username, score, created_at, updated_at
      `
      newScore = inserted
    }

    // Get the rank of the score
    const {
      rows: [rank],
    } = await sql`
      SELECT rank
      FROM (
        SELECT username, score,
        RANK() OVER (ORDER BY score DESC) as rank
        FROM leaderboard
      ) rankings
      WHERE username = ${username}
    `

    revalidatePath('/game')
    return {
      success: true,
      data: newScore,
      rank: rank.rank,
      updated_at: updated_at,
    }
  } catch (error) {
    console.error('Error saving score:', error)
    return { success: false, error: 'Failed to save score' }
  }
}

export async function getLeaderboard() {
  try {
    const { rows } = await sql`
      SELECT username, score, created_at, updated_at
      FROM leaderboard
      ORDER BY score DESC
      LIMIT 100
    `
    return { success: true, data: rows }
  } catch (error) {
    console.error('Error fetching leaderboard:', error)
    return { success: false, error: 'Failed to fetch leaderboard' }
  }
}

export async function removeWebhookEmail(
  webhookId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Delete the email from the webhook entry from KV
    const webhook = await kv.get(`webhook:${webhookId}`)
    if (!webhook) {
      return { success: false, error: 'Webhook not found' }
    }
    await kv.set(`webhook:${webhookId}`, {
      ...webhook,
      email: '',
      updated: Date.now(),
    })
    // verify email is empty
    const updatedWebhook = await kv.get(`webhook:${webhookId}`)
    if ((updatedWebhook as any).email !== '') {
      return { success: false, error: 'Failed to remove email subscription' }
    }
    return { success: true }
  } catch (error) {
    console.error('Error removing webhook email:', error)
    return { success: false, error: 'Failed to remove email subscription' }
  }
}
