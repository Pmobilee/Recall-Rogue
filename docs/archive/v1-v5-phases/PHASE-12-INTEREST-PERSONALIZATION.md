# Phase 12: Interest & Personalization System

## Overview

**Goal**: Let players focus on what they want to learn while keeping all other knowledge discoverable. The system must never create a filter bubble — it biases toward interests without eliminating anything. For players who want a completely focused experience (e.g., students studying only Japanese N3 vocabulary), an explicit Category Lock mode is available as a purchasable opt-in.

**Core philosophy**: Interest weights only increase spawn probabilities for preferred categories. They never reduce other categories below their baseline probability. Behavioral learning only responds to positive signals (voluntary study, high mastery speed, artifact retention). Selling a fact is an economic decision, not a preference signal (DD-V2-118).

**Dependencies**:
- Phase 8 (Mine Gameplay): mine generation with fact selection, quiz gate system
- Phase 11 (Fact Content Engine): category taxonomy, subcategory structure in Fact data
- Phase 14 (Onboarding): tutorial integration point for 12.5
- `src/data/types.ts` — `PlayerSave`, `Fact`, `CATEGORIES`
- `src/services/saveService.ts` — `save()`, `load()` pattern
- `src/game/systems/MineGenerator.ts` — `generateMine()`, `generateBiomeSequence()`
- `src/data/biomes.ts` — `BIOMES`, `pickBiome()`, `generateBiomeSequence()`
- `src/ui/stores/playerData.ts` — `playerSave` writable store
- `src/ui/stores/settings.ts` — pattern for localStorage-backed stores

**Estimated complexity**: High. Seven interconnected sub-phases touching save schema, mine generation, quiz selection, GAIA dialogue, and onboarding flow.

**Design Decisions Referenced**:
- DD-V2-118: Behavioral inference weight cap (explicit = 1.0, behavioral max = 0.3, positive signals only)
- DD-V2-120: Interest-biased biome selection (~30% weight boost, invisible, not configurable)
- DD-V2-132: Language Mode = Category Lock applied to language categories (not a separate mode)
- DD-V2-163: Dynamic engagement scoring drives distractor difficulty automatically
- DD-V2-172: Four player archetypes (Explorer, Scholar, Collector, Sprinter), detected by Day 7

---

## Prerequisites

Before implementing Phase 12, the following must be in place and passing typecheck + build:

1. `src/data/types.ts` exports `CATEGORIES` as `readonly string[]` with at least: `'Language'`, `'Natural Sciences'`, `'Life Sciences'`, `'History'`, `'Geography'`, `'Technology'`, `'Culture'`
2. `Fact.category` is `string[]` (hierarchical, e.g. `["Language", "Japanese", "N3"]`) — confirmed present
3. `PlayerSave` is migrated from `saveService.ts` with backward-compatible `load()` function
4. `generateBiomeSequence()` in `src/data/biomes.ts` accepts a seeded RNG and returns `Biome[]`
5. `src/game/systems/MineGenerator.ts` `generateMine()` accepts a `facts: string[]` parameter used for artifact/artifact-node selection
6. `src/ui/stores/playerData.ts` exposes `playerSave` as Svelte `writable<PlayerSave | null>`
7. Phase 8 sub-phase 8.3 complete: quiz question selection pipeline is a function that can accept a category filter

---

## Sub-Phase 12.1: Interest Settings Page

### What

A full-screen settings page (`InterestSettings.svelte`) where players configure their category preferences. Up to 3 categories can be highlighted as primary interests using "interest bubbles" (tappable toggle chips). Each active interest category gets a slider (0–100) representing its relative spawn weight boost. A separate subcategory drill-down reveals per-subcategory sliders once a parent is toggled on. A live preview shows the approximate percentage distribution across all categories given current slider values. A "Reset to defaults" button zeroes all interest weights and clears all locks.

### Where

- **New file**: `src/ui/components/InterestSettings.svelte`
- **New file**: `src/data/interestConfig.ts` (interest weight types, default config, helpers)
- **Modified**: `src/data/types.ts` — add `InterestConfig` to `PlayerSave`
- **Modified**: `src/services/saveService.ts` — add migration for `interestConfig` field
- **Modified**: `src/ui/stores/settings.ts` — add `interestConfig` Svelte store backed by `playerSave`
- **Modified**: `src/ui/components/Settings.svelte` — add navigation button to `InterestSettings`
- **Modified**: `src/ui/stores/gameState.ts` — add `'interestSettings'` to `Screen` union type

### How

#### Step 1: Define the data structures in `src/data/interestConfig.ts`

```typescript
import { CATEGORIES } from './types'

/** Relative weight for one category (0 = no boost, 100 = full interest boost). */
export interface CategoryInterest {
  /** Top-level category name matching Fact.category[0] */
  category: string
  /** Explicit player-set weight boost. 0 = default, 1–100 = interest. */
  weight: number
  /** Per-subcategory weight overrides. Key = subcategory name (Fact.category[1]). */
  subcategoryWeights: Record<string, number>
}

/** Full interest configuration stored in PlayerSave. */
export interface InterestConfig {
  /** Whether the player has enabled behavioral learning (opt-in). */
  behavioralLearningEnabled: boolean
  /** Per-category interest settings. Always contains one entry per CATEGORIES value. */
  categories: CategoryInterest[]
  /** If set, only facts from this category path are served. null = no lock. */
  categoryLock: string[] | null
  /** Whether the category lock is currently active (player can toggle without clearing). */
  categoryLockActive: boolean
  /**
   * Inferred interest boosts from behavioral signals. Max per-category value = 0.3 (DD-V2-118).
   * Key = category name, value = 0.0–0.3 additive boost.
   */
  inferredBoosts: Record<string, number>
}

/** Maximum number of categories a player can mark as primary interests. */
export const MAX_INTEREST_CATEGORIES = 3

/**
 * Maximum weight value for behavioral inference boost, per DD-V2-118.
 * Explicit slider weights have no cap (they are the player's stated preference).
 * Behavioral signals can only contribute up to this amount above the explicit setting.
 */
export const MAX_INFERRED_BOOST = 0.3

/**
 * Creates a default InterestConfig with all categories at weight 0 (no interest set).
 */
export function createDefaultInterestConfig(): InterestConfig {
  return {
    behavioralLearningEnabled: false,
    categories: CATEGORIES.map(cat => ({
      category: cat,
      weight: 0,
      subcategoryWeights: {},
    })),
    categoryLock: null,
    categoryLockActive: false,
    inferredBoosts: {},
  }
}

/**
 * Returns the number of categories currently marked as primary interests
 * (weight > 0 set by the player).
 */
export function countActiveInterests(config: InterestConfig): number {
  return config.categories.filter(c => c.weight > 0).length
}

/**
 * Computes the effective spawn weight multiplier for a given category.
 * Combines the explicit player weight (normalized to 0.0–1.0) with
 * any inferred boost (capped at MAX_INFERRED_BOOST).
 *
 * Formula: baseMultiplier = 1.0 + (normalizedWeight * 1.0) + inferredBoost
 * A category with weight=0 and no inferred boost has multiplier = 1.0 (no change).
 * A category with weight=100 has multiplier = 2.0. Inferred can add up to 0.3 more.
 *
 * @param config - The player's current interest configuration.
 * @param category - Top-level category name.
 * @returns Multiplier >= 1.0.
 */
export function getCategoryMultiplier(config: InterestConfig, category: string): number {
  const entry = config.categories.find(c => c.category === category)
  const normalizedWeight = entry ? entry.weight / 100 : 0
  const inferred = Math.min(config.inferredBoosts[category] ?? 0, MAX_INFERRED_BOOST)
  return 1.0 + normalizedWeight + inferred
}

/**
 * Computes the effective multiplier for a specific subcategory.
 * Falls back to the parent category multiplier if no subcategory weight is set.
 *
 * @param config - The player's current interest configuration.
 * @param category - Top-level category name (Fact.category[0]).
 * @param subcategory - Subcategory name (Fact.category[1]).
 * @returns Multiplier >= 1.0.
 */
export function getSubcategoryMultiplier(
  config: InterestConfig,
  category: string,
  subcategory: string,
): number {
  const entry = config.categories.find(c => c.category === category)
  if (!entry) return getCategoryMultiplier(config, category)

  const subWeight = entry.subcategoryWeights[subcategory]
  if (subWeight === undefined) return getCategoryMultiplier(config, category)

  const inferred = Math.min(config.inferredBoosts[category] ?? 0, MAX_INFERRED_BOOST)
  return 1.0 + (subWeight / 100) + inferred
}

/**
 * Given a list of facts and the player's interest config, returns weights for each fact
 * for use with weighted random selection.
 *
 * @param facts - Array of Fact objects to weight.
 * @param config - Player's interest configuration.
 * @returns Array of weights, same length as facts, each >= 1.0.
 */
export function computeFactWeights(
  facts: Array<{ id: string; category: string[] }>,
  config: InterestConfig,
): number[] {
  // If category lock is active, only include facts in the locked category path.
  if (config.categoryLock && config.categoryLockActive) {
    const lockPath = config.categoryLock
    return facts.map(fact => {
      const matches = lockPath.every((segment, i) => fact.category[i] === segment)
      return matches ? 1.0 : 0.0
    })
  }

  return facts.map(fact => {
    const topCategory = fact.category[0] ?? ''
    const subCategory = fact.category[1] ?? ''

    if (subCategory) {
      return getSubcategoryMultiplier(config, topCategory, subCategory)
    }
    return getCategoryMultiplier(config, topCategory)
  })
}

/**
 * Performs a weighted random selection from an array of items using precomputed weights.
 * Uses a linear scan; for large arrays a cumulative sum with binary search is more efficient.
 *
 * @param items - Array of items to select from.
 * @param weights - Weight for each item (must be same length as items, all >= 0).
 * @param rng - Random number generator returning values in [0, 1).
 * @returns Selected item, or null if all weights are 0 (e.g., category lock with no matching facts).
 */
export function weightedRandomSelect<T>(
  items: T[],
  weights: number[],
  rng: () => number,
): T | null {
  const total = weights.reduce((sum, w) => sum + w, 0)
  if (total === 0) return null

  let remaining = rng() * total
  for (let i = 0; i < items.length; i++) {
    remaining -= weights[i]
    if (remaining <= 0) return items[i]
  }
  return items[items.length - 1]
}
```

#### Step 2: Add `InterestConfig` to `PlayerSave` in `src/data/types.ts`

Add the import and field:

```typescript
import type { InterestConfig } from './interestConfig'

export interface PlayerSave {
  // ... existing fields ...
  /** Player's interest and personalization settings. */
  interestConfig: InterestConfig
}
```

#### Step 3: Migrate `saveService.ts`

In the `load()` function, inside the `try` block after existing migration checks, add:

```typescript
// Backward compatibility: ensure interestConfig exists
if (!parsedAny['interestConfig'] || typeof parsedAny['interestConfig'] !== 'object') {
  parsedAny['interestConfig'] = createDefaultInterestConfig()
}
```

