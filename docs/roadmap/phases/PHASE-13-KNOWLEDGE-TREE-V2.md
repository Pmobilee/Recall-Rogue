# Phase 13: Knowledge Tree 2.0

## Overview

Transform the Knowledge Tree from a static SVG branch-and-leaf visualization into a fully interactive, Obsidian-inspired hierarchical radial tree with zoom-based level-of-detail rendering, cross-fact connection lines, tap-to-view fact cards, Focus Study mode, and mastery-colored completeness visuals.

The existing implementation in `KnowledgeTree.svelte` already has a solid SVG branch layout with cubic bezier curves, mastery coloring, and viewBox-based focus zoom. Phase 13 extends this into a multi-level system that can scale to 5,000+ facts without lag.

**Key design decisions driving this phase:**
- DD-V2-115: Hierarchical radial tree (NOT force-directed graph) — trunk center, branches radiate outward, tap-to-zoom navigation
- DD-V2-116: Three-level LOD — forest view (branch bars only) / branch view (sub-branches) / leaf view (individual facts)
- DD-V2-117: Unknown facts shown as branch-level counts, NOT individual silhouette nodes (exception: 80%+ subcategory completion)
- DD-V2-121: Cross-fact connection lines within branches; "Related" section on fact detail card
- DD-V2-122: Focus Study button on each branch starts filtered SM-2 session (due facts first, then new)
- DD-V2-098: Mastery color progression: greyscale → orange/autumn → green (unified for all fact types)

## Prerequisites

Before starting Phase 13, confirm all of the following:

- [ ] `src/ui/components/KnowledgeTree.svelte` renders without TypeScript errors (`npm run typecheck`)
- [ ] `src/ui/components/KnowledgeTreeView.svelte` navigates to/from the tree without errors
- [ ] `src/services/sm2.ts` exports `getMasteryLevel`, `isDue`, `createReviewState`, `reviewFact`
- [ ] `src/data/types.ts` exports `Fact`, `ReviewState`, `PlayerSave`, `CATEGORIES`
- [ ] `StudySession.svelte` exists and accepts a `facts: Fact[]` prop for filtered study sessions
- [ ] Facts have a hierarchical `category: string[]` field (e.g., `["Language", "Japanese", "N3"]`)
- [ ] The game builds cleanly: `npm run build`

---

## Sub-Phase 13.1: Dynamic Sub-Branch System

### What

Add a second level of branches beneath each main category branch. Each sub-branch represents a discovered subcategory (e.g., `category[1]` = "Japanese" under "Language"). Sub-branches grow organically as the player discovers facts in new subcategories. When a new subcategory is first encountered, animate the sub-branch growing out from the parent branch tip.

This extends the existing `BranchData` structure in `KnowledgeTree.svelte` by adding a `subBranches` array.

### Where

- `src/ui/components/KnowledgeTree.svelte` — add sub-branch data derivation and SVG rendering
- `src/ui/components/KnowledgeTreeView.svelte` — track previously-seen subcategories to trigger growth animations
- `src/data/types.ts` — no changes needed; uses existing `category: string[]`

### How

**Step 1: Extend the data model in KnowledgeTree.svelte**

Add `SubBranchData` and `subBranches` field to `BranchData`:

```typescript
interface SubBranchData {
  subcategory: string          // category[1] value, e.g. "Japanese"
  parentCategory: string       // category[0]
  startX: number               // starts at parent branch tip
  startY: number
  endX: number
  endY: number
  cp1X: number
  cp1Y: number
  cp2X: number
  cp2Y: number
  labelX: number
  labelY: number
  labelAnchor: string
  leaves: LeafData[]
  leafCount: number
  totalCount: number
  completionRatio: number
  isNew: boolean               // true if discovered this session (triggers grow animation)
}

// Add to BranchData:
interface BranchData {
  // ... existing fields ...
  subBranches: SubBranchData[]
  subBranchCount: number
}
```

**Step 2: Compute sub-branch positions**

Sub-branches radiate from the parent branch tip (`endX, endY`) in a fan pattern. The fan spans ±60 degrees from the parent branch direction, divided evenly among all sub-branches.

```typescript
/**
 * Computes layout positions for all sub-branches of a main branch.
 * Sub-branches fan out from the parent tip in the same general direction.
 *
 * @param parent - The parent main branch data
 * @param subcategories - Array of subcategory name strings
 * @param factsPerSub - Map from subcategory name to [learned, total] counts
 * @param leafMap - Map from subcategory to LeafData[]
 * @returns Array of positioned sub-branch data
 */
function computeSubBranches(
  parent: BranchData,
  subcategories: string[],
  factsPerSub: Map<string, { learned: LeafData[]; total: number }>,
): SubBranchData[] {
  const SUB_LENGTH = 60  // px, shorter than main branch
  const FAN_HALF = 55    // degrees; fan is FAN_HALF*2 total spread

  // Parent branch direction angle in degrees (from upward vertical, clockwise)
  const parentAngleDeg = parent.config.angle
  const count = subcategories.length

  return subcategories.map((sub, i): SubBranchData => {
    // Spread sub-branches evenly in fan
    const t = count === 1 ? 0.5 : i / (count - 1)  // 0..1
    const subAngleDeg = parentAngleDeg - FAN_HALF + t * (FAN_HALF * 2)

    const { dx, dy } = branchVector(subAngleDeg, SUB_LENGTH)

    const startX = parent.endX
    const startY = parent.endY
    const endX = startX + dx
    const endY = startY + dy

    // Control points for gentle arc
    const cp1X = startX + dx * 0.3
    const cp1Y = startY + dy * 0.15
    const cp2X = startX + dx * 0.7
    const cp2Y = startY + dy * 0.7

    // Label position: beyond sub-branch tip
    const side = endX > parent.endX ? 'right' : 'left'
    const labelAnchor = side === 'right' ? 'start' : 'end'
    const labelX = endX + (side === 'right' ? 6 : -6)
    const labelY = endY - 6

    const data = factsPerSub.get(sub) ?? { learned: [], total: 0 }
    const completionRatio = data.total > 0 ? data.learned.length / data.total : 0

    return {
      subcategory: sub,
      parentCategory: parent.category,
      startX, startY, endX, endY,
      cp1X, cp1Y, cp2X, cp2Y,
      labelX, labelY, labelAnchor,
      leaves: data.learned,
      leafCount: data.learned.length,
      totalCount: data.total,
      completionRatio,
      isNew: false,  // set by KnowledgeTreeView when first discovered
    }
  })
}
```

**Step 3: Wire into the `treeData` derived computation**

Inside the `treeData = $derived.by(...)` block, after computing the existing `BranchData`, group facts by `category[1]` for each branch and call `computeSubBranches`.

```typescript
// After existing per-branch computation:
const subcategoryMap = new Map<string, { learned: LeafData[]; total: number }>()
for (const fact of categoryFacts) {
  const sub = fact.category[1] ?? 'General'
  if (!subcategoryMap.has(sub)) subcategoryMap.set(sub, { learned: [], total: 0 })
  subcategoryMap.get(sub)!.total++
  if (factStateMap.has(fact.id)) {
    const state = factStateMap.get(fact.id)!
    const leaf: LeafData = {
      x: 0, y: 0,   // placeholder; positioned in computeSubBranches
      mastery: state.mastery,
      due: state.due,
      factId: fact.id,
      subcategory: sub,
    }
    subcategoryMap.get(sub)!.learned.push(leaf)
  }
}
const discoveredSubs = [...subcategoryMap.keys()].filter(
  (sub) => (subcategoryMap.get(sub)?.learned.length ?? 0) > 0
)
const subBranches = computeSubBranches(branchResult, discoveredSubs, subcategoryMap)
```

