import type { App } from 'vue'
import DynamicScroller from './components/DynamicScroller.vue'
import DynamicScrollerItem from './components/DynamicScrollerItem.vue'
import RecycleScroller from './components/RecycleScroller.vue'
import config from './config'

// Composables
export { useSSRSafe } from './composables/useSSRSafe'
export { useResizeObserver } from './composables/useResizeObserver'
export { useIntersectionObserver } from './composables/useIntersectionObserver'
export { useDebounceFn, useThrottleFn } from './composables/useDebounceFn'
export { useIdState } from './composables/useIdState'
export { useVirtualScrollCore } from './composables/useVirtualScrollCore'
export { useDynamicSize } from './composables/useDynamicSize'
export { useSlotRefManager } from './composables/useSlotRefManager'
export { useVirtualScrollPerformance } from './composables/useVirtualScrollPerformance'
export { useSSRSafeEnhanced } from './composables/useSSRSafeEnhanced'
// Custom @vueuse/core replacements
export { useElementSize } from './composables/useElementSize'
export { useScroll } from './composables/useScroll'
export { useScrollLock } from './composables/useScrollLock'
export { useLocalStorage, useSessionStorage, useStorage } from './composables/useStorage'
export { useRafFn } from './composables/useRafFn'

// IdState composable (backward compatibility)
export { default as useIdStateLegacy } from './mixins/IdState'

// Types
export type * from './types'

// Component exports
export {
  DynamicScroller,
  DynamicScrollerItem,
  RecycleScroller
}

// Component types
export type {
  RecycleScrollerComponent,
  DynamicScrollerComponent,
  DynamicScrollerItemComponent
} from './types/components'

function registerComponents(app: App, prefix: string = '') {
  app.component(`${prefix}recycle-scroller`, RecycleScroller)
  app.component(`${prefix}RecycleScroller`, RecycleScroller)
  app.component(`${prefix}dynamic-scroller`, DynamicScroller)
  app.component(`${prefix}DynamicScroller`, DynamicScroller)
  app.component(`${prefix}dynamic-scroller-item`, DynamicScrollerItem)
  app.component(`${prefix}DynamicScrollerItem`, DynamicScrollerItem)
}

interface PluginOptions {
  installComponents?: boolean
  componentsPrefix?: string
  [key: string]: any
}

const plugin = {
  version: '2.0.0-beta.8', // Will be replaced by build process
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

// Auto-install if loaded in browser environment
if (typeof window !== 'undefined' && window.Vue) {
  window.Vue.use(plugin)
}

// Export for CommonJS environments
declare global {
  interface Window {
    Vue: any
  }
}