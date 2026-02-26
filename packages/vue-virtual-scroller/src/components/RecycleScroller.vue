<template>
  <div
    ref="scrollElement"
    class="vue-recycle-scroller"
    :class="{
      ready,
      'page-mode': pageMode,
      [`direction-${direction}`]: true,
      'grid-mode': (gridItems ?? 1) > 1,
      ...(typeof listClass === 'string' && listClass ? { [listClass]: true } : {})
    }"
    @scroll.passive="handleScroll"
  >
    <div
      v-if="$slots['before']"
      ref="beforeElement"
      class="vue-recycle-scroller__slot"
    >
      <slot name="before" />
    </div>

    <component
      :is="listTag"
      ref="wrapperElement"
      :style="wrapperStyle"
      class="vue-recycle-scroller__item-wrapper"
      :class="listClass"
    >
      <ItemView
        v-for="view in pool"
        :key="view.nr.id"
        :view="view"
        :item-tag="itemTag!"
        :style="getViewStyle(view)"
        class="vue-recycle-scroller__item-view"
        :class="[
          itemClass,
          {
            hover: !skipHover && hoverKey === view.nr.key,
            'vue-recycle-scroller__item-view--invalid': !isItemValid(view.item)
          }
        ]"
        v-on="skipHover
          ? {}
          : {
            mouseenter: () => { hoverKey = view.nr.key },
            mouseleave: () => {
              if (hoverKey === view.nr.key) hoverKey = null
            }
          }"
      >
        <template #default="{ item, index, active }">
          <template v-if="shouldShowSkeleton(view)">
            <slot name="skeleton" :item="item" :index="index">
              <div class="vue-recycle-scroller__skeleton-row">
                <div class="vue-recycle-scroller__skeleton vue-recycle-scroller__skeleton-circle" />
                <div style="flex: 1;">
                  <div class="vue-recycle-scroller__skeleton vue-recycle-scroller__skeleton-line" />
                  <div class="vue-recycle-scroller__skeleton vue-recycle-scroller__skeleton-line" />
                </div>
              </div>
            </slot>
          </template>
          <template v-else>
            <slot
              v-if="isItemValid(item)"
              :item="item"
              :index="index"
              :active="active"
            />
            <slot
              v-else
              name="empty-item"
              :index="index"
            >
              <div class="vue-recycle-scroller__empty-item vue-recycle-scroller__skeleton-row">
                <div class="vue-recycle-scroller__skeleton vue-recycle-scroller__skeleton-circle" />
                <div style="flex: 1;">
                  <div class="vue-recycle-scroller__skeleton vue-recycle-scroller__skeleton-line" />
                  <div class="vue-recycle-scroller__skeleton vue-recycle-scroller__skeleton-line" />
                </div>
              </div>
            </slot>
          </template>
        </template>
      </ItemView>

      <slot name="empty" />
    </component>

    <div
      v-if="$slots['after']"
      ref="afterElement"
      class="vue-recycle-scroller__slot"
    >
      <slot name="after" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowReactive, markRaw, useTemplateRef, watch, type CSSProperties } from 'vue'
import ItemView from './ItemView.vue'
import config from '../config'
import { getScrollParent } from '../scrollparent'
import type { ScrollerEmits, ScrollerProps, VirtualScrollerItem, VisibilityEvent } from '../types'

type ViewType = string | number

interface SizeEntry {
  accumulator: number
  size: number
}

interface InternalView {
  item: VirtualScrollerItem | null | undefined
  position: number
  offset: number
  nr: {
    id: number
    index: number
    used: boolean
    key: string | number
    type: ViewType
    fresh: boolean
  }
}

const {
  items: itemsProp,
  keyField = 'id',
  direction = 'vertical',
  itemSize = null,
  minItemSize = 50,
  gridItems = 1,
  itemSecondarySize = 0,
  gridViewSize = 0,
  gridViewSecondarySize = 0,
  sizeField = 'size',
  typeField = 'type',
  pageMode = false,
  prerender = 0,
  buffer = 500,
  emitUpdate = false,
  updateInterval = 0,
  listClass = '',
  itemClass = '',
  listTag = 'div',
  itemTag = 'div',
  disableTransform = false,
  skipHover = false,
  startAtBottom = false,
  initialScrollPercent = null,
  stickToBottom = false,
  stickToBottomThreshold = 50,
  skeletonWhileScrolling = false,
  filter,
} = defineProps<ScrollerProps>()

const emit = defineEmits<ScrollerEmits>()

defineSlots<{
  before: () => any
  default: (props: { item: VirtualScrollerItem | null | undefined; index: number; active: boolean }) => any
  'empty-item': (props: { index: number }) => any
  empty: () => any
  after: () => any
  skeleton: (props: { item: VirtualScrollerItem | null | undefined; index: number }) => any
}>()

const scrollElement = useTemplateRef<HTMLElement>('scrollElement')
const beforeElement = useTemplateRef<HTMLElement>('beforeElement')
const afterElement = useTemplateRef<HTMLElement>('afterElement')