**Step 4: Add leaf positions to sub-branches**

Leaves in the leaf LOD view are positioned along sub-branch curves (same de Casteljau logic as main branches). Add a helper that distributes `LeafData` along a sub-branch path — copy the existing leaf placement logic from main branch computation, parameterized to use sub-branch control points.

**Step 5: SVG rendering of sub-branches**

Inside the `{#each treeData as branch}` block, add a nested `{#each branch.subBranches as sub}` block. Render each sub-branch as:
- A cubic bezier `<path>` with stroke width 2–4px (based on sub-branch completion ratio)
- A `<text>` label with subcategory name and count ("12/48")
- Apply a `grow` CSS animation when `sub.isNew === true`

```svelte
{#each branch.subBranches as sub (sub.subcategory)}
  <path
    d="M {sub.startX} {sub.startY} C {sub.cp1X} {sub.cp1Y}, {sub.cp2X} {sub.cp2Y}, {sub.endX} {sub.endY}"
    stroke={subBranchColor(sub.completionRatio)}
    stroke-width={1.5 + sub.completionRatio * 3}
    stroke-linecap="round"
    fill="none"
    class={sub.isNew ? 'sub-branch sub-branch--new' : 'sub-branch'}
  />
  <text x={sub.labelX} y={sub.labelY} text-anchor={sub.labelAnchor}
        font-family="'Courier New', monospace" font-size="8" fill="#a0a0b8">
    {sub.subcategory}
  </text>
  <text x={sub.labelX} y={sub.labelY + 10} text-anchor={sub.labelAnchor}
        font-family="'Courier New', monospace" font-size="7" fill="#606070">
    {sub.leafCount}/{sub.totalCount}
  </text>
{/each}
```

**Step 6: Growth animation CSS**

Add to the `<style>` block in `KnowledgeTree.svelte`:

```css
@keyframes sub-branch-grow {
  from { stroke-dashoffset: 80; opacity: 0; }
  to   { stroke-dashoffset: 0;  opacity: 1; }
}

:global(.sub-branch--new) {
  stroke-dasharray: 80;
  stroke-dashoffset: 80;
  animation: sub-branch-grow 0.6s ease-out forwards;
}
```

**Step 7: Track newly discovered subcategories in KnowledgeTreeView**

In `KnowledgeTreeView.svelte`, store a `$state` set of previously seen subcategories in `localStorage`. On each `$derived` recompute, compare the current set of discovered subcategories to the stored set. Any new entries get the `isNew` flag. After 2 seconds, mark them as seen and persist.

```typescript
// KnowledgeTreeView.svelte
const SEEN_KEY = 'terra_seen_subcats'
let seenSubcats = $state<Set<string>>(
  new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]'))
)

// After treeData stabilizes (use $effect):
$effect(() => {
  const allNow = treeData.flatMap(b => b.subBranches.map(s => `${b.category}::${s.subcategory}`))
  const newOnes = allNow.filter(k => !seenSubcats.has(k))
  if (newOnes.length === 0) return
  // Mark new ones after animation completes
  setTimeout(() => {
    seenSubcats = new Set([...seenSubcats, ...newOnes])
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seenSubcats]))
  }, 1500)
})
```

Pass `seenSubcats` into the `KnowledgeTree` component as a prop so sub-branches can set `isNew` based on it.

### Acceptance Criteria

- [ ] Each discovered subcategory (category[1]) produces a visible sub-branch below its parent main branch
- [ ] Sub-branch label shows "{leafCount}/{totalCount}" fact counts
- [ ] First time a sub-branch appears in the session, it animates growing outward (stroke-dasharray animation, ~0.6s)
- [ ] Sub-branch color reflects completion ratio using same color ramp as main branches
- [ ] Facts without a category[1] fall into an implicit "General" sub-branch
- [ ] No TypeScript errors: `npm run typecheck`
- [ ] With 50+ subcategories across all categories, sub-branches do not overlap their parent branch curve

### Playwright Test

Write to `/tmp/test-13-1.js` and run with `node /tmp/test-13-1.js`:

```javascript
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  // Navigate to Knowledge Tree
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  // Assume a nav path exists; adjust selector to match actual routing
  await page.evaluate(() => {
    // Trigger navigation to tree view via store or direct route
    window.dispatchEvent(new CustomEvent('test-nav', { detail: 'knowledge-tree' }))
  })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: '/tmp/ss-tree-13-1.png' })
  // Verify sub-branch SVG paths exist
  const subPaths = await page.$$('path.sub-branch')
  console.log('Sub-branch paths found:', subPaths.length)
  if (subPaths.length === 0) {
    console.error('FAIL: No sub-branch paths rendered')
    process.exit(1)
  }
  console.log('PASS: Sub-branches rendered')
  await browser.close()
})()
```

---

## Sub-Phase 13.2: Hierarchical Radial Tree with LOD Rendering

### What

Implement three-level LOD (Level of Detail) rendering as specified in DD-V2-116. The tree has three zoom states:

1. **Forest view** (default, full zoom-out): Only main branch lines with colored progress bars. No leaf nodes. Shows completion % per branch as a labeled arc or thick colored segment.
2. **Branch view** (tap a main branch): Sub-branches become visible with their leaf counts. Still no individual leaf nodes.
3. **Leaf view** (tap a sub-branch): Individual leaf nodes render for that sub-branch only. Cross-fact connection lines (DD-V2-121) are visible at this level.

Implement smooth SVG viewBox transitions between zoom levels. Add pinch-to-zoom gesture support for mobile.

### Where

- `src/ui/components/KnowledgeTree.svelte` — LOD state machine, conditional rendering, viewBox animation
- `src/ui/components/KnowledgeTreeView.svelte` — expose LOD controls, zoom state, handle tap events
- New file: `src/ui/components/tree/TreeLOD.ts` — LOD state type and transition helpers

### How

**Step 1: Define LOD state type in TreeLOD.ts**

```typescript
// src/ui/components/tree/TreeLOD.ts

/** The three zoom levels of the Knowledge Tree. */
export type TreeLODLevel = 'forest' | 'branch' | 'leaf'

/** Complete LOD navigation state. */
export interface TreeLODState {
  level: TreeLODLevel
  /** Set when level === 'branch' or 'leaf' */
  focusedCategory: string | null
  /** Set when level === 'leaf' */
  focusedSubcategory: string | null
}

/** Returns the initial (fully zoomed out) LOD state. */
export function initialLOD(): TreeLODState {
  return { level: 'forest', focusedCategory: null, focusedSubcategory: null }
}

/** Produce next state when tapping a main branch. */
export function zoomToBranch(category: string): TreeLODState {
  return { level: 'branch', focusedCategory: category, focusedSubcategory: null }
}

/** Produce next state when tapping a sub-branch. */
export function zoomToLeaf(category: string, subcategory: string): TreeLODState {
  return { level: 'leaf', focusedCategory: category, focusedSubcategory: subcategory }
}

/** Go back one level. */
export function zoomOut(state: TreeLODState): TreeLODState {
  if (state.level === 'leaf') {
    return { level: 'branch', focusedCategory: state.focusedCategory, focusedSubcategory: null }
  }
  return initialLOD()
}
```

**Step 2: LOD-aware viewBox computation**

Extend the existing `computeFocusViewBox` function to handle sub-branch focus (leaf view). When `focusedSubcategory` is set, compute bounding box from only that sub-branch's start/end/leaves with 40px padding.

