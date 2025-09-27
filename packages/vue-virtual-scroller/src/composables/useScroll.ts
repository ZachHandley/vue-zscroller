import { ref, onMounted, onUnmounted, nextTick, type Ref } from 'vue'

export interface ScrollPosition {
  scrollTop: number
  scrollLeft: number
}

export interface ScrollState {
  x: Ref<number>
  y: Ref<number>
  isScrolling: Ref<boolean>
  arrivedState: {
    left: Ref<boolean>
    right: Ref<boolean>
    top: Ref<boolean>
    bottom: Ref<boolean>
  }
  directions: {
    left: Ref<boolean>
    right: Ref<boolean>
    top: Ref<boolean>
    bottom: Ref<boolean>
  }
  scrollDirection?: Ref<'up' | 'down' | 'left' | 'right'>
}

export interface UseScrollOptions {
  throttle?: number
  idle?: number
  onStop?: () => void
  onScroll?: (e: Event) => void
  behavior?: 'auto' | 'smooth'
}

export function useScroll(
  element: Ref<Element | null | undefined> | Element | null | undefined,
  options: UseScrollOptions = {}
): ScrollState {
  const {
    throttle = 100,
    idle = 200,
    onStop,
    onScroll
  } = options

  const x = ref(0)
  const y = ref(0)
  const isScrolling = ref(false)

  const arrivedState = {
    left: ref(true),
    right: ref(false),
    top: ref(true),
    bottom: ref(false)
  }

  const directions = {
    left: ref(false),
    right: ref(false),
    top: ref(false),
    bottom: ref(false)
  }

  let lastScrollPosition: ScrollPosition = { scrollTop: 0, scrollLeft: 0 }
  let throttleTimer: number | null = null
  let idleTimer: number | null = null

  const updateScrollPosition = (element: Element) => {
    if (element instanceof HTMLElement) {
      const newScrollLeft = element.scrollLeft
      const newScrollTop = element.scrollTop

      x.value = newScrollLeft
      y.value = newScrollTop

      // Update arrived state
      arrivedState.left.value = newScrollLeft <= 0
      arrivedState.right.value = newScrollLeft + element.clientWidth >= element.scrollWidth - 1
      arrivedState.top.value = newScrollTop <= 0
      arrivedState.bottom.value = newScrollTop + element.clientHeight >= element.scrollHeight - 1

      // Update directions
      directions.left.value = newScrollLeft < lastScrollPosition.scrollLeft
      directions.right.value = newScrollLeft > lastScrollPosition.scrollLeft
      directions.top.value = newScrollTop < lastScrollPosition.scrollTop
      directions.bottom.value = newScrollTop > lastScrollPosition.scrollTop

      lastScrollPosition = { scrollTop: newScrollTop, scrollLeft: newScrollLeft }
    } else if ((element as any).documentElement) {
      const htmlElement = (element as any).documentElement
      const newScrollLeft = htmlElement.scrollLeft
      const newScrollTop = htmlElement.scrollTop

      x.value = newScrollLeft
      y.value = newScrollTop

      arrivedState.left.value = newScrollLeft <= 0
      arrivedState.right.value = newScrollLeft + htmlElement.clientWidth >= htmlElement.scrollWidth - 1
      arrivedState.top.value = newScrollTop <= 0
      arrivedState.bottom.value = newScrollTop + htmlElement.clientHeight >= htmlElement.scrollHeight - 1

      directions.left.value = newScrollLeft < lastScrollPosition.scrollLeft
      directions.right.value = newScrollLeft > lastScrollPosition.scrollLeft
      directions.top.value = newScrollTop < lastScrollPosition.scrollTop
      directions.bottom.value = newScrollTop > lastScrollPosition.scrollTop

      lastScrollPosition = { scrollTop: newScrollTop, scrollLeft: newScrollLeft }
    }
  }

  const handleScroll = (e: Event) => {
    if (!e.target) return

    const target = e.target as Element
    updateScrollPosition(target)

    // Set scrolling state
    isScrolling.value = true

    // Clear previous timers
    if (throttleTimer) {
      clearTimeout(throttleTimer)
    }
    if (idleTimer) {
      clearTimeout(idleTimer)
    }

    // Set throttle timer
    throttleTimer = window.setTimeout(() => {
      throttleTimer = null
    }, throttle)

    // Set idle timer
    idleTimer = window.setTimeout(() => {
      isScrolling.value = false
      if (onStop) {
        onStop()
      }
      idleTimer = null
    }, idle)

    // Call onScroll callback if provided
    if (onScroll) {
      onScroll(e)
    }
  }

  const addScrollListener = (element: Element | null | undefined) => {
    if (!element) return

    // Initialize scroll position
    updateScrollPosition(element)

    // Add scroll event listener
    element.addEventListener('scroll', handleScroll, { passive: true })
  }

  const removeScrollListener = (element: Element | null | undefined) => {
    if (!element) return
    element.removeEventListener('scroll', handleScroll)
  }

  // Handle reactive element
  if (typeof element === 'function' && 'value' in element) {
    // It's a ref
    onMounted(() => {
      const elementRef = element as Ref<Element | null | undefined>
      addScrollListener(elementRef.value)

      // Watch for changes to the ref
      let currentElement = elementRef.value
      const checkElement = () => {
        if (elementRef.value !== currentElement) {
          removeScrollListener(currentElement)
          addScrollListener(elementRef.value)
          currentElement = elementRef.value
        }
      }

      // Simple polling for ref changes
      const interval = setInterval(checkElement, 100)

      onUnmounted(() => {
        clearInterval(interval)
        removeScrollListener(currentElement)

        // Clear any pending timers
        if (throttleTimer) {
          clearTimeout(throttleTimer)
        }
        if (idleTimer) {
          clearTimeout(idleTimer)
        }
      })
    })
  } else {
    // It's a direct element
    onMounted(() => {
      addScrollListener(element as Element | null)
    })

    onUnmounted(() => {
      removeScrollListener(element as Element | null)

      // Clear any pending timers
      if (throttleTimer) {
        clearTimeout(throttleTimer)
      }
      if (idleTimer) {
        clearTimeout(idleTimer)
      }
    })
  }

  return {
    x,
    y,
    isScrolling,
    arrivedState,
    directions
  }
}