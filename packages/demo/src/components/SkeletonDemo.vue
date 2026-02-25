<template>
  <div class="skeleton-demo">
    <h2>Skeleton Loading Demo</h2>
    <p>Items load progressively with skeleton placeholders</p>

    <div class="controls">
      <button @click="loadMore">Load 20 More Items</button>
      <button @click="reset">Reset</button>
      <span>{{ loadedItems.length }} items loaded</span>
    </div>

    <DynamicScroller
      ref="scroller"
      :items="displayItems"
      :min-item-size="60"
      key-field="id"
      class="scroller"
    >
      <template #default="{ item, index, active }">
        <DynamicScrollerItem
          :item="item"
          :active="active"
          :data-index="index"
          :size-dependencies="[item.message]"
        >
          <div v-if="item.loaded" class="item-content">
            <div class="avatar">{{ item.name?.charAt(0) || '?' }}</div>
            <div class="details">
              <div class="name">{{ item.name }}</div>
              <div class="message">{{ item.message }}</div>
            </div>
          </div>
        </DynamicScrollerItem>
      </template>

      <template #empty-item="{ index }">
        <div class="skeleton-item">
          <div class="vue-recycle-scroller__skeleton vue-recycle-scroller__skeleton-circle" />
          <div style="flex: 1;">
            <div class="vue-recycle-scroller__skeleton vue-recycle-scroller__skeleton-line" />
            <div class="vue-recycle-scroller__skeleton vue-recycle-scroller__skeleton-line" />
          </div>
        </div>
      </template>
    </DynamicScroller>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface SkeletonItem {
  id: number
  name?: string
  message?: string
  loaded: boolean
}

const loadedItems = ref<SkeletonItem[]>([])
let nextId = 0

const placeholderCount = 5
const displayItems = computed(() => {
  const items = [...loadedItems.value]
  // Add placeholder items at the end
  for (let i = 0; i < placeholderCount; i++) {
    items.push({ id: -(i + 1), loaded: false })
  }
  return items
})

const loadMore = () => {
  const newItems: SkeletonItem[] = []
  for (let i = 0; i < 20; i++) {
    newItems.push({
      id: nextId++,
      name: `User ${nextId}`,
      message: `This is message #${nextId} with some content that varies in length.${Math.random() > 0.5 ? ' And some extra text to make it longer.' : ''}`,
      loaded: true,
    })
  }
  loadedItems.value.push(...newItems)
}

const reset = () => {
  loadedItems.value = []
  nextId = 0
}

// Load initial batch
loadMore()
</script>

<style scoped>
.skeleton-demo {
  padding: 1rem;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.controls {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 1rem;
}

.controls button {
  padding: 6px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
}

.scroller {
  flex: 1 1 0;
  min-height: 0;
}

.item-content {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-bottom: 1px solid #eee;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #4a90d9;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  flex-shrink: 0;
}

.details {
  flex: 1;
}

.name {
  font-weight: 600;
  margin-bottom: 4px;
}

.message {
  color: #666;
  font-size: 14px;
}

.skeleton-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-bottom: 1px solid #eee;
}
</style>
