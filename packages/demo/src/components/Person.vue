<template>
  <div
    class="tr person"
  >
    <div class="td index">
      {{ index }}
    </div>
    <div class="td">
      <div class="info">
        <img
          :key="item.value.avatar"
          class="avatar"
          :src="item.value.avatar"
        >
        <span>{{ item.value.name }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface PersonItem {
  type: 'person'
  value: {
    name: string
    avatar: string
  }
}

interface Props {
  item: PersonItem
  index: number
}

defineProps<Props>()
</script>

<style scoped>
.index {
  color: rgba(0, 0, 0, 0.2);
  width: 55px;
  text-align: right;
  flex: auto 0 0;
}

.person .td:first-child {
  padding: 12px;
}

.person .info {
  display: flex;
  align-items: center;
  height: 48px;
}

.avatar {
  width: 50px;
  height: 50px;
  margin-right: 12px;
}
</style>