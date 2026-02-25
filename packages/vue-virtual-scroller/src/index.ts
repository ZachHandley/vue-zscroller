import type { App } from 'vue'
import DynamicScroller from './components/DynamicScroller.vue'
import DynamicScrollerItem from './components/DynamicScrollerItem.vue'
import RecycleScroller from './components/RecycleScroller.vue'
import GridScroller from './components/GridScroller.vue'
import config from './config'

// Composables
export { useSSRSafe } from './composables/useSSRSafe'
export { useIdState } from './composables/useIdState'
export { useDynamicSize } from './composables/useDynamicSize'
export { useGridLayout } from './composables/useGridLayout'
export { useSSRSafeEnhanced } from './composables/useSSRSafeEnhanced'
export { useAsyncItems, useItemValidation } from './composables/useAsyncItems'
// @vueuse/core utilities (re-exported for convenience)
export { useScrollLock, useLocalStorage, useSessionStorage, useStorage, useRafFn, useDebounceFn, useThrottleFn, useIntersectionObserver, useResizeObserver } from '@vueuse/core'

// IdState is now available as a composable via useIdState export

// Types
export type * from './types'

// Component exports
export {
  DynamicScroller,
  DynamicScrollerItem,
  RecycleScroller,
  GridScroller
}

// Component types
export type {
  RecycleScrollerComponent,
  DynamicScrollerComponent,
  DynamicScrollerItemComponent,
  GridScrollerComponent
} from './types/components'

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