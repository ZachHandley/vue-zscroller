export interface VirtualScrollerItem<_T = any> {
  id?: string | number
  size?: number
  type?: string
  key?: string | number
  isValid?: boolean
  [key: string]: any
}

export interface ViewPosition {
  start: number
  end: number
}

export interface ViewItem<T = any> {
  item: VirtualScrollerItem<T> | null | undefined
  position: number
  offset: number
  nr: {
    id: number
    index: number
    used: boolean
    key: string | number
    type: string | number
    fresh: boolean
  }
}

export interface ScrollbarOptions {
  /** Track width in px. Default: 12 */
  width?: number
  /** Minimum thumb height in px. Default: 30 */
  minThumbSize?: number
  /** Auto-hide scrollbar when not scrolling. Default: true */
  autoHide?: boolean
  /** Milliseconds before auto-hiding. Default: 1000 */
  autoHideDelay?: number
  /** CSS color for the thumb. Default: 'rgba(0, 0, 0, 0.4)' */
  thumbColor?: string
  /** CSS color for the track. Default: 'transparent' */
  trackColor?: string
  /** CSS border-radius for the thumb. Default: '6px' */
  thumbBorderRadius?: string
  /** Inset offset in px from the edge (right for vertical, bottom for horizontal). Default: 0 */
  offset?: number
  /** Scrollbar positioning mode. 'overlay' renders on top of content (default). 'outside' renders as a flex sibling next to the scroll container. */
  position?: 'overlay' | 'outside'
}

export interface ScrollerProps<T extends Record<string, any> = Record<string, any>> {
  items: T[] | null | undefined
  keyField?: string
  direction?: 'vertical' | 'horizontal'
  itemSize?: number | null
  minItemSize?: number
  gridItems?: number
  itemSecondarySize?: number
  /** Actual content width/height for grid item views (main axis, excludes gap). When set, used by getViewStyle instead of itemSize. */
  gridViewSize?: number
  /** Actual content width/height for grid item views (cross axis, excludes gap). When set, used by getViewStyle instead of itemSecondarySize. */
  gridViewSecondarySize?: number
  sizeField?: string
  typeField?: string
  pageMode?: boolean
  prerender?: number
  buffer?: number
  emitUpdate?: boolean
  updateInterval?: number
  listClass?: string | string[]
  itemClass?: string | string[]
  listTag?: string
  itemTag?: string
  disableTransform?: boolean
  skipHover?: boolean
  startAtBottom?: boolean
  initialScrollPercent?: number | null
  /** When enabled, automatically scrolls to bottom when new items are appended and the user is already at the bottom. */
  stickToBottom?: boolean
  /**
   * Distance from the bottom edge within which the user is considered "at the bottom".
   * - number (0-1): percentage of the scroller's own height (e.g., 0.05 = 5%)
   * - number (> 1): fixed pixels
   * - string "50px": fixed pixels
   * - string "5vh": percentage of viewport height
   * - string "5%": percentage of scroller's own height
   * Default: 0.05 (5% of scroller height)
   */
  stickToBottomThreshold?: number | string
  /** When enabled, shows lightweight skeleton placeholders during active scrolling instead of rendering full item content. */
  skeletonWhileScrolling?: boolean
  /** Field name on item objects that indicates loading state. When item[field] is truthy, `loading: true` is passed in slot props. Default: 'loading' */
  itemLoadingField?: string
  /** Optional filter function applied to items before rendering. Items for which the function returns false are excluded. */
  filter?: ((item: VirtualScrollerItem) => boolean) | undefined
  /** Optional comparator function for sorting items. When provided, items are sorted before rendering. */
  sortBy?: ((a: VirtualScrollerItem, b: VirtualScrollerItem) => number) | undefined
  /** Enable the built-in custom scrollbar overlay. When true, the native scrollbar is hidden and a custom track/thumb is rendered. Default: false */
  customScrollbar?: boolean
  /** Options for the custom scrollbar appearance and behavior. Only used when customScrollbar is true. */
  scrollbarOptions?: ScrollbarOptions | undefined
  /** Hide all scrollbars (native and custom) while keeping the area scrollable via mousewheel/touch. Default: false */
  hideScrollbar?: boolean
}

export interface DynamicScrollerProps<T extends Record<string, any> = Record<string, any>> extends ScrollerProps<T> {
  minItemSize: number
}

export interface DynamicScrollerItemProps<T = any> {
  item: VirtualScrollerItem<T> | null | undefined
  active: boolean
  minItemSize?: number
  sizeDependencies?: any[]
  watchData?: boolean
  tag?: string
  emitResize?: boolean
  dataIndex?: number
}

