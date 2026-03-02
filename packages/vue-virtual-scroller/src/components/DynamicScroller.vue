<template>
  <RecycleScroller
    ref="scrollerRef"
    :items="itemsWithSize"
    :min-item-size="minItemSize"
    :direction="direction"
    key-field="id"
    :list-tag="listTag"
    :item-tag="itemTag"
    :page-mode="pageMode"
    :prerender="prerender"
    :buffer="buffer"
    :emit-update="emitUpdate"
    :update-interval="updateInterval"
    :list-class="listClass"
    :item-class="itemClass"
    :disable-transform="disableTransform"
    :skip-hover="skipHover"
    :size-field="sizeField"
    :item-loading-field="itemLoadingField"
    :start-at-bottom="startAtBottom"
    :initial-scroll-percent="initialScrollPercent"
    :stick-to-bottom="stickToBottom"
    :stick-to-bottom-threshold="stickToBottomThreshold"
    :skeleton-while-scrolling="skeletonWhileScrolling"
    :custom-scrollbar="customScrollbar"
    :scrollbar-options="scrollbarOptions"
    :hide-scrollbar="hideScrollbar"
    :filter="filter"
    v-bind="$attrs"
    @resize="handleScrollerResize"
    @visible="handleScrollerVisible"
    @hidden="handleScrollerHidden"
    @update="handleScrollerUpdate"
    @scroll-start="handleScrollStart"
    @scroll-end="handleScrollEnd"
  >
    <template #default="{ item: itemWithSize, index, active, loading }">
      <slot
        v-if="itemWithSize && itemWithSize['item']"
        v-bind="{
          item: _asT(itemWithSize['item']),
          index,
          active,
          loading,
          itemWithSize
        }"
      />
      <slot
        v-else
        name="empty-item"
        v-bind="{
          item: itemWithSize?.['item'] ? _asT(itemWithSize['item']) : undefined,
          index,
          active,
          loading,
          itemWithSize
        }"
      >
        <div class="vue-dynamic-scroller__empty-item vue-recycle-scroller__skeleton-row">
          <div class="vue-recycle-scroller__skeleton vue-recycle-scroller__skeleton-circle" />
          <div style="flex: 1;">
            <div class="vue-recycle-scroller__skeleton vue-recycle-scroller__skeleton-line" />
            <div class="vue-recycle-scroller__skeleton vue-recycle-scroller__skeleton-line" />
          </div>
        </div>
      </slot>
    </template>

    <template #skeleton="slotProps">
      <slot name="skeleton" :item="_asT((slotProps as any).item)" :index="(slotProps as any).index" />
    </template>

    <template #before>
      <slot name="before" />
    </template>

    <template #after>
      <slot name="after" />
    </template>

    <template #empty>
      <slot name="empty" />
    </template>
  </RecycleScroller>
</template>

<script setup lang="ts" generic="T extends Record<string, any>">
import { computed, nextTick, ref, watch, onUnmounted, provide, useTemplateRef } from 'vue'
import RecycleScroller from './RecycleScroller.vue'
// useSSRSafe removed — no longer needed after onMounted pre-population was deleted
import { useItemValidation } from '../composables/useAsyncItems'
import type { DynamicScrollerProps, DynamicScrollerEmits, VirtualScrollerItem, ResizeEvent, VisibilityEvent, UpdateEvent } from '../types'
import type { RecycleScrollerInstance } from '../types/components'

const {
  items,
  minItemSize,
  keyField = 'id',
  direction = 'vertical',
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
  sizeField = 'size',
  itemLoadingField = 'loading',
  startAtBottom = false,
  initialScrollPercent = null,
  stickToBottom = false,
  stickToBottomThreshold = 0.05,
  skeletonWhileScrolling = false,
  customScrollbar = false,
  scrollbarOptions,
  hideScrollbar = false,
  filter,
} = defineProps<DynamicScrollerProps<T>>()

const emit = defineEmits<DynamicScrollerEmits>()

