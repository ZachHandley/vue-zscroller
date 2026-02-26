import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      'zvue-virtual-scroller': resolve(__dirname, '../vue-virtual-scroller/src/index.ts'),
    },
  },
})
