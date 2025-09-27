<template>
  <div
    ref="scrollElement"
    class="vue-recycle-scroller"
    :class="{
      ready,
      'page-mode': pageMode,
      [`direction-${direction}`]: true,
      [listClass]: !!listClass
    }"
    @scroll.passive="handleScroll"
  >
    <div
      v-if="$slots.before"
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
      <div
        v-for="item in visibleItems"
        :key="getItemKey(item)"
        :ref="el => registerItemRef(getItemKey(item), el, { item, index: getItemIndex(item) })"
        :data-index="getItemIndex(item)"
        :style="getItemStyle(item)"
        class="vue-recycle-scroller__item-view"
        :class="[
          itemClass,
          {
            hover: !skipHover && hoverKey === getItemKey(item)
          }
        ]"
        @mouseenter="!skipHover && (hoverKey = getItemKey(item))"
        @mouseleave="!skipHover && (hoverKey = null)"
      >
        <slot
          :item="item"
          :index="getItemIndex(item)"
          :active="isItemActive(item)"
        />
      </div>

      <slot name="empty" />
    </component>

    <div
      v-if="$slots.after"
      ref="afterElement"
      class="vue-recycle-scroller__slot"
    >
      <slot name="after" />
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted, nextTick, watch, useTemplateRef, useId } from 'vue'
import { useVirtualScrollCore } from '../composables/useVirtualScrollCore'
import { useSSRSafe } from '../composables/useSSRSafe'
import { useSSRSafeEnhanced } from '../composables/useSSRSafeEnhanced'
import { useSlotRefManager } from '../composables/useSlotRefManager'
import { useVirtualScrollPerformance } from '../composables/useVirtualScrollPerformance'
import { useScrollLock } from '../composables/useScrollLock'

const props = withDefaults(defineProps(), {
  keyField: 'id',
  direction: 'vertical',
  itemSize: null,
  minItemSize: 50,
  gridItems: 1,
  itemSecondarySize: undefined,
  sizeField: 'size',
  typeField: 'type',
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
  skipHover: false
})

const emit = defineEmits(['resize', 'visible', 'update', 'scroll-start', 'scroll-end'])

// Refs using useTemplateRef for better type safety
const scrollElement = useTemplateRef('scrollElement')
const wrapperElement = useTemplateRef('wrapperElement')
const beforeElement = useTemplateRef('beforeElement')
const afterElement = useTemplateRef('afterElement')
const hoverKey = ref(null)

// Generate stable component ID
const componentId = useId()

// Advanced slot ref management with automatic memory cleanup
const slotManager = useSlotRefManager({
  enableWeakMap: true,
  cleanupDelay: 100,
  maxSize: 1000
})

// Performance optimizations with @vueuse/core
const performance = useVirtualScrollPerformance({
  enableScrollDebounce: true,
  scrollDebounceMs: 16,
  enableRequestIdleCallback: true,
  resizeObserverThrottleMs: 100
})

// Scroll lock for better performance during intensive operations
const isLocked = useScrollLock(scrollElement)

// Lock scroll during intensive updates
const lockScrollDuringUpdate = () => {
  isLocked.value = true
  setTimeout(() => {
    isLocked.value = false
  }, 100)
}

// Register item refs with slot context for better memory management
const registerItemRef = (key, element, slotContext) => {
  slotManager.registerSlotRef(key, element, slotContext)
}

// State
const ready = ref(false)
const items = ref(props.items)

// Core virtual scroll functionality
const virtualScroll = useVirtualScrollCore({
  items,
  itemSize: computed(() => props.itemSize),
  minItemSize: computed(() => props.minItemSize),
  direction: computed(() => props.direction),
  buffer: computed(() => props.buffer),
  keyField: computed(() => props.keyField),
  sizeField: computed(() => props.sizeField),
  typeField: computed(() => props.typeField),
  pageMode: computed(() => props.pageMode),
  prerender: computed(() => props.prerender),
  gridItems: computed(() => props.gridItems),
  itemSecondarySize: computed(() => props.itemSecondarySize),
  disableTransform: computed(() => props.disableTransform)
})

// Destructure virtual scroll methods and state
const {
  totalSize,
  visibleItems,
  startIndex,
  endIndex,
  scrollPosition,
  isScrolling,
  isClient,
  containerSize,
  updateVisibleItems,
  handleScroll: virtualHandleScroll,
  handleResize: virtualHandleResize,
  scrollToItem: virtualScrollToItem,
  scrollToPosition: virtualScrollToPosition,
  reset
} = virtualScroll

// Enhanced SSR safety with @vueuse/core patterns
const { isServer } = useSSRSafe()
const { useSSRSafeViewport, useSSRSafeRaf } = useSSRSafeEnhanced()
const { viewportWidth, viewportHeight } = useSSRSafeViewport()
const { requestRaf, cancelRaf } = useSSRSafeRaf()

