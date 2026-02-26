# zvue-virtual-scroller: Complete Architecture and Integration Guide

This document is a comprehensive knowledge transfer covering the internal architecture,
data flow, CSS constraints, and integration patterns for every component in
`zvue-virtual-scroller`. It is intended for anyone who needs to understand how the
library works, debug layout issues, or extend the components.

---

## Table of Contents

1. [Architecture Overview](#section-1-architecture-overview)
   - [RecycleScroller: The Foundation](#recyclescroller-the-foundation)
   - [DynamicScroller: Unknown Heights](#dynamicscroller-unknown-heights)
   - [DynamicScrollerItem: Measurement Reporter](#dynamicscrolleritem-measurement-reporter)
   - [GridScroller: Responsive Grid Virtualization](#gridscroller-responsive-grid-virtualization)
   - [Complete Data Flow Diagrams](#complete-data-flow-diagrams)
2. [The Scrolling Height Problem (CRITICAL)](#section-2-the-scrolling-height-problem-critical)
   - [Why Virtual Scrollers Need a Definite Height](#why-virtual-scrollers-need-a-definite-height)
   - [The CSS Flexbox min-height: auto Problem](#the-css-flexbox-min-height-auto-problem)
   - [The Correct CSS Patterns](#the-correct-css-patterns)
   - [Debugging Checklist](#debugging-checklist)

---

## Section 1: Architecture Overview

### RecycleScroller: The Foundation

**File:** `packages/vue-virtual-scroller/src/components/RecycleScroller.vue`

RecycleScroller is the core engine. Every other scroller component in this library
delegates to it. It implements three fundamental mechanisms: **view pooling**,
**absolute positioning**, and **scroll-driven range calculation**.

#### View Pooling

RecycleScroller maintains a **pool** of reusable DOM view objects rather than creating
and destroying DOM nodes as items scroll in and out. This is the key performance
optimization that makes virtual scrolling viable for large lists.

The pool is a flat `ref<InternalView[]>` array. Each `InternalView` has:

```ts
interface InternalView {
  item: VirtualScrollerItem | null | undefined  // The data item
  position: number                               // Main-axis px offset
  offset: number                                 // Cross-axis px offset (grid only)
  nr: {
    id: number              // Unique view ID (monotonically increasing)
    index: number           // Current item index in the items array
    used: boolean           // Whether this view is actively displaying an item
    key: string | number    // The item's key (from keyField)
    type: ViewType          // The item's type (from typeField)
  }
}
```

Two supporting data structures manage the pool:

- **`views: Map<key, InternalView>`** -- Maps item keys to their current view. This
  provides O(1) lookup when checking whether an item already has a view assigned.
- **`recycledPools: Map<ViewType, InternalView[]>`** -- Type-segregated stacks of
  unused views. When a view scrolls out of range, it is pushed into the recycled pool
  for its type. When a new item scrolls in, the scroller first tries to pop a view
  from the matching type pool before creating a new DOM node.

The recycling algorithm in `updateVisibleItems()`:

1. Calculate the new `startIndex` and `endIndex` based on scroll position.
2. If the new range overlaps with the old range (continuous scrolling), recycle only
   the views that fell outside the new range. If there is no overlap (a jump), recycle
   everything.
3. For each index in `[newStartIndex, newEndIndex)`, check if the item already has a
   view (via the `views` Map). If not, try to grab a recycled view of the same type.
   If no recycled view is available, create a brand new one.
4. Assign the item, index, key, and position to the view.

This means the total number of DOM nodes is bounded by the number of items visible
on screen plus the buffer, regardless of how many items are in the list.

#### Absolute Positioning

Every item view is positioned using CSS `position: absolute` within a wrapper div.
The wrapper div has a `minHeight` (or `minWidth` for horizontal) equal to the total
computed size of all items -- this is what creates the scrollbar and makes the
container scrollable.

Each view gets its position via `getViewStyle()`:

```ts
// Default: GPU-accelerated transform positioning
style.transform = `translateY(${view.position}px) translateX(${view.offset}px)`

// Optional: top/left positioning (when disableTransform is true)
style.top = `${view.position}px`
style.left = `${view.offset}px`
```

The `view.position` is computed differently for fixed-size vs variable-size items:

- **Fixed size (`itemSize` is set):** `position = Math.floor(index / gridItems) * itemSize`
- **Variable size (`itemSize` is null):** An accumulator array (`sizeData.entries`)
  stores the cumulative size at each index. The position is `entries[index-1].accumulator`.

#### Scroll Handling

Scroll events drive the entire system. The flow:

1. The `scroll` event fires on the scroller element (passive listener).
2. `handleScroll()` sets `scrollDirty = true` and calls `scheduleScrollUpdate()`.
3. `scheduleScrollUpdate()` uses `requestAnimationFrame` to call `updateVisibleItems()`.
4. `updateVisibleItems()` reads the current scroll position via `getScroll()`, applies
   the `buffer` in both directions, and calculates which item indices are in range.
5. Views are recycled and reassigned as described above.

The `updateInterval` prop throttles updates by adding a `setTimeout` gate: if an
update was dispatched recently, further scroll events are absorbed until the interval
elapses.

For **variable-size items**, finding the start index from a scroll offset uses binary
search (`findIndexFromOffset()`), which runs in O(log n) against the accumulator array.

#### Items Change Detection

RecycleScroller uses a smart O(1) change detection strategy by tracking only the
first key, last key, and length of the items array. This avoids deep-watching the
entire array. The watcher detects:

- **Append:** length grew, first key unchanged -> update without full recycle.
- **Prepend:** length grew, last key unchanged -> adjust scroll position to keep
  viewport stable, then update.
- **Property update (same length, same boundary keys):** Checks only visible item
  sizes for changes; skips update entirely if no sizes changed.
- **Everything else:** Full recycle.

#### ResizeObserver Integration

A `ResizeObserver` watches the scroller container element. When the container resizes
(e.g., window resize, layout change), `handleResize()` fires and triggers
`updateVisibleItems()` via `requestAnimationFrame`. The handler deduplicates by
tracking `lastContainerWidth` and `lastContainerHeight` to prevent infinite loops
from the wrapper's `minHeight` changes triggering resize callbacks.

---

### DynamicScroller: Unknown Heights

**File:** `packages/vue-virtual-scroller/src/components/DynamicScroller.vue`

DynamicScroller wraps RecycleScroller to handle the case where item heights are
**not known in advance**. This is the component you use for chat messages, comments,
user-generated content, or any list where each item's rendered size varies and cannot
be predicted.

#### The Core Problem It Solves

RecycleScroller needs a `size` value per item to compute positions. DynamicScroller
provides this by:

1. Initializing every item with `minItemSize` as a placeholder.
2. Letting `DynamicScrollerItem` children measure their actual rendered size.
3. Feeding measured sizes back into the items array so RecycleScroller can recompute.

#### The Size Store (Batched Non-Reactive Map)

This is the most performance-critical data structure in DynamicScroller:

```ts
const _sizeMap = new Map<string | number, number>()      // Actual sizes (non-reactive)
const _pendingSizeUpdates = new Map<string | number, number>()  // Pending batch
const sizeVersion = ref(0)                                 // Version counter
let _pendingFlush = false
```

Why a plain `Map` instead of a reactive `ref<Map>`? When N visible items mount
simultaneously (e.g., initial render with 20 items on screen), each item measures
its size and calls `updateItemSize()`. If `_sizeMap` were reactive, each `.set()`
call would trigger Vue's reactivity system, causing `itemsWithSize` to recompute
N times -- an O(N*n) cascade.

Instead, size updates are **batched via microtask**:

1. `updateItemSize(key, size)` writes to `_pendingSizeUpdates` and schedules a
   `queueMicrotask(_flushSizeUpdates)` if one is not already pending.
2. When the microtask fires, `_flushSizeUpdates()` drains all pending updates into
   `_sizeMap` and increments `sizeVersion` exactly once.
3. `itemsWithSize` is a `computed` that reads `sizeVersion.value`, so it recomputes
   once per batch, not once per item.

This turns N items mounting = N `updateItemSize` calls = 1 microtask flush = 1
`itemsWithSize` recomputation.

#### itemsWithSize Computed

This is the bridge between DynamicScroller and RecycleScroller:

```ts
const itemsWithSize = computed(() => {
  const _v = sizeVersion.value  // Establish reactive dependency
  return items.value.map(item => ({
    id: key,
    item,                        // The original item (nested)
    size: _sizeMap.get(key) || props.minItemSize,
    isValid: true
  }))
})
```

RecycleScroller receives `itemsWithSize` as its `items` prop. Each wrapper object has
a `size` field, and RecycleScroller reads it via `sizeField` (which defaults to `'size'`).
The `id` field is extracted from the original item's key field.

Note: Because the original item is nested under `.item`, the default slot receives
`itemWithSize` and must destructure `.item` to access the actual data.

#### provide/inject Context

DynamicScroller provides a context object to its children:

```ts
provide('dynamicScrollerContext', {
  updateItemSize,        // Report a measured size
  getItemSize,           // Query current known size
  removeItemSize,        // Clean up on unmount
  sharedResizeObserver,  // Shared observer instance
  direction              // Computed direction ref
})
```

This is how `DynamicScrollerItem` communicates measured sizes back up without needing
explicit event handling or prop drilling.

#### SharedResizeObserver

DynamicScroller creates a single `SharedResizeObserver` instance that is shared across
all `DynamicScrollerItem` children:

```ts
class SharedResizeObserver {
  private observer: ResizeObserver
  private callbacks = new Map<Element, (entry: ResizeObserverEntry) => void>()
  private pendingEntries: ResizeObserverEntry[] = []
  private flushScheduled = false
  // ...
}
```

This solves a critical performance problem: if each DynamicScrollerItem created its
own ResizeObserver, you would have N observers for N visible items. Instead, there is
one ResizeObserver that dispatches to per-element callbacks.

The observer batches its own callbacks too: all resize entries within a single
ResizeObserver callback are collected into `pendingEntries`, then flushed in a
single `queueMicrotask`. Combined with the batched size store, this means:

```
N items resize -> 1 ResizeObserver callback -> N pending entries
-> 1 microtask flush of entries -> N updateItemSize calls
-> 1 microtask flush of size store -> 1 sizeVersion increment
-> 1 itemsWithSize recomputation -> RecycleScroller re-renders
```

---

### DynamicScrollerItem: Measurement Reporter

**File:** `packages/vue-virtual-scroller/src/components/DynamicScrollerItem.vue`

This is the component that wraps each item inside a DynamicScroller's default slot.
Its sole job is to **measure its own rendered size and report it to the parent**.

#### How It Measures

DynamicScrollerItem uses the `useDynamicSize` composable
(`packages/vue-virtual-scroller/src/composables/useDynamicSize.ts`), which:

1. Tracks an `element` ref (the root DOM element of the item).
2. Registers the element with the parent's `SharedResizeObserver` via `setElement()`.
3. On resize, reads `entry.contentRect.height` (or `.width` for horizontal) and
   compares against the current known size with a 0.5px tolerance.
4. If the size changed, calls the `onSizeChange` callback, which triggers
   `syncMeasuredSize()`.

`syncMeasuredSize()` calls `dynamicContext.updateItemSize(itemKey, resolvedSize)`,
which feeds into the batched size store described above.

#### Lifecycle

- **onMounted:** Calls `setElement(element.value)` to register with the shared
  ResizeObserver. Also does an immediate synchronous measurement -- this avoids
  waiting for the async observer callback for the initial render.
- **watch([active, item]):** When the item becomes active or the item reference
  changes, triggers `updateSize()` on the next tick.
- **watch(sizeDependencies):** When `watchData` is true and any dependency in
  `sizeDependencies` changes, triggers a re-measurement. This handles cases where
  content changes (e.g., text updates) without the item reference changing.
- **onUnmounted:** Calls `setElement(null)` to unregister from the ResizeObserver,
  and `dynamicContext.removeItemSize(itemKey)` to clean up the size store.

#### The `active` Prop

This prop is critical. RecycleScroller reuses DOM nodes -- when a view is recycled,
it briefly holds stale content before being assigned new content. The `active` prop
is `true` only when the view is actively displaying its assigned item. Measurements
are only reported when `active` is true, preventing stale sizes from corrupting the
size store.

#### CSS Considerations

DynamicScrollerItem applies `minHeight` (or `minWidth`) equal to `minItemSize`.
This ensures the item always has at least the minimum size, even before its content
renders. The composable enforces `Math.max(measuredSize, minItemSize)` so the
reported size is never below the minimum.

---

### GridScroller: Responsive Grid Virtualization

**File:** `packages/vue-virtual-scroller/src/components/GridScroller.vue`

GridScroller wraps RecycleScroller to display items in a responsive grid layout.
It automatically calculates the number of columns based on container width, item
dimensions, and gap settings.

#### How It Works

GridScroller uses the `useGridLayout` composable
(`packages/vue-virtual-scroller/src/composables/useGridLayout.ts`) to compute grid
parameters, then passes them to RecycleScroller as `gridItems`, `itemSize`, and
`itemSecondarySize`.

#### useGridLayout Composable

This composable manages:

1. **Container measurement:** Uses `@vueuse/core`'s `useResizeObserver` to track the
   container width and height. The first measurement is applied immediately; subsequent
   measurements are debounced (50ms) to prevent layout thrashing during window resize.

2. **Column calculation:**
   ```
   rawColumns = floor((availableSize + gap) / (cellSize + gap))
   computedColumns = clamp(rawColumns, minColumns, maxColumns)
   ```
   If `columns` is explicitly set (not null), it overrides the calculation entirely.

3. **Effective sizes:** RecycleScroller's `itemSize` and `itemSecondarySize` props
   include the gap in the stride:
   ```
   effectiveItemSize = itemHeight + rowGap       // Main axis stride
   effectiveSecondarySize = itemWidth + columnGap // Cross axis stride
   ```

RecycleScroller internally handles grid layout by using modular arithmetic:
- `position = floor(index / gridItems) * itemSize` (row position)
- `offset = (index % gridItems) * itemSecondarySize` (column offset)

#### Slot Props

GridScroller enriches the default slot with grid-specific information:

```ts
{
  item,                              // The data item
  index,                             // Flat index in items array
  active,                            // Whether the view is active
  column: index % computedColumns,   // Zero-based column index
  row: Math.floor(index / computedColumns),  // Zero-based row index
  cellWidth,                         // The configured cell width
  cellHeight                         // The configured cell height
}
```

#### Gap Handling

GridScroller supports three gap props:
- `gap` -- Shorthand that applies to both row and column gaps.
- `rowGap` -- Overrides `gap` for the main axis.
- `columnGap` -- Overrides `gap` for the cross axis.

The resolution is: `resolvedRowGap = props.rowGap || props.gap`.

---

### Complete Data Flow Diagrams

#### RecycleScroller (Fixed Size)

```
items array (prop)
    |
    v
[watch(items)] --> detectChange (append/prepend/replace)
    |
    v
[updateVisibleItems()]
    |
    +-- getScroll() --> { start, end }    (read scrollTop + clientHeight)
    +-- apply buffer                      (start -= buffer, end += buffer)
    +-- calculate newStartIndex/newEndIndex
    |     Fixed: floor(scroll / itemSize) * gridItems
    |     Variable: binary search on accumulator array
    |
    +-- recycle out-of-range views        (push to recycledPools)
    +-- assign in-range items to views    (pop from recycledPools or create new)
    +-- compute view.position/offset
    |     Fixed: floor(i / gridItems) * itemSize
    |     Variable: entries[i-1].accumulator
    |
    +-- update totalSize                  (sets wrapper minHeight for scrollbar)
    +-- emit visible/hidden events
    +-- emit update event
    |
    v
[pool] --> v-for in template --> ItemView components
    |
    v
[getViewStyle(view)] --> transform: translateY(position)px translateX(offset)px
```

#### DynamicScroller + DynamicScrollerItem

```
items array (prop to DynamicScroller)
    |
    v
[itemsWithSize computed] -- reads sizeVersion for reactivity
    |                     -- maps each item to { id, item, size, isValid }
    |                     -- size = _sizeMap.get(key) || minItemSize
    |
    v
RecycleScroller (items=itemsWithSize, itemSize=null, sizeField="size")
    |
    v
[default slot] --> { item: itemWithSize, index, active }
    |                  |
    |                  +--> itemWithSize.item = the real data item
    |
    v
DynamicScrollerItem (receives item, active, sizeDependencies)
    |
    +-- [onMounted] --> setElement(el) --> SharedResizeObserver.observe(el)
    |                    |
    |                    +--> initial measureSize() --> updateItemSize(key, size)
    |
    +-- [ResizeObserver callback] --> handleResizeEntry()
    |                                   |
    |                                   +--> onSizeChange(newSize)
    |                                          |
    |                                          +--> syncMeasuredSize()
    |                                                  |
    |                                                  +--> dynamicContext.updateItemSize(key, size)
    |                                                          |
    |                                                          v
    |                                                  _pendingSizeUpdates.set(key, size)
    |                                                          |
    |                                                          v
    |                                                  queueMicrotask(_flushSizeUpdates)
    |                                                          |
    |                                                          v
    |                                                  _sizeMap updated, sizeVersion++
    |                                                          |
    |                                                          v
    |                                                  itemsWithSize recomputes
    |                                                          |
    |                                                          v
    |                                                  RecycleScroller detects size change
    |                                                          |
    |                                                          v
    |                                                  updateVisibleItems() re-runs
    |
    +-- [watch(active, item)] --> nextTick --> updateSize()
    |
    +-- [watch(sizeDependencies)] --> nextTick --> updateSize()  (only if watchData=true)
    |
    +-- [onUnmounted] --> setElement(null) --> SharedResizeObserver.unobserve(el)
                           |
                           +--> dynamicContext.removeItemSize(key)
```

#### GridScroller

```
items array (prop)
    |
    v
GridScroller
    |
    +-- useGridLayout(containerRef, itemWidth, itemHeight, gaps, min/maxColumns)
    |     |
    |     +-- useResizeObserver(container) --> containerWidth, containerHeight
    |     |
    |     +-- computedColumns = clamp(
    |     |       floor((containerWidth + columnGap) / (itemWidth + columnGap)),
    |     |       minColumns,
    |     |       maxColumns
    |     |   )
    |     |
    |     +-- effectiveItemSize = itemHeight + rowGap
    |     +-- effectiveSecondarySize = itemWidth + columnGap
    |
    v
RecycleScroller (
    items=items,
    itemSize=effectiveItemSize,
    gridItems=computedColumns,
    itemSecondarySize=effectiveSecondarySize
)
    |
    v
Each view positioned:
    position = floor(index / computedColumns) * effectiveItemSize
    offset   = (index % computedColumns) * effectiveSecondarySize
```

---

## Section 2: The Scrolling Height Problem (CRITICAL)

This is the single most common source of bugs when integrating virtual scrollers.
Understanding it deeply will save hours of debugging.

### Why Virtual Scrollers Need a Definite Height

A virtual scroller works by rendering only the items currently visible in a viewport,
plus a buffer above and below. The component reads `scrollTop` and `clientHeight`
from the scroller element to determine what is visible:

```ts
// From RecycleScroller.getScroll()
return {
  start: el.scrollTop,
  end: el.scrollTop + el.clientHeight
}
```

For `clientHeight` to be meaningful, the scroller element must have a **definite
height** -- a height that resolves to a specific pixel value, not one that depends
on its content. If the height is determined by content, the browser will size the
element to fit all its content, meaning:

1. `clientHeight` equals the total content height.
2. `scrollTop` is always 0 (nothing to scroll).
3. `getScroll()` returns `{ start: 0, end: totalContentHeight }`.
4. The scroller calculates that ALL items are "visible" and tries to render them all.
5. This either crashes the browser or defeats the entire purpose of virtualization.

The RecycleScroller has a safety valve for this: `config.itemsLimit` (default 1000).
If `newEndIndex - newStartIndex` exceeds this limit, it throws:

```
[zvue-virtual-scroller] Rendered items limit reached.
Ensure scroller has a fixed size and overflow enabled.
```

If you see this error, the scroller does not have a proper height constraint.

### The CSS Flexbox min-height: auto Problem

This is the specific CSS mechanism that catches most developers. Per the CSS
Flexbox specification (CSS Flexible Box Layout Module Level 1, section 4.5):

> **The default `min-height` of a flex item is `auto`, not `0`.**

What this means in practice:

When you have a flex column layout like this:

```html
<div style="display: flex; flex-direction: column; height: 100%">
  <div class="toolbar">...</div>
  <div class="scroller-container" style="flex: 1">
    <RecycleScroller style="height: 100%" ... />
  </div>
</div>
```

You might expect `.scroller-container` to take up the remaining space and the
RecycleScroller to fill it with `height: 100%`. But here is what actually happens:

1. The flex container distributes space based on `flex-grow`.
2. `.scroller-container` gets `flex: 1`, so it should fill remaining space.
3. **BUT** `.scroller-container` has an implicit `min-height: auto`.
4. `min-height: auto` on a flex item means "the minimum height is the minimum
   content size" -- i.e., the element cannot shrink smaller than its content.
5. RecycleScroller's wrapper div has `minHeight: ${totalSize}px` (could be millions
   of pixels for large lists).
6. This content size propagates up: `.scroller-container` cannot shrink below the
   total list size.
7. The scroller element's `clientHeight` equals the total list height.
8. No scrolling occurs. All items are "visible." The scroller breaks.

The fix is always the same: **explicitly set `min-height: 0` on the flex item that
contains the scroller.**

### The Correct CSS Patterns

#### Pattern 1: Flex Column with min-height: 0

This is the most common pattern and the one used in every demo in this repository.

```css
.page-container {
  display: flex;
  flex-direction: column;
  height: 100%;          /* or a specific height */
}

.toolbar {
  flex: none;            /* Fixed-size header/toolbar */
}

.scroller-area {
  flex: 1 1 0;           /* Grow to fill remaining space */
  min-height: 0;         /* CRITICAL: Override min-height: auto */
}
```

```html
<div class="page-container">
  <div class="toolbar">...</div>
  <RecycleScroller class="scroller-area" :items="items" ... />
</div>
```

This is what the DynamicScrollerDemo does:

```css
/* From DynamicScrollerDemo.vue */
.dynamic-scroller-demo {
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.scroller {
  flex: 1 1 0;
  min-height: 0;    /* <-- THIS IS THE KEY LINE */
}
```

#### Pattern 2: Absolute Positioning

This pattern creates a positioning context and uses absolute positioning to
constrain the scroller. Used in the RecycleScrollerDemo:

```css
.content {
  flex: 100% 1 1;
  position: relative;    /* Positioning context */
}

.wrapper {
  overflow: hidden;
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
}

.scroller {
  width: 100%;
  height: 100%;
}
```

The absolute positioning gives the wrapper a definite height (the height of `.content`),
and then the scroller fills it with `height: 100%`.

#### Pattern 3: Fixed/Known Height

The simplest approach -- just give the scroller a fixed height:

```html
<RecycleScroller style="height: 500px" :items="items" ... />
```

Or via CSS:

```css
.scroller {
  height: calc(100vh - 60px);  /* viewport minus header */
}
```

#### Pattern 4: The Full Chain (html -> body -> #app -> scroller)

For the scroller to fill the viewport, the `height: 100%` chain must be unbroken
from `<html>` down to the scroller element. The demo's `App.vue` establishes this:

```css
/* From App.vue */
html,
body,
#app {
  box-sizing: border-box;
  height: 100%;
}

#app,
.page {
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

/* The route view (last child of #app) gets flex: 1 + min-height: 0 */
#app > :last-child {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}
```

Every link in this chain matters. If any ancestor has `height: auto` (the default),
the `height: 100%` on descendants resolves to nothing, and the scroller breaks.

### The min-height: auto Problem in Detail

Here is a concrete example of the failure mode. Consider this layout:

```html
<div id="app" style="display: flex; flex-direction: column; height: 100vh">
  <nav style="height: 50px">Navigation</nav>
  <main style="flex: 1">
    <DynamicScroller :items="items" :min-item-size="50" style="height: 100%" />
  </main>
</div>
```

What the developer expects:
- `<main>` fills remaining space (100vh - 50px).
- DynamicScroller fills `<main>` with `height: 100%`.
- Scrolling works.

What actually happens:
1. `<main>` is a flex item with `flex: 1` (shorthand for `flex: 1 1 0`).
2. `<main>` has implicit `min-height: auto`.
3. DynamicScroller renders. Its internal wrapper has `minHeight: ${totalSize}px`.
4. `min-height: auto` means `<main>` cannot be smaller than its content.
5. `<main>` grows to `totalSize` pixels (potentially enormous).
6. `height: 100%` on DynamicScroller resolves to `totalSize` pixels.
7. `clientHeight` equals `totalSize`. Nothing scrolls. Everything renders.

The fix:

```html
<main style="flex: 1; min-height: 0">  <!-- Added min-height: 0 -->
```

Or equivalently:

```html
<main style="flex: 1; overflow: hidden">
  <!-- overflow: hidden also establishes a definite height -->
```

Note: `overflow: hidden` (or `overflow: auto`) on a flex item implicitly sets
`min-height: 0` for the purpose of flex layout. This is why the demos often use
`overflow: hidden` on wrapper elements.

### Debugging Checklist

If your virtual scroller is rendering all items, not scrolling, or throwing the
"Rendered items limit reached" error, work through this checklist:

1. **Inspect the scroller element in DevTools.** Look at its computed height.
   - If it equals the total size of all items -> height is not constrained.
   - If it equals the viewport or container size -> height is correctly constrained.

2. **Check the `clientHeight` vs `scrollHeight`.**
   - `clientHeight` should be the visible viewport size (e.g., 500px).
   - `scrollHeight` should be the total virtual size (e.g., 500000px).
   - If `clientHeight === scrollHeight`, the scroller cannot scroll.

3. **Walk up the DOM tree.** For every ancestor between the scroller and the
   element with a definite height (like `<html>` at `100vh`):
   - Does it have `display: flex` and `flex-direction: column`?
   - If yes, does the child flex item have `min-height: 0` or `overflow: hidden`?
   - Does it have `height: 100%` or some other definite height?

4. **Check for missing `height: 100%` in the chain.** The height chain must be
   unbroken. A single `height: auto` in the middle breaks the entire chain.

5. **Check for `overflow: visible` (the default).** The scroller element itself
   needs `overflow: auto` (RecycleScroller sets this in its scoped styles). But
   if a parent element clips or hides overflow incorrectly, scrolling can break.

6. **Page mode exception.** If `pageMode` is true, the scroller does NOT need a
   constrained height. In page mode, it uses `window.innerHeight` as the viewport
   and `getBoundingClientRect()` to determine its position within the page. The
   page itself scrolls, not the scroller element.

### Summary Table

| Layout Technique | How It Provides a Definite Height | Key CSS |
|---|---|---|
| Fixed height | Direct pixel value | `height: 400px` |
| Viewport units | Resolves to pixels | `height: 100vh` |
| calc() | Resolves to pixels | `height: calc(100vh - 60px)` |
| Flex + min-height: 0 | Flex container distributes space | `flex: 1; min-height: 0` |
| Absolute positioning | Inset properties define size | `position: absolute; top: 0; bottom: 0` |
| Grid layout | Grid tracks define size | `grid-template-rows: auto 1fr` |
| overflow: hidden on flex item | Implicitly sets min-height: 0 | `flex: 1; overflow: hidden` |

The fundamental rule: **the scroller element must know its height without asking
its children.** If the height depends on content, virtualization cannot work.
