# Phase 60 — Critical Data Pipeline Fixes

**Priority**: CRITICAL
**Status**: Not Started
**Estimated Complexity**: Medium (5 sub-steps, all in display/aggregation layer)
**Dependencies**: None (all underlying data and SM-2 logic is correct)

## Tech Stack Reference

- **Frontend**: Svelte 5 + TypeScript (strict), Vite 7, Phaser 3
- **State**: Svelte stores in `src/ui/stores/` — `playerSave` writable store, `singletonWritable` pattern
- **Entry point**: `src/App.svelte` — screen router; KnowledgeTree accessed via `currentScreen.set('knowledgeTree')`
- **Facts DB**: `src/services/factsDB.ts` — sql.js SQLite singleton; `factsDB.getById(id)` returns `Fact` with `category: [string, string?]`; `factsDB.getAll()` returns all facts; `factsDB.getByIds(ids)` returns facts by ID array
- **Categories**: `src/data/types.ts` lines 54-62: `CATEGORIES = ['Language','Natural Sciences','Life Sciences','History','Geography','Technology','Culture'] as const`
- **Player data**: `src/ui/stores/playerData.ts` — `learnedFacts: string[]`, `reviewStates: ReviewState[]`
- **SM-2**: `src/services/sm2.ts` — `getMasteryLevel(state, contentType?)` returns `'new' | 'learning' | 'familiar' | 'known' | 'mastered'`; `isDue(state)` returns boolean
- **Learning insights**: `src/services/learningInsights.ts` — `computeLearningInsights(reviewStates, engagementData, factCategories)` where `factCategories` is `Map<string, string>`
- **Typecheck**: `npm run typecheck` — must report 0 errors
- **Dev bypass**: `?skipOnboarding=true&devpreset=post_tutorial` or `?skipOnboarding=true&devpreset=mid_game_3_rooms`

---

## Overview

Playtest findings reveal that fact-to-category mapping fails at the display/aggregation layer. Individual facts are correctly stored and retrieved, but code that groups or counts facts by category produces empty, zero, or wrong results in multiple UI components. This phase fixes 5 related bugs:

| ID | Bug | Component | Severity |
|----|-----|-----------|----------|
| C2 | Knowledge Tree shows all categories as "unexplored" | KnowledgeTree.svelte | Critical |
| C3 | GAIA radar chart uses wrong category names | GaiaReport.svelte | Critical |
| H5 | "Facts Mastered" always shows 0 | DesktopSidePanel.svelte + LearningInsightsTab.svelte | High |
| M8 | Knowledge Tree branch labels clip at viewport edge | KnowledgeTree.svelte | Medium |
| M9 | GAIA "My Learning" shows "Unknown: 0%" | GaiaReport.svelte + LearningInsightsTab.svelte | Medium |

**Root cause hypothesis**: The fact-to-category mapping is never populated. `GaiaReport.svelte` line 18 creates an empty `Map<string, string>()` and never fills it. `LearningInsightsTab.svelte` receives this empty map and all categories resolve to `'Unknown'`. The Knowledge Tree works differently (it receives a `facts: Fact[]` prop and filters directly), so its issue is separate (likely the `facts` array from `cachedFacts` in App.svelte).

---

## Sub-step 60.1 — Trace and fix fact-to-category resolution in Knowledge Tree

### Problem

`KnowledgeTree.svelte` and `KnowledgeTreeView.svelte` receive a `facts: Fact[]` prop from `App.svelte` (`cachedFacts`). The tree groups facts by `fact.category[0]` to build branches. If `cachedFacts` is empty or not yet loaded when the tree renders, all categories show as "unexplored" (0 learned, 0 total).

### Files to Investigate

1. **`src/App.svelte`** — search for `cachedFacts` to understand how it's populated. It likely depends on `factsDB.getAll()` which is async.
2. **`src/ui/components/KnowledgeTreeView.svelte`** lines 161-172 — `categoriesUnlocked` derived counts categories from the `facts` prop filtered by `learnedFacts`.
3. **`src/ui/components/KnowledgeTree.svelte`** lines 308-410 — `treeData` derived builds `BranchData[]` from the `facts` prop.