In `createNewPlayer()`, add to the returned object:

```typescript
interestConfig: createDefaultInterestConfig(),
```

Import `createDefaultInterestConfig` from `'../data/interestConfig'`.

#### Step 4: Add `interestConfig` store to `src/ui/stores/settings.ts`

```typescript
import { get } from 'svelte/store'
import type { InterestConfig } from '../../data/interestConfig'
import { createDefaultInterestConfig } from '../../data/interestConfig'
import { playerSave } from './playerData'
import { save as saveFn } from '../../services/saveService'

/**
 * Reactive Svelte store for the player's interest configuration.
 * Derives its initial value from playerSave and persists changes back through it.
 */
export const interestConfig = writable<InterestConfig>(createDefaultInterestConfig())

// Sync interestConfig from playerSave whenever playerSave changes.
playerSave.subscribe(ps => {
  if (ps?.interestConfig) {
    interestConfig.set(ps.interestConfig)
  }
})

/**
 * Saves an updated InterestConfig to the player save and persists.
 */
export function saveInterestConfig(config: InterestConfig): void {
  const current = get(playerSave)
  if (!current) return
  const updated = { ...current, interestConfig: config, lastPlayedAt: Date.now() }
  playerSave.set(updated)
  saveFn(updated)
  interestConfig.set(config)
}
```

#### Step 5: Build `InterestSettings.svelte`

Key UI elements (approximate layout, implement with Svelte 5 `$state`/`$derived`):

```svelte
<script lang="ts">
  import { interestConfig, saveInterestConfig } from '../../stores/settings'
  import { CATEGORIES } from '../../../data/types'
  import {
    createDefaultInterestConfig,
    countActiveInterests,
    MAX_INTEREST_CATEGORIES,
    type InterestConfig,
    type CategoryInterest,
  } from '../../../data/interestConfig'
  import { currentScreen } from '../../stores/gameState'

  let config: InterestConfig = $state(structuredClone($interestConfig))

  // Distribution preview: compute effective multipliers and normalize to percentages
  let preview = $derived(() => {
    const mults = CATEGORIES.map(cat => {
      const entry = config.categories.find(c => c.category === cat)
      const w = entry ? entry.weight / 100 : 0
      return { cat, mult: 1.0 + w }
    })
    const total = mults.reduce((s, m) => s + m.mult, 0)
    return mults.map(m => ({ cat: m.cat, pct: Math.round((m.mult / total) * 100) }))
  })

  function toggleCategory(cat: string) {
    const idx = config.categories.findIndex(c => c.category === cat)
    if (idx === -1) return
    const current = config.categories[idx].weight
    if (current === 0) {
      // Only allow toggling on if under MAX_INTEREST_CATEGORIES
      if (countActiveInterests(config) >= MAX_INTEREST_CATEGORIES) return
      config.categories[idx] = { ...config.categories[idx], weight: 50 }
    } else {
      config.categories[idx] = { ...config.categories[idx], weight: 0, subcategoryWeights: {} }
    }
    config = { ...config }
  }

  function setWeight(cat: string, value: number) {
    const idx = config.categories.findIndex(c => c.category === cat)
    if (idx === -1) return
    config.categories[idx] = { ...config.categories[idx], weight: Math.max(0, Math.min(100, value)) }
    config = { ...config }
  }

  function setSubWeight(cat: string, sub: string, value: number) {
    const idx = config.categories.findIndex(c => c.category === cat)
    if (idx === -1) return
    const subWeights = { ...config.categories[idx].subcategoryWeights, [sub]: Math.max(0, Math.min(100, value)) }
    config.categories[idx] = { ...config.categories[idx], subcategoryWeights: subWeights }
    config = { ...config }
  }

  function resetToDefaults() {
    config = createDefaultInterestConfig()
  }

  function applyAndClose() {
    saveInterestConfig(config)
    currentScreen.set('settings')
  }
</script>
```

The template renders:
- A heading: "What do you want to learn?"
- A row of CATEGORIES as pill/chip buttons; selected ones shown in accent color; max 3 selected; if at max, unselected chips are dimmed
- For each active category: a labeled range slider (0–100 labeled "Mild Interest" to "Strong Focus")
- For each active category with subcategories detected from loaded facts: a collapsible "drill down" section showing per-subcategory sliders
- A horizontal bar chart "preview" showing percent distribution based on current weights
- A toggle: "Let GAIA learn my preferences" (maps to `config.behavioralLearningEnabled`)
- Buttons: "Reset to defaults" and "Save & Close" (≥44px tall each)

#### Step 6: Add `'interestSettings'` to `Screen` in `src/ui/stores/gameState.ts`

```typescript
export type Screen =
  | 'mainMenu'
  | /* ... existing ... */
  | 'interestSettings'
```

#### Step 7: Wire navigation from `Settings.svelte`

Add a button in the settings page that calls `currentScreen.set('interestSettings')`. Also wire `InterestSettings.svelte` into `App.svelte`'s screen router.

### Acceptance Criteria

- [ ] InterestSettings page renders with all 7 top-level CATEGORIES as toggleable chips
- [ ] Selecting more than 3 categories is blocked; chips are visually disabled at the limit
- [ ] Weight slider for an active category updates the live preview distribution bar in real time
- [ ] Reset to defaults restores all weights to 0 and clears behavioral boosts
- [ ] Save & Close persists `interestConfig` to `localStorage` via `saveService.ts`
- [ ] On app reload, `interestConfig` is restored from save (verify in DevPanel debug info)
- [ ] Subcategory drill-down appears when a parent is active and facts with that category exist

### Playwright Test

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:5173', { bypassCSP: true })
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

  // Navigate to Settings
  await page.click('button[aria-label="Settings"]')
  await page.waitForSelector('text=Interest Settings', { timeout: 5000 })
  await page.click('text=Interest Settings')
  await page.waitForSelector('text=What do you want to learn', { timeout: 5000 })

  // Toggle "History" interest
  await page.click('button:has-text("History")')
  await page.waitForSelector('text=History', { timeout: 2000 })

  // Save and verify persistence
  await page.click('button:has-text("Save & Close")')
  await page.waitForTimeout(500)

  // Reload and verify
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

  const save = await page.evaluate(() => {
    const raw = localStorage.getItem('terra-gacha-save')
    return raw ? JSON.parse(raw) : null
  })
  const historyEntry = save?.interestConfig?.categories?.find(c => c.category === 'History')
  console.assert(historyEntry?.weight > 0, 'History interest weight should be saved')
  console.log('12.1 PASS: Interest config persisted across reload')

  await page.screenshot({ path: '/tmp/ss-interest-settings.png' })
  await browser.close()
})()
```

---

## Sub-Phase 12.2: Weighted Fact Spawning

### What

Bias artifact node fact selection in the mine toward the player's interest categories. Bias quiz question selection during dives toward interest categories. Bias GAIA's study suggestions toward interests. Apply the invisible biome interest-bias defined in DD-V2-120 (~30% weight boost for interest-aligned biomes). Interest weighting is additive — base probability for all categories is always >= 1.0.

### Where

- **Modified**: `src/game/systems/MineGenerator.ts` — `generateMine()` receives interest config, uses weighted selection for artifact fact IDs
- **Modified**: `src/data/biomes.ts` — `generateBiomeSequence()` (or a new wrapper) accepts interest config to apply 30% boost
- **Modified**: `src/game/managers/QuizManager.ts` — quiz question selection uses `computeFactWeights()`
- **Modified**: `src/game/GameManager.ts` — pass interest config to mine generator and quiz manager
- **New file**: `src/services/interestSpawner.ts` — pure functions for weighted fact and biome selection

### How

#### Step 1: Create `src/services/interestSpawner.ts`

```typescript
import type { InterestConfig } from '../data/interestConfig'
import { computeFactWeights, weightedRandomSelect } from '../data/interestConfig'
import type { Biome } from '../data/biomes'
import { BIOMES } from '../data/biomes'

/** Biome-to-category affinity mapping (DD-V2-120). */
const BIOME_CATEGORY_AFFINITY: Record<string, string[]> = {
  crystalline: ['Natural Sciences', 'Geography'],  // geology, mineralogy
  volcanic: ['Natural Sciences', 'Geography'],     // geology, tectonics
  sedimentary: ['History', 'Life Sciences'],       // paleontology, ancient earth
  // Expand as Phase 9 adds more biomes
}

/**
 * Returns a weighted biome selection pool that gives a ~30% weight boost to
 * biomes whose category affinity matches the player's active interests (DD-V2-120).
 * This is invisible to the player and non-configurable.
 *
 * @param interestConfig - Player's current interest configuration.
 * @param rng - Seeded random number generator.
 * @returns Selected Biome.
 */
export function pickBiomeWithInterestBias(
  interestConfig: InterestConfig,
  rng: () => number,
): Biome {
  const activeCategories = interestConfig.categories
    .filter(c => c.weight > 0)
    .map(c => c.category)

  const weights = BIOMES.map(biome => {
    const affinities = BIOME_CATEGORY_AFFINITY[biome.id] ?? []
    const hasAffinity = affinities.some(affCat => activeCategories.includes(affCat))
    return hasAffinity ? 1.3 : 1.0  // 30% boost for interest-aligned biomes (DD-V2-120)
  })

  return weightedRandomSelect(BIOMES, weights, rng) ?? BIOMES[0]
}

/**
 * Generates an interest-biased biome sequence for an entire dive run.
 * Layer 0 is always sedimentary (tutorial). Later layers use interest-biased selection.
 *
 * @param rng - Seeded RNG for deterministic results.
 * @param maxLayers - Total layer count for this run.
 * @param interestConfig - Player's interest configuration.
 * @returns Array of Biome objects, one per layer index.
 */
export function generateInterestBiasedBiomeSequence(
  rng: () => number,
  maxLayers: number,
  interestConfig: InterestConfig,
): Biome[] {
  const sequence: Biome[] = [BIOMES[0]] // Layer 0 is always sedimentary

  for (let layer = 1; layer < maxLayers; layer++) {
    // If no interests are set, fall back to uniform random selection
    const hasInterests = interestConfig.categories.some(c => c.weight > 0)
    if (!hasInterests) {
      sequence.push(BIOMES[Math.floor(rng() * BIOMES.length)])
    } else {
      sequence.push(pickBiomeWithInterestBias(interestConfig, rng))
    }
  }

  return sequence
}

/**
 * Selects a fact ID from the available fact pool using interest-weighted random selection.
 * If category lock is active and no facts match, falls back to the full pool.
 *
 * @param factPool - Array of {id, category} objects to pick from.
 * @param interestConfig - Player's interest configuration.
 * @param rng - Random number generator.
 * @returns Selected fact ID, or undefined if factPool is empty.
 */