defineSlots<{
  before: () => any
  default: (props: { item: T; index: number; active: boolean; loading: boolean; itemWithSize: any }) => any
  'empty-item': (props: { item: T | null | undefined; index: number; active: boolean; loading: boolean; itemWithSize: any }) => any
  skeleton: (props: { item: T | null | undefined; index: number }) => any
  empty: () => any
  after: () => any
}>()

// Refs — use explicit instance interface since generic components break InstanceType<>
const scrollerRef = useTemplateRef<RecycleScrollerInstance>('scrollerRef')

// Cast helper: bridge internal VirtualScrollerItem to generic T at slot boundary
const _asT = (item: any): T => item

// Enhanced item validation
const { isItemValid, getItemKey } = useItemValidation(keyField)

// Shared ResizeObserver: single observer for all DynamicScrollerItem children.
// Batches all resize callbacks into a single microtask flush that feeds into
// the batched size updates, so N items resizing = 1 flush = 1 recomputation.
class SharedResizeObserver {
  private observer: ResizeObserver
  private callbacks = new Map<Element, (entry: ResizeObserverEntry) => void>()
  private pendingEntries: ResizeObserverEntry[] = []
  private flushScheduled = false
  onAfterFlush: (() => void) | null = null

  constructor() {
    this.observer = new ResizeObserver((entries) => {
      this.pendingEntries.push(...entries)
      if (!this.flushScheduled) {
        this.flushScheduled = true
        queueMicrotask(() => this.flush())
      }
    })
  }

  private flush() {
    this.flushScheduled = false
    for (const entry of this.pendingEntries) {
      const cb = this.callbacks.get(entry.target)
      if (cb) cb(entry)
    }
    this.pendingEntries.length = 0
    // Synchronously flush pending size updates in the same microtask,
    // collapsing 2 microtasks into 1 and eliminating settling jitter.
    this.onAfterFlush?.()
  }

  observe(el: Element, callback: (entry: ResizeObserverEntry) => void) {
    this.callbacks.set(el, callback)
    this.observer.observe(el)
  }

  unobserve(el: Element) {
    this.callbacks.delete(el)
    this.observer.unobserve(el)
  }

  disconnect() {
    this.observer.disconnect()
    this.callbacks.clear()
    this.pendingEntries.length = 0
  }
}

const sharedResizeObserver = new SharedResizeObserver()

onUnmounted(() => {
  sharedResizeObserver.disconnect()
})

// State
const localItems = ref<VirtualScrollerItem[]>(items || [])

// Batched size store: plain Map (non-reactive) + version counter for coalesced updates.
// Instead of ref<Map> where each .set() triggers reactivity (causing O(N*n) cascade
// when N visible items all measure on mount), we batch all size updates within a
// microtask and trigger a single recomputation via the version counter.
const _sizeMap = new Map<string | number, number>()
const _pendingSizeUpdates = new Map<string | number, number>()
// Track items that haven't been measured yet. Used by scrollToBottom to
// know when all items have settled to their real sizes.
const _unmeasuredKeys = new Set<string | number>()
const sizeVersion = ref(0)
let _pendingFlush = false

const _flushSizeUpdates = () => {
  _pendingFlush = false
  let changed = false
  for (const [key, size] of _pendingSizeUpdates) {
    if (_sizeMap.get(key) !== size) {
      _sizeMap.set(key, size)
      changed = true
    }
  }
  _pendingSizeUpdates.clear()
  if (changed) {
    sizeVersion.value++
  }
}

// Schedule flush using microtask to ensure size updates are flushed
// within the same frame, preventing one-frame delays and visible settling jitter.
const _scheduleFlush = () => {
  if (_pendingFlush) return
  _pendingFlush = true
  queueMicrotask(_flushSizeUpdates)
}

// Collapse double-microtask: after SharedResizeObserver dispatches all
// resize callbacks (which call updateItemSize → _scheduleFlush), flush
// pending size updates synchronously in the same microtask.
sharedResizeObserver.onAfterFlush = () => {
  if (_pendingFlush) _flushSizeUpdates()
}

