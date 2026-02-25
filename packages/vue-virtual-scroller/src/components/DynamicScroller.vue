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
    :start-at-bottom="startAtBottom"
    :initial-scroll-percent="initialScrollPercent"
    :stick-to-bottom="stickToBottom"
    :stick-to-bottom-threshold="stickToBottomThreshold"
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

interface Props extends DynamicScrollerProps {}

const props = withDefaults(defineProps<Props>(), {
  keyField: 'id',
  direction: 'vertical',
  pageMode: false,
  prerender: 0,
  buffer: 200,
  emitUpdate: false,
  updateInterval: 0,
  listClass: '',
  itemClass: '',
  listTag: 'div',
  itemTag: 'div',
  disableTransform: false,
  skipHover: false,
  sizeField: 'size',
  startAtBottom: false,
  initialScrollPercent: null,
  stickToBottom: false,
  stickToBottomThreshold: 50
})

const emit = defineEmits<DynamicScrollerEmits>()

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
const items = ref<VirtualScrollerItem[]>(props.items || [])

// Batched size store: plain Map (non-reactive) + version counter for coalesced updates.
// Instead of ref<Map> where each .set() triggers reactivity (causing O(N*n) cascade
// when N visible items all measure on mount), we batch all size updates within a
// microtask and trigger a single recomputation via the version counter.
const _sizeMap = new Map<string | number, number>()
const _pendingSizeUpdates = new Map<string | number, number>()
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

  for (const item of items.value) {
    if (!isItemValid(item)) {
      const id = item?.[props.keyField] ?? item?.id ?? `invalid-${result.length}`
      result.push({
        id: id as string | number,
        item,
        size: props.minItemSize,
        isValid: false
      })
      anyChanged = true
      continue
    }

    const key = getItemKey(item)
    const size = _sizeMap.get(key) || props.minItemSize
    const prev = _cachedKeyMap.get(key)

    if (prev && prev.item === item && prev.size === size) {
      result.push(prev) // Reuse same object reference — no downstream triggers
    } else {
      result.push({ id: key, item, size, isValid: true })
      anyChanged = true
    }
  }

  // If nothing changed and same length, return the exact same array reference.
  // This prevents RecycleScroller's items watcher from firing, sizeData from
  // recomputing, and DynamicScrollerItem watchers from re-measuring.
  if (!anyChanged && result.length === _cachedItemsWithSize.length) {
    return _cachedItemsWithSize
  }

  // Rebuild cache
  _cachedItemsWithSize = result
  _cachedKeyMap = new Map()
  for (const entry of result) {
    if (entry.id != null) _cachedKeyMap.set(entry.id, entry)
  }
  return result
})

// Methods
const updateItemSize = (key: string | number, size: number) => {
  if (_sizeMap.get(key) === size) return
  _pendingSizeUpdates.set(key, size)
  if (!_pendingFlush) {
    _pendingFlush = true
    queueMicrotask(_flushSizeUpdates)
  }
}

const getItemSize = (key: string | number): number => {
  return _sizeMap.get(key) || props.minItemSize
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
watch(() => props.items, (newItems: VirtualScrollerItem[] | null | undefined) => {
  items.value = newItems || []

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
    items.value.forEach(item => {
      const key = getItemKey(item)
      if (!_sizeMap.has(key)) {
        _sizeMap.set(key, props.minItemSize)
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
  direction: computed(() => props.direction)
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
