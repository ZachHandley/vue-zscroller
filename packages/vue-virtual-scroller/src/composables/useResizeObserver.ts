import { ref, watch, onMounted, onUnmounted, nextTick, type Ref } from 'vue'

export interface UseResizeObserverOptions {
  disabled?: boolean
  throttleMs?: number
  box?: 'content-box' | 'border-box'
}

export interface UseResizeObserverReturn {
  elementSize: Ref<{ width: number; height: number }>
  observe: (element: Element | null) => void
  unobserve: (element: Element | null) => void
  disconnect: () => void
}

export function useResizeObserver(
  target?: Ref<Element | null | undefined>,
  options: UseResizeObserverOptions = {}
): UseResizeObserverReturn {
  const {
    disabled = false,
    throttleMs = 100,
    box = 'content-box'
  } = options

  const elementSize = ref({ width: 0, height: 0 })
  let observer: ResizeObserver | null = null
  let currentElement: Element | null = null
  let throttleTimer: number | null = null

  const updateSize = (entry: ResizeObserverEntry) => {
    const { contentRect, borderBoxSize, contentBoxSize } = entry

    let newWidth = 0
    let newHeight = 0

    if (box === 'border-box' && borderBoxSize) {
      // Use border box size if available
      if (Array.isArray(borderBoxSize)) {
        newWidth = borderBoxSize[0]?.inlineSize || 0
        newHeight = borderBoxSize[0]?.blockSize || 0
      } else {
        newWidth = (borderBoxSize as any).inlineSize || 0
        newHeight = (borderBoxSize as any).blockSize || 0
      }
    } else if (box === 'content-box' && contentBoxSize) {
      // Use content box size if available
      if (Array.isArray(contentBoxSize)) {
        newWidth = contentBoxSize[0]?.inlineSize || 0
        newHeight = contentBoxSize[0]?.blockSize || 0
      } else {
        newWidth = (contentBoxSize as any).inlineSize || 0
        newHeight = (contentBoxSize as any).blockSize || 0
      }
    } else {
      // Fallback to contentRect
      newWidth = contentRect.width
      newHeight = contentRect.height
    }

    // Throttle updates
    if (throttleTimer) {
      clearTimeout(throttleTimer)
    }

    throttleTimer = window.setTimeout(() => {
      if (!disabled) {
        elementSize.value = { width: newWidth, height: newHeight }
      }
      throttleTimer = null
    }, throttleMs)
  }

  const observe = (element: Element) => {
    if (disabled || !element) return

    unobserve(currentElement)
    currentElement = element

    if (typeof ResizeObserver !== 'undefined') {
      if (!observer) {
        observer = new ResizeObserver((entries) => {
          for (const entry of entries) {
            updateSize(entry)
          }
        })
      }

      observer.observe(element, { box })
    } else {
      // Fallback for browsers without ResizeObserver
      const checkSize = () => {
        if (currentElement) {
          const rect = currentElement.getBoundingClientRect()
          if (elementSize.value.width !== rect.width || elementSize.value.height !== rect.height) {
            if (!disabled) {
              elementSize.value = { width: rect.width, height: rect.height }
            }
          }
          requestAnimationFrame(checkSize)
        }
      }

      nextTick(() => {
        requestAnimationFrame(checkSize)
      })
    }
  }

  const unobserve = (element: Element | null) => {
    if (!element || !observer) return

    observer.unobserve(element)
    if (element === currentElement) {
      currentElement = null
    }
  }

  const disconnect = () => {
    if (observer) {
      observer.disconnect()
      observer = null
    }
    currentElement = null
    if (throttleTimer) {
      clearTimeout(throttleTimer)
      throttleTimer = null
    }
  }

  // Handle reactive target
  if (target) {
    onMounted(() => {
      if (target.value) {
        observe(target.value)
      }

      // Watch for changes to the ref
      const checkTarget = () => {
        if (target.value !== currentElement) {
          if (target.value) {
            observe(target.value)
          }
        }
      }

      // Simple polling for ref changes
      const interval = setInterval(checkTarget, 100)

      onUnmounted(() => {
        clearInterval(interval)
        disconnect()
      })
    })
  }

  onUnmounted(() => {
    disconnect()
  })

  return {
    elementSize,
    observe: observe as (element: Element | null) => void,
    unobserve,
    disconnect
  }
}