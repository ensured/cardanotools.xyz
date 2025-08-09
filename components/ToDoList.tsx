'use client'

import { useState, useEffect, ChangeEvent, useRef, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { CheckIcon, ShoppingCart, Trash2Icon, XIcon, Trash2, Plus, Settings } from 'lucide-react'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Label } from '@radix-ui/react-label'

// Constants
const MAX_ITEMS = 9999
const ITEMS_PER_PAGE = 10

// Store configuration
// Initialize with default stores
const defaultStores = {
  coop: 'Co-Op',
  costco: 'Costco',
  shopncart: 'Shop N Cart',
  albertsons: 'Albertsons',
  none: 'No Store'
} as const

type StoreConfig = Record<string, string>

type StoreKey = keyof typeof defaultStores

interface ShoppingItem {
  id: number
  text: string
  completed: boolean
  store?: StoreKey
  createdAt: number
}

// Add SortableItem component
const SortableItem = ({ item, isMultiSelectMode, selectedItems, toggleItemSelection, toggleItemCompletion, editingItemId, inputRef, newItemInputRef, saveButtonRef, editedItemText, updateItem, editItemValid, handleEditItemChange, startEditingItem, deleteItem }: { item: ShoppingItem, isMultiSelectMode: boolean, selectedItems: Set<number>, toggleItemSelection: (id: number) => void, toggleItemCompletion: (id: number) => void, editingItemId: number | null, inputRef: React.RefObject<HTMLInputElement>, newItemInputRef: React.RefObject<HTMLInputElement>, saveButtonRef: React.RefObject<HTMLButtonElement>, editedItemText: string, updateItem: () => void, editItemValid: boolean, handleEditItemChange: (e: ChangeEvent<HTMLInputElement>) => void, startEditingItem: (id: number, text: string) => void, deleteItem: (id: number) => void }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id || 0 });

  // Make sure the item has an ID
  if (!item.id) return null;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-md border ${isDragging
        ? 'border-primary/50 bg-muted/50 shadow-md ring-1 ring-primary/20 z-10'
        : 'border-border/40 hover:border-border hover:bg-muted/20'
        } transition-all duration-200`}
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        type="button"
        className="absolute left-0 top-0 h-full w-8 cursor-grab active:cursor-grabbing hidden sm:flex items-center justify-center rounded-l-md 
          bg-muted/30 text-muted-foreground/50 
          hover:bg-muted/50 hover:text-muted-foreground 
          active:bg-muted/70 transition-all focus:outline-none focus-visible:ring-1 focus-visible:ring-ring
          sm:w-10"
        title="Drag to reorder"
        onClick={(e) => e.stopPropagation()}
      >
        <svg
          className="size-3.5 transition-transform duration-200 group-hover:scale-110 sm:size-4"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM8 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM8 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM14 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM14 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM20 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM20 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM20 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" />
        </svg>
        <span className="sr-only">Drag to reorder</span>
      </button>
      <div className="flex flex-1 items-center justify-between gap-x-1 py-1.5 pl-2 pr-2 sm:py-2 sm:pl-12 sm:pr-2">
        <div className="flex flex-1 items-center gap-1.5 sm:gap-2">
          <Checkbox
            checked={isMultiSelectMode ? selectedItems.has(item.id) : item.completed}
            onCheckedChange={() => {
              if (isMultiSelectMode) {
                toggleItemSelection(item.id);
              } else {
                toggleItemCompletion(item.id);
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="size-4 transition-transform duration-200 group-hover:scale-105 sm:size-5"
          />
          {editingItemId === item.id ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateItem();
              }}
              className="flex-1"
            >
              <Input
                ref={inputRef}
                type="text"
                value={editedItemText}
                className={`rounded-md border p-1 text-sm sm:text-base focus:ring-0 focus-visible:ring-0 ${!editItemValid ? 'border-red-500 ring-red-500' : ''}`}
                onChange={handleEditItemChange}
                onClick={(e) => e.stopPropagation()}
              />
            </form>
          ) : (
            <span
              className={`ml-0.5 flex-1 cursor-pointer text-sm sm:text-base text-gray-800 dark:text-gray-200 ${item.completed ? 'text-gray-500 line-through dark:text-gray-400' : ''
                }`}
              onClick={(e) => {
                e.stopPropagation();
                startEditingItem(item.id, item.text);
              }}
            >
              {item.text}
            </span>
          )}
        </div>
        <div className="flex items-center gap-x-1">
          {editingItemId === item.id && (
            <Button
              ref={saveButtonRef}
              onClick={(e) => {
                e.stopPropagation();
                updateItem();
              }}
              className="h-7 w-7 rounded-md bg-green-500/80 p-0 font-medium text-white hover:bg-green-500 sm:h-8 sm:w-8"
              size={'icon'}
              variant={'outline'}
            >
              <CheckIcon className="size-4 sm:size-4" />
            </Button>
          )}
          <Button
            onClick={(e) => {
              e.stopPropagation();
              deleteItem(item.id);
            }}
            className="h-7 w-7 rounded-md bg-destructive/80 p-0 font-medium hover:bg-destructive sm:h-8 sm:w-8"
            size={'icon'}
            variant={'ghost'}
          >
            <Trash2Icon className="size-4 sm:size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ToDoList() {
  // State for items and pagination
  const [items, setItems] = useState<ShoppingItem[]>([])
  const [currentPage, setCurrentPage] = useState<number>(1)
  const ITEMS_PER_PAGE = 10; // Number of items to show per page

  // Store management state
  const [stores, setStores] = useState<StoreConfig>(() => {
    const savedStores = typeof window !== 'undefined' ? localStorage.getItem('shoppingStores') : null;
    return savedStores ? JSON.parse(savedStores) : defaultStores;
  });
  const [newStoreName, setNewStoreName] = useState('');
  const [showStoreSettings, setShowStoreSettings] = useState(false);
  const [storeToDelete, setStoreToDelete] = useState<string | null>(null);
  const [showDeleteStoreDialog, setShowDeleteStoreDialog] = useState(false);

  // State for new item input
  const [newItem, setNewItem] = useState<string>('')
  const [selectedStore, setSelectedStore] = useState<string | null>("coop")
  const [newItemValid, setNewItemValid] = useState<boolean>(false)
  const [isInputFocused, setIsInputFocused] = useState<boolean>(false)

  // Handler for input change
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setNewItem(e.target.value);
    setNewItemValid(e.target.value.trim().length > 0);
  };

  // Handler for select change
  const handleSelectChange = (value: string) => {
    setSelectedStore(value === 'none' ? null : value);

    // Focus back on the input after selection
    setTimeout(() => {
      if (newItemInputRef.current) {
        newItemInputRef.current.focus();
      }
    }, 10);
  };



  // State for editing
  const [editingItemId, setEditingItemId] = useState<number | null>(null)
  const [editedItemText, setEditedItemText] = useState<string>('')
  const [editItemValid, setEditItemValid] = useState<boolean>(true)

  // State for dialogs
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<number | null>(null)
  const [pendingItemId, setPendingItemId] = useState<number | null>(null)
  const [pendingText, setPendingText] = useState('')
  const [lastDeletionTime, setLastDeletionTime] = useState<number | null>(null)

  // Component mount state
  const [isMounted, setIsMounted] = useState<boolean>(false)

  // Refs
  const inputRef = useRef<HTMLInputElement | null>(null)
  const newItemInputRef = useRef<HTMLInputElement | null>(null)
  const saveButtonRef = useRef<HTMLButtonElement>(null)

  // Add new state for selected items
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())

  // Add state for multi-select mode
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)

  // Add state for filter
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')

  // Add state for collapsible
  const [isOpen, setIsOpen] = useState(false)

  // Pagination state
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);

  // Group items by store
  const itemsByStore = useMemo(() => {
    const groups: Record<string, ShoppingItem[]> = {}

    items.forEach(item => {
      const storeKey = item.store || 'none'
      const storeName = stores[storeKey] || 'No Store'
      if (!groups[storeName]) {
        groups[storeName] = []
      }
      groups[storeName].push(item)
    })

    // Filter out empty groups and sort by store name
    return Object.entries(groups)
      .filter(([_, storeItems]) => storeItems.length > 0)
      .sort(([storeA], [storeB]) => storeA.localeCompare(storeB))
  }, [items, stores])

  // Render the list of items grouped by store
  const renderItems = () => {
    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <ShoppingCart className="mb-4 size-12 text-muted-foreground" />
          <h3 className="text-lg font-medium text-muted-foreground">No items yet</h3>
          <p className="text-sm text-muted-foreground">Add some items to get started</p>
        </div>
      )
    }

    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        autoScroll={false}
      >
        <SortableContext
          items={items.map(item => item.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-6">
            {itemsByStore.map(([storeName, storeItems]) => (
              <div key={storeName} className="space-y-2">
                <div className="relative my-1">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center">
                    <Badge
                      variant="secondary"
                      className="px-2 py-0.5 h-5 text-xs font-normal bg-background/80 backdrop-blur-sm"
                    >
                      {storeName}
                    </Badge>
                  </div>
                </div>
                {storeItems.map((item) => (
                  <SortableItem
                    key={item.id}
                    item={item}
                    isMultiSelectMode={isMultiSelectMode}
                    selectedItems={selectedItems}
                    toggleItemSelection={toggleItemSelection}
                    toggleItemCompletion={toggleItemCompletion}
                    editingItemId={editingItemId}
                    inputRef={inputRef}
                    newItemInputRef={newItemInputRef}
                    saveButtonRef={saveButtonRef}
                    editedItemText={editedItemText}
                    updateItem={updateItem}
                    editItemValid={editItemValid}
                    handleEditItemChange={handleEditItemChange}
                    startEditingItem={startEditingItem}
                    deleteItem={deleteItem}
                  />
                ))}
              </div>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    )
  }

  // Add sensors for drag handling
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4, // Pixels to move before dragging starts
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150, // ms to wait before drag starts
        tolerance: 5, // px of movement allowed during delay
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Load items on mount
  useEffect(() => {
    setIsMounted(true)
    const savedItems = localStorage.getItem('shoppingItems')
    if (savedItems) {
      setItems(JSON.parse(savedItems))
    }
  }, [])

  // Save items and stores to localStorage
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('shoppingItems', JSON.stringify(items));
      localStorage.setItem('shoppingStores', JSON.stringify(stores));
    }
  }, [items, stores, isMounted])

  // Reset to first page when items length changes
  useEffect(() => {
    setCurrentPage(1)
  }, [items.length])

  // Handle clicks outside input
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (newItemInputRef.current && !newItemInputRef.current.contains(target)) {
        setIsInputFocused(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle clicks outside edit input
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node

      if (saveButtonRef.current?.contains(target)) {
        return
      }

      if (editingItemId !== null && inputRef.current && !inputRef.current.contains(target)) {
        const currentItem = items.find(item => item.id === editingItemId)
        if (currentItem && editedItemText !== currentItem.text) {
          setShowSaveDialog(true)
          return
        }
        setEditingItemId(null)
        setEditedItemText('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [editingItemId, editedItemText, items])

  // Item management functions
  const addItem = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault()
    if (newItem.trim().length < 1) {
      setNewItemValid(false)
      toast.error('Item name must be at least 1 character')
      return
    }
    if (items.length >= MAX_ITEMS) {
      toast.error(`Maximum limit of ${MAX_ITEMS.toLocaleString()} items reached`)
      return
    }
    setNewItemValid(true)

    const newItemObj: ShoppingItem = {
      id: Date.now(),
      text: newItem,
      completed: false,
      store: selectedStore as StoreKey,
      createdAt: Date.now()
    }

    setItems([...items, newItemObj])
    setNewItem('')
    inputRef.current?.focus()
  }

  const updateItem = (): void => {
    if (editingItemId === null) return

    if (editedItemText.trim().length < 1) {
      setEditItemValid(false)
      toast.error('Item name must be at least 1 character')
      return
    }

    setEditItemValid(true)
    setItems(prevItems =>
      prevItems.map(item =>
        item.id === editingItemId
          ? { ...item, text: editedItemText.trim() }
          : item
      )
    )
    setEditingItemId(null)
    setEditedItemText('')
  }

  const toggleItemCompletion = (id: number): void => {
    setItems(items.map((item) =>
      item.id === id ? { ...item, completed: !item.completed } : item
    ))
    setEditingItemId(null)
    setEditedItemText('')
  }

  const startEditingItem = (id: number, text: string): void => {
    if (editingItemId === id) return

    if (editingItemId !== null) {
      updateItem()
    }

    setEditingItemId(id)
    setEditedItemText(text)
    setEditItemValid(true)
    requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
  }

  const deleteItem = (id: number): void => {
    const now = Date.now()
    const lastDeletion = lastDeletionTime || 0

    // If last deletion was within 5 seconds, delete without confirmation :)
    if (now - lastDeletion < 5000) {
      setItems(items.filter((item) => item.id !== id))
      toast.success('Item deleted')
      setLastDeletionTime(now)
    } else {
      // Otherwise, show confirmation dialog
      setItemToDelete(id)
      setShowDeleteDialog(true)
    }
  }

  // Add selection handlers
  const toggleItemSelection = (id: number) => {
    setSelectedItems(prev => {
      const newSelection = new Set(prev)
      if (newSelection.has(id)) {
        newSelection.delete(id)
      } else {
        newSelection.add(id)
      }
      return newSelection
    })
  }

  const toggleSelectAll = () => {
    if (!isMultiSelectMode) {
      setIsMultiSelectMode(true)
    }
    if (selectedItems.size === paginatedItems.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(paginatedItems.map(item => item.id)))
    }
  }

  const deleteSelectedItems = () => {
    setItems(items.filter(item => !selectedItems.has(item.id)))
    setSelectedItems(new Set())
    toast.success(`Deleted ${selectedItems.size} items`)
  }

  const handleEditItemChange = (e: ChangeEvent<HTMLInputElement>) => {
    setEditedItemText(e.target.value)
    setEditItemValid(e.target.value.trim().length >= 1)
  }

  // Dialog handlers
  const handleDialogClose = (shouldSave: boolean) => {
    if (shouldSave) {
      updateItem()
    } else {
      setEditingItemId(null)
      setEditedItemText('')
    }

    if (pendingItemId !== null) {
      setEditingItemId(pendingItemId)
      setEditedItemText(pendingText)
      setEditItemValid(true)
      requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
    }

    setShowSaveDialog(false)
    setPendingItemId(null)
    setPendingText('')
  }

  const handleDeleteConfirmation = (confirmed: boolean) => {
    if (confirmed && itemToDelete !== null) {
      setItems(items.filter((item) => item.id !== itemToDelete))
      toast.success('Item deleted')
      setLastDeletionTime(Date.now())
    }
    setShowDeleteDialog(false)
    setItemToDelete(null)
  }

  // Add handler for drag end
  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    setItems((items) => {
      const oldIndex = items.findIndex(item => item.id === active.id);
      const newIndex = items.findIndex(item => item.id === over.id);

      if (oldIndex === -1 || newIndex === -1) return items;

      // Get the item being moved
      const movedItem = items[oldIndex];
      // Get the target item
      const targetItem = items[newIndex];

      // Create a new array with the item moved to its new position
      const newItems = [...items];
      // Remove the item from its old position
      newItems.splice(oldIndex, 1);
      // Insert it at the new position
      newItems.splice(newIndex, 0, {
        ...movedItem,
        // Update the store if we're moving to a different store group
        store: targetItem.store
      });

      return newItems;
    });
  }

  // Filter and search todos
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (filter === 'active') return !item.completed
      if (filter === 'completed') return item.completed
      return true
    });
  }, [items, filter]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage]);

  // Ensure currentPage is within valid range when items are filtered or deleted
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  // Reset to first page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  // Avoid SSR issues
  if (!isMounted) return null

  // JSX return statement rendering the todo list UI
  return (
    <div className="w-full max-w-2xl rounded-lg border border-border p-3 shadow-lg sm:p-4">
      {/* Header with title */}
      <h1 className="mb-2 flex items-center justify-between gap-x-2 text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-200">
        Shopping List
        <div className="relative rounded-full border border-border p-1.5 sm:p-2">
          <ShoppingCart className="size-5 sm:size-6" />
          {items.length > 0 && (
            <span
              className={`absolute -right-1.5 -top-1.5 sm:-right-2 sm:-top-2 inline-flex min-w-[18px] sm:min-w-[20px] items-center justify-center rounded-full bg-orange px-1 sm:px-1.5 py-0.5 text-xs font-medium text-white ${items.length > 99 ? 'min-w-[24px] sm:min-w-[28px]' : ''
                }`}
            >
              {items.length > 99 ? '99+' : items.length}
            </span>
          )}
        </div>
      </h1>

      {/* Input form with integrated select */}
      <form
        className="mb-1 flex items-center gap-x-1"
        onSubmit={(e) => {
          e.preventDefault();
          const finalText = newItem.trim();
          if (finalText) {
            const storeName = selectedStore && selectedStore !== 'none' ? stores[selectedStore] : null;
            const storeText = storeName ? ` - (${storeName})` : '';
            addItem({ preventDefault: () => { }, currentTarget: { value: finalText + storeText } } as any);
            setNewItem('');
            newItemInputRef.current?.focus();
          }
        }}
      >
        <div className="relative flex-1 group">
          <Label htmlFor="item-input" className="sr-only">New item</Label>
          <div className="relative">
            <Input
              id="item-input"
              ref={newItemInputRef}
              type="text"
              placeholder="Add a new item"
              value={newItem}
              onChange={handleInputChange}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
              className={`text-sm h-8 w-full pl-3 pr-28 focus-visible:ring-1 focus-visible:ring-offset-0 ${!newItemValid && isInputFocused
                ? 'border-red-500/60 focus-visible:ring-red-500/60'
                : 'border-input focus-visible:ring-ring'
                }`}
            />
            <div className="absolute right-0 top-0 h-full flex items-center">
              <div className="h-4/5 w-px bg-border" />
              <Select
                onValueChange={handleSelectChange}
                value={selectedStore || 'none'}
              >
                <SelectTrigger className="h-8 w-32 border-l rounded-l-none">
                  <SelectValue placeholder="Store" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Store</SelectItem>
                  {Object.entries(stores as Record<string, string>)
                    .filter(([key]) => key !== 'none')
                    .map(([key, name]) => (
                      <SelectItem key={key} value={key}>
                        {name as string}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button
                type="submit"
                size="sm"
                className="h-8 rounded-l-none px-3"
                disabled={!newItem.trim()}
              >
                <ShoppingCart className="h-4 w-4" />
                <span className="sr-only">Add item</span>
              </Button>
            </div>
          </div>
        </div>
      </form>

      {/* Action Bar with Delete Multiple and Filter controls */}
      <div className="flex items-center justify-between gap-2">
        {/* Delete Multiple Button - Always visible when there are items */}
        {items.length > 0 && (
          <div className="flex items-center gap-2">
            {isMultiSelectMode ? (
              <div className="flex items-center gap-2 bg-muted/50 rounded-md">
                <Button
                  variant={selectedItems.size > 0 ? "destructive" : "outline"}
                  size="sm"
                  onClick={() => {
                    if (selectedItems.size > 0) {
                      setItemToDelete(null);
                      setShowDeleteDialog(true);
                    }
                  }}
                  disabled={selectedItems.size === 0}
                  className="h-8 gap-1.5"
                >
                  <Trash2Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {selectedItems.size > 0
                      ? `Delete (${selectedItems.size})`
                      : 'Delete (0)'}
                  </span>
                </Button>

                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Checkbox
                    id="select-all"
                    checked={selectedItems.size === paginatedItems.length && paginatedItems.length > 0}
                    onCheckedChange={toggleSelectAll}
                    className="h-4 w-4"
                  />
                  <Label
                    htmlFor="select-all"
                    className="text-sm font-medium leading-none cursor-pointer hover:text-foreground"
                  >
                    Select all
                  </Label>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsMultiSelectMode(false);
                    setSelectedItems(new Set());
                  }}
                  className="h-8 px-2"
                >
                  <XIcon className="h-4 w-4" />
                  <span className="sr-only">Cancel</span>
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsMultiSelectMode(true)}
                className="h-8 gap-1.5"
              >
                <Trash2 className="h-4 w-4" />
                <span className="hinline">Select Items</span>
              </Button>
            )}
          </div>
        )}

        {/* Store Settings Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowStoreSettings(true)}
          className="h-8 gap-1.5 ml-auto"
        >
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">Stores</span>
        </Button>

        {/* Store Settings Dialog */}
        <Dialog open={showStoreSettings} onOpenChange={setShowStoreSettings}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Manage Stores</DialogTitle>
              <DialogDescription>
                Add or remove stores from your shopping list.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="flex gap-2">
                <Input
                  placeholder="New store name"
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  onClick={() => {
                    if (newStoreName.trim()) {
                      const newStoreKey = newStoreName.toLowerCase().replace(/\s+/g, '-');
                      setStores(prev => ({
                        ...prev,
                        [newStoreKey]: newStoreName.trim()
                      }));
                      setNewStoreName('');
                    }
                  }}
                  disabled={!newStoreName.trim()}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>

              <div className="border rounded-md divide-y">
                {Object.entries(stores).map(([key, name]) => {
                  if (key === 'none') return null; // Skip the 'No Store' option
                  return (
                    <div key={key} className="flex items-center justify-between p-2 hover:bg-muted/50">
                      <span>{name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => {
                          setStoreToDelete(key);
                          setShowDeleteStoreDialog(true);
                        }}
                        disabled={Object.keys(stores).length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete store</span>
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setShowStoreSettings(false)}>Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Store Confirmation Dialog */}
        <Dialog open={showDeleteStoreDialog} onOpenChange={setShowDeleteStoreDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Store</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete the &quot;{storeToDelete && stores[storeToDelete]}&quot; store?
                {storeToDelete && items.some(item => item.store === storeToDelete) && (
                  <span className="mt-2 block text-amber-500">
                    Note: This store has {items.filter(item => item.store === storeToDelete).length} items that will be moved to &quot;No Store&quot;.
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteStoreDialog(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (storeToDelete) {
                    // Move items to 'none' store
                    setItems(prevItems =>
                      prevItems.map(item =>
                        item.store === storeToDelete ? { ...item, store: 'none' } : item
                      )
                    );
                    // Remove the store
                    const newStores = { ...stores };
                    delete newStores[storeToDelete];
                    setStores(newStores);
                    setShowDeleteStoreDialog(false);
                  }
                }}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {paginatedItems.length > 0 ? (
        renderItems()
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          {items.length === 0 ? "No items in the list" : "No items match your current filter"}
        </div>
      )}

      {/* Items per page selector */}
      <div className="flex items-center mt-4 w-full">
        <div className="flex items-center justify-between w-full gap-2">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  className={currentPage === 1 ? 'pointer-events-none select-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>

              {[...Array(totalPages)].map((_, index) => {
                const pageNumber = index + 1
                // Always show first page, last page, and 3 pages around current
                if (
                  pageNumber === 1 ||
                  pageNumber === totalPages ||
                  (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                ) {
                  return (
                    <PaginationItem key={pageNumber}>
                      <PaginationLink
                        onClick={() => setCurrentPage(pageNumber)}
                        isActive={currentPage === pageNumber}
                        className="cursor-pointer select-none"
                      >
                        {pageNumber}
                      </PaginationLink>
                    </PaginationItem>
                  )
                } else if (
                  // Show ellipsis only once between gaps
                  (pageNumber === 2 && currentPage > 4) ||
                  (pageNumber === totalPages - 1 && currentPage < totalPages - 3)
                ) {
                  return (
                    <PaginationItem key={pageNumber}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )
                }
                return null
              })}

              <PaginationItem>
                <PaginationNext
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  className={
                    currentPage === totalPages ? 'pointer-events-none select-none opacity-50' : 'cursor-pointer'
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>

      </div>

      <Dialog open={showSaveDialog} onOpenChange={(open) => {
        if (!open) handleDialogClose(false)
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unsaved Changes</DialogTitle>
            <DialogDescription>
              You have unsaved changes. Would you like to save them?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleDialogClose(false)}
            >
              Discard
            </Button>
            <Button
              variant="default"
              onClick={() => handleDialogClose(true)}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={(open) => {
        if (!open) handleDeleteConfirmation(false)
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              {itemToDelete !== null
                ? "Are you sure you want to delete this item?"
                : `Are you sure you want to delete ${selectedItems.size} selected items?`}
              {" "}This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleDeleteConfirmation(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (itemToDelete !== null) {
                  handleDeleteConfirmation(true)
                } else {
                  deleteSelectedItems()
                  setShowDeleteDialog(false)
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
} 
