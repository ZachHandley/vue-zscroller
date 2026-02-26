<template>
  <component
    :is="itemTag"
    class="vue-recycle-scroller__item-view"
  >
    <slot
      :item="view.item"
      :index="view.nr.index"
      :active="view.nr.used"
    />
  </component>
</template>

<script setup lang="ts">
import type { ViewItem, VirtualScrollerItem } from '../types'

const { view, itemTag = 'div' } = defineProps<{
  view: ViewItem
  itemTag?: string
}>()

defineSlots<{
  default: (props: { item: VirtualScrollerItem | null | undefined; index: number; active: boolean }) => any
}>()
</script>

<style scoped>
.vue-recycle-scroller__item-view {
  box-sizing: border-box;
}
</style>