<template>
  <component
    :is="tag"
    ref="element"
    :class="['vue-dynamic-scroller-item', { 'vue-dynamic-scroller-item--inactive': !active }]"
    :style="itemStyle"
    v-bind="$attrs"
  >
    <slot :triggerResize="triggerResize" />
  </component>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted, nextTick, provide, watch, useTemplateRef, type ComputedRef } from 'vue'
import { useDynamicSize, type SharedResizeObserverLike } from '../composables/useDynamicSize'
import { useSSRSafe } from '../composables/useSSRSafe'
import type { DynamicScrollerItemProps, DynamicScrollerItemEmits } from '../types'
import { useItemValidation } from '../composables/useAsyncItems'
import { DynamicScrollerItemResizeKey } from '../composables/useDynamicScrollerItem'

const {
  minItemSize = 50,
  watchData = false,
  tag = 'div',
  emitResize = false,
  sizeDependencies = [],
  active = false,
  item = { size: 0 },
  dataIndex = 0,
} = defineProps<DynamicScrollerItemProps>()

const emit = defineEmits<DynamicScrollerItemEmits>()

defineSlots<{
  default: (props: { triggerResize: () => Promise<void> }) => any
}>()

interface DynamicScrollerContext {
  updateItemSize: (key: string | number, size: number) => void
  removeItemSize: (key: string | number) => void
  getItemSize: (key: string | number) => number
  sharedResizeObserver?: SharedResizeObserverLike
  direction?: ComputedRef<'vertical' | 'horizontal'>
  keyField?: string
  registerItem?: (key: string | number, instance: { updateSize: () => void }) => void
  unregisterItem?: (key: string | number) => void
}

// Refs using useTemplateRef for better type safety
const element = useTemplateRef<HTMLElement>('element')

// SSR safety
const { isClient } = useSSRSafe()

// Resolve shared dynamic-scroller context when available
const dynamicContext = inject<DynamicScrollerContext | null>('dynamicScrollerContext', null)

// Utilities for consistent key handling — use keyField from parent DynamicScroller
// so item keys match between DynamicScrollerItem and DynamicScroller's size map.
const { getItemKey } = useItemValidation(dynamicContext?.keyField ?? 'id')

const itemKey = computed(() => getItemKey(item, `dynamic-item-${dataIndex}`))

// Dynamic size management with shared observer and direct size reporting
const dynamicSize = useDynamicSize({
  minItemSize,
  direction: dynamicContext?.direction?.value ?? 'vertical',
  sharedObserver: dynamicContext?.sharedResizeObserver ?? null,
  onSizeChange: (size: number) => {
    // Shared observer detected a size change -- report directly to parent.
    // Always sync regardless of active state so off-screen items that resize
    // (async images, read receipts) still update the size map.
    syncMeasuredSize(size)
  }
})

// Destructure dynamic size methods and state
const {
  measureSize,
  updateSize,
  setElement,
  setCurrentSize,
  pauseObserver,
  resumeObserver,
} = dynamicSize

// Imperative resize trigger for slot content and deeply nested descendants
const triggerResize = async (): Promise<void> => {
  await nextTick()
  updateSize()
}

// Provide triggerResize for deeply nested descendants via inject
provide(DynamicScrollerItemResizeKey, triggerResize)

// Debounced transitionend handler — remeasure after CSS transitions settle.
// transitionend bubbles from descendants, so one listener catches all transitions
// on slot content (e.g. transition-all on a message bubble wrapper).
let transitionEndTimer: ReturnType<typeof setTimeout> | null = null

const handleTransitionEnd = () => {
  if (transitionEndTimer) clearTimeout(transitionEndTimer)
  transitionEndTimer = setTimeout(() => {
    updateSize()
  }, 30)
}

// Tracks whether sizeDependencies changed while inactive.
// The active watcher always does a double measurement pass (nextTick + RAF),
// but this flag lets us log or conditionally extend the measurement window.
let pendingRemeasure = false

// Computed styles — use correct axis based on direction from parent context
const itemStyle = computed(() => {
  const dir = dynamicContext?.direction?.value ?? 'vertical'
  const prop = dir === 'horizontal' ? 'minWidth' : 'minHeight'
  return { [prop]: `${minItemSize || 50}px` }
})

const syncMeasuredSize = (sizeOverride?: number) => {
  const resolvedSize = Math.max(sizeOverride ?? measureSize(), minItemSize)

  if (dynamicContext) {
    dynamicContext.updateItemSize(itemKey.value, resolvedSize)
  }

  if (emitResize) {
    emit('resize', resolvedSize)
  }
}

