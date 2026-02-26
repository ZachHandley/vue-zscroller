import type { Ref } from 'vue'
import type { ScrollbarOptions } from './index'

export interface UseSSRSafeReturn {
  isClient: Ref<boolean>
  isServer: Ref<boolean>
  onClientSide: (callback: () => void) => void
  onServerSide: (callback: () => void) => void
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

export interface UseDynamicSizeReturn {
  itemSize: Ref<number>
  measureSize: () => number
  updateSize: () => void
  hasSizeChanged: (oldSize: number, newSize: number) => boolean
  setElement: (el: HTMLElement | null) => void
  setCurrentSize: (size: number) => void
}

export interface UseCustomScrollbarOptions {
  /** Reactive ref to the scroll container element */
  scrollElement: Ref<HTMLElement | null>
  /** Reactive total content size in pixels (main axis) */
  totalSize: Ref<number>
  /** 'vertical' or 'horizontal' */
  direction: 'vertical' | 'horizontal'
  /** Function to call when the scrollbar wants to set scroll position */
  onScrollTo: (position: number) => void
  /** Scrollbar appearance/behavior options */
  options?: ScrollbarOptions
}

export interface UseCustomScrollbarReturn {
  /** Current thumb height/width in px */
  thumbSize: Ref<number>
  /** Current thumb translateY/X offset in px */
  thumbPosition: Ref<number>
  /** Track height/width in px */
  trackSize: Ref<number>
  /** Whether the scrollbar is currently visible (for auto-hide) */
  isVisible: Ref<boolean>
  /** Whether the user is currently dragging the thumb */
  isDragging: Ref<boolean>
  /** Call this from the scroller's scroll handler to update thumb position */
  onScroll: () => void
  /** Call this when the container resizes */
  onResize: () => void
  /** Handle pointer down on the thumb (starts drag) */
  onThumbPointerDown: (e: PointerEvent) => void
  /** Handle pointer down on the track (jump to position) */
  onTrackPointerDown: (e: PointerEvent) => void
  /** Cleanup (removes global event listeners) */
  destroy: () => void
}
