<template>
  <div class="dynamic-scroller-demo">
    <div class="toolbar">
      <input
        v-model="search"
        placeholder="Filter..."
      >

      <label>
        <input
          v-model="dynamic"
          type="checkbox"
        >
        Dynamic scroller
      </label>
    </div>

    <DynamicScroller
      v-if="dynamic"
      :items="objectItems"
      :min-item-size="54"
      class="scroller"
    >
      <template #before>
        <div class="notice">
          Array of simple strings (no objects).
        </div>
      </template>

      <template #default="{ item, index, active }">
        <DynamicScrollerItem
          :item="item"
          :index="index"
          :active="active"
          :data-index="index"
          :data-active="active"
          class="message"
        >
          <div class="text">
            {{ item.message }}
          </div>
          <div class="index">
            <span>{{ index }} (index)</span>
          </div>
        </DynamicScrollerItem>
      </template>
    </DynamicScroller>

    <RecycleScroller
      v-else
      :items="filteredItems.map((o, i) => `${i}: ${o.substr(0, 42)}...`)"
      :item-size="54"
      class="scroller"
    >
      <template #default="{ item, index }">
        <div class="message">
          <div class="text">
            {{ item }}
          </div>
          <div class="index">
            <span>{{ index }} (index)</span>
          </div>
        </div>
      </template>
    </RecycleScroller>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { generateMessage } from '../data'

const items = Array.from({ length: 10000 }, () => generateMessage().message)

const search = ref('')
const dynamic = ref(true)

const filteredItems = computed(() => {
  if (!search.value) return items
  const lowerCaseSearch = search.value.toLowerCase()
  return items.filter(i => i.toLowerCase().includes(lowerCaseSearch))
})

const objectItems = computed(() =>
  filteredItems.value.map((msg, i) => ({ id: i, message: typeof msg === 'string' ? msg : String(msg) }))
)
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

.text,
.index {
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