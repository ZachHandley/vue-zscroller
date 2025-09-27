import { ref, onMounted, onUnmounted, nextTick, type Ref } from 'vue'

export interface UseElementSizeOptions {
  width?: number
  height?: number
  box?: 'content-box' | 'border-box'
}

export interface UseElementSizeReturn {
  width: Ref<number>
  height: Ref<number>
  stop: () => void
}

export function useElementSize(
  target: Ref<Element | null | undefined> | Element | null | undefined,
  options: UseElementSizeOptions = {}
): UseElementSizeReturn {
  const {
    width = 0,
    height = 0,
    box = 'content-box'
  } = options

  const widthRef = ref(width)
  const heightRef = ref(height)

  let observer: ResizeObserver | null = null
  let targetElement: Element | null = null

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

    // Only update if values changed to avoid unnecessary re-renders
    if (widthRef.value !== newWidth) {
      widthRef.value = newWidth
    }
    if (heightRef.value !== newHeight) {
      heightRef.value = newHeight
    }
  }

  const cleanup = () => {
    if (observer) {
      observer.disconnect()
      observer = null
    }
    targetElement = null
  }

  const stop = () => {
    cleanup()
  }

  const observeElement = (element: Element | null | undefined) => {
    cleanup()

    if (!element) return

    targetElement = element

    // Create ResizeObserver
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          updateSize(entry)
        }
      })

      observer.observe(element, { box })
    } else {
      // Fallback for browsers without ResizeObserver
      // Use requestAnimationFrame to periodically check size
      const checkSize = () => {
        if (targetElement) {
          const rect = targetElement.getBoundingClientRect()
          if (widthRef.value !== rect.width || heightRef.value !== rect.height) {
            widthRef.value = rect.width
            heightRef.value = rect.height
          }
          requestAnimationFrame(checkSize)
        }
      }

      nextTick(() => {
        requestAnimationFrame(checkSize)
      })
    }
  }

  // Handle reactive target
  if (typeof target === 'function' && 'value' in target) {
    // It's a ref
    const unwatch = () => {
      // We'll handle this manually in onMounted/onUnmounted
    }

    onMounted(() => {
      observeElement((target as any).value)

      // Watch for changes to the ref
      const checkTarget = () => {
        if ((target as any).value !== targetElement) {
          observeElement((target as any).value)
        }
      }

      // Simple polling for ref changes
      const interval = setInterval(checkTarget, 100)

      onUnmounted(() => {
        clearInterval(interval)
        cleanup()
      })
    })
  } else {
    // It's a direct element
    onMounted(() => {
      observeElement(target as Element | null)
    })
  }

  onUnmounted(() => {
    cleanup()
  })

  return {
    width: widthRef,
    height: heightRef,
    stop
  }
}