export function selectWeightedFact(
  factPool: Array<{ id: string; category: string[] }>,
  interestConfig: InterestConfig,
  rng: () => number,
): string | undefined {
  if (factPool.length === 0) return undefined

  let weights = computeFactWeights(factPool, interestConfig)
  const totalWeight = weights.reduce((s, w) => s + w, 0)

  // Fallback: if category lock eliminated all facts, use the full pool
  if (totalWeight === 0) {
    weights = factPool.map(() => 1.0)
  }

  const selected = weightedRandomSelect(factPool, weights, rng)
  return selected?.id
}
```

#### Step 2: Modify `generateMine()` in `MineGenerator.ts`

Change the function signature to accept `interestConfig`:

```typescript
import type { InterestConfig } from '../../data/interestConfig'
import { selectWeightedFact } from '../../services/interestSpawner'

export function generateMine(
  seed: number,
  width: number,
  height: number,
  facts: Array<{ id: string; category: string[] }>,  // Changed: was string[]
  layer = 0,
  biome: Biome = DEFAULT_BIOME,
  interestConfig?: InterestConfig,
): { grid: MineCell[][], spawnX: number, spawnY: number, biome: Biome }
```

Replace the `nextFactId()` function inside `generateMine()`:

```typescript
const nextFactId = (): string | undefined => {
  if (facts.length === 0) return undefined

  if (interestConfig) {
    // Use interest-weighted selection for each artifact placement
    return selectWeightedFact(facts, interestConfig, rng)
  }

  // Fallback: original round-robin behavior
  const factId = facts[factCursor % facts.length].id
  factCursor += 1
  return factId
}
```

#### Step 3: Modify `generateBiomeSequence()` callers in `GameManager.ts`

In `GameManager.ts`, import and use `generateInterestBiasedBiomeSequence`:

```typescript
import { generateInterestBiasedBiomeSequence } from '../services/interestSpawner'
import { get } from 'svelte/store'
import { playerSave } from '../ui/stores/playerData'

// Where biome sequence is generated for a new run:
const ps = get(playerSave)
const biomeSequence = ps?.interestConfig
  ? generateInterestBiasedBiomeSequence(rng, maxLayers, ps.interestConfig)
  : generateBiomeSequence(rng, maxLayers)
```

#### Step 4: Modify `QuizManager.ts` for interest-weighted quiz question selection

In the method that selects a fact for a random/gate quiz, wrap the selection logic:

```typescript
import { selectWeightedFact } from '../services/interestSpawner'
import { get } from 'svelte/store'
import { playerSave } from '../../ui/stores/playerData'

// Inside selectQuizFact() or equivalent:
private selectQuizFact(pool: Array<{ id: string; category: string[] }>): string | undefined {
  const ps = get(playerSave)
  if (ps?.interestConfig) {
    return selectWeightedFact(pool, ps.interestConfig, () => Math.random())
  }
  // Fallback: original random selection
  return pool[Math.floor(Math.random() * pool.length)]?.id
}
```

#### Step 5: Modify GAIA study suggestions

In `GaiaManager.ts`, when generating "You should review these facts" suggestions, apply interest weighting:

```typescript
import { computeFactWeights, weightedRandomSelect } from '../../data/interestConfig'
import { get } from 'svelte/store'
import { playerSave } from '../../ui/stores/playerData'

// When selecting facts for GAIA review suggestions:
public getSuggestedReviewFacts(
  candidates: Array<{ id: string; category: string[] }>,
  count: number,
): string[] {
  const ps = get(playerSave)
  const selected: string[] = []
  const remaining = [...candidates]

  for (let i = 0; i < count && remaining.length > 0; i++) {
    const weights = ps?.interestConfig
      ? computeFactWeights(remaining, ps.interestConfig)
      : remaining.map(() => 1.0)

    const item = weightedRandomSelect(remaining, weights, Math.random)
    if (item) {
      selected.push(item.id)
      remaining.splice(remaining.indexOf(item), 1)
    }
  }

  return selected
}
```

### Acceptance Criteria

- [ ] In a dev session with History interest set to weight=100, run 10 mines and observe that >50% of artifact nodes contain History facts (use DevPanel to inspect inventory)
- [ ] Biome selection over 20 dives with "Natural Sciences" interest shows crystalline/volcanic biomes more often than a control run without interests
- [ ] Category lock with `['Language', 'Japanese']` causes ALL quiz questions and artifact facts to be Japanese-category (verify in mine with DevPanel)
- [ ] When no facts match a locked category (empty subcategory), mine generation falls back gracefully to full pool with no console errors
- [ ] `npm run typecheck` passes with the new `facts` parameter type change in `generateMine()`

### Playwright Test

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:5173', { bypassCSP: true })
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

  // Inject a high History interest weight directly into localStorage
  await page.evaluate(() => {
    const raw = localStorage.getItem('terra-gacha-save')
    if (!raw) return
    const save = JSON.parse(raw)
    const histIdx = save.interestConfig.categories.findIndex(c => c.category === 'History')
    if (histIdx >= 0) save.interestConfig.categories[histIdx].weight = 100
    localStorage.setItem('terra-gacha-save', JSON.stringify(save))
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

  // Do a dive and collect facts
  await page.click('button:has-text("Dive")')
  await page.waitForSelector('text=Enter Mine', { timeout: 5000 })
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(5000)
  await page.screenshot({ path: '/tmp/ss-interest-mine.png' })
  console.log('12.2: Mine started with interest-weighted spawning; inspect screenshot for artifacts')

  await browser.close()
})()
```

---

## Sub-Phase 12.3: Behavioral Preference Learning

### What

An opt-in system that infers interest weights from player behavior. Only positive signals are tracked: voluntarily studying a fact (not just seeing it on quiz), keeping an artifact rather than selling, and achieving high mastery speed (interval progressing faster than average). Selling is explicitly excluded as a preference signal (DD-V2-118). The system maintains per-category inferred boosts capped at 0.3 (MAX_INFERRED_BOOST). A transparency panel ("GAIA thinks you like...") shows what the system has inferred, with per-category adjustment sliders so the player can correct any wrong inference.

### Where

- **New file**: `src/services/behavioralLearner.ts` — signal recording and boost computation
- **New file**: `src/ui/components/GaiaInferencePanel.svelte` — transparency panel UI
- **Modified**: `src/data/types.ts` — add `BehavioralSignals` to `PlayerSave`
- **Modified**: `src/services/saveService.ts` — migrate `behavioralSignals` field
- **Modified**: `src/ui/stores/playerData.ts` — `addLearnedFact()` and study session hooks call signal recording
- **Modified**: `src/game/managers/StudyManager.ts` — record voluntary study signals
- **Modified**: `src/ui/components/InterestSettings.svelte` — add GAIA inference transparency section

### How

#### Step 1: Add `BehavioralSignals` to `src/data/types.ts`

```typescript
/** Positive behavioral signals tracked per category for interest inference (DD-V2-118). */
export interface CategoryBehavioralSignals {
  /** Number of times player voluntarily started a study session containing this category. */
  voluntaryStudySessions: number
  /** Number of facts from this category the player chose to KEEP (not sell). */
  artifactsKept: number
  /**
   * Number of facts from this category that reached interval >= 14 days
   * (progressing faster than average SM-2 baseline indicates natural affinity).
   */
  fastMasteryCount: number
}

/** Container for all behavioral learning signals, stored in PlayerSave. */
export interface BehavioralSignals {
  /** Per-category positive signal counts. */
  perCategory: Record<string, CategoryBehavioralSignals>
  /** Total dives completed at the time of last boost recalculation. */
  lastRecalcDives: number
}
```

Add to `PlayerSave`:

```typescript
/** Behavioral signals for opt-in interest inference. */
behavioralSignals: BehavioralSignals
```

#### Step 2: Migrate `saveService.ts`

In `load()` migration block:

```typescript
if (!parsedAny['behavioralSignals'] || typeof parsedAny['behavioralSignals'] !== 'object') {
  parsedAny['behavioralSignals'] = { perCategory: {}, lastRecalcDives: 0 }
}
```

In `createNewPlayer()`:

```typescript
behavioralSignals: { perCategory: {}, lastRecalcDives: 0 },
```

#### Step 3: Create `src/services/behavioralLearner.ts`

```typescript
import type { BehavioralSignals, CategoryBehavioralSignals } from '../data/types'
import type { InterestConfig } from '../data/interestConfig'
import { MAX_INFERRED_BOOST } from '../data/interestConfig'
import { CATEGORIES } from '../data/types'

/**
 * Records that a player voluntarily started a study session.
 * Increments voluntaryStudySessions for each category present in the session.
 *
 * @param signals - Current behavioral signals (mutated, then returned).
 * @param sessionCategories - Unique top-level categories present in the study session facts.
 * @returns Updated signals object.
 */
export function recordVoluntaryStudy(
  signals: BehavioralSignals,
  sessionCategories: string[],
): BehavioralSignals {
  const updated = { ...signals, perCategory: { ...signals.perCategory } }
  for (const cat of sessionCategories) {
    const current: CategoryBehavioralSignals = updated.perCategory[cat] ?? {
      voluntaryStudySessions: 0,
      artifactsKept: 0,
      fastMasteryCount: 0,
    }
    updated.perCategory[cat] = {
      ...current,
      voluntaryStudySessions: current.voluntaryStudySessions + 1,
    }
  }
  return updated
}

/**
 * Records that a player kept an artifact (did not sell it after a dive).
 * Call this when the player returns to base with artifacts and does NOT sell them
 * within BALANCE.SELL_DECISION_WINDOW_DIVES dives.
 *
 * @param signals - Current behavioral signals.
 * @param factCategory - Top-level category of the kept fact.
 * @returns Updated signals object.
 */
export function recordArtifactKept(
  signals: BehavioralSignals,
  factCategory: string,
): BehavioralSignals {
  const current: CategoryBehavioralSignals = signals.perCategory[factCategory] ?? {
    voluntaryStudySessions: 0,
    artifactsKept: 0,
    fastMasteryCount: 0,
  }
  return {
    ...signals,
    perCategory: {
      ...signals.perCategory,
      [factCategory]: { ...current, artifactsKept: current.artifactsKept + 1 },
    },
  }
}

/**
 * Records a fast mastery event — when a fact's SM-2 interval reaches 14+ days.
 * Called from the SM-2 review update hook when interval crosses the threshold.
 *
 * @param signals - Current behavioral signals.
 * @param factCategory - Top-level category of the fast-mastered fact.
 * @returns Updated signals object.
 */
export function recordFastMastery(
  signals: BehavioralSignals,
  factCategory: string,
): BehavioralSignals {
  const current: CategoryBehavioralSignals = signals.perCategory[factCategory] ?? {
    voluntaryStudySessions: 0,
    artifactsKept: 0,
    fastMasteryCount: 0,
  }
  return {
    ...signals,
    perCategory: {
      ...signals.perCategory,
      [factCategory]: { ...current, fastMasteryCount: current.fastMasteryCount + 1 },
    },
  }
}

/** Minimum total signal count (across all three types) for a category to receive any inferred boost. */
const SIGNAL_THRESHOLD = 3

/**
 * Recomputes inferred boosts for all categories from behavioral signals.
 * Caps each category's inferred boost at MAX_INFERRED_BOOST (0.3).
 * Only updates inferredBoosts — never modifies explicit player weights.
 *
 * Scoring formula per category:
 *   raw = (voluntaryStudySessions * 2) + (artifactsKept * 1) + (fastMasteryCount * 3)
 *   normalized = min(raw / 30, 1.0)  // 30 = "strong interest" threshold
 *   inferredBoost = normalized * MAX_INFERRED_BOOST
 *
 * @param signals - Current behavioral signals.
 * @param currentConfig - Player's current explicit interest configuration.
 * @returns Updated InterestConfig with recalculated inferredBoosts.
 */
export function recalculateInferredBoosts(
  signals: BehavioralSignals,
  currentConfig: InterestConfig,
): InterestConfig {
  const newInferred: Record<string, number> = {}

  for (const cat of CATEGORIES) {
    const catSignals = signals.perCategory[cat]
    if (!catSignals) continue

    const totalSignals =
      catSignals.voluntaryStudySessions + catSignals.artifactsKept + catSignals.fastMasteryCount
    if (totalSignals < SIGNAL_THRESHOLD) continue

    const raw =
      (catSignals.voluntaryStudySessions * 2) +
      (catSignals.artifactsKept * 1) +
      (catSignals.fastMasteryCount * 3)

    const normalized = Math.min(raw / 30, 1.0)
    newInferred[cat] = Math.round(normalized * MAX_INFERRED_BOOST * 100) / 100
  }

  return { ...currentConfig, inferredBoosts: newInferred }
}

/**
 * Returns a human-readable summary of inferred boosts for the transparency panel.
 * Only returns categories where inferredBoost > 0.05 (meaningful signal).
 *
 * @param config - Player's interest configuration with computed inferredBoosts.
 * @returns Array of {category, boostPercent} sorted by boost descending.
 */
export function getInferenceTransparencySummary(
  config: InterestConfig,
): Array<{ category: string; boostPercent: number }> {
  return Object.entries(config.inferredBoosts)
    .filter(([, boost]) => boost > 0.05)
    .map(([category, boost]) => ({
      category,
      boostPercent: Math.round((boost / MAX_INFERRED_BOOST) * 100),
    }))
    .sort((a, b) => b.boostPercent - a.boostPercent)
}
```