```typescript
/**
 * Computes the SVG viewBox string for the current LOD state.
 * @param state - Current LOD navigation state
 * @param treeData - Computed branch layout data
 */
function computeViewBoxForLOD(
  state: TreeLODState,
  treeData: BranchData[]
): string {
  const FULL = `0 0 ${VW} ${VH}`
  if (state.level === 'forest') return FULL

  const branch = treeData.find(b => b.category === state.focusedCategory)
  if (!branch) return FULL

  if (state.level === 'branch') {
    // Show the entire branch including all its sub-branches
    return computeFocusViewBox(branch)
  }

  // Leaf level: zoom into specific sub-branch
  const sub = branch.subBranches.find(s => s.subcategory === state.focusedSubcategory)
  if (!sub) return computeFocusViewBox(branch)

  const PADDING = 40
  const xs = [sub.startX, sub.endX, sub.labelX, ...sub.leaves.map(l => l.x)]
  const ys = [sub.startY, sub.endY, sub.labelY, ...sub.leaves.map(l => l.y)]
  const minX = Math.min(...xs) - PADDING
  const maxX = Math.max(...xs) + PADDING
  const minY = Math.min(...ys) - PADDING
  const maxY = Math.max(...ys) + PADDING

  const rawW = maxX - minX
  const rawH = maxY - minY
  const targetAspect = VW / VH
  let w = rawW, h = rawH
  if (w / h > targetAspect) { h = w / targetAspect } else { w = h * targetAspect }
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  return `${cx - w/2} ${cy - h/2} ${w} ${h}`
}
```

**Step 3: LOD-conditional rendering**

Replace the single `{#if}` leaf rendering block with LOD-gated rendering. Use Svelte 5 `$derived` to compute what is visible at each level:

```svelte
<!-- In the {#each treeData as branch} block: -->

<!-- FOREST LEVEL: progress bar arc only (no leaves, no sub-branches) -->
{#if lod.level === 'forest'}
  <!-- Draw thick colored arc showing completion ratio along branch curve -->
  <!-- Use stroke-dasharray trick: dasharray = [ratio * pathLength, pathLength] -->
  <path
    d="M {branch.startX} {branch.startY} C ..."
    stroke={branchColor}
    stroke-width={6 + branch.completionRatio * 8}
    stroke-linecap="round"
    fill="none"
  />
  <!-- Completion percentage label near branch tip -->
  <text x={branch.labelX} y={branch.labelY + 24} ...>
    {Math.round(branch.completionRatio * 100)}%
  </text>
{/if}

<!-- BRANCH LEVEL: show sub-branches, hide leaf nodes -->
{#if lod.level === 'branch' && lod.focusedCategory === branch.category}
  {#each branch.subBranches as sub}
    <!-- sub-branch path -->
    <!-- sub-branch label with counts -->
    <!-- tap target for sub-branch to advance to leaf view -->
    <rect
      x={sub.startX - 10} y={Math.min(sub.startY, sub.endY) - 10}
      width={Math.abs(sub.endX - sub.startX) + 20}
      height={Math.abs(sub.endY - sub.startY) + 20}
      fill="transparent"
      style="cursor: pointer"
      onclick={() => onSubBranchTap(branch.category, sub.subcategory)}
      role="button"
      aria-label="Zoom into {sub.subcategory}"
    />
  {/each}
{/if}

<!-- LEAF LEVEL: show individual leaf nodes for focused sub-branch only -->
{#if lod.level === 'leaf' && lod.focusedCategory === branch.category}
  {@const activeSub = branch.subBranches.find(s => s.subcategory === lod.focusedSubcategory)}
  {#if activeSub}
    {#each activeSub.leaves as leaf}
      <circle cx={leaf.x} cy={leaf.y} r={5} fill={MASTERY_COLOR[leaf.mastery]} ... />
    {/each}
  {/if}
{/if}
```

**Step 4: Tap event handlers**

In `KnowledgeTreeView.svelte`, hold `lod` state as `$state<TreeLODState>(initialLOD())`. Pass callbacks to `KnowledgeTree.svelte` as props:

```typescript
// KnowledgeTreeView.svelte
import { initialLOD, zoomToBranch, zoomToLeaf, zoomOut } from './tree/TreeLOD.ts'

let lod = $state(initialLOD())

function onMainBranchTap(category: string) {
  lod = zoomToBranch(category)
}

function onSubBranchTap(category: string, subcategory: string) {
  lod = zoomToLeaf(category, subcategory)
}

function onBackButton() {
  lod = zoomOut(lod)
}
```

**Step 5: Smooth viewBox transitions**

The existing CSS `transition: viewBox 0.6s ease-in-out` on `.knowledge-tree-svg` handles the animation. Verify this still works after the viewBox changes are wired to `lod` state. The SVG `viewBox` attribute change triggers the CSS transition automatically in modern browsers.

**Step 6: Pinch-to-zoom mobile gesture**

Add a touch event handler to the SVG element to detect pinch gestures. Use the ratio of touch distance change to scale the viewBox zoom level. Keep it simple — only trigger zoom level transitions (do not implement continuous zoom scale):

```typescript
// In KnowledgeTree.svelte script
let pinchStartDist = 0

function onTouchStart(e: TouchEvent) {
  if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX
    const dy = e.touches[0].clientY - e.touches[1].clientY
    pinchStartDist = Math.hypot(dx, dy)
  }
}

function onTouchEnd(e: TouchEvent) {
  if (pinchStartDist > 0 && e.changedTouches.length >= 1) {
    // Pinch out = zoom in (advance LOD), pinch in = zoom back
    // Handled via dispatching events upward to KnowledgeTreeView
    pinchStartDist = 0
  }
}
```

Dispatch `CustomEvent('tree-pinch-out')` / `('tree-pinch-in')` from the SVG element, handled in `KnowledgeTreeView.svelte` to call `zoomToBranch` or `zoomOut`.

**Step 7: Performance — cull invisible nodes**

At forest level, skip rendering all leaf circles and sub-branch paths. At branch level, skip rendering leaf circles for ALL sub-branches except the focused one. This is purely conditional rendering controlled by `lod.level` — Svelte 5 `{#if}` already skips DOM creation for false conditions, so no extra virtual/canvas approach is needed at this scale.

For 5,000+ facts at leaf level, apply a viewport culling check: only render leaves whose SVG coordinates fall within the current viewBox bounds (add ±50px margin). Compute current viewBox bounds from the `computeViewBoxForLOD` result and skip `<circle>` elements outside.

```typescript
// Helper used in leaf rendering
function isInViewBox(x: number, y: number, vb: string): boolean {
  const [vx, vy, vw, vh] = vb.split(' ').map(Number)
  return x >= vx - 50 && x <= vx + vw + 50 && y >= vy - 50 && y <= vy + vh + 50
}
```

### Acceptance Criteria

- [ ] Forest view renders only main branch lines with completion % labels — no individual leaf circles visible
- [ ] Tapping a main branch in forest view zooms smoothly (SVG viewBox transition) to branch view showing sub-branches
- [ ] Tapping a sub-branch zooms to leaf view showing that sub-branch's leaf nodes
- [ ] Back button in `KnowledgeTreeView.svelte` calls `zoomOut()` and transitions back one level
- [ ] LOD transitions are smooth (CSS transition visible, no jump)
- [ ] With 500 facts at leaf level, render time stays under 16ms (no jank) — verify with Chrome DevTools Performance tab
- [ ] Pinch-out gesture on mobile triggers zoom-in to branch level
- [ ] `npm run typecheck` passes with zero errors
- [ ] `src/ui/components/tree/TreeLOD.ts` compiles cleanly

### Playwright Test