export interface ScrollPosition {
  top: number
  left: number
  elementTop?: number
  elementLeft?: number
  elementRight?: number
  elementBottom?: number
  isOutsideViewport?: boolean
}

export interface ResizeEvent {
  width: number
  height: number
}

export interface VisibilityEvent {
  item: VirtualScrollerItem
  index: number
  key: string | number
}

export interface UpdateEvent {
  startIndex: number
  endIndex: number
  visibleStartIndex: number
  visibleEndIndex: number
}

export interface ScrollerEmits {
  (e: 'resize', event: ResizeEvent): void
  (e: 'visible', event: VisibilityEvent): void
  (e: 'hidden', event: VisibilityEvent): void
  (e: 'update', event: UpdateEvent): void
  (e: 'scroll-start'): void
  (e: 'scroll-end'): void
}

export interface DynamicScrollerEmits {
  (e: 'resize', event: ResizeEvent): void
  (e: 'visible', event: VisibilityEvent): void
  (e: 'hidden', event: VisibilityEvent): void
  (e: 'update', event: UpdateEvent): void
  (e: 'scroll-start'): void
  (e: 'scroll-end'): void
}

export interface DynamicScrollerItemEmits {
  (e: 'resize', size: number): void
}

export interface IdStateOptions {
  idProp?: string | ((vm: any) => string | number)
}

export interface IdStateComposableOptions {
  idProp?: string | ((vm: any) => string | number)
}

export interface VirtualScrollerSlotProps<T = any> {
  item: VirtualScrollerItem<T> | null | undefined
  index: number
  active: boolean
  /** True when the item is in a loading state (scroll-based skeleton or item's own loading field). */
  loading: boolean
}

export interface DynamicScrollerSlotProps<T = any> extends VirtualScrollerSlotProps<T> {
  itemWithSize: (VirtualScrollerItem<T> & { size: number, isValid?: boolean }) | null | undefined
}

export interface DynamicScrollerItemSlotProps {
  /** Trigger a remeasure of this DynamicScrollerItem. Waits for nextTick before measuring. */
  triggerResize: () => Promise<void>
}

// GridScroller types

export interface GridScrollerProps<T extends Record<string, any> = Record<string, any>> {
  items: T[] | null | undefined
  keyField?: string
  itemWidth: number
  itemHeight: number
  minColumns?: number
  maxColumns?: number
  columns?: number | null
  rowGap?: number
  columnGap?: number
  gap?: number
  /** Padding around the grid content. Number is pixels, string is any CSS padding value (e.g. '16px', '1rem', '16px 24px'). Default: 0 */
  padding?: number | string
  direction?: 'vertical' | 'horizontal'
  pageMode?: boolean
  prerender?: number
  buffer?: number
  emitUpdate?: boolean
  updateInterval?: number
  listClass?: string | string[]
  itemClass?: string | string[]
  listTag?: string
  itemTag?: string
  disableTransform?: boolean
  skipHover?: boolean
  startAtBottom?: boolean
  initialScrollPercent?: number | null
  /** When enabled, shows lightweight skeleton placeholders during active scrolling instead of rendering full item content. */
  skeletonWhileScrolling?: boolean
  /** Field name on item objects that indicates loading state. When item[field] is truthy, `loading: true` is passed in slot props. Default: 'loading' */
  itemLoadingField?: string
  /** Optional filter function applied to items before rendering. Items for which the function returns false are excluded. */
  filter?: ((item: VirtualScrollerItem) => boolean) | undefined
  /** Optional comparator function for sorting items. When provided, items are sorted before rendering. */
  sortBy?: ((a: VirtualScrollerItem, b: VirtualScrollerItem) => number) | undefined
  /** Enable the built-in custom scrollbar overlay. When true, the native scrollbar is hidden and a custom track/thumb is rendered. Default: false */
  customScrollbar?: boolean
  /** Options for the custom scrollbar appearance and behavior. Only used when customScrollbar is true. */
  scrollbarOptions?: ScrollbarOptions | undefined
}

export interface GridScrollerEmits {
  (e: 'resize', event: ResizeEvent): void
  (e: 'visible', event: VisibilityEvent): void
  (e: 'hidden', event: VisibilityEvent): void
  (e: 'update', event: UpdateEvent): void
  (e: 'scroll-start'): void
  (e: 'scroll-end'): void
  (e: 'columns-change', columns: number): void
}

export interface GridScrollerSlotProps<T = any> {
  item: VirtualScrollerItem<T> | null | undefined
  index: number
  active: boolean
  /** True when the item is in a loading state (scroll-based skeleton or item's own loading field). */
  loading: boolean
  column: number
  row: number
  cellWidth: number
  cellHeight: number
}
