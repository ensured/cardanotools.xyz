'use client'

import { useWallet, WalletContextType } from '@/contexts/WalletContext'
import Image from 'next/image'
import { useState, useEffect, Fragment, useCallback } from 'react'
import Button3D from './3dButton'
import Link from 'next/link'
import { Input } from './ui/input'
import poolPmIco from '../public/poolpm.ico'
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from './ui/dropdown-menu'
import { Button } from './ui/button'
import { toast } from 'sonner'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog'
import {
  Check,
  ChevronDown,
  Loader2,
  Plus,
  X,
  Trash2,
  Info,
  Code,
  Upload,
  File,
  CheckSquare,
  Copy,
  Pencil,
  ExternalLink,
} from 'lucide-react'
import { timeAgoCompact } from '@/lib/helper'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from './ui/tooltip'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible'
import { AlertCircle } from 'lucide-react'
import { Label } from './ui/label'
import { Data, LucidEvolution, UTxO } from '@lucid-evolution/lucid'
import { signData } from '../hooks/useWalletConnect'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from './ui/pagination'
import { Slider } from './ui/slider'
import { Switch } from './ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { WalletState } from '@/hooks/useWalletConnect'
import { useDropzone } from 'react-dropzone'
import { cn } from '@/lib/utils'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { ScrollArea } from '@/components/ui/scroll-area'

type CardanoNetwork = 'Mainnet' | 'Preview' | 'Preprod'
export const CARDANO_NETWORK: CardanoNetwork = 'Mainnet'

export const getLucid = async () => {
  const { Lucid, Blockfrost } = await import('@lucid-evolution/lucid')
  return { Lucid, Blockfrost }
}

const getScriptUtils = async () => {
  const {
    scriptFromNative,
    paymentCredentialOf,
    unixTimeToSlot,
    mintingPolicyToId,
    fromText,
    Data,
  } = await import('@lucid-evolution/lucid')
  return {
    scriptFromNative,
    paymentCredentialOf,
    unixTimeToSlot,
    mintingPolicyToId,
    fromText,
    Data,
  }
}

interface WalletApi {
  getExtensions(): Promise<any>
  getNetworkId(): Promise<number>
  getUsedAddresses(paginate?: any): Promise<string[]>
  getUnusedAddresses(): Promise<string[]>
  getRewardAddresses(): Promise<string[]>
  getChangeAddress(): Promise<string>
  getBalance(): Promise<string>
  getUtxos(amount?: string, paginate?: any): Promise<string[]>
  signTx(tx: string, partialSign?: boolean): Promise<string>
  signData(addr: string, sigStructure: string): Promise<{ signature: string; key: string }>
  submitTx(tx: string): Promise<string>
  getCollateral(): Promise<string[]>
  experimental: any
}

// Add interface for policy info
interface PolicyInfo {
  policyId: string
  keyHash: string
  slot?: number
  script: any
  isGenerated?: boolean
  isUsed?: boolean
}

// Add this interface near the top with other interfaces
interface PinataFile {
  ipfs_pin_hash: string
  metadata?: {
    name?: string
  }
  date_pinned: string
  mime_type?: string
  name?: string
}

// Update the PinataResponse interface to include all files
interface PinataResponse {
  count: number
  rows: PinataFile[]
  filteredRows: PinataFile[] // Add this to store all valid files
}

interface PaginationState {
  currentPage: number
  totalPages: number
  itemsPerPage: number
}

// Update the VALID_IMAGE_MIMES constant to include HTML
const VALID_IMAGE_MIMES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.tiff': 'image/tiff',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.apng': 'image/apng',
  '.html': 'text/html', // Add HTML support
  '.htm': 'text/html', // Add HTM support
}

const VALID_IMAGE_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.avif',
  '.tiff',
  '.tif',
  '.bmp',
  '.ico',
  '.apng',
  '.html',
  '.htm',
]

// const VALID_FILE_ACCEPT = [
//   // Image MIME types
//   ...Object.values(VALID_IMAGE_MIMES),
//   // File extensions (for better browser support)
//   ...VALID_IMAGE_EXTENSIONS.map((ext) => (ext.startsWith('.') ? ext : `.${ext}`)),
// ].join(',')

const VALID_FILE_ACCEPT_FOR_DROPZONE: Record<string, string[]> = {
  'image/*': [
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.svg',
    '.webp',
    '.avif',
    '.tiff',
    '.bmp',
    '.ico',
    '.apng',
  ],
  'application/html': ['.html', '.htm'],
}

// Update the formatSupportedExtensions helper to include HTML
const formatSupportedExtensions = () => {
  return [
    'PNG',
    'JPG/JPEG',
    'GIF',
    'SVG',
    'WEBP',
    'AVIF',
    'TIFF/TIF',
    'BMP',
    'ICO',
    'APNG',
    'HTML/HTM',
  ].join(', ')
}

// Update the validation function to be more robust
const isValidImageFile = (file: File): boolean => {
  // Check MIME type
  if (Object.values(VALID_IMAGE_MIMES).includes(file.type)) {
    return true
  }

  // Fallback to extension check if MIME type is not recognized
  const fileName = file.name.toLowerCase()
  return VALID_IMAGE_EXTENSIONS.some((ext) => fileName.endsWith(ext))
}

// Add this function near the top with other utility functions
const extractSlotFromScript = (script: any): number | undefined => {
  if (!script) return undefined
  if (script.type === 'before') return script.slot
  if (script.scripts?.length) return script.scripts.find((s: any) => s.type === 'before')?.slot
  if (script.json) return extractSlotFromScript(script.json)
  return undefined
}

// Utility function to create a minting policy
const createMintingPolicy = async (lucid: any, selectedPolicy: PolicyInfo, slot: number) => {
  const { scriptFromNative, paymentCredentialOf } = await getScriptUtils()
  const address = await lucid.wallet().address()
  const keyHash = paymentCredentialOf(address).hash

  let mintingPolicy

  if (selectedPolicy.script.type === 'sig') {
    mintingPolicy = scriptFromNative({
      type: 'sig',
      keyHash: selectedPolicy.script.keyHash,
    })
  } else {
    mintingPolicy = scriptFromNative({
      type: 'all',
      scripts: [
        { type: 'sig', keyHash },
        { type: 'before', slot },
      ],
    })
  }

  return mintingPolicy
}

// Update the FileInfo interface
interface FileInfo {
  url: string
  name: string
  customName?: string
  properties?: Record<string, string>
  date_pinned?: string
}

// Add a helper function to check if it's a CIDv0 hash
const isCIDv0 = (hash: string) => {
  // CIDv0 starts with "Qm" and is 46 characters long
  return hash.startsWith('Qm') && hash.length === 46
}

// Add this interface near other interfaces
interface ExpiryConfig {
  hasExpiry: boolean
  days: number
}

