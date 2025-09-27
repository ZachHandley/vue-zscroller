import { ref, onMounted, onUnmounted, nextTick, type Ref, type UnwrapRef } from 'vue'
import type { UseSlotRefManagerOptions, UseSlotRefManagerReturn } from '../types/composables'

declare global {
  interface Window {
    process?: any
  }
  var process: any
}

export function useSlotRefManager<T extends HTMLElement = HTMLElement>(
  options: UseSlotRefManagerOptions = {}
): UseSlotRefManagerReturn<T> {
  const {
    enableWeakMap = true,
    cleanupDelay = 100,
    maxSize = 1000
  } = options

  // Use WeakMap for automatic memory cleanup when available
  const weakRefMap = enableWeakMap ? new WeakMap<object, T>() : null
  const refMap = ref<Map<string | number, T>>(new Map()) as Ref<Map<string | number, T>>
  const slotKeys = ref<Set<string | number>>(new Set())
  const activeSlots = ref<Set<string | number>>(new Set())

  // Track slot lifecycle
  const slotLifecycle = ref<Map<string | number, { mounted: number; updated: number }>>(new Map())

  // Register a slot ref
  const registerSlotRef = (key: string | number, element: T | null, slotContext?: object) => {
    if (element) {
      // Use WeakMap if available and slotContext is provided
      if (enableWeakMap && slotContext && weakRefMap) {
        weakRefMap.set(slotContext, element)
      }

      // Also keep in regular Map for key-based access
      refMap.value.set(key, element)
      slotKeys.value.add(key)
      activeSlots.value.add(key)

      // Update lifecycle tracking
      const now = Date.now()
      const existing = slotLifecycle.value.get(key)
      if (existing) {
        existing.updated = now
      } else {
        slotLifecycle.value.set(key, { mounted: now, updated: now })
      }

      // Cleanup old slots if we exceed max size
      if (refMap.value.size > maxSize) {
        cleanupOldSlots()
      }
    } else {
      // Slot was unmounted
      refMap.value.delete(key)
      activeSlots.value.delete(key)

      // Note: WeakMap entries are automatically cleaned up when slotContext is garbage collected
    }
  }

  // Get a slot ref by key
  const getSlotRef = (key: string | number): T | undefined => {
    return refMap.value.get(key) as T | undefined
  }

  // Get a slot ref by context (WeakMap lookup)
  const getSlotRefByContext = (slotContext: object): T | undefined => {
    return weakRefMap?.get(slotContext)
  }

  // Check if a slot is active (mounted and visible)
  const isSlotActive = (key: string | number): boolean => {
    return activeSlots.value.has(key)
  }

  // Get all active slot keys
  const getActiveSlotKeys = (): Array<string | number> => {
    return Array.from(activeSlots.value)
  }

  // Get all slot refs
  const getAllSlotRefs = (): Array<T> => {
    return Array.from(refMap.value.values()) as Array<T>
  }

  // Clean up old slots (LRU-style cleanup)
  const cleanupOldSlots = () => {
    if (refMap.value.size <= maxSize) return

    const entries = Array.from(slotLifecycle.value.entries())
    // Sort by last updated time (oldest first)
    entries.sort((a, b) => a[1].updated - b[1].updated)

    // Remove oldest slots until we're under the limit
    const toRemove = entries.slice(0, entries.length - maxSize)
    toRemove.forEach(([key]) => {
      refMap.value.delete(key)
      activeSlots.value.delete(key)
      slotLifecycle.value.delete(key)
      slotKeys.value.delete(key)
    })
  }

  // Force cleanup of all slots
  const cleanupAllSlots = () => {
    refMap.value.clear()
    activeSlots.value.clear()
    slotLifecycle.value.clear()
    slotKeys.value.clear()
  }

  // Batch register multiple slot refs
  const batchRegisterSlots = (slots: Array<{ key: string | number; element: T | null; slotContext?: object }>) => {
    slots.forEach(({ key, element, slotContext }) => {
      registerSlotRef(key, element, slotContext)
    })
  }

  // Get slot statistics
  const getSlotStats = () => {
    return {
      totalSlots: refMap.value.size,
      activeSlots: activeSlots.value.size,
      weakMapEntries: weakRefMap ? 'enabled' : 'disabled',
      maxSize,
      memoryUsage: (typeof process !== 'undefined' && process.memoryUsage) ? process.memoryUsage().heapUsed : 'unknown'
    }
  }

  // Setup cleanup on unmount
  onUnmounted(() => {
    // Delayed cleanup to allow for any async operations
    setTimeout(() => {
      cleanupAllSlots()
    }, cleanupDelay)
  })

  return {
    registerSlotRef,
    getSlotRef,
    getSlotRefByContext,
    isSlotActive,
    getActiveSlotKeys,
    getAllSlotRefs,
    batchRegisterSlots,
    cleanupOldSlots,
    cleanupAllSlots,
    getSlotStats,
    slotKeys,
    activeSlots
  }
}