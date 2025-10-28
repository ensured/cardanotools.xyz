'use client'
import { toast } from 'sonner'
import { useState, useEffect, useRef } from 'react'
import { useWallet } from '@/contexts/WalletContext'
import {
  CopyIcon,
  CheckIcon,
  Loader2,
  XIcon,
  Link as LucideLinkIcon,
  CheckCircle,
} from 'lucide-react'
import {
  storeWebhookIdInVercelKV,
  getWebhookData,
  getWebhooksCount,
  WebhookData,
  removeWebhookEmail,
} from '../actions'
import Button3D from '@/components/3dButton'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'

const WEBHOOK_ID_KEY = 'lastWebhookId'

const isValidUUID = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

// Add email validation
const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

interface WebhookRegistrationFormProps {
  webhookId: string
  setWebhookId: (webhookId: string) => void
  email: string
  setEmail: (email: string) => void
  isSubmitting: boolean
  registrationStatus: 'idle' | 'success' | 'error'
  errorMessage: string
  setRegistrationStatus: (status: 'idle' | 'success' | 'error') => void
  setWebhookExists: (exists: boolean) => void
  handleSubmit: (e: React.FormEvent) => Promise<void>
  handleWebhookIdChange: (webhookId: string) => void
  webhookExists: boolean
  emailAddressInputRef: React.RefObject<HTMLInputElement>
}

const WebhookRegistrationForm = (props: WebhookRegistrationFormProps) => {
  const handleRemoveEmail = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!props.webhookId || !isValidUUID(props.webhookId)) {
      toast.error('Invalid Webhook ID', {
        position: 'bottom-center',
      })
      return
    }

    try {
      const result = await removeWebhookEmail(props.webhookId)
      if (result.success) {
        toast.success('Email removed successfully. You will no longer receive notifications.', {
          position: 'bottom-center',
        })
        props.setEmail('')
        props.setRegistrationStatus('idle')
        props.emailAddressInputRef.current?.focus()
      } else {
        toast.error(result.error || 'Failed to remove email', {
          position: 'bottom-center',
        })
      }
    } catch (error) {
      console.error('Error removing email:', error)
      toast.error('Failed to remove email', {
        position: 'bottom-center',
      })
    }
  }

  return (
    <form onSubmit={props.handleSubmit} className="space-y-6 sm:space-y-8 lg:space-y-4">
      <div className="relative">
        <div className="absolute inset-0 -z-10 rounded-xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10" />
        <label className="block">
          {isValidUUID(props.webhookId) && props.registrationStatus === 'success' && (
            <div className="absolute -inset-[2px] animate-pulse rounded-xl bg-gradient-to-r from-emerald-400/40 to-teal-400/40" />
          )}
          <div className="relative px-4 py-2">
            <label className="block text-lg font-medium sm:text-xl lg:text-2xl">
              {isValidUUID(props.webhookId) ? (
                <span className="flex items-center gap-2 text-emerald-400">
                  Webhook ID <CheckIcon className="size-5 text-success" />
                </span>
              ) : (
                <span className="flex items-center gap-2 text-rose-400">
                  Webhook ID <XIcon className="size-5" />
                </span>
              )}
              <Input
                type="text"
                value={props.webhookId}
                placeholder="35bb67f5-a262-41f0-b22d-6525e8c7cf8b"
                onChange={(e) => {
                  props.setWebhookId(e.target.value)
                  props.handleWebhookIdChange(e.target.value)
                }}
                className="mt-2 border-2 border-border/50 bg-background/80 text-base transition-all hover:border-primary/30 focus:border-primary/50 sm:text-lg lg:text-xl"
                required
              />
            </label>
          </div>
        </label>

        <div className="relative px-4 py-2">
          <label className="mb-1.5 block text-lg font-medium sm:text-xl lg:text-2xl">
            <span className="flex items-center gap-2">
              Email Address
              {isValidEmail(props.email) ? (
                <CheckIcon className="size-5 text-emerald-400" />
              ) : (
                <XIcon className="size-5 text-rose-400" />
              )}
            </span>
            <Input
              type="email"
              value={props.email}
              ref={props.emailAddressInputRef}
              placeholder="your@email.com"
              onChange={(e) => props.setEmail(e.target.value)}
              className="mt-1.5 border border-border/80 text-base sm:text-lg lg:text-xl"
              required
            />
          </label>
          <p className="mt-1.5 text-sm text-muted-foreground sm:text-base lg:text-lg">
            Transaction notifications will be sent to this email address
          </p>
        </div>
      </div>

      {props.registrationStatus === 'error' && (
        <div className="bg-error/10 text-error rounded-md p-2.5 text-sm sm:p-3 sm:text-base lg:text-lg">
          ❌ Error: {props.errorMessage}
        </div>
      )}

      <Button3D
        className="mt-4 w-full bg-gradient-to-r from-indigo-400 to-purple-300 p-5 text-lg font-medium text-background transition-all hover:scale-[1.02] hover:shadow-[0_0_25px_-5px_rgba(99,102,241,0.4)] sm:text-xl lg:text-2xl"
        disabled={props.isSubmitting}
      >
        {props.isSubmitting && (
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-purple-800 sm:h-6 sm:w-6" />
        )}
        {props.isSubmitting
          ? 'Registering...'
          : props.webhookExists
            ? 'Update Webhook ID'
            : 'Register Webhook ID'}
      </Button3D>

      <div className="mt-4">
        <Button
          variant="destructive"
          onClick={handleRemoveEmail}
          disabled={!props.webhookExists || props.isSubmitting}
          className="w-full text-lg hover:bg-destructive/90"
        >
          {props.isSubmitting ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <XIcon className="mr-2 h-5 w-5" />
          )}
          Remove Email Subscription
        </Button>
        <p className="mt-2 text-sm text-muted-foreground">
          This will stop all email notifications for this Webhook ID
        </p>
      </div>
    </form>
  )
}

