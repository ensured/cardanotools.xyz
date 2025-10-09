import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Clock,
  ExternalLink,
  Gauge,
  Users,
  Scale,
  Copy,
  Minus,
  Plus,
  Loader2,
  Download,
} from 'lucide-react'
import Link from 'next/link'
import { useState, useEffect, useMemo } from 'react'
import { toast } from 'react-hot-toast'
import Image from 'next/image'
import { formatRecipeForDownload } from '@/utils/recipeFormatter'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'

interface RecipeDetailsDialogProps {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  recipe: any // We can type this more strictly if needed
}

// Parse a fraction string (e.g., '1 1/2') to a number
const parseFraction = (fractionString: string): number => {
  if (!fractionString) return 0

  // Handle whole numbers
  if (!fractionString.includes('/')) {
    return Number(fractionString) || 0
  }

  // Handle fractions and mixed numbers
  const parts = fractionString.trim().split(' ')
  if (parts.length === 1) {
    // Simple fraction like '1/2'
    const [numerator, denominator] = parts[0].split('/').map(Number)
    return denominator ? numerator / denominator : 0
  } else {
    // Mixed number like '1 1/2'
    const whole = Number(parts[0]) || 0
    const [numerator, denominator] = parts[1].split('/').map(Number)
    return whole + (denominator ? numerator / denominator : 0)
  }
}

// Format a number back to a fraction string
const formatFraction = (num: number): string => {
  if (!num) return ''

  const whole = Math.floor(num)
  const decimal = num - whole

  // Common fractions and their decimal equivalents
  const fractions: Record<number, string> = {
    0.125: '⅛',
    0.25: '¼',
    0.333: '⅓',
    0.5: '½',
    0.666: '⅔',
    0.75: '¾',
    0.875: '⅞',
  }

  const fraction = fractions[Math.round(decimal * 1000) / 1000]

  if (whole && fraction) {
    return `${whole} ${fraction}`
  } else if (fraction) {
    return fraction
  } else if (decimal > 0) {
    // If no common fraction matches, show 2 decimal places
    return num.toFixed(2)
  }

  return whole.toString()
}

