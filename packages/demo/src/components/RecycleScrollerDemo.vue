<template>
  <div
    class="recycle-scroller-demo"
    :class="{
      'page-mode': pageMode,
      'full-page': pageModeFullPage,
    }"
  >
    <div class="toolbar">
      <span>
        <input
          v-model="countInput"
          type="number"
          min="0"
          max="500000"
        > items
        <button @click="addItem()">+1</button>
      </span>
      <label>
        <input
          v-model="enableLetters"
          type="checkbox"
        > variable height
      </label>
      <label>
        <input
          v-model="pageMode"
          type="checkbox"
        > page mode
      </label>
      <label v-if="pageMode">
        <input
          v-model="pageModeFullPage"
          type="checkbox"
        > full page
      </label>
      <span>
        <input
          v-model.number="buffer"
          type="number"
          min="1"
          max="500000"
        > buffer
      </span>
      <span>
        <button @mousedown="scroller?.scrollToItem(scrollTo)">Scroll To: </button>
        <input
          v-model.number="scrollTo"
          type="number"
          min="0"
          :max="list.length - 1"
        >
      </span>
      <span>
        <button @mousedown="renderScroller = !renderScroller">Toggle render</button>
        <button @mousedown="showScroller = !showScroller">Toggle visibility</button>
      </span>
      <label>
        <input
          v-model="showMessageBeforeItems"
          type="checkbox"
        > show message before items
      </label>
      <span>({{ updateParts.viewStartIdx }} - [{{ updateParts.visibleStartIdx }} - {{ updateParts.visibleEndIdx }}] - {{ updateParts.viewEndIdx }})</span>
    </div>

    <div
      v-if="renderScroller"
      v-show="showScroller"
      class="content"
    >
      <div class="wrapper">
        <RecycleScroller
          :key="String(pageModeFullPage)"
          ref="scroller"
          class="scroller"
          :items="list"
          :item-size="itemHeight"
          :buffer="buffer"
          :page-mode="pageMode"
          key-field="id"
          size-field="height"
          :emit-update="true"
          @update="onUpdate"
          @visible="onVisible"
          @hidden="onHidden"
          @scroll-start="onScrollStart"
          @scroll-end="onScrollEnd"
        >
          <template #default="props">
            <template v-if="props.item">
              <div
                v-if="props.item.type === 'letter'"
                class="tr letter big"
                @click="props.item.height = (props.item.height === 200 ? 300 : 200)"
              >
                <div class="td index">
                  {{ props.index }}
                </div>
                <div class="td value">
                  {{ props.item.value }} Scoped
                </div>
              </div>
              <Person
                v-if="props.item.type === 'person'"
                :item="(props.item as any)"
                :index="props.index"
              />
            </template>
          </template>
        </RecycleScroller>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick, type Ref } from 'vue'
import { getData, addItem as addDataItem } from '../data'
import type { DataItem } from '../data'
import Person from './Person.vue'

interface UpdateParts {
  viewStartIdx: number
  viewEndIdx: number
  visibleStartIdx: number
  visibleEndIdx: number
}

const items = ref<DataItem[]>([])
const count = ref(10000)
const renderScroller = ref(true)
const showScroller = ref(true)
const buffer = ref(200)
const enableLetters = ref(true)
const pageMode = ref(false)
const pageModeFullPage = ref(true)
const scrollTo = ref(100)
const updateParts = ref<UpdateParts>({
  viewStartIdx: 0,
  viewEndIdx: 0,
  visibleStartIdx: 0,
  visibleEndIdx: 0
})
const showMessageBeforeItems = ref(true)

const scroller: Ref<any> = ref(null)

const countInput = computed({
  get: () => count.value,
  set: (val: number) => {
    if (val > 500000) {
      val = 500000
    } else if (val < 0) {
      val = 0
    }
    count.value = val
  }
})

const itemHeight = computed(() => enableLetters.value ? null : 50)

const list = computed(() => {
  return items.value.map(
    (item: DataItem) => Object.assign({}, item),
  )
})

function generateItems() {
  console.log('Generating ' + count.value + ' items...')
  const time = Date.now()
  const newItems = getData(count.value, enableLetters.value)
  console.log('Generated ' + newItems.length + ' in ' + (Date.now() - time) + 'ms')
  items.value = newItems
}

function addItem() {
  addDataItem(items.value)
}

function onUpdate(event: { startIndex: number, endIndex: number, visibleStartIndex: number, visibleEndIndex: number }) {
  updateParts.value = {
    viewStartIdx: event.startIndex,
    viewEndIdx: event.endIndex,
    visibleStartIdx: event.visibleStartIndex,
    visibleEndIdx: event.visibleEndIndex
  }
}

function onVisible() {
  console.log('visible')
}

function onHidden() {
  console.log('hidden')
}

function onScrollStart() {
  console.log('scroll start')
}

function onScrollEnd() {
  console.log('scroll end')
}

watch(count, () => {
  generateItems()
})

watch(enableLetters, () => {
  generateItems()
})

onMounted(() => {
  nextTick(generateItems)
  ;(window as any).scroller = scroller.value
})
</script>

<style scoped>
.recycle-scroller-demo:not(.page-mode) {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.recycle-scroller-demo.page-mode:not(.full-page) {
  height: 100%;
}

.recycle-scroller-demo.page-mode {
  flex: auto 0 0;
}

.recycle-scroller-demo.page-mode .toolbar {
  border-bottom: solid 1px #e0edfa;
}

.content {
  flex: 1 1 0;
  border: solid 1px #42b983;
  position: relative;
}

.recycle-scroller-demo.page-mode:not(.full-page) .content {
  overflow: auto;
}

.recycle-scroller-demo:not(.page-mode) .wrapper {
  overflow: hidden;
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
}

.scroller {
  width: 100%;
  height: 100%;
}

.notice {
  padding: 24px;
  font-size: 20px;
  color: #999;
}

.letter {
  text-transform: uppercase;
  color: grey;
  font-weight: bold;
}

.letter .td {
  padding: 12px;
}

.letter.big {
  font-weight: normal;
  height: 200px;
}

.letter.big .value {
  font-size: 120px;
}
</style>
