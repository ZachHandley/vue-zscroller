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
    :start-at-bottom="startAtBottom"
    :initial-scroll-percent="initialScrollPercent"
    :stick-to-bottom="stickToBottom"
    :stick-to-bottom-threshold="stickToBottomThreshold"
    :skeleton-while-scrolling="skeletonWhileScrolling"
    v-bind="$attrs"
    @resize="handleScrollerResize"
    @visible="handleScrollerVisible"
    @hidden="handleScrollerHidden"
    @update="handleScrollerUpdate"
    @scroll-start="handleScrollStart"
    @scroll-end="handleScrollEnd"
  >
    <template #default="{ item: itemWithSize, index, active }">
      <slot
        v-if="itemWithSize && itemWithSize['item']"
        v-bind="{
          item: itemWithSize['item'],
          index,
          active,
          itemWithSize
        }"
      />
      <slot
        v-else
        name="empty-item"
        v-bind="{
          item: itemWithSize?.['item'],
          index,
          active,
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
      <slot name="skeleton" v-bind="slotProps" />
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

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted, provide, useTemplateRef } from 'vue'
import RecycleScroller from './RecycleScroller.vue'
import { useSSRSafe } from '../composables/useSSRSafe'
import { useItemValidation } from '../composables/useAsyncItems'
import type { DynamicScrollerProps, DynamicScrollerEmits, VirtualScrollerItem, ResizeEvent, VisibilityEvent, UpdateEvent } from '../types'

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
  startAtBottom = false,
  initialScrollPercent = null,
  stickToBottom = false,
  stickToBottomThreshold = 0.05,
  skeletonWhileScrolling = false,
} = defineProps<DynamicScrollerProps>()

const emit = defineEmits<DynamicScrollerEmits>()

defineSlots<{
  before: () => any
  default: (props: { item: VirtualScrollerItem | null | undefined; index: number; active: boolean; itemWithSize: any }) => any
  'empty-item': (props: { index: number }) => any
  skeleton: (props: { item: VirtualScrollerItem | null | undefined; index: number }) => any
  empty: () => any
  after: () => any
}>()

// Refs using useTemplateRef for better type safety
const scrollerRef = useTemplateRef<InstanceType<typeof RecycleScroller>>('scrollerRef')

// SSR safety
const { isClient } = useSSRSafe()

// Enhanced item validation
const { isItemValid, getItemKey } = useItemValidation()

