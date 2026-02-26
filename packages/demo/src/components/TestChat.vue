<template>
  <div class="hello">
    <div>
      <button @click="addItems()">
        Add item
      </button>
      <button @click="addItems(5)">
        Add 5 items
      </button>
      <button @click="addItems(10)">
        Add 10 items
      </button>
      <button @click="addItems(50)">
        Add 50 items
      </button>
    </div>

    <DynamicScroller
      :items="items"
      :min-item-size="24"
      stick-to-bottom
      class="scroller"
    >
      <template #default="{ item, index, active }">
        <DynamicScrollerItem
          v-if="item"
          :item="item"
          :active="active"
          :data-index="index"
        >
          <div class="message">
            {{ item.text }}
          </div>
        </DynamicScrollerItem>
      </template>
    </DynamicScroller>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { faker } from '@faker-js/faker'

interface ChatItem {
  text: string
  id: number
}

const items = ref<ChatItem[]>([])

function addItems(count = 1) {
  for (let i = 0; i < count; i++) {
    items.value.push({
      text: faker.lorem.lines(),
      id: items.value.length + 1,
    })
  }
}
</script>

<style scoped>
.hello {
  flex: 1 1 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.scroller {
  flex: 1 1 0;
  min-height: 0;
  border: 2px solid #ddd;
}

h1,
h2 {
  font-weight: normal;
}
ul {
  list-style-type: none;
  padding: 0;
}
li {
  display: inline-block;
  margin: 0 10px;
}
a {
  color: #42b983;
}

.message {
  padding: 10px 10px 9px;
  border-bottom: solid 1px #eee;
}
</style>
