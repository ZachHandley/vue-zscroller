import type { Ref, ComputedRef } from 'vue'
import type { VirtualScrollerItem, ViewPosition, ScrollPosition, ResizeEvent, VisibilityEvent } from './index'

// Re-export types for convenience
export type { VirtualScrollerItem, ViewPosition, ScrollPosition, ResizeEvent, VisibilityEvent }

export interface UseVirtualScrollCoreOptions {
  items: Ref<VirtualScrollerItem[]>
  itemSize: Ref<number | null>
  minItemSize: Ref<number>
  direction: Ref<'vertical' | 'horizontal'>
  buffer: Ref<number>
  keyField: Ref<string>
  sizeField: Ref<string>
  typeField: Ref<string>
  pageMode: Ref<boolean>
  prerender: Ref<number>
  gridItems: Ref<number>
  itemSecondarySize: Ref<number>
  disableTransform: Ref<boolean>
}

export interface UseVirtualScrollCoreReturn {
  totalSize: ComputedRef<number>
  visibleItems: ComputedRef<VirtualScrollerItem[]>
  startIndex: Ref<number>
  endIndex: Ref<number>
  scrollPosition: Ref<ScrollPosition>
  isScrolling: Ref<boolean>
  isClientSide: Ref<boolean>
  containerSize: Ref<{ width: number; height: number }>
  updateVisibleItems: () => void
  handleScroll: (event: Event) => void
  handleResize: (event: ResizeEvent) => void
  scrollToItem: (index: number, alignment?: 'start' | 'center' | 'end' | 'auto') => void
  scrollToPosition: (position: number) => void
  reset: () => void
}

export interface UseSSRSafeReturn {
  isClient: Ref<boolean>
  isServer: Ref<boolean>
  onClientSide: (callback: () => void) => void
  onServerSide: (callback: () => void) => void
}

export interface UseResizeObserverOptions {
  disabled?: boolean
  throttleMs?: number
}

export interface UseResizeObserverReturn {
  elementSize: Ref<{ width: number; height: number }>
  observe: (element: Element) => void
  unobserve: (element: Element) => void
  disconnect: () => void
}

export interface UseIntersectionObserverOptions {
  root?: Element | null
  rootMargin?: string
  threshold?: number | number[]
  disabled?: boolean
}

export interface UseIntersectionObserverReturn {
  isVisible: Ref<boolean>
  intersectionRatio: Ref<number>
  observe: (element: Element) => void
  unobserve: (element: Element) => void
  disconnect: () => void
}

export interface UseDebounceFnOptions {
  ms?: number
  immediate?: boolean
}

export interface UseThrottleFnOptions {
  ms?: number
  trailing?: boolean
  leading?: boolean
}

export interface UseIdStateOptions<T = any> {
  idProp?: string | ((vm: any) => string | number)
  initialState?: () => T
}

export interface UseIdStateReturn<T = any> {
  idState: Ref<T | null>
  updateIdState: () => void
  reset: () => void
  setup: (componentInstance: any) => void
}

export interface UseVirtualScrollPerformanceOptions {
  enableIntersectionObserver?: boolean
  enableResizeObserver?: boolean
  enableRequestIdleCallback?: boolean
  enableScrollDebounce?: boolean
  scrollDebounceMs?: number
  resizeObserverThrottleMs?: number
}

export interface UseVirtualScrollPerformanceReturn {
  isScrolling: Ref<boolean>
  lastScrollTime: Ref<number>
  rafId: Ref<number | null>
  idleCallbackId: Ref<number | null>
  cancelScroll: () => void
  scheduleUpdate: (callback: () => void, priority?: 'high' | 'low') => void
  handleScroll: (event: Event) => void
  handleResize: (event: Event) => void
  getPerformanceStats: () => {
    scrollEvents: number
    resizeEvents: number
    rafCallbacks: number
    idleCallbacks: number
    averageRenderTime: number
    maxRenderTime: number
    lastUpdateTime: number
    isScrolling: boolean
    scrollDirection: string | null
    scrollVelocity: number
    lastScrollTime: number
    memoryUsage: number | string
  }
  resetMetrics: () => void
  scrollDirection: Ref<string | null>
  scrollVelocity: Ref<number>
}

export interface UseDynamicSizeOptions {
  minItemSize: number
  sizeDependencies?: Ref<any[]>
  watchData?: boolean
  active: Ref<boolean>
}

export interface UseDynamicSizeReturn {
  itemSize: Ref<number>
  measureSize: () => number
  updateSize: () => void
  hasSizeChanged: (oldSize: number, newSize: number) => boolean
  setElement: (el: HTMLElement | null) => void
}

export interface UseGridOptions {
  gridItems: number
  itemSize: number
  itemSecondarySize?: number
  direction: 'vertical' | 'horizontal'
}

export interface UseGridReturn {
  itemsPerRow: number
  rowHeight: number
  columnWidth: number
  totalRows: number
  getItemPosition: (index: number) => { row: number; col: number }
  getItemOffset: (index: number) => number
  getRowSize: (rowIndex: number) => number
}

export interface UseAnimationOptions {
  duration?: number
  easing?: string
  disabled?: boolean
}

export interface UseAnimationReturn {
  animateToPosition: (from: number, to: number, callback?: () => void) => void
  cancelAnimation: () => void
  isAnimating: Ref<boolean>
}

export interface UseSlotRefManagerOptions {
  enableWeakMap?: boolean
  cleanupDelay?: number
  maxSize?: number
}

export interface UseSlotRefManagerReturn<T extends HTMLElement = HTMLElement> {
  registerSlotRef: (key: string | number, element: T | null, slotContext?: object) => void
  getSlotRef: (key: string | number) => T | undefined
  getSlotRefByContext: (slotContext: object) => T | undefined
  isSlotActive: (key: string | number) => boolean
  getActiveSlotKeys: () => Array<string | number>
  getAllSlotRefs: () => Array<T>
  batchRegisterSlots: (slots: Array<{ key: string | number; element: T | null; slotContext?: object }>) => void
  cleanupOldSlots: () => void
  cleanupAllSlots: () => void
  getSlotStats: () => {
    totalSlots: number
    activeSlots: number
    weakMapEntries: string
    maxSize: number
    memoryUsage: number | string
  }
  slotKeys: Ref<Set<string | number>>
  activeSlots: Ref<Set<string | number>>
}