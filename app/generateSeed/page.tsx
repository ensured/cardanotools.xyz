'use client'

import { AlertCircle, Copy, Check } from 'lucide-react'
import Button3D from '@/components/3dButton'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectGroup,
  SelectLabel,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useState } from 'react'
import * as bip39 from 'bip39'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown } from 'lucide-react'

const Page = () => {
  const [mnemonic, setMnemonic] = useState<string>('')
  const [wordCount, setWordCount] = useState<128 | 160 | 192 | 256>(256)
  const [hasCopied, setHasCopied] = useState(false)
  const [isValid, setIsValid] = useState<boolean | null>(null)
  const [customMnemonic, setCustomMnemonic] = useState<string>('')
  const [isOpen, setIsOpen] = useState(false)

  const handleGenerateMnemonic = () => {
    try {
      const newMnemonic = bip39.generateMnemonic(wordCount, undefined, bip39.wordlists.english)
      setMnemonic(newMnemonic)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate mnemonic', {
        position: 'bottom-center',
      })
    }
  }

  const handleValidateMnemonic = () => {
    try {
      const valid = bip39.validateMnemonic(customMnemonic, bip39.wordlists.english)
      setIsValid(valid)
      if (valid) {
        toast.success('Mnemonic is valid!', { position: 'bottom-center' })
      } else {
        toast.error('Invalid mnemonic phrase', { position: 'bottom-center' })
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to validate mnemonic', {
        position: 'bottom-center',
      })
    }
  }

  return (
    <div className="mx-auto mt-14 flex max-w-sm flex-col items-center justify-center sm:max-w-md">
      <div className="flex w-full flex-col gap-4 rounded-lg border border-border bg-card p-6">
        <h1 className="text-2xl font-bold">Generate Mnemonic Seed Phrase</h1>

        <div className="flex flex-col gap-4">
          <div className="flex flex-row gap-2 text-sm text-yellow-500">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
            For maximum security: Disconnect from the internet, generate your seed phrase, write it
            down on paper, and close this page before reconnecting. Never store this seed phrase
            digitally.
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="relative w-32">
                <Select
                  value={wordCount.toString()}
                  onValueChange={(value) => setWordCount(Number(value) as 128 | 160 | 192 | 256)}
                >
                  <SelectTrigger className="h-10 w-full appearance-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                    <SelectValue placeholder="Word count" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="128">12 words</SelectItem>
                    <SelectItem value="160">15 words</SelectItem>
                    <SelectItem value="192">18 words</SelectItem>
                    <SelectItem value="256">24 words</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button3D onClick={handleGenerateMnemonic}>Generate</Button3D>
            </div>
          </div>

          {mnemonic && (
            <div className="relative space-y-2">
              <Separator />
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Generated Mnemonic</Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8"
                  onClick={() => {
                    navigator.clipboard.writeText(mnemonic)
                    setHasCopied(true)
                    setTimeout(() => setHasCopied(false), 1000)
                  }}
                >
                  {hasCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="break-all text-sm">{mnemonic}</p>
              </div>

              <div className="flex flex-row gap-2 text-xs text-muted-foreground">
                <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                Keep this mnemonic phrase secret and secure. Anyone with access to it can control
                your wallet.
              </div>
            </div>
          )}

          <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="flex w-full items-center justify-between">
                Validate Existing Mnemonic
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180 transform' : ''}`}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="manual-mnemonic">Enter a seed phrase:</Label>
                <Textarea
                  id="manual-mnemonic"
                  placeholder="Enter your seed phrase here..."
                  value={customMnemonic}
                  onChange={(e) => setCustomMnemonic(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>

              <div className="flex flex-row gap-2">
                <Button
                  onClick={handleValidateMnemonic}
                  disabled={!customMnemonic}
                  variant={
                    isValid === true ? 'default' : isValid === false ? 'destructive' : 'outline'
                  }
                >
                  Validate Mnemonic
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </div>
  )
}

export default Page
