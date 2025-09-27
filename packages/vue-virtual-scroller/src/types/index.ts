export interface VirtualScrollerItem<T = any> {
  id: string | number
  size?: number
  type?: string
  [key: string]: any
}

export interface ViewPosition {
  start: number
  end: number
}

export interface ViewItem<T = any> {
  id: string | number
  item: VirtualScrollerItem<T>
  index: number
  position: number
  offset: number
  used: boolean
  nr: {
    id: string | number
    key: string | number
    index: number
    used: boolean
  }
}

export interface ScrollerProps {
  items: VirtualScrollerItem[]
  keyField?: string
  direction?: 'vertical' | 'horizontal'
  itemSize?: number | null
  minItemSize?: number
  gridItems?: number
  itemSecondarySize?: number
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
}

export interface DynamicScrollerProps extends ScrollerProps {
  minItemSize: number
}

export interface DynamicScrollerItemProps<T = any> {
  item: VirtualScrollerItem<T>
  active: boolean
  sizeDependencies?: any[]
  watchData?: boolean
  tag?: string
  emitResize?: boolean
  dataIndex?: number
}

export interface ScrollPosition {
  top: number
  left: number
}

export interface ResizeEvent {
  width: number
  height: number
}

export interface VisibilityEvent {
  isVisible: boolean
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
  (e: 'hidden'): void
  (e: 'update', event: UpdateEvent): void
  (e: 'scroll-start'): void
  (e: 'scroll-end'): void
}

export interface DynamicScrollerEmits extends ScrollerEmits {
  (e: 'resize', size: number): void
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
  item: VirtualScrollerItem<T>
  index: number
  active: boolean
}

export interface DynamicScrollerSlotProps<T = any> extends VirtualScrollerSlotProps<T> {
  itemWithSize: VirtualScrollerItem<T> & { size: number }
}