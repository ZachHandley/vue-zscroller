import type { UseDebounceFnOptions, UseThrottleFnOptions } from '../types/composables'

export function useDebounceFn<T extends (...args: any[]) => any>(
  fn: T,
  options: UseDebounceFnOptions = {}
): T {
  const { ms = 100, immediate = false } = options
  let timeoutId: number | null = null
  let lastCallTime = 0

  const debouncedFn = ((...args: Parameters<T>) => {
    const now = Date.now()
    const elapsed = now - lastCallTime

    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    if (immediate && elapsed >= ms) {
      lastCallTime = now
      fn(...args)
    } else {
      timeoutId = window.setTimeout(() => {
        lastCallTime = Date.now()
        fn(...args)
        timeoutId = null
      }, ms)
    }
  }) as T

  // Add cancel method to the debounced function
  ;(debouncedFn as any).cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  return debouncedFn
}

export function useThrottleFn<T extends (...args: any[]) => any>(
  fn: T,
  options: UseThrottleFnOptions = {}
): T {
  const { ms = 100, trailing = true, leading = true } = options
  let timeoutId: number | null = null
  let lastCallTime = 0
  let lastArgs: Parameters<T> | null = null

  const throttledFn = ((...args: Parameters<T>) => {
    const now = Date.now()
    const elapsed = now - lastCallTime

    if (elapsed >= ms) {
      if (leading) {
        lastCallTime = now
        fn(...args)
      }
      lastArgs = null
    } else if (trailing && !timeoutId) {
      lastArgs = args
      timeoutId = window.setTimeout(() => {
        if (lastArgs) {
          lastCallTime = Date.now()
          fn(...lastArgs)
          lastArgs = null
        }
        timeoutId = null
      }, ms - elapsed)
    }
  }) as T

  // Add cancel method to the throttled function
  ;(throttledFn as any).cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    lastArgs = null
  }

  return throttledFn
}