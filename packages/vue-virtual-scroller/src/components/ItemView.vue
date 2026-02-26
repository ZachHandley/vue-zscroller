<template>
  <component
    :is="props.itemTag"
    class="vue-recycle-scroller__item-view"
  >
    <slot
      :item="props.view.item"
      :index="props.view.nr.index"
      :active="props.view.nr.used"
    />
  </component>
</template>

<script setup lang="ts">
import type { ViewItem } from '../types'

interface Props {
  view: ViewItem
  itemTag?: string
}

const props = withDefaults(defineProps<Props>(), {
  itemTag: 'div'
})
</script>

<style scoped>
.vue-recycle-scroller__item-view {
  box-sizing: border-box;
}
</style>