// Memoized itemsWithSize: reuse wrapper objects when item reference and size
// haven't changed. This prevents the reactive cascade where a single size
// change creates N new wrapper objects, triggering RecycleScroller's items
// watcher and DynamicScrollerItem watchers for every visible item.
interface ItemWithSize {
  id: string | number
  item: VirtualScrollerItem | null | undefined
  size: number
  isValid: boolean
}
let _cachedItemsWithSize: ItemWithSize[] = []
let _cachedKeyMap = new Map<string | number, ItemWithSize>()

const itemsWithSize = computed(() => {
  // Read sizeVersion to establish reactivity dependency
  const _v = sizeVersion.value
  void _v

  const result: ItemWithSize[] = []
  let anyChanged = false
  const seenKeys = new Set<string | number>()

  for (const item of localItems.value) {
    if (!isItemValid(item)) {
      const id = item?.[keyField] ?? item?.id ?? `invalid-${result.length}`
      result.push({
        id: id as string | number,
        item,
        size: minItemSize,
        isValid: false
      })
      anyChanged = true
      continue
    }

    const key = getItemKey(item)
    seenKeys.add(key)
    const size = _sizeMap.get(key) || minItemSize
    const prev = _cachedKeyMap.get(key)

    if (prev && prev.item === item && prev.size === size) {
      result.push(prev) // Reuse same object reference — no downstream triggers
    } else {
      const entry = { id: key, item, size, isValid: true }
      result.push(entry)
      _cachedKeyMap.set(key, entry)
      anyChanged = true
    }
  }

  // If nothing changed and same length, return the exact same array reference.
  if (!anyChanged && result.length === _cachedItemsWithSize.length) {
    return _cachedItemsWithSize
  }

  // Remove stale keys that are no longer in the items list
  if (_cachedKeyMap.size > seenKeys.size) {
    for (const key of _cachedKeyMap.keys()) {
      if (!seenKeys.has(key)) {
        _cachedKeyMap.delete(key)
      }
    }
  }

  _cachedItemsWithSize = result
  return result
})

// Scroll position preservation: when items above the viewport change size
// (e.g., images loading, dynamic content), adjust scrollTop so the user
// stays viewing the same content. Ported from the original vue-virtual-scroller.
watch(itemsWithSize, (next, prev) => {
  if (!prev || prev.length === 0 || next.length === 0) return
  const el = (scrollerRef.value as any)?.$el as HTMLElement | undefined
  if (!el) return
  const scrollPos = direction === 'vertical' ? el.scrollTop : el.scrollLeft
  if (scrollPos <= 0) return

  let prevTop = 0
  let newTop = 0
  const len = Math.min(next.length, prev.length)
  for (let i = 0; i < len; i++) {
    if (prevTop >= scrollPos) break
    prevTop += prev[i]!.size || minItemSize
    newTop += next[i]!.size || minItemSize
  }
  const offset = newTop - prevTop
  if (offset === 0) return

  if (direction === 'vertical') {
    el.scrollTop += offset
  } else {
    el.scrollLeft += offset
  }
})

// Methods
const updateItemSize = (key: string | number, size: number) => {
  _unmeasuredKeys.delete(key)
  if (_sizeMap.get(key) === size) return
  _pendingSizeUpdates.set(key, size)
  _scheduleFlush()
}

const getItemSize = (key: string | number): number => {
  return _sizeMap.get(key) || minItemSize
}

const removeItemSize = (key: string | number): void => {
  _sizeMap.delete(key)
  _pendingSizeUpdates.delete(key)
}

const flushSizeUpdates = () => {
  if (_pendingFlush) {
    _flushSizeUpdates()
  }
}

// Registry of active DynamicScrollerItem instances, keyed by item key.
// Used by invalidateItem() for parent-level imperative remeasure.
const _itemRegistry = new Map<string | number, { updateSize: () => void }>()

const registerItem = (key: string | number, instance: { updateSize: () => void }) => {
  _itemRegistry.set(key, instance)
}

const unregisterItem = (key: string | number) => {
  _itemRegistry.delete(key)
}

const invalidateItem = async (key: string | number): Promise<void> => {
  await nextTick()
  const instance = _itemRegistry.get(key)
  if (instance) {
    instance.updateSize()
  }
}

