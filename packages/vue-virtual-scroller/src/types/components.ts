import type RecycleScrollerVue from '../components/RecycleScroller.vue'
import type DynamicScrollerVue from '../components/DynamicScroller.vue'
import type DynamicScrollerItemVue from '../components/DynamicScrollerItem.vue'
import type GridScrollerVue from '../components/GridScroller.vue'
import type {
  VirtualScrollerSlotProps,
  DynamicScrollerSlotProps
} from './index'

export type RecycleScrollerComponent = typeof RecycleScrollerVue

export type DynamicScrollerComponent = typeof DynamicScrollerVue

export type DynamicScrollerItemComponent = typeof DynamicScrollerItemVue

export type GridScrollerComponent = typeof GridScrollerVue

export interface DefaultSlots {
  default?: (props: VirtualScrollerSlotProps) => any
  before?: () => any
  after?: () => any
  empty?: () => any
  'empty-item'?: (props: { index: number }) => any
}

export interface DynamicScrollerSlots {
  default?: (props: DynamicScrollerSlotProps) => any
  before?: () => any
  after?: () => any
  empty?: () => any
  'empty-item'?: (props: { index: number }) => any
}

export interface ComponentConfig {
  installComponents: boolean
  componentsPrefix: string
}

export interface PluginOptions {
  installComponents?: boolean
  componentsPrefix?: string
}

export interface VersionInfo {
  version: string
}
