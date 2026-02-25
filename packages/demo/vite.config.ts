import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      'zvue-virtual-scroller': resolve(__dirname, '../vue-virtual-scroller/src/index.ts'),
    },
  },
})
