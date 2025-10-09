/* eslint-disable react-hooks/exhaustive-deps */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { extractRecipeId, extractRecipeName } from '@/utils/helper'
import { debounce } from 'lodash'
// Import debounce from lodash
import { toast, useToasterStore } from 'react-hot-toast'

import { MAX_FAVORITES } from '@/utils/consts'
import { removeItemsFirebase, addItemsFirebase } from '../app/actions'
import { useTheme } from 'next-themes'
import { useWallet } from '@/contexts/WalletContext'
import { useUser } from '@clerk/nextjs'

const useRecipeSearch = () => {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [searchResults, setSearchResults] = useState({
    hits: [],
    count: 0,
    nextPage: '',
  })
  const searchParams = useSearchParams()
  const [input, setInput] = useState(searchParams?.get('q') || '')
  const [lastInputSearched, setLastInputSearched] = useState(null)
  const lastFoodItemRef = useRef()
  const [favorites, setFavorites] = useState({})
  const [hoveredRecipeIndex, setHoveredRecipeIndex] = useState(null)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [isMobile, setIsMobile] = useState(false)
  const [isFavoritesLoading, setIsFavoritesLoading] = useState(false)
  const { theme } = useTheme()
  const pendingRemovals = useRef(new Set())
  const pendingAdditions = useRef(new Set())
  const [userEmail, setUserEmail] = useState(null)

  const [pendingRequests, setPendingRequests] = useState(new Set())
  const { user } = useUser()
  const { walletState } = useWallet()

  const [showSuggestions, setShowSuggestions] = useState(false)

  useEffect(() => {
    setUserEmail(walletState.stakeAddress || user?.emailAddresses[0]?.emailAddress || null)
  }, [walletState, user])

  const TOAST_LIMIT = 1
  const { toasts } = useToasterStore()

  useEffect(() => {
    toasts
      .filter((t) => t.visible)
      .filter((_, i) => i >= TOAST_LIMIT)
      .forEach((t) => toast.dismiss(t.id))
  }, [toasts])

  const searchRecipes = useCallback(
    async (e, q, selectedHealth, excludedIngredients, selectedMealType) => {
      if (setShowSuggestions) {
        setShowSuggestions(false)
      }
      setSearchResults({
        hits: [],
        count: 0,
        nextPage: '',
      })
      setLoading(true)
      if (q) {
        try {
          // Build the query URL with filters
          let queryUrl = `/api/search?q=${q}`
          if (selectedHealth) {
            queryUrl += `&health=${selectedHealth}`
          }
          if (excludedIngredients?.length > 0) {
            excludedIngredients.forEach((item) => {
              queryUrl += `&excluded=${encodeURIComponent(item)}`
            })
          }
          if (selectedMealType) {
            queryUrl += `&mealType=${selectedMealType}`
          }
          const res = await fetch(queryUrl)

          const data = await res.json()
          if (data.success === false) {
            toast.dismiss() // Dismiss any existing toasts
            toast(data.message, {
              type: 'error',
              duration: 1000,
              position: 'top-center',
              onClick: (t) => toast.dismiss(t.id),
            })
            return
          }

          setSearchResults((prevSearchResults) => ({
            ...prevSearchResults,
            hits: data.data.hits,
            count: data.data.count,
            nextPage: data?.data?._links?.next?.href || '',
          }))
          setLastInputSearched(q)
          setLoading(false)

          toast.success(`Found ${data.data.count} recipes`, {
            duration: 1500,
            position: 'top-center',
            onClick: (t) => toast.dismiss(t.id),
            style: {
              background: theme === 'dark' ? '#121212' : '#fff',
              color: theme === 'dark' ? '#fff' : '#000',
            },
          })

          return
        } catch (error) {
          setLoading(false)
          toast(error.message, {
            type: 'error',
          })
        } finally {
          setLoading(false)
          router.replace(`?q=${q}`)
        }
      }

      try {
        // Build the query URL with filters for the input case
        let queryUrl = `/api/search?q=${input}`
        if (selectedHealth) {
          queryUrl += `&health=${selectedHealth}`
        }
        if (excludedIngredients?.length > 0) {
          excludedIngredients.forEach((item) => {
            queryUrl += `&excluded=${encodeURIComponent(item)}`
          })
        }

        const res = await fetch(queryUrl)
        const data = await res.json()
        if (data.success === false) {
          toast.dismiss() // Dismiss any existing toasts
          toast(data.message, {
            type: 'error',
            duration: 3000,
            onClick: (t) => toast.dismiss(t.id),
          })
          return
        } else {
          setSearchResults((prevSearchResults) => ({
            ...prevSearchResults,
            hits: data.data.hits,
            count: data.data.count,
            nextPage: data.data._links.next?.href || '',
          }))
          setLastInputSearched(input)
        }
      } catch (err) {
        console.log(err)
      } finally {
        setLoading(false)
        router.replace(`?q=${input}`)
      }
    },
    [],
  )

  const debouncedAddItemsFirebase = debounce(async () => {
    if (pendingAdditions.current.size === 0) return

    const itemsToAdd = Array.from(pendingAdditions.current)
    pendingAdditions.current.clear()

    try {
      const response = await addItemsFirebase(userEmail, itemsToAdd)

      if (response.error) {
        toast.error(response.error)
        return
      }

      // Update favorites with successful uploads
      setFavorites((prev) => {
        const updatedFavorites = { ...prev }
        response.results.forEach((result) => {
          if (result.success) {
            updatedFavorites[result.link] = {
              name: result.name,
              url: result.url,
              link: result.link,
            }
          } else {
            delete updatedFavorites[result.link]
          }
        })
        return updatedFavorites
      })

      if (response.successCount < itemsToAdd.length) {
        toast.error(`Failed to add ${itemsToAdd.length - response.successCount} items`)
      }
    } catch (error) {
      console.error('Batch addition failed:', error)
      toast.error('Failed to add some favorites')

      // Revert optimistic updates on complete failure
      setFavorites((prev) => {
        const newFavorites = { ...prev }
        itemsToAdd.forEach((item) => {
          delete newFavorites[item.link]
        })
        return newFavorites
      })
    }
  }, 800)

  const handleLoadNextPage = useCallback(async () => {
    const { nextPage } = searchResults
    if (nextPage) {
      setLoadingMore(true)
      try {
        const response = await fetch(`/api/search?nextPage=${nextPage}`)
        const data = await response.json()
        if (data.success === false) {
          toast(data.message, {
            type: 'error',
            onClick: (t) => toast.dismiss(t.id),
          })
          return
        }

        setSearchResults((prevSearchResults) => {
          // Ensure we're working with a flat array of recipes
          const newHits = Array.isArray(data.hits) ? data.hits : [];
          
          return {
            ...prevSearchResults,
            hits: [...prevSearchResults.hits, ...newHits],
            count: data.count || prevSearchResults.count,
            nextPage: data._links?.next?.href || '',
          };
        })
        setLoadingMore(false)
      } catch (error) {
        toast(error.message, {
          type: 'error',
        })
        setLoadingMore(false)
      }
    }
  }, [searchResults])

  useEffect(() => {
    const checkIsMobile = () => {
      const isMobileDevice = /Mobi|Android/i.test(navigator.userAgent)
      setIsMobile(isMobileDevice)
    }

    checkIsMobile()

    window.addEventListener('resize', checkIsMobile)

    return () => window.removeEventListener('resize', checkIsMobile)
  }, [])

  useEffect(() => {
    setIsFavoritesLoading(true)
    const storedFavorites = localStorage.getItem('favorites')
    if (!storedFavorites) {
      setIsFavoritesLoading(false)
      return
    }
    try {
      if (
        Object.keys(JSON.parse(storedFavorites)).length > 0 &&
        Object.keys(JSON.parse(storedFavorites)).length <= MAX_FAVORITES
      ) {
        setFavorites(JSON.parse(storedFavorites))
      }
    } catch (e) {
      console.error(e)
    }
    setIsFavoritesLoading(false)
  }, [])

  useEffect(() => {
    if (Object.keys(favorites).length === 0) return
    try {
      const favoritesString = JSON.stringify(favorites)
      // Check size before attempting to save
      const size = new Blob([favoritesString]).size
      // 5MB = 5 * 1024 * 1024 bytes (adjust if needed)
      const MAX_SIZE = 5 * 1024 * 1024

      if (size > MAX_SIZE) {
        toast.error('Favorites storage limit reached. Some items may not be saved.')
        return
      }

      localStorage.setItem('favorites', favoritesString)
    } catch (error) {
      if (error.name === 'QuotaExceededError' || error.code === 22) {
        toast.error('Storage limit reached. Please remove some favorites.')
      } else {
        console.error('Error saving favorites:', error)
        toast.error('Failed to save favorites')
      }
    }
  }, [favorites])

  useEffect(() => {
    const onScroll = () => {
      const scrollTop = document.documentElement.scrollTop
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
      const progress = (scrollTop / scrollHeight) * 100
      setScrollProgress(progress)

      const totalCards = searchResults.hits.length
      const maxIndex = totalCards - 1
      const currentIndex = Math.min(Math.round((progress / 100) * maxIndex), maxIndex)
      setCurrentCardIndex(currentIndex + 1)
    }

    window.addEventListener('scroll', onScroll)

    return () => {
      window.removeEventListener('scroll', onScroll)
    }
  }, [searchResults])

  useEffect(() => {
    // Intersection Observer for the last food item
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && searchResults.nextPage && !loadingMore) {
          handleLoadNextPage()
        }
      },
      { threshold: [0, 0.3] },
    )

    const currentLastFoodItemRef = lastFoodItemRef.current

    if (currentLastFoodItemRef) {
      observer.observe(currentLastFoodItemRef)
    }

    return () => {
      if (currentLastFoodItemRef) {
        observer.unobserve(currentLastFoodItemRef)
      }
    }
  }, [searchResults, handleLoadNextPage, lastFoodItemRef, loadingMore])

  const handleStarIconHover = (index) => () => {
    setHoveredRecipeIndex(index) // Update hover state on enter/leave
  }

  const debouncedRemoveItemsFirebase = useCallback(
    debounce(async (userEmail) => {
      if (pendingRemovals.current.size === 0) return

      const itemsToRemove = Array.from(pendingRemovals.current) // Convert Set to Array
      pendingRemovals.current.clear() // Clear the Set for future removals

      try {
        try {
          await removeItemsFirebase(userEmail, itemsToRemove) // Call your server action
        } catch (error) {
          toast.error('An unexpected error occurred')
        }
      } catch (error) {
        console.error('Batch removal failed:', error)
        toast.error(`Failed to remove ${itemsToRemove.length} favorites`)
      }
    }, 800),
    [],
  )

  const removeFromFavorites = async (link, userEmail) => {
    // If this exact removal request is already pending, don't duplicate it
    if (pendingRequests.has(link)) return

    const key = extractRecipeId(link)
    pendingRemovals.current.add(key)

    // Optimistically update the favorites state immediately
    setFavorites((prev) => {
      const updatedFavorites = { ...prev }
      delete updatedFavorites[link] // Remove the item from the new favorites state
      return updatedFavorites
    })

    try {
      // Add this request to pending set
      setPendingRequests((prev) => new Set(prev).add(link))

      // Trigger the debounced removal
      debouncedRemoveItemsFirebase(userEmail)
    } catch (error) {
      console.error('Error removing from favorites:', error)
      // Optionally, you can revert the state here if needed
      toast.error(error.message)
    } finally {
      // Remove this request from pending set
      setPendingRequests((prev) => {
        const newSet = new Set(prev)
        newSet.delete(link)
        return newSet
      })
    }
  }

  const handleStarIconClick = (index) => (e) => {
    e.preventDefault()

    const recipe = searchResults.hits[index].recipe
    const recipeLink = recipe.shareAs
    const recipeName = extractRecipeName(recipe.shareAs)
    const recipeImage = recipe.image
    const isFavorited = favorites[recipeLink] !== undefined

    // Check MAX_FAVORITES limit before adding
    if (!isFavorited && Object.keys(favorites).length >= MAX_FAVORITES) {
      toast.error(`Maximum of ${MAX_FAVORITES} favorites reached`)
      return
    }

    // Optimistically update UI immediately
    setFavorites((prev) => {
      const updatedFavorites = { ...prev }
      if (isFavorited) {
        delete updatedFavorites[recipeLink]
      } else {
        updatedFavorites[recipeLink] = {
          name: recipeName,
          link: recipeLink,
          url: recipeImage,
        }
      }
      return updatedFavorites
    })

    if (isFavorited) {
      const key = extractRecipeId(recipeLink)
      pendingRemovals.current.add(key)
      debouncedRemoveItemsFirebase(userEmail)
    } else {
      const metadata = {
        contentType: 'image/jpeg',
        customMetadata: {
          name: recipeName,
          link: recipeLink,
          url: recipeImage,
        },
        cacheControl: 'public,max-age=7200',
      }

      // Add to favorites queue
      pendingAdditions.current.add({
        name: recipeName,
        link: recipeLink,
        url: recipeImage,
        metadata,
      })

      // Trigger debounced batch upload
      debouncedAddItemsFirebase()
    }
  }

  return {
    handleStarIconHover,
    loading,
    setLoading,
    loadingMore,
    searchResults,
    input,
    setInput,
    lastFoodItemRef,
    favorites,
    setFavorites,
    searchRecipes,
    hoveredRecipeIndex,
    handleStarIconClick,
    removeFromFavorites,
    scrollProgress,
    currentCardIndex,
    userEmail,
    isMobile,
    setSearchResults,
    lastInputSearched,
    isFavoritesLoading,
    setIsFavoritesLoading,
    showSuggestions,
    setShowSuggestions,
  }
}

export default useRecipeSearch
