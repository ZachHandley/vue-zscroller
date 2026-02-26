import { createApp } from 'vue'

import VirtualScroller from 'vue-zscroller'
import App from './App.vue'

import router from './router'

const app = createApp(App)
app.use(router)
app.use(VirtualScroller)
app.mount('#app')