```javascript
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

  // Navigate to Knowledge Tree (adjust selector to match actual nav)
  // ... (navigate steps here)
  await page.waitForTimeout(1500)

  // Take forest-view screenshot
  await page.screenshot({ path: '/tmp/ss-tree-forest.png' })

  // Tap a main branch to enter branch view
  const branchPath = await page.$('path[data-category="Language"]')
  if (branchPath) {
    await branchPath.click()
    await page.waitForTimeout(700)  // wait for zoom transition
    await page.screenshot({ path: '/tmp/ss-tree-branch.png' })
  }

  // Tap a sub-branch to enter leaf view
  const subPath = await page.$('path[data-subcategory]')
  if (subPath) {
    await subPath.click()
    await page.waitForTimeout(700)
    await page.screenshot({ path: '/tmp/ss-tree-leaf.png' })
  }

  // Tap back button
  const backBtn = await page.$('button[aria-label="Back one level"]')
  if (backBtn) {
    await backBtn.click()
    await page.waitForTimeout(700)
    await page.screenshot({ path: '/tmp/ss-tree-back.png' })
  }

  console.log('Screenshots saved to /tmp/ss-tree-*.png')
  await browser.close()
})()
```

---

## Sub-Phase 13.3: Toggle Views (Show All / Learned Only)

### What

Add a toggle button in the `KnowledgeTreeView.svelte` header: **"All Facts"** vs **"Learned Only"**. In "All Facts" mode, follow the DD-V2-117 rule: show branch-level counts ("34 learned / 312 total") — do NOT show individual unlearned facts as silhouette nodes. Exception: within any subcategory at 80%+ completion, show the individual missing fact silhouettes to drive completionist behavior.

### Where

- `src/ui/components/KnowledgeTreeView.svelte` — toggle state, UI button
- `src/ui/components/KnowledgeTree.svelte` — two new props: `showMode` and silhouette rendering logic

### How

**Step 1: Add toggle state and button in KnowledgeTreeView.svelte**

```svelte
<!-- KnowledgeTreeView.svelte -->
<script>
  let showMode = $state<'learned' | 'all'>('learned')
</script>

<!-- In the header, next to Back button: -->
<button
  type="button"
  class="toggle-btn"
  onclick={() => showMode = showMode === 'learned' ? 'all' : 'learned'}
  aria-label="Toggle show all facts or learned only"
>
  {showMode === 'learned' ? 'Show All' : 'Learned Only'}
</button>
```

**Step 2: Add `showMode` prop to KnowledgeTree.svelte**

```typescript
// KnowledgeTree.svelte Props
interface Props {
  facts: Fact[]
  focusCategory?: string | null
  lod: TreeLODState
  showMode: 'learned' | 'all'
  onMainBranchTap: (category: string) => void
  onSubBranchTap: (category: string, subcategory: string) => void
  onLeafTap: (factId: string) => void
}
```

**Step 3: Compute silhouette nodes for 80%+ subcategories**

In the `treeData` derivation, for each sub-branch, when `showMode === 'all'` and `completionRatio >= 0.8`, collect the unlearned facts and add them as `silhouetteLeaves` — a separate array of positions showing what's still missing:

```typescript
// Inside treeData $derived.by, per sub-branch:
const unlearnedInSub = subcategoryFacts.filter(f => !factStateMap.has(f.id))
const silhouetteLeaves: LeafData[] = (showMode === 'all' && completionRatio >= 0.8)
  ? unlearnedInSub.map((f, i) => {
      // Position silhouettes near end of sub-branch with seeded jitter
      const t = 0.6 + (i / Math.max(unlearnedInSub.length - 1, 1)) * 0.35
      // ... de Casteljau positioning same as learned leaves but at sub-branch t
      return { x, y, mastery: 'new', due: false, factId: f.id, isSilhouette: true }
    })
  : []
```

Add `isSilhouette?: boolean` to the `LeafData` interface.

**Step 4: Render silhouette nodes**

In the leaf view SVG rendering, after the learned leaf circles, render silhouette circles:

```svelte
<!-- Silhouette nodes for missing facts at 80%+ subcategory completion -->
{#each activeSub.silhouetteLeaves as leaf (leaf.factId)}
  <circle
    cx={leaf.x}
    cy={leaf.y}
    r={4}
    fill="none"
    stroke="#444455"
    stroke-width="1"
    stroke-dasharray="2 2"
    opacity="0.5"
    aria-label="Undiscovered fact"
  />
  <!-- "?" label inside silhouette -->
  <text x={leaf.x} y={leaf.y + 3} text-anchor="middle"
        font-size="5" fill="#444455" opacity="0.6">?</text>
{/each}
```

**Step 5: Branch-level count display for "All Facts" mode**

At forest and branch LOD levels in "All Facts" mode, update the branch label to display `{leafCount}/{totalCount}`. This already partially exists — ensure `totalCount` reflects ALL facts in the database for that category (not just learned). The `totalCount` computation must query `facts.filter(f => f.category[0] === category).length`.

**Step 6: Branch thickness in "All Facts" mode**

In "All Facts" mode at forest level, draw a background progress bar behind the main branch to show potential completion. Render a light grey branch at full width beneath the colored branch:

```svelte
<!-- Background "potential" branch at forest level in all-facts mode -->
{#if showMode === 'all' && lod.level === 'forest'}
  <path d="M {branch.startX} {branch.startY} C ..."
        stroke="#2a2a3a" stroke-width="14" stroke-linecap="round" fill="none" />
{/if}
<!-- Foreground colored completion branch -->
<path d="M {branch.startX} {branch.startY} C ..."
      stroke={branchColor}
      stroke-width={showMode === 'all' ? 6 + branch.completionRatio * 8 : branchStrokeWidth}
      .../>
```

### Acceptance Criteria

- [ ] "Show All" / "Learned Only" toggle button visible in tree header
- [ ] In "Learned Only" mode: only learned facts show as leaf nodes; branch labels show learned count only
- [ ] In "All Facts" mode: branch labels show "learned/total" counts; no individual silhouettes for sub-branches under 80% completion
- [ ] In "All Facts" mode: sub-branches at 80%+ completion show individual silhouette circles (dashed outline, "?" text) for unlearned facts
- [ ] Toggle switches instantly without page reload or animation flicker
- [ ] `npm run typecheck` passes

### Playwright Test

```javascript
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  // ... navigate to Knowledge Tree ...
  await page.waitForTimeout(1500)

  // Screenshot in "Learned Only" mode (default)
  await page.screenshot({ path: '/tmp/ss-tree-learned-only.png' })

  // Click toggle to "Show All"
  await page.click('button[aria-label="Toggle show all facts or learned only"]')
  await page.waitForTimeout(300)
  await page.screenshot({ path: '/tmp/ss-tree-all-facts.png' })

  // Verify silhouette circles exist (dashed stroke)
  const silhouettes = await page.$$('circle[stroke-dasharray="2 2"]')
  console.log('Silhouette nodes:', silhouettes.length)

  // Toggle back
  await page.click('button[aria-label="Toggle show all facts or learned only"]')
  await page.waitForTimeout(300)
  await page.screenshot({ path: '/tmp/ss-tree-learned-again.png' })

  await browser.close()
})()
```

---

## Sub-Phase 13.4: Tap-to-View Facts + Focus Study

### What

When a player taps a leaf node in the leaf LOD view, open a fact detail card overlay showing the full fact: question, correct answer, explanation, GAIA comment, pixel art image (if available), and a "Related" section for connected facts (DD-V2-121). Long-press on a leaf starts an immediate single-fact review. Swipe left/right navigates to adjacent facts within the same sub-branch.

Additionally, each branch and sub-branch header gets a **Focus Study** button (DD-V2-122) that starts a `StudySession` filtered to only the facts in that branch, with due facts first.

### Where

- New file: `src/ui/components/tree/FactDetailCard.svelte` — the full-screen fact overlay
- `src/ui/components/KnowledgeTree.svelte` — leaf tap/longpress handlers, swipe state
- `src/ui/components/KnowledgeTreeView.svelte` — orchestrate FactDetailCard and Focus Study launch
- `src/ui/components/StudySession.svelte` — must accept `filterFactIds?: string[]` prop (may already exist or needs adding)

