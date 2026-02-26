import type { Ref } from 'vue'
import { useLocalStorage, useSessionStorage, useStorage } from '@vueuse/core'
import { computed, ref } from 'vue'
import { useSSRSafe } from './useSSRSafe'

const _isClient = typeof window !== 'undefined'

// SSR-safe storage utilities
export function useSSRSafeLocalStorage<T>(key: string, defaultValue: T): Ref<T> {
  if (!_isClient) {
    return ref(defaultValue) as Ref<T>
  }

  return useLocalStorage(key, defaultValue)
}

export function useSSRSafeSessionStorage<T>(key: string, defaultValue: T): Ref<T> {
  if (!_isClient) {
    return ref(defaultValue) as Ref<T>
  }

  return useSessionStorage(key, defaultValue)
}

export function useSSRSafeStorage<T>(key: string, defaultValue: T): Ref<T> {
  if (!_isClient) {
    return ref(defaultValue) as Ref<T>
  }

  return useStorage(key, defaultValue, localStorage)
}

// SSR-safe window/document access
export function useSSRSafeWindow() {
  const { isClient } = useSSRSafe()

  return computed(() => {
    if (!isClient.value) {
      return {
        innerWidth: 1024,
        innerHeight: 768,
        outerWidth: 1024,
        outerHeight: 768,
        devicePixelRatio: 1,
        pageXOffset: 0,
        pageYOffset: 0,
        screenX: 0,
        screenY: 0,
        screenLeft: 0,
        screenTop: 0,
        scrollX: 0,
        scrollY: 0,
        scrollTo: () => {},
        scrollBy: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        matchMedia: (query: string) => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }),
      }
    }

    return window
  })
}

export function useSSRSafeDocument() {
  const { isClient } = useSSRSafe()

  return computed(() => {
    if (!isClient.value) {
      return {
        documentElement: {
          clientWidth: 1024,
          clientHeight: 768,
          scrollWidth: 1024,
          scrollHeight: 768,
          offsetWidth: 1024,
          offsetHeight: 768,
          getBoundingClientRect: () => ({
            width: 1024,
            height: 768,
            top: 0,
            left: 0,
            right: 1024,
            bottom: 768,
            x: 0,
            y: 0,
            toJSON: () => ({}),
          }),
          getClientRects: () => [],
          scrollIntoView: () => {},
          scroll: () => {},
          scrollTo: () => {},
          scrollBy: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
          querySelector: () => null,
          querySelectorAll: () => [],
          getElementsByTagName: () => [],
          getElementsByClassName: () => [],
          getElementById: () => null,
        },
        body: {
          clientWidth: 1024,
          clientHeight: 768,
          scrollWidth: 1024,
          scrollHeight: 768,
          offsetWidth: 1024,
          offsetHeight: 768,
          getBoundingClientRect: () => ({
            width: 1024,
            height: 768,
            top: 0,
            left: 0,
            right: 1024,
            bottom: 768,
            x: 0,
            y: 0,
            toJSON: () => ({}),
          }),
        },
        createDocumentFragment: () => ({
          appendChild: () => {},
          removeChild: () => {},
          insertBefore: () => {},
          replaceChild: () => {},
          cloneNode: () => ({}),
          querySelector: () => null,
          querySelectorAll: () => [],
          getElementsByTagName: () => [],
          getElementsByClassName: () => [],
          getElementById: () => null,
        }),
        createElement: () => ({
          appendChild: () => {},
          removeChild: () => {},
          insertBefore: () => {},
          replaceChild: () => {},
          cloneNode: () => ({}),
          getBoundingClientRect: () => ({
            width: 0,
            height: 0,
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            x: 0,
            y: 0,
            toJSON: () => ({}),
          }),
          getClientRects: () => [],
          scrollIntoView: () => {},
          scroll: () => {},
          scrollTo: () => {},
          scrollBy: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
          querySelector: () => null,
          querySelectorAll: () => [],
          getElementsByTagName: () => [],
          getElementsByClassName: () => [],
          getElementById: () => null,
        }),
        querySelector: () => null,
        querySelectorAll: () => [],
        getElementsByTagName: () => [],
        getElementsByClassName: () => [],
        getElementById: () => null,
      }
    }

    return document
  })
}

