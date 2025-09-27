<template>
  <RecycleScroller
    ref="scrollerRef"
    :items="itemsWithSize"
    :min-item-size="minItemSize"
    :direction="direction"
    :key-field="keyField"
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
    v-bind="$attrs"
    @resize="handleScrollerResize"
    @visible="handleScrollerVisible"
    @update="handleScrollerUpdate"
    @scroll-start="handleScrollStart"
    @scroll-end="handleScrollEnd"
  >
    <template #default="{ item: itemWithSize, index, active }">
      <slot
        v-bind="{
          item: itemWithSize.item,
          index,
          active,
          itemWithSize
        }"
      />
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

<script setup>
import { computed, ref, watch, nextTick, onMounted, onUnmounted, provide, useTemplateRef } from 'vue'
import RecycleScroller from './RecycleScroller.vue'
import DynamicScrollerItem from './DynamicScrollerItem.vue'
import { useSSRSafe } from '../composables/useSSRSafe'

const props = withDefaults(defineProps(), {
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
  skipHover: false
})

const emit = defineEmits(['resize', 'visible', 'update', 'scroll-start', 'scroll-end'])

// Refs using useTemplateRef for better type safety
const scrollerRef = useTemplateRef('scrollerRef')

// SSR safety
const { isClient } = useSSRSafe()

// State
const items = ref(props.items)
const sizeStore = ref(new Map())

// Computed
const itemsWithSize = computed(() => {
  return items.value.map(item => {
    const key = item[props.keyField] || item.id
    const size = sizeStore.value.get(key) || props.minItemSize

    return {
      ...item,
      size
    }
  })
})

// Methods
const updateItemSize = (key, size) => {
  const currentSize = sizeStore.value.get(key)

  if (currentSize !== size) {
    sizeStore.value.set(key, size)

    if (props.emitUpdate) {
      emit('resize', size)
    }

    // Trigger scroller update
    nextTick(() => {
      if (scrollerRef.value) {
        scrollerRef.value.updateVisibleItems()
      }
    })
  }
}

const getItemSize = (key) => {
  return sizeStore.value.get(key) || props.minItemSize
}

const removeItemSize = (key) => {
  sizeStore.value.delete(key)
}

const resetSizes = () => {
  sizeStore.value.clear()
}

// Event handlers
const handleScrollerResize = (event) => {
  emit('resize', event)
}

const handleScrollerVisible = (event) => {
  emit('visible', event)
}

const handleScrollerUpdate = (event) => {
  emit('update', event)
}

const handleScrollStart = () => {
  emit('scroll-start')
}

const handleScrollEnd = () => {
  emit('scroll-end')
}

// Watch for items changes
watch(() => props.items, (newItems) => {
  items.value = newItems

  // Clean up sizes for items that no longer exist
  const currentKeys = new Set(newItems.map(item => item[props.keyField] || item.id))
  const keysToDelete = []

  sizeStore.value.forEach((_, key) => {
    if (!currentKeys.has(key)) {
      keysToDelete.push(key.toString())
    }
  })

  keysToDelete.forEach(key => {
    sizeStore.value.delete(key)
  })
}, { deep: true })

// Lifecycle hooks
onMounted(() => {
  if (isClient.value) {
    // Initialize sizes for existing items
    items.value.forEach(item => {
      const key = item[props.keyField] || item.id
      if (!sizeStore.value.has(key)) {
        sizeStore.value.set(key, props.minItemSize)
      }
    })
  }
})

// Expose public methods
defineExpose({
  scrollerRef,
  updateItemSize,
  getItemSize,
  removeItemSize,
  resetSizes,
  scrollToItem: (index, alignment) => {
    scrollerRef.value?.scrollToItem(index, alignment)
  },
  scrollToPosition: (position) => {
    scrollerRef.value?.scrollToPosition(position)
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
  removeItemSize
})
</script>

<style scoped>
/* DynamicScroller inherits styles from RecycleScroller */
</style>