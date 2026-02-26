<template>
  <div
    ref="containerRef"
    class="vue-grid-scroller"
    :class="[`direction-${direction}`]"
  >
    <slot v-if="!isMeasured" name="loading" />
    <RecycleScroller
      v-else
      ref="scrollerRef"
      :items="effectiveItems"
      :item-size="effectiveItemSize"
      :grid-items="computedColumns"
      :item-secondary-size="effectiveSecondarySize"
      :grid-view-size="gridViewSize"
      :grid-view-secondary-size="gridViewSecondarySize"
      :key-field="keyField"
      :direction="direction"
      :page-mode="pageMode"
      :prerender="prerender"
      :buffer="buffer"
      :emit-update="emitUpdate"
      :update-interval="updateInterval"
      :list-class="listClass"
      :item-class="itemClass"
      :list-tag="listTag"
      :item-tag="itemTag"
      :disable-transform="disableTransform"
      :skip-hover="skipHover"
      :start-at-bottom="startAtBottom"
      :initial-scroll-percent="initialScrollPercent"
      v-bind="$attrs"
      @resize="handleResize"
      @visible="handleVisible"
      @hidden="handleHidden"
      @update="handleUpdate"
      @scroll-start="handleScrollStart"
      @scroll-end="handleScrollEnd"
    >
      <template #default="{ item, index, active }">
        <slot
          :item="item"
          :index="index"
          :active="active"
          :column="index % computedColumns"
          :row="Math.floor(index / computedColumns)"
          :cell-width="cellWidth"
          :cell-height="cellHeight"
        />
      </template>
      <template #before><slot name="before" /></template>
      <template #after><slot name="after" /></template>
      <template #empty><slot name="empty" /></template>
    </RecycleScroller>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, useTemplateRef, toRef } from 'vue'
import RecycleScroller from './RecycleScroller.vue'
import { useGridLayout } from '../composables/useGridLayout'
import type { GridScrollerProps, GridScrollerEmits, GridScrollerSlotProps, ResizeEvent, VisibilityEvent, UpdateEvent } from '../types'

const {
  items,
  keyField = 'id',
  itemWidth,
  itemHeight,
  minColumns = 1,
  maxColumns = Infinity,
  columns = null,
  rowGap = 0,
  columnGap = 0,
  gap = 0,
  direction = 'vertical',
  pageMode = false,
  prerender = 0,
  buffer = 200,
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
} = defineProps<GridScrollerProps>()

const emit = defineEmits<GridScrollerEmits>()

defineSlots<{
  default: (props: GridScrollerSlotProps) => any
  before: () => any
  after: () => any
  empty: () => any
  loading: () => any
}>()

const containerRef = useTemplateRef<HTMLElement>('containerRef')
const scrollerRef = useTemplateRef<InstanceType<typeof RecycleScroller>>('scrollerRef')

// Resolve gaps: specific overrides shorthand
const resolvedRowGap = computed(() => rowGap || gap)
const resolvedColumnGap = computed(() => columnGap || gap)

const {
  isMeasured,
  computedColumns,
  effectiveItemSize,
  effectiveSecondarySize,
  cellWidth,
  cellHeight,
  gridViewSize,
  gridViewSecondarySize
} = useGridLayout({
  containerElement: containerRef,
  itemWidth: toRef(() => itemWidth),
  itemHeight: toRef(() => itemHeight),
  columnGap: resolvedColumnGap,
  rowGap: resolvedRowGap,
  minColumns: toRef(() => minColumns),
  maxColumns: toRef(() => maxColumns),
  columnsOverride: toRef(() => columns),
  direction: toRef(() => direction)
})

// Gate items on container measurement to prevent "all items visible" errors
// when RecycleScroller hasn't yet established its scroll container height
const effectiveItems = computed(() => isMeasured.value ? (items || []) : [])

// Emit when columns change
watch(computedColumns, (newCols, oldCols) => {
  if (oldCols !== undefined && newCols !== oldCols) {
    emit('columns-change', newCols)
  }
})

// Event handlers
const handleResize = (event: ResizeEvent) => emit('resize', event)
const handleVisible = (event: VisibilityEvent) => emit('visible', event)
const handleHidden = (event: VisibilityEvent) => emit('hidden', event)
const handleUpdate = (event: UpdateEvent) => emit('update', event)
const handleScrollStart = () => emit('scroll-start')
const handleScrollEnd = () => emit('scroll-end')

// Expose public methods
defineExpose({
  scrollerRef,
  isMeasured,
  computedColumns,
  scrollToItem: (index: number, alignment: 'start' | 'center' | 'end' | 'auto' = 'auto') => {
    scrollerRef.value?.scrollToItem(index, alignment)
  },
  scrollToPosition: (position: number) => {
    scrollerRef.value?.scrollToPosition(position)
  },
  scrollToBottom: () => {
    scrollerRef.value?.scrollToBottom()
  },
  scrollToPercent: (percent: number) => {
    scrollerRef.value?.scrollToPercent(percent)
  },
  scrollToCell: (row: number, col: number) => {
    const index = row * computedColumns.value + col
    scrollerRef.value?.scrollToItem(index)
  },
  updateVisibleItems: () => {
    scrollerRef.value?.updateVisibleItems()
  }
})
</script>

<style scoped>
.vue-grid-scroller {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.vue-grid-scroller :deep(.vue-recycle-scroller) {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}
</style>
