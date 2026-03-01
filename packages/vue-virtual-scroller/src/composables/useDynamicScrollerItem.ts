import { inject, type InjectionKey } from 'vue'

export const DynamicScrollerItemResizeKey: InjectionKey<() => Promise<void>> =
  Symbol('dynamicScrollerItemResize')

export interface UseDynamicScrollerItemReturn {
  triggerResize: () => Promise<void>
}

/**
 * Composable for deeply nested content inside a DynamicScrollerItem.
 * Returns `triggerResize()` which triggers a remeasure of the
 * enclosing DynamicScrollerItem.
 *
 * Must be called within a component that is a descendant of DynamicScrollerItem.
 */
export function useDynamicScrollerItem(): UseDynamicScrollerItemReturn {
  const triggerResize = inject(DynamicScrollerItemResizeKey, null)

  if (!triggerResize) {
    console.warn(
      '[vue-zscroller] useDynamicScrollerItem() was called outside of a DynamicScrollerItem. ' +
      'triggerResize will be a no-op.'
    )
  }

  return {
    triggerResize: triggerResize ?? (async () => {}),
  }
}