#### Step 4: Build `GaiaInferencePanel.svelte`

This component is a collapsible section within `InterestSettings.svelte` that appears only when `config.behavioralLearningEnabled` is true and there are meaningful inferred boosts:

```svelte
<script lang="ts">
  import { getInferenceTransparencySummary } from '../../../services/behavioralLearner'
  import type { InterestConfig } from '../../../data/interestConfig'

  let { config }: { config: InterestConfig } = $props()
  let summary = $derived(getInferenceTransparencySummary(config))
</script>

{#if summary.length > 0}
  <section class="gaia-inference">
    <h3>GAIA thinks you like...</h3>
    <p class="hint">Based on your study habits and artifact choices.</p>
    {#each summary as item}
      <div class="inference-row">
        <span class="cat-label">{item.category}</span>
        <div class="boost-bar">
          <div class="fill" style="width: {item.boostPercent}%"></div>
        </div>
        <span class="pct">{item.boostPercent}%</span>
      </div>
    {/each}
    <p class="note">
      This is added to your manual settings, capped at 30% extra.
      To override, adjust the sliders above.
    </p>
  </section>
{/if}
```

#### Step 5: Wire signal recording into existing hooks

In `StudyManager.ts`, after a voluntary study session starts:

```typescript
import { recordVoluntaryStudy, recalculateInferredBoosts } from '../../services/behavioralLearner'
import { get } from 'svelte/store'
import { playerSave } from '../../ui/stores/playerData'
import { saveInterestConfig } from '../../ui/stores/settings'

// When study session begins with user intent (not forced review):
public onVoluntaryStudyStart(facts: Array<{ category: string[] }>): void {
  const ps = get(playerSave)
  if (!ps?.interestConfig?.behavioralLearningEnabled) return

  const categories = [...new Set(facts.map(f => f.category[0]).filter(Boolean))]
  const updatedSignals = recordVoluntaryStudy(ps.behavioralSignals, categories)
  const updatedConfig = recalculateInferredBoosts(updatedSignals, ps.interestConfig)

  playerSave.update(s => s ? { ...s, behavioralSignals: updatedSignals, interestConfig: updatedConfig } : s)
  saveInterestConfig(updatedConfig)
}
```

In `playerData.ts`, when SM-2 interval crosses 14 days after a review update, call `recordFastMastery`. Wire artifact-kept tracking at the end of `diveResults` processing when the player exits without selling.

### Acceptance Criteria

- [ ] Behavioral learning toggle in InterestSettings persists (default = off)
- [ ] With behavioral learning ON: after 5+ voluntary study sessions for "History" category, `inferredBoosts['History']` is > 0 in the save
- [ ] `inferredBoosts` never exceeds MAX_INFERRED_BOOST (0.3) for any category
- [ ] Selling a fact does NOT increase any inferred boost (verified by inspecting save before/after selling via DevPanel)
- [ ] GAIA inference panel displays correctly when there are meaningful signals
- [ ] Recalculation only fires when `behavioralLearningEnabled` is true

### Playwright Test

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:5173', { bypassCSP: true })
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

  // Enable behavioral learning and inject signals directly
  await page.evaluate(() => {
    const raw = localStorage.getItem('terra-gacha-save')
    if (!raw) return
    const save = JSON.parse(raw)
    save.interestConfig.behavioralLearningEnabled = true
    // Simulate 5 voluntary study sessions for History
    save.behavioralSignals.perCategory['History'] = {
      voluntaryStudySessions: 5,
      artifactsKept: 3,
      fastMasteryCount: 2,
    }
    localStorage.setItem('terra-gacha-save', JSON.stringify(save))
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

  // Trigger boost recalculation by opening Interest Settings
  await page.click('button[aria-label="Settings"]')
  await page.click('text=Interest Settings')
  await page.waitForSelector('text=GAIA thinks you like', { timeout: 5000 })

  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('terra-gacha-save') ?? '{}'))
  const historyBoost = save?.interestConfig?.inferredBoosts?.['History'] ?? 0
  console.assert(historyBoost > 0, `History inferred boost should be > 0, got ${historyBoost}`)
  console.assert(historyBoost <= 0.3, `Inferred boost should be capped at 0.3, got ${historyBoost}`)
  console.log('12.3 PASS: Behavioral inference working correctly')
  await page.screenshot({ path: '/tmp/ss-gaia-inference.png' })
  await browser.close()
})()
```

---

## Sub-Phase 12.4: Category-Lock Shop Item

### What

A purchasable item in the Knowledge Store that enables Category Lock mode. When active, only facts from the selected category path appear in mines, quizzes, and GAIA suggestions. Implements DD-V2-132: Language Mode is Category Lock applied to language categories, not a separate game mode. The lock is toggleable (can be disabled without forgetting the configured lock path). All SM-2 progress and Knowledge Tree progress is preserved on toggle (the tree shows a filtered view when lock is active).

### Where

- **Modified**: `src/data/knowledgeStore.ts` — add `'category_lock'` item to `KNOWLEDGE_ITEMS`
- **Modified**: `src/data/interestConfig.ts` — `categoryLock` and `categoryLockActive` already in `InterestConfig`
- **New file**: `src/ui/components/CategoryLockSelector.svelte` — subcategory picker UI shown after purchasing
- **Modified**: `src/ui/components/InterestSettings.svelte` — show category lock status and toggle
- **Modified**: `src/services/interestSpawner.ts` — `selectWeightedFact()` already handles lock via `computeFactWeights()`
- **Modified**: `src/game/managers/GaiaManager.ts` — adapt GAIA commentary when lock is active

### How

#### Step 1: Add category lock item to `KNOWLEDGE_ITEMS` in `knowledgeStore.ts`

```typescript
{
  id: 'category_lock',
  name: 'Focus Crystal',
  description: 'Lock your mine to a single subject. Perfect for dedicated study.',
  icon: '🔒',
  category: 'powerup',
  cost: 150,
  effect: { type: 'category_lock' },  // New effect type (see below)
  maxPurchases: 1,
  unlockRequirement: { type: 'mastered_facts', value: 5 },
},
```

Add `category_lock` to the `KnowledgeEffect` union in `knowledgeStore.ts`:

```typescript
export type KnowledgeEffect =
  | { type: 'quiz_hint'; value: number }
  | { type: 'xp_multiplier'; value: number }
  | { type: 'dust_per_correct'; value: number }
  | { type: 'review_extension'; days: number }
  | { type: 'category_boost'; category: string; value: number }
  | { type: 'category_lock' }   // Unlocks the category lock mechanic
```

#### Step 2: Build `CategoryLockSelector.svelte`

This modal-style overlay appears when the player first activates the Focus Crystal, letting them choose what to lock to:

```svelte
<script lang="ts">
  import { CATEGORIES } from '../../../data/types'
  import type { InterestConfig } from '../../../data/interestConfig'

  let { config, onSelect, onCancel }: {
    config: InterestConfig,
    onSelect: (lockPath: string[]) => void,
    onCancel: () => void,
  } = $props()

  let selectedCategory = $state('')
  let selectedSubcategory = $state('')
  // subcategories derived from facts available in the DB for the selected category
  // Pass subcategories as a prop from the parent (loaded from factsDB)
  let { subcategories }: { subcategories: Record<string, string[]> } = $props()

  function confirm() {
    if (!selectedCategory) return
    const path = selectedSubcategory
      ? [selectedCategory, selectedSubcategory]
      : [selectedCategory]
    onSelect(path)
  }
</script>

