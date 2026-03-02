<script setup lang="ts">
import { ref, onMounted, useTemplateRef, toRef } from 'vue'
import { getData } from '../data'
import type { DataItem } from '../data'
import { useGridLayout } from 'vue-zscroller'

const list = ref<DataItem[]>([])
const gridItems = ref(6)
const scrollTo = ref(500)
const itemWidth = ref(100)
const itemHeight = ref(128)
const rowGap = ref(8)
const columnGap = ref(8)

const scroller = ref<any>(null)
const containerRef = useTemplateRef<HTMLElement>('containerRef')

const {
  isMeasured,
  effectiveItemSize,
  effectiveSecondarySize,
  gridViewSize,
  gridViewSecondarySize,
  cellWidth,
  cellHeight,
} = useGridLayout({
  containerElement: containerRef,
  itemWidth: toRef(() => itemWidth.value),
  itemHeight: toRef(() => itemHeight.value),
  columnGap: toRef(() => columnGap.value),
  rowGap: toRef(() => rowGap.value),
  minColumns: toRef(() => 2),
  maxColumns: toRef(() => 20),
  columnsOverride: toRef(() => gridItems.value),
  direction: toRef(() => 'vertical' as const),
})

onMounted(() => {
  list.value = getData(5000, false)
})
</script>

<template>
  <div class="wrapper">
    <div class="toolbar">
      <label>
        Columns
        <input
          v-model.number="gridItems"
          type="number"
          min="2"
          max="20"
          style="width: 40px"
        >
      </label>
      <input
        v-model.number="gridItems"
        type="range"
        min="2"
        max="20"
      >

      <label>
        Row gap <input v-model.number="rowGap" type="range" min="0" max="30"> {{ rowGap }}px
      </label>

      <label>
        Col gap <input v-model.number="columnGap" type="range" min="0" max="30"> {{ columnGap }}px
      </label>

      <span>
        <button @mousedown="scroller?.scrollToItem(scrollTo)">Scroll To: </button>
        <input
          v-model.number="scrollTo"
          type="number"
          min="0"
          :max="list.length - 1"
          style="width: 60px"
        >
      </span>
    </div>

    <div ref="containerRef" class="scroller-container">
      <RecycleScroller
        v-if="isMeasured"
        ref="scroller"
        class="scroller"
        :items="list"
        :item-size="effectiveItemSize"
        :grid-items="gridItems"
        :item-secondary-size="effectiveSecondarySize"
        :grid-view-size="gridViewSize"
        :grid-view-secondary-size="gridViewSecondarySize"
      >
        <template #default="{ item, index }">
          <div v-if="item" class="item" :style="{ width: cellWidth + 'px', height: cellHeight + 'px' }">
            <img
              :key="item.id"
              :src="item.value.avatar"
            >
            <div class="index">
              {{ index }}
            </div>
          </div>
        </template>
      </RecycleScroller>
    </div>
  </div>
</template>

<style scoped>
.wrapper {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.toolbar {
  flex: none;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.toolbar label {
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.scroller-container {
  flex: 1 1 0;
  min-height: 0;
  position: relative;
  overflow: hidden;
}

.scroller-container :deep(.vue-recycle-scroller) {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.scroller-container :deep(.vue-recycle-scroller__item-wrapper) {
  overflow: visible;
}

.scroller-container :deep(.hover) img {
  opacity: 0.5;
}

.item {
  position: relative;
  border-radius: 6px;
  overflow: hidden;
}

.index {
  position: absolute;
  top: 2px;
  left: 2px;
  padding: 2px 6px;
  border-radius: 4px;
  background-color: rgba(255, 255, 255, 0.85);
  color: black;
  font-size: 12px;
}

img {
  width: 100%;
  height: 100%;
  background: #eee;
  object-fit: cover;
}
</style>