const ready = ref(false)
const hoverKey = ref<string | number | null>(null)
const pool = ref<InternalView[]>([])
const totalSize = ref(0)
const startIndex = ref(0)
const endIndex = ref(0)
const isScrolling = ref(false)
const shouldShowSkeleton = (view: InternalView): boolean => {
  if (!skeletonWhileScrolling) return false
  if (!ready.value) return true
  return view.nr.fresh
}

watch(isScrolling, (newVal, oldVal) => {
  if (!newVal && oldVal) {
    for (const view of pool.value) {
      if (view.nr.fresh) {
        view.nr.fresh = false
      }
    }
  }
})

const isAtBottom = ref(false)

const items = computed<VirtualScrollerItem[]>(() => {
  const raw = itemsProp || []
  return filter ? raw.filter(filter) : raw
})
const simpleArray = computed(() => items.value.length > 0 && typeof items.value[0] !== 'object')

const views = new Map<string | number, InternalView>()
const recycledPools = new Map<ViewType, InternalView[]>()

let uid = 0
let scrollDirty = false
let updateTimeout = 0
let refreshTimeout = 0
let scrollEndTimeout = 0
let sortTimer = 0
let lastUpdateScrollPosition = 0
let listenerTarget: EventTarget | null = null
let resizeObserver: ResizeObserver | null = null
let fallbackResizeHandler: (() => void) | null = null

// Track currently visible item keys for visible/hidden events
const previousVisibleKeys = new Map<string | number, { item: VirtualScrollerItem; index: number }>()
// Reusable Map for building the new visible set — avoids allocating a new Map
// on every updateVisibleItems call. Cleared and refilled each time.
const _newVisibleKeys = new Map<string | number, { item: VirtualScrollerItem; index: number }>()

// Cached min size — updated as a side-effect of sizeData computation.
// Used by checkPositionDiff to avoid forcing a full sizeData recompute
// just to read the minimum item size threshold.
const cachedMinSize = ref(minItemSize)

// Incremental accumulator cache — avoids full O(N) rebuild when only a few
// items change sizes (the common case for DynamicScroller size updates).
let _prevEntries: SizeEntry[] = []
let _prevItemsLength = 0
let _prevComputedMinSize = Number.POSITIVE_INFINITY

const sizeData = computed(() => {
  if (itemSize !== null) {
    _prevEntries = []
    _prevItemsLength = 0
    _prevComputedMinSize = minItemSize
    cachedMinSize.value = minItemSize
    return {
      entries: [] as SizeEntry[],
      total: Math.ceil(items.value.length / (gridItems || 1)) * itemSize,
      computedMinSize: minItemSize
    }
  }

  const itemsArr = items.value
  const count = itemsArr.length
  const sField = sizeField
  const minSize = minItemSize

  // Incremental path: same-length items array — scan for first size diff
  // and only rebuild the accumulator from that point forward.
  if (count === _prevItemsLength && count > 0 && _prevEntries.length === count) {
    let firstChanged = -1
    for (let i = 0; i < count; i++) {
      const item = itemsArr[i]
      const itemSize = (item?.[sField] as number) || minSize
      if (itemSize !== _prevEntries[i]!.size) {
        firstChanged = i
        break
      }
    }

    if (firstChanged === -1) {
      // No sizes changed at all — return cached data as-is
      cachedMinSize.value = _prevComputedMinSize
      return {
        entries: _prevEntries,
        total: _prevEntries[count - 1]!.accumulator,
        computedMinSize: _prevComputedMinSize
      }
    }

    // Rebuild only from firstChanged onward
    let accumulator = firstChanged > 0 ? _prevEntries[firstChanged - 1]!.accumulator : 0
    let computedMinSize = _prevComputedMinSize

    // If the min size might have increased (an item that WAS the min changed),
    // we need to rescan the portion before firstChanged too
    const oldMinEntry = _prevEntries[firstChanged]!
    const needFullMinScan = oldMinEntry.size <= computedMinSize

    for (let i = firstChanged; i < count; i++) {
      const item = itemsArr[i]
      const itemSize = (item?.[sField] as number) || minSize
      if (itemSize < computedMinSize) {
        computedMinSize = itemSize
      }
      accumulator += itemSize
      // Reuse existing entry objects where possible to reduce GC pressure
      const existing = _prevEntries[i]!
      existing.accumulator = accumulator
      existing.size = itemSize
    }

    // If an item that was the previous min changed, rescan the unchanged prefix
    // to find the true minimum (rare path)
    if (needFullMinScan) {
      computedMinSize = Number.POSITIVE_INFINITY
      for (let i = 0; i < count; i++) {
        if (_prevEntries[i]!.size < computedMinSize) {
          computedMinSize = _prevEntries[i]!.size
        }
      }
    }

    if (!Number.isFinite(computedMinSize)) {
      computedMinSize = minSize
    }

    _prevComputedMinSize = computedMinSize
    cachedMinSize.value = computedMinSize

    return {
      entries: _prevEntries,
      total: accumulator,
      computedMinSize
    }
  }

  // Full rebuild path: items length changed or first computation
  const entries: SizeEntry[] = new Array(count)
  let accumulator = 0
  let computedMinSize = Number.POSITIVE_INFINITY

  for (let i = 0; i < count; i++) {
    const item = itemsArr[i]
    const itemSize = (item?.[sField] as number) || minSize
    if (itemSize < computedMinSize) {
      computedMinSize = itemSize
    }
    accumulator += itemSize
    entries[i] = { accumulator, size: itemSize }
  }

  if (!Number.isFinite(computedMinSize)) {
    computedMinSize = minSize
  }

  // Cache for incremental updates
  _prevEntries = entries
  _prevItemsLength = count
  _prevComputedMinSize = computedMinSize

  // Side-effect: update cached min size so checkPositionDiff can read it
  // without forcing this entire computed to recompute.
  cachedMinSize.value = computedMinSize

  return {
    entries,
    total: accumulator,
    computedMinSize
  }
})

