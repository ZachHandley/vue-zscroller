<template>
  <div class="chat-reorder-demo">
    <div class="toolbar">
      <span class="demo-title">Chat List Reorder</span>

      <button @click="simulateNewMessage">
        Simulate New Message
      </button>

      <label class="auto-label">
        <input
          v-model="autoSimulate"
          type="checkbox"
        >
        Auto-simulate
      </label>

      <span class="counter">{{ totalMessages }} messages simulated</span>
    </div>

    <div class="hint">
      Click "Simulate New Message" or enable auto-simulate to watch a conversation slide to the top with a smooth transition.
    </div>

    <RecycleScroller
      :items="conversations"
      :item-size="72"
      key-field="id"
      :sort-by="sortByLastMessage"
      class="scroller"
    >
      <template #default="{ item }">
        <div
          v-if="item"
          class="chat-item"
          :class="{ 'chat-item--highlighted': item.id === lastUpdatedId }"
        >
          <div
            class="chat-avatar"
            :style="{ background: item.avatarColor }"
          >
            {{ item.avatar }}
          </div>

          <div class="chat-body">
            <div class="chat-header-row">
              <span class="chat-name">{{ item.name }}</span>
              <span class="chat-time">{{ formatTime(item.lastMessageAt) }}</span>
            </div>
            <div class="chat-preview-row">
              <span class="chat-preview">{{ item.lastMessage }}</span>
              <span
                v-if="item.unread > 0"
                class="chat-unread"
              >{{ item.unread }}</span>
            </div>
          </div>
        </div>
      </template>
    </RecycleScroller>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'

interface ChatItem {
  id: string
  name: string
  lastMessage: string
  lastMessageAt: number
  avatar: string
  avatarColor: string
  unread: number
}

const AVATAR_COLORS = [
  '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c',
  '#3498db', '#9b59b6', '#e91e63', '#00bcd4', '#8bc34a',
]

const LAST_MESSAGES = [
  'Hey, are you around?',
  'Can we hop on a call later?',
  'Just sent you the docs',
  'lol that was so funny',
  'Did you see the news?',
  "I'll be there in 10",
  'Thanks for your help!',
  'What do you think about this?',
  'Got your message',
  'Let me check and get back to you',
  'Sounds good to me',
  'Can you review my PR?',
  'Meeting is moved to 3pm',
  'Happy birthday!',
  "Don't forget the standup",
  'File is too large, can you compress?',
  'See you tomorrow',
  'On my way',
  'Just pushed the fix',
  'That worked, thanks!',
]

const NAMES = [
  'Alice Chen', 'Bob Martinez', 'Carol Smith', 'David Lee', 'Eva Johnson',
  'Frank Wilson', 'Grace Kim', 'Henry Brown', 'Iris Patel', 'Jack Davis',
  'Karen White', 'Leo Garcia', 'Mia Thompson', 'Noah Anderson', 'Olivia Taylor',
  'Peter Jackson', 'Quinn Moore', 'Rachel Clark', 'Sam Harris', 'Tina Lewis',
  'Uma Scott', 'Victor Young', 'Wendy Hall', 'Xavier Allen', 'Yara Wright',
  'Zoe Turner', 'Adam Baker', 'Beth Nelson', 'Carl Carter', 'Diana Mitchell',
  'Eli Roberts', 'Fiona Evans', 'Gary Cook', 'Hannah Bell', 'Ian Murphy',
  'Julia Ross', 'Kyle Rivera', 'Laura Brooks', 'Mike Cooper', 'Nancy Reed',
  'Oscar Bailey', 'Paula Cox', 'Quinton Ward', 'Rebecca Richardson', 'Steve Torres',
  'Tracy Peterson', 'Ugo Gray', 'Violet Ramirez', 'Wayne James', 'Xena Watson',
]

function generateInitials(name: string): string {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
}

function makeConversations(): ChatItem[] {
  const now = Date.now()
  return NAMES.map((name, i) => ({
    id: `conv-${i}`,
    name,
    lastMessage: LAST_MESSAGES[i % LAST_MESSAGES.length],
    lastMessageAt: now - (i + 1) * 60_000 * (1 + Math.random() * 5),
    avatar: generateInitials(name),
    avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
    unread: i < 3 ? Math.floor(Math.random() * 5) + 1 : 0,
  }))
}

