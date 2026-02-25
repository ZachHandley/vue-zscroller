import type { Ref } from 'vue'

export interface UseSSRSafeReturn {
  isClient: Ref<boolean>
  isServer: Ref<boolean>
  onClientSide: (callback: () => void) => void
  onServerSide: (callback: () => void) => void
}

export interface UseIdStateOptions<T = any> {
  idProp?: string | ((vm: any) => string | number)
  initialState?: () => T
}

export interface UseIdStateReturn<T = any> {
  idState: Ref<T | null>
  updateIdState: () => void
  reset: () => void
  setup: (componentInstance: any) => void
}

export interface UseDynamicSizeReturn {
  itemSize: Ref<number>
  measureSize: () => number
  updateSize: () => void
  hasSizeChanged: (oldSize: number, newSize: number) => boolean
  setElement: (el: HTMLElement | null) => void
  setCurrentSize: (size: number) => void
}