// SSR-safe viewport utilities
export function useSSRSafeViewport() {
  const window = useSSRSafeWindow()

  const viewportWidth = computed(() => window.value.innerWidth)
  const viewportHeight = computed(() => window.value.innerHeight)

  const isMobile = computed(() => viewportWidth.value < 768)
  const isTablet = computed(() => viewportWidth.value >= 768 && viewportWidth.value < 1024)
  const isDesktop = computed(() => viewportWidth.value >= 1024)

  return {
    viewportWidth,
    viewportHeight,
    isMobile,
    isTablet,
    isDesktop,
  }
}

// SSR-safe device detection
export function useSSRSafeDevice() {
  const { isClient } = useSSRSafe()

  const userAgent = computed(() => {
    if (!isClient.value) {
      return 'Mozilla/5.0 (SSR) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }

    return navigator.userAgent
  })

  const isIOS = computed(() => {
    return /iPad|iPhone|iPod/.test(userAgent.value)
  })

  const isAndroid = computed(() => {
    return /Android/.test(userAgent.value)
  })

  const isSafari = computed(() => {
    return /Safari/.test(userAgent.value) && !/Chrome/.test(userAgent.value)
  })

  const isChrome = computed(() => {
    return /Chrome/.test(userAgent.value)
  })

  const isFirefox = computed(() => {
    return /Firefox/.test(userAgent.value)
  })

  return {
    userAgent,
    isIOS,
    isAndroid,
    isSafari,
    isChrome,
    isFirefox,
  }
}

// SSR-safe animation frame
export function useSSRSafeRaf() {
  const { isClient } = useSSRSafe()

  const requestRaf = (callback: FrameRequestCallback) => {
    if (!isClient.value) {
      return setTimeout(callback as any, 16) // Fallback timeout for SSR
    }

    return requestAnimationFrame(callback)
  }

  const cancelRaf = (id: number) => {
    if (!isClient.value) {
      return clearTimeout(id)
    }

    return cancelAnimationFrame(id)
  }

  return {
    requestRaf,
    cancelRaf,
  }
}

// SSR-safe intersection observer simulation
export function useSSRSafeIntersection() {
  const { isClient } = useSSRSafe()

  const observe = (element: Element, callback: (entry: IntersectionObserverEntry) => void) => {
    if (!isClient.value) {
      // Simulate immediate intersection during SSR
      callback({
        isIntersecting: true,
        intersectionRatio: 1,
        boundingClientRect: typeof element.getBoundingClientRect === 'function'
          ? element.getBoundingClientRect()
          : ({
              width: 0,
              height: 0,
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              x: 0,
              y: 0,
              toJSON: () => ({}),
            } as DOMRect),
        intersectionRect: typeof element.getBoundingClientRect === 'function'
          ? element.getBoundingClientRect()
          : ({
              width: 0,
              height: 0,
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              x: 0,
              y: 0,
              toJSON: () => ({}),
            } as DOMRect),
        rootBounds: { width: 1024, height: 768, top: 0, left: 0, right: 1024, bottom: 768, x: 0, y: 0, toJSON: () => ({}) },
        target: element,
        time: (typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : Date.now(),
      } as IntersectionObserverEntry)
      return { disconnect: () => {} }
    }

    if (typeof IntersectionObserver === 'undefined') {
      return {
        disconnect: () => {},
      }
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(callback)
    })

    observer.observe(element)

    return {
      disconnect: () => observer.disconnect(),
    }
  }

  return {
    observe,
  }
}

// Enhanced useSSRSafe with additional utilities
export function useSSRSafeEnhanced() {
  const basicSSRSafe = useSSRSafe()

  return {
    ...basicSSRSafe,
    useSSRSafeLocalStorage,
    useSSRSafeSessionStorage,
    useSSRSafeStorage,
    useSSRSafeWindow,
    useSSRSafeDocument,
    useSSRSafeViewport,
    useSSRSafeDevice,
    useSSRSafeRaf,
    useSSRSafeIntersection,
  }
}
