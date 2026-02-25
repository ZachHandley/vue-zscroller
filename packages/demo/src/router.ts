import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

import ChatDemo from './components/ChatDemo.vue'
import Dynamic from './components/DynamicScrollerDemo.vue'
import GridDemo from './components/GridDemo.vue'
import GridScrollerDemo from './components/GridScrollerDemo.vue'
import Home from './components/Home.vue'
import HorizontalDemo from './components/HorizontalDemo.vue'
import Recycle from './components/RecycleScrollerDemo.vue'
import SimpleList from './components/SimpleList.vue'
import TestChat from './components/TestChat.vue'

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: Home },
  { path: '/recycle', name: 'recycle', component: Recycle },
  { path: '/dynamic', name: 'dynamic', component: Dynamic },
  { path: '/test-chat', name: 'test-chat', component: TestChat },
  { path: '/simple-list', name: 'simple-list', component: SimpleList },
  { path: '/horizontal', name: 'horizontal', component: HorizontalDemo },
  { path: '/chat', name: 'chat', component: ChatDemo },
  { path: '/grid', name: 'grid', component: GridDemo },
  { path: '/grid-scroller', name: 'grid-scroller', component: GridScrollerDemo },
  { path: '/skeleton', name: 'skeleton', component: () => import('./components/SkeletonDemo.vue') },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export default router