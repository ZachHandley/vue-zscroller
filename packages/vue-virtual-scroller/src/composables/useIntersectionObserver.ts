import { ref, onMounted, onUnmounted, nextTick, type Ref } from 'vue'

export interface UseIntersectionObserverOptions {
  root?: Element | null
  rootMargin?: string
  threshold?: number | number[]
  disabled?: boolean
}

export interface UseIntersectionObserverReturn {
  isVisible: Ref<boolean>
  intersectionRatio: Ref<number>
  observe: (element: Element | null) => void
  unobserve: (element: Element | null) => void
  disconnect: () => void
}

export function useIntersectionObserver(
  target?: Ref<Element | null | undefined>,
  options: UseIntersectionObserverOptions = {}
): UseIntersectionObserverReturn {
  const {
    root = null,
    rootMargin = '0px',
    threshold = 0,
    disabled = false
  } = options

  const isVisible = ref(false)
  const intersectionRatio = ref(0)
  let observer: IntersectionObserver | null = null
  let currentElement: Element | null = null

  const handleIntersection = (entries: IntersectionObserverEntry[]) => {
    for (const entry of entries) {
      if (!disabled) {
        isVisible.value = entry.isIntersecting
        intersectionRatio.value = entry.intersectionRatio
      }
    }
  }

  const observe = (element: Element) => {
    if (disabled || !element) return

    unobserve(currentElement)
    currentElement = element

    if (typeof IntersectionObserver !== 'undefined') {
      if (!observer) {
        observer = new IntersectionObserver(handleIntersection, {
          root,
          rootMargin,
          threshold
        })
      }

      observer.observe(element)
    } else {
      // Fallback for browsers without IntersectionObserver
      // Simple visibility check based on viewport
      const checkVisibility = () => {
        if (currentElement) {
          const rect = currentElement.getBoundingClientRect()
          const windowHeight = window.innerHeight || document.documentElement.clientHeight
          const windowWidth = window.innerWidth || document.documentElement.clientWidth

          const inViewport = (
            rect.top <= windowHeight &&
            rect.bottom >= 0 &&
            rect.left <= windowWidth &&
            rect.right >= 0
          )

          if (!disabled) {
            isVisible.value = inViewport
            intersectionRatio.value = inViewport ? 1 : 0
          }

          requestAnimationFrame(checkVisibility)
        }
      }

      nextTick(() => {
        requestAnimationFrame(checkVisibility)
      })
    }
  }

  const unobserve = (element: Element | null) => {
    if (!element || !observer) return

    observer.unobserve(element)
    if (element === currentElement) {
      currentElement = null
      isVisible.value = false
      intersectionRatio.value = 0
    }
  }

  const disconnect = () => {
    if (observer) {
      observer.disconnect()
      observer = null
    }
    currentElement = null
    isVisible.value = false
    intersectionRatio.value = 0
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
    isVisible,
    intersectionRatio,
    observe: observe as (element: Element | null) => void,
    unobserve,
    disconnect
  }
}