const conversations = ref<ChatItem[]>(makeConversations())
const lastUpdatedId = ref<string | null>(null)
const totalMessages = ref(0)
const autoSimulate = ref(false)

function sortByLastMessage(a: ChatItem, b: ChatItem): number {
  return b.lastMessageAt - a.lastMessageAt
}

const newMessageTemplates: Array<(name: string) => string> = [
  (_name: string) => `New message at ${new Date().toLocaleTimeString()}`,
  (_name: string) => LAST_MESSAGES[Math.floor(Math.random() * LAST_MESSAGES.length)],
  (name: string) => `Hey ${name.split(' ')[0]}!`,
  (_name: string) => 'Just checking in...',
  (_name: string) => `Sent you ${Math.floor(Math.random() * 3) + 1} file(s)`,
]

function simulateNewMessage() {
  // Pick a random conversation that is not currently at the top
  // (i.e., not the one with the highest lastMessageAt)
  const sorted = [...conversations.value].sort((a, b) => b.lastMessageAt - a.lastMessageAt)
  const candidates = sorted.slice(1) // exclude current top
  if (candidates.length === 0) return

  const target = candidates[Math.floor(Math.random() * candidates.length)]
  const template = newMessageTemplates[Math.floor(Math.random() * newMessageTemplates.length)]

  const idx = conversations.value.findIndex(c => c.id === target.id)
  if (idx === -1) return

  conversations.value[idx] = {
    ...conversations.value[idx],
    lastMessage: template(target.name),
    lastMessageAt: Date.now(),
    unread: conversations.value[idx].unread + 1,
  }

  lastUpdatedId.value = target.id
  totalMessages.value++

  // Clear highlight after a short delay
  const highlightedId = target.id
  setTimeout(() => {
    if (lastUpdatedId.value === highlightedId) {
      lastUpdatedId.value = null
    }
  }, 800)
}

let autoInterval: ReturnType<typeof setInterval> | null = null

function startAuto() {
  if (autoInterval) return
  autoInterval = setInterval(() => {
    simulateNewMessage()
  }, 2000 + Math.random() * 1000)
}

function stopAuto() {
  if (autoInterval) {
    clearInterval(autoInterval)
    autoInterval = null
  }
}

watch(autoSimulate, (val) => {
  if (val) {
    startAuto()
  } else {
    stopAuto()
  }
})

onUnmounted(() => {
  stopAuto()
})

function formatTime(ts: number): string {
  const diff = Date.now() - ts
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}
</script>

<style scoped>
.chat-reorder-demo {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.hint {
  flex: auto 0 0;
  padding: 6px 12px 10px;
  font-size: 13px;
  color: #888;
  border-bottom: solid 1px #e0edfa;
}

.scroller {
  flex: 1 1 0;
  min-height: 0;
  border: solid 1px #42b983;
}

.demo-title {
  font-weight: bold;
  color: #2c3e50;
  margin-right: 4px;
}

.auto-label {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.counter {
  color: #888;
  font-size: 13px;
}

/* Chat item */
.chat-item {
  display: flex;
  align-items: center;
  height: 72px;
  padding: 0 12px;
  box-sizing: border-box;
  border-bottom: solid 1px #f0f0f0;
  transition: background 0.4s ease;
}

.chat-item--highlighted {
  background: #f0fff8;
}

.chat-avatar {
  flex: 0 0 44px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  color: white;
  font-weight: bold;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  flex-shrink: 0;
}

.chat-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
}

.chat-header-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
}

.chat-name {
  font-weight: 600;
  font-size: 14px;
  color: #2c3e50;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

.chat-time {
  font-size: 12px;
  color: #aaa;
  white-space: nowrap;
  flex-shrink: 0;
}

.chat-preview-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.chat-preview {
  font-size: 13px;
  color: #888;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

.chat-unread {
  flex-shrink: 0;
  background: #42b983;
  color: white;
  border-radius: 10px;
  font-size: 11px;
  font-weight: bold;
  min-width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
  box-sizing: border-box;
}
</style>
