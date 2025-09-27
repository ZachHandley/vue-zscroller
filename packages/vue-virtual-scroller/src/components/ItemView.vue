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

<script setup>
const props = defineProps({
  view: {
    type: Object,
    required: true
  },
  itemTag: {
    type: String,
    default: 'div'
  }
})
</script>

<style scoped>
.vue-recycle-scroller__item-view {
  box-sizing: border-box;
  backface-visibility: hidden;
  contain: layout style paint;
}
</style>