const resetSizes = () => {
  _sizeMap.clear()
  _pendingSizeUpdates.clear()
  _unmeasuredKeys.clear()
  sizeVersion.value++
}

// Event handlers
const handleScrollerResize = (event: ResizeEvent) => {
  emit('resize', event)
}

const handleScrollerVisible = (event: VisibilityEvent) => {
  emit('visible', event)
}

const handleScrollerHidden = (event: VisibilityEvent) => {
  emit('hidden', event)
}

const handleScrollerUpdate = (event: UpdateEvent) => {
  emit('update', event)
}

const handleScrollStart = () => {
  emit('scroll-start')
}

const handleScrollEnd = () => {
  emit('scroll-end')
}

// Watch for items changes
watch(() => items, (newItems: VirtualScrollerItem[] | null | undefined) => {
  localItems.value = newItems || []

  // Clean up sizes and unmeasured tracking for removed items
  const validItems = (newItems || []).filter(item => item && isItemValid(item))
  const currentKeys = new Set(validItems.map(item => getItemKey(item)))

  // Register new item keys as unmeasured
  for (const key of currentKeys) {
    if (!_sizeMap.has(key)) {
      _unmeasuredKeys.add(key)
    }
  }

  let cleaned = false
  for (const key of _sizeMap.keys()) {
    if (!currentKeys.has(key)) {
      _sizeMap.delete(key)
      cleaned = true
    }
  }
  // Clean stale unmeasured keys
  for (const key of _unmeasuredKeys) {
    if (!currentKeys.has(key)) {
      _unmeasuredKeys.delete(key)
    }
  }

  if (cleaned) {
    sizeVersion.value++
  }
})

// Expose isAtBottom from inner RecycleScroller
const isAtBottom = computed(() => scrollerRef.value?.isAtBottom ?? false)

// Expose the inner scroll element for external scroll utilities (e.g. useInfiniteScroll)
const scrollElement = computed(() => scrollerRef.value?.scrollElement ?? null)

// Expose public methods
defineExpose({
  scrollerRef,
  scrollElement,
  isAtBottom,
  updateItemSize,
  getItemSize,
  removeItemSize,
  resetSizes,
  invalidateItem,
  scrollToItem: (index: number, alignment: 'start' | 'center' | 'end' | 'auto' = 'auto') => {
    flushSizeUpdates()
    scrollerRef.value?.scrollToItem(index, alignment)
  },
  scrollToPosition: (position: number) => {
    flushSizeUpdates()
    scrollerRef.value?.scrollToPosition(position)
  },
  scrollToBottom: () => {
    flushSizeUpdates()
    if (_unmeasuredKeys.size === 0) {
      scrollerRef.value?.scrollToBottom()
      return
    }
    // Some items haven't been measured yet — poll with rAF until settled
    let attempts = 0
    const maxAttempts = 10
    const waitAndScroll = () => {
      flushSizeUpdates()
      scrollerRef.value?.scrollToBottom()
      attempts++
      if (_unmeasuredKeys.size > 0 && attempts < maxAttempts) {
        requestAnimationFrame(waitAndScroll)
      }
    }
    requestAnimationFrame(waitAndScroll)
  },
  scrollToPercent: (percent: number) => {
    flushSizeUpdates()
    scrollerRef.value?.scrollToPercent(percent)
  },
  updateVisibleItems: () => {
    scrollerRef.value?.updateVisibleItems()
  },
  reset: () => {
    resetSizes()
    scrollerRef.value?.reset()
  }
})

// Provide context for DynamicScrollerItem
provide('dynamicScrollerContext', {
  updateItemSize,
  getItemSize,
  removeItemSize,
  sharedResizeObserver,
  direction: computed(() => direction),
  keyField,
  registerItem,
  unregisterItem,
})
</script>

<style scoped>
/* DynamicScroller inherits styles from RecycleScroller */

.vue-dynamic-scroller__empty-item {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 50px;
  padding: 1rem;
  color: #666;
  font-size: 14px;
  background: #fafafa;
  border: 1px dashed #ccc;
  border-radius: 4px;
  margin: 4px 0;
}
</style>
