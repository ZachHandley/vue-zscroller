<template>
  <component
    :is="tag"
    ref="element"
    :class="['vue-dynamic-scroller-item', { 'vue-dynamic-scroller-item--inactive': !active }]"
    :style="itemStyle"
    v-bind="$attrs"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted, nextTick, watch, useTemplateRef, type ComputedRef } from 'vue'
import { useDynamicSize, type SharedResizeObserverLike } from '../composables/useDynamicSize'
import { useSSRSafe } from '../composables/useSSRSafe'
import type { DynamicScrollerItemProps, DynamicScrollerItemEmits } from '../types'
import { useItemValidation } from '../composables/useAsyncItems'

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
  default: () => any
}>()

interface DynamicScrollerContext {
  updateItemSize: (key: string | number, size: number) => void
  removeItemSize: (key: string | number) => void
  getItemSize: (key: string | number) => number
  sharedResizeObserver?: SharedResizeObserverLike
  direction?: ComputedRef<'vertical' | 'horizontal'>
}

// Refs using useTemplateRef for better type safety
const element = useTemplateRef<HTMLElement>('element')

// SSR safety
const { isClient } = useSSRSafe()

// Resolve shared dynamic-scroller context when available
const dynamicContext = inject<DynamicScrollerContext | null>('dynamicScrollerContext', null)

// Utilities for consistent key handling
const { getItemKey } = useItemValidation()

const itemKey = computed(() => getItemKey(item, `dynamic-item-${dataIndex}`))

// Dynamic size management with shared observer and direct size reporting
const dynamicSize = useDynamicSize({
  minItemSize,
  direction: dynamicContext?.direction?.value ?? 'vertical',
  sharedObserver: dynamicContext?.sharedResizeObserver ?? null,
  onSizeChange: (size: number) => {
    // Shared observer detected a size change -- report directly to parent.
    // This replaces the old watch(itemSize) watcher.
    if (active) {
      syncMeasuredSize(size)
    }
  }
})

// Destructure dynamic size methods and state
const {
  measureSize,
  updateSize,
  setElement,
  setCurrentSize
} = dynamicSize

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
    if (active && isClient.value) {
      nextTick(() => {
        updateSize()
      })
    }
  }
)

// Optional: deep-watch the entire item object for size changes.
// This is expensive and usually unnecessary if sizeDependencies is used.
if (watchData) {
  watch(
    () => item,
    () => {
      if (active && isClient.value) {
        nextTick(() => {
          updateSize()
        })
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
    const size = measureSize()
    if (size > minItemSize && dynamicContext) {
      dynamicContext.updateItemSize(itemKey.value, size)
    }
    setCurrentSize(size)
  }
})

// Cleanup on unmount
onUnmounted(() => {
  if (element.value) {
    setElement(null)
  }

  if (dynamicContext) {
    dynamicContext.removeItemSize(itemKey.value)
  }
})

// Expose public methods
defineExpose({
  measureSize,
  updateSize,
  getElement: () => element.value
})
</script>

<style scoped>
.vue-dynamic-scroller-item {
  box-sizing: border-box;
  contain: layout style paint;
}

.vue-dynamic-scroller-item--inactive {
  pointer-events: none;
  user-select: none;
}
</style>
