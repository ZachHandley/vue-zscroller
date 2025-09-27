import type { DefineComponent, PropType } from 'vue'
import type {
  ScrollerProps,
  DynamicScrollerProps,
  DynamicScrollerItemProps,
  ScrollerEmits,
  DynamicScrollerEmits,
  DynamicScrollerItemEmits,
  VirtualScrollerSlotProps,
  DynamicScrollerSlotProps
} from './index'

export type RecycleScrollerComponent = DefineComponent<
  Omit<ScrollerProps, 'items'> & {
    items: PropType<ScrollerProps['items']>
  },
  {},
  unknown,
  {},
  {},
  DefaultSlots
>

export type DynamicScrollerComponent = DefineComponent<
  Omit<DynamicScrollerProps, 'items'> & {
    items: PropType<DynamicScrollerProps['items']>
  },
  {},
  unknown,
  {},
  {},
  DefaultSlots
>

export type DynamicScrollerItemComponent = DefineComponent<
  Omit<DynamicScrollerItemProps, 'item'> & {
    item: PropType<DynamicScrollerItemProps['item']>
  },
  {},
  unknown,
  {},
  {},
  DefaultSlots
>

export interface DefaultSlots {
  default?: (props: VirtualScrollerSlotProps) => any
  before?: () => any
  after?: () => any
  empty?: () => any
}

export interface DynamicScrollerSlots {
  default?: (props: DynamicScrollerSlotProps) => any
  before?: () => any
  after?: () => any
  empty?: () => any
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