const RecipeDetailsDialog = ({ isOpen, setIsOpen, recipe }: RecipeDetailsDialogProps) => {
  const [servings, setServings] = useState(recipe?.yield || 1)
  const [imageLoading, setImageLoading] = useState(true)

  const handleCopyIngredients = async () => {
    const ingredientsList = recipe.ingredientLines.join('\n')
    await navigator.clipboard.writeText(ingredientsList)
    toast.success('Ingredients copied to clipboard!')
  }

  const handleDownload = async (format: 'txt' | 'md') => {
    const content = formatRecipeForDownload(recipe, format)
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${recipe.label.toLowerCase().replace(/\s+/g, '-')}.${format}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Recipe downloaded!')
  }

  // Calculate scaled quantities
  const getScaledQuantity = (quantity: number) => {
    return Math.round(((quantity * servings) / recipe.yield) * 10) / 10
  }

  if (!recipe) return null

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-h-[100vh] max-w-2xl">
        <DialogHeader>
          <VisuallyHidden>
            <DialogDescription>gg</DialogDescription>
          </VisuallyHidden>
          <div className="flex items-center gap-4">
            {/* Small image thumbnail */}
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md">
              {imageLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                  <Loader2 className="size-6 animate-spin" />
                </div>
              )}
              <Image
                src={recipe.image}
                alt={recipe.label}
                fill
                className="object-cover"
                onLoadingComplete={() => setImageLoading(false)}
                priority
              />
            </div>
            <div className="flex flex-col gap-2">
              <DialogTitle className="text-xl font-bold">{recipe.label}</DialogTitle>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className="flex items-center gap-1">
                  <Clock className="size-3" />
                  {recipe.totalTime ? `${recipe.totalTime} mins` : 'Time N/A'}
                </Badge>
                <Badge variant="outline" className="flex items-center gap-1">
                  <Users className="size-3" />
                  {recipe.yield} servings
                </Badge>
                <Badge variant="outline" className="flex items-center gap-1">
                  <Scale className="size-3" />
                  {Math.round(recipe.calories)} cal
                </Badge>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {recipe.dietLabels.map((label: string) => (
                <Badge key={label} variant="secondary">
                  {label}
                </Badge>
              ))}
              {recipe.cuisineType && (
                <Badge variant="secondary" className="capitalize">
                  {recipe.cuisineType}
                </Badge>
              )}
              {recipe.mealType && (
                <Badge variant="secondary" className="capitalize">
                  {recipe.mealType}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Download className="size-4" />
                    Download
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleDownload('txt')}>
                    Download as TXT
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDownload('md')}>
                    Download as Markdown
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" size="sm" onClick={handleCopyIngredients} className="gap-2">
                <Copy className="size-4" />
                Copy Ingredients
              </Button>
              <Link href={recipe.shareAs} target="_blank">
                <Button variant="outline" className="gap-2">
                  View Recipe <ExternalLink className="size-4" />
                </Button>
              </Link>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="size-6"
                onClick={() => setServings(Math.max(1, servings - 1))}
                disabled={servings <= 1}
              >
                <Minus className="size-3" />
              </Button>
              <span className="w-8 text-center">{servings}</span>
              <Button
                variant="outline"
                size="icon"
                className="mr-1 size-6"
                onClick={() => setServings(servings + 1)}
              >
                <Plus className="size-3" />
              </Button>
              <span className="text-sm text-muted-foreground">servings</span>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(60vh-4rem)] w-full pr-4">
          <div className="grid gap-4 pb-4">
            <div>
              <h3 className="mb-2 text-lg font-semibold">Ingredients</h3>

              <ul className="ml-4 list-disc space-y-2">
                {recipe.ingredients.map((ingredient: any) => (
                  <IngredientItem
                    key={ingredient.foodId}
                    ingredient={ingredient}
                    servings={servings}
                    recipeYield={recipe.yield}
                  />
                ))}
              </ul>
            </div>

            <div className="mb-2 flex items-center justify-between gap-1">
              <h3 className="text-lg font-semibold">Nutrition (per serving)</h3>

              <div className="xs:grid-cols-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {Object.entries(recipe.totalNutrients)
                  .filter(([_, value]: [string, any]) => value.quantity > 0)
                  .map(([key, value]: [string, any]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between rounded-lg border p-2"
                    >
                      <div className="text-sm font-medium">{value.label}</div>
                      <div className="text-sm text-muted-foreground">
                        {getScaledQuantity(value.quantity)}
                        {value.unit}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {recipe.healthLabels?.length > 0 && (
              <div>
                <h3 className="mb-2 text-lg font-semibold">Health Labels</h3>
                <div className="flex flex-wrap gap-1">
                  {recipe.healthLabels.map((label: string) => (
                    <Badge key={label} variant="outline">
                      {label}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {recipe.instructions && (
              <div>
                <h3 className="mb-2 text-lg font-semibold">Instructions</h3>
                <ol className="ml-4 list-decimal space-y-2">
                  {recipe.instructions.map((step: string, index: number) => (
                    <li key={index}>{step}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

// Separate component to handle ingredient text processing
const IngredientItem = ({
  ingredient,
  servings,
  recipeYield,
}: {
  ingredient: any
  servings: number
  recipeYield: number
}) => {
  const processedText = useMemo(() => {
    const text = ingredient.text
    if (!text) return text

    // Simplified regex to find all numbers and fractions
    const numberRegex = /(\d+\s*\/\s*\d+|\d+\s+\d+\/\d+|\d+\s*[¼½¾⅓⅔⅛⅜⅝⅞]?|¼|½|¾|⅓|⅔|⅛|⅜|⅝|⅞)/g
    const parts = []
    let lastIndex = 0
    let match

    // Use a counter to prevent potential infinite loops
    let safetyCounter = 0
    const MAX_ITERATIONS = 100

    while ((match = numberRegex.exec(text)) !== null && safetyCounter < MAX_ITERATIONS) {
      safetyCounter++
      const [numberMatch] = match
      const matchStart = match.index
      const matchEnd = matchStart + numberMatch.length

      // Add text before the number
      if (matchStart > lastIndex) {
        parts.push(text.substring(lastIndex, matchStart))
      }

      // Process and add the number
      try {
        const originalQuantity = parseFraction(numberMatch)
        const scaledQuantity = (originalQuantity * servings) / (recipeYield || 1)
        const displayQuantity = formatFraction(Math.round(scaledQuantity * 8) / 8)

        parts.push(
          <span key={`${ingredient.foodId}-${matchStart}`} className="font-medium">
            {displayQuantity}
          </span>,
        )
      } catch (e) {
        // If parsing fails, just add the original text
        parts.push(numberMatch)
      }

      lastIndex = matchEnd
    }

    // Add any remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex))
    }

    return parts.length > 0 ? parts : text
  }, [ingredient.text, servings, recipeYield, ingredient.foodId])

  return <li>{processedText}</li>
}

export default RecipeDetailsDialog