const wrapperStyle = computed<CSSProperties>(() => {
  const sizeKey = direction === 'vertical' ? 'minHeight' : 'minWidth'
  return {
    [sizeKey]: `${Math.max(totalSize.value, 0)}px`
  }
})

const isItemValid = (item: VirtualScrollerItem | null | undefined): boolean => {
  return item !== null && item !== undefined && typeof item === 'object'
}

const getViewType = (item: VirtualScrollerItem | null | undefined): ViewType => {
  if (!item || typeof item !== 'object') return 'default'
  return (item[typeField] as ViewType) ?? 'default'
}

const getRecycledPool = (type: ViewType): InternalView[] => {
  let recycledPool = recycledPools.get(type)
  if (!recycledPool) {
    recycledPool = []
    recycledPools.set(type, recycledPool)
  }
  return recycledPool
}

const createView = (index: number, item: VirtualScrollerItem | null | undefined, key: string | number, type: ViewType): InternalView => {
  const nr = markRaw({
    id: uid++,
    index,
    used: true,
    key,
    type,
    fresh: isScrolling.value && skeletonWhileScrolling
  })

  const view = shallowReactive({
    item,
    position: 0,
    offset: 0,
    nr
  }) as InternalView

  pool.value.push(view)
  return view
}

const getRecycledView = (type: ViewType): InternalView | undefined => {
  const recycledPool = getRecycledPool(type)
  if (!recycledPool.length) return undefined
  const view = recycledPool.pop()
  if (view) {
    view.nr.used = true
    view.nr.fresh = isScrolling.value && skeletonWhileScrolling
  }
  return view
}

const removeAndRecycleView = (view: InternalView) => {
  const recycledPool = getRecycledPool(view.nr.type)
  recycledPool.push(view)
  view.nr.used = false
  view.nr.fresh = false
  view.position = -9999
  view.offset = 0
  views.delete(view.nr.key)
}

const removeAndRecycleAllViews = () => {
  views.clear()
  recycledPools.clear()
  for (const view of pool.value) {
    removeAndRecycleView(view)
  }
}

const getScroll = () => {
  const el = scrollElement.value
  if (!el) return { start: 0, end: 0 }

  const isVertical = direction === 'vertical'

  if (pageMode) {
    const bounds = el.getBoundingClientRect()
    const boundsSize = isVertical ? bounds.height : bounds.width
    let start = -(isVertical ? bounds.top : bounds.left)
    let size = isVertical ? window.innerHeight : window.innerWidth

    if (start < 0) {
      size += start
      start = 0
    }

    if (start + size > boundsSize) {
      size = boundsSize - start
    }

    return {
      start,
      end: start + size
    }
  }

  if (isVertical) {
    return {
      start: el.scrollTop,
      end: el.scrollTop + el.clientHeight
    }
  }

  return {
    start: el.scrollLeft,
    end: el.scrollLeft + el.clientWidth
  }
}

const getViewportExtent = (): number => {
  const el = scrollElement.value
  if (!el) return 0

  if (pageMode) {
    return direction === 'vertical' ? window.innerHeight : window.innerWidth
  }

  return direction === 'vertical' ? el.clientHeight : el.clientWidth
}

const getFixedItemPosition = (index: number): { position: number; offset: number } => {
  const effectiveGridItems = gridItems || 1
  const baseItemSize = itemSize || minItemSize
  const effectiveSecondarySize = itemSecondarySize || baseItemSize

  return {
    position: Math.floor(index / effectiveGridItems) * baseItemSize,
    offset: (index % effectiveGridItems) * effectiveSecondarySize
  }
}

const getVariableItemPosition = (index: number): number => {
  if (index <= 0) return 0
  const prev = sizeData.value.entries[index - 1]
  return prev ? prev.accumulator : 0
}

