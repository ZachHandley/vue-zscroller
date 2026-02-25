import { computed, ref, watch, type Ref, type ComputedRef } from 'vue'
import { useDebounceFn, useThrottleFn } from '@vueuse/core'
import type { VirtualScrollerItem } from '../types'

export interface AsyncItemState<T = any> {
  item: VirtualScrollerItem<T> | null | undefined
  isLoading: boolean
  hasError: boolean
  error: Error | null
}

export interface UseAsyncItemsOptions {
  items?: VirtualScrollerItem[]
  debounceTime?: number
  throttleTime?: number
  enableAsync?: boolean
}

export interface UseAsyncItemsReturn {
  itemsWithState: ComputedRef<Array<VirtualScrollerItem | null | undefined>>
  loadingStates: Ref<Map<string | number, AsyncItemState>>
  isLoading: ComputedRef<boolean>
  hasErrors: ComputedRef<boolean>
  isItemValid: (item: VirtualScrollerItem | null | undefined) => boolean
  getItemKey: (item: VirtualScrollerItem | null | undefined, fallback?: string | number) => string | number
  getItemIndex: (item: VirtualScrollerItem | null | undefined, items: VirtualScrollerItem[]) => number
  setItemLoading: (key: string | number, isLoading: boolean) => void
  setItemError: (key: string | number, error: Error) => void
  setItemLoaded: (key: string | number, item: VirtualScrollerItem) => void
  refreshItems: () => void
  resetAllStates: () => void
}

/**
 * Composable for handling async item loading with proper error states
 */
export function useAsyncItems(
  itemsRef: Ref<VirtualScrollerItem[]>,
  options: UseAsyncItemsOptions = {}
): UseAsyncItemsReturn {
  const {
    debounceTime = 150,
    throttleTime = 16,
    enableAsync = true
  } = options

  const loadingStates = ref<Map<string | number, AsyncItemState>>(new Map())
  const internalItems = ref<VirtualScrollerItem[]>([])

  // Update internal items when source changes
  watch(() => itemsRef.value, (newItems) => {
    const normalizedItems = Array.isArray(newItems) ? newItems : []
    internalItems.value = normalizedItems

    // Initialize loading states for new items
    if (enableAsync) {
      normalizedItems.forEach((item, index) => {
        if (item) {
          const key = getItemKeyInternal(item, index)
          if (!loadingStates.value.has(key)) {
            loadingStates.value.set(key, {
              item,
              isLoading: false,
              hasError: false,
              error: null
            })
          }
        }
      })

      // Clean up states for removed items
      const currentKeys = new Set(normalizedItems.map((item, index) => item ? getItemKeyInternal(item, index) : 'undefined'))
      const keysToDelete: Array<string | number> = []

      loadingStates.value.forEach((_, key) => {
        if (!currentKeys.has(key)) {
          keysToDelete.push(key)
        }
      })

      keysToDelete.forEach(key => {
        loadingStates.value.delete(key)
      })
    }
  }, { deep: true, immediate: true })

  // Check if any items are loading
  const isLoading = computed(() => {
    if (!enableAsync) return false
    return Array.from(loadingStates.value.values()).some(state => state.isLoading)
  })

  // Check if any items have errors
  const hasErrors = computed(() => {
    if (!enableAsync) return false
    return Array.from(loadingStates.value.values()).some(state => state.hasError)
  })

  // Computed items with their states
  const itemsWithState = computed(() => {
    return internalItems.value.map((item, index) => {
      if (!item) return null
      if (enableAsync) {
        const key = getItemKeyInternal(item, index)
        const state = loadingStates.value.get(key)
        return state?.item ?? null
      }
      return item
    })
  })

  // Validation utilities
  const isItemValid = (item: VirtualScrollerItem | null | undefined): boolean => {
    if (!item) return false
    return typeof item === 'object' && item !== null && !Array.isArray(item)
  }

  let keyCounter = 0

  const getItemKeyInternal = (item: VirtualScrollerItem, index?: number): string | number => {
    if (!item) return 'undefined-item'
    return item.id || item.key || `item-${index ?? keyCounter++}`
  }

  const getItemKey = (item: VirtualScrollerItem | null | undefined, fallback: string | number = 'undefined-item'): string | number => {
    if (!item) return fallback
    return item.id || item.key || fallback
  }

  const getItemIndex = (item: VirtualScrollerItem | null | undefined, items: VirtualScrollerItem[]): number => {
    if (!item) return -1
    const key = getItemKeyInternal(item)
    return items.findIndex((i, idx) => i && getItemKeyInternal(i, idx) === key)
  }

  // State management methods
  const setItemLoading = (key: string | number, isLoading: boolean) => {
    if (!enableAsync) return

    const state = loadingStates.value.get(key)
    if (state) {
      state.isLoading = isLoading
      state.hasError = false
      state.error = null
    }
  }

  const setItemError = (key: string | number, error: Error) => {
    if (!enableAsync) return

    const state = loadingStates.value.get(key)
    if (state) {
      state.isLoading = false
      state.hasError = true
      state.error = error
    }
  }

  const setItemLoaded = (key: string | number, item: VirtualScrollerItem) => {
    if (!enableAsync) return

    const state = loadingStates.value.get(key)
    if (state) {
      state.item = item
      state.isLoading = false
      state.hasError = false
      state.error = null
    }
  }

  // Debounced refresh for performance
  const refreshItems = useDebounceFn(() => {
    // Force reactivity update
    internalItems.value = [...internalItems.value]
  }, debounceTime)

  // Throttled reset for performance
  const resetAllStates = useThrottleFn(() => {
    loadingStates.value.clear()
    internalItems.value = internalItems.value.map((item, index) => {
      if (item) {
        const key = getItemKeyInternal(item, index)
        loadingStates.value.set(key, {
          item,
          isLoading: false,
          hasError: false,
          error: null
        })
      }
      return item
    })
  }, throttleTime)

  return {
    itemsWithState,
    loadingStates,
    isLoading,
    hasErrors,
    isItemValid,
    getItemKey,
    getItemIndex,
    setItemLoading,
    setItemError,
    setItemLoaded,
    refreshItems,
    resetAllStates
  }
}

/**
 * Utility composable for basic item validation without async features
 */
export function useItemValidation() {
  const isItemValid = (item: VirtualScrollerItem | null | undefined): boolean => {
    if (!item) return false
    return typeof item === 'object' && item !== null && !Array.isArray(item)
  }

  const getItemKey = (item: VirtualScrollerItem | null | undefined, fallback: string | number = 'undefined-item'): string | number => {
    if (!item) return fallback
    return item.id || item.key || fallback
  }

  const getItemIndex = (item: VirtualScrollerItem | null | undefined, items: VirtualScrollerItem[]): number => {
    if (!item) return -1
    const key = getItemKey(item)
    return items.findIndex(i => i && getItemKey(i) === key)
  }

  const ensureItemArray = (items: VirtualScrollerItem[]): VirtualScrollerItem[] => {
    return Array.isArray(items) ? items : []
  }

  const filterValidItems = (items: VirtualScrollerItem[]): VirtualScrollerItem[] => {
    return ensureItemArray(items).filter(isItemValid)
  }

  return {
    isItemValid,
    getItemKey,
    getItemIndex,
    ensureItemArray,
    filterValidItems
  }
}