// Shared ResizeObserver: single observer for all DynamicScrollerItem children.
// Batches all resize callbacks into a single microtask flush that feeds into
// the batched size updates, so N items resizing = 1 flush = 1 recomputation.
class SharedResizeObserver {
  private observer: ResizeObserver
  private callbacks = new Map<Element, (entry: ResizeObserverEntry) => void>()
  private pendingEntries: ResizeObserverEntry[] = []
  private flushScheduled = false

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
const sizeVersion = ref(0)
let _pendingFlush = false

// Track which keys had their sizes change in the last flush — used by
// itemsWithSize to do an O(changed) patch instead of O(N) full scan.
const _dirtyKeys = new Set<string | number>()
// When true, forces itemsWithSize to do a full rebuild (items list changed,
// not just sizes). Reset after each computed evaluation.
let _forceFullRebuild = false

const _flushSizeUpdates = () => {
  _pendingFlush = false
  let changed = false
  for (const [key, size] of _pendingSizeUpdates) {
    if (_sizeMap.get(key) !== size) {
      _sizeMap.set(key, size)
      _dirtyKeys.add(key)
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

// Memoized itemsWithSize: reuse wrapper objects when item reference and size
// haven't changed. This prevents the reactive cascade where a single size
// change creates N new wrapper objects, triggering RecycleScroller's items
// watcher and DynamicScrollerItem watchers for every visible item.
//
// Optimisation: when only sizes changed (not the items list), we use the
// _dirtyKeys set to patch only the changed entries in O(dirty) time, then
// splice them into the existing cached array, avoiding O(N) iteration.
interface ItemWithSize {
  id: string | number
  item: VirtualScrollerItem | null | undefined
  size: number
  isValid: boolean
}
let _cachedItemsWithSize: ItemWithSize[] = []
let _cachedKeyMap = new Map<string | number, ItemWithSize>()
// Index lookup: key -> position in _cachedItemsWithSize for O(1) patching
let _cachedKeyIndex = new Map<string | number, number>()

const itemsWithSize = computed(() => {
  // Read sizeVersion to establish reactivity dependency
  const _v = sizeVersion.value
  void _v

  // Fast path: only sizes changed (not the items list). Patch just the dirty
  // entries in O(dirty) time instead of scanning all N items.
  if (!_forceFullRebuild && _dirtyKeys.size > 0 && _cachedItemsWithSize.length === localItems.value.length && _cachedItemsWithSize.length > 0) {
    let patched = false
    for (const key of _dirtyKeys) {
      const idx = _cachedKeyIndex.get(key)
      if (idx === undefined) continue
      const prev = _cachedItemsWithSize[idx]
      if (!prev) continue
      const newSize = _sizeMap.get(key) || minItemSize
      if (prev.size !== newSize) {
        const entry = { id: prev.id, item: prev.item, size: newSize, isValid: prev.isValid }
        _cachedItemsWithSize[idx] = entry
        _cachedKeyMap.set(key, entry)
        patched = true
      }
    }
    _dirtyKeys.clear()
    if (patched) {
      // Return a new array reference so downstream watchers fire, but the
      // array is a shallow copy — only changed entries are new objects.
      _cachedItemsWithSize = _cachedItemsWithSize.slice()
    }
    return _cachedItemsWithSize
  }

  // Full rebuild path: items list changed or first computation
  _dirtyKeys.clear()
  _forceFullRebuild = false

  const result: ItemWithSize[] = []
  let anyChanged = false
  const seenKeys = new Set<string | number>()
  const newKeyIndex = new Map<string | number, number>()

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
      newKeyIndex.set(key, result.length)
      result.push(prev) // Reuse same object reference — no downstream triggers
    } else {
      const entry = { id: key, item, size, isValid: true }
      newKeyIndex.set(key, result.length)
      result.push(entry)
      _cachedKeyMap.set(key, entry) // Update in-place — only changed entries
      anyChanged = true
    }
  }

  // If nothing changed and same length, return the exact same array reference.
  // This prevents RecycleScroller's items watcher from firing, sizeData from
  // recomputing, and DynamicScrollerItem watchers from re-measuring.
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
  _cachedKeyIndex = newKeyIndex
  return result
})

// Methods
const updateItemSize = (key: string | number, size: number) => {
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

const resetSizes = () => {
  _sizeMap.clear()
  _pendingSizeUpdates.clear()
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
  // Mark for full rebuild since the items array itself changed
  _forceFullRebuild = true

  // Clean up sizes for items that no longer exist
  const validItems = (newItems || []).filter(item => item && isItemValid(item))
  const currentKeys = new Set(validItems.map(item => getItemKey(item)))
  let cleaned = false

  for (const key of _sizeMap.keys()) {
    if (!currentKeys.has(key)) {
      _sizeMap.delete(key)
      cleaned = true
    }
  }

  if (cleaned) {
    sizeVersion.value++
  }
})

// Lifecycle hooks
onMounted(() => {
  if (isClient.value) {
    // Initialize sizes for existing items
    let initialized = false
    localItems.value.forEach(item => {
      const key = getItemKey(item)
      if (!_sizeMap.has(key)) {
        _sizeMap.set(key, minItemSize)
        initialized = true
      }
    })
    if (initialized) {
      sizeVersion.value++
    }
  }
})

// Expose isAtBottom from inner RecycleScroller
const isAtBottom = computed(() => scrollerRef.value?.isAtBottom ?? false)

// Expose public methods
defineExpose({
  scrollerRef,
  isAtBottom,
  updateItemSize,
  getItemSize,
  removeItemSize,
  resetSizes,
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
    scrollerRef.value?.scrollToBottom()
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
  direction: computed(() => direction)
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
