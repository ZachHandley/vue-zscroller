import { ref, onMounted, onUnmounted, nextTick } from 'vue'

export interface UseRafFnOptions {
  immediate?: boolean
  window?: Window & typeof globalThis
}

export function useRafFn(
  callback: (time: number) => void,
  options: UseRafFnOptions = {}
) {
  const {
    immediate = true,
    window = globalThis.window
  } = options

  const isActive = ref(false)
  let rafId: number | null = null
  let previousTime = performance.now()

  const loop = (time: number) => {
    if (!isActive.value) return

    const delta = time - previousTime
    previousTime = time

    callback(delta)

    rafId = requestAnimationFrame(loop)
  }

  const start = () => {
    if (isActive.value) return
    isActive.value = true
    previousTime = performance.now()
    rafId = requestAnimationFrame(loop)
  }

  const stop = () => {
    isActive.value = false
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  onMounted(() => {
    if (immediate && typeof window !== 'undefined') {
      nextTick(() => {
        start()
      })
    }
  })

  onUnmounted(() => {
    stop()
  })

  return {
    isActive,
    start,
    stop
  }
}