### What to Check

```bash
grep -n 'cachedFacts' src/App.svelte
```

Look for:
- Is `cachedFacts` populated from `factsDB.getAll()`?
- Is it populated asynchronously, and does the tree render before it's ready?
- Is there a race condition where `cachedFacts` is `[]` when the tree first renders?

### Fix Strategy

If the issue is that `cachedFacts` is empty when the tree renders:
- Ensure `factsDB.init()` completes before navigating to the knowledge tree.
- Or add a loading state in `KnowledgeTreeView.svelte` that shows a spinner until `facts.length > 0`.
- Or populate `cachedFacts` reactively from an `$effect` that re-runs when `factsDB.isReady()` becomes true.

If the issue is that `facts` array IS populated but `learnedFacts` IDs don't match any fact IDs:
- Log `$playerSave.learnedFacts.slice(0, 5)` and `facts.slice(0, 5).map(f => f.id)` to compare ID formats.
- IDs may have a prefix mismatch or encoding difference.

### Acceptance Criteria

- Navigate to Knowledge Tree with `?skipOnboarding=true&devpreset=mid_game_3_rooms`
- At least 1 category shows a non-zero learned count
- Branch labels display real category names from `CATEGORIES`
- `categoriesUnlocked` shows >= 1

---

## Sub-step 60.2 — Fix GAIA radar chart category names

### Problem

`src/ui/components/GaiaReport.svelte` line 60 hardcodes wrong category names:

```typescript
// CURRENT (WRONG):
const categories = ['Biology', 'History', 'Geology', 'Language', 'Physics', 'Culture']
```

The canonical categories from `src/data/types.ts` are:
```typescript
export const CATEGORIES = [
  'Language',
  'Natural Sciences',
  'Life Sciences',
  'History',
  'Geography',
  'Technology',
  'Culture',
] as const
```

Additionally, `radarValues` (lines 63-70) distributes mastered facts evenly across categories instead of querying actual per-category data.

### File to Edit

**`src/ui/components/GaiaReport.svelte`**

### Changes Required

1. **Line 2**: Add import:
   ```typescript
   import { CATEGORIES } from '../../data/types'
   import { factsDB } from '../../services/factsDB'
   ```

2. **Delete line 60** (hardcoded `categories` array).

3. **Replace `radarValues`** (lines 63-70) with a derived that computes real per-category mastery:
   ```typescript
   const radarValues = $derived((): number[] => {
     const save = $playerSave
     if (!save || save.reviewStates.length === 0) return CATEGORIES.map(() => 0)

     // Build factId -> category lookup from the facts DB
     const learnedSet = new Set(save.learnedFacts)
     const catCounts = new Map<string, { mastered: number; total: number }>()
     for (const cat of CATEGORIES) {
       catCounts.set(cat, { mastered: 0, total: 0 })
     }

     // Count review states per category
     for (const rs of save.reviewStates) {
       if (!factsDB.isReady()) break
       const fact = factsDB.getById(rs.factId)
       if (!fact) continue
       const cat = fact.category[0]
       const entry = catCounts.get(cat)
       if (entry) {
         entry.total++
         if (rs.repetitions >= 6) entry.mastered++
       }
     }

     return CATEGORIES.map(cat => {
       const entry = catCounts.get(cat)
       if (!entry || entry.total === 0) return 0
       return entry.mastered / entry.total
     })
   })
   ```

4. **Line 241**: Change `labels={categories}` to `labels={[...CATEGORIES]}` (RadarChart expects `string[]`, not readonly).

5. **Update `totalMastered`** (lines 42-44) for consistency — currently uses `repetitions >= 6` which is a proxy. Keep this for now but add a comment noting the `learningInsights.ts` uses `interval >= 30` as the mastery threshold. Both are acceptable proxies.

### Acceptance Criteria

