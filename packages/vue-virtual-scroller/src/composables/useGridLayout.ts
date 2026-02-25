import { computed, ref, onBeforeUnmount, type Ref, type ComputedRef } from 'vue'
import { useResizeObserver } from '@vueuse/core'

export interface UseGridLayoutOptions {
  containerElement: Ref<HTMLElement | null>
  itemWidth: Ref<number>
  itemHeight: Ref<number>
  columnGap: Ref<number>
  rowGap: Ref<number>
  minColumns: Ref<number>
  maxColumns: Ref<number>
  columnsOverride: Ref<number | null>
  direction: Ref<'vertical' | 'horizontal'>
}

export interface UseGridLayoutReturn {
  containerWidth: Ref<number>
  containerHeight: Ref<number>
  /** Whether the container has been measured at least once (width or height > 0) */
  isMeasured: ComputedRef<boolean>
  computedColumns: ComputedRef<number>
  /** Row stride for RecycleScroller positioning (cellHeight + rowGap for vertical) */
  effectiveItemSize: ComputedRef<number>
  /** Column stride for RecycleScroller positioning (cellWidth + columnGap for vertical) */
  effectiveSecondarySize: ComputedRef<number>
  /** Actual content width of each cell (stretched to fill container, no gap) */
  cellWidth: ComputedRef<number>
  /** Actual content height of each cell (stretched to fill container, no gap) */
  cellHeight: ComputedRef<number>
  /** Content size for RecycleScroller view on main axis (cellHeight for vertical, cellWidth for horizontal) */
  gridViewSize: ComputedRef<number>
  /** Content size for RecycleScroller view on cross axis (cellWidth for vertical, cellHeight for horizontal) */
  gridViewSecondarySize: ComputedRef<number>
}

export function useGridLayout(options: UseGridLayoutOptions): UseGridLayoutReturn {
  const {
    containerElement,
    itemWidth,
    itemHeight,
    columnGap,
    rowGap,
    minColumns,
    maxColumns,
    columnsOverride,
    direction
  } = options

  const containerWidth = ref(0)
  const containerHeight = ref(0)

  /** Whether the container has been measured at least once */
  const isMeasured = computed(() => containerWidth.value > 0 || containerHeight.value > 0)

  // Debounce resize updates: first measurement is immediate, subsequent
  // measurements use a 150ms setTimeout debounce to prevent per-frame
  // full view rebuilds during continuous window resize.
  let resizeTimerId: ReturnType<typeof setTimeout> | null = null

  useResizeObserver(containerElement, (entries) => {
    const entry = entries[0]
    if (!entry) return
    const w = entry.contentRect.width
    const h = entry.contentRect.height

    // Skip if size hasn't actually changed
    if (w === containerWidth.value && h === containerHeight.value) return

    // Immediate first measurement (no delay)
    if (containerWidth.value === 0 && containerHeight.value === 0) {
      containerWidth.value = w
      containerHeight.value = h
      return
    }

    // Subsequent measurements: debounce with 150ms timeout
    if (resizeTimerId !== null) {
      clearTimeout(resizeTimerId)
    }
    resizeTimerId = setTimeout(() => {
      resizeTimerId = null
      containerWidth.value = w
      containerHeight.value = h
    }, 150)
  })

  // Clean up pending timeout on unmount
  onBeforeUnmount(() => {
    if (resizeTimerId !== null) {
      clearTimeout(resizeTimerId)
      resizeTimerId = null
    }
  })

  // Responsive column calculation
  const computedColumns = computed(() => {
    // Explicit override takes priority
    if (columnsOverride.value !== null && columnsOverride.value !== undefined) {
      return Math.max(1, columnsOverride.value)
    }

    // Use the cross-axis dimension for calculating how many items fit
    const isVertical = direction.value === 'vertical'
    const availableSize = isVertical ? containerWidth.value : containerHeight.value
    const cellSize = isVertical ? itemWidth.value : itemHeight.value
    const gap = isVertical ? columnGap.value : rowGap.value

    if (availableSize <= 0 || cellSize <= 0) return minColumns.value

    // How many items fit: floor((available + gap) / (cellSize + gap))
    const rawColumns = Math.floor((availableSize + gap) / (cellSize + gap))
    return Math.max(minColumns.value, Math.min(rawColumns, maxColumns.value))
  })

  // Actual cell dimensions stretched to fill the container.
  // For the cross axis (columns in vertical mode): distribute remaining space
  // evenly across all cells so they fill the full container width.
  // For the main axis (rows in vertical mode): use the requested item size as-is.
  const cellWidth = computed(() => {
    const isVertical = direction.value === 'vertical'
    const cols = computedColumns.value

    if (isVertical) {
      // Cross axis: stretch to fill container width
      const available = containerWidth.value
      if (available <= 0 || cols <= 0) return itemWidth.value
      // available = cols * cellWidth + (cols - 1) * gap
      // cellWidth = (available - (cols - 1) * gap) / cols
      return Math.floor((available - (cols - 1) * columnGap.value) / cols)
    } else {
      // Main axis in horizontal mode: use requested size
      return itemWidth.value
    }
  })

  const cellHeight = computed(() => {
    const isVertical = direction.value === 'vertical'
    const cols = computedColumns.value

    if (isVertical) {
      // Main axis: use requested size
      return itemHeight.value
    } else {
      // Cross axis in horizontal mode: stretch to fill container height
      const available = containerHeight.value
      if (available <= 0 || cols <= 0) return itemHeight.value
      return Math.floor((available - (cols - 1) * rowGap.value) / cols)
    }
  })

  // Effective sizes passed to RecycleScroller for positioning (stride = cell + gap)
  const effectiveItemSize = computed(() => {
    if (direction.value === 'vertical') {
      return cellHeight.value + rowGap.value
    }
    return cellWidth.value + columnGap.value
  })

  const effectiveSecondarySize = computed(() => {
    if (direction.value === 'vertical') {
      return cellWidth.value + columnGap.value
    }
    return cellHeight.value + rowGap.value
  })

  // Content sizes for RecycleScroller view dimensions (without gap)
  const gridViewSize = computed(() => {
    return direction.value === 'vertical' ? cellHeight.value : cellWidth.value
  })

  const gridViewSecondarySize = computed(() => {
    return direction.value === 'vertical' ? cellWidth.value : cellHeight.value
  })

  return {
    containerWidth,
    containerHeight,
    isMeasured,
    computedColumns,
    effectiveItemSize,
    effectiveSecondarySize,
    cellWidth,
    cellHeight,
    gridViewSize,
    gridViewSecondarySize
  }
}