<div class="lock-selector-overlay" role="dialog" aria-modal="true">
  <h2>Choose Your Focus</h2>
  <p>Only facts from this category will appear in your mine and quizzes.</p>

  <div class="category-grid">
    {#each CATEGORIES as cat}
      <button
        class="cat-chip"
        class:selected={selectedCategory === cat}
        onclick={() => { selectedCategory = cat; selectedSubcategory = '' }}
        style="min-height: 44px;"
      >
        {cat}
      </button>
    {/each}
  </div>

  {#if selectedCategory && subcategories[selectedCategory]?.length}
    <div class="sub-list">
      <p>Narrow further (optional):</p>
      {#each subcategories[selectedCategory] as sub}
        <button
          class="sub-chip"
          class:selected={selectedSubcategory === sub}
          onclick={() => selectedSubcategory = selectedSubcategory === sub ? '' : sub}
          style="min-height: 44px;"
        >
          {sub}
        </button>
      {/each}
    </div>
  {/if}

  <div class="actions">
    <button onclick={onCancel} style="min-height: 44px;">Cancel</button>
    <button onclick={confirm} disabled={!selectedCategory} style="min-height: 44px; background: var(--accent);">
      Lock Focus
    </button>
  </div>
</div>
```

#### Step 3: Wire lock toggle into `InterestSettings.svelte`

Add a section that appears if the player has purchased `category_lock`:

```svelte
{#if hasFocusCrystal}
  <section class="lock-section">
    <h3>Focus Crystal</h3>
    {#if config.categoryLock}
      <p>Locked to: <strong>{config.categoryLock.join(' → ')}</strong></p>
      <label class="toggle-row">
        <input type="checkbox" bind:checked={config.categoryLockActive} />
        Category Lock Active
      </label>
      <button onclick={changeLockTarget}>Change Focus...</button>
    {:else}
      <p>No focus selected yet.</p>
      <button onclick={openLockSelector}>Choose Focus...</button>
    {/if}
  </section>
{/if}
```

#### Step 4: GAIA awareness of lock (DD-V2-132)

In `GaiaManager.ts`, when composing GAIA commentary for facts:

```typescript
public adaptCommentaryForLock(defaultComment: string, factCategory: string[]): string {
  const ps = get(playerSave)
  const lock = ps?.interestConfig?.categoryLock
  const lockActive = ps?.interestConfig?.categoryLockActive

  if (!lock || !lockActive) return defaultComment

  // If GAIA is commenting on a fact within the locked category, acknowledge focus
  const isInLock = lock.every((seg, i) => factCategory[i] === seg)
  if (isInLock) {
    return `[Focus Mode] ${defaultComment}`  // Prefix replaced by actual GAIA dialogue variants
  }
  return defaultComment
}
```

Add 3 GAIA dialogue variants per mood for focus mode in `gaiaDialogue.ts`:
- snarky: "Yes, yes, more of the thing you're obsessed with. I'll indulge you."
- enthusiastic: "Staying focused! I love the dedication!"
- calm: "Consistent focus accelerates mastery. A good choice."

### Acceptance Criteria

- [ ] Focus Crystal appears in Knowledge Store after purchasing (cost 150 KP, requires 5 mastered facts)
- [ ] After purchasing, Category Lock section appears in Interest Settings
- [ ] CategoryLockSelector renders all CATEGORIES as tappable chips (≥44px)
- [ ] Selecting a category + optional subcategory and confirming sets `categoryLock` in save
- [ ] With lock active: ALL artifact facts, quiz questions, and GAIA review suggestions are from the locked path
- [ ] Toggling lock off (unchecking Active) immediately restores normal weighted spawning without clearing the configured path
- [ ] Language Mode works via lock: locking to `['Language', 'Japanese']` restricts to Japanese vocab (DD-V2-132)
- [ ] Knowledge Tree shows filtered view when lock is active (counts still reflect full progress)

### Playwright Test

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:5173', { bypassCSP: true })
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

  // Simulate having purchased the Focus Crystal and configured a lock
  await page.evaluate(() => {
    const raw = localStorage.getItem('terra-gacha-save')
    if (!raw) return
    const save = JSON.parse(raw)
    if (!save.purchasedKnowledgeItems.includes('category_lock')) {
      save.purchasedKnowledgeItems.push('category_lock')
    }
    save.interestConfig.categoryLock = ['Language']
    save.interestConfig.categoryLockActive = true
    localStorage.setItem('terra-gacha-save', JSON.stringify(save))
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

  // Verify lock section visible in Interest Settings
  await page.click('button[aria-label="Settings"]')
  await page.click('text=Interest Settings')
  await page.waitForSelector('text=Focus Crystal', { timeout: 5000 })
  await page.waitForSelector('text=Locked to: Language', { timeout: 3000 })
  console.log('12.4 PASS: Category lock UI renders correctly')

  await page.screenshot({ path: '/tmp/ss-category-lock.png' })
  await browser.close()
})()
```

---

## Sub-Phase 12.5: Tutorial Interest Assessment

### What

During onboarding (Phase 14), present an interest assessment screen that captures the player's initial interests before their first dive. This feeds the initial `InterestConfig` with nonzero weights, so the very first mine already feels personally relevant. The screen uses interest "bubbles" (tappable chips with icons), follow-up refinement questions for broad choices, and the critical branching question about whether the player wants exposure to other topics (determines whether Category Lock is pre-activated). Settings can always be changed later.

### Where

- **Modified**: `src/ui/components/Onboarding.svelte` (or Phase 14's onboarding file, once created)
- **New file**: `src/ui/components/InterestAssessment.svelte` — standalone assessment screen
- **Modified**: `src/ui/stores/gameState.ts` — add `'interestAssessment'` to `Screen` union
- **Modified**: `src/services/saveService.ts` — `createNewPlayer()` no longer sets default interestConfig; instead triggers assessment
- **Modified**: `src/ui/stores/playerData.ts` — `initPlayer()` detects new player and routes to assessment

### How

#### Step 1: Create `InterestAssessment.svelte`

The assessment has three steps:
1. **Broad interests**: Show 8 persona bubbles (Historian, Geologist, Language Learner, Biologist, Technologist, Geographer, Anthropologist, Eclectic) as large tappable chips with icons. Multiple select. Each maps to one or more CATEGORIES with a weight.
2. **Refinement** (conditional): For broad categories like "Language Learner", ask "Which language?" (Japanese, Spanish, French, Chinese, Other). For "Geologist", ask "Volcanoes or oceans or both?".
3. **Focus question**: "Are you open to discovering other topics about this planet?" YES (default, keep all) / NO (activate Category Lock for chosen interests).

```typescript
/** Maps persona bubble IDs to CATEGORIES and initial weight. */
const PERSONA_CATEGORY_MAP: Record<string, Array<{ category: string; weight: number }>> = {
  historian:       [{ category: 'History', weight: 80 }],
  geologist:       [{ category: 'Natural Sciences', weight: 70 }, { category: 'Geography', weight: 40 }],
  language_learner: [{ category: 'Language', weight: 90 }],
  biologist:       [{ category: 'Life Sciences', weight: 80 }],
  technologist:    [{ category: 'Technology', weight: 80 }],
  geographer:      [{ category: 'Geography', weight: 80 }],
  anthropologist:  [{ category: 'Culture', weight: 75 }, { category: 'History', weight: 40 }],
  eclectic:        [], // All categories at weight 20 — curious about everything
}
```

The component outputs an `InterestConfig` object that gets saved via `saveInterestConfig()`.

Key logic:
- Eclectic persona: sets all categories to weight 20 (subtle boost everywhere)
- Language Learner: if they specify Japanese, set `categoryLock = ['Language', 'Japanese']`; if they chose "NO" to open discovery, activate the lock
- YES to open discovery: `categoryLockActive = false` (lock path may be stored but not active)
- NO to open discovery: `categoryLockActive = true`

```svelte
<script lang="ts">
  import { createDefaultInterestConfig, type InterestConfig } from '../../../data/interestConfig'
  import { CATEGORIES } from '../../../data/types'
  import { saveInterestConfig } from '../../stores/settings'
  import { currentScreen } from '../../stores/gameState'

  let step = $state<1 | 2 | 3>(1)
  let selectedPersonas = $state<string[]>([])
  let languageChoice = $state('')
  let openDiscovery = $state(true)

  const PERSONAS = [
    { id: 'historian', label: 'Historian', icon: '📜', hint: 'Ancient civilizations, events, people' },
    { id: 'geologist', label: 'Geologist', icon: '⛏️', hint: 'Rocks, minerals, plate tectonics' },
    { id: 'language_learner', label: 'Language Learner', icon: '🗣️', hint: 'Vocabulary, grammar, phrases' },
    { id: 'biologist', label: 'Biologist', icon: '🧬', hint: 'Life, ecosystems, evolution' },
    { id: 'technologist', label: 'Technologist', icon: '💻', hint: 'Innovation, inventions, computing' },
    { id: 'geographer', label: 'Geographer', icon: '🌍', hint: 'Places, maps, climate, cultures' },
    { id: 'anthropologist', label: 'Anthropologist', icon: '🏺', hint: 'Culture, society, traditions' },
    { id: 'eclectic', label: 'Eclectic', icon: '✨', hint: 'A bit of everything' },
  ]

  function buildConfig(): InterestConfig {
    const config = createDefaultInterestConfig()

    if (selectedPersonas.includes('eclectic')) {
      config.categories.forEach(c => { c.weight = 20 })
    } else {
      for (const personaId of selectedPersonas) {
        const mappings = PERSONA_CATEGORY_MAP[personaId] ?? []
        for (const { category, weight } of mappings) {
          const entry = config.categories.find(c => c.category === category)
          if (entry) entry.weight = Math.max(entry.weight, weight)
        }
      }
    }

    // Language refinement
    if (selectedPersonas.includes('language_learner') && languageChoice) {
      config.categoryLock = ['Language', languageChoice]
    }

    // Open discovery choice
    config.categoryLockActive = !openDiscovery && config.categoryLock !== null

    return config
  }

  function finish() {
    const config = buildConfig()
    saveInterestConfig(config)
    currentScreen.set('mainMenu')
  }
</script>
```

#### Step 2: Add `'interestAssessment'` to `Screen` union in `gameState.ts`

```typescript
| 'interestAssessment'
```

#### Step 3: Detect new player and route to assessment in `playerData.ts`

In `initPlayer()`:

```typescript
export function initPlayer(ageRating: AgeRating = 'teen'): PlayerSave {
  let savedData = load()

  if (!savedData) {
    savedData = createNewPlayer(ageRating)
    saveFn(savedData)
    // Route new players to interest assessment (handled by App.svelte Screen router)
    currentScreen.set('interestAssessment')
  }

  playerSave.set(savedData)
  return savedData
}
```

#### Step 4: Wire `InterestAssessment` into `App.svelte` screen router

```svelte
{#if $currentScreen === 'interestAssessment'}
  <InterestAssessment />
{/if}
```

### Acceptance Criteria

- [ ] New player (no save) sees InterestAssessment before main menu
- [ ] Selecting "Eclectic" sets all 7 categories to weight=20
- [ ] Selecting "Language Learner" + "Japanese" + "NO" to open discovery results in `categoryLock=['Language','Japanese']` and `categoryLockActive=true`
- [ ] Selecting "YES" to open discovery leaves `categoryLockActive=false`
- [ ] Existing players (with save) never see the assessment on launch
- [ ] All persona bubbles are ≥44px touch targets
- [ ] Assessment can be re-run via Settings ("Reset to defaults" + manual re-assessment link)

### Playwright Test

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })

  // Clear save to simulate new player
  await page.goto('http://localhost:5173', { bypassCSP: true })
  await page.evaluate(() => localStorage.removeItem('terra-gacha-save'))
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForSelector('text=What do you want to discover', { timeout: 10000 })

  // Select Historian persona
  await page.click('button:has-text("Historian")')
  await page.click('button:has-text("Next")')

  // Step 3: open discovery
  await page.waitForSelector('text=open to discovering', { timeout: 5000 })
  await page.click('button:has-text("Yes, surprise me")')
  await page.click('button:has-text("Start Mining")')

  await page.waitForSelector('button:has-text("Dive")', { timeout: 10000 })

  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('terra-gacha-save') ?? '{}'))
  const histEntry = save?.interestConfig?.categories?.find(c => c.category === 'History')
  console.assert(histEntry?.weight > 0, `Historian persona should set History weight > 0, got ${histEntry?.weight}`)
  console.assert(!save?.interestConfig?.categoryLockActive, 'Open discovery should leave lock inactive')
  console.log('12.5 PASS: Tutorial interest assessment working')

  await page.screenshot({ path: '/tmp/ss-interest-assessment.png' })
  await browser.close()
})()
```

---

## Sub-Phase 12.6: Player Archetype Detection

### What

A heuristic classification system that identifies one of four player archetypes by Day 7, then adapts GAIA's messaging and emphasis accordingly (DD-V2-172). Archetypes: Explorer (high dive depth, low study time), Scholar (high study time, low dive depth), Collector (high artifact/fossil collection rate), Sprinter (high session frequency, short sessions). Archetype is visible in a "GAIA's Report" panel, and the player can manually override. Re-evaluated weekly.

### Where

- **New file**: `src/services/archetypeDetector.ts` — heuristic classification functions
- **New file**: `src/ui/components/GaiaReport.svelte` — archetype display panel (integrates with Phase 10.8)
- **Modified**: `src/data/types.ts` — add `ArchetypeData` to `PlayerSave`
- **Modified**: `src/services/saveService.ts` — migrate `archetypeData`
- **Modified**: `src/game/managers/GaiaManager.ts` — archetype-aware message selection

### How

#### Step 1: Add archetype types to `src/data/types.ts`

```typescript
/** The four player archetypes detected by Day 7 (DD-V2-172). */
export type PlayerArchetype = 'explorer' | 'scholar' | 'collector' | 'sprinter' | 'undetected'

