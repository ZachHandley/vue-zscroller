<template>
  <div class="chat-demo">
    <div class="toolbar">
      <button
        v-if="!streaming"
        @click="startStream()"
      >
        Start stream
      </button>
      <button
        v-else
        @click="stopStream()"
      >
        Stop stream
      </button>

      <input
        v-model="search"
        placeholder="Filter..."
      >
    </div>

    <DynamicScroller
      :items="filteredItems"
      :min-item-size="54"
      stick-to-bottom
      class="scroller"
    >
      <template #before>
        <div class="notice">
          The message heights are unknown.
        </div>
      </template>

      <template #default="{ item, index, active }">
        <DynamicScrollerItem
          :item="item"
          :active="active"
          :size-dependencies="[
            item.message,
          ]"
          :data-index="index"
          :data-active="active"
          :title="`Click to change message ${index}`"
          class="message"
          @click="changeMessage(item)"
        >
          <div class="avatar">
            <img
              :key="item.avatar"
              :src="item.avatar"
              alt="avatar"
              class="image"
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
import { ref, computed, onUnmounted } from 'vue'
import { generateMessage, type MessageItem } from '../data'

interface ChatItem extends MessageItem {
  id: number
}

let id = 0

const messages: MessageItem[] = []
for (let i = 0; i < 10000; i++) {
  messages.push(generateMessage())
}

const items = ref<ChatItem[]>([])
const search = ref('')
const streaming = ref(false)
const filteredItems = computed(() => {
  if (!search.value) return items.value
  const lowerCaseSearch = search.value.toLowerCase()
  return items.value.filter(i => i.message.toLowerCase().includes(lowerCaseSearch))
})

function changeMessage(message: ChatItem) {
  Object.assign(message, generateMessage())
}

function addMessage() {
  for (let i = 0; i < 10; i++) {
    items.value.push({
      id: id++,
      ...messages[id % 10000],
    })
  }

  if (streaming.value) {
    setTimeout(addMessage, 200)
  }
}

function startStream() {
  if (streaming.value) return
  streaming.value = true
  addMessage()
}

function stopStream() {
  streaming.value = false
}

onUnmounted(() => {
  stopStream()
})
</script>

<style scoped>
.chat-demo {
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.scroller {
  flex: 1 1 0;
  min-height: 0;
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
