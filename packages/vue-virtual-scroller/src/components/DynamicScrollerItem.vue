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

<script setup>
import { computed, onMounted, onUnmounted, nextTick, watch, useTemplateRef } from 'vue'
import { useDynamicSize } from '../composables/useDynamicSize'
import { useSSRSafe } from '../composables/useSSRSafe'

const props = withDefaults(defineProps(), {
  minItemSize: 50,
  watchData: false,
  tag: 'div',
  emitResize: false
})

const emit = defineEmits(['resize'])

// Refs using useTemplateRef for better type safety
const element = useTemplateRef('element')

// SSR safety
const { isClient } = useSSRSafe()

// Dynamic size management
const dynamicSize = useDynamicSize({
  minItemSize: props.minItemSize,
  sizeDependencies: computed(() => props.sizeDependencies || []),
  watchData: props.watchData,
  active: computed(() => props.active)
})

// Destructure dynamic size methods and state
const {
  itemSize,
  measureSize,
  updateSize,
  setElement
} = dynamicSize

// Computed styles
const itemStyle = computed(() => {
  if (!isClient.value) {
    return {
      minHeight: `${props.minItemSize || 50}px`
    }
  }

  return {
    minHeight: `${props.minItemSize || 50}px`
  }
})

// Watch for active changes to measure size
watch(() => props.active, (newActive) => {
  if (newActive && isClient.value) {
    nextTick(() => {
      updateSize()
    })
  }
}, { immediate: true })

// Watch for data changes if enabled
watch(() => props.item, () => {
  if (props.watchData && props.active && isClient.value) {
    nextTick(() => {
      updateSize()
    })
  }
}, { deep: true })

// Set element ref when mounted
onMounted(() => {
  if (element.value) {
    setElement(element.value)
  }
})

// Cleanup on unmount
onUnmounted(() => {
  if (element.value) {
    setElement(null)
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
  backface-visibility: hidden;
  contain: layout style paint;
}

.vue-dynamic-scroller-item--inactive {
  pointer-events: none;
  user-select: none;
}
</style>