// Add this loading skeleton component
const FileGridSkeleton = () => {
  return (
    <div className="grid grid-cols-1 gap-2 p-2 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 24 }).map((_, index) => (
        <div key={index} className="group relative">
          <div className="flex h-full cursor-pointer flex-col rounded-lg border border-border p-2 sm:p-4">
            <div className="flex flex-1 flex-col space-y-1">
              <div className="relative">
                <Skeleton className="h-32 w-full rounded-lg" />
              </div>
              <div className="flex flex-1 flex-col justify-between">
                <div className="space-y-1">
                  <Skeleton className="mt-1 h-5 w-full" />
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-7 w-7 rounded-lg" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// Add props interface
interface FileUploadAreaProps {
  pinataJWT: string | null
  uploadFile: (files: File[]) => Promise<void>
  files: File[]
  setFiles: (files: File[]) => void
  isStepComplete: (step: number) => boolean
  uploading: boolean
}

const FileUploadArea = ({
  pinataJWT,
  uploadFile,
  files,
  setFiles,
  isStepComplete,
  uploading,
}: FileUploadAreaProps) => {
  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (pinataJWT && acceptedFiles.length > 0) {
        await uploadFile(acceptedFiles)
      } else {
        toast.error('Please enter a Pinata JWT and select files', { position: 'bottom-center' })
      }
    },
    [pinataJWT, uploadFile],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: VALID_FILE_ACCEPT_FOR_DROPZONE,
  })

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={cn(
          'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors',
          isDragActive
            ? 'border-primary/50 bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/5',
        )}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center justify-center gap-2 text-center">
          <div
            className={cn(
              'rounded-full p-2 transition-colors flex items-center gap-1.5',
              isDragActive ? 'bg-primary/10' : 'bg-muted',
            )}
          >
              <div className='text-xs text-muted-foreground'>
            Pin to IPFS
            </div>
            <Upload
              className={cn('h-5 w-5', isDragActive ? 'text-primary' : 'text-muted-foreground')}
            />
          </div>
        
          <div className="flex flex-col gap-1">
          
            <p className="text-sm font-medium">
              {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
            </p>
            <p className="text-xs text-muted-foreground">or click to select files</p>
          </div>
        </div>

        {files.length > 0 && (
          <div className="mt-4 flex w-full flex-col gap-2">
            {files.map((file, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-2"
              >
                <div className="flex items-center gap-2">
                  <File className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{file.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    setFiles(files.filter((_, index) => index !== i))
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              disabled={!isStepComplete(1) || uploading || !files.length}
              onClick={() => uploadFile(files)}
              className="mt-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload {files.length} file{files.length > 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Supported formats: {formatSupportedExtensions()}
      </p>
    </div>
  )
}

// Update the truncateFileName function to be more explicit
const truncateFileName = (fileName: string, maxLength: number = 64) => {
  if (fileName.length <= maxLength) return fileName

  if (fileName.length <= maxLength) return fileName

  const extension = fileName.split('.').pop() || ''
  const nameWithoutExt = fileName.slice(0, fileName.lastIndexOf('.'))

  // Calculate how much space we need for the extension
  const extensionLength = extension.length + 1 // +1 for the dot
  // Calculate remaining space for the name
  const maxNameLength = maxLength - extensionLength

  // Truncate the name and add the extension back
  const truncated = `${nameWithoutExt.slice(0, maxNameLength)}.${extension}`
  return truncated
}

// Add this helper function for delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Add this new component for JSON formatting
const JsonPreview: React.FC<{ data: any }> = ({ data }) => {
  return (
    <pre
      className="m-0 rounded-lg bg-[#282c34] p-4 font-mono text-sm text-white"
      style={{ margin: 0, fontSize: '0.85rem' }}
    >
      {JSON.stringify(data, null, 2)}
    </pre>
  );
};

export default function NFTMinter() {
  const [selectedFiles, setSelectedFiles] = useState<FileInfo[]>([])
  const [uploading, setUploading] = useState(false)
  const [pinataJWT, setPinataJWT] = useState<string | null>(null)
  const [blockfrostKey, setBlockfrostKey] = useState<string | null>(null)
  const [generatingPolicy, setGeneratingPolicy] = useState(false)

  const [policyIds, setPolicyIds] = useState<PolicyInfo[]>([])
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyInfo | null>(null)
  const { walletState, loading } = useWallet() as WalletContextType
  const [scanning, setScanning] = useState(false)
  const [minting, setMinting] = useState(false)
  const [nftName, setNftName] = useState('')
  const [nftTitle, setNftTitle] = useState('') // Add this line
  const [nftDescription, setNftDescription] = useState('')
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [showPinataDialog, setShowPinataDialog] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [loadingPolicies, setLoadingPolicies] = useState(false)
  const [openSections, setOpenSections] = useState<number[]>([1])
  const [pinataResponse, setPinataResponse] = useState<PinataResponse>({
    count: 0,
    rows: [],
    filteredRows: [],
  })
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    totalPages: 1,
    itemsPerPage: 24,
  })
  const [lucid, setLucid] = useState<any | null>(null)
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false)
  const [fileToDelete, setFileToDelete] = useState<string | null>(null)
  const [confirmationText, setConfirmationText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [selectedPinataFiles, setSelectedPinataFiles] = useState<PinataFile[]>([])
  const [thumbnailImage, setThumbnailImage] = useState<string | null>(null)
  const [imageNames, setImageNames] = useState<{ [key: string]: string }>({})
  const [expiryConfig, setExpiryConfig] = useState<ExpiryConfig>({
    hasExpiry: true,
    days: 7,
  })
  const [mintQuantity, setMintQuantity] = useState<number>(1)
  const [selectedForDeletion, setSelectedForDeletion] = useState<string[]>([])
  const [isMultiDeleteMode, setIsMultiDeleteMode] = useState(false)
  const [currentStakeAddress, setCurrentStakeAddress] = useState<string | null>(null)
  // Add new state for temporary trait edits
  const [traitEdits, setTraitEdits] = useState<
    Record<string, Record<number, { key: string; value: string }>>
  >({})
  // Add to state

  // Add at the top with other state declarations
  const [lastFetchTime, setLastFetchTime] = useState<number>(0)

  // Add new state at top of component
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false)

  // Add these state variables near your other state declarations

  const formatExpiryTime = (slot?: number) => {
    if (!slot) return null

    // Calculate days remaining
    const currentSlot = lucid?.currentSlot() || 0
    const slotsRemaining = slot - currentSlot
    const daysRemaining = Math.ceil(slotsRemaining / 86400)

    if (slotsRemaining <= 0) return 'Expired'
    if (daysRemaining === 1) return '1 day'
    return `${daysRemaining} days`
  }

  const isStepComplete = (step: number) => {
    switch (step) {
      case 1:
        return Boolean(blockfrostKey && pinataJWT)
      case 2:
        return Boolean(selectedFiles.length > 0)
      case 3:
        return Boolean(selectedPolicy)
      case 4:
        return Boolean(selectedPolicy && nftName && nftTitle && nftDescription && selectedFiles.length > 0)
      default:
        return false
    }
  }

  useEffect(() => {
    if (currentStep === 1 && blockfrostKey && pinataJWT) {
      setCurrentStep(2)
      setOpenSections([2])
    } else if (currentStep === 2 && selectedFiles.length > 0 && thumbnailImage) {
      setCurrentStep(3)
      setOpenSections([3])
    } else if (currentStep === 3 && selectedPolicy) {
      setCurrentStep(4)
      setOpenSections([4])
    }
  }, [blockfrostKey, pinataJWT, selectedFiles, thumbnailImage, currentStep])

  // Load all saved data when component mounts
  useEffect(() => {
    const savedJWT = localStorage.getItem('pinataJWT')
    if (savedJWT) setPinataJWT(savedJWT)

    const savedBlockfrost = localStorage.getItem('blockfrostKey')
    if (savedBlockfrost) setBlockfrostKey(savedBlockfrost)

    if (savedJWT && savedBlockfrost) {
      setCurrentStep(2)
      setOpenSections([2])
    }
  }, [walletState.wallet])

  // Memoize callbacks that don't need to be recreated on every render
  const handleJWTChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setPinataJWT(value)
    localStorage.setItem('pinataJWT', value)
  }, [])

  const handleBlockfrostChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setBlockfrostKey(value)
    localStorage.setItem('blockfrostKey', value)
  }, [])

  const handleNameChange = useCallback((url: string, value: string) => {
    const originalLength = value.length
    const truncated = truncateFileName(value)

    if (originalLength !== truncated.length) {
      toast.info(
        <div className="flex flex-col gap-1">
          <p>Filename has been shortened to meet the 64-character limit.</p>
          <p className="text-xs text-muted-foreground">Original: {value}</p>
          <p className="text-xs text-muted-foreground">Shortened: {truncated}</p>
        </div>,
        { position: 'top-center', duration: 5000 },
      )
    }

    setSelectedFiles((prev) =>
      prev.map((file) => (file.url === url ? { ...file, customName: truncated } : file)),
    )
    setImageNames((prev) => ({ ...prev, [url]: truncated }))
    setNftName(truncated)
  }, [])

  useEffect(() => {
    const initializeWallet = async () => {
      if (walletState.walletAddress) {
        try {
          // initialize lucid and set it in state
          if (blockfrostKey) {
            const { Lucid, Blockfrost } = await getLucid()
            const lucidInstance = await Lucid(
              new Blockfrost(
                `https://cardano-${CARDANO_NETWORK.toLowerCase()}.blockfrost.io/api/v0`,
                blockfrostKey,
              ),
              CARDANO_NETWORK,
            )
            lucidInstance.selectWallet.fromAPI(walletState.api!)
            setLucid(lucidInstance)
          }
        } catch (error) {
          if (error instanceof Error) {
            toast.error(error.message, { position: 'bottom-center' })
          } else {
            toast.error('An unexpected error occurred', { position: 'bottom-center' })
          }
        }
      }

      setInitializing(false)
    }

    initializeWallet()
  }, [walletState.wallet, blockfrostKey])

  // Add polling effect to check stake address
  useEffect(() => {
    if (!walletState.api) return

    const checkStakeAddressAndReconnect = async () => {
      try {
        const rewardAddresses = await walletState.api.getRewardAddresses()
        const stakeAddress = rewardAddresses[0]

        if (stakeAddress && stakeAddress !== currentStakeAddress) {
          setCurrentStakeAddress(stakeAddress)
          setSelectedPolicy(null)
          setPolicyIds([])

          // Reconnect Lucid if needed
          if (blockfrostKey && walletState.api) {
            try {
              const { Lucid, Blockfrost } = await getLucid()
              const lucidInstance = await Lucid(
                new Blockfrost(
                  `https://cardano-${CARDANO_NETWORK.toLowerCase()}.blockfrost.io/api/v0`,
                  blockfrostKey,
                ),
                CARDANO_NETWORK,
              )
              lucidInstance.selectWallet.fromAPI(walletState.api)
              setLucid(lucidInstance)
            } catch (error) {
              console.error('Error reconnecting Lucid:', error)
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('account changed')) {
          if (currentStakeAddress) {
            setSelectedPolicy(null)
            toast.error('Account changed, please reconnect your wallet', {
              position: 'top-center',
            })
            setPolicyIds([])
          }
        } else {
          console.error('Error checking stake address:', error)
        }
      }
    }

    checkStakeAddressAndReconnect()

    // return () => clearInterval(intervalId)
  }, [currentStakeAddress, blockfrostKey, walletState.api])

  // Remove the duplicate wallet checking effect and replace with:
  useEffect(() => {
    const handleWalletStateChange = (event: CustomEvent<WalletState>) => {
      // Handle any UI updates needed when wallet state changes
      if (event.detail.stakeAddress !== currentStakeAddress) {
        setCurrentStakeAddress(event.detail.stakeAddress)
        setSelectedPolicy(null)
        setPolicyIds([])
      }
    }

    window.addEventListener('walletStateChanged', handleWalletStateChange as EventListener)

    return () => {
      window.removeEventListener('walletStateChanged', handleWalletStateChange as EventListener)
    }
  }, [currentStakeAddress, walletState.network])

  const ImageWithFallback = ({
    src,
    alt,
    fileUrl,
    ...props
  }: {
    src: string
    alt: string
    fileUrl?: string
    [key: string]: any
  }) => {
    const [error, setError] = useState(false)
    const isGif = src.toLowerCase().endsWith('.gif') || src.includes('image/gif')

    return error ? (
      <div className="flex h-32 w-full items-center justify-center rounded-lg bg-muted/30">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <AlertCircle className="h-6 w-6" />
          <span className="text-xs">Failed to load image</span>
        </div>
      </div>
    ) : (
      <Image
        src={src}
        alt={alt}
        width={200}
        height={200}
        className={`h-32 w-full cursor-pointer rounded-lg object-contain ${fileUrl === thumbnailImage && 'outline-dashed outline-1 outline-primary'
          }`}
        onError={() => setError(true)}
        unoptimized={isGif} // Disable optimization for GIFs
        {...props}
      />
    )
  }

  const mintNFT = async (
    lucid: LucidEvolution,
    selectedPolicy: PolicyInfo,
    nftName: string,
    nftTitle: string,
    nftDescription: string,
    selectedFiles: FileInfo[],
  ) => {
    setMinting(true)
    try {
      const { fromText } = await getScriptUtils()

      if (!thumbnailImage) {
        toast.error('Please select a thumbnail image', { position: 'bottom-center' })
        return
      }

      const address = await lucid.wallet().address()

      // Get the thumbnail file info
      const thumbnailFileInfo = selectedFiles.find((file) => file.url === thumbnailImage)
      if (!thumbnailFileInfo) {
        toast.error('Thumbnail file info not found', { position: 'bottom-center' })
        return
      }

      // Get the extension and MIME type for the thumbnail
      const thumbnailExt = '.' + thumbnailFileInfo.name.split('.').pop()!.toLowerCase()
      const thumbnailMimeType = VALID_IMAGE_MIMES[thumbnailExt] || 'image/png'

      // Format the files array with all metadata
      const formattedFiles = selectedFiles.map((file) => ({
        name: file.customName || file.name,
        mediaType: VALID_IMAGE_MIMES[`.${file.name.split('.').pop()!.toLowerCase()}`],
        src: `ipfs://${file.url}`,
        ...(file.properties && Object.keys(file.properties).length > 0 ? file.properties : {})
      }));

      // Construct the metadata
      const metadata = {
        [selectedPolicy.policyId]: {
          [nftName]: {
            name: nftTitle,
            image: `ipfs://${thumbnailImage}`,
            mediaType: thumbnailMimeType,
            description: nftDescription,
            files: formattedFiles,
          },
        },
      }

      // Transaction to mint the NFT
      const tx = await lucid
        .newTx()
        .mintAssets({
          [selectedPolicy.policyId + fromText(nftName)]: BigInt(mintQuantity),
        })
        .attachMetadata(721, metadata)
        .validTo(Date.now() + 1200000) //give plenty of time for the user to sign the tx
        .pay.ToAddress(address, {
          [selectedPolicy.policyId + fromText(nftName)]: BigInt(mintQuantity),
        })
        .attach.MintingPolicy(
          await createMintingPolicy(lucid, selectedPolicy, selectedPolicy.slot!),
        )
        .complete()

      const signedTx = await tx.sign.withWallet().complete()
      const txHash = await signedTx.submit()
      const cscanLink =
        CARDANO_NETWORK === 'Preview'
          ? `https://preview.cardanoscan.io/transaction/${txHash}`
          : `https://cardanoscan.io/transaction/${txHash}`
      toast.success(
        <div>
          <p className="text-sm text-green-500">
            Success!{' '}
            <Link href={cscanLink} target="_blank" rel="noopener noreferrer" className="underline">
              View on CardanoScan
            </Link>
          </p>
        </div>,
        { position: 'bottom-center', duration: 6000 },
      )

      if (txHash) {
        // Mark policy as used
        setPolicyIds((prev) =>
          prev.map((p) => (p.policyId === selectedPolicy.policyId ? { ...p, isUsed: true } : p)),
        )
        setSelectedPolicy((prev) => (prev ? { ...prev, isUsed: true } : null))
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(error.message, { position: 'bottom-center' })
      } else {
        toast.error('Minting failed: An unexpected error occurred.', { position: 'bottom-center' })
      }
    } finally {
      setMinting(false)
    }
  }

  const uploadFile = async (selectedFiles?: File[]) => {
    try {
      if (!selectedFiles || selectedFiles.length === 0) {
        toast.error('No files selected', { position: 'bottom-center' })
        return
      }

      // Check if all files are valid
      for (const file of selectedFiles) {
        if (!isValidImageFile(file)) {
          toast.error(`Invalid file format: ${file.name}`, { position: 'bottom-center' })
          return
        }
      }

      setUploading(true)

      // Create an array of promises for each file upload
      const uploadPromises = selectedFiles.map(async (file) => {
        const data = new FormData()
        data.append('file', file)

        // Add metadata to identify file type
        const metadata = {
          name: file.name,
          keyvalues: {
            fileType:
              file.name.toLowerCase().endsWith('.html') || file.name.toLowerCase().endsWith('.htm')
                ? 'html'
                : 'image',
            mimeType:
              file.type ||
              (file.name.toLowerCase().endsWith('.html') || file.name.toLowerCase().endsWith('.htm')
                ? 'text/html'
                : 'image/png'),
            extension: file.name.split('.').pop()?.toLowerCase(),
          },
        }

        data.append('pinataMetadata', JSON.stringify(metadata))
        data.append('pinataOptions', JSON.stringify({ cidVersion: 0 }))

        const uploadRequest = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${pinataJWT}`,
          },
          body: data,
        })

        const response = await uploadRequest.json()

        if (!response.IpfsHash) {
          throw new Error(`Unexpected response format for ${file.name}: IpfsHash not found`)
        }
      })

      // Wait for all uploads to complete
      await Promise.all(uploadPromises)

      let message =
        selectedFiles.length > 1
          ? 'Files uploaded successfully. Choose from the uploaded files to select them.'
          : 'File uploaded successfully. Choose from the uploaded files to select it.'

      toast.success(message, {
        position: 'bottom-center',
      })

      setUploading(false)
      // Automatically open the browse dialog after upload
      loadPinataFiles(1)
    } catch (e) {
      setUploading(false)
      toast.error('Trouble uploading files to IPFS', { position: 'bottom-center' })
    }
  }

  const generatePolicyId = async () => {
    if (!walletState.api) {
      toast.error('Please connect your wallet first', { position: 'bottom-center' })
      return
    }

    try {
      setGeneratingPolicy(true)
      const { Lucid, Blockfrost } = await getLucid()
      const lucid = await Lucid(
        new Blockfrost(
          `https://cardano-${CARDANO_NETWORK.toLowerCase()}.blockfrost.io/api/v0`,
          blockfrostKey || undefined,
        ),
        CARDANO_NETWORK,
      )
      lucid.selectWallet.fromAPI(walletState.api!)
      const { scriptFromNative, paymentCredentialOf, mintingPolicyToId } = await getScriptUtils()

      const address = await lucid.wallet().address()
      const keyHash = paymentCredentialOf(address).hash

      // Calculate expiry slot if needed
      const currentSlot = lucid.currentSlot()
      const expirySlot = expiryConfig.hasExpiry
        ? currentSlot + expiryConfig.days * 86400
        : undefined

      // Generate policy with or without expiry
      const mintingPolicy = scriptFromNative(
        expiryConfig.hasExpiry
          ? {
            type: 'all',
            scripts: [
              { type: 'sig', keyHash },
              { type: 'before', slot: expirySlot! },
            ],
          }
          : {
            type: 'sig',
            keyHash,
          },
      )

      const policyId = mintingPolicyToId(mintingPolicy)
      console.log(policyId)

      const newPolicy: PolicyInfo = {
        policyId,
        keyHash,
        slot: expirySlot,
        script: expiryConfig.hasExpiry
          ? {
            type: 'all',
            scripts: [
              { type: 'sig', keyHash },
              { type: 'before', slot: expirySlot! },
            ],
          }
          : {
            type: 'sig',
            keyHash,
          },
        isGenerated: true,
      }

      // Update state with new policy
      setPolicyIds((prev) => [...prev, newPolicy])
      setSelectedPolicy(newPolicy)
      setCurrentStep(4)
      setOpenSections([4])

      // Update success message based on expiry
      const message = expiryConfig.hasExpiry
        ? `${policyId} will expire in ${expiryConfig.days} day${expiryConfig.days > 1 ? 's' : ''}.`
        : `${policyId} has no expiry date.`

      toast.success(
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>,
        { position: 'bottom-center', duration: 6000 },
      )
    } catch (error: any) {
      console.error('Error:', error)
      toast.error('Error generating policy ID: ' + error.message, { position: 'bottom-center' })
    } finally {
      setGeneratingPolicy(false)
    }
  }

  // Modify the loadPolicies function
  const loadPolicies = async () => {
    if (!walletState.api || !blockfrostKey) {
      toast.error('Please connect wallet and enter Blockfrost key first', {
        position: 'bottom-center',
      })
      return
    }

    try {
      // Check balance first, before applying rate limit
      const balance = await walletState.api.getBalance()
      if (Number(balance) < 1000000) {
        toast.error('Insufficient balance, please add funds to your wallet', {
          position: 'bottom-center',
        })
        return
      }

      // Only apply rate limit if balance check passes
      const cooldownPeriod = 30000
      const timeElapsed = Date.now() - lastFetchTime

      if (timeElapsed < cooldownPeriod) {
        const remainingTime = Math.ceil((cooldownPeriod - timeElapsed) / 1000)
        toast.error(`Please wait ${remainingTime} seconds before refreshing`, {
          position: 'bottom-center',
        })
        return
      }

      setScanning(true)
      setLoadingPolicies(true)

      // Get all required data in parallel
      const [{ paymentCredentialOf }, address] = await Promise.all([
        getScriptUtils(),
        lucid.wallet().address(),
      ])

      if (Number(balance) < 1000000) {
        toast.error('Insufficient balance, please add funds to your wallet', {
          position: 'bottom-center',
        })
        return
      }

      const keyHash = paymentCredentialOf(address).hash
      const allUTxOs = await lucid.utxosAt(address)

      if (allUTxOs.length > 32) {
        toast.error('This wallet has a lot of utxos, this could take a minute or two', {
          position: 'bottom-center',
        })
      }

      // Use Set for faster lookups and unique values
      const uniquePolicyIds = new Set<string>()
      for (const utxo of allUTxOs) {
        Object.keys(utxo.assets).forEach((assetId) => {
          if (assetId.length > 56) {
            uniquePolicyIds.add(assetId.slice(0, 56))
          }
        })
      }

      // Batch API requests in groups of 10 (adjust based on rate limits)
      const BATCH_SIZE = 10
      const policyIds = Array.from(uniquePolicyIds)
      const results: any[] = []

      for (let i = 0; i < policyIds.length; i += BATCH_SIZE) {
        const batch = policyIds.slice(i, i + BATCH_SIZE)
        const batchPromises = batch.map(async (policyId) => {
          try {
            const response = await fetch(
              `https://cardano-${CARDANO_NETWORK.toLowerCase()}.blockfrost.io/api/v0/scripts/${policyId}/json`,
              {
                headers: { project_id: blockfrostKey },
              },
            )

            if (response.status === 429) {
              const retryAfter = parseInt(response.headers.get('retry-after') || '10') * 1000
              await delay(retryAfter)
              return null // Will be filtered out later
            }

            if (!response.ok) return null

            const scriptDetails = await response.json()
            const keyHashMatches = scriptDetails?.json
              ? scriptDetails.json.keyHash === keyHash ||
              scriptDetails.json.scripts?.[0]?.keyHash === keyHash ||
              scriptDetails.json.scripts?.[1]?.keyHash === keyHash
              : false

            if (keyHashMatches) {
              return {
                policyId,
                slot: extractSlotFromScript(scriptDetails.json),
                script: scriptDetails.json,
                keyHash,
              }
            }
            return null
          } catch (error) {
            console.error(`Error fetching policy ${policyId}:`, error)
            return null
          }
        })

        // Wait for batch to complete and filter out nulls
        const batchResults = (await Promise.all(batchPromises)).filter(Boolean)
        results.push(...batchResults)

        // Add a small delay between batches to respect rate limits
        if (i + BATCH_SIZE < policyIds.length) {
          await delay(100)
        }
      }

      // Update state with unique policies
      setPolicyIds((prevPolicies) => {
        const policyMap = new Map(prevPolicies.map((p) => [p.policyId, p]))
        results.forEach((result) => {
          if (result) policyMap.set(result.policyId, result)
        })
        return Array.from(policyMap.values())
      })

      if (results.length === 0) {
        toast.info('No policies found, generate a new policy ID', { position: 'bottom-center' })
      } else {
        toast.success(
          <div className="flex flex-col gap-2">
            Loaded {results.length} existing policy ID{results.length > 1 ? 's' : ''}
          </div>,
          { position: 'bottom-center', duration: 6000 },
        )
      }
    } catch (error: any) {
      console.error('Error:', error)
      toast.error('Error loading policies: ' + error.message, { position: 'bottom-center' })
    } finally {
      setLoadingPolicies(false)
      setScanning(false)
      setLastFetchTime(Date.now())
    }
  }

  const loadPinataFiles = async (page: number = 1) => {
    try {
      setLoadingFiles(true)

      // Build the query URL with metadata filters
      const queryParams = new URLSearchParams({
        status: 'pinned',
        pageLimit: pagination.itemsPerPage.toString(),
        pageOffset: ((page - 1) * pagination.itemsPerPage).toString(),
      })

      const response = await fetch(`https://api.pinata.cloud/data/pinList?${queryParams}`, {
        headers: {
          Authorization: `Bearer ${pinataJWT}`,
        },
      })

      if (!response.ok) throw new Error('Failed to fetch files')

      const data = await response.json()

      // Sort files by date
      const sortedFiles = data.rows.sort((a: PinataFile, b: PinataFile) => {
        return new Date(b.date_pinned).getTime() - new Date(a.date_pinned).getTime()
      })

      // Filter out CIDv1 hashes and sort remaining files by date
      const filteredFiles = sortedFiles.filter((file: PinataFile) => isCIDv0(file.ipfs_pin_hash))

      setPinataResponse({
        count: data.count,
        rows: filteredFiles,
        filteredRows: filteredFiles,
      })

      setPagination((prev) => ({
        ...prev,
        currentPage: page,
        totalPages: Math.ceil(data.count / pagination.itemsPerPage),
      }))

      if (page === 1) {
        setShowPinataDialog(true)
      }
    } catch (error: any) {
      console.warn('Error loading files: ' + error.message)
      toast.error('Failed to load files, double check your pinata JWT is correct', {
        position: 'bottom-center',
      })
    } finally {
      setLoadingFiles(false)
    }
  }

  // Update the handlePageChange function to fetch new data
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.totalPages) return
    loadPinataFiles(newPage)
  }

  // Update the deleteFile function to handle non-JSON responses and remove the deleted file from state
  const deleteFile = async (cid: string) => {
    const options = {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${pinataJWT}`,
      },
    }

    // Optimistically update the UI
    const previousFiles = pinataResponse.rows // Store previous state
    const previousFilteredRows = pinataResponse.filteredRows // Store previous filtered rows
    setPinataResponse((prev) => ({
      ...prev,
      rows: prev.rows.filter((file) => file.ipfs_pin_hash !== cid), // Filter out the deleted file
      filteredRows: prev.filteredRows.filter((file) => file.ipfs_pin_hash !== cid), // Also filter from filteredRows
    }))

    try {
      const response = await fetch(`https://api.pinata.cloud/pinning/unpin/${cid}`, options)
      const result = await response.text() // Use .text() to get the response as plain text

      if (response.ok) {
        // Update pagination if needed
        const newTotalPages = Math.ceil(
          (pinataResponse.filteredRows.length - 1) / pagination.itemsPerPage,
        )
        setPagination((prev) => ({
          ...prev,
          totalPages: newTotalPages,
          currentPage: prev.currentPage > newTotalPages ? newTotalPages : prev.currentPage,
        }))
      } else {
        // Revert the optimistic update if the delete fails
        setPinataResponse((prev) => ({
          ...prev,
          rows: previousFiles, // Restore previous state
          filteredRows: previousFilteredRows, // Restore previous filtered rows
        }))
        toast.error('Failed to delete file: ' + result, { position: 'bottom-center' })
      }
    } catch (error) {
      // Revert the optimistic update if an error occurs
      setPinataResponse((prev) => ({
        ...prev,
        rows: previousFiles, // Restore previous state
        filteredRows: previousFilteredRows, // Restore previous filtered rows
      }))
      console.error('Error deleting file:', error)
      toast.error('Error deleting file: ' + (error as Error).message, { position: 'bottom-center' })
    }
  }

  // Function to handle file deletion confirmation
  const handleDeleteConfirmation = async () => {
    if (confirmationText.toLowerCase() === 'confirm' && fileToDelete) {
      await deleteFile(fileToDelete)
      setConfirmationText('') // Reset confirmation text
      setFileToDelete(null) // Reset file to delete
      setPinataResponse((prev) => ({
        ...prev,
        rows: prev.rows.filter((file) => file.ipfs_pin_hash !== fileToDelete),
      }))
      setSelectedPinataFiles((prev) => prev.filter((file) => file.ipfs_pin_hash !== fileToDelete))
      // if the file is selected as thumbnail, set thumbnail to null
      if (thumbnailImage === fileToDelete) {
        setThumbnailImage(null)
      }
    }
    setIsConfirmDialogOpen(false) // Close the dialog
  }

  // Modified handleTraitChange to work with temporary state
  const handleTraitChange = (
    fileUrl: string,
    propertyIndex: number,
    field: 'key' | 'value',
    value: string,
  ) => {
    setTraitEdits((prev) => ({
      ...prev,
      [fileUrl]: {
        ...(prev[fileUrl] || {}),
        [propertyIndex]: {
          ...(prev[fileUrl]?.[propertyIndex] || {
            key:
              Object.keys(selectedFiles.find((f) => f.url === fileUrl)?.properties || {})[
              propertyIndex
              ] || '',
            value:
              Object.values(selectedFiles.find((f) => f.url === fileUrl)?.properties || {})[
              propertyIndex
              ] || '',
          }),
          [field]: value,
        },
      },
    }))
  }

  // Function to check if all images have names
  const areAllNamesEntered = () => {
    return selectedFiles.every((fileInfo) => imageNames[fileInfo.url]?.trim() !== '')
  }

  // Update the useEffect for step advancement
  useEffect(() => {
    if (currentStep === 2 && !areAllNamesEntered()) {
      // Prevent advancing to step 3 if not all names are entered
      setCurrentStep(2)
      setOpenSections([2])
    }
  }, [imageNames, currentStep])

  // Update the addTraitToImage function
  const addTraitToImage = (fileUrl: string) => {
    // Only allow adding a new trait if all existing traits are valid
    if (!areAllTraitPairsValid(fileUrl)) {
      toast.error('Please fill in all existing traits before adding a new one', {
        position: 'bottom-center',
      })
      return
    }

    setSelectedFiles((prev) =>
      prev.map((fileInfo) => {
        if (fileInfo.url === fileUrl) {
          const properties = { ...fileInfo.properties }
          const newIndex = Object.keys(properties).length
          // Add empty key-value pair with blank values
          properties[`${newIndex}`] = '' // Using just the index as key, value will be blank
          return { ...fileInfo, properties }
        }
        return fileInfo
      }),
    )
  }

  // Add this function to remove a trait from a specific image
  const removeTraitFromImage = (fileUrl: string, propertyIndex: number) => {
    setSelectedFiles((prev) =>
      prev.map((fileInfo) => {
        if (fileInfo.url === fileUrl) {
          const properties = { ...fileInfo.properties }
          const keys = Object.keys(properties)
          const keyToRemove = keys[propertyIndex]
          if (keyToRemove) {
            delete properties[keyToRemove]
          }
          return { ...fileInfo, properties }
        }
        return fileInfo
      }),
    )
  }

  // Add this function near other delete-related functions
  const handleMultiDelete = async () => {
    if (selectedForDeletion.length === 0) {
      toast.error('No files selected for deletion', { position: 'bottom-center' })
      return
    }

    setIsConfirmDialogOpen(true)
  }

  // Add new function to save traits
  const saveTraits = (fileUrl: string) => {
    const fileEdits = traitEdits[fileUrl]
    if (!fileEdits) return

    setSelectedFiles((prev) =>
      prev.map((fileInfo) => {
        if (fileInfo.url === fileUrl) {
          const newProperties: Record<string, string> = {}
          const existingKeys = new Set()

          // First pass: collect all valid traits
          Object.values(fileEdits).forEach(({ key, value }) => {
            if (key && !existingKeys.has(key)) {
              newProperties[key] = value
              existingKeys.add(key)
            }
          })

          return {
            ...fileInfo,
            properties: newProperties,
          }
        }
        return fileInfo
      }),
    )

    // Clear edits for this file
    setTraitEdits((prev) => {
      const newEdits = { ...prev }
      delete newEdits[fileUrl]
      return newEdits
    })

    toast.success('Traits saved successfully', { position: 'bottom-center' })
  }

  // Add new function to check if there are unsaved changes
  const hasUnsavedChanges = (fileUrl: string) => {
    return !!traitEdits[fileUrl]
  }

  // Add this function to check if a trait pair is valid (both key and value have at least 1 character)
  const isTraitPairValid = (key: string, value: string) => {
    return key.trim().length > 0 && value.trim().length > 0
  }

  // Add this function to check if all current trait pairs are valid
  const areAllTraitPairsValid = (fileUrl: string) => {
    const fileEdits = traitEdits[fileUrl] || {}
    const fileInfo = selectedFiles.find((f) => f.url === fileUrl)
    const fileProperties = fileInfo?.properties || {}

    // Get all property indices
    const indices = Object.keys(fileProperties).length

    // Check each index
    for (let i = 0; i < indices; i++) {
      // Get either the edited values or the original values
      const trait = fileEdits[i] || {
        key: Object.keys(fileProperties)[i] || '',
        value: Object.values(fileProperties)[i] || '',
      }

      // If either key or value is empty, return false
      if (!isTraitPairValid(trait.key, trait.value)) {
        return false
      }
    }

    return true
  }



  if (initializing || loading) {
    return (
      <div className="flex h-[69vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Waiting for wallet...</p>
        </div>
      </div>
    )
  }

  if (!walletState.wallet) {
    return (
      <div className="flex h-[69vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <p className="text-muted-foreground">Connect a wallet to get started</p>
        </div>
      </div>
    )
  }

  const steps = [
    { step: 1, tooltip: 'Enter your API keys for Blockfrost and Pinata', title: 'API Keys' },
    {
      step: 2,
      tooltip: 'Upload your NFT asset to IPFS or select a file from Pinata',
      title: 'IPFS/Storage',
    },
    { step: 3, tooltip: 'Select or generate a minting policy', title: 'Policy ID' },
    { step: 4, tooltip: 'Set NFT metadata and mint', title: 'Metadata/Mint' },
  ]

  const FileGrid = () => {
    return (
      <div className="grid max-w-[100vw] grid-cols-2 gap-2 p-2 lg:grid-cols-3">
        {pinataResponse.rows.map((file) => {
          const fileExtension = '.' + file.metadata?.name?.split('.').pop()?.toLowerCase()

          return (
            <div
              key={file.ipfs_pin_hash}
              className={`group relative rounded-lg ${isMultiDeleteMode && selectedForDeletion.includes(file.ipfs_pin_hash)
                ? '!border-2 !border-destructive'
                : selectedPinataFiles.some(
                  (selected) => selected.ipfs_pin_hash === file.ipfs_pin_hash,
                )
                  ? 'border-2 border-primary'
                  : ''
                }`}
              onClick={() => {
                if (isMultiDeleteMode) {
                  setSelectedForDeletion((prev) =>
                    prev.includes(file.ipfs_pin_hash)
                      ? prev.filter((hash) => hash !== file.ipfs_pin_hash)
                      : [...prev, file.ipfs_pin_hash],
                  )
                } else {
                  setSelectedPinataFiles((prev) => {
                    const isSelected = prev.some(
                      (selected) => selected.ipfs_pin_hash === file.ipfs_pin_hash,
                    )
                    if (isSelected) {
                      return prev.filter(
                        (selected) => selected.ipfs_pin_hash !== file.ipfs_pin_hash,
                      )
                    } else {
                      return [...prev, file]
                    }
                  })

                  // Get the original name and log it
                  const originalName = file.metadata?.name || file.name || file.ipfs_pin_hash

                  // Truncate the name
                  const truncatedName = truncateFileName(originalName)

                  // Show toast if name was truncated
                  if (originalName.length !== truncatedName.length) {
                    toast.info(
                      <div className="flex flex-col gap-1">
                        <p>Filename has been shortened to meet the 64-character limit.</p>
                        <p className="text-xs text-muted-foreground">Original: {originalName}</p>
                        <p className="text-xs text-muted-foreground">Shortened: {truncatedName}</p>
                      </div>,
                      { position: 'top-center', duration: 6000 },
                    )
                  }

                  const fileInfo = {
                    url: file.ipfs_pin_hash,
                    name: truncatedName, // Using truncated name here
                    customName: truncatedName, // Also set customName to ensure it's used in the UI
                    date_pinned: file.date_pinned,
                  }

                  setSelectedFiles((prev) => {
                    const isSelected = prev.some((selected) => selected.url === file.ipfs_pin_hash)
                    if (isSelected) {
                      return prev.filter((selected) => selected.url !== file.ipfs_pin_hash)
                    } else {
                      return [...prev, fileInfo]
                    }
                  })
                }
              }}
            >
              <div
                className={`flex cursor-pointer flex-col rounded-lg border border-border p-1 ${isMultiDeleteMode && selectedForDeletion.includes(file.ipfs_pin_hash)
                  ? '!ring-2 !ring-destructive'
                  : selectedPinataFiles.some(
                    (selected) => selected.ipfs_pin_hash === file.ipfs_pin_hash,
                  )
                    ? 'ring-2 ring-primary'
                    : ''
                  }`}
              >
                <div className="relative">
                  <ImageWithFallback
                    src={`https://gateway.pinata.cloud/ipfs/${file.ipfs_pin_hash}`}
                    alt={file.metadata?.name || 'Pinata file'}
                    className="h-20 w-full cursor-pointer rounded-lg object-contain sm:h-28"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="absolute right-1 top-1 h-7 w-7 bg-background/80 backdrop-blur-sm hover:bg-destructive hover:text-destructive-foreground"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedFiles((prev) => prev.filter((f) => f.url !== file.ipfs_pin_hash))
                      setSelectedPinataFiles((prev) =>
                        prev.filter((f) => f.ipfs_pin_hash !== file.ipfs_pin_hash),
                      )
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex flex-1 flex-col justify-between">
                  <div className="space-y-1 px-1">
                    <span className="block truncate text-xs">
                      {(() => {
                        const fullName = file.metadata?.name || file.name || ''
                        return fullName
                      })()}
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="block font-mono text-xs text-muted-foreground">
                        {timeAgoCompact(new Date(file.date_pinned))}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 hover:bg-destructive hover:text-destructive-foreground"
                        onClick={(e) => {
                          e.stopPropagation()
                          setFileToDelete(file.ipfs_pin_hash)
                          setIsConfirmDialogOpen(true)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const FilesGridHeader = () => (
    <div className="sticky top-0 z-10 flex w-full flex-col border-b bg-background shadow-sm">
      <div className="mx-2 flex flex-col gap-1.5 py-2 sm:mx-3 sm:py-2 md:py-3">
        <div className="flex w-full items-center justify-between">
          <DialogTitle className="font-cal text-base font-medium tracking-wide sm:text-lg md:text-xl lg:text-2xl">
            {(() => {
              const totalFileCount = pinataResponse.count
              if (totalFileCount === 0) return 'No files found'
              if (totalFileCount >= 1000) {
                return `${(totalFileCount / 1000).toFixed(1)}k files`
              }
              return `${selectedFiles.length}/${totalFileCount} ${totalFileCount === 1 || selectedFiles.length === 1 ? 'file' : 'files'
                } selected`
            })()}
          </DialogTitle>
          <DialogClose className="flex h-9 w-9 items-center justify-center rounded-lg border border-border transition-colors hover:bg-secondary/80 sm:h-10 sm:w-10 md:h-12 md:w-12">
            <X className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </div>
        <div className="flex w-full items-center justify-end gap-1.5">
          {/* Add Select All button */}
          {pinataResponse.rows.length > 0 && !isMultiDeleteMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const currentPageFiles = pinataResponse.rows
                const currentPageFileHashes = new Set(
                  currentPageFiles.map((file) => file.ipfs_pin_hash),
                )

                // Check if all files from current page are selected
                const areAllCurrentPageFilesSelected = currentPageFiles.every((file) =>
                  selectedPinataFiles.some(
                    (selected) => selected.ipfs_pin_hash === file.ipfs_pin_hash,
                  ),
                )

                if (areAllCurrentPageFilesSelected) {
                  // Deselect only the current page's files
                  setSelectedPinataFiles((prev) =>
                    prev.filter((file) => !currentPageFileHashes.has(file.ipfs_pin_hash)),
                  )
                  setSelectedFiles((prev) =>
                    prev.filter((file) => !currentPageFileHashes.has(file.url)),
                  )
                } else {
                  // Select all files from current page and track any truncated names
                  const truncatedFiles: { original: string; truncated: string }[] = []

                  // Process current page files and collect truncation info
                  const processedFiles = currentPageFiles.map((file) => {
                    const originalName = file.metadata?.name || file.name || file.ipfs_pin_hash
                    const truncatedName = truncateFileName(originalName)

                    // If the name was truncated, add it to our tracking array
                    if (originalName.length !== truncatedName.length) {
                      truncatedFiles.push({
                        original: originalName,
                        truncated: truncatedName,
                      })
                    }

                    return {
                      url: file.ipfs_pin_hash,
                      name: truncatedName,
                      customName: truncatedName,
                      date_pinned: file.date_pinned,
                    }
                  })

                  // Merge new selections with existing selections
                  setSelectedPinataFiles((prev) => {
                    const prevFiltered = prev.filter(
                      (file) => !currentPageFileHashes.has(file.ipfs_pin_hash),
                    )
                    return [...prevFiltered, ...currentPageFiles]
                  })

                  setSelectedFiles((prev) => {
                    const prevFiltered = prev.filter((file) => !currentPageFileHashes.has(file.url))
                    return [...prevFiltered, ...processedFiles]
                  })

                  // If any files were truncated, show a consolidated toast
                  if (truncatedFiles.length > 0) {
                    toast.info(
                      <div className="flex max-h-[300px] flex-col gap-2">
                        <p className="font-medium">
                          {truncatedFiles.length} filename{truncatedFiles.length > 1 ? 's' : ''}{' '}
                          shortened to meet the 64-character limit
                        </p>
                        <div className="overflow-y-auto">
                          {truncatedFiles.map(({ original, truncated }, index) => (
                            <div key={index} className="mb-2 text-xs">
                              <p className="text-muted-foreground">Original: {original}</p>
                              <p className="text-muted-foreground">Shortened: {truncated}</p>
                              {index < truncatedFiles.length - 1 && (
                                <hr className="my-1 border-border/50" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>,
                      {
                        position: 'top-center',
                        duration: 6000,
                        className: 'max-w-md',
                      },
                    )
                  }
                }
              }}
              className="flex h-9 items-center justify-center gap-1.5 text-base font-medium sm:h-9 sm:text-lg md:h-10 md:text-xl lg:h-11 lg:text-2xl"
            >
              {pinataResponse.rows.every((file) =>
                selectedPinataFiles.some(
                  (selected) => selected.ipfs_pin_hash === file.ipfs_pin_hash,
                ),
              ) ? (
                <>
                  <X className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 lg:h-8 lg:w-8" />
                  Deselect Page
                </>
              ) : (
                <>
                  <CheckSquare className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 lg:h-8 lg:w-8" />
                  Select Page
                </>
              )}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsMultiDeleteMode(!isMultiDeleteMode)
              setSelectedForDeletion([])
            }}
            className={`flex h-9 items-center justify-center gap-1.5 text-base font-medium sm:h-9 sm:text-lg md:h-10 md:text-xl lg:h-11 lg:text-2xl ${isMultiDeleteMode ? 'bg-destructive text-destructive-foreground' : ''
              }`}
          >
            {isMultiDeleteMode ? (
              <>
                <X className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 lg:h-8 lg:w-8" />
                Cancel
              </>
            ) : (
              <>
                <Trash2 className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 lg:h-8 lg:w-8" />
                Delete
              </>
            )}
          </Button>
          {isMultiDeleteMode ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleMultiDelete}
              disabled={selectedForDeletion.length === 0}
              className="flex h-9 items-center justify-center gap-1.5 text-base font-medium sm:h-9 sm:text-lg md:h-10 md:text-xl lg:h-11 lg:text-2xl"
            >
              <Trash2 className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 lg:h-8 lg:w-8" />
              Delete ({selectedForDeletion.length})
            </Button>
          ) : (
            selectedFiles.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPinataDialog(false)}
                className="h-9 w-9 sm:h-9 sm:w-9 md:h-10 md:w-10 lg:h-11 lg:w-11"
              >
                <Check className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 lg:h-8 lg:w-8" />
              </Button>
            )
          )}
        </div>
      </div>
    </div>
  )

  return (
    <main className="m-auto flex w-full max-w-3xl flex-col items-center justify-center gap-4 p-4 md:max-w-4xl">
      {/* Progress indicator */}
      {/* <Button onClick={() => signCardanoData()}>Sign Data</Button> */}
      <TooltipProvider delayDuration={50}>
        <div className="mb-4 flex w-full justify-between px-2">
          {steps.map(({ step, tooltip, title }) => (
            <Tooltip key={step}>
              <TooltipTrigger>
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all ${isStepComplete(step)
                        ? 'border-success bg-success text-success-foreground shadow-lg shadow-success/30 ring-2 ring-success/10 ring-offset-2'
                        : step === currentStep
                          ? 'animate-pulse-slow border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-2 ring-primary/10 ring-offset-2'
                          : 'border-muted bg-background text-muted-foreground hover:scale-110 hover:border-muted-foreground/50 hover:shadow-sm'
                        }`}
                    >
                      {step}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{title}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>{tooltip}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>

      {/* Step 1: API Keys */}
      <Collapsible
        open={openSections.includes(1)}
        onOpenChange={(isOpen) => {
          setOpenSections(isOpen ? [...openSections, 1] : openSections.filter((s) => s !== 1))
        }}
        className="w-full rounded-lg border border-border bg-card"
      >
        <CollapsibleTrigger className="flex w-full items-center justify-between p-6 hover:bg-secondary/10">
          <h2 className="text-xl font-semibold">Step 1: {steps[0].title}</h2>
          <div className="flex items-center gap-2">
            {isStepComplete(1) && <Check className="h-4 w-4 text-green-500" />}
            <ChevronDown className="h-4 w-4" />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="p-6 pt-2">
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Blockfrost Project ID</label>
              <Input
                value={blockfrostKey || ''}
                onChange={handleBlockfrostChange}
                placeholder="Enter your Blockfrost Project ID"
                className={`${!blockfrostKey ? 'border-red-500/50' : ''}`}
              />
              <Link
                href="https://blockfrost.io/dashboard"
                target="_blank"
                className="mt-1 text-xs text-muted-foreground hover:text-primary"
              >
                Need a Blockfrost API Key?
              </Link>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Pinata JWT</label>
              <Input
                value={pinataJWT || ''}
                onChange={handleJWTChange}
                placeholder="Enter your Pinata JWT"
                className={`${!pinataJWT ? 'border-red-500/50' : ''}`}
              />
              <Link
                href="https://app.pinata.cloud/developers/api-keys"
                target="_blank"
                className="mt-1 text-xs text-muted-foreground hover:text-primary"
              >
                Need a Pinata API Key?
              </Link>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Step 2: File Upload */}
      {blockfrostKey && pinataJWT && (
        <Collapsible
          open={openSections.includes(2)}
          onOpenChange={(isOpen) => {
            setOpenSections(isOpen ? [...openSections, 2] : openSections.filter((s) => s !== 2))
          }}
          className="w-full rounded-lg border border-border bg-card"
        >
          <CollapsibleTrigger className="flex w-full items-center justify-between p-6 hover:bg-secondary/10">
            <h2 className="text-lg font-semibold">Step 2: {steps[1].title}</h2>
            <div className="flex items-center gap-2">
              {isStepComplete(2) && <Check className="h-4 w-4 text-green-500" />}
              <ChevronDown className="h-4 w-4" />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="p-6 pt-2">
            <div className="flex flex-col gap-4">
              <Button3D
                disabled={!isStepComplete(1) || loadingFiles}
                onClick={() => loadPinataFiles(1)}
                variant="outline"
              >
                {loadingFiles ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  'Choose from Uploaded Files'
                )}
              </Button3D>
              <span className="text-center text-sm text-muted-foreground md:text-base">or</span>
              <div className="flex gap-4">
                <FileUploadArea
                  pinataJWT={pinataJWT}
                  uploadFile={uploadFile}
                  files={files}
                  setFiles={setFiles}
                  isStepComplete={isStepComplete}
                  uploading={uploading}
                />
              </div>
              {/* File preview section */}
              {selectedFiles.length > 0 && (
                <div className="flex flex-col gap-4">
                  {!thumbnailImage && (
                    <div className="flex items-center justify-center gap-2 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm text-yellow-500">
                      <AlertCircle className="h-4 w-4 animate-pulse" />
                      <span>
                        Please select a preview image by clicking on one of the images below
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {selectedFiles.map((fileInfo, index) => (
                      <div key={fileInfo.url} className="group relative h-full">
                        <div
                          className={`flex h-full flex-col rounded-lg border border-border bg-background/50 p-1 ${isMultiDeleteMode && selectedForDeletion.includes(fileInfo.url)
                            ? '!outline !outline-2 !outline-destructive'
                            : selectedPinataFiles.some(
                              (selected) => selected.ipfs_pin_hash === fileInfo.url,
                            )
                              ? 'outline outline-2 outline-primary'
                              : ''
                            }`}
                        >
                          <div className="flex flex-1 flex-col space-y-2">
                            {/* Image preview */}
                            <div className="relative">
                              <ImageWithFallback
                                src={`https://gateway.pinata.cloud/ipfs/${fileInfo.url}`}
                                alt={fileInfo.name}
                                className={`h-24 w-full cursor-pointer rounded-lg object-contain sm:h-32 ${thumbnailImage === fileInfo.url ? 'ring-2 ring-emerald-500' : ''
                                  }`}
                                onClick={() => setThumbnailImage(fileInfo.url)}
                              />
                              {thumbnailImage === fileInfo.url && (
                                <div className="absolute left-1 top-1 rounded-lg bg-emerald-500/80 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                                  Preview
                                </div>
                              )}
                              <Button
                                variant="outline"
                                size="icon"
                                className="absolute right-1 top-1 h-7 w-7 bg-background/80 backdrop-blur-sm hover:bg-destructive hover:text-destructive-foreground"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedFiles((prev) =>
                                    prev.filter((f) => f.url !== fileInfo.url),
                                  )
                                  setSelectedPinataFiles((prev) =>
                                    prev.filter((f) => f.ipfs_pin_hash !== fileInfo.url),
                                  )
                                  if (thumbnailImage === fileInfo.url) {
                                    setThumbnailImage(null)
                                  }
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>

                            {/* Filename editor with improved styling */}
                            <div className="flex items-center gap-1 rounded-lg border border-border bg-background/50 p-2">
                              <Input
                                value={
                                  fileInfo.customName?.split('.').slice(0, -1).join('.') ||
                                  fileInfo.name.split('.').slice(0, -1).join('.')
                                }
                                onChange={(e) => {
                                  e.stopPropagation()
                                  const extension = fileInfo.name.split('.').pop()
                                  const newName = `${e.target.value}.${extension}`
                                  handleNameChange(fileInfo.url, newName)
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="h-8 flex-1 border-none text-xs shadow-none focus-visible:ring-0"
                                placeholder="File name"
                              />
                              <span className="text-xs text-muted-foreground">
                                .{fileInfo.name.split('.').pop()}
                              </span>
                            </div>

                            {/* Action buttons with improved styling */}
                            <div className="flex items-center justify-between gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1.5 px-3 font-medium hover:bg-secondary/20"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  addTraitToImage(fileInfo.url)
                                }}
                              >
                                Add Trait
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>

                            {/* Traits section with improved styling */}
                            <div className="flex flex-col flex-wrap gap-1">
                              {Object.entries(fileInfo.properties || {}).map(
                                ([key, value], propertyIndex) => (
                                  <div
                                    key={propertyIndex}
                                    className="group flex items-center gap-2 rounded-lg bg-background/50 p-1"
                                  >
                                    <Input
                                      placeholder="Key"
                                      value={traitEdits[fileInfo.url]?.[propertyIndex]?.key ?? key}
                                      className={`h-8 flex-1 border border-border bg-background/50 text-xs shadow-none focus-visible:ring-0 ${!isTraitPairValid(
                                        traitEdits[fileInfo.url]?.[propertyIndex]?.key ?? key,
                                        traitEdits[fileInfo.url]?.[propertyIndex]?.value ?? value,
                                      )
                                        ? 'border-red-500/50'
                                        : ''
                                        }`}
                                      onClick={(e) => e.stopPropagation()}
                                      onChange={(e) =>
                                        handleTraitChange(
                                          fileInfo.url,
                                          propertyIndex,
                                          'key',
                                          e.target.value,
                                        )
                                      }
                                    />
                                    <Input
                                      placeholder="Value"
                                      value={
                                        traitEdits[fileInfo.url]?.[propertyIndex]?.value ?? value
                                      }
                                      className={`h-8 flex-1 border border-border bg-background/50 text-xs shadow-none focus-visible:ring-0 ${!isTraitPairValid(
                                        traitEdits[fileInfo.url]?.[propertyIndex]?.key ?? key,
                                        traitEdits[fileInfo.url]?.[propertyIndex]?.value ?? value,
                                      )
                                        ? 'border-red-500/50'
                                        : ''
                                        }`}
                                      onClick={(e) => e.stopPropagation()}
                                      onChange={(e) =>
                                        handleTraitChange(
                                          fileInfo.url,
                                          propertyIndex,
                                          'value',
                                          e.target.value,
                                        )
                                      }
                                    />
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-8 w-8 transition-opacity group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        removeTraitFromImage(fileInfo.url, propertyIndex)
                                      }}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ),
                              )}

                              {/* Add Save Traits button with count */}
                              {hasUnsavedChanges(fileInfo.url) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="mt-2 gap-2 text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    if (areAllTraitPairsValid(fileInfo.url)) {
                                      saveTraits(fileInfo.url)
                                    } else {
                                      toast.error('Please fill in all trait fields before saving', {
                                        position: 'bottom-center',
                                      })
                                    }
                                  }}
                                >
                                  Save {Object.keys(fileInfo.properties || {}).length} Traits
                                  <Check className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>


                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Step 3: Policy ID */}
      {selectedFiles.length > 0 && thumbnailImage && (
        <Collapsible
          open={openSections.includes(3)}
          onOpenChange={(isOpen) => {
            setOpenSections(isOpen ? [...openSections, 3] : openSections.filter((s) => s !== 3))
          }}
          className="w-full rounded-lg border border-border bg-card"
        >
          <CollapsibleTrigger className="flex w-full items-center justify-between p-6 hover:bg-secondary/10">
            <h2 className="text-lg font-semibold">Step 3: {steps[2].title}</h2>
            <div className="flex items-center gap-2">
              {isStepComplete(3) && <Check className="h-4 w-4 text-green-500" />}
              <ChevronDown className="h-4 w-4" />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="p-6 pt-2">
            <div className="flex flex-col gap-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild className="w-full">
                  <Button
                    variant="outline"
                    className="w-full justify-center font-normal"
                    disabled={loadingPolicies || policyIds.length === 0}
                  >
                    {selectedPolicy ? (
                      <span>
                        {selectedPolicy.policyId.slice(0, 10)}...{selectedPolicy.policyId.slice(-8)}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground sm:text-base">
                        {loadingPolicies ? (
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading...
                          </div>
                        ) : policyIds.length === 0 ? (
                          'No policies available'
                        ) : (
                          `Select a policy (${policyIds.length + policyIds.filter((p) => p.isGenerated).length})`
                        )}
                      </span>
                    )}

                    <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="max-h-96 w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto">
                  {/* Generated Policies Section */}
                  {policyIds.some((p) => p.isGenerated) && (
                    <>
                      <DropdownMenuLabel className="flex items-center gap-2 font-medium text-emerald-500">
                        <div className="h-2 w-2 rounded-full bg-emerald-500" />
                        Generated Policies ({policyIds.filter((p) => p.isGenerated).length})
                      </DropdownMenuLabel>
                      {policyIds
                        .filter((policy) => policy.isGenerated)
                        .map((policy) => (
                          <DropdownMenuItem
                            key={policy.policyId}
                            onClick={() => {
                              // Check if policy is expired
                              const currentSlot = lucid?.currentSlot() || 0
                              const slotsRemaining = policy.slot ? policy.slot - currentSlot : null

                              if (slotsRemaining !== null && slotsRemaining <= 0) {
                                // Show error toast
                                toast.error(
                                  <div className="flex flex-col gap-2">
                                    <p className="font-medium">Policy has expired</p>
                                    <p className="text-sm text-muted-foreground">
                                      This policy (ending in ...{policy.policyId.slice(-8)}) can no
                                      longer be used for minting. Please select or generate a new
                                      policy.
                                    </p>
                                  </div>,
                                  { position: 'bottom-center', duration: 6000 },
                                )

                                // Remove expired policy from state
                                setPolicyIds((prev) =>
                                  prev.filter((p) => p.policyId !== policy.policyId),
                                )

                                // If this was the selected policy, clear the selection
                                if (selectedPolicy?.policyId === policy.policyId) {
                                  setSelectedPolicy(null)
                                }

                                return
                              }

                              setSelectedPolicy(policy)
                            }}
                            className="flex items-center justify-between gap-2 transition-colors hover:bg-emerald-100"
                          >
                            <div className="flex items-center gap-2">
                              {selectedPolicy?.policyId === policy.policyId && (
                                <Check className="h-4 w-4 text-emerald-500" />
                              )}
                              <span
                                className={
                                  selectedPolicy?.policyId === policy.policyId
                                    ? 'text-emerald-500'
                                    : ''
                                }
                              >
                                {policy.policyId.slice(0, 14)}...{policy.policyId.slice(-8)}
                              </span>
                            </div>
                            {policy.slot && (
                              <span
                                className={`text-xs ${formatExpiryTime(policy.slot) === 'Expired'
                                  ? 'text-destructive'
                                  : 'text-muted-foreground'
                                  }`}
                              >
                                expires in {formatExpiryTime(policy.slot)}
                              </span>
                            )}
                          </DropdownMenuItem>
                        ))}
                    </>
                  )}

                  {/* Separator between sections if both exist */}
                  {policyIds.some((p) => p.isGenerated) &&
                    policyIds.some((p) => !p.isGenerated) && <DropdownMenuSeparator />}

                  {/* Loaded Policies Section */}
                  {policyIds.some((p) => !p.isGenerated) && (
                    <>
                      <DropdownMenuLabel className="flex items-center gap-2 font-medium text-blue">
                        <div className="h-2 w-2 rounded-full bg-blue" />
                        Loaded Policies ({policyIds.filter((p) => !p.isGenerated).length})
                      </DropdownMenuLabel>
                      {policyIds
                        .filter((policy) => !policy.isGenerated)
                        .map((policy) => (
                          <DropdownMenuItem
                            key={policy.policyId}
                            onClick={async () => {
                              const slot = extractSlotFromScript(policy.script)
                              const currentSlot = lucid?.currentSlot() || 0
                              const slotsRemaining = slot ? slot - currentSlot : null

                              if (slotsRemaining !== null && slotsRemaining <= 0) {
                                toast.error(
                                  <div className="flex flex-col gap-2">
                                    <p className="font-medium">Policy has expired</p>
                                    <p className="text-sm text-muted-foreground">
                                      This policy (ending in ...{policy.policyId.slice(-8)}) can no
                                      longer be used for minting. Please select or generate a new
                                      policy.
                                    </p>
                                  </div>,
                                  { position: 'bottom-center', duration: 6000 },
                                )

                                setPolicyIds((prev) =>
                                  prev.filter((p) => p.policyId !== policy.policyId),
                                )

                                if (selectedPolicy?.policyId === policy.policyId) {
                                  setSelectedPolicy(null)
                                }

                                return
                              }

                              setSelectedPolicy({
                                ...policy,
                                slot: slot,
                              })
                            }}
                            className="hover:bg-blue-100 flex items-center justify-between gap-2 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              {selectedPolicy?.policyId === policy.policyId && (
                                <Check className="text-blue-500 h-4 w-4" />
                              )}
                              <span
                                className={
                                  selectedPolicy?.policyId === policy.policyId
                                    ? 'text-blue-500'
                                    : ''
                                }
                              >
                                {policy.policyId.slice(0, 10)}...{policy.policyId.slice(-8)}
                              </span>
                            </div>
                            {policy.slot && (
                              <span
                                className={`text-xs ${formatExpiryTime(policy.slot) === 'Expired'
                                  ? 'text-destructive'
                                  : 'text-muted-foreground'
                                  }`}
                              >
                                {formatExpiryTime(policy.slot)}
                              </span>
                            )}
                          </DropdownMenuItem>
                        ))}
                    </>
                  )}
                  {loadingPolicies && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-transparent" />
                      Loading policies...
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <div className="flex w-full flex-col gap-2">
                <Button3D
                  disabled={!isStepComplete(2) || scanning}
                  onClick={loadPolicies}
                  variant="outline"
                  className="flex-1 text-sm sm:text-base"
                >
                  {scanning ? 'Scanning...' : 'Load Policies'}
                </Button3D>
                <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button3D
                      disabled={!isStepComplete(2) || generatingPolicy || scanning}
                      onClick={() => setIsGenerateDialogOpen(true)}
                      className="flex-1 text-sm sm:text-base"
                    >
                      Generate New Policy
                    </Button3D>
                  </DialogTrigger>

                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Policy Expiration Settings</DialogTitle>
                      <DialogDescription>
                        Configure when this policy should expire
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label>
                          {expiryConfig.hasExpiry
                            ? `Policy Expires After ${expiryConfig.days} Days`
                            : 'Policy Never Expires'}
                        </Label>
                        <Switch
                          checked={expiryConfig.hasExpiry}
                          onCheckedChange={(checked) =>
                            setExpiryConfig((prev) => ({ ...prev, hasExpiry: checked }))
                          }
                        />
                      </div>

                      {expiryConfig.hasExpiry && (
                        <div className="space-y-2">
                          <Slider
                            value={[expiryConfig.days]}
                            onValueChange={([days]) =>
                              setExpiryConfig((prev) => ({ ...prev, days }))
                            }
                            min={1}
                            max={73000} // 200 years
                            step={1}
                          />
                          <Input
                            type="number"
                            min={1}
                            max={73000}
                            value={expiryConfig.days}
                            onChange={(e) => {
                              const value = Math.min(73000, Math.max(1, Number(e.target.value)))
                              setExpiryConfig((prev) => ({ ...prev, days: value }))
                            }}
                          />
                          <p className="text-xs text-muted-foreground">
                            {(() => {
                              const days = expiryConfig.days
                              if (days >= 365) {
                                const years = Math.floor(days / 365)
                                const remainingDays = days % 365
                                return `Approximately ${years} year${years !== 1 ? 's' : ''}${remainingDays > 0 ? ` and ${remainingDays} day${remainingDays !== 1 ? 's' : ''}` : ''
                                  }`
                              }
                              return `${days} day${days !== 1 ? 's' : ''}`
                            })()}
                          </p>
                        </div>
                      )}

                      <Button3D
                        onClick={async () => {
                          await generatePolicyId()
                          setIsGenerateDialogOpen(false)
                        }}
                        disabled={generatingPolicy}
                        className="w-full"
                      >
                        {generatingPolicy ? 'Generating...' : 'Confirm & Generate Policy'}
                      </Button3D>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Step 4: Mint! */}
      {selectedPolicy && (
        <Collapsible
          open={openSections.includes(4)}
          onOpenChange={(isOpen) => {
            setOpenSections(isOpen ? [...openSections, 4] : openSections.filter((s) => s !== 4))
          }}
          className="w-full rounded-lg border border-border bg-card"
        >
          <CollapsibleTrigger className="flex w-full items-center justify-between p-6 hover:bg-secondary/10">
            <h2 className="text-lg font-semibold">Step 4: {steps[3].title}</h2>
            <div className="flex items-center gap-2">
              {isStepComplete(4) && <Check className="h-4 w-4 text-green-500" />}
              <ChevronDown className="h-4 w-4" />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="p-6 pt-2">
            <div className="flex flex-col gap-4">
              {/* Existing input fields */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <label htmlFor="nft-name" className="text-sm font-medium">
                    Asset Name
                  </label>
                  <Input
                    id="nft-name"
                    type="text"
                    placeholder="Enter a unique identifier for your NFT (e.g., MyCoolNFT001)"
                    value={nftName}
                    onChange={(e) => setNftName(e.target.value)}
                    autoFocus
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    This is the unique identifier for your NFT. Use only letters, numbers, and underscores.
                  </p>
                </div>

                <div className="space-y-1">
                  <label htmlFor="nft-title" className="text-sm font-medium">
                    Display Name
                  </label>
                  <Input
                    id="nft-title"
                    type="text"
                    placeholder="Enter a display name for your NFT (e.g., My Cool NFT #1)"
                    value={nftTitle}
                    onChange={(e) => setNftTitle(e.target.value)}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    This is the human-readable name that will be displayed in wallets and marketplaces.
                  </p>
                </div>

                <div className="space-y-1">
                  <label htmlFor="nft-description" className="text-sm font-medium">
                    NFT Description
                  </label>
                  <Input
                    id="nft-description"
                    type="text"
                    placeholder="Describe your NFT (e.g., A unique digital artwork created in 2024)"
                    value={nftDescription}
                    onChange={(e) => setNftDescription(e.target.value)}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Provide a brief description of your NFT that helps collectors understand its value.
                  </p>
                </div>
              </div>

              {/* Metadata Editor Section */}
              <div className="space-y-2">
                <div className="space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex gap-2 flex-row items-center">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5"
                        onClick={() => {
                          // Convert current metadata to pool.pm format
                          const currentMetadata = {
                            "721": {
                              [selectedPolicy.policyId]: {
                                [nftName || '<asset_name>']: {
                                  name: nftTitle || '<name>',
                                  image: thumbnailImage ? `ipfs://${thumbnailImage}` : '[preview image]',
                                  mediaType: thumbnailImage?.toLowerCase().endsWith('.gif') ? 'image/gif' : 'image/png',
                                  description: nftDescription || '[description]',
                                  files: selectedFiles.map((file) => ({
                                    name: file.customName || file.name,
                                    mediaType: file.name.toLowerCase().endsWith('.gif') ? 'image/gif' : 'image/png',
                                    src: `ipfs://${file.url}`,
                                    ...(file.properties && Object.keys(file.properties).length > 0
                                      ? file.properties
                                      : {}),
                                  })),
                                },
                              },
                            }
                          }

                          // Extract the NFT data
                          const metadata = currentMetadata as { "721": Record<string, Record<string, any>> };
                          const policyId = Object.keys(metadata["721"])[0];
                          const nftKey = Object.keys(metadata["721"][policyId])[0];
                          const nftData = metadata["721"][policyId][nftKey];

                          // Create pool.pm format
                          const poolMetadata = {
                            "721": {
                              [policyId]: {
                                [nftKey]: {
                                  name: nftData.name,
                                  image: nftData.image,
                                  mediaType: nftData.mediaType,
                                  ...(nftData.description && { description: nftData.description }),
                                  ...(nftData.files && { files: nftData.files })
                                }
                              }
                            }
                          }

                          // Encode the metadata for the URL
                          const encodedMetadata = encodeURIComponent(JSON.stringify(poolMetadata))

                          // Open pool.pm in a new tab
                          window.open(`https://pool.pm/test/metadata?metadata=${encodedMetadata}`, '_blank')
                        }}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span className="text-sm">Preview</span>
                        <Image src={poolPmIco} alt='pool.pm' width={16} height={16} />
                      </Button>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1.5"
                          onClick={() => {
                            const metadata = JSON.stringify({
                              "721": {
                                [selectedPolicy.policyId]: {
                                  [nftName || '<asset_name>']: {
                                    name: nftTitle || '<name>',
                                    image: thumbnailImage ? `ipfs://${thumbnailImage}` : '[preview image]',
                                    mediaType: thumbnailImage?.toLowerCase().endsWith('.gif') ? 'image/gif' : 'image/png',
                                    description: nftDescription || '[description]',
                                    files: selectedFiles.map((file) => ({
                                      name: file.customName || file.name,
                                      mediaType: file.name.toLowerCase().endsWith('.gif') ? 'image/gif' : 'image/png',
                                      src: `ipfs://${file.url}`,
                                      ...(file.properties && Object.keys(file.properties).length > 0
                                        ? file.properties
                                        : {}),
                                    })),
                                  },
                                },
                              }
                            }, null, 2)
                            navigator.clipboard.writeText(metadata)
                            toast.success('Metadata copied to clipboard', { position: 'bottom-center' })
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                          <span className="text-sm">Copy</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Metadata Preview</label>
                    <div className="rounded-lg border border-border">
                      <JsonPreview
                        data={{
                          "721": {
                            [selectedPolicy?.policyId || '']: {
                              [nftName || '<asset_name>']: {
                                name: nftTitle || '<name>',
                                image: `ipfs://${thumbnailImage}`,
                                mediaType: thumbnailImage ? VALID_IMAGE_MIMES[`.${selectedFiles.find(f => f.url === thumbnailImage)?.name.split('.').pop()!.toLowerCase()}`] : '',
                                description: nftDescription,
                                files: selectedFiles.map(file => ({
                                  name: file.customName || file.name,
                                  mediaType: VALID_IMAGE_MIMES[`.${file.name.split('.').pop()!.toLowerCase()}`],
                                  src: `ipfs://${file.url}`,
                                  ...(file.properties || {})
                                }))
                              }
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Quantity input and warning */}
                <div className="space-y-1">
                  <label htmlFor="mint-quantity" className="text-sm font-medium">
                    Quantity to Mint
                  </label>
                  <Input
                    id="mint-quantity"
                    type="number"
                    min="1"
                    max="42069"
                    value={mintQuantity}
                    onChange={(e) => {
                      const value = e.target.value === '' ? '' : parseInt(e.target.value)
                      if (value === '' || (!isNaN(value) && value >= 0 && value <= 42069)) {
                        setMintQuantity(value as number)
                      }
                    }}
                    onBlur={(e) => {
                      const value = parseInt(e.target.value)
                      if (isNaN(value) || value < 1) {
                        setMintQuantity(1)
                      }
                    }}
                    placeholder="Enter number of copies to mint (1-42069)"
                    className={`w-full ${mintQuantity > 1 ? 'border-yellow-500' : 'border-border'}`}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter a number between 1 and 42069. Minting more than 1 copy will create a Fungible Token (FT).
                  </p>

                  {mintQuantity > 1 && (
                    <div className="mt-2 flex items-center gap-2 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm text-yellow-500">
                      <AlertCircle className="h-4 w-4" />
                      <span>
                        Warning: Minting multiple copies will create a Fungible Token (FT) instead
                        of a Non-Fungible Token (NFT). Each copy will be identical and
                        interchangeable.
                      </span>
                    </div>
                  )}
                </div>

                {/* Mint button */}
                <Button3D
                  disabled={!isStepComplete(4) || minting || !walletState.api}
                  onClick={() => {
                    if (walletState.api && nftName && nftTitle && nftDescription && selectedFiles.length > 0) {
                      mintNFT(lucid, selectedPolicy, nftName, nftTitle, nftDescription, selectedFiles)
                    } else {
                      if (!nftName || !nftTitle || !nftDescription) {
                        toast.error('NFT name, title, and description must be provided', {
                          position: 'bottom-center',
                        })
                      } else {
                        toast.error('Wallet not connected', { position: 'bottom-center' })
                      }
                    }
                  }}
                  className="w-full"
                >
                  {minting ? 'Minting...' : 'Mint NFT'}
                </Button3D>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      <Dialog open={showPinataDialog} onOpenChange={setShowPinataDialog}>
        <DialogContent className="flex h-[80vh] w-full max-w-[90vw] flex-col overflow-hidden p-0.5">
          {/* Sticky header */}
          <FilesGridHeader />

          <VisuallyHidden>
            <DialogDescription>lolkek</DialogDescription>
          </VisuallyHidden>

          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto">
            {loadingFiles ? <FileGridSkeleton /> : <FileGrid />}

            {/* No supported files message */}
            {pinataResponse.rows.length > 0 &&
              pinataResponse.rows.filter(
                (file) =>
                  (file.mime_type
                    ? Object.values(VALID_IMAGE_MIMES).includes(file.mime_type)
                    : false) ||
                  VALID_IMAGE_EXTENSIONS.some((ext) =>
                    file.metadata?.name?.toLowerCase().endsWith(ext),
                  ),
              ).length === 0 && (
                <div className="flex flex-col items-center gap-2 p-8 text-center text-muted-foreground">
                  <AlertCircle className="h-8 w-8 sm:h-10 sm:w-10" />
                  <p>No supported image files found</p>
                  <p className="text-sm">Supported formats: {formatSupportedExtensions()}</p>
                </div>
              )}
          </div>

          {/* Fixed pagination */}
          <div className="flex w-full items-center justify-center border-t border-border bg-background py-1">
            <Pagination className="overflow-x-auto">
              <PaginationContent className="flex-nowrap gap-0.5 sm:gap-1">
                {/* Only show Previous button if we're not on page 1 */}
                {pagination.currentPage > 1 ? (
                  <PaginationItem className="cursor-pointer select-none">
                    <PaginationPrevious
                      className="h-8 px-2 text-xs sm:h-9 sm:px-4 sm:text-sm [&>svg]:h-3 [&>svg]:w-3 sm:[&>svg]:h-4 sm:[&>svg]:w-4"
                      onClick={() => handlePageChange(pagination.currentPage - 1)}
                      isActive={loadingFiles || pinataResponse.rows.length === 0}
                    />
                  </PaginationItem>
                ) : (
                  <PaginationItem className="select-none opacity-50">
                    <PaginationPrevious className="h-8 px-2 text-xs sm:h-9 sm:px-4 sm:text-sm [&>svg]:h-3 [&>svg]:w-3 sm:[&>svg]:h-4 sm:[&>svg]:w-4" />
                  </PaginationItem>
                )}

                {/* Generate page numbers */}
                <div className="flex items-center gap-[0.09rem]">
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                    .filter((pageNumber) => {
                      // Always show first and last page
                      if (pageNumber === 1 || pageNumber === pagination.totalPages) return true
                      // Show pages around current page
                      if (Math.abs(pageNumber - pagination.currentPage) <= 1) return true
                      return false
                    })
                    .map((pageNumber, i, array) => (
                      <Fragment key={pageNumber}>
                        {/* Add ellipsis if there's a gap */}
                        {i > 0 && array[i] - array[i - 1] > 1 && (
                          <PaginationItem className="cursor-pointer select-none">
                            <PaginationEllipsis className="h-8 px-2 text-xs sm:h-9 sm:px-4 sm:text-sm [&>svg]:h-3 [&>svg]:w-3 sm:[&>svg]:h-4 sm:[&>svg]:w-4" />
                          </PaginationItem>
                        )}
                        <PaginationItem className="cursor-pointer select-none">
                          <PaginationLink
                            className="h-8 w-8 text-xs sm:h-9 sm:w-9 sm:text-sm"
                            onClick={() => handlePageChange(pageNumber)}
                            isActive={pageNumber === pagination.currentPage}
                          >
                            {pageNumber}
                          </PaginationLink>
                        </PaginationItem>
                      </Fragment>
                    ))}
                </div>

                {pagination.currentPage < pagination.totalPages ? (
                  <PaginationItem className="cursor-pointer select-none">
                    <PaginationNext
                      className="h-8 px-2 text-xs sm:h-9 sm:px-4 sm:text-sm [&>svg]:h-3 [&>svg]:w-3 sm:[&>svg]:h-4 sm:[&>svg]:w-4"
                      onClick={() => handlePageChange(pagination.currentPage + 1)}
                      isActive={loadingFiles}
                    />
                  </PaginationItem>
                ) : (
                  <PaginationItem className="select-none opacity-50">
                    <PaginationNext className="h-8 px-2 text-xs sm:h-9 sm:px-4 sm:text-sm [&>svg]:h-3 [&>svg]:w-3 sm:[&>svg]:h-4 sm:[&>svg]:w-4" />
                  </PaginationItem>
                )}
              </PaginationContent>
            </Pagination>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            {selectedForDeletion.length > 0
              ? `Type "confirm" to delete ${selectedForDeletion.length} files.`
              : 'Type "confirm" to delete this file.'}
          </DialogDescription>
          <div className="rounded-lg border border-destructive/20 bg-gradient-to-b from-destructive/5 to-destructive/10 p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-destructive/10 p-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
              <div className="flex flex-col gap-2">
                <p className="font-semibold text-destructive">Warning: Permanent Action</p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  This action cannot be undone. Deleting{' '}
                  {selectedForDeletion.length > 0 ? 'these files' : 'this file'} from Pinata will
                  break any NFTs that use{' '}
                  {selectedForDeletion.length > 0 ? "these files'" : "this file's"} IPFS link. The
                  NFT&apos;s metadata will still point to
                  {selectedForDeletion.length > 0 ? 'these' : 'this'} IPFS{' '}
                  {selectedForDeletion.length > 0 ? 'addresses' : 'address'}, but the content will
                  no longer be available through Pinata.
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Input
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value.toLowerCase())}
              placeholder='Type "confirm" here'
              autoCapitalize="none"
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  e.stopPropagation()

                  if (confirmationText.toLowerCase() === 'confirm') {
                    if (selectedForDeletion.length > 0) {
                      try {
                        await Promise.all(selectedForDeletion.map((hash) => deleteFile(hash)))
                        setSelectedForDeletion([])
                        setIsMultiDeleteMode(false)
                        setIsConfirmDialogOpen(false)
                        setConfirmationText('')
                      } catch (error) {
                        toast.error('Error deleting files: ' + (error as Error).message, {
                          position: 'bottom-center',
                        })
                      }
                    } else if (fileToDelete) {
                      await handleDeleteConfirmation()
                    }
                  }
                }
              }}
            />
            <div className="mt-2 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsConfirmDialogOpen(false)
                  setConfirmationText('')
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  if (confirmationText.toLowerCase() === 'confirm') {
                    if (selectedForDeletion.length > 0) {
                      try {
                        await Promise.all(selectedForDeletion.map((hash) => deleteFile(hash)))
                        setSelectedForDeletion([])
                        setIsMultiDeleteMode(false)
                        setIsConfirmDialogOpen(false)
                        setConfirmationText('')
                      } catch (error) {
                        toast.error('Error deleting files: ' + (error as Error).message, {
                          position: 'bottom-center',
                        })
                      }
                    } else if (fileToDelete) {
                      await handleDeleteConfirmation()
                    }
                  }
                }}
                disabled={confirmationText.toLowerCase() !== 'confirm'}
              >
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  )
}