/** Archetype detection state stored in PlayerSave. */
export interface ArchetypeData {
  /** Current detected archetype (or 'undetected' before Day 7 / insufficient data). */
  detected: PlayerArchetype
  /** Player's manual override (null = no override, use detected). */
  manualOverride: PlayerArchetype | null
  /** Date (ISO YYYY-MM-DD) of last weekly re-evaluation. */
  lastEvaluatedDate: string | null
  /** Day number (count of distinct play dates) when archetype was first determined. */
  detectedOnDay: number | null
}

// Add to PlayerSave:
archetypeData: ArchetypeData
```

#### Step 2: Create `src/services/archetypeDetector.ts`

```typescript
import type { PlayerSave, PlayerArchetype, ArchetypeData } from '../data/types'

const DEFAULT_ARCHETYPE_DATA: ArchetypeData = {
  detected: 'undetected',
  manualOverride: null,
  lastEvaluatedDate: null,
  detectedOnDay: null,
}

/**
 * Computes behavioral metrics from player save data for archetype classification.
 * All metrics are normalized to [0, 1] against baseline thresholds.
 */
interface ArchetypeMetrics {
  /** Avg deepest layer per dive. High = Explorer. Threshold: >10 layers avg. */
  avgDepthScore: number
  /** Ratio of study session dives to total dives. High = Scholar. Threshold: >0.3. */
  studyRatioScore: number
  /** Artifacts + fossils per dive. High = Collector. Threshold: >3 per dive. */
  collectionRateScore: number
  /** Dives per week. High = Sprinter. Threshold: >7 per week. */
  divesPerWeekScore: number
  /** Distinct play days in last 7 days. */
  activeDays: number
}

function computeMetrics(save: PlayerSave): ArchetypeMetrics {
  const totalDives = save.stats.totalDivesCompleted
  if (totalDives === 0) {
    return { avgDepthScore: 0, studyRatioScore: 0, collectionRateScore: 0, divesPerWeekScore: 0, activeDays: 0 }
  }

  // Avg depth: normalize against 20 layers max
  const avgDepthScore = Math.min(save.stats.deepestLayerReached / 20, 1.0)

  // Study ratio: learnedFacts / totalDives (proxy for study intensity; cap at 1.0)
  const studyRatioScore = Math.min(save.stats.totalFactsLearned / (totalDives * 3), 1.0)

  // Collection rate: total artifacts / dives
  const totalArtifacts = save.stats.totalFactsLearned + Object.keys(save.fossils).length
  const collectionRateScore = Math.min(totalArtifacts / (totalDives * 3), 1.0)

  // Dives per week: estimate from streak and total dives
  const weeklyRate = totalDives / Math.max(save.stats.currentStreak, 1) * 7
  const divesPerWeekScore = Math.min(weeklyRate / 14, 1.0)  // >14/week is max score

  // Active days in last 7 (simplified: use streak as proxy)
  const activeDays = Math.min(save.stats.currentStreak, 7)

  return { avgDepthScore, studyRatioScore, collectionRateScore, divesPerWeekScore, activeDays }
}

/**
 * Determines the player's archetype from behavioral metrics.
 * Uses a winner-takes-all approach: compute a score for each archetype and pick the highest.
 * Returns 'undetected' if data is insufficient (< 7 active days, < 5 dives).
 *
 * @param save - Full player save.
 * @returns Detected archetype string.
 */
export function detectArchetype(save: PlayerSave): PlayerArchetype {
  if (save.stats.totalDivesCompleted < 5) return 'undetected'

  const metrics = computeMetrics(save)
  if (metrics.activeDays < 4) return 'undetected'  // Need at least 4 play days

  const scores: Record<PlayerArchetype, number> = {
    explorer:    metrics.avgDepthScore * 0.5 + (1 - metrics.studyRatioScore) * 0.3 + metrics.divesPerWeekScore * 0.2,
    scholar:     metrics.studyRatioScore * 0.6 + (1 - metrics.avgDepthScore) * 0.2 + metrics.collectionRateScore * 0.2,
    collector:   metrics.collectionRateScore * 0.7 + metrics.avgDepthScore * 0.15 + metrics.studyRatioScore * 0.15,
    sprinter:    metrics.divesPerWeekScore * 0.6 + (1 - metrics.avgDepthScore) * 0.2 + (1 - metrics.studyRatioScore) * 0.2,
    undetected:  0,
  }

  const best = (Object.entries(scores) as [PlayerArchetype, number][])
    .filter(([k]) => k !== 'undetected')
    .sort(([, a], [, b]) => b - a)[0]

  return best[0]
}

/**
 * Evaluates whether archetype detection should run (first detection or weekly re-evaluation).
 * Returns an updated ArchetypeData if re-evaluation ran; returns the current data unchanged otherwise.
 *
 * @param save - Full player save.
 * @param todayStr - ISO date string YYYY-MM-DD.
 * @returns Updated ArchetypeData (or existing if no re-eval needed).
 */
export function evaluateArchetype(save: PlayerSave, todayStr: string): ArchetypeData {
  const data = save.archetypeData ?? { ...DEFAULT_ARCHETYPE_DATA }

  // Re-evaluate if: never evaluated, or last eval was > 7 days ago
  const shouldEvaluate = !data.lastEvaluatedDate || (() => {
    const last = new Date(data.lastEvaluatedDate)
    const today = new Date(todayStr)
    return (today.getTime() - last.getTime()) >= 7 * 24 * 60 * 60 * 1000
  })()

  if (!shouldEvaluate) return data

  const detected = detectArchetype(save)
  return {
    ...data,
    detected,
    lastEvaluatedDate: todayStr,
    detectedOnDay: data.detectedOnDay ?? (detected !== 'undetected' ? save.stats.totalDivesCompleted : null),
  }
}

/** Returns the effective archetype (manual override takes precedence). */
export function getEffectiveArchetype(data: ArchetypeData): PlayerArchetype {
  return data.manualOverride ?? data.detected
}

/** GAIA message modifiers per archetype (merged with base GAIA dialogue). */
export const ARCHETYPE_GAIA_EMPHASIS: Record<PlayerArchetype, string> = {
  explorer:    'discovery',    // GAIA teases new depths, hints at undiscovered biomes
  scholar:     'mastery',      // GAIA celebrates milestones, interval progress
  collector:   'completionist', // GAIA "X more fossils to complete Triassic era"
  sprinter:    'streak',       // GAIA leads with streak count, daily challenge
  undetected:  'neutral',
}
```

#### Step 3: Migrate save and call `evaluateArchetype`

In `saveService.ts` migration:

```typescript
if (!parsedAny['archetypeData'] || typeof parsedAny['archetypeData'] !== 'object') {
  parsedAny['archetypeData'] = { detected: 'undetected', manualOverride: null, lastEvaluatedDate: null, detectedOnDay: null }
}
```

Call `evaluateArchetype` in `recordDiveComplete()` in `playerData.ts`:

```typescript
import { evaluateArchetype } from '../../services/archetypeDetector'

// At the end of the playerSave.update() in recordDiveComplete():
const todayStr = new Date().toISOString().split('T')[0]
const updatedArchetype = evaluateArchetype({ ...save, stats: updatedStats }, todayStr)
return { ...updatedSave, archetypeData: updatedArchetype }
```

#### Step 4: Build `GaiaReport.svelte` archetype display

```svelte
<script lang="ts">
  import { playerSave } from '../../stores/playerData'
  import { getEffectiveArchetype } from '../../../services/archetypeDetector'
  import type { PlayerArchetype } from '../../../data/types'

  const ARCHETYPE_DISPLAY: Record<PlayerArchetype, { label: string; icon: string; desc: string }> = {
    explorer:   { label: 'Explorer', icon: '🗺️', desc: 'You dive deep, driven by discovery. GAIA will hint at what lies below.' },
    scholar:    { label: 'Scholar', icon: '📚', desc: 'You study thoroughly. GAIA celebrates every mastery milestone.' },
    collector:  { label: 'Collector', icon: '🏺', desc: 'You complete sets. GAIA tracks what\'s missing from your collection.' },
    sprinter:   { label: 'Sprinter', icon: '⚡', desc: 'You show up daily. GAIA keeps your streak front and center.' },
    undetected: { label: 'Still Learning...', icon: '❓', desc: 'GAIA is observing your patterns. Check back after a few more dives.' },
  }

  let archetype = $derived(() => {
    const data = $playerSave?.archetypeData
    if (!data) return 'undetected'
    return getEffectiveArchetype(data)
  })

  let info = $derived(() => ARCHETYPE_DISPLAY[archetype()] ?? ARCHETYPE_DISPLAY.undetected)
</script>

<section class="gaia-report">
  <h3>Your Archetype</h3>
  <div class="archetype-card">
    <span class="icon">{info().icon}</span>
    <div>
      <strong>{info().label}</strong>
      <p>{info().desc}</p>
    </div>
  </div>
  <!-- Manual override: show all archetypes as selectable chips -->
</section>
```

#### Step 5: Integrate into `GaiaManager.ts`

Prepend archetype-specific prefix to certain GAIA message types:

```typescript
import { getEffectiveArchetype, ARCHETYPE_GAIA_EMPHASIS } from '../../services/archetypeDetector'