- GAIA Report Overview tab shows radar chart with 7 labels: Language, Natural Sciences, Life Sciences, History, Geography, Technology, Culture
- Radar values reflect actual per-category mastery ratios (not evenly distributed)
- `npm run typecheck` passes (CATEGORIES is `readonly string[]`, RadarChart may need `string[]`)

---

## Sub-step 60.3 — Fix "Facts Mastered" counter in sidebar and insights

### Problem

Two separate "Facts Mastered" counters exist with different thresholds:

1. **`src/ui/components/DesktopSidePanel.svelte`** line 27-32: Uses `interval >= 21` — this is reasonable but may show 0 for presets with low-interval review states.
2. **`src/ui/components/LearningInsightsTab.svelte`** line 59: Shows `insights.masteredCount` from `learningInsights.ts` which uses `interval >= 30` (MASTERY_INTERVAL_DAYS).
3. **`src/ui/components/GaiaReport.svelte`** line 43: Uses `repetitions >= 6`.

The inconsistency means "mastered" means different things in different places. The primary issue is that devpresets may generate review states with low intervals and few repetitions, causing all counters to show 0.

### Files to Edit

1. **`src/ui/components/DesktopSidePanel.svelte`** lines 27-32
2. **`src/services/learningInsights.ts`** line 61

### Changes Required

1. **Align mastery definition**: Use `getMasteryLevel(rs) === 'mastered'` from `sm2.ts` as the single source of truth everywhere. Check what `getMasteryLevel` returns for 'mastered':

   In `src/services/sm2.ts`, `getMasteryLevel` checks interval thresholds. Read the full function to find the 'mastered' threshold for `contentType: 'fact'`.

   ```bash
   grep -A 20 'export function getMasteryLevel' src/services/sm2.ts
   ```

2. **`DesktopSidePanel.svelte`**: Replace the manual filter with `getMasteryLevel`:
   ```typescript
   import { getMasteryLevel } from '../../services/sm2'

   const totalMastered = derived(playerSave, (save) => {
     if (!save) return 0
     return save.reviewStates.filter(
       (rs) => rs && getMasteryLevel(rs) === 'mastered'
     ).length
   })
   ```

3. **`GaiaReport.svelte`** line 43: Same fix — use `getMasteryLevel`:
   ```typescript
   import { getMasteryLevel } from '../../services/sm2'

   const totalMastered = $derived(
     save?.reviewStates.filter(rs => getMasteryLevel(rs) === 'mastered').length ?? 0
   )
   ```

