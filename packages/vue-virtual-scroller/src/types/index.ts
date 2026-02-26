export interface VirtualScrollerItem<T = any> {
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

export interface ScrollerProps {
  items: VirtualScrollerItem[] | null | undefined
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
  /** Pixel threshold from the bottom to consider the user "at the bottom". Default: 50 */
  stickToBottomThreshold?: number
  /** When enabled, shows lightweight skeleton placeholders during active scrolling instead of rendering full item content. */
  skeletonWhileScrolling?: boolean
}

export interface DynamicScrollerProps extends ScrollerProps {
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

export type ScrollerEmitsOptions = {
  resize: (event: ResizeEvent) => void
  visible: (event: VisibilityEvent) => void
  hidden: (event: VisibilityEvent) => void
  update: (event: UpdateEvent) => void
  'scroll-start': () => void
  'scroll-end': () => void
}

export type DynamicScrollerEmitsOptions = {
  resize: (event: ResizeEvent) => void
  visible: (event: VisibilityEvent) => void
  hidden: (event: VisibilityEvent) => void
  update: (event: UpdateEvent) => void
  'scroll-start': () => void
  'scroll-end': () => void
}

export type DynamicScrollerItemEmitsOptions = {
  resize: (size: number) => void
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
}

export interface DynamicScrollerSlotProps<T = any> extends VirtualScrollerSlotProps<T> {
  itemWithSize: (VirtualScrollerItem<T> & { size: number; isValid?: boolean }) | null | undefined
}

// GridScroller types

export interface GridScrollerProps {
  items: VirtualScrollerItem[] | null | undefined
  keyField?: string
  itemWidth: number
  itemHeight: number
  minColumns?: number
  maxColumns?: number
  columns?: number | null
  rowGap?: number
  columnGap?: number
  gap?: number
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

export type GridScrollerEmitsOptions = {
  resize: (event: ResizeEvent) => void
  visible: (event: VisibilityEvent) => void
  hidden: (event: VisibilityEvent) => void
  update: (event: UpdateEvent) => void
  'scroll-start': () => void
  'scroll-end': () => void
  'columns-change': (columns: number) => void
}

export interface GridScrollerSlotProps<T = any> {
  item: VirtualScrollerItem<T> | null | undefined
  index: number
  active: boolean
  column: number
  row: number
  cellWidth: number
  cellHeight: number
}