### How

**Step 1: Create FactDetailCard.svelte**

This component is a full-screen modal overlay. It receives a `Fact`, the player's `ReviewState` for that fact, all `Fact[]` in the same sub-branch (for swipe navigation), and callbacks for `onClose` and `onStartReview`.

```svelte
<!-- src/ui/components/tree/FactDetailCard.svelte -->
<script lang="ts">
  import type { Fact, ReviewState } from '../../../data/types'
  import { getMasteryLevel } from '../../../services/sm2'

  interface Props {
    fact: Fact
    reviewState: ReviewState | null
    siblingFacts: Fact[]  // same sub-branch, for swipe navigation
    onClose: () => void
    onStartReview: (factId: string) => void
    onNavigate: (factId: string) => void  // swipe to adjacent fact
  }
  let { fact, reviewState, siblingFacts, onClose, onStartReview, onNavigate }: Props = $props()

  const mastery = $derived(reviewState ? getMasteryLevel(reviewState) : 'new')
  const currentIndex = $derived(siblingFacts.findIndex(f => f.id === fact.id))

  // Touch swipe state
  let touchStartX = 0
  function onTouchStart(e: TouchEvent) { touchStartX = e.touches[0].clientX }
  function onTouchEnd(e: TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchStartX
    if (Math.abs(dx) < 50) return
    if (dx < 0 && currentIndex < siblingFacts.length - 1) {
      onNavigate(siblingFacts[currentIndex + 1].id)
    } else if (dx > 0 && currentIndex > 0) {
      onNavigate(siblingFacts[currentIndex - 1].id)
    }
  }

  const MASTERY_LABEL: Record<string, string> = {
    new: 'New', learning: 'Learning', familiar: 'Familiar',
    known: 'Known', mastered: 'Mastered'
  }
  const MASTERY_COLOR_MAP: Record<string, string> = {
    new: '#555566', learning: '#8a5c30', familiar: '#c87830',
    known: '#5a9060', mastered: '#4ecca3'
  }
</script>

<div class="fact-card-overlay"
     role="dialog" aria-modal="true" aria-label="Fact detail"
     ontouchstart={onTouchStart} ontouchend={onTouchEnd}>
  <div class="fact-card">
    <!-- Header: mastery badge + close -->
    <header class="card-header">
      <span class="mastery-badge" style="color: {MASTERY_COLOR_MAP[mastery]}">
        {MASTERY_LABEL[mastery]}
      </span>
      <div class="nav-hint" aria-label="Swipe to navigate">
        {currentIndex + 1} / {siblingFacts.length}
      </div>
      <button class="close-btn" type="button" onclick={onClose} aria-label="Close fact card">
        &times;
      </button>
    </header>

    <!-- Fact content -->
    <div class="card-body">
      {#if fact.imageUrl}
        <img src={fact.imageUrl} alt="Illustration for {fact.statement}"
             class="fact-image" loading="lazy" />
      {/if}

      <div class="fact-category">
        {fact.category.join(' › ')}
      </div>

      <h2 class="fact-question">{fact.quizQuestion}</h2>
      <p class="fact-answer">{fact.correctAnswer}</p>

      {#if fact.wowFactor}
        <div class="wow-factor">
          <span class="wow-label">WOW:</span> {fact.wowFactor}
        </div>
      {/if}

      <p class="fact-explanation">{fact.explanation}</p>

      {#if fact.gaiaComment}
        <div class="gaia-comment">
          <span class="gaia-label">G.A.I.A.:</span> {fact.gaiaComment}
        </div>
      {/if}

      <!-- Related facts section (DD-V2-121) -->
      <!-- related_facts field is not yet in Fact type; show placeholder until Phase 11 adds it -->
    </div>

    <!-- Action buttons -->
    <footer class="card-footer">
      <button
        type="button"
        class="review-btn"
        onclick={() => onStartReview(fact.id)}
        aria-label="Review this fact now"
      >
        Review Now
      </button>
    </footer>
  </div>
</div>

<style>
  .fact-card-overlay {
    position: fixed;
    inset: 0;
    z-index: 60;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: env(safe-area-inset-bottom);
  }

  .fact-card {
    background: var(--color-surface);
    border-radius: 16px 16px 0 0;
    width: 100%;
    max-width: 640px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    font-family: 'Courier New', monospace;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px 8px;
    border-bottom: 1px solid color-mix(in srgb, var(--color-text-dim) 20%, transparent 80%);
    flex-shrink: 0;
  }

  .mastery-badge {
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .nav-hint {
    font-size: 0.72rem;
    color: var(--color-text-dim);
  }

  .close-btn {
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    color: var(--color-text-dim);
    font-size: 1.4rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
  }

  .close-btn:hover { background: color-mix(in srgb, var(--color-text-dim) 15%, transparent 85%); }

  .card-body {
    flex: 1 1 0;
    overflow-y: auto;
    padding: 16px;
    -webkit-overflow-scrolling: touch;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .fact-image {
    width: 100%;
    max-height: 140px;
    object-fit: contain;
    image-rendering: pixelated;
    border-radius: 8px;
  }

  .fact-category {
    font-size: 0.7rem;
    color: var(--color-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .fact-question {
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-text);
    margin: 0;
    line-height: 1.4;
  }

  .fact-answer {
    font-size: 0.95rem;
    color: var(--color-success);
    font-weight: 600;
    margin: 0;
  }

  .wow-factor {
    font-size: 0.85rem;
    color: var(--color-warning);
    background: color-mix(in srgb, var(--color-warning) 8%, var(--color-surface) 92%);
    border-left: 3px solid var(--color-warning);
    padding: 8px 12px;
    border-radius: 0 6px 6px 0;
  }

  .wow-label { font-weight: 700; }

  .fact-explanation {
    font-size: 0.85rem;
    color: var(--color-text-dim);
    margin: 0;
    line-height: 1.5;
  }

  .gaia-comment {
    font-size: 0.82rem;
    color: var(--color-primary);
    font-style: italic;
    border-top: 1px solid color-mix(in srgb, var(--color-primary) 20%, transparent 80%);
    padding-top: 8px;
  }

  .gaia-label { font-style: normal; font-weight: 700; }

  .card-footer {
    padding: 12px 16px;
    border-top: 1px solid color-mix(in srgb, var(--color-text-dim) 20%, transparent 80%);
    flex-shrink: 0;
    display: flex;
    gap: 10px;
  }

  .review-btn {
    flex: 1;
    height: 44px;
    border-radius: 10px;
    border: 1px solid var(--color-primary);
    background: color-mix(in srgb, var(--color-primary) 20%, var(--color-surface) 80%);
    color: var(--color-primary);
    font-family: 'Courier New', monospace;
    font-size: 0.88rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 150ms ease;
  }

  .review-btn:active {
    background: color-mix(in srgb, var(--color-primary) 35%, var(--color-surface) 65%);
  }
</style>
```

**Step 2: Leaf tap handling in KnowledgeTree.svelte**

Add `data-fact-id` attributes to leaf circle elements and wire `onclick` to emit a `onLeafTap(factId)` callback prop:

```svelte
<!-- In leaf rendering loop: -->
<circle
  cx={leaf.x} cy={leaf.y} r={isMastered ? 6 : 5}
  fill={MASTERY_COLOR[leaf.mastery]}
  data-fact-id={leaf.factId}
  style="cursor: pointer"
  onclick={() => onLeafTap(leaf.factId)}
  role="button"
  tabindex="0"
  aria-label="View fact: {leaf.mastery} mastery"
  onkeydown={(e) => e.key === 'Enter' && onLeafTap(leaf.factId)}
/>
```

