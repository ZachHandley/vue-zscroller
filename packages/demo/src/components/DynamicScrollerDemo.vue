<template>
  <div class="dynamic-scroller-demo">
    <div class="toolbar">
      <input
        v-model="search"
        placeholder="Filter..."
      >
      <span>({{ updateParts.viewStartIdx }} - [{{ updateParts.visibleStartIdx }} - {{ updateParts.visibleEndIdx }}] - {{ updateParts.viewEndIdx }})</span>
    </div>

    <DynamicScroller
      :items="filteredItems"
      :min-item-size="54"
      :emit-update="true"
      skeleton-while-scrolling
      class="scroller"
      @resize="onResize"
      @update="onUpdate"
    >
      <template #before>
        <div class="notice">
          The message heights are unknown.
        </div>
      </template>
      <template #after>
        <div class="notice">
          You have reached the end.
        </div>
      </template>
      <template #default="{ item, index, active }">
        <DynamicScrollerItem
          v-if="item"
          :item="item"
          :active="active"
          :size-dependencies="[
            item.message,
          ]"
          :data-index="index"
          :data-active="active"
          :title="`Click to change message ${index}`"
          class="message"
          @click="changeMessage(item as DemoItem)"
        >
          <div class="avatar">
            <img
              :key="item.avatar"
              :src="item.avatar"
              alt="avatar"
              class="image"
              width="32"
              height="32"
            >
          </div>
          <div class="text">
            {{ item.message }}
          </div>
          <div class="index">
            <span>{{ item.id }} (id)</span>
            <span>{{ index }} (index)</span>
          </div>
        </DynamicScrollerItem>
      </template>
    </DynamicScroller>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { generateMessage, type MessageItem } from '../data'

interface DemoItem extends MessageItem {
  id: number
}

interface UpdateParts {
  viewStartIdx: number
  viewEndIdx: number
  visibleStartIdx: number
  visibleEndIdx: number
}

const items = Array.from({ length: 10000 }, (_, i) => ({
  id: i,
  ...generateMessage()
}))

const search = ref('')
const updateParts = ref<UpdateParts>({
  viewStartIdx: 0,
  viewEndIdx: 0,
  visibleStartIdx: 0,
  visibleEndIdx: 0
})

const filteredItems = computed(() => {
  if (!search.value) return items
  const lowerCaseSearch = search.value.toLowerCase()
  return items.filter(i => i.message.toLowerCase().includes(lowerCaseSearch))
})

function changeMessage(message: DemoItem) {
  Object.assign(message, generateMessage())
}

function onResize() {
  console.log('resize')
}

function onUpdate(event: { startIndex: number, endIndex: number, visibleStartIndex: number, visibleEndIndex: number }) {
  updateParts.value = {
    viewStartIdx: event.startIndex,
    viewEndIdx: event.endIndex,
    visibleStartIdx: event.visibleStartIndex,
    visibleEndIdx: event.visibleEndIndex
  }
}
</script>

<style scoped>
.dynamic-scroller-demo {
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.scroller {
  flex: 1 1 0;
  min-height: 0;
}

.scroller {
  border: solid 1px #42b983;
}

.toolbar {
  flex: auto 0 0;
  text-align: center;
}

.toolbar > *:not(:last-child) {
  margin-right: 24px;
}

.notice {
  padding: 24px;
  font-size: 20px;
  color: #999;
}

.message {
  display: flex;
  min-height: 32px;
  padding: 12px;
  box-sizing: border-box;
}

.avatar {
  flex: auto 0 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  margin-right: 12px;
}

.avatar .image {
  max-width: 100%;
  max-height: 100%;
  border-radius: 50%;
}

.index,
.text {
  flex: 1;
}

.text {
  max-width: 400px;
}

.index {
  opacity: .5;
}

.index span {
  display: inline-block;
  width: 160px;
  text-align: right;
}
</style>