/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from "react"
import { MAX_FAVORITES } from "@/utils/consts"
import { extractRecipeId } from "@/utils/helper"
import { useWindowSize } from "@uidotdev/usehooks"
import { Heart, Loader2, StarIcon } from "lucide-react"
import { useTheme } from "next-themes"
import { toast } from "react-hot-toast"

import { getFavoritesFirebase, removeItemsFirebase } from "./actions"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet"

const FavoritesSheet = ({
  children,
  setOpen,
  isOpen,
  loading,
  favorites,
  setFavorites,
  userEmail,
  isFavoritesLoading,
  setIsFavoritesLoading,
}) => {
  const size = useWindowSize()
  const [lastFetchTime, setLastFetchTime] = useState(0)

  useEffect(() => {
    const getFavs = async () => {
      setIsFavoritesLoading(true)

      try {
        const currentTime = Date.now()
        const timeElapsed = currentTime - lastFetchTime

        // Fetch only if 10 seconds have passed
        if (timeElapsed >= 120000) {
          const res = await getFavoritesFirebase(userEmail)
          if (res) {
            setFavorites(res)
            setLastFetchTime(currentTime) // Update the last fetch time
          } else {
            toast.error("No favorites found")
          }
        }
      } catch (error) {
        console.error("Error fetching favorites:", error)
        toast.error("Failed to load favorites from server.")
      } finally {
        setIsFavoritesLoading(false)
      }
    }

    if (isOpen) {
      getFavs()
    }
  }, [isOpen, userEmail])

  return (
    <div className="flex justify-center">
      <Sheet open={isOpen} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            disabled={isFavoritesLoading || loading}
            variant="outline"
            className="flex items-center justify-between gap-1.5 px-3 py-2 text-xs md:text-sm"
            size="sm"
          >
            {isFavoritesLoading ? (
              <>
                <div className="flex items-center gap-1.5">
                  <Loader2 className="size-4 animate-spin md:size-5" />
                  <span>Favorites</span>
                </div>
                <div className="flex items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground">
                  {Object.keys(favorites).length}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <Heart
                    className="size-4 md:size-5"
                    aria-details="Heart icon"
                  />
                  <span>Favorites</span>
                </div>
                <div className="flex items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground">
                  {Object.keys(favorites).length}
                </div>
              </>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="right">
          <SheetHeader className="space-y-1.5">
            <SheetTitle className="select-none">
              <div
                className="flex animate-gradient flex-wrap items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-[#a3e5ff] to-[#a371ff] bg-[length:400%_400%] p-2.5 text-2xl transition-all ease-in-out
              
              dark:from-[#3d91c9] dark:to-[#583aa8] md:p-4 md:text-3xl"
              >
                <div className="flex flex-row items-center justify-center gap-2">
                  <StarIcon
                    size={size?.width < 768 ? 28 : 32}
                    color="#FFD700" // Use gold color for the star icon
                  />
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    Favorites
                  </span>
                </div>
                <Badge
                  max={MAX_FAVORITES}
                  className="mt-0.5 flex border border-primary text-sm md:text-lg"
                  size="sm"
                  variant="outline"
                >
                  {Object.keys(favorites).length}/{MAX_FAVORITES}
                </Badge>
              </div>
            </SheetTitle>
            <SheetDescription></SheetDescription>
          </SheetHeader>
          {children}
        </SheetContent>
      </Sheet>
    </div>
  )
}
export default FavoritesSheet