4. **`learningInsights.ts`**: Leave `MASTERY_INTERVAL_DAYS = 30` as-is (it's the insights-specific threshold and is clearly documented). But verify the devpresets generate review states with intervals high enough to trigger mastery. If not, the counters correctly show 0 for those presets — the bug may actually be that `endgame_all_rooms` preset doesn't set high enough intervals.

5. **Check devpresets**: Look in `src/dev/presets.ts` for `endgame_all_rooms` and `mid_game_3_rooms` — do their `reviewStates` have `interval >= 21`? If not, the mastery counter correctly shows 0 and the "bug" is actually a preset data issue.

   ```bash
   grep -A 30 'endgame_all_rooms' src/dev/presets.ts | head -40
   ```

### Acceptance Criteria

- All mastery counters use the same definition (either `getMasteryLevel(rs) === 'mastered'` or a consistent interval threshold)
- With `devpreset=endgame_all_rooms`, "Facts Mastered" shows > 0 in sidebar and GAIA report
- `npm run typecheck` passes

---

## Sub-step 60.4 — Fix "My Learning" tab showing "Unknown: 0%"

### Problem

`src/ui/components/GaiaReport.svelte` line 18 creates an empty category map:

```typescript
/** Placeholder category map -- in production populated from the facts DB. */
const factCategoryMap = new Map<string, string>()
```

This empty map is passed to `LearningInsightsTab` on line 190:

```typescript
<LearningInsightsTab factCategories={factCategoryMap} />
```

`learningInsights.ts` line 119 falls back to `'Unknown'` when the map has no entry:

```typescript
const cat = factCategories.get(rs.factId) ?? 'Unknown'
```

### File to Edit

**`src/ui/components/GaiaReport.svelte`**

### Changes Required

1. Populate `factCategoryMap` from the facts DB. Since `factsDB` is async (sql.js), use a reactive approach:

   ```typescript
   import { factsDB } from '../../services/factsDB'

   // Build factId -> category map from the facts DB
   const factCategoryMap = $derived.by((): Map<string, string> => {
     const map = new Map<string, string>()
     if (!factsDB.isReady()) return map
     const save = $playerSave
     if (!save) return map

     // Only look up categories for facts the player has reviewed
     const factIds = save.reviewStates.map(rs => rs.factId)
     const facts = factsDB.getByIds(factIds)
     for (const fact of facts) {
       map.set(fact.id, fact.category[0])
     }
     return map
   })
   ```

2. **Delete** the old `const factCategoryMap = new Map<string, string>()` on line 18.

3. **Update** `LearningInsightsTab` usage — the prop is now reactive (a `$derived`), but since it's passed as a prop value it will update automatically. However, `LearningInsightsTab` uses `$props()` with a default of `new Map()`, which is fine.

4. **Note**: `factsDB.isReady()` is synchronous and returns `true` once `init()` has completed. If the GAIA report is opened before the DB is ready, the map will be empty and the tab will show "Complete some dives..." empty state (which is acceptable as a loading state).

### Acceptance Criteria

- Navigate to GAIA Terminal > My Learning tab with `devpreset=mid_game_3_rooms`
- "Your Strongest Categories" section shows real category names (Language, History, etc.) not "Unknown"
- Category mastery rates are non-zero for categories with learned facts
- `npm run typecheck` passes

---

## Sub-step 60.5 — Fix Knowledge Tree branch labels clipping

### Problem

SVG `<text>` elements for branch labels at the edges of the viewBox can be clipped because the viewBox doesn't account for text width. Labels like "Natural Sciences" (16 chars) and "Geography" are positioned at branch endpoints near the viewport boundary.

### File to Edit

**`src/ui/components/KnowledgeTree.svelte`**

### Analysis

Branch label positions are computed in the `treeData` derived (lines 343-345):

```typescript
const labelOffsetX = config.side === 'left' ? -10 : 10
const labelX = endX + labelOffsetX
const labelY = endY - 10
```

The SVG viewBox is `0 0 800 600` (VW=800, VH=600). For left-side branches, `text-anchor="end"` means text extends leftward from `labelX`. If `endX` is close to 0 (e.g., for the Culture branch at angle -88), the text gets clipped.

### Changes Required

1. **Option A — Clamp label positions**: Add minimum/maximum X bounds for labels:

   In the `treeData` derived, after computing `labelX`, clamp it:
   ```typescript
   // Clamp labels to stay within viewBox with margin for text
   const TEXT_MARGIN = 80  // approximate max text width
   let labelX = endX + labelOffsetX
   if (config.side === 'left') {
     // text-anchor="end", so text extends LEFT from labelX
     // Ensure labelX >= TEXT_MARGIN so text doesn't clip left edge
     labelX = Math.max(TEXT_MARGIN, labelX)
   } else {
     // text-anchor="start", so text extends RIGHT from labelX
     // Ensure labelX <= VW - TEXT_MARGIN
     labelX = Math.min(VW - TEXT_MARGIN, labelX)
   }
   ```

2. **Option B — Use abbreviated labels**: Add a `BRANCH_LABELS` map similar to `KnowledgeTreeView.svelte`'s `PILL_LABELS` (lines 131-139):

   ```typescript
   const BRANCH_LABELS: Record<string, string> = {
     'Language':         'Language',
     'Life Sciences':    'Life Sci',
     'History':          'History',
     'Culture':          'Culture',
     'Natural Sciences': 'Nat Sci',
     'Geography':        'Geography',
     'Technology':       'Tech',
   }
   ```

   Then in the SVG template where branch labels are rendered (lines 658-665), use:
   ```svelte
   {BRANCH_LABELS[branch.config.category] ?? branch.config.category}
   ```

3. **Recommended**: Use **both** options. Clamp positions AND use abbreviated labels for the longest names. This ensures labels fit on both narrow (375px) and wide screens.

4. **For sub-branch labels** (lines 780-786): These are less likely to clip since they're positioned closer to center during zoom. No changes needed unless testing reveals issues.

### Acceptance Criteria

- All 7 branch labels fully visible at 375px viewport width
- Labels for "Natural Sciences", "Life Sciences", "Geography", and "Technology" are not truncated by viewport clipping
- Labels still correctly positioned relative to their branch endpoints
- No overlapping labels
- Test with: `mcp__playwright__browser_resize` to 375x667, then screenshot the knowledge tree
- `npm run typecheck` passes

---

## Verification Gate

All of the following MUST pass before this phase is marked complete:

### 1. Typecheck and Build
```bash
npm run typecheck   # 0 errors
npm run build       # succeeds
```

### 2. Unit Tests
```bash
npx vitest run      # all tests pass (no regressions)
```

### 3. Visual Verification — Knowledge Tree (Sub-steps 60.1, 60.5)

```
Navigate: http://localhost:5173?skipOnboarding=true&devpreset=mid_game_3_rooms
Action: Open Knowledge Tree (via base screen)
Verify:
  - At least 1 category branch shows non-zero learned count
  - Branch labels are not clipped (resize to 375px width and screenshot)
  - "Categories" counter in footer bar shows >= 1/7
```

### 4. Visual Verification — GAIA Report Overview (Sub-step 60.2)

```
Navigate: http://localhost:5173?skipOnboarding=true&devpreset=mid_game_3_rooms
Action: Open GAIA Report (via base screen / GAIA terminal)
Verify:
  - Radar chart shows 7 labels: Language, Natural Sciences, Life Sciences, History, Geography, Technology, Culture
  - "Mastered" stat box shows a number (may be 0 for mid_game preset — that's OK if interval thresholds aren't met)
```

### 5. Visual Verification — GAIA "My Learning" Tab (Sub-steps 60.3, 60.4)

```
Navigate: http://localhost:5173?skipOnboarding=true&devpreset=endgame_all_rooms
Action: Open GAIA Report > click "My Learning" tab
Verify:
  - "Facts Mastered" shows > 0
  - "Your Strongest Categories" shows real category names (not "Unknown")
  - Category mastery bars have non-zero fill
```

### 6. Visual Verification — Desktop Sidebar (Sub-step 60.3)

```
Navigate: http://localhost:5173?skipOnboarding=true&devpreset=endgame_all_rooms
Action: Resize viewport to >= 1200px width to trigger desktop layout
Verify:
  - "Facts Mastered" in side panel shows > 0
```

### 7. Console Error Check

```
browser_console_messages after each navigation — no new JS errors related to factsDB, categories, or undefined map access
```

---

## Files Affected

| File | Change Type | Sub-step |
|------|------------|----------|
| `src/ui/components/GaiaReport.svelte` | Edit (categories, radarValues, factCategoryMap, totalMastered) | 60.2, 60.3, 60.4 |
| `src/ui/components/DesktopSidePanel.svelte` | Edit (totalMastered filter) | 60.3 |
| `src/ui/components/KnowledgeTree.svelte` | Edit (label clamping, abbreviated labels) | 60.5 |
| `src/App.svelte` | Investigate (cachedFacts loading) | 60.1 |
| `src/ui/components/KnowledgeTreeView.svelte` | Possibly edit (loading state) | 60.1 |
| `src/services/factsDB.ts` | Import only | 60.2, 60.4 |
| `src/services/sm2.ts` | Import only | 60.3 |
| `src/data/types.ts` | Import only | 60.2 |
| `src/services/learningInsights.ts` | No changes (working correctly, just receiving empty input) | — |
| `src/dev/presets.ts` | Investigate (verify devpreset review state intervals) | 60.3 |

---

## Design Decision References

- DD-V2-098: Knowledge Tree mastery color progression
- DD-V2-190: GAIA learning insights
- DD-V2-218: Lazy sql.js loading for bundle size
