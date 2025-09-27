import { ref, computed, onMounted, onUnmounted, nextTick, type Ref } from 'vue'
import { useSSRSafe } from './useSSRSafe'
import { useSSRSafeEnhanced } from './useSSRSafeEnhanced'
import { useResizeObserver } from './useResizeObserver'
import { useIntersectionObserver } from './useIntersectionObserver'
import { useDebounceFn, useThrottleFn } from './useDebounceFn'
import { useScroll } from './useScroll'
import { useElementSize } from './useElementSize'
import type {
  UseVirtualScrollCoreOptions,
  UseVirtualScrollCoreReturn,
  VirtualScrollerItem,
  ScrollPosition
} from '../types/composables'

export function useVirtualScrollCore(
  options: UseVirtualScrollCoreOptions
): UseVirtualScrollCoreReturn {
  const {
    items,
    itemSize,
    minItemSize,
    direction,
    buffer,
    keyField,
    sizeField,
    typeField,
    pageMode,
    prerender,
    gridItems,
    itemSecondarySize,
    disableTransform
  } = options

  const { isClient, onClientSide } = useSSRSafe()
  const { useSSRSafeRaf } = useSSRSafeEnhanced()
  const { requestRaf, cancelRaf } = useSSRSafeRaf()

  // State
  const scrollElement = ref<HTMLElement | null>(null)
  const isScrolling = ref(false)
  const startIndex = ref(0)
  const endIndex = ref(0)

  // Use @vueuse/core's useElementSize for container size tracking
  const { width: containerWidth, height: containerHeight } = useElementSize(scrollElement, {
    width: 0,
    height: 0
  })

  const containerSize = ref({
    width: containerWidth.value,
    height: containerHeight.value
  })

  // Use @vueuse/core's useScroll for enhanced scroll handling
  const {
    arrivedState,
    isScrolling: vueUseIsScrolling,
    scrollDirection,
    x,
    y
  } = useScroll(scrollElement, {
    behavior: 'auto',
    onScroll: () => {
      updateVisibleItems()
    }
  })

  // Computed values
  const totalSize = computed(() => {
    if (itemSize.value !== null) {
      return itemSize.value * items.value.length
    }

    return items.value.reduce((total, item) => {
      return total + (item[sizeField.value] || minItemSize.value)
    }, 0)
  })

  const visibleItemCount = computed(() => {
    const size = direction.value === 'vertical'
      ? containerSize.value.height
      : containerSize.value.width

    if (itemSize.value !== null) {
      return Math.ceil(size / itemSize.value) + 2
    }

    return Math.ceil(size / minItemSize.value) + 2
  })

  const bufferItems = computed(() => {
    const bufferSize = buffer.value
    const itemAvgSize = itemSize.value || minItemSize.value
    return Math.ceil(bufferSize / itemAvgSize)
  })

  // Performance tracking
  let scrollTimeout: number | null = null
  let lastScrollTime = 0
  let rafId: number | null = null

  // Computed scroll position
  const scrollPosition = computed(() => ({
    top: y.value,
    left: x.value
  }))

  // Core methods
  const updateVisibleItems = useThrottleFn(() => {
    if (!isClient.value || !scrollElement.value) return

    const scrollKey = direction.value === 'vertical' ? y.value : x.value

    if (itemSize.value !== null) {
      // Fixed size mode
      const itemStart = Math.floor(scrollKey / itemSize.value)
      const itemEnd = itemStart + visibleItemCount.value + bufferItems.value

      startIndex.value = Math.max(0, itemStart - bufferItems.value)
      endIndex.value = Math.min(items.value.length - 1, itemEnd)
    } else {
      // Variable size mode
      let currentSize = 0
      let newStartIndex = 0
      let newEndIndex = 0

      for (let i = 0; i < items.value.length; i++) {
        const itemSize = items.value[i][sizeField.value] || minItemSize.value

        if (currentSize <= scrollKey - buffer.value) {
          newStartIndex = i
        }

        if (currentSize <= scrollKey + containerSize.value.height + buffer.value) {
          newEndIndex = i
        } else {
          break
        }

        currentSize += itemSize
      }

      startIndex.value = newStartIndex
      endIndex.value = newEndIndex
    }

    // Update scrolling state
    isScrolling.value = true
    lastScrollTime = Date.now()

    // Trigger scroll end detection
    clearTimeout(scrollTimeout as number)
    scrollTimeout = window.setTimeout(() => {
      isScrolling.value = false
    }, 150)
  }, { ms: 16 }) // 60fps

  const handleScroll = useThrottleFn((event: Event) => {
    if (!isClient.value) return

    isScrolling.value = true
    lastScrollTime = Date.now()

    if (rafId) {
      cancelRaf(rafId)
    }

    rafId = requestRaf(() => {
      updateVisibleItems()
      rafId = null
    })
  }, { ms: 16 })

  const handleResize = (size: { width: number; height: number }) => {
    containerSize.value = size
    nextTick(() => {
      updateVisibleItems()
    })
  }

  const scrollToItem = (index: number, alignment: 'start' | 'center' | 'end' | 'auto' = 'auto') => {
    if (!isClient.value || !scrollElement.value || index < 0 || index >= items.value.length) return

    let scrollPosition = 0

    if (itemSize.value !== null) {
      scrollPosition = index * itemSize.value
    } else {
      for (let i = 0; i < index; i++) {
        scrollPosition += items.value[i][sizeField.value] || minItemSize.value
      }
    }

    if (direction.value === 'vertical') {
      const containerHeight = containerSize.value.height

      switch (alignment) {
        case 'center':
          scrollPosition -= containerHeight / 2
          break
        case 'end':
          scrollPosition -= containerHeight
          break
      }
    } else {
      const containerWidth = containerSize.value.width

      switch (alignment) {
        case 'center':
          scrollPosition -= containerWidth / 2
          break
        case 'end':
          scrollPosition -= containerWidth
          break
      }
    }

    scrollPosition = Math.max(0, scrollPosition)

    if (direction.value === 'vertical') {
      scrollElement.value.scrollTop = scrollPosition
    } else {
      scrollElement.value.scrollLeft = scrollPosition
    }
  }

  const scrollToPosition = (position: number) => {
    if (!isClient.value || !scrollElement.value) return

    const clampedPosition = Math.max(0, Math.min(position, totalSize.value - containerSize.value.height))

    if (direction.value === 'vertical') {
      scrollElement.value.scrollTop = clampedPosition
    } else {
      scrollElement.value.scrollLeft = clampedPosition
    }
  }

  const reset = () => {
    startIndex.value = 0
    endIndex.value = 0
    isScrolling.value = false
  }

  // Setup
  onClientSide(() => {
    nextTick(() => {
      if (scrollElement.value) {
        // Initial visible items calculation
        updateVisibleItems()
      }
    })
  })

  onUnmounted(() => {
    if (scrollTimeout) {
      clearTimeout(scrollTimeout)
    }
    if (rafId) {
      cancelRaf(rafId)
    }
  })

  return {
    totalSize,
    visibleItems: computed(() => items.value.slice(startIndex.value, endIndex.value + 1)),
    startIndex,
    endIndex,
    scrollPosition,
    isScrolling,
    isClientSide: isClient,
    containerSize,
    updateVisibleItems,
    handleScroll,
    handleResize,
    scrollToItem,
    scrollToPosition,
    reset
  }
}