const findIndexFromOffset = (offset: number): number => {
  const entries = sizeData.value.entries
  const count = entries.length
  if (count === 0) return 0
  if (offset <= 0) return 0

  let low = 0
  let high = count - 1

  while (low < high) {
    const mid = Math.floor((low + high) / 2)
    if (entries[mid]!.accumulator < offset) {
      low = mid + 1
    } else {
      high = mid
    }
  }

  return low
}

const getItemSizeAt = (index: number): number => {
  if (itemSize !== null) return itemSize
  return sizeData.value.entries[index]?.size || minItemSize
}

const itemsLimitError = () => {
  setTimeout(() => {
    console.error(
      '[vue-zscroller] Rendered items limit reached. Ensure scroller has a fixed size and overflow enabled.',
      scrollElement.value
    )
  })
  throw new Error('Rendered items limit reached')
}

// O(n) gap check: instead of filter+sort (O(n log n)), check contiguity via min/max/count
const isAnyVisibleGap = () => {
  let minIndex = Infinity
  let maxIndex = -Infinity
  let usedCount = 0

  for (const view of pool.value) {
    if (!view.nr.used) continue
    usedCount++
    if (view.nr.index < minIndex) minIndex = view.nr.index
    if (view.nr.index > maxIndex) maxIndex = view.nr.index
  }

  return usedCount > 0 && (maxIndex - minIndex + 1) !== usedCount
}

let sortViewsInProgress = false
let sortViewsAttempts = 0

const sortViews = () => {
  if (sortViewsInProgress) return
  sortViewsInProgress = true
  sortViewsAttempts++

  pool.value.sort((a, b) => a.nr.index - b.nr.index)
  // Only retry once to fill gaps; prevent infinite cycle
  if (sortViewsAttempts <= 2 && isAnyVisibleGap()) {
    updateVisibleItems(false)
  }

  sortViewsInProgress = false
}

const emitScrollEndEventually = () => {
  if (scrollEndTimeout) {
    clearTimeout(scrollEndTimeout)
  }

  scrollEndTimeout = window.setTimeout(() => {
    if (isScrolling.value) {
      isScrolling.value = false
      emit('scroll-end')
    }
  }, 150)
}

