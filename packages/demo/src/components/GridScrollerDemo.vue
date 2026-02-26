<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getData } from '../data'
import type { DataItem } from '../data'
import { GridScroller } from 'vue-zscroller'

const list = ref<DataItem[]>([])
const itemWidth = ref(120)
const itemHeight = ref(120)
const rowGap = ref(8)
const columnGap = ref(8)
const minColumns = ref(1)
const maxColumns = ref(20)
const currentColumns = ref(0)
const scrollTo = ref(500)
const direction = ref<'vertical' | 'horizontal'>('vertical')

const scroller = ref<InstanceType<typeof GridScroller> | null>(null)

onMounted(() => {
  list.value = getData(10000, false)
})
</script>

<template>
  <div class="wrapper">
    <div class="toolbar">
      <label>
        Cell size
        <input v-model.number="itemWidth" type="number" min="50" max="300" style="width: 50px">
        x
        <input v-model.number="itemHeight" type="number" min="50" max="300" style="width: 50px">
      </label>

      <label>
        Row gap <input v-model.number="rowGap" type="range" min="0" max="30"> {{ rowGap }}px
      </label>

      <label>
        Col gap <input v-model.number="columnGap" type="range" min="0" max="30"> {{ columnGap }}px
      </label>

      <label>
        Min cols <input v-model.number="minColumns" type="number" min="1" max="20" style="width: 40px">
      </label>

      <label>
        Max cols <input v-model.number="maxColumns" type="number" min="1" max="50" style="width: 40px">
      </label>

      <label>
        <select v-model="direction">
          <option value="vertical">Vertical</option>
          <option value="horizontal">Horizontal</option>
        </select>
      </label>

      <span class="info">
        Cols: <strong>{{ currentColumns }}</strong> |
        Items: <strong>{{ list.length }}</strong>
      </span>

      <span>
        <button @click="scroller?.scrollToItem(scrollTo)">Scroll To:</button>
        <input
          v-model.number="scrollTo"
          type="number"
          min="0"
          :max="list.length - 1"
          style="width: 60px"
        >
      </span>
    </div>

    <GridScroller
      ref="scroller"
      class="scroller"
      :items="list"
      :item-width="itemWidth"
      :item-height="itemHeight"
      :row-gap="rowGap"
      :column-gap="columnGap"
      :min-columns="minColumns"
      :max-columns="maxColumns"
      :direction="direction"
      @columns-change="currentColumns = $event"
    >
      <template #default="{ item, index, column, row, cellWidth, cellHeight }">
        <div
          v-if="item"
          class="grid-cell"
          :style="{ width: cellWidth + 'px', height: cellHeight + 'px' }"
        >
          <img
            :key="item.id"
            :src="item.value.avatar"
          >
          <div class="cell-overlay">
            <span class="cell-index">{{ index }}</span>
            <span class="cell-pos">R{{ row }} C{{ column }}</span>
          </div>
        </div>
      </template>
    </GridScroller>
  </div>
</template>

<style scoped>
.wrapper,
.scroller {
  height: 100%;
}

.wrapper {
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

.info {
  font-size: 13px;
  color: #666;
}

.scroller {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.scroller :deep(.vue-recycle-scroller__item-wrapper) {
  overflow: visible;
}

.grid-cell {
  position: relative;
  border-radius: 6px;
  overflow: hidden;
  box-sizing: border-box;
}

.grid-cell img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: #eee;
  display: block;
}

.cell-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  padding: 4px 6px;
}

.cell-index {
  background: rgba(255, 255, 255, 0.85);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  color: #333;
}

.cell-pos {
  background: rgba(0, 0, 0, 0.5);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  color: white;
}
</style>