const WebhookUrlDisplay = ({
  webhookUrl,
  copied,
  copyToClipboard,
}: {
  webhookUrl: string
  copied: boolean
  copyToClipboard: (e: React.MouseEvent) => void
}) => {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="group relative flex max-w-full items-center justify-between rounded-xl border-2 border-border/50 bg-background/80 p-3 shadow-sm transition-all hover:border-primary/30 hover:shadow-[0_0_15px_-3px_rgba(99,102,241,0.2)] sm:p-4 lg:p-5">
      {/* Hidden input for mobile devices */}
      <input
        ref={inputRef}
        type="text"
        value={webhookUrl}
        readOnly
        className="absolute h-0 w-0 opacity-0"
        aria-hidden="true"
      />

      <code className="flex-1 break-all text-lg sm:text-xl lg:text-2xl">{webhookUrl}</code>
      <button
        onClick={(e) => {
          // Mobile fallback: Select text in hidden input
          inputRef.current?.select()
          inputRef.current?.setSelectionRange(0, 99999)
          copyToClipboard(e)
        }}
        className="ml-3 rounded-lg border-2 border-border/50 bg-accent/20 p-2.5 transition-all hover:bg-accent/40 hover:shadow-sm active:scale-95"
        aria-label="Copy webhook URL"
        type="button"
      >
        {copied ? (
          <CheckIcon className="size-5 animate-pulse text-emerald-400 sm:size-6" />
        ) : (
          <CopyIcon className="size-5 text-primary sm:size-6" />
        )}
      </button>
    </div>
  )
}

const InstructionsList = () => (
  <ol className="mb-6 mt-4 space-y-3 text-lg sm:space-y-4 sm:text-xl lg:space-y-5 lg:text-2xl">
    <li className="flex flex-row items-center gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400/30 to-purple-400/30 text-indigo-300 shadow-sm">
        2
      </span>
      <span className="whitespace-nowrap">Go to </span>
      <Link href="https://blockfrost.io/dashboard/webhooks/add" target="_blank">
        <Button variant="ghost" className="group flex items-center gap-2 px-2 text-lg font-medium">
          <LucideLinkIcon className="h-5 w-5 text-primary transition-transform group-hover:-rotate-12" />
          <span className="whitespace-pre-wrap bg-gradient-to-r from-indigo-600 to-purple-500 bg-clip-text text-left text-transparent dark:from-indigo-300 dark:to-purple-200">
            Blockfrost <br className="hidden sm:inline" />
            Webhooks
          </span>
        </Button>
      </Link>
    </li>
    <li className="flex items-center gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400/30 to-purple-400/30 text-indigo-300 shadow-sm">
        3
      </span>{' '}
      Use this webhook URL as the &lsquo;Endpoint URL&lsquo;
    </li>
    <li className="flex items-center gap-3">
      {' '}
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400/30 to-purple-400/30 text-indigo-300 shadow-sm">
        4
      </span>{' '}
      Choose &lsquo;Cardano Mainnet&lsquo; as Network
    </li>
    <li className="flex items-center gap-3">
      {' '}
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400/30 to-purple-400/30 text-indigo-300 shadow-sm">
        5
      </span>{' '}
      Choose Transaction for &lsquo;Trigger&lsquo;
    </li>
    <li className="flex items-center gap-3">
      {' '}
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400/30 to-purple-400/30 text-indigo-300 shadow-sm">
        6
      </span>{' '}
      Add a trigger condition for recipient equal to your wallet address
    </li>
    <li className="flex items-center gap-3">
      {' '}
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400/30 to-purple-400/30 text-indigo-300 shadow-sm">
        7
      </span>{' '}
      Save Webhook
    </li>
  </ol>
)