// Computed styles
const wrapperStyle = computed(() => {
  const sizeKey = props.direction === 'vertical' ? 'minHeight' : 'minWidth'
  return {
    [sizeKey]: `${totalSize.value}px`
  }
})

// Methods
const getItemKey = (item) => {
  const index = items.value.findIndex(i => i === item)
  return item[props.keyField] || item.id || `${componentId}-item-${index}`
}

const getItemIndex = (item) => {
  return items.value.findIndex(i => getItemKey(i) === getItemKey(item))
}

const isItemActive = (item) => {
  const index = getItemIndex(item)
  return index >= startIndex.value && index <= endIndex.value
}

const getItemStyle = (item) => {
  if (!ready.value) {
    return {
      visibility: 'hidden'
    }
  }

  const index = getItemIndex(item)
  let position = 0

  // Calculate position based on item sizes
  if (props.itemSize !== null) {
    position = index * props.itemSize
  } else {
    for (let i = 0; i < index; i++) {
      const itemSize = items.value[i][props.sizeField] || props.minItemSize
      position += itemSize
    }
  }

  const style = {
    visibility: isItemActive(item) ? 'visible' : 'hidden'
  }

  if (props.disableTransform) {
    const positionKey = props.direction === 'vertical' ? 'top' : 'left'
    style[positionKey] = `${position}px`
    style.willChange = 'unset'
  } else {
    const transformKey = props.direction === 'vertical' ? 'translateY' : 'translateX'
    const offsetKey = props.direction === 'vertical' ? 'translateX' : 'translateY'
    style.transform = `${transformKey}(${position}px) ${offsetKey}(0px)`
  }

  // Grid layout support
  if (props.gridItems > 1) {
    const gridIndex = index % props.gridItems
    const secondarySize = props.itemSecondarySize || props.itemSize || props.minItemSize

    if (props.direction === 'vertical') {
      style.width = `${secondarySize}px`
      style.height = `${props.itemSize || props.minItemSize}px`
      style.position = 'absolute'
      style.left = `${gridIndex * secondarySize}px`
    } else {
      style.width = `${props.itemSize || props.minItemSize}px`
      style.height = `${secondarySize}px`
      style.position = 'absolute'
      style.top = `${gridIndex * secondarySize}px`
    }
  }

  return style
}

const handleScroll = (event) => {
  // Use performance-optimized scroll handler
  performance.handleScroll(event)

  // Use high-priority scheduling for critical updates
  performance.scheduleUpdate(() => {
    virtualHandleScroll(event)

    // Emit scroll events
    if (props.emitUpdate) {
      emit('update', {
        startIndex: startIndex.value,
        endIndex: endIndex.value,
        visibleStartIndex: startIndex.value,
        visibleEndIndex: endIndex.value
      })
    }
  }, 'high')
}

const handleResize = (event) => {
  // Use performance-optimized resize handler
  if (event) {
    performance.handleResize(event)
  }

  if (scrollElement.value) {
    const rect = scrollElement.value.getBoundingClientRect()

    // Lock scroll during resize to prevent layout thrashing
    lockScrollDuringUpdate()

    // Use high-priority scheduling for resize updates
    performance.scheduleUpdate(() => {
      virtualHandleResize({
        width: rect.width,
        height: rect.height
      })
    }, 'high')
  }
}

// Public methods exposed via ref
const scrollToItem = (index, alignment) => {
  virtualScrollToItem(index, alignment)
}

const scrollToPosition = (position) => {
  virtualScrollToPosition(position)
}

// Watch for items changes
watch(() => props.items, (newItems) => {
  items.value = newItems
  nextTick(() => {
    updateVisibleItems()
  })
}, { deep: true })

// Lifecycle hooks
onMounted(() => {
  if (isClient.value) {
    ready.value = true
    nextTick(() => {
      updateVisibleItems()
      handleResize()
    })
  }
})

onUnmounted(() => {
  reset()
  performance.cancelScroll()
})

// Expose public methods with performance monitoring
defineExpose({
  scrollToItem,
  scrollToPosition,
  updateVisibleItems,
  reset,
  // Performance monitoring methods
  getPerformanceStats: performance.getPerformanceStats,
  resetPerformanceMetrics: performance.resetMetrics,
  getSlotStats: slotManager.getSlotStats,
  cleanupSlots: slotManager.cleanupAllSlots
})
</script>

<style scoped>
.vue-recycle-scroller {
  position: relative;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}

.vue-recycle-scroller.direction-horizontal {
  overflow-x: auto;
  overflow-y: hidden;
}

.vue-recycle-scroller.direction-vertical {
  overflow-x: hidden;
  overflow-y: auto;
}

.vue-recycle-scroller__slot {
  flex-shrink: 0;
}

.vue-recycle-scroller__item-wrapper {
  position: relative;
  box-sizing: border-box;
}

.vue-recycle-scroller__item-view {
  position: absolute;
  box-sizing: border-box;
  backface-visibility: hidden;
  contain: layout style paint;
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
  overflow-x: auto;
  overflow-y: hidden;
}
</style>