// Consolidated watcher: handle activation and item reference changes.
// updateSize() already reports via onSizeChange → syncMeasuredSize, so
// we don't call syncMeasuredSize separately (avoids double measurement).
watch(
  () => [active, item] as const,
  ([newActive, newItem], [oldActive, oldItem]) => {
    if (!isClient.value) return
    if (newActive && (!oldActive || newItem !== oldItem)) {
      nextTick(() => {
        updateSize()
      })
    }
  }
)

// Manage ResizeObserver registration based on active state.
// When inactive, unobserve to prevent unnecessary resize callbacks
// for off-screen items. Re-observe and measure when becoming active.
watch(
  () => active,
  (newActive, oldActive) => {
    if (!isClient.value || !element.value) return
    if (newActive && !oldActive) {
      resumeObserver()
      const needsExtraPass = pendingRemeasure
      pendingRemeasure = false
      // Measure after DOM update. If sizeDeps changed while inactive,
      // also measure after browser layout (RAF) to catch late renders.
      nextTick(() => {
        updateSize()
        if (needsExtraPass) {
          requestAnimationFrame(() => {
            updateSize()
          })
        }
      })
    } else if (!newActive && oldActive) {
      pauseObserver()
    }
  }
)

// Watch sizeDependencies for content-driven size changes.
// This fires whenever any value in the sizeDependencies array changes,
// triggering a re-measurement. Independent of watchData.
// Uses JSON.stringify to compare values rather than array references,
// preventing spurious firings when the parent re-renders with a new
// inline array (e.g. :size-dependencies="[item.message]").
watch(
  () => {
    const deps = sizeDependencies
    if (!deps || deps.length === 0) return ''
    return JSON.stringify(deps)
  },
  () => {
    if (!isClient.value) return
    if (active) {
      nextTick(() => {
        updateSize()
      })
    } else {
      // Deps changed while inactive — flag for remeasure when reactivated.
      // The ResizeObserver is paused so we can't measure now.
      pendingRemeasure = true
    }
  }
)

// Optional: deep-watch the entire item object for size changes.
// This is expensive and usually unnecessary if sizeDependencies is used.
if (watchData) {
  watch(
    () => item,
    () => {
      if (!isClient.value) return
      if (active) {
        nextTick(() => {
          updateSize()
        })
      } else {
        pendingRemeasure = true
      }
    },
    { deep: true }
  )
}

// Set element ref when mounted — setElement registers with shared ResizeObserver,
// which will fire initial callback. Do a direct initial measurement to avoid
// waiting for the async observer callback.
onMounted(() => {
  if (element.value) {
    setElement(element.value)
    // Synchronous measure — may return minItemSize if browser hasn't laid out yet.
    // Report it to the parent but do NOT cache it via setCurrentSize(), so the
    // ResizeObserver's first callback (which fires after layout) isn't suppressed
    // by hasSizeChanged() returning false.
    const size = measureSize()
    if (size > minItemSize && dynamicContext) {
      dynamicContext.updateItemSize(itemKey.value, size)
    }
    // RAF remeasure catches items that mounted before browser layout pass
    // (all initially visible items mount in the same tick before layout).
    requestAnimationFrame(() => {
      updateSize()
    })
    // Listen for transitionend to remeasure after CSS transitions on slot content
    element.value.addEventListener('transitionend', handleTransitionEnd)
  }
  // Register with parent for invalidateItem()
  dynamicContext?.registerItem?.(itemKey.value, { updateSize })
})

// Cleanup on unmount
onUnmounted(() => {
  if (element.value) {
    element.value.removeEventListener('transitionend', handleTransitionEnd)
    setElement(null)
  }

  if (transitionEndTimer) {
    clearTimeout(transitionEndTimer)
    transitionEndTimer = null
  }

  if (dynamicContext) {
    dynamicContext.removeItemSize(itemKey.value)
    dynamicContext.unregisterItem?.(itemKey.value)
  }
})

// Re-register when item key changes (recycled views).
// When RecycleScroller reuses a view for a different item, onMounted doesn't
// fire again — we must re-register the DOM element with the SharedResizeObserver
// so callbacks map to the correct item key.
watch(itemKey, (newKey, oldKey) => {
  if (oldKey !== undefined && oldKey !== newKey) {
    dynamicContext?.unregisterItem?.(oldKey)
    // Reset cached size so hasSizeChanged() doesn't swallow the new item's
    // measurement when it's within 0.5px of the old item's size.
    setCurrentSize(minItemSize)
  }
  dynamicContext?.registerItem?.(newKey, { updateSize })
  // Re-register element with observer so callbacks map to the correct item
  if (element.value) {
    setElement(element.value)
  }
})

// Expose public methods
defineExpose({
  measureSize,
  updateSize,
  triggerResize,
  getElement: () => element.value
})
</script>

<style scoped>
.vue-dynamic-scroller-item {
  box-sizing: border-box;
  contain: style;
}

.vue-dynamic-scroller-item--inactive {
  pointer-events: none;
  user-select: none;
}
</style>
