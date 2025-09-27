import { ref, onMounted, onUnmounted, nextTick, type Ref } from 'vue'
import { useDebounceFn, useThrottleFn } from './useDebounceFn'
import { useRafFn } from './useRafFn'
import type { UseVirtualScrollPerformanceOptions, UseVirtualScrollPerformanceReturn } from '../types/composables'

declare global {
  interface Window {
    process?: any
  }
  var process: any
}

export function useVirtualScrollPerformance(
  options: UseVirtualScrollPerformanceOptions = {}
): UseVirtualScrollPerformanceReturn {
  const {
    enableIntersectionObserver = true,
    enableResizeObserver = true,
    enableRequestIdleCallback = true,
    enableScrollDebounce = true,
    scrollDebounceMs = 16,
    resizeObserverThrottleMs = 100
  } = options

  // Performance state
  const isScrolling = ref(false)
  const lastScrollTime = ref(0)
  const rafId = ref<number | null>(null)
  const idleCallbackId = ref<number | null>(null)
  const scrollDirection = ref<'up' | 'down' | 'left' | 'right' | null>(null)
  const scrollVelocity = ref(0)
  const lastScrollPosition = ref({ x: 0, y: 0 })

  // Performance metrics
  const metrics = ref({
    scrollEvents: 0,
    resizeEvents: 0,
    rafCallbacks: 0,
    idleCallbacks: 0,
    averageRenderTime: 0,
    maxRenderTime: 0,
    lastUpdateTime: 0
  })

  // Throttled scroll handler using @vueuse/core
  const handleScrollThrottled = useThrottleFn((event: Event) => {
    if (!enableScrollDebounce) return

    const now = performance.now()
    const target = event.target as HTMLElement
    const currentX = target.scrollLeft
    const currentY = target.scrollTop

    // Calculate scroll velocity and direction
    const deltaTime = now - lastScrollTime.value
    const deltaX = currentX - lastScrollPosition.value.x
    const deltaY = currentY - lastScrollPosition.value.y

    if (deltaTime > 0) {
      const velocityX = Math.abs(deltaX) / deltaTime
      const velocityY = Math.abs(deltaY) / deltaTime
      scrollVelocity.value = Math.max(velocityX, velocityY)

      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        scrollDirection.value = deltaX > 0 ? 'right' : 'left'
      } else {
        scrollDirection.value = deltaY > 0 ? 'down' : 'up'
      }
    }

    lastScrollPosition.value = { x: currentX, y: currentY }
    lastScrollTime.value = now
    isScrolling.value = true

    // Update metrics
    metrics.value.scrollEvents++
    metrics.value.lastUpdateTime = now

    // Auto-reset scrolling state
    clearTimeout(rafId.value as number)
    rafId.value = window.setTimeout(() => {
      isScrolling.value = false
      scrollDirection.value = null
      scrollVelocity.value = 0
    }, 150)
  }, { ms: scrollDebounceMs })

  // RAF-based update scheduler
  const scheduleRafUpdate = (callback: () => void) => {
    if (rafId.value) {
      cancelAnimationFrame(rafId.value)
    }

    rafId.value = requestAnimationFrame(() => {
      const startTime = performance.now()
      callback()
      const endTime = performance.now()
      const renderTime = endTime - startTime

      // Update performance metrics
      metrics.value.rafCallbacks++
      metrics.value.averageRenderTime = (metrics.value.averageRenderTime * 0.9) + (renderTime * 0.1)
      metrics.value.maxRenderTime = Math.max(metrics.value.maxRenderTime, renderTime)
      metrics.value.lastUpdateTime = endTime

      rafId.value = null
    })
  }

  // Idle callback for non-critical updates
  const scheduleIdleUpdate = (callback: () => void) => {
    if (!enableRequestIdleCallback || !('requestIdleCallback' in window)) {
      // Fallback to setTimeout with delay
      idleCallbackId.value = window.setTimeout(callback, 100) as unknown as number
      return
    }

    idleCallbackId.value = requestIdleCallback((deadline) => {
      if (deadline.timeRemaining() > 0) {
        callback()
        metrics.value.idleCallbacks++
      } else {
        // Not enough time, schedule again
        scheduleIdleUpdate(callback)
      }
    })
  }

  // Priority-based update scheduler
  const scheduleUpdate = (callback: () => void, priority: 'high' | 'low' = 'high') => {
    if (priority === 'high') {
      scheduleRafUpdate(callback)
    } else {
      scheduleIdleUpdate(callback)
    }
  }

  // Optimized resize handler
  const handleResizeOptimized = useDebounceFn((event: Event) => {
    metrics.value.resizeEvents++
    metrics.value.lastUpdateTime = performance.now()
  }, { ms: resizeObserverThrottleMs })

  // Cancel all pending operations
  const cancelOperations = () => {
    if (rafId.value) {
      cancelAnimationFrame(rafId.value)
      rafId.value = null
    }

    if (idleCallbackId.value) {
      if ('cancelIdleCallback' in window) {
        cancelIdleCallback(idleCallbackId.value)
      } else {
        clearTimeout(idleCallbackId.value)
      }
      idleCallbackId.value = null
    }

    isScrolling.value = false
  }

  // Performance monitoring
  const getPerformanceStats = () => {
    return {
      ...metrics.value,
      isScrolling: isScrolling.value,
      scrollDirection: scrollDirection.value,
      scrollVelocity: scrollVelocity.value,
      lastScrollTime: lastScrollTime.value,
      memoryUsage: (typeof process !== 'undefined' && process.memoryUsage) ? process.memoryUsage().heapUsed : 'unknown'
    }
  }

  // Reset performance metrics
  const resetMetrics = () => {
    metrics.value = {
      scrollEvents: 0,
      resizeEvents: 0,
      rafCallbacks: 0,
      idleCallbacks: 0,
      averageRenderTime: 0,
      maxRenderTime: 0,
      lastUpdateTime: 0
    }
    scrollVelocity.value = 0
    scrollDirection.value = null
  }

  // Cleanup on unmount
  onUnmounted(() => {
    cancelOperations()
  })

  return {
    isScrolling,
    lastScrollTime,
    rafId,
    idleCallbackId,
    cancelScroll: cancelOperations,
    scheduleUpdate,
    handleScroll: handleScrollThrottled,
    handleResize: handleResizeOptimized,
    getPerformanceStats,
    resetMetrics,
    scrollDirection,
    scrollVelocity
  }
}