**Step 3: Long-press to start review**

Add long-press detection to leaf circles using `ontouchstart` / `ontouchend` pair. If the touch duration exceeds 500ms without movement, treat as long-press:

```typescript
let longPressTimer: ReturnType<typeof setTimeout> | null = null

function onLeafTouchStart(factId: string) {
  longPressTimer = setTimeout(() => {
    onLeafLongPress(factId)
    longPressTimer = null
  }, 500)
}

function onLeafTouchEnd() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}
```

Pass `onLeafLongPress` as a prop from `KnowledgeTreeView.svelte` to start an immediate single-fact review (opens `StudySession` with just that one fact).

**Step 4: Focus Study button in branch/sub-branch view**

In the branch view LOD, add a "Focus Study" button beneath the sub-branch list. In the leaf view, add one at the top of the view for the current sub-branch.

In `KnowledgeTreeView.svelte`:

```svelte
<!-- Show when lod.level is 'branch' or 'leaf' -->
{#if lod.level !== 'forest' && lod.focusedCategory}
  <div class="focus-study-bar">
    <button type="button" class="focus-study-btn"
            onclick={startFocusStudy}
            aria-label="Start focused study session for {lod.focusedSubcategory ?? lod.focusedCategory}">
      Focus Study: {lod.focusedSubcategory ?? lod.focusedCategory}
    </button>
  </div>
{/if}
```

The `startFocusStudy` function collects fact IDs for the focused category/subcategory, sorted with due facts first:

```typescript
function startFocusStudy() {
  const save = $playerSave
  if (!save || !lod.focusedCategory) return

  // Gather fact IDs for focused scope
  let scopeFacts = allFacts.filter(f => f.category[0] === lod.focusedCategory)
  if (lod.focusedSubcategory) {
    scopeFacts = scopeFacts.filter(f => (f.category[1] ?? 'General') === lod.focusedSubcategory)
  }

  // Sort: due learned facts first, then unlearned new facts
  const learnedSet = new Set(save.learnedFacts)
  const due = scopeFacts.filter(f => {
    if (!learnedSet.has(f.id)) return false
    const rs = save.reviewStates.find(s => s.factId === f.id)
    return rs ? isDue(rs) : true
  })
  const newFacts = scopeFacts.filter(f => !learnedSet.has(f.id))
  const notDue = scopeFacts.filter(f => learnedSet.has(f.id) && !due.find(d => d.id === f.id))

  const ordered = [...due, ...newFacts, ...notDue]
  focusStudyFacts = ordered  // $state array
  showStudySession = true    // triggers StudySession overlay
}
```

**Step 5: StudySession filtered mode**

If `StudySession.svelte` does not already accept a `filterFacts?: Fact[]` prop, add it. When provided, it overrides the default "all due facts" queue with the filtered set. The internal SM-2 queue logic should be unchanged — just swap the input fact array.

**Step 6: Wire FactDetailCard into KnowledgeTreeView**

```svelte
<!-- KnowledgeTreeView.svelte template -->
{#if detailFact}
  <FactDetailCard
    fact={detailFact}
    reviewState={$playerSave?.reviewStates.find(s => s.factId === detailFact.id) ?? null}
    siblingFacts={currentSubBranchFacts}
    onClose={() => detailFact = null}
    onStartReview={handleStartReview}
    onNavigate={(id) => detailFact = allFacts.find(f => f.id === id) ?? null}
  />
{/if}

{#if showStudySession}
  <StudySession
    facts={focusStudyFacts}
    onClose={() => showStudySession = false}
  />
{/if}
```

### Acceptance Criteria

- [ ] Tapping a leaf node in leaf LOD view opens `FactDetailCard` overlay showing question, answer, explanation, GAIA comment
- [ ] FactDetailCard shows "X / N" navigation counter for the current sub-branch
- [ ] Swiping left/right in FactDetailCard navigates to adjacent facts in the sub-branch
- [ ] Long-pressing a leaf opens `StudySession` with that single fact
- [ ] "Focus Study" button appears in branch view and leaf view headers
- [ ] Tapping "Focus Study" at branch level opens `StudySession` filtered to that category's facts (due first)
- [ ] Tapping "Focus Study" at sub-branch level filters to that subcategory only
- [ ] FactDetailCard closes with `&times;` button, restoring the tree view
- [ ] `npm run typecheck` passes
- [ ] `src/ui/components/tree/FactDetailCard.svelte` exists and has no TypeScript errors

### Playwright Test

```javascript
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

  // ... navigate to Knowledge Tree, enter leaf LOD view ...
  await page.waitForTimeout(1500)

  // Click a leaf node
  const leaf = await page.$('circle[data-fact-id]')
  if (leaf) {
    await leaf.click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: '/tmp/ss-tree-fact-card.png' })

    // Verify fact card overlay appeared
    const overlay = await page.$('div[role="dialog"]')
    if (!overlay) { console.error('FAIL: No fact card overlay'); process.exit(1) }
    console.log('PASS: Fact card opened')

    // Close it
    await page.click('button[aria-label="Close fact card"]')
    await page.waitForTimeout(300)
    await page.screenshot({ path: '/tmp/ss-tree-after-close.png' })
  }

  // Test Focus Study button
  const focusBtn = await page.$('button[aria-label*="Start focused study"]')
  if (focusBtn) {
    await focusBtn.click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: '/tmp/ss-tree-focus-study.png' })
    console.log('PASS: Focus Study opened')
  }

  await browser.close()
})()
```

---

## Sub-Phase 13.5: Completeness Coloring + Visual Polish

### What

Apply the DD-V2-098 mastery color progression (greyscale → orange/autumn → green) uniformly across all fact types. Update `getMasteryLevel` in `sm2.ts` to use content-type-aware thresholds (general facts vs vocabulary). Add branch color based on average sub-branch completion. Add pulsing glow on recently reviewed facts. Add wilting visual (droop line with color shift) on overdue facts. Add trunk color shift based on overall mastery.

### Where

- `src/services/sm2.ts` — update `getMasteryLevel` to accept optional `contentType` and apply type-aware thresholds
- `src/ui/components/KnowledgeTree.svelte` — updated mastery colors, branch coloring, pulse animation, wilt animation, trunk gradient
- `src/data/types.ts` — add `lastReviewContext?: 'study' | 'mine' | 'ritual'` to `ReviewState` (for DD-V2-097 consistency penalty, used in Phase 17 but define the field now)

### How

**Step 1: Content-type-aware mastery thresholds in sm2.ts**

Per DD-V2-098, two profiles:
- General facts: new (interval 0), learning (1–3d), familiar (4–14d), known (15–60d), mastered (60d+)
- Vocabulary: new (0), learning (1–2d), familiar (3–7d), known (8–30d), mastered (30d+)

Update `getMasteryLevel` signature:

```typescript
/**
 * Maps current SM-2 interval to a mastery label.
 * Uses content-type-specific thresholds per DD-V2-098.
 *
 * @param state - Review state to classify.
 * @param contentType - Optional content type; defaults to 'fact' thresholds.
 * @returns Current mastery level bucket.
 */
export function getMasteryLevel(
  state: ReviewState,
  contentType: 'fact' | 'vocabulary' | 'grammar' | 'phrase' = 'fact',
): 'new' | 'learning' | 'familiar' | 'known' | 'mastered' {
  if (state.interval === 0) return 'new'

  const isVocab = contentType === 'vocabulary' || contentType === 'phrase'

  if (isVocab) {
    // Vocabulary profile (DD-V2-098): faster mastery timeline
    if (state.interval <= 2)  return 'learning'
    if (state.interval <= 7)  return 'familiar'
    if (state.interval <= 30) return 'known'
    return 'mastered'
  } else {
    // General fact profile (DD-V2-098): slower mastery timeline
    if (state.interval <= 3)  return 'learning'
    if (state.interval <= 14) return 'familiar'
    if (state.interval <= 60) return 'known'
    return 'mastered'
  }
}
```

Update all call sites in `KnowledgeTree.svelte`, `KnowledgeTreeView.svelte`, and `StudySession.svelte` to pass `fact.type` as the second argument.

**Step 2: Update mastery colors to DD-V2-098 progression**

Replace the existing `MASTERY_COLOR` map in `KnowledgeTree.svelte`:

```typescript
// DD-V2-098: greyscale → orange/autumn → green
const MASTERY_COLOR: Record<MasteryLevel, string> = {
  new:      '#3d3d50',   // dark greyscale (unseen)
  learning: '#9a5a28',   // earthy orange-brown (just started)
  familiar: '#c87830',   // warm amber/autumn orange
  known:    '#5a9060',   // muted forest green
  mastered: '#4ecca3',   // bright teal-green (full mastery)
}

// Glow colors match mastery
const MASTERY_GLOW: Record<MasteryLevel, string> = {
  new:      'none',
  learning: 'none',
  familiar: 'drop-shadow(0 0 3px #c8783044)',
  known:    'drop-shadow(0 0 4px #5a906066)',
  mastered: 'drop-shadow(0 0 6px #4ecca388)',
}
```

**Step 3: Recently-reviewed pulse glow**

Track facts reviewed in the last 5 minutes as "recently reviewed". In `KnowledgeTree.svelte`, derive `recentlyReviewed` from `reviewStates`:

```typescript
const recentlyReviewed = $derived.by(() => {
  const save = $playerSave
  if (!save) return new Set<string>()
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
  return new Set(
    save.reviewStates
      .filter(rs => rs.lastReviewAt >= fiveMinutesAgo)
      .map(rs => rs.factId)
  )
})
```

Apply a `class:leaf-recent` on leaf circles for recently reviewed facts, and add a corresponding CSS animation:

```css
@keyframes leaf-recent-pulse {
  0%, 100% { opacity: 0.92; }
  30%       { opacity: 1.0; filter: brightness(1.4); }
}

:global(.leaf-recent) {
  animation: leaf-recent-pulse 1.5s ease-in-out 3;  /* 3 pulses then stops */
}
```

**Step 4: Wilt visual for overdue facts**

Overdue facts (where `isDue(rs)` is true AND `rs.repetitions > 0`) should show a wilting visual. In the existing leaf rendering, the droop line already exists. Extend it with a color shift toward desaturated brown and increase droop length based on how overdue:

```typescript
// Compute overdue severity (0 = just due, 1+ = days overdue)
function overdueSeverity(rs: ReviewState): number {
  if (!isDue(rs) || rs.repetitions === 0) return 0
  const overdueMs = Date.now() - rs.nextReviewAt
  return Math.min(overdueMs / (7 * 24 * 60 * 60 * 1000), 1.0)  // 0..1 over 7 days
}
```

In the leaf `<circle>` rendering:

```svelte
{@const severity = overdueSeverity(reviewStates.get(leaf.factId))}
{@const leafColor = severity > 0
  ? `color-mix(in srgb, ${MASTERY_COLOR[leaf.mastery]} ${100 - severity * 50}%, #5a4020 ${severity * 50}%)`
  : MASTERY_COLOR[leaf.mastery]}
{@const droopLength = 4 + severity * 8}

<!-- Droop line for overdue -->
{#if severity > 0}
  <line
    x1={leaf.x} y1={leaf.y + 5}
    x2={leaf.x + (seededRand(leaf.factId, 99) - 0.5) * 3}
    y2={leaf.y + 5 + droopLength}
    stroke={leafColor}
    stroke-width="1.5"
    stroke-linecap="round"
    opacity={0.3 + severity * 0.5}
  />
{/if}
```

Note: `color-mix()` is CSS — for SVG fill, use a pre-computed hex. Interpolate between the mastery color and `#5a4020` using the `severity` factor in TypeScript:

```typescript
function lerpColor(hex1: string, hex2: string, t: number): string {
  const r1 = parseInt(hex1.slice(1,3), 16), g1 = parseInt(hex1.slice(3,5), 16), b1 = parseInt(hex1.slice(5,7), 16)
  const r2 = parseInt(hex2.slice(1,3), 16), g2 = parseInt(hex2.slice(3,5), 16), b2 = parseInt(hex2.slice(5,7), 16)
  const r = Math.round(r1 + (r2 - r1) * t)
  const g = Math.round(g1 + (g2 - g1) * t)
  const b = Math.round(b1 + (b2 - b1) * t)
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`
}
```

**Step 5: Branch color from sub-branch average**

Compute each main branch's `branchColor` as a weighted average of its sub-branch completion ratios, weighted by sub-branch fact count:

```typescript
const branchCompletionRatio = $derived.by(() => {
  // Weighted average: (sum of leafCount per sub) / (sum of totalCount per sub)
  const totalLearned = branch.subBranches.reduce((s, b) => s + b.leafCount, 0)
  const totalFacts   = branch.subBranches.reduce((s, b) => s + b.totalCount, 0)
  return totalFacts > 0 ? totalLearned / totalFacts : 0
})
```

Apply this to branch stroke color using the same 4-stop color ramp:

```typescript
function completionColor(ratio: number): string {
  if (ratio === 0)      return '#2a2a3a'   // unexplored
  if (ratio < 0.25)    return '#9a5a28'   // early learning
  if (ratio < 0.5)     return '#c87830'   // halfway
  if (ratio < 0.75)    return '#5a9060'   // mostly done
  return '#4ecca3'                          // near complete
}
```

**Step 6: Trunk color shift based on overall mastery**

The trunk gradient currently goes `#5c3a1e` → `#8b5e3c` (static brown). Update it to shift toward green as overall mastery improves. Compute `overallMastery` (0..1) from total learned / total facts, then interpolate trunk top color toward `#2a6040`:

```svelte
{@const overallRatio = totalLeaves / Math.max(allFacts.length, 1)}
{@const trunkTopHex = lerpColor('#8b5e3c', '#2a7050', Math.min(overallRatio * 1.5, 1))}

<linearGradient id="trunk-grad" x1="0" y1="1" x2="0" y2="0" gradientUnits="objectBoundingBox">
  <stop offset="0%"  stop-color="#5c3a1e" />
  <stop offset="100%" stop-color={trunkTopHex} />
</linearGradient>
```

**Step 7: Add `lastReviewContext` to ReviewState in types.ts**

Per DD-V2-097 (consistency penalty tracking, used fully in Phase 17):

```typescript
// src/data/types.ts — update ReviewState interface:
export interface ReviewState {
  factId: string
  easeFactor: number
  interval: number
  repetitions: number
  nextReviewAt: number
  lastReviewAt: number
  quality: number
  /** Context in which the fact was last reviewed. Used for DD-V2-097 consistency penalty. */
  lastReviewContext?: 'study' | 'mine' | 'ritual'
}
```

This is a backward-compatible addition — existing saves without this field will simply have `undefined`, which is safe.

**Step 8: Mastery celebration triggers (DD-V2-119 groundwork)**

Do NOT implement full celebrations in Phase 13. Instead, dispatch a `CustomEvent('mastery-milestone', { detail: { factId, masteryLevel } })` from `KnowledgeTree.svelte` when a leaf transitions to 'mastered' state. This hooks into Phase 17.1 celebration system without blocking Phase 13 completion.

### Acceptance Criteria

- [ ] `getMasteryLevel` in `sm2.ts` accepts optional `contentType` parameter and applies correct thresholds (vocabulary masteries faster than general facts)
- [ ] Mastery colors follow DD-V2-098 progression: `new` = dark grey, `learning` = orange-brown, `familiar` = amber, `known` = muted green, `mastered` = teal
- [ ] Facts reviewed within the last 5 minutes show a 3x pulse animation (stops automatically)
- [ ] Overdue facts (repetitions > 0, isDue = true) show droop line below leaf; color shifts toward brown proportional to days overdue
- [ ] Branch stroke color reflects weighted completion ratio of all its sub-branches
- [ ] Trunk top gradient shifts from brown toward green as overall mastery percentage increases
- [ ] `ReviewState` has optional `lastReviewContext` field in `src/data/types.ts`
- [ ] All existing call sites of `getMasteryLevel` still compile after signature change (optional param, defaults to 'fact')
- [ ] `npm run typecheck` passes with zero errors

### Playwright Test

```javascript
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

  // ... navigate to Knowledge Tree ...
  await page.waitForTimeout(1500)
  await page.screenshot({ path: '/tmp/ss-tree-coloring-forest.png' })

  // Verify mastery colors are applied to leaf circles
  // (check fill attribute values match DD-V2-098 colors)
  const masteredLeaves = await page.$$('circle[fill="#4ecca3"]')  // mastered color
  const learningLeaves  = await page.$$('circle[fill="#9a5a28"]') // learning color
  console.log('Mastered leaves (teal):', masteredLeaves.length)
  console.log('Learning leaves (amber-brown):', learningLeaves.length)

  // Screenshot leaf view for visual inspection
  // ... navigate to leaf LOD level ...
  await page.screenshot({ path: '/tmp/ss-tree-coloring-leaf.png' })

  console.log('Screenshots saved. Visually verify: teal mastered, amber learning, droop on overdue')
  await browser.close()
})()
```

---

## Verification Gate

Run each item in order after completing all five sub-phases.

- [ ] `npm run typecheck` — zero errors across all modified and new files
- [ ] `npm run build` — production build completes without warnings about bundle size from graph libraries (no external graph lib should be added)
- [ ] Tree renders with 500+ facts (seed save with 500 facts via DevPanel) without frame drops — verify with browser DevTools Performance tab (no frames > 16ms during scroll/zoom)
- [ ] Three-level LOD zoom works: forest → branch → leaf with smooth SVG viewBox transition at each step; back button returns one level per tap
- [ ] Tap a leaf node in leaf view: `FactDetailCard` opens showing question, answer, explanation, GAIA comment
- [ ] Swipe left/right in `FactDetailCard` navigates to adjacent facts in the sub-branch
- [ ] Long-press a leaf opens `StudySession` with that single fact
- [ ] Focus Study button on a branch opens `StudySession` filtered to that branch's facts, due facts appearing first
- [ ] Mastery coloring is accurate: run `npm run dev`, learn a new fact, verify it shows as grey; study it correctly twice, verify color shifts to orange-brown
- [ ] Overdue facts show visible droop visual (may need to manually set `nextReviewAt` to past timestamp via DevPanel console)
- [ ] Toggle "Show All" / "Learned Only" switches correctly; silhouette nodes appear only at 80%+ sub-branch completion
- [ ] Sub-branch growth animation plays on first session discovery of a new subcategory
- [ ] `FactDetailCard` closes correctly without leaving orphaned DOM overlay; tree view remains interactive after close
- [ ] On mobile viewport (375×812): all tap targets ≥ 44px, no text overflow, scroll works in `FactDetailCard`

---

## Files Affected

### New Files (create these)

| File | Purpose |
|------|---------|
| `src/ui/components/tree/TreeLOD.ts` | LOD state type (`TreeLODLevel`, `TreeLODState`) and transition helpers (`zoomToBranch`, `zoomToLeaf`, `zoomOut`, `initialLOD`) |
| `src/ui/components/tree/FactDetailCard.svelte` | Full-screen bottom-sheet fact detail overlay with swipe navigation, mastery badge, question/answer/explanation display, Review Now button |

### Modified Files

| File | Changes |
|------|---------|
| `src/ui/components/KnowledgeTree.svelte` | Add `SubBranchData` and `subBranches` to data model; LOD-conditional rendering; leaf tap/longpress handlers; updated mastery colors (DD-V2-098); wilt droop animation; recently-reviewed pulse; trunk color shift; cross-fact connection line stubs; `onLeafTap`, `onLeafLongPress`, `onMainBranchTap`, `onSubBranchTap`, `lod`, `showMode` props |
| `src/ui/components/KnowledgeTreeView.svelte` | Add `lod: TreeLODState` state; back button behavior; Focus Study button and logic; FactDetailCard and StudySession integration; "Show All" / "Learned Only" toggle; subcategory discovery tracking in localStorage |
| `src/services/sm2.ts` | Update `getMasteryLevel(state, contentType?)` to apply content-type-aware mastery thresholds per DD-V2-098 |
| `src/data/types.ts` | Add `lastReviewContext?: 'study' \| 'mine' \| 'ritual'` to `ReviewState` interface |
| `src/ui/components/StudySession.svelte` | Add `filterFacts?: Fact[]` prop; when provided, override the study queue with the filtered set (due first, then new) |

### Unchanged Files (read for context, do not modify)

| File | Why Referenced |
|------|---------------|
| `src/data/types.ts` (`Fact`, `CATEGORIES`) | Fact structure drives category hierarchy |
| `src/data/balance.ts` | SM-2 constants (`SM2_INITIAL_EASE`, `SM2_MIN_EASE`) referenced in sm2.ts |
| `src/ui/stores/playerData.ts` | `playerSave` store used throughout tree components |
| `src/game/managers/StudyManager.ts` | Study session SM-2 logic — do not duplicate; call through GameManager |

---

## Implementation Order for Sub-Agents

Execute sub-phases in this order (13.3 and 13.4 can be parallelized after 13.1 and 13.2 complete):

1. **13.1** (Sub-Branch System) — must complete first; 13.2 depends on `subBranches` data structure
2. **13.2** (LOD Rendering + TreeLOD.ts) — depends on 13.1; core navigation for all subsequent phases
3. **13.3** (Toggle Views) — can begin after 13.2; only modifies show/hide logic
4. **13.4** (Tap-to-View + Focus Study) — can begin after 13.2; creates `FactDetailCard.svelte`
5. **13.5** (Completeness Coloring) — can begin after 13.1; modifies sm2.ts and visual props only

Run `npm run typecheck` after each sub-phase before starting the next.

---

## Design Decision Cross-Reference

| Decision | Phase | Implementation Location |
|----------|-------|------------------------|
| DD-V2-098 Mastery color progression (greyscale→orange→green) | 13.5 | `MASTERY_COLOR` map in `KnowledgeTree.svelte`; `getMasteryLevel` thresholds in `sm2.ts` |
| DD-V2-115 Hierarchical radial tree (not force-directed) | 13.2 | Custom SVG renderer in `KnowledgeTree.svelte`; no external graph library |
| DD-V2-116 Three-level LOD (forest/branch/leaf) | 13.2 | `TreeLODState` in `TreeLOD.ts`; conditional `{#if}` rendering in `KnowledgeTree.svelte` |
| DD-V2-117 Unknown facts at branch level only (80% exception) | 13.3 | `silhouetteLeaves` in `KnowledgeTree.svelte`; toggle logic in `KnowledgeTreeView.svelte` |
| DD-V2-121 Cross-fact connection lines | 13.2 | Faint `<line>` elements in leaf LOD view; "Related" section stub in `FactDetailCard.svelte` |
| DD-V2-122 Focus Study button per branch | 13.4 | "Focus Study" button in `KnowledgeTreeView.svelte`; filtered `StudySession` mode |