private getArchetypePrefix(save: PlayerSave): string {
  const archetype = getEffectiveArchetype(save.archetypeData)
  const emphasis = ARCHETYPE_GAIA_EMPHASIS[archetype]

  switch (emphasis) {
    case 'discovery': return `Layer ${save.stats.deepestLayerReached + 1} is uncharted. `
    case 'mastery':   return `${save.stats.totalFactsLearned} facts learned. `
    case 'completionist': return ''  // Handled per context
    case 'streak':    return `Day ${save.stats.currentStreak}. `
    default: return ''
  }
}
```

### Acceptance Criteria

- [ ] `detectArchetype()` returns 'undetected' for players with < 5 dives
- [ ] `detectArchetype()` returns 'explorer' for a save with deepestLayerReached=18, totalDivesCompleted=20, totalFactsLearned=10
- [ ] `detectArchetype()` returns 'scholar' for a save with totalFactsLearned=60, totalDivesCompleted=10, deepestLayerReached=3
- [ ] After 7 days, `archetypeData.lastEvaluatedDate` updates on next dive (weekly re-eval)
- [ ] Manual override persists across sessions
- [ ] GAIA Report panel in Settings shows correct archetype icon and label
- [ ] `evaluateArchetype()` pure function passes unit tests (no DOM dependency)

### Playwright Test

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:5173', { bypassCSP: true })
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

  // Inject explorer-type save
  await page.evaluate(() => {
    const raw = localStorage.getItem('terra-gacha-save')
    if (!raw) return
    const save = JSON.parse(raw)
    save.stats.totalDivesCompleted = 20
    save.stats.deepestLayerReached = 18
    save.stats.totalFactsLearned = 8
    save.stats.currentStreak = 14  // 14 days = 2 weeks of daily dives
    save.archetypeData = { detected: 'undetected', manualOverride: null, lastEvaluatedDate: null, detectedOnDay: null }
    localStorage.setItem('terra-gacha-save', JSON.stringify(save))
  })

  // Trigger evaluation by simulating a dive completion (reload triggers evaluation on next dive)
  // For test purposes, directly call evaluateArchetype via page.evaluate and check result
  const archetype = await page.evaluate(() => {
    // This assumes archetypeDetector is accessible; in practice test via the Settings screen
    const raw = localStorage.getItem('terra-gacha-save')
    return raw ? JSON.parse(raw).archetypeData?.detected : 'error'
  })
  console.log(`Archetype before dive: ${archetype}`)

  // Navigate to Settings and check GAIA Report
  await page.click('button[aria-label="Settings"]')
  await page.waitForSelector('text=Your Archetype', { timeout: 5000 })
  console.log('12.6 PASS: GAIA Report section visible')

  await page.screenshot({ path: '/tmp/ss-archetype-report.png' })
  await browser.close()
})()
```

---

## Sub-Phase 12.7: Dynamic Difficulty and Engagement Score

### What

A hidden engagement score computed from three axes (quiz accuracy, session frequency, dive depth progression) that automatically adjusts distractor difficulty (DD-V2-163). Players never see the score. GAIA may comment on patterns. Below threshold 50 = nurture mode (easier distractors, more hints). Above 85 = challenge mode (harder distractors, fewer hints). The score is a rolling 7-day average to prevent single-session swings from dramatically changing difficulty.

### Where

- **New file**: `src/services/engagementScorer.ts` — score computation and distractor difficulty selection
- **Modified**: `src/data/types.ts` — add `EngagementData` to `PlayerSave`
- **Modified**: `src/services/saveService.ts` — migrate `engagementData`
- **Modified**: `src/game/managers/QuizManager.ts` — use `getDistractorDifficulty()` when selecting quiz choices
- **Modified**: `src/ui/stores/playerData.ts` — `recordDiveComplete()` updates engagement score

### How

#### Step 1: Add `EngagementData` to `src/data/types.ts`

```typescript
/** Rolling engagement data — tracked per-day for 7-day average. */
export interface DailyEngagementSnapshot {
  date: string     // ISO YYYY-MM-DD
  quizAccuracy: number   // 0.0–1.0 for that day
  diveCount: number      // Dives completed that day
  avgLayerReached: number // Average deepest layer across all dives that day
}

/** Engagement tracking data stored in PlayerSave (never shown to player directly). */
export interface EngagementData {
  /** Last 7 daily snapshots (oldest to newest). Max 7 entries. */
  dailySnapshots: DailyEngagementSnapshot[]
  /** Last computed engagement score (0–100). Updated after each dive. */
  currentScore: number
  /** 'nurture' | 'normal' | 'challenge' based on currentScore thresholds. */
  mode: 'nurture' | 'normal' | 'challenge'
}

// Add to PlayerSave:
engagementData: EngagementData
```

#### Step 2: Create `src/services/engagementScorer.ts`

```typescript
import type { EngagementData, DailyEngagementSnapshot, PlayerSave } from '../data/types'

/** Engagement score below this = nurture mode (easier distractors, more hints). */
const NURTURE_THRESHOLD = 50

/** Engagement score above this = challenge mode (harder distractors, fewer hints). */
const CHALLENGE_THRESHOLD = 85

/** Maximum number of daily snapshots to retain. */
const SNAPSHOT_WINDOW = 7

/**
 * Computes the weighted engagement score from a set of daily snapshots.
 * Three axes contribute equally (33% each):
 *  - Quiz accuracy: 7-day rolling average accuracy (0–1) × 100
 *  - Session frequency: avg dives/day relative to baseline of 1 dive/day
 *  - Depth progression: avg layer reached / 20 (max layers) × 100
 *
 * @param snapshots - Up to 7 daily snapshots (most recent at the end).
 * @returns Computed score 0–100.
 */
export function computeEngagementScore(snapshots: DailyEngagementSnapshot[]): number {
  if (snapshots.length === 0) return 50  // Start at baseline

  const avgAccuracy = snapshots.reduce((s, d) => s + d.quizAccuracy, 0) / snapshots.length
  const avgDives = snapshots.reduce((s, d) => s + d.diveCount, 0) / snapshots.length
  const avgLayer = snapshots.reduce((s, d) => s + d.avgLayerReached, 0) / snapshots.length

  const accuracyScore = Math.min(avgAccuracy * 100, 100)
  const frequencyScore = Math.min((avgDives / 2) * 100, 100)  // 2 dives/day = 100
  const depthScore = Math.min((avgLayer / 20) * 100, 100)

  return Math.round((accuracyScore + frequencyScore + depthScore) / 3)
}

/**
 * Determines engagement mode from a score.
 */
export function scoreToMode(score: number): 'nurture' | 'normal' | 'challenge' {
  if (score < NURTURE_THRESHOLD) return 'nurture'
  if (score > CHALLENGE_THRESHOLD) return 'challenge'
  return 'normal'
}

/**
 * Updates engagement data after a dive completes.
 * Upserts today's snapshot (accumulates if multiple dives per day).
 * Trims to last SNAPSHOT_WINDOW days.
 *
 * @param current - Current engagement data.
 * @param todayStr - ISO date string.
 * @param diveAccuracy - Fraction of correct quiz answers in the just-completed dive.
 * @param layerReached - Deepest layer reached in the just-completed dive.
 * @returns Updated EngagementData.
 */
export function updateEngagementAfterDive(
  current: EngagementData,
  todayStr: string,
  diveAccuracy: number,
  layerReached: number,
): EngagementData {
  const snapshots = [...current.dailySnapshots]
  const todayIdx = snapshots.findIndex(s => s.date === todayStr)

  if (todayIdx >= 0) {
    // Update existing today snapshot with running averages
    const existing = snapshots[todayIdx]
    const newDiveCount = existing.diveCount + 1
    snapshots[todayIdx] = {
      date: todayStr,
      quizAccuracy: (existing.quizAccuracy * existing.diveCount + diveAccuracy) / newDiveCount,
      diveCount: newDiveCount,
      avgLayerReached: (existing.avgLayerReached * existing.diveCount + layerReached) / newDiveCount,
    }
  } else {
    snapshots.push({
      date: todayStr,
      quizAccuracy: diveAccuracy,
      diveCount: 1,
      avgLayerReached: layerReached,
    })
  }

  // Keep only the last SNAPSHOT_WINDOW days, sorted oldest-first
  const trimmed = snapshots
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-SNAPSHOT_WINDOW)

  const newScore = computeEngagementScore(trimmed)
  return {
    dailySnapshots: trimmed,
    currentScore: newScore,
    mode: scoreToMode(newScore),
  }
}

/**
 * Returns the distractor difficulty tier to use for quiz question generation.
 * Called by QuizManager when selecting which distractors to include.
 *
 * @param engagementData - Current engagement data.
 * @returns 'easy' | 'medium' | 'hard' — matches distractor difficulty tiers in Fact data.
 */
export function getDistractorDifficulty(
  engagementData: EngagementData,
): 'easy' | 'medium' | 'hard' {
  switch (engagementData.mode) {
    case 'nurture': return 'easy'
    case 'challenge': return 'hard'
    default: return 'medium'
  }
}

/**
 * Returns a GAIA observation comment triggered when the player's mode changes.
 * Returns null if no significant change occurred.
 *
 * @param previousMode - Mode before the latest dive.
 * @param currentMode - Mode after the latest dive.
 * @returns GAIA comment string or null.
 */
export function getEngagementGaiaComment(
  previousMode: 'nurture' | 'normal' | 'challenge',
  currentMode: 'nurture' | 'normal' | 'challenge',
): string | null {
  if (previousMode === currentMode) return null

  if (currentMode === 'challenge') {
    return "You're really getting the hang of this! The planet's archives are opening up."
  }
  if (currentMode === 'normal' && previousMode === 'nurture') {
    return "Solid progress. Your recall is sharpening."
  }
  if (currentMode === 'nurture') {
    return "Let's slow down a bit. Better to know a few things well than rush everything."
  }
  return null
}
```

#### Step 3: Migrate save and update after dives

In `saveService.ts` migration:

```typescript
if (!parsedAny['engagementData'] || typeof parsedAny['engagementData'] !== 'object') {
  parsedAny['engagementData'] = { dailySnapshots: [], currentScore: 50, mode: 'normal' }
}
```

In `createNewPlayer()`:

```typescript
engagementData: { dailySnapshots: [], currentScore: 50, mode: 'normal' },
```

In `playerData.ts` `recordDiveComplete()`, after existing logic:

```typescript
import { updateEngagementAfterDive, getEngagementGaiaComment } from '../../services/engagementScorer'

// Inside playerSave.update(), compute dive accuracy from the run:
const diveAccuracy = (stats.totalQuizCorrect + diveCorrect) /
  Math.max(1, stats.totalQuizCorrect + diveCorrect + stats.totalQuizWrong + diveWrong)
const today = new Date().toISOString().split('T')[0]
const previousMode = save.engagementData?.mode ?? 'normal'
const updatedEngagement = updateEngagementAfterDive(
  save.engagementData ?? { dailySnapshots: [], currentScore: 50, mode: 'normal' },
  today,
  diveAccuracy,
  deepestLayer,
)
// Trigger GAIA comment if mode changed:
const gaiaComment = getEngagementGaiaComment(previousMode, updatedEngagement.mode)
if (gaiaComment) {
  gaiaMessage.set(gaiaComment)
}
return { ...save, engagementData: updatedEngagement }
```

