import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/vue-zscroller/',
  plugins: [vue()],
  resolve: {
    alias: {
      'vue-zscroller': resolve(__dirname, '../vue-virtual-scroller/src/index.ts'),
    },
  },
})
