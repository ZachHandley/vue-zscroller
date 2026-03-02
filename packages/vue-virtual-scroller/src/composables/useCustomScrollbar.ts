import type { UseCustomScrollbarOptions, UseCustomScrollbarReturn } from '../types/composables'
import { ref, watch } from 'vue'

export function useCustomScrollbar(
  options: UseCustomScrollbarOptions,
): UseCustomScrollbarReturn {
  const {
    scrollElement,
    totalSize,
    direction,
    onScrollTo,
    options: scrollbarOpts,
  } = options

  const isVertical = direction === 'vertical'

  // Defaults
  const MIN_THUMB_SIZE = scrollbarOpts?.minThumbSize ?? 30
  const AUTO_HIDE = scrollbarOpts?.autoHide ?? true
  const AUTO_HIDE_DELAY = scrollbarOpts?.autoHideDelay ?? 1000

  // Reactive state
  const thumbSize = ref(0)
  const thumbPosition = ref(0)
  const trackSize = ref(0)
  const isVisible = ref(!AUTO_HIDE)
  const isDragging = ref(false)

  // Non-reactive internals
  let hideTimeout: ReturnType<typeof setTimeout> | null = null
  let activeMoveHandler: ((e: PointerEvent) => void) | null = null
  let activeUpHandler: ((e: PointerEvent) => void) | null = null

  // --- Thumb calculation ---

  function updateThumb(): void {
    const el = scrollElement.value
    if (!el)
      return

    const scrollPos = isVertical ? el.scrollTop : el.scrollLeft
    const clientSize = isVertical ? el.clientHeight : el.clientWidth
    const total = isVertical ? el.scrollHeight : el.scrollWidth

    trackSize.value = clientSize

    if (total <= clientSize) {
      thumbSize.value = 0
      thumbPosition.value = 0
      isVisible.value = false
      return
    }

    const rawThumb = (clientSize / total) * clientSize
    thumbSize.value = Math.max(rawThumb, MIN_THUMB_SIZE)

    const maxScroll = total - clientSize
    const availableTrack = clientSize - thumbSize.value
    thumbPosition.value = maxScroll > 0
      ? (scrollPos / maxScroll) * availableTrack
      : 0
  }

  // --- Auto-hide helpers ---

  function clearHideTimer(): void {
    if (hideTimeout !== null) {
      clearTimeout(hideTimeout)
      hideTimeout = null
    }
  }

  function showScrollbar(): void {
    clearHideTimer()
    isVisible.value = true
  }

  function startHideTimer(): void {
    if (!AUTO_HIDE)
      return
    clearHideTimer()
    hideTimeout = setTimeout(() => {
      if (!isDragging.value) {
        isVisible.value = false
      }
    }, AUTO_HIDE_DELAY)
  }

  // --- Cleanup document listeners ---

  function removeDocumentListeners(): void {
    if (typeof document === 'undefined')
      return

    if (activeMoveHandler) {
      document.removeEventListener('pointermove', activeMoveHandler)
      activeMoveHandler = null
    }
    if (activeUpHandler) {
      document.removeEventListener('pointerup', activeUpHandler)
      activeUpHandler = null
    }
  }

  // --- Reactive watcher: recalculate when content size changes ---

  const stopTotalSizeWatch = watch(totalSize, () => {
    updateThumb()
  }, { flush: 'post' })

  // --- Public API ---

  function onScroll(): void {
    updateThumb()
    showScrollbar()
    startHideTimer()
  }

  function onResize(): void {
    updateThumb()
  }

  function onThumbPointerDown(e: PointerEvent): void {
    e.preventDefault()
    e.stopPropagation()

    isDragging.value = true
    clearHideTimer()

    const startPos = isVertical ? e.clientY : e.clientX
    const startThumbPos = thumbPosition.value

    const onPointerMove = (moveEvent: PointerEvent) => {
      const el = scrollElement.value
      if (!el)
        return

      const delta = (isVertical ? moveEvent.clientY : moveEvent.clientX) - startPos
      const availableTrack = trackSize.value - thumbSize.value
      const newThumbPos = Math.max(0, Math.min(startThumbPos + delta, availableTrack))
      const scrollPercent = availableTrack > 0 ? newThumbPos / availableTrack : 0
      const clientSize = isVertical ? el.clientHeight : el.clientWidth
      const maxScroll = (isVertical ? el.scrollHeight : el.scrollWidth) - clientSize
      onScrollTo(scrollPercent * maxScroll)
    }

    const onPointerUp = () => {
      removeDocumentListeners()
      isDragging.value = false
      startHideTimer()
    }

    // Store references for cleanup
    activeMoveHandler = onPointerMove
    activeUpHandler = onPointerUp

    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
  }

  function onTrackPointerDown(e: PointerEvent): void {
    e.preventDefault()
    e.stopPropagation()

    const el = scrollElement.value
    if (!el)
      return

    const target = e.currentTarget as Element
    const rect = target.getBoundingClientRect()
    const clickPos = isVertical
      ? e.clientY - rect.top
      : e.clientX - rect.left

    const targetThumbPos = clickPos - thumbSize.value / 2
    const availableTrack = trackSize.value - thumbSize.value
    const clampedPos = Math.max(0, Math.min(targetThumbPos, availableTrack))
    const scrollPercent = availableTrack > 0 ? clampedPos / availableTrack : 0
    const clientSize = isVertical ? el.clientHeight : el.clientWidth
    const maxScroll = (isVertical ? el.scrollHeight : el.scrollWidth) - clientSize
    onScrollTo(scrollPercent * maxScroll)
  }

  function destroy(): void {
    clearHideTimer()
    removeDocumentListeners()
    stopTotalSizeWatch()
  }

  return {
    thumbSize,
    thumbPosition,
    trackSize,
    isVisible,
    isDragging,
    onScroll,
    onResize,
    onThumbPointerDown,
    onTrackPointerDown,
    destroy,
  }
}