#### Step 4: Wire into `QuizManager.ts` distractor selection

Phase 8 adds distractor difficulty tiers to `Fact.distractors`. In `QuizManager.ts`, when building quiz choices:

```typescript
import { getDistractorDifficulty } from '../../services/engagementScorer'
import { get } from 'svelte/store'
import { playerSave } from '../../ui/stores/playerData'

private selectDistractors(fact: Fact, count: number): string[] {
  const ps = get(playerSave)
  const difficulty = ps?.engagementData
    ? getDistractorDifficulty(ps.engagementData)
    : 'medium'

  // Filter distractors by difficulty if the Fact has difficulty-tagged distractors.
  // Phase 11 adds a distractorsByDifficulty field; fall back to flat distractors until then.
  const pool: string[] = fact.distractors

  // Shuffle and return `count` distractors
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}
```

Note: Full distractor difficulty tiers require Phase 11's fact schema update. Until then, `getDistractorDifficulty()` returns the tier but the QuizManager ignores it gracefully.

### Acceptance Criteria

- [ ] `computeEngagementScore([])` returns 50 (baseline — no data yet)
- [ ] Score < 50 after 7 days of <60% quiz accuracy results in `mode = 'nurture'`
- [ ] Score > 85 after consistent correct answers and deep dives results in `mode = 'challenge'`
- [ ] GAIA fires a comment when mode transitions between nurture/normal/challenge
- [ ] Score never shown in any UI; no player-facing score number anywhere
- [ ] Daily snapshots roll off after 7 days (only last 7 retained)
- [ ] `npm run typecheck` passes with `EngagementData` in `PlayerSave`

### Playwright Test

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:5173', { bypassCSP: true })
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

  // Inject a low-engagement save (7 days of bad accuracy)
  await page.evaluate(() => {
    const raw = localStorage.getItem('terra-gacha-save')
    if (!raw) return
    const save = JSON.parse(raw)
    const today = new Date()
    save.engagementData = {
      currentScore: 50,
      mode: 'normal',
      dailySnapshots: Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today)
        d.setDate(d.getDate() - (6 - i))
        return {
          date: d.toISOString().split('T')[0],
          quizAccuracy: 0.35,  // 35% accuracy per day
          diveCount: 1,
          avgLayerReached: 2,
        }
      }),
    }
    localStorage.setItem('terra-gacha-save', JSON.stringify(save))
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('terra-gacha-save') ?? '{}'))
  // Score should be low — verify engagementData is present and correctly structured
  console.assert(save?.engagementData, 'engagementData should exist in save')
  console.assert(save?.engagementData?.dailySnapshots?.length <= 7, 'Should have at most 7 snapshots')

  // Confirm no engagement score is visible in any UI element
  const scoreVisible = await page.$$eval('body', el =>
    el[0].innerText.includes('engagement score') || el[0].innerText.includes('/100')
  )
  console.assert(!scoreVisible, 'Engagement score must not be visible in UI')
  console.log('12.7 PASS: Engagement scoring hidden and structured correctly')

  await page.screenshot({ path: '/tmp/ss-engagement-check.png' })
  await browser.close()
})()
```

---

## Verification Gate

Run these checks in order after all 7 sub-phases are complete:

### Typecheck and Build

```bash
cd /root/terra-miner
npm run typecheck
npm run build
```

Both must complete with zero errors.

### Regression Checklist

- [ ] Existing save files load correctly (all new fields get defaults from migration in `load()`)
- [ ] `createNewPlayer()` produces a valid `PlayerSave` with all new fields populated
- [ ] Mine generation works with no `InterestConfig` provided (all functions accept `undefined` gracefully)
- [ ] Category lock with no matching facts does not crash mine generation (falls back to full pool)
- [ ] Selling a fact does not modify `inferredBoosts` or `behavioralSignals.perCategory`

### Feature Checklist

- [ ] Interest settings persist across page reload (verified via localStorage inspection)
- [ ] Weighted spawning measurably biases artifacts toward interests (test with History weight=100 over 5 mines)
- [ ] Behavioral learning only fires on positive signals (verify selling does NOT trigger `recordArtifactKept`)
- [ ] Category-lock mode filters ALL fact sources (mine artifacts, quiz questions, GAIA suggestions)
- [ ] Category lock toggle (on/off) does not clear the configured lock path
- [ ] Interest assessment appears for new players only, never for existing save holders
- [ ] Archetype detection returns 'undetected' with < 5 dives
- [ ] Engagement score GAIA comments fire on mode transitions, are not repeated unnecessarily
- [ ] No engagement score number is visible anywhere in the UI
- [ ] `InterestSettings` page accessible from `Settings` screen
- [ ] All new buttons/chips meet 44×44px minimum touch target requirement
- [ ] `npm run typecheck` passes throughout

### Visual Regression (Playwright)

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:5173', { bypassCSP: true })
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.screenshot({ path: '/tmp/ss-phase12-base.png' })

  // Navigate: Settings -> Interest Settings
  await page.click('button[aria-label="Settings"]')
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/ss-phase12-settings.png' })

  await page.click('text=Interest Settings')
  await page.waitForSelector('text=What do you want to learn', { timeout: 5000 })
  await page.screenshot({ path: '/tmp/ss-phase12-interest-settings.png' })

  // Toggle History interest
  await page.click('button:has-text("History")')
  await page.waitForTimeout(300)
  await page.screenshot({ path: '/tmp/ss-phase12-history-toggled.png' })

  // Check GAIA Report section
  await page.click('text=Save & Close')
  await page.waitForTimeout(300)
  await page.click('text=GAIA Report') // May be in Settings sub-section
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/ss-phase12-gaia-report.png' })

  await browser.close()
  console.log('Phase 12 visual regression screenshots saved to /tmp/ss-phase12-*.png')
})()
```

---

## Files Affected

### New Files

| File | Purpose |
|------|---------|
| `src/data/interestConfig.ts` | `InterestConfig`, `CategoryInterest`, `computeFactWeights()`, `weightedRandomSelect()`, `getCategoryMultiplier()` |
| `src/services/interestSpawner.ts` | `selectWeightedFact()`, `pickBiomeWithInterestBias()`, `generateInterestBiasedBiomeSequence()` |
| `src/services/behavioralLearner.ts` | `recordVoluntaryStudy()`, `recordArtifactKept()`, `recordFastMastery()`, `recalculateInferredBoosts()`, `getInferenceTransparencySummary()` |
| `src/services/archetypeDetector.ts` | `detectArchetype()`, `evaluateArchetype()`, `getEffectiveArchetype()`, `ARCHETYPE_GAIA_EMPHASIS` |
| `src/services/engagementScorer.ts` | `computeEngagementScore()`, `updateEngagementAfterDive()`, `getDistractorDifficulty()`, `getEngagementGaiaComment()` |
| `src/ui/components/InterestSettings.svelte` | Full-screen interest configuration page |
| `src/ui/components/GaiaInferencePanel.svelte` | Behavioral inference transparency section |
| `src/ui/components/CategoryLockSelector.svelte` | Category lock path picker modal |
| `src/ui/components/InterestAssessment.svelte` | Onboarding interest assessment flow |
| `src/ui/components/GaiaReport.svelte` | Archetype display panel |

### Modified Files

| File | Changes |
|------|---------|
| `src/data/types.ts` | Add `InterestConfig`, `BehavioralSignals`, `CategoryBehavioralSignals`, `ArchetypeData`, `PlayerArchetype`, `EngagementData`, `DailyEngagementSnapshot` types; add all 4 new fields to `PlayerSave` |
| `src/services/saveService.ts` | Migration for `interestConfig`, `behavioralSignals`, `archetypeData`, `engagementData` in `load()`; defaults in `createNewPlayer()` |
| `src/ui/stores/settings.ts` | Add `interestConfig` writable store, `saveInterestConfig()` |
| `src/ui/stores/gameState.ts` | Add `'interestSettings'` and `'interestAssessment'` to `Screen` union |
| `src/ui/stores/playerData.ts` | `initPlayer()` routes new players to assessment; `recordDiveComplete()` calls `evaluateArchetype()` and `updateEngagementAfterDive()`; `updateReviewState()` calls `recordFastMastery()` when interval >= 14 |
| `src/game/systems/MineGenerator.ts` | `generateMine()` accepts `facts: Array<{id: string; category: string[]}>` (was `string[]`); uses `selectWeightedFact()` when `interestConfig` provided |
| `src/data/biomes.ts` | No changes required; interest-biased selection is in `interestSpawner.ts` |
| `src/game/GameManager.ts` | Passes `interestConfig` to `generateMine()`; uses `generateInterestBiasedBiomeSequence()` |
| `src/game/managers/QuizManager.ts` | `selectDistractors()` uses `getDistractorDifficulty()`; fact selection uses `selectWeightedFact()` |
| `src/game/managers/GaiaManager.ts` | `getArchetypePrefix()`, `adaptCommentaryForLock()`, archetype-aware message selection |
| `src/game/managers/StudyManager.ts` | `onVoluntaryStudyStart()` calls `recordVoluntaryStudy()` + `recalculateInferredBoosts()` |
| `src/data/knowledgeStore.ts` | Add `category_lock` item; add `category_lock` effect type |
| `src/ui/components/Settings.svelte` | Navigation button to `InterestSettings` |
| `App.svelte` (root) | Route `interestSettings` and `interestAssessment` screens |

---

## Sub-Phase 12.8: GDPR Behavioral Consent

- [ ] Add an opt-in toggle in `Settings.svelte` for behavioral data collection (interest inference, engagement scoring). (DD-V2-228)
- [ ] Implement `GET /api/user/data-export` and `DELETE /api/user/behavioral-data` endpoints; behavioral tables cleared on opt-out without affecting SM-2 progress.

---

## Design Decision References

| DD ID | Summary | Affects |
|-------|---------|---------|
| DD-V2-118 | Behavioral inference cap: explicit = 1.0 weight, behavioral max = 0.3; positive signals only; selling is NOT a preference signal | 12.3 |
| DD-V2-120 | Interest-biased biome selection: ~30% weight boost, invisible, not configurable; biome does NOT restrict which facts appear | 12.2 |
| DD-V2-132 | Language Mode = Category Lock on language categories, not a separate game mode; all progress preserved on same Knowledge Tree (filtered view) | 12.4 |
| DD-V2-163 | Dynamic engagement scoring on three axes; score never shown to player; GAIA may comment on mode transitions | 12.7 |
| DD-V2-228 | GDPR behavioral consent: opt-in toggle, data export/delete endpoints, behavioral data cleared without affecting SM-2 | 12.8 |
| DD-V2-172 | Four player archetypes (Explorer/Scholar/Collector/Sprinter) detected by Day 7; GAIA adapts emphasis; re-evaluated weekly; player can manually override | 12.6 |