const WalletFren = () => {
  const { user } = useUser()
  const userEmail = user?.externalAccounts[0].emailAddress
  const webhookUrl = 'https://cardanotools.xyz/api/transactions-monitor'
  const [webhookId, setWebhookId] = useState('')
  const [email, setEmail] = useState(userEmail || '')
  const [copied, setCopied] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [registrationStatus, setRegistrationStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const { walletState, loading } = useWallet()
  const [userTimezone, setUserTimezone] = useState('UTC')
  const [webhookExists, setWebhookExists] = useState(false)
  const [webhookCount, setWebhookCount] = useState(0)
  const emailAddressInputRef = useRef<HTMLInputElement>(null)
  const [subscriptionActive, setSubscriptionActive] = useState(false)

  useEffect(() => {
    // get the kv webhook email with the webhook id and set the setSubscriptionActive to true if the email is not empty
    const fetchWebhookData = async () => {
      // check if the webhook id is valid
      if (isValidUUID(webhookId)) {
        const webhookData = await getWebhookData(webhookId)
        if (webhookData?.email) {
          setEmail(webhookData.email)
          setSubscriptionActive(true)
        } else {
          setSubscriptionActive(false)
        }
      }
    }
    fetchWebhookData()
  }, [webhookId])

  // Load last used webhook ID from localStorage on mount
  useEffect(() => {
    const savedWebhookId = localStorage.getItem(WEBHOOK_ID_KEY)
    if (savedWebhookId) {
      handleWebhookIdChange(savedWebhookId)
      // Fetch webhook data to get the email
      const fetchWebhookData = async () => {
        const webhookData = await getWebhookData(savedWebhookId)
        if (webhookData?.email) {
          setEmail(webhookData.email)
        }
      }
      fetchWebhookData()
    }
  }, [])

  // Modified handleWebhookIdChange to save to localStorage
  const handleWebhookIdChange = async (newWebhookId: string) => {
    setWebhookId(newWebhookId)

    if (newWebhookId) {
      // Save to localStorage
      localStorage.setItem(WEBHOOK_ID_KEY, newWebhookId)

      const webhookData: WebhookData | null = await getWebhookData(newWebhookId)
      if (webhookData) {
        setRegistrationStatus('success')
        setWebhookExists(true)
      } else {
        setRegistrationStatus('idle')
        setWebhookExists(false)
        // If webhook doesn't exist, remove from localStorage
        localStorage.removeItem(WEBHOOK_ID_KEY)
      }
    } else {
      setRegistrationStatus('idle')
      setWebhookExists(false)
      localStorage.removeItem(WEBHOOK_ID_KEY)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setRegistrationStatus('idle')
    setErrorMessage('')

    try {
      const result = await storeWebhookIdInVercelKV(webhookId, email, userTimezone)

      if (result.success) {
        setRegistrationStatus('success')
        setWebhookExists(true)
        if (result.exists) {
          toast.success('Data updated successfully.', {
            position: 'bottom-center',
          })
          setSubscriptionActive(true)
        } else {
          toast.success('Webhook registered successfully!', {
            position: 'bottom-center',
          })
        }
      } else {
        setRegistrationStatus('error')
        setErrorMessage(result.error || 'Registration failed')
        toast.error(result.error || 'Error registering webhook', {
          position: 'bottom-center',
        })
      }
    } catch (error) {
      setRegistrationStatus('error')
      setErrorMessage('An unexpected error occurred')
      toast.error('Failed to register webhook', {
        position: 'bottom-center',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setUserTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone)
    }
  }, [])

  const copyToClipboard = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    try {
      // Check if we're in a secure context
      if (!window.isSecureContext) {
        toast.error('Clipboard access requires HTTPS', {
          position: 'bottom-center',
          duration: 3000,
        })
        return
      }

      // Modern clipboard API
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(webhookUrl)
      } else {
        // Fallback for older browsers
        const textarea = document.createElement('textarea')
        textarea.value = webhookUrl
        textarea.style.position = 'fixed'
        textarea.style.top = '0'
        textarea.style.left = '0'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()

        const success = document.execCommand('copy')
        document.body.removeChild(textarea)

        if (!success) throw new Error('execCommand failed')
      }

      setCopied(true)

      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Copy error:', err)
      toast.error('Failed to copy - check console', {
        position: 'bottom-center',
        duration: 3000,
        icon: <XIcon className="h-5 w-5 text-rose-400" />,
      })

      // Fallback: Show text for manual copy
      const input = document.createElement('input')
      input.value = webhookUrl
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
    }
  }

  useEffect(() => {
    const fetchWebhookCount = async () => {
      const webhookCount = await getWebhooksCount()
      if (webhookCount.count) {
        setWebhookCount(webhookCount.count)
      }
    }
    fetchWebhookCount()
  }, [])

  const header = (
    <div className="mx-auto mt-4 w-full max-w-4xl px-4">
      <div className="hover:shadow-3xl rounded-3xl bg-gradient-to-br from-indigo-900/40 to-purple-900/40 p-8 shadow-2xl backdrop-blur-lg transition-all sm:p-10 lg:p-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#4f46e510_1px,transparent_1px)] bg-[length:20px_20px] opacity-20" />
        <div className="relative flex flex-col items-center gap-4 text-center">
          <h1 className="bg-gradient-to-r from-indigo-300 to-purple-200 bg-clip-text text-4xl font-bold tracking-tight text-transparent drop-shadow-sm [text-shadow:_0_2px_4px_rgba(0,0,0,0.2)] sm:text-5xl lg:text-6xl">
            Wallet Tracker
          </h1>

          <div className="mt-2 space-y-2">
            {!walletState.walletAddress && !userEmail ? (
              <p className="text-lg text-gray-300 sm:text-xl lg:text-2xl">
                {loading ? (
                  <Loader2 className="ml-4 mt-2 inline-block h-10 w-10 animate-spin text-purple-300 sm:h-12 sm:w-12" />
                ) : (
                  'Connect your wallet or sign in to enable real-time transaction alerts'
                )}
                <br className="hidden sm:block" />
              </p>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="flex flex-wrap items-center justify-center gap-2 text-center">
                  <CheckCircle className="h-6 w-6 shrink-0 text-emerald-400 sm:h-7 sm:w-7" />
                  <p className="text-lg font-medium text-gray-200 sm:text-xl lg:text-2xl">
                    Transaction Monitoring
                  </p>
                </div>
                {webhookCount > 0 && (
                  <p className="text-sm text-gray-400 sm:text-base lg:text-lg">
                    {webhookCount} {webhookCount === 1 ? 'webhook' : 'webhooks'} registered
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  if (!walletState.walletAddress && !userEmail) {
    return header
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-indigo-900/20 to-purple-900/20 pb-8">
      <div className="mx-auto mt-6 w-full max-w-4xl px-4">
        {header}
        <div className="hover:shadow-3xl mt-8 overflow-hidden rounded-2xl border-2 border-border/50 bg-background/80 shadow-2xl backdrop-blur-sm transition-all sm:rounded-3xl">
          <div className="border-b-2 border-border/50 p-6 sm:p-8 lg:p-10">
            <div className="mb-6 flex items-baseline justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold sm:text-xl lg:text-2xl">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400/30 to-purple-400/30 text-indigo-300 shadow-sm">
                  1
                </span>{' '}
                Copy Webhook URL
              </h2>
            </div>
            <WebhookUrlDisplay
              webhookUrl={webhookUrl}
              copied={copied}
              copyToClipboard={copyToClipboard}
            />
            <InstructionsList />
          </div>

          <div className="p-4 sm:p-5 lg:p-6">
            <div className="mb-6 flex items-baseline justify-between">
              <h2 className="text-xl font-semibold sm:text-2xl lg:text-3xl">
                Register your ID{' '}
                {isValidUUID(webhookId) && isValidEmail(email) ? (
                  <>| {subscriptionActive ? '✅ Recieving Emails' : '❌ Not Recieving Emails'}</>
                ) : (
                  ''
                )}
              </h2>
            </div>
            <WebhookRegistrationForm
              emailAddressInputRef={emailAddressInputRef}
              setRegistrationStatus={setRegistrationStatus}
              setWebhookExists={setWebhookExists}
              handleWebhookIdChange={handleWebhookIdChange}
              webhookId={webhookId}
              setWebhookId={setWebhookId}
              email={userEmail ?? email}
              setEmail={setEmail}
              isSubmitting={isSubmitting}
              registrationStatus={registrationStatus}
              errorMessage={errorMessage}
              handleSubmit={handleSubmit}
              webhookExists={webhookExists}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default WalletFren
