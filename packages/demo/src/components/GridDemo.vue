<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getData } from '../data'
import type { DataItem } from '../data'

const list = ref<DataItem[]>([])
const gridItems = ref(6)
const scrollTo = ref(500)
const itemSecondarySize = 100

const scroller = ref<any>(null)

const scrollerMinWidth = computed(() => `${gridItems.value * itemSecondarySize}px`)

onMounted(() => {
  list.value = getData(5000, false)
})
</script>

<template>
  <div class="wrapper">
    <div class="toolbar">
      <label>
        Grid items per row
        <input
          v-model.number="gridItems"
          type="number"
          min="2"
          max="20"
        >
      </label>
      <input
        v-model.number="gridItems"
        type="range"
        min="2"
        max="20"
      >
      <span>
        <button @mousedown="scroller?.scrollToItem(scrollTo)">Scroll To: </button>
        <input
          v-model.number="scrollTo"
          type="number"
          min="0"
          :max="list.length - 1"
        >
      </span>
    </div>

    <RecycleScroller
      ref="scroller"
      class="scroller"
      :style="{ minWidth: scrollerMinWidth }"
      :items="list"
      :item-size="128"
      :grid-items="gridItems"
      :item-secondary-size="itemSecondarySize"
    >
      <template #default="{ item, index }">
        <div class="item">
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
</template>

<style scoped>
.wrapper,
.scroller {
  height: 100%;
}

.wrapper {
  display: flex;
  flex-direction: column;
  overflow-x: auto;
}

.toolbar {
  flex: none;
}

.scroller {
  flex: 1 1 0;
  min-height: 0;
}

.scroller :deep(.vue-recycle-scroller__item-wrapper) {
  overflow: visible;
}

.scroller :deep(.hover) img {
  opacity: 0.5;
}

.item {
  position: relative;
  height: 100%;
}

.index {
  position: absolute;
  top: 2px;
  left: 2px;
  padding: 4px;
  border-radius: 4px;
  background-color: rgba(255, 255, 255, 0.85);
  color: black;
}

img {
  width: 100%;
  height: 100%;
  background: #eee;
  object-fit: cover;
}
</style>
