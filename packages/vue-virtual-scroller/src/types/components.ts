import type DynamicScrollerVue from '../components/DynamicScroller.vue'
import type DynamicScrollerItemVue from '../components/DynamicScrollerItem.vue'
import type GridScrollerVue from '../components/GridScroller.vue'
import type RecycleScrollerVue from '../components/RecycleScroller.vue'

// ---------------------------------------------------------------------------
// Component type aliases (kept for backwards compat; use `as any` when needed
// because generic components break `InstanceType<typeof ...>`)
// ---------------------------------------------------------------------------
export type RecycleScrollerComponent = typeof RecycleScrollerVue
export type DynamicScrollerComponent = typeof DynamicScrollerVue
export type DynamicScrollerItemComponent = typeof DynamicScrollerItemVue
export type GridScrollerComponent = typeof GridScrollerVue

// ---------------------------------------------------------------------------
// Instance interfaces — use these for template refs instead of InstanceType<>
// Each interface mirrors the component's `defineExpose` signature exactly.
// ---------------------------------------------------------------------------

/** Exposed API of a `<RecycleScroller>` component instance. */
export interface RecycleScrollerInstance {
  /** The actual DOM element that scrolls (has overflow: auto). */
  scrollElement: HTMLElement | null
  scrollToItem: (index: number, alignment?: 'start' | 'center' | 'end' | 'auto') => void
  scrollToPosition: (position: number) => void
  scrollToBottom: () => void
  scrollToPercent: (percent: number) => void
  updateVisibleItems: (itemsChanged?: boolean, checkPositionDiff?: boolean) => void
  isAtBottom: boolean
  reset: () => void
}

/** Exposed API of a `<DynamicScroller>` component instance. */
export interface DynamicScrollerInstance {
  scrollerRef: RecycleScrollerInstance | undefined
  /** The actual DOM element that scrolls (delegates to RecycleScroller). */
  scrollElement: HTMLElement | null
  isAtBottom: boolean
  updateItemSize: (key: string | number, size: number) => void
  getItemSize: (key: string | number) => number
  removeItemSize: (key: string | number) => void
  resetSizes: () => void
  scrollToItem: (index: number, alignment?: 'start' | 'center' | 'end' | 'auto') => void
  scrollToPosition: (position: number) => void
  scrollToBottom: () => void
  scrollToPercent: (percent: number) => void
  updateVisibleItems: () => void
  /** Imperatively remeasure a specific item by key. Waits for nextTick before measuring. */
  invalidateItem: (key: string | number) => Promise<void>
  reset: () => void
}

/** Exposed API of a `<GridScroller>` component instance. */
export interface GridScrollerInstance {
  scrollerRef: RecycleScrollerInstance | undefined
  isMeasured: boolean
  computedColumns: number
  scrollToItem: (index: number, alignment?: 'start' | 'center' | 'end' | 'auto') => void
  scrollToPosition: (position: number) => void
  scrollToBottom: () => void
  scrollToPercent: (percent: number) => void
  scrollToCell: (row: number, col: number) => void
  updateVisibleItems: () => void
}