const updateVisibleItems = (itemsChanged = false, checkPositionDiff = false) => {
  const count = items.value.length
  let newStartIndex = 0
  let newEndIndex = 0
  let visibleStartIndex = 0
  let visibleEndIndex = 0
  let nextTotalSize = 0

  if (!count) {
    newStartIndex = 0
    newEndIndex = 0
    visibleStartIndex = 0
    visibleEndIndex = 0
    nextTotalSize = 0
  } else if (prerender > 0 && !ready.value) {
    newStartIndex = 0
    newEndIndex = Math.min(prerender, count)
    visibleStartIndex = newStartIndex
    visibleEndIndex = newEndIndex
    nextTotalSize = itemSize !== null
      ? Math.ceil(count / (gridItems || 1)) * itemSize
      : sizeData.value.total
  } else {
    const scroll = getScroll()

    if (checkPositionDiff) {
      const positionDiff = Math.abs(scroll.start - lastUpdateScrollPosition)
      // Update frequently with small batches rather than infrequently with
      // large batches. Using minSize/3 means ~1-2 items recycle per update
      // instead of waiting for a full item height and bursting 5-10 at once.
      const minSize = itemSize === null ? cachedMinSize.value : itemSize
      const threshold = Math.max(minSize / 3, 12)
      if (positionDiff < threshold) {
        return { continuous: true }
      }
    }

    lastUpdateScrollPosition = scroll.start

    scroll.start -= buffer
    scroll.end += buffer

    let beforeSize = 0
    if (beforeElement.value) {
      beforeSize = direction === 'vertical'
        ? beforeElement.value.scrollHeight
        : beforeElement.value.scrollWidth
      scroll.start -= beforeSize
    }

    if (afterElement.value) {
      const afterSize = direction === 'vertical'
        ? afterElement.value.scrollHeight
        : afterElement.value.scrollWidth
      scroll.end += afterSize
    }

    if (itemSize === null) {
      newStartIndex = findIndexFromOffset(scroll.start)
      newEndIndex = Math.min(findIndexFromOffset(scroll.end) + 1, count)

      const visibleStartOffset = Math.max(scroll.start - beforeSize, 0)
      const visibleEndOffset = Math.max(scroll.end - beforeSize, 0)
      visibleStartIndex = findIndexFromOffset(visibleStartOffset)
      visibleEndIndex = Math.min(findIndexFromOffset(visibleEndOffset) + 1, count)

      nextTotalSize = sizeData.value.total
    } else {
      const effectiveGridItems = gridItems || 1
      const effectiveItemSize = itemSize

      newStartIndex = Math.floor((scroll.start / effectiveItemSize) * effectiveGridItems)
      const remainder = newStartIndex % effectiveGridItems
      newStartIndex -= remainder

      newEndIndex = Math.ceil((scroll.end / effectiveItemSize) * effectiveGridItems)
      visibleStartIndex = Math.max(0, Math.floor(((scroll.start - beforeSize) / effectiveItemSize) * effectiveGridItems))
      visibleEndIndex = Math.floor(((scroll.end - beforeSize) / effectiveItemSize) * effectiveGridItems)

      newStartIndex = Math.max(0, newStartIndex)
      newEndIndex = Math.min(count, newEndIndex)
      visibleStartIndex = Math.max(0, visibleStartIndex)
      visibleEndIndex = Math.min(count, visibleEndIndex)

      nextTotalSize = Math.ceil(count / effectiveGridItems) * effectiveItemSize
    }
  }

  if (newEndIndex - newStartIndex > config.itemsLimit) {
    itemsLimitError()
  }

  totalSize.value = nextTotalSize

  const continuous = newStartIndex <= endIndex.value && newEndIndex >= startIndex.value

  if (!continuous || itemsChanged) {
    removeAndRecycleAllViews()
  } else {
    for (const view of pool.value) {
      if (!view.nr.used) continue

      const viewVisible = view.nr.index >= newStartIndex && view.nr.index < newEndIndex
      const viewSize = getItemSizeAt(view.nr.index)
      if (!viewVisible || !viewSize) {
        removeAndRecycleView(view)
      }
    }
  }

  for (let i = newStartIndex; i < newEndIndex; i++) {
    const elementSize = getItemSizeAt(i)
    if (!elementSize) continue

    const item = items.value[i]
    const key = simpleArray.value ? i : item?.[keyField]

    if (key == null) {
      throw new Error(`Key is ${String(key)} on item (keyField is '${keyField}')`)
    }

    let view = views.get(key)
    const type = getViewType(item)

    if (!view) {
      view = getRecycledView(type)

      if (view) {
        view.item = item
        view.nr.index = i
        view.nr.key = key
        view.nr.type = type
      } else {
        view = createView(i, item, key, type)
      }

      views.set(key, view)
    } else if (view.item !== item) {
      view.item = item
    }

    if (itemSize === null) {
      view.position = getVariableItemPosition(i)
      view.offset = 0
    } else {
      const position = getFixedItemPosition(i)
      view.position = position.position
      view.offset = position.offset
    }
  }

  // Build new visible set using reusable Map (avoids allocation per call)
  _newVisibleKeys.clear()
  for (const [key, view] of views) {
    if (view.nr.used && view.item) {
      _newVisibleKeys.set(key, { item: view.item, index: view.nr.index })
    }
  }

  // Emit 'visible' for items that entered the viewport.
  // Compare against previousVisibleKeys directly — no copy needed.
  for (const [key, data] of _newVisibleKeys) {
    if (!previousVisibleKeys.has(key)) {
      emit('visible', { item: data.item, index: data.index, key } as VisibilityEvent)
    }
  }

  // Emit 'hidden' for items that left the viewport
  for (const [key, data] of previousVisibleKeys) {
    if (!_newVisibleKeys.has(key)) {
      emit('hidden', { item: data.item, index: data.index, key } as VisibilityEvent)
    }
  }

  // Update tracked visible keys
  previousVisibleKeys.clear()
  for (const [key, data] of _newVisibleKeys) {
    previousVisibleKeys.set(key, data)
  }

  startIndex.value = newStartIndex
  endIndex.value = newEndIndex

  if (emitUpdate) {
    emit('update', {
      startIndex: newStartIndex,
      endIndex: newEndIndex,
      visibleStartIndex,
      visibleEndIndex
    })
  }

  if (itemsChanged) {
    sortViewsAttempts = 0
    if (sortTimer) {
      clearTimeout(sortTimer)
    }
    sortTimer = window.setTimeout(sortViews, updateInterval + 300)
  }

  return { continuous }
}

let resizeRafId = 0
let lastContainerWidth = 0
let lastContainerHeight = 0

const handleResize = () => {
  const el = scrollElement.value
  if (!el) return
  const w = el.clientWidth
  const h = el.clientHeight

  // Skip if container size hasn't actually changed — prevents ResizeObserver
  // loop from wrapper minHeight/minWidth changes triggering endless cycles
  if (w === lastContainerWidth && h === lastContainerHeight) return
  lastContainerWidth = w
  lastContainerHeight = h

  emit('resize', { width: w, height: h })

  if (ready.value) {
    if (resizeRafId) cancelAnimationFrame(resizeRafId)
    resizeRafId = requestAnimationFrame(() => {
      resizeRafId = 0
      updateVisibleItems(false)
    })
  }
}

let nonContinuousRetries = 0

const scheduleScrollUpdate = () => {
  const requestUpdate = () => {
    requestAnimationFrame(() => {
      scrollDirty = false
      const { continuous } = updateVisibleItems(false, true)

      if (!continuous && nonContinuousRetries < 3) {
        nonContinuousRetries++
        if (refreshTimeout) clearTimeout(refreshTimeout)
        refreshTimeout = window.setTimeout(scheduleScrollUpdate, updateInterval + 100)
      } else {
        nonContinuousRetries = 0
      }

      emitScrollEndEventually()
    })
  }

  requestUpdate()

  if (updateInterval > 0) {
    updateTimeout = window.setTimeout(() => {
      updateTimeout = 0
      if (scrollDirty) {
        requestUpdate()
      }
    }, updateInterval)
  }
}

