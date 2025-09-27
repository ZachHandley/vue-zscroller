import { ref, computed, watch, nextTick, type Ref } from 'vue'
import { useElementSize } from './useElementSize'
import { useSSRSafe } from './useSSRSafe'
import type { UseDynamicSizeOptions, UseDynamicSizeReturn } from '../types/composables'

export function useDynamicSize(
  options: UseDynamicSizeOptions
): UseDynamicSizeReturn {
  const {
    minItemSize,
    sizeDependencies = ref([]),
    watchData = false,
    active = ref(true)
  } = options

  const { isClient, onClientSide } = useSSRSafe()

  // State
  const element = ref<HTMLElement | null>(null)
  const isMeasured = ref(false)

  // Use @vueuse/core's useElementSize for better size tracking
  const { width, height } = useElementSize(element, { width: 0, height: 0 })

  // Computed item size based on orientation (default to vertical)
  const itemSize = computed(() => {
    const size = height.value // Default to height for vertical scrolling
    return Math.max(size, minItemSize)
  })

  // Watch size dependencies for changes
  watch(
    sizeDependencies,
    () => {
      if (active.value && isMeasured.value && isClient.value) {
        updateSize()
      }
    },
    { deep: true }
  )

  // Watch active state
  watch(active, (newActive) => {
    if (newActive && element.value && isClient.value) {
      // Size observation handled automatically by useElementSize
      nextTick(() => {
        updateSize()
      })
    }
  })

  // Watch for data changes if enabled
  watch(() => options, () => {
    if (watchData && active.value && isClient.value) {
      nextTick(() => {
        updateSize()
      })
    }
  }, { deep: true })

  // Methods
  const measureSize = (): number => {
    if (!element.value || !isClient.value) {
      return minItemSize
    }

    const rect = element.value.getBoundingClientRect()
    const size = rect.height // Default to height for vertical scrolling

    // Ensure minimum size
    return Math.max(size, minItemSize)
  }

  const updateSize = () => {
    if (!active.value || !isClient.value) return

    nextTick(() => {
      const newSize = measureSize()

      if (hasSizeChanged(itemSize.value, newSize)) {
        isMeasured.value = true
      }
    })
  }

  const hasSizeChanged = (oldSize: number, newSize: number): boolean => {
    // Consider size changed if difference is more than 0.5px
    return Math.abs(oldSize - newSize) > 0.5
  }

  const setElement = (el: HTMLElement | null) => {
    element.value = el

    if (el && active.value && isClient.value) {
      nextTick(() => {
        updateSize()
      })
    }
  }

  // Setup
  onClientSide(() => {
    if (element.value && active.value) {
      nextTick(() => {
        updateSize()
      })
    }
  })

  return {
    itemSize,
    measureSize,
    updateSize,
    hasSizeChanged,
    setElement
  }
}