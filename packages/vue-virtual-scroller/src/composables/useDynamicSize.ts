import type { Ref } from 'vue'
import type { UseDynamicSizeReturn } from '../types/composables'
import { ref } from 'vue'
import { useSSRSafe } from './useSSRSafe'

export interface SharedResizeObserverLike {
  observe: (el: Element, callback: (entry: ResizeObserverEntry) => void) => void
  unobserve: (el: Element) => void
}

export interface UseDynamicSizeOptions {
  minItemSize: number
  direction?: 'vertical' | 'horizontal'
  sharedObserver?: SharedResizeObserverLike | null
  onSizeChange?: (size: number) => void
}

export function useDynamicSize(
  options: UseDynamicSizeOptions,
): UseDynamicSizeReturn {
  const {
    minItemSize,
    direction = 'vertical',
    sharedObserver = null,
    onSizeChange,
  } = options

  const { isClient } = useSSRSafe()

  // State
  const element = ref<HTMLElement | null>(null)
  const currentSize = ref(minItemSize)

  const hasSizeChanged = (oldSize: number, newSize: number): boolean => {
    return Math.abs(oldSize - newSize) > 0.5
  }

  const measureSize = (): number => {
    if (!element.value || !isClient.value) {
      return minItemSize
    }
    const rect = element.value.getBoundingClientRect()
    const size = direction === 'horizontal' ? rect.width : rect.height
    return Math.max(size, minItemSize)
  }

  const measureAndUpdate = () => {
    if (!isClient.value)
      return
    const newSize = measureSize()
    if (hasSizeChanged(currentSize.value, newSize)) {
      currentSize.value = newSize
      onSizeChange?.(newSize)
    }
  }

  const handleResizeEntry = (entry: ResizeObserverEntry) => {
    // Discard stale callbacks from recycled views — the DOM node may have been
    // reassigned to a different item but the old callback is still in the map.
    if (entry.target !== element.value) return

    // Use borderBoxSize when available — it includes padding and border,
    // matching getBoundingClientRect() used in measureSize(). Using contentRect
    // would exclude padding/borders and cause measurement oscillation.
    let size: number
    if (entry.borderBoxSize?.length) {
      const box = entry.borderBoxSize[0]!
      size = direction === 'horizontal' ? box.inlineSize : box.blockSize
    }
    else {
      size = direction === 'horizontal'
        ? entry.contentRect.width
        : entry.contentRect.height
    }
    const resolvedSize = Math.max(size, minItemSize)
    if (hasSizeChanged(currentSize.value, resolvedSize)) {
      currentSize.value = resolvedSize
      onSizeChange?.(resolvedSize)
    }
  }

  const setElement = (el: HTMLElement | null) => {
    // Unobserve old element
    if (element.value && sharedObserver) {
      sharedObserver.unobserve(element.value)
    }
    element.value = el
    // Observe new element
    if (el && sharedObserver) {
      sharedObserver.observe(el, handleResizeEntry)
    }
  }

  // Allow callers to sync currentSize after an external measurement,
  // preventing the SharedResizeObserver from re-reporting the same value.
  const setCurrentSize = (size: number) => {
    currentSize.value = size
  }

  const pauseObserver = () => {
    if (element.value && sharedObserver) {
      sharedObserver.unobserve(element.value)
    }
  }

  const resumeObserver = () => {
    if (element.value && sharedObserver) {
      sharedObserver.observe(element.value, handleResizeEntry)
    }
  }

  return {
    itemSize: currentSize as Ref<number>,
    measureSize,
    updateSize: measureAndUpdate,
    hasSizeChanged,
    setElement,
    setCurrentSize,
    pauseObserver,
    resumeObserver,
  }
}
