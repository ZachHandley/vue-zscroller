import type { App } from 'vue'
import DynamicScroller from './components/DynamicScroller.vue'
import DynamicScrollerItem from './components/DynamicScrollerItem.vue'
import GridScroller from './components/GridScroller.vue'
import RecycleScroller from './components/RecycleScroller.vue'
import config from './config'

export { useAsyncItems, useItemValidation } from './composables/useAsyncItems'
export { useDynamicSize } from './composables/useDynamicSize'
export { useGridLayout } from './composables/useGridLayout'
export { useIdState } from './composables/useIdState'
// Composables
export { useSSRSafe } from './composables/useSSRSafe'
export { useSSRSafeEnhanced } from './composables/useSSRSafeEnhanced'
// Types
export type * from './types'

// IdState is now available as a composable via useIdState export

// Component types
export type {
  DynamicScrollerComponent,
  DynamicScrollerItemComponent,
  GridScrollerComponent,
  RecycleScrollerComponent,
} from './types/components'

// Component exports
export {
  DynamicScroller,
  DynamicScrollerItem,
  GridScroller,
  RecycleScroller,
}

// @vueuse/core utilities (re-exported for convenience)
export { useDebounceFn, useIntersectionObserver, useLocalStorage, useRafFn, useResizeObserver, useScrollLock, useSessionStorage, useStorage, useThrottleFn } from '@vueuse/core'

function registerComponents(app: App, prefix: string = '') {
  app.component(`${prefix}recycle-scroller`, RecycleScroller)
  app.component(`${prefix}RecycleScroller`, RecycleScroller)
  app.component(`${prefix}dynamic-scroller`, DynamicScroller)
  app.component(`${prefix}DynamicScroller`, DynamicScroller)
  app.component(`${prefix}dynamic-scroller-item`, DynamicScrollerItem)
  app.component(`${prefix}DynamicScrollerItem`, DynamicScrollerItem)
  app.component(`${prefix}grid-scroller`, GridScroller)
  app.component(`${prefix}GridScroller`, GridScroller)
}

interface PluginOptions {
  installComponents?: boolean
  componentsPrefix?: string
  [key: string]: any
}

const plugin = {
  version: '1.0.0', // Will be replaced by build process
  install(app: App, options: PluginOptions = {}) {
    const finalOptions = Object.assign({}, {
      installComponents: true,
      componentsPrefix: '',
    }, options)

    for (const key in finalOptions) {
      if (typeof finalOptions[key] !== 'undefined') {
        (config as any)[key] = finalOptions[key]
      }
    }

    if (finalOptions.installComponents) {
      registerComponents(app, finalOptions.componentsPrefix)
    }
  },
}

export default plugin

// Global component type augmentation for app.use() consumers
declare module 'vue' {
  export interface GlobalComponents {
    RecycleScroller: typeof import('./components/RecycleScroller.vue')['default']
    DynamicScroller: typeof import('./components/DynamicScroller.vue')['default']
    DynamicScrollerItem: typeof import('./components/DynamicScrollerItem.vue')['default']
    GridScroller: typeof import('./components/GridScroller.vue')['default']
  }
}
