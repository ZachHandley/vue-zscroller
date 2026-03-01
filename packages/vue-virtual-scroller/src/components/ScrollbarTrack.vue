<script setup lang="ts">
import { computed } from 'vue'

const {
  thumbSize,
  thumbPosition,
  trackSize,
  isVisible,
  isDragging,
  direction,
  width = 12,
  thumbColor = 'rgba(128, 128, 128, 0.5)',
  trackColor = 'transparent',
  thumbBorderRadius = '6px',
  offset = 0,
} = defineProps<{
  thumbSize: number
  thumbPosition: number
  trackSize: number
  isVisible: boolean
  isDragging: boolean
  direction: 'vertical' | 'horizontal'
  width?: number | undefined
  thumbColor?: string | undefined
  trackColor?: string | undefined
  thumbBorderRadius?: string | undefined
  /** Inset offset in px from the edge (right for vertical, bottom for horizontal). Default: 0 */
  offset?: number | undefined
}>()

defineEmits<{
  (e: 'thumb-pointerdown', event: PointerEvent): void
  (e: 'track-pointerdown', event: PointerEvent): void
}>()

const isVertical = computed(() => direction === 'vertical')

const scrollPercent = computed(() => {
  const availableTrack = trackSize - thumbSize
  if (availableTrack <= 0) return 0
  return Math.round((thumbPosition / availableTrack) * 100)
})

const trackContainerStyle = computed(() => {
  if (isVertical.value) {
    return {
      position: 'absolute' as const,
      top: 0,
      right: `${offset}px`,
      bottom: 0,
      width: `${width}px`,
      zIndex: 10,
      pointerEvents: 'none' as const,
    }
  }
  return {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: `${offset}px`,
    height: `${width}px`,
    zIndex: 10,
    pointerEvents: 'none' as const,
  }
})

const trackStyle = computed(() => ({
  width: '100%',
  height: '100%',
  backgroundColor: trackColor,
  pointerEvents: 'auto' as const,
}))

const thumbStyle = computed(() => {
  const narrowedWidth = Math.max(width - 4, 4)

  if (isVertical.value) {
    return {
      position: 'absolute' as const,
      top: 0,
      left: '50%',
      width: `${narrowedWidth}px`,
      height: `${thumbSize}px`,
      transform: `translateX(-50%) translateY(${thumbPosition}px)`,
      backgroundColor: thumbColor,
      borderRadius: thumbBorderRadius,
      cursor: 'pointer',
      transition: isDragging ? 'none' : 'opacity 0.15s',
      pointerEvents: 'auto' as const,
    }
  }

  return {
    position: 'absolute' as const,
    left: 0,
    top: '50%',
    height: `${narrowedWidth}px`,
    width: `${thumbSize}px`,
    transform: `translateY(-50%) translateX(${thumbPosition}px)`,
    backgroundColor: thumbColor,
    borderRadius: thumbBorderRadius,
    cursor: 'pointer',
    transition: isDragging ? 'none' : 'opacity 0.15s',
    pointerEvents: 'auto' as const,
  }
})
</script>

<template>
  <div
    class="vue-scroller-scrollbar"
    :class="{
      'vue-scroller-scrollbar--visible': isVisible || isDragging,
      'vue-scroller-scrollbar--dragging': isDragging,
      'vue-scroller-scrollbar--horizontal': direction === 'horizontal',
      'vue-scroller-scrollbar--vertical': direction === 'vertical',
    }"
    :style="trackContainerStyle"
  >
    <div
      class="vue-scroller-scrollbar__track"
      :style="trackStyle"
      @pointerdown="$emit('track-pointerdown', $event)"
    >
      <div
        class="vue-scroller-scrollbar__thumb"
        :style="thumbStyle"
        role="scrollbar"
        :aria-valuenow="scrollPercent"
        aria-valuemin="0"
        aria-valuemax="100"
        tabindex="-1"
        @pointerdown.stop="$emit('thumb-pointerdown', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
.vue-scroller-scrollbar {
  opacity: 0;
  transition: opacity 0.3s;
}

.vue-scroller-scrollbar--visible,
.vue-scroller-scrollbar--dragging {
  opacity: 1;
}

.vue-scroller-scrollbar--dragging .vue-scroller-scrollbar__thumb {
  filter: brightness(0.8);
}

.vue-scroller-scrollbar:hover {
  opacity: 1;
}
</style>