const handleScroll = () => {
  if (!ready.value) return

  nonContinuousRetries = 0

  // Track whether user is at the bottom (within threshold) for stickToBottom
  if (stickToBottom) {
    const el = scrollElement.value
    if (el) {
      if (direction === 'vertical') {
        isAtBottom.value = el.scrollTop + el.clientHeight >= el.scrollHeight - stickToBottomThreshold
      } else {
        isAtBottom.value = el.scrollLeft + el.clientWidth >= el.scrollWidth - stickToBottomThreshold
      }
    }
  }

  if (!isScrolling.value) {
    isScrolling.value = true
    emit('scroll-start')
  }

  if (!scrollDirty) {
    scrollDirty = true
    if (updateTimeout) return
    scheduleScrollUpdate()
  }
}

const getListenerTarget = (): EventTarget | null => {
  const el = scrollElement.value
  if (!el) return null

  let target = getScrollParent(el)
  if (window.document && (target === window.document.documentElement || target === window.document.body)) {
    return window
  }

  return target || window
}

const addListeners = () => {
  listenerTarget = getListenerTarget()
  if (!listenerTarget) return

  listenerTarget.addEventListener('scroll', handleScroll, { passive: true })
  listenerTarget.addEventListener('resize', handleResize)
}

const removeListeners = () => {
  if (!listenerTarget) return

  listenerTarget.removeEventListener('scroll', handleScroll)
  listenerTarget.removeEventListener('resize', handleResize)
  listenerTarget = null
}

const applyPageMode = () => {
  if (pageMode) {
    addListeners()
  } else {
    removeListeners()
  }
}

const scrollToPosition = (position: number) => {
  const el = scrollElement.value
  if (!el) return

  let viewport: any
  let scrollDistance = Math.max(0, position)

  if (pageMode) {
    const viewportEl = getScrollParent(el)
    if (!viewportEl) return

    const isVertical = direction === 'vertical'
    const scrollOffset = (viewportEl as any).tagName === 'HTML'
      ? 0
      : (isVertical ? (viewportEl as any).scrollTop : (viewportEl as any).scrollLeft)
    const bounds = viewportEl.getBoundingClientRect()
    const scroller = el.getBoundingClientRect()
    const scrollerPosition = direction === 'vertical'
      ? scroller.top - bounds.top
      : scroller.left - bounds.left

    viewport = viewportEl
    scrollDistance = scrollDistance + scrollOffset + scrollerPosition
  } else {
    viewport = el
  }

  if (direction === 'vertical') {
    viewport.scrollTop = scrollDistance
  } else {
    viewport.scrollLeft = scrollDistance
  }
}

const scrollToPercent = (percent: number) => {
  const clampedPercent = Math.max(0, Math.min(percent, 1))
  const viewportExtent = getViewportExtent()
  const maxOffset = Math.max(totalSize.value - viewportExtent, 0)
  scrollToPosition(maxOffset * clampedPercent)
}

const scrollToBottom = () => {
  const el = scrollElement.value
  if (!el) return

  const applyScroll = () => {
    if (direction === 'vertical') {
      el.scrollTop = el.scrollHeight - el.clientHeight
    } else {
      el.scrollLeft = el.scrollWidth - el.clientWidth
    }
  }

  let attempts = 0
  const maxAttempts = 3

  const settle = () => {
    applyScroll()
    attempts++
    if (attempts < maxAttempts) {
      nextTick(() => {
        // Verify and adjust — covers DynamicScroller async size updates
        const isVertical = direction === 'vertical'
        const atEnd = isVertical
          ? el.scrollTop + el.clientHeight >= el.scrollHeight - 1
          : el.scrollLeft + el.clientWidth >= el.scrollWidth - 1
        if (!atEnd) {
          settle()
        }
      })
    }
  }

  nextTick(settle)
}

const scrollToItem = (index: number, alignment: 'start' | 'center' | 'end' | 'auto' = 'auto') => {
  if (index < 0 || index >= items.value.length) return

  let position = 0

  if (itemSize !== null) {
    position = getFixedItemPosition(index).position
  } else {
    position = getVariableItemPosition(index)
  }

  // Account for before slot element offset
  if (beforeElement.value) {
    position += direction === 'vertical'
      ? beforeElement.value.scrollHeight
      : beforeElement.value.scrollWidth
  }

  const viewportExtent = getViewportExtent()

  if (alignment === 'center') {
    position -= viewportExtent / 2
  } else if (alignment === 'end') {
    position -= viewportExtent
  } else if (alignment === 'auto') {
    const current = getScroll()
    const itemExtent = getItemSizeAt(index)
    if (position >= current.start && position + itemExtent <= current.end) {
      return
    }
  }

  scrollToPosition(Math.max(position, 0))
}

const getViewStyle = (view: InternalView): CSSProperties => {
  const style: CSSProperties = {
    visibility: view.nr.used ? 'visible' : 'hidden'
  }

  if (disableTransform) {
    if (direction === 'vertical') {
      style.top = `${view.position}px`
      style.left = `${view.offset}px`
    } else {
      style.left = `${view.position}px`
      style.top = `${view.offset}px`
    }
    style.willChange = 'unset'
  } else {
    const mainTransform = direction === 'vertical' ? 'translateY' : 'translateX'
    const crossTransform = direction === 'vertical' ? 'translateX' : 'translateY'
    style.transform = `${mainTransform}(${view.position}px) ${crossTransform}(${view.offset}px)`
  }

  if (gridItems > 1) {
    // Use gridViewSize/gridViewSecondarySize for the actual content dimensions
    // when provided (set by GridScroller). These exclude gaps and may be stretched
    // to fill the container. Fall back to stride-based sizes for backward compat.
    const mainSize = gridViewSize || itemSize || minItemSize
    const crossSize = gridViewSecondarySize || itemSecondarySize || itemSize || minItemSize

    if (direction === 'vertical') {
      style.width = `${crossSize}px`
      style.height = `${mainSize}px`
    } else {
      style.width = `${mainSize}px`
      style.height = `${crossSize}px`
    }
  }

  return style
}

// Smart items change detection - track only what we actually diff on (O(1) instead of O(n) copy)
let previousFirstKey: string | number | null = null
let previousLastKey: string | number | null = null
let previousItemsLength = 0

const handlePrepend = (prependCount: number) => {
  const el = scrollElement.value
  if (!el) {
    nextTick(() => updateVisibleItems(true))
    return
  }

  // Calculate size of prepended items
  let prependSize = 0
  if (itemSize !== null) {
    const effectiveGridItems = gridItems || 1
    prependSize = Math.ceil(prependCount / effectiveGridItems) * itemSize
  } else {
    for (let i = 0; i < prependCount; i++) {
      const item = items.value[i]
      prependSize += (item?.[sizeField] as number) || minItemSize
    }
  }

  // Adjust scroll position to keep viewport content stable
  nextTick(() => {
    if (direction === 'vertical') {
      el.scrollTop += prependSize
    } else {
      el.scrollLeft += prependSize
    }
    updateVisibleItems(true)
  })
}

watch(() => itemsProp, (newItems) => {
  const newArr = newItems || []
  const oldFirstKey = previousFirstKey
  const oldLastKey = previousLastKey
  const oldLen = previousItemsLength
  const newLen = newArr.length

  // Update tracking state (O(1) - no array copy)
  previousItemsLength = newLen
  previousFirstKey = newLen > 0 ? (simpleArray.value ? 0 : newArr[0]?.[keyField]) : null
  previousLastKey = newLen > 0 ? (simpleArray.value ? (newLen - 1) : newArr[newLen - 1]?.[keyField]) : null

  if (newLen === 0 || oldLen === 0) {
    // Full replace
    nextTick(() => updateVisibleItems(true))
    return
  }

  // Same length + same keys = property updates only (e.g., DynamicScroller size changes)
  if (newLen === oldLen && newLen > 0) {
    if (oldFirstKey === previousFirstKey && oldLastKey === previousLastKey) {
      // Check if any visible item sizes actually changed before triggering update.
      // This prevents the DynamicScroller cascade: itemsWithSize creates new wrapper
      // objects on every sizeVersion change, but if no actual sizes differ for
      // visible items, we can skip the expensive updateVisibleItems call entirely.
      let sizeChanged = false
      const sField = sizeField
      for (let i = startIndex.value; i < endIndex.value && i < newLen; i++) {
        const item = newArr[i]
        const key = simpleArray.value ? i : item?.[keyField]
        const view = views.get(key)
        if (view && view.item !== item) {
          const oldSize = view.item?.[sField]
          const newSize = item?.[sField]
          if (oldSize !== newSize) {
            sizeChanged = true
            break
          }
        }
      }
      if (sizeChanged) {
        nextTick(() => updateVisibleItems(false))
      }
      return
    }
  }

  // Detect append: old items still at same positions, new items at end
  if (newLen > oldLen) {
    if (oldFirstKey === previousFirstKey) {
      // Append detected — no recycle needed, just update
      const shouldStick = stickToBottom && isAtBottom.value
      nextTick(() => {
        updateVisibleItems(false)
        if (shouldStick) {
          nextTick(() => scrollToBottom())
        }
      })
      return
    }

    // Prepend detected — new items at start
    if (oldLastKey === previousLastKey) {
      // Prepend: preserve scroll position
      const prependCount = newLen - oldLen
      handlePrepend(prependCount)
      return
    }
  }

  // Default: full update
  nextTick(() => updateVisibleItems(true))
})

watch(() => pageMode, () => {
  applyPageMode()
  nextTick(() => {
    updateVisibleItems(false)
  })
})

watch([
  () => itemSize,
  () => minItemSize,
  () => sizeField,
  () => typeField,
  () => buffer,
  () => gridItems,
  () => itemSecondarySize,
  () => gridViewSize,
  () => gridViewSecondarySize,
  () => direction
], () => {
  nextTick(() => {
    updateVisibleItems(true)
  })
})

onMounted(() => {
  applyPageMode()

  if (typeof ResizeObserver !== 'undefined' && scrollElement.value) {
    resizeObserver = new ResizeObserver(() => {
      handleResize()
    })
    resizeObserver.observe(scrollElement.value)
  } else {
    fallbackResizeHandler = () => {
      handleResize()
    }
    window.addEventListener('resize', fallbackResizeHandler)
  }

  nextTick(() => {
    ready.value = true
    updateVisibleItems(true)
    handleResize()

    if (initialScrollPercent !== null) {
      scrollToPercent(initialScrollPercent)
    } else if (startAtBottom) {
      scrollToBottom()
    }

    // When stickToBottom is enabled, treat initial state as "at bottom"
    // so that items appended before the user scrolls will auto-scroll
    if (stickToBottom) {
      isAtBottom.value = true
    }
  })
})

onUnmounted(() => {
  removeListeners()
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (fallbackResizeHandler) {
    window.removeEventListener('resize', fallbackResizeHandler)
    fallbackResizeHandler = null
  }
  if (resizeRafId) cancelAnimationFrame(resizeRafId)
  if (updateTimeout) clearTimeout(updateTimeout)
  if (refreshTimeout) clearTimeout(refreshTimeout)
  if (scrollEndTimeout) clearTimeout(scrollEndTimeout)
  if (sortTimer) clearTimeout(sortTimer)
})

defineExpose({
  scrollToItem,
  scrollToPosition,
  scrollToBottom,
  scrollToPercent,
  updateVisibleItems,
  isAtBottom,
  reset: () => {
    startIndex.value = 0
    endIndex.value = 0
    isScrolling.value = false
    removeAndRecycleAllViews()
  }
})
</script>

<style scoped>
.vue-recycle-scroller {
  position: relative;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}

.vue-recycle-scroller.direction-horizontal {
  display: flex;
  flex-direction: row;
  overflow-x: auto;
  overflow-y: hidden;
}

.vue-recycle-scroller.direction-vertical {
  overflow-y: auto;
}

.vue-recycle-scroller__slot {
  flex-shrink: 0;
}

.vue-recycle-scroller__item-wrapper {
  position: relative;
  box-sizing: border-box;
}

.vue-recycle-scroller.direction-vertical .vue-recycle-scroller__item-wrapper {
  width: 100%;
}

.vue-recycle-scroller.direction-horizontal .vue-recycle-scroller__item-wrapper {
  height: 100%;
  flex-shrink: 0;
}

.vue-recycle-scroller__item-view {
  position: absolute;
  top: 0;
  left: 0;
  box-sizing: border-box;
  contain: layout style paint;
}

.vue-recycle-scroller.ready.direction-vertical:not(.grid-mode) .vue-recycle-scroller__item-view {
  width: 100%;
}

.vue-recycle-scroller.ready.direction-horizontal:not(.grid-mode) .vue-recycle-scroller__item-view {
  height: 100%;
}

.vue-recycle-scroller__item-view.hover {
  z-index: 1;
}

.vue-recycle-scroller.ready .vue-recycle-scroller__item-view {
  transition: none;
}

.vue-recycle-scroller.page-mode {
  overflow-y: auto;
  overflow-x: hidden;
  height: 100%;
}

.vue-recycle-scroller.page-mode.direction-horizontal {
  display: flex;
  flex-direction: row;
  overflow-x: auto;
  overflow-y: hidden;
}

.vue-recycle-scroller__item-view--invalid {
  pointer-events: none;
  user-select: none;
  opacity: 0.5;
}

.vue-recycle-scroller__empty-item {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 50px;
  color: #999;
  font-size: 14px;
  background: #f5f5f5;
  border: 1px dashed #ddd;
}

.vue-recycle-scroller__skeleton {
  position: relative;
  overflow: hidden;
  background: #e9ecef;
  border-radius: 4px;
}

.vue-recycle-scroller__skeleton::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.4) 50%,
    transparent 100%
  );
  animation: vue-scroller-shimmer 1.5s ease-in-out infinite;
  transform: translateX(-100%);
}

@keyframes vue-scroller-shimmer {
  100% {
    transform: translateX(100%);
  }
}

.vue-recycle-scroller__skeleton-line {
  height: 16px;
  margin: 8px 0;
  border-radius: 4px;
}

.vue-recycle-scroller__skeleton-line:first-child {
  width: 60%;
}

.vue-recycle-scroller__skeleton-line:nth-child(2) {
  width: 80%;
}

.vue-recycle-scroller__skeleton-line:nth-child(3) {
  width: 40%;
}

.vue-recycle-scroller__skeleton-circle {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
}

.vue-recycle-scroller__skeleton-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
}
</style>
