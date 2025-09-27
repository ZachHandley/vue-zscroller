import { ref, onMounted, onUnmounted, nextTick, type Ref } from 'vue'

export interface UseScrollLockOptions {
  disableBodyPadding?: boolean
}

let originalBodyPaddingRight = ''
let originalBodyOverflow = ''
let scrollLockCount = 0

export function useScrollLock(
  element: Ref<HTMLElement | null | undefined> | HTMLElement | null | undefined,
  options: UseScrollLockOptions = {}
): {
  isLocked: Ref<boolean>
  lock: () => void
  unlock: () => void
} {
  const { disableBodyPadding = true } = options
  const isLocked = ref(false)

  const getScrollbarWidth = (): number => {
    if (typeof document === 'undefined') return 0

    const documentWidth = document.documentElement.clientWidth
    return Math.abs(window.innerWidth - documentWidth)
  }

  const lock = () => {
    if (typeof document === 'undefined' || isLocked.value) return

    scrollLockCount++

    if (scrollLockCount > 1) {
      isLocked.value = true
      return
    }

    const targetElement = typeof element === 'function' && 'value' in element
      ? (element as Ref<HTMLElement | null | undefined>).value
      : element as HTMLElement | null | undefined

    if (targetElement && typeof targetElement === 'object' && 'style' in targetElement) {
      // Lock the specific element
      targetElement.style.overflow = 'hidden'
      if (disableBodyPadding) {
        targetElement.style.paddingRight = `${getScrollbarWidth()}px`
      }
    } else {
      // Lock the entire body
      originalBodyOverflow = document.body.style.overflow
      originalBodyPaddingRight = document.body.style.paddingRight

      document.body.style.overflow = 'hidden'
      if (disableBodyPadding) {
        document.body.style.paddingRight = `${getScrollbarWidth()}px`
      }
    }

    isLocked.value = true
  }

  const unlock = () => {
    if (typeof document === 'undefined' || !isLocked.value) return

    scrollLockCount--

    if (scrollLockCount > 0) {
      return
    }

    const targetElement = typeof element === 'function' && 'value' in element
      ? (element as Ref<HTMLElement | null | undefined>).value
      : element as HTMLElement | null | undefined

    if (targetElement && typeof targetElement === 'object' && 'style' in targetElement) {
      // Unlock the specific element
      targetElement.style.overflow = ''
      if (disableBodyPadding) {
        targetElement.style.paddingRight = ''
      }
    } else {
      // Unlock the entire body
      document.body.style.overflow = originalBodyOverflow
      if (disableBodyPadding) {
        document.body.style.paddingRight = originalBodyPaddingRight
      }
    }

    isLocked.value = false
  }

  // Auto-unlock on unmount
  onUnmounted(() => {
    if (isLocked.value) {
      unlock()
    }
  })

  return {
    isLocked,
    lock,
    unlock
  }
}