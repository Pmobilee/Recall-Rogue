# Phase 18: Dev Tooling

## Overview

Phase 18 transforms the existing `DevPanel.svelte` into a comprehensive development and quality-assurance suite. It covers eight concerns across seven sub-phases: scenario presets for instant state loading, save snapshot import/export, a sprite selection dashboard, a fact editor dashboard, dual-profile session design enforcement, a gentle-review-pressure audit, and a quiz anti-homework language pass.

The work in this phase is about **test speed and ethical design validation**. Developers must be able to jump to any game state in one click (18.1, 18.2), content QA pipelines must have their own UIs (18.3, 18.4), and the two design-philosophy audits (18.6, 18.7) produce documented checklists that become living policy for all future UI copy reviews.

Design decisions that govern this phase:
- **DD-V2-135** — Dual Session Profiles (Quick 5-7 min / Deep 15-25 min)
- **DD-V2-137** — Informational Engagement Hooks (no coercive urgency)
- **DD-V2-141** — Cozy Dome Sessions as first-class experience
- **DD-V2-142** — Gentle Review Pressure (no anxiety triggers)
- **DD-V2-173** — Anti-Homework Quiz Philosophy

---

## Prerequisites

Before starting Phase 18, the following must be in place:

- `DevPanel.svelte` exists at `src/ui/components/DevPanel.svelte` with the 7-section collapsible structure (Resources, Progression, Fossils, Inventory, Navigation, Danger Zone, Debug Info).
- `PlayerSave` interface is stable (`src/data/types.ts`): `version`, `playerId`, `ageRating`, `oxygen`, `minerals`, `learnedFacts`, `reviewStates`, `soldFacts`, `stats`, `fossils`, `unlockedRooms`, `knowledgePoints`, `farm`, `activeCompanion`, `activeConsumables`, `craftedItems`, `streakFreezes`, `titles`, `activeTitle`, and all other fields as of SAVE_VERSION 1.
- `saveService.ts` exports `save()` and `load()` from `src/services/saveService.ts`.
- `playerSave` writable store exported from `src/ui/stores/playerData.ts`.
- `initPlayer()` and `persistPlayer()` exported from `src/ui/stores/playerData.ts`.
- Phase 8 (mine gameplay) and Phase 10 (dome hub) are complete enough that all system references in presets exist at runtime.
- Phase 11 sprite and fact pipelines are either complete or explicitly deferred (18.3 and 18.4 are conditional on Phase 11 status).

---

## Sub-Phase 18.1: Scenario Presets in Dev Panel

### What

Add a new collapsible section called **Presets** to `DevPanel.svelte` that exposes nine one-click buttons. Each button completely overwrites the current `PlayerSave` with a fully specified state object, enabling developers to instantly test any major game-state combination without manual setup.

### Where

- Primary edit: `src/ui/components/DevPanel.svelte`
- New helper file: `src/dev/presets.ts`

### How

#### Step 1 — Create `src/dev/presets.ts`

This file exports `SCENARIO_PRESETS` as a readonly array of `ScenarioPreset` objects. Each preset contains a `label` (button text), a `description` (tooltip text), and a `buildSave` factory function that takes the current timestamp and returns a complete `PlayerSave`.

**Preset definitions — exact save state values:**

```typescript
// src/dev/presets.ts

import type { PlayerSave } from '../data/types'
import { BALANCE } from '../data/balance'
import { FOSSIL_SPECIES } from '../data/fossils'
import { createReviewState } from '../services/sm2'
import { SAVE_VERSION } from '../services/saveService'

export interface ScenarioPreset {
  id: string
  label: string
  description: string
  buildSave(now: number): PlayerSave
}

const BASE_SAVE = (now: number): PlayerSave => ({
  version: SAVE_VERSION,
  playerId: 'dev-player',
  ageRating: 'teen',
  createdAt: now,
  lastPlayedAt: now,
  oxygen: BALANCE.STARTING_OXYGEN,
  minerals: { dust: 0, shard: 0, crystal: 0, geode: 0, essence: 0 },
  learnedFacts: [],
  reviewStates: [],
  soldFacts: [],
  stats: {
    totalBlocksMined: 0,
    totalDivesCompleted: 0,
    deepestLayerReached: 0,
    totalFactsLearned: 0,
    totalFactsSold: 0,
    totalQuizCorrect: 0,
    totalQuizWrong: 0,
    currentStreak: 0,
    bestStreak: 0,
  },
  lastDiveDate: undefined,
  unlockedDiscs: [],
  craftedItems: {},
  craftCounts: {},
  activeConsumables: [],
  insuredDive: false,
  ownedCosmetics: [],
  equippedCosmetic: null,
  purchasedDeals: [],
  lastDealDate: undefined,
  fossils: {},
  activeCompanion: null,
  lastMorningReview: undefined,
  lastEveningReview: undefined,
  knowledgePoints: 0,
  purchasedKnowledgeItems: [],
  unlockedRooms: ['command'],
  farm: { slots: [null, null, null], maxSlots: 3 },
  premiumMaterials: {},
  streakFreezes: 0,
  lastStreakMilestone: 0,
  claimedMilestones: [],
  streakProtected: false,
  titles: [],
  activeTitle: null,
})

export const SCENARIO_PRESETS: ReadonlyArray<ScenarioPreset> = [
  {
    id: 'new_player',
    label: 'New Player',
    description: 'Fresh save, zero progress. Matches state immediately after onboarding.',
    buildSave: (now) => ({
      ...BASE_SAVE(now),
      // Exactly what createNewPlayer produces for ageRating='teen'
      oxygen: BALANCE.STARTING_OXYGEN, // e.g. 3 tanks
      minerals: { dust: 50, shard: 0, crystal: 0, geode: 0, essence: 0 },
    }),
  },
  {
    id: 'post_tutorial',
    label: 'Post-Tutorial',
    description: 'After tutorial dive: 5 facts learned, first artifact, command room unlocked.',
    buildSave: (now) => ({
      ...BASE_SAVE(now),
      oxygen: BALANCE.STARTING_OXYGEN,
      minerals: { dust: 180, shard: 2, crystal: 0, geode: 0, essence: 0 },
      learnedFacts: ['fact-geo-001', 'fact-geo-002', 'fact-nat-001', 'fact-nat-002', 'fact-hist-001'],
      reviewStates: ['fact-geo-001', 'fact-geo-002', 'fact-nat-001', 'fact-nat-002', 'fact-hist-001'].map(createReviewState),
      stats: {
        totalBlocksMined: 45,
        totalDivesCompleted: 1,
        deepestLayerReached: 1,
        totalFactsLearned: 5,
        totalFactsSold: 0,
        totalQuizCorrect: 4,
        totalQuizWrong: 1,
        currentStreak: 1,
        bestStreak: 1,
      },
      lastDiveDate: new Date(now).toISOString().split('T')[0],
      unlockedRooms: ['command'],
    }),
  },
  {
    id: 'first_pet',
    label: 'First Pet',
    description: 'Player has completed enough fossil fragments to revive their first companion.',
    buildSave: (now) => {
      const firstSpecies = FOSSIL_SPECIES[0]
      return {
        ...BASE_SAVE(now),
        oxygen: BALANCE.STARTING_OXYGEN + 1,
        minerals: { dust: 600, shard: 15, crystal: 2, geode: 0, essence: 0 },
        learnedFacts: ['fact-geo-001', 'fact-geo-002', 'fact-geo-003', 'fact-nat-001', 'fact-nat-002',
                       'fact-nat-003', 'fact-hist-001', 'fact-hist-002', 'fact-hist-003', 'fact-tech-001'],
        reviewStates: ['fact-geo-001','fact-geo-002','fact-geo-003','fact-nat-001','fact-nat-002',
                       'fact-nat-003','fact-hist-001','fact-hist-002','fact-hist-003','fact-tech-001'].map(createReviewState),
        stats: {
          totalBlocksMined: 280,
          totalDivesCompleted: 6,
          deepestLayerReached: 3,
          totalFactsLearned: 10,
          totalFactsSold: 0,
          totalQuizCorrect: 32,
          totalQuizWrong: 8,
          currentStreak: 4,
          bestStreak: 4,
        },
        fossils: {
          [firstSpecies.id]: {
            speciesId: firstSpecies.id,
            fragmentsFound: firstSpecies.fragmentsNeeded,
            fragmentsNeeded: firstSpecies.fragmentsNeeded,
            revived: true,
            revivedAt: now - 86400000,
          },
        },
        activeCompanion: firstSpecies.id,
        lastDiveDate: new Date(now).toISOString().split('T')[0],
        unlockedRooms: ['command', 'archive'],
      }
    },
  },
  {
    id: 'mid_game_3_rooms',
    label: 'Mid-Game (3 Rooms)',
    description: 'Three dome rooms, 25 facts, streaks active, mid-tier minerals.',
    buildSave: (now) => ({
      ...BASE_SAVE(now),
      oxygen: BALANCE.STARTING_OXYGEN + 2,
      minerals: { dust: 2400, shard: 80, crystal: 15, geode: 2, essence: 0 },
      learnedFacts: Array.from({ length: 25 }, (_, i) => `fact-dev-${String(i + 1).padStart(3, '0')}`),
      reviewStates: Array.from({ length: 25 }, (_, i) => createReviewState(`fact-dev-${String(i + 1).padStart(3, '0')}`)),
      knowledgePoints: 240,
      stats: {
        totalBlocksMined: 1100,
        totalDivesCompleted: 22,
        deepestLayerReached: 8,
        totalFactsLearned: 25,
        totalFactsSold: 3,
        totalQuizCorrect: 148,
        totalQuizWrong: 42,
        currentStreak: 8,
        bestStreak: 10,
      },
      lastDiveDate: new Date(now).toISOString().split('T')[0],
      unlockedRooms: ['command', 'archive', 'market'],
      streakFreezes: 1,
    }),
  },
  {
    id: 'endgame_all_rooms',
    label: 'Endgame (All Rooms)',
    description: 'All dome rooms unlocked, 80 facts, deep layer access, full resource stack.',
    buildSave: (now) => ({
      ...BASE_SAVE(now),
      oxygen: 8, // 8 tanks (maximum)
      minerals: { dust: 18000, shard: 600, crystal: 120, geode: 24, essence: 8 },
      learnedFacts: Array.from({ length: 80 }, (_, i) => `fact-dev-${String(i + 1).padStart(3, '0')}`),
      reviewStates: Array.from({ length: 80 }, (_, i) => createReviewState(`fact-dev-${String(i + 1).padStart(3, '0')}`)),
      knowledgePoints: 2800,
      purchasedKnowledgeItems: ['extra_quiz_chance', 'oxygen_efficiency', 'bonus_dust', 'scanner_range'],
      stats: {
        totalBlocksMined: 9500,
        totalDivesCompleted: 180,
        deepestLayerReached: 18,
        totalFactsLearned: 80,
        totalFactsSold: 12,
        totalQuizCorrect: 940,
        totalQuizWrong: 210,
        currentStreak: 34,
        bestStreak: 34,
      },
      lastDiveDate: new Date(now).toISOString().split('T')[0],
      unlockedRooms: BALANCE.DOME_ROOMS.map((r: { id: string }) => r.id),
      premiumMaterials: { star_dust: 8, void_crystal: 4, ancient_essence: 1 },
      streakFreezes: 3,
      lastStreakMilestone: 30,
      claimedMilestones: [7, 14, 30],
      titles: ['Deep Diver', 'Fact Hunter'],
      activeTitle: 'Deep Diver',
    }),
  },
  {
    id: 'full_collection',
    label: 'Full Collection',
    description: 'All fossils revived, all discs unlocked, max cosmetics, 120 facts. Ideal for testing Zoo and Museum screens.',
    buildSave: (now) => ({
      ...BASE_SAVE(now),
      oxygen: 8,
      minerals: { dust: 25000, shard: 800, crystal: 200, geode: 50, essence: 20 },
      learnedFacts: Array.from({ length: 120 }, (_, i) => `fact-dev-${String(i + 1).padStart(3, '0')}`),
      reviewStates: Array.from({ length: 120 }, (_, i) => createReviewState(`fact-dev-${String(i + 1).padStart(3, '0')}`)),
      knowledgePoints: 5000,
      unlockedDiscs: ['disc-solar-system', 'disc-deep-ocean', 'disc-ancient-civilizations',
                      'disc-quantum-physics', 'disc-human-body', 'disc-dinosaurs'],
      fossils: Object.fromEntries(
        FOSSIL_SPECIES.map(s => [s.id, {
          speciesId: s.id,
          fragmentsFound: s.fragmentsNeeded,
          fragmentsNeeded: s.fragmentsNeeded,
          revived: true,
          revivedAt: now - 7 * 86400000,
        }])
      ),
      activeCompanion: FOSSIL_SPECIES[0]?.id ?? null,
      stats: {
        totalBlocksMined: 22000,
        totalDivesCompleted: 400,
        deepestLayerReached: 20,
        totalFactsLearned: 120,
        totalFactsSold: 22,
        totalQuizCorrect: 2100,
        totalQuizWrong: 380,
        currentStreak: 60,
        bestStreak: 60,
      },
      lastDiveDate: new Date(now).toISOString().split('T')[0],
      unlockedRooms: BALANCE.DOME_ROOMS.map((r: { id: string }) => r.id),
      ownedCosmetics: ['cosm-blue-dome', 'cosm-gold-frame', 'cosm-neon-pickaxe'],
      equippedCosmetic: 'cosm-neon-pickaxe',
      premiumMaterials: { star_dust: 20, void_crystal: 10, ancient_essence: 4 },
      streakFreezes: 5,
      claimedMilestones: [7, 14, 30, 60],
      lastStreakMilestone: 60,
      titles: ['Deep Diver', 'Fact Hunter', 'Fossil Master', 'Collection Complete'],
      activeTitle: 'Collection Complete',
    }),
  },
  {
    id: 'empty_inventory',
    label: 'Empty Inventory',
    description: 'Endgame-level progression stats but absolutely zero minerals, zero oxygen, zero consumables. Tests scarcity UX.',
    buildSave: (now) => ({
      ...BASE_SAVE(now),
      oxygen: 0,
      minerals: { dust: 0, shard: 0, crystal: 0, geode: 0, essence: 0 },
      learnedFacts: Array.from({ length: 40 }, (_, i) => `fact-dev-${String(i + 1).padStart(3, '0')}`),
      reviewStates: Array.from({ length: 40 }, (_, i) => createReviewState(`fact-dev-${String(i + 1).padStart(3, '0')}`)),
      activeConsumables: [],
      stats: {
        totalBlocksMined: 3200,
        totalDivesCompleted: 60,
        deepestLayerReached: 12,
        totalFactsLearned: 40,
        totalFactsSold: 0,
        totalQuizCorrect: 300,
        totalQuizWrong: 80,
        currentStreak: 12,
        bestStreak: 15,
      },
      lastDiveDate: new Date(now).toISOString().split('T')[0],
      unlockedRooms: ['command', 'archive', 'market', 'lab'],
    }),
  },
  {
    id: 'max_streak',
    label: 'Max Streak',
    description: '100-day streak with all freeze items used and milestone rewards claimed. Tests streak reward and protection UX.',
    buildSave: (now) => ({
      ...BASE_SAVE(now),
      oxygen: BALANCE.STARTING_OXYGEN + 2,
      minerals: { dust: 5000, shard: 150, crystal: 30, geode: 5, essence: 1 },
      learnedFacts: Array.from({ length: 50 }, (_, i) => `fact-dev-${String(i + 1).padStart(3, '0')}`),
      reviewStates: Array.from({ length: 50 }, (_, i) => createReviewState(`fact-dev-${String(i + 1).padStart(3, '0')}`)),
      stats: {
        totalBlocksMined: 4800,
        totalDivesCompleted: 100,
        deepestLayerReached: 15,
        totalFactsLearned: 50,
        totalFactsSold: 5,
        totalQuizCorrect: 520,
        totalQuizWrong: 110,
        currentStreak: 100,
        bestStreak: 100,
      },
      lastDiveDate: new Date(now).toISOString().split('T')[0],
      unlockedRooms: BALANCE.DOME_ROOMS.map((r: { id: string }) => r.id),
      streakFreezes: 0,
      streakProtected: false,
      lastStreakMilestone: 90,
      claimedMilestones: [7, 14, 30, 60, 90],
      titles: ['Daily Diver', 'Century Streak'],
      activeTitle: 'Century Streak',
    }),
  },
  {
    id: 'first_fossil_found',
    label: 'First Fossil Found',
    description: 'Player just found their first fossil fragment mid-dive. Tests fossil discovery UX and fragment progress bar.',
    buildSave: (now) => {
      const firstSpecies = FOSSIL_SPECIES[0]
      return {
        ...BASE_SAVE(now),
        oxygen: BALANCE.STARTING_OXYGEN,
        minerals: { dust: 350, shard: 5, crystal: 0, geode: 0, essence: 0 },
        learnedFacts: ['fact-geo-001', 'fact-geo-002', 'fact-nat-001', 'fact-nat-002', 'fact-nat-003',
                       'fact-hist-001', 'fact-hist-002', 'fact-hist-003'],
        reviewStates: ['fact-geo-001','fact-geo-002','fact-nat-001','fact-nat-002','fact-nat-003',
                       'fact-hist-001','fact-hist-002','fact-hist-003'].map(createReviewState),
        fossils: {
          [firstSpecies.id]: {
            speciesId: firstSpecies.id,
            fragmentsFound: 1,
            fragmentsNeeded: firstSpecies.fragmentsNeeded,
            revived: false,
            revivedAt: undefined,
          },
        },
        stats: {
          totalBlocksMined: 160,
          totalDivesCompleted: 4,
          deepestLayerReached: 2,
          totalFactsLearned: 8,
          totalFactsSold: 0,
          totalQuizCorrect: 22,
          totalQuizWrong: 6,
          currentStreak: 3,
          bestStreak: 3,
        },
        lastDiveDate: new Date(now).toISOString().split('T')[0],
        unlockedRooms: ['command', 'archive'],
      }
    },
  },
]
```

#### Step 2 — Add Presets section to `DevPanel.svelte`

Add `'presets': false` to `sectionsOpen` initial state. Import `SCENARIO_PRESETS` from `../../dev/presets`. Add a `loadPreset(preset: ScenarioPreset): void` function that:
1. Calls `deleteSave()`.
2. Calls `preset.buildSave(Date.now())` to create the save object.
3. Calls `save(builtSave)` from `saveService`.
4. Calls `playerSave.set(builtSave)`.
5. Calls `currentScreen.set('base')`.
6. Sets `open = false`.

Add a new `<section class="dev-section">` block with the Presets header above the existing Resources section. Each preset renders as a `btn-preset` button (purple border, dark purple background) in a single-column list. Include the `description` as a `title` attribute for hover tooltip.

Add to style block:
```css
.btn-preset {
  border: 1px solid #4a1a7e;
  background: #1e0a3a;
  color: #c090ff;
  text-align: left;
  font-size: 9px;
}
```

### Acceptance Criteria

- Clicking any preset button immediately updates the UI (resource bar, room tabs, debug info section) to reflect the preset values with no page reload required.
- The "New Player" preset produces a save with exactly 1 unlocked room (`command`) and zero learned facts.
- The "Endgame (All Rooms)" preset unlocks all rooms defined in `BALANCE.DOME_ROOMS`.
- The "Empty Inventory" preset sets `oxygen: 0` and all mineral counts to 0, visually showing the scarcity state in HUD.
- The "Max Streak" preset shows `currentStreak: 100` in the Debug Info section.
- TypeScript strict mode: `buildSave` return types satisfy `PlayerSave` fully.

### Playwright Test

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("DEV")', { timeout: 15000 })
  await page.click('button:has-text("DEV")')
  await page.waitForSelector('text=Presets')
  await page.click('text=Presets')
  await page.click('button:has-text("Endgame (All Rooms)")')
  await page.waitForTimeout(500)
  // Dev panel closed; verify debug info reflects endgame state by reopening
  await page.click('button:has-text("DEV")')
  await page.click('text=Debug Info')
  const streakText = await page.textContent('.debug-val')
  console.assert(streakText !== null, 'Debug info visible')
  await page.screenshot({ path: '/tmp/ss-preset-endgame.png' })
  await browser.close()
})()
```

---

## Sub-Phase 18.2: Save State Snapshots

### What

Extend the Dev Panel with a **Snapshots** section that allows: (a) exporting the current `PlayerSave` as a timestamped JSON download, (b) importing a JSON file back into the active save, and (c) maintaining an in-browser named snapshot library stored in a separate `localStorage` key so developers can quick-switch between named states without file system round-trips.

### Where

- Primary edit: `src/ui/components/DevPanel.svelte`
- New helper: `src/dev/snapshotStore.ts`

### How

#### Step 1 — Define the save snapshot JSON schema

A snapshot is a JSON object with this exact shape:

```json
{
  "snapshotVersion": 1,
  "snapshotId": "uuid-v4-string",
  "label": "human readable name",
  "createdAt": 1709500000000,
  "gameVersion": 1,
  "save": { /* full PlayerSave object */ }
}
```

- `snapshotVersion`: integer, bumped when the snapshot wrapper format changes (separate from `save.version`).
- `snapshotId`: 8-char random hex string sufficient for local uniqueness.
- `label`: developer-supplied name; defaults to ISO timestamp if not provided.
- `createdAt`: `Date.now()` at export time in milliseconds.
- `gameVersion`: mirrors `SAVE_VERSION` from `saveService.ts` at export time.
- `save`: the exact `PlayerSave` object as stored.

TypeScript interface (add to `src/dev/snapshotStore.ts`):

```typescript
export interface SaveSnapshot {
  snapshotVersion: 1
  snapshotId: string
  label: string
  createdAt: number
  gameVersion: number
  save: PlayerSave
}
```

#### Step 2 — Create `src/dev/snapshotStore.ts`

```typescript
import type { PlayerSave } from '../data/types'
import { SAVE_VERSION } from '../services/saveService'

const SNAPSHOT_STORE_KEY = 'recall-rogue-dev-snapshots'
const MAX_STORED_SNAPSHOTS = 20

export interface SaveSnapshot {
  snapshotVersion: 1
  snapshotId: string
  label: string
  createdAt: number
  gameVersion: number
  save: PlayerSave
}

function randomId(): string {
  return Math.random().toString(16).slice(2, 10)
}

/** Returns all stored snapshots from localStorage, newest first. */
export function listSnapshots(): SaveSnapshot[] {
  try {
    const raw = localStorage.getItem(SNAPSHOT_STORE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as SaveSnapshot[]
  } catch {
    return []
  }
}

/** Saves a new snapshot. Enforces MAX_STORED_SNAPSHOTS by dropping oldest. */
export function storeSnapshot(save: PlayerSave, label?: string): SaveSnapshot {
  const snap: SaveSnapshot = {
    snapshotVersion: 1,
    snapshotId: randomId(),
    label: label ?? new Date().toISOString().replace('T', ' ').slice(0, 19),
    createdAt: Date.now(),
    gameVersion: SAVE_VERSION,
    save,
  }
  const existing = listSnapshots()
  const updated = [snap, ...existing].slice(0, MAX_STORED_SNAPSHOTS)
  localStorage.setItem(SNAPSHOT_STORE_KEY, JSON.stringify(updated))
  return snap
}

/** Deletes a snapshot by ID. */
export function deleteSnapshot(id: string): void {
  const updated = listSnapshots().filter(s => s.snapshotId !== id)
  localStorage.setItem(SNAPSHOT_STORE_KEY, JSON.stringify(updated))
}

/** Serializes a snapshot to a downloadable JSON blob. */
export function exportSnapshotBlob(snap: SaveSnapshot): Blob {
  return new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' })
}

/** Parses and validates a JSON string as a SaveSnapshot. Returns null on failure. */
export function parseSnapshotFile(jsonText: string): SaveSnapshot | null {
  try {
    const obj = JSON.parse(jsonText)
    if (typeof obj !== 'object' || obj === null) return null
    if (obj.snapshotVersion !== 1) return null
    if (typeof obj.snapshotId !== 'string') return null
    if (typeof obj.label !== 'string') return null
    if (typeof obj.createdAt !== 'number') return null
    if (typeof obj.save !== 'object' || obj.save === null) return null
    if (typeof obj.save.version !== 'number') return null
    return obj as SaveSnapshot
  } catch {
    return null
  }
}
```

#### Step 3 — Add Snapshots section to `DevPanel.svelte`

Add `'snapshots': false` to `sectionsOpen`. Import `listSnapshots`, `storeSnapshot`, `deleteSnapshot`, `exportSnapshotBlob`, `parseSnapshotFile` from `../../dev/snapshotStore`.

Add state:
```typescript
let snapshots = $state<SaveSnapshot[]>([])
let snapshotLabel = $state<string>('')
let snapshotError = $state<string>('')

$effect(() => {
  if (open && sectionsOpen.snapshots) {
    snapshots = listSnapshots()
  }
})
```

**Save current snapshot:**
```typescript
function saveCurrentSnapshot(): void {
  const current = get(playerSave)
  if (!current) return
  const label = snapshotLabel.trim() || undefined
  storeSnapshot(current, label)
  snapshotLabel = ''
  snapshots = listSnapshots()
}
```

**Export snapshot to file:**
```typescript
function exportSnapshot(snap: SaveSnapshot): void {
  const blob = exportSnapshotBlob(snap)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `recall-rogue-snapshot-${snap.snapshotId}.json`
  a.click()
  URL.revokeObjectURL(url)
}
```

**Import snapshot from file:** Render a hidden `<input type="file" accept=".json">`. On change, read the file via `FileReader`, call `parseSnapshotFile`, validate, call `save(parsed.save)`, call `playerSave.set(parsed.save)`, show error if invalid.

**Load snapshot into active save:**
```typescript
function loadSnapshot(snap: SaveSnapshot): void {
  if (!confirm(`Load snapshot "${snap.label}"? Current save will be overwritten.`)) return
  save(snap.save)
  playerSave.set(snap.save)
  currentScreen.set('base')
  open = false
}
```

**Delete snapshot:** Call `deleteSnapshot(snap.snapshotId)` then refresh `snapshots`.

The snapshot list renders in a scrollable container (`max-height: 240px; overflow-y: auto`) with each row showing: label, `gameVersion`, createdAt formatted as `YYYY-MM-DD HH:mm`, and three icon buttons (Load, Export, Delete).

### Acceptance Criteria

- "Save Snapshot" button with a typed label saves to localStorage and the list refreshes immediately.
- Export produces a valid JSON file with the exact schema above; opening and re-importing the file round-trips perfectly (loaded save matches original pixel-for-pixel in Debug Info).
- Import of a malformed JSON file shows a visible error string `snapshotError` with message "Invalid snapshot file" rather than crashing.
- Up to 20 snapshots are stored; the 21st replaces the oldest.
- Loading a snapshot navigates to `base` screen and closes the panel.
- All operations work without page reload.

### Playwright Test

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
const fs = require('fs')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("DEV")', { timeout: 15000 })
  await page.click('button:has-text("DEV")')
  await page.click('text=Snapshots')
  // Type a label and save
  await page.fill('input[placeholder="Snapshot label"]', 'Test Snapshot 01')
  await page.click('button:has-text("Save Snapshot")')
  await page.waitForTimeout(300)
  await page.screenshot({ path: '/tmp/ss-snapshots.png' })
  // Verify snapshot appears in list
  const listText = await page.textContent('.snapshot-list')
  console.assert(listText?.includes('Test Snapshot 01'), 'Snapshot appears in list')
  await browser.close()
})()
```

---

## Sub-Phase 18.3: Sprite Selection Dashboard (conditional on Phase 11)

### What

A standalone web page served by the Fastify backend on a separate route (`GET /dev/sprites`) that shows side-by-side ComfyUI-generated sprite candidates for a given sprite slot, with one-click approve/reject and batch processing view.

**This sub-phase is only required if Phase 11's sprite pipeline tooling was not completed.** If Phase 11 delivered a working sprite dashboard, verify it meets the specs below and close 18.3 with a link to the Phase 11 deliverable.

### Where

- Backend route: `server/src/routes/dev/sprites.ts`
- Frontend page: `server/src/views/dev-sprites.html` (plain HTML + vanilla JS; no Svelte build needed)
- Sprite candidate staging directory: `public/sprite-candidates/{slotId}/`

### How

#### Step 1 — Sprite candidate directory convention

Sprites generated by the ComfyUI pipeline but not yet approved are stored in:
```
public/sprite-candidates/
  dome_glass/
    candidate-001.png
    candidate-002.png
    candidate-003.png
  tile_dirt/
    candidate-001.png
  ...
```

Each subdirectory name is the sprite slot ID (matching keys in `src/game/spriteManifest.ts`). Approved sprites are moved to `src/assets/sprites-hires/{slotId}.png` and `src/assets/sprites/{slotId}.png` by the approval action.

#### Step 2 — Backend route

`GET /dev/sprites` returns JSON:
```json
{
  "slots": [
    {
      "slotId": "dome_glass",
      "candidates": [
        { "filename": "candidate-001.png", "url": "/sprite-candidates/dome_glass/candidate-001.png" },
        { "filename": "candidate-002.png", "url": "/sprite-candidates/dome_glass/candidate-002.png" }
      ],
      "approvedUrl": "/sprites-hires/dome_glass.png"
    }
  ]
}
```

`POST /dev/sprites/approve` accepts `{ slotId, filename }`. Copies the candidate file to the approved locations.

`POST /dev/sprites/reject` accepts `{ slotId, filename }`. Deletes the candidate file.

#### Step 3 — Frontend dashboard layout

Single-column list of sprite slots. Each slot shows:
- Slot ID as heading.
- Approved sprite (if exists) on the left at 128×128px with label "Current".
- All candidates displayed side-by-side at 128×128px each with approve (green) / reject (red) buttons below.
- `image-rendering: pixelated` on all sprite images.
- Batch view: toggle button shows all slots with pending candidates in a compact grid.

### Acceptance Criteria

- Dashboard page loads at `http://localhost:3000/dev/sprites` (or whatever port Fastify runs on).
- Approving a candidate moves the file to the correct `src/assets/` path and refreshes the dashboard row.
- Rejecting a candidate removes the file and the candidate image disappears from the dashboard.
- All sprite images render with `image-rendering: pixelated`.
- Batch view correctly filters to slots with pending candidates.

### Playwright Test

```js
// Requires backend running on port 3000
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.goto('http://localhost:3000/dev/sprites')
  await page.waitForSelector('h1', { timeout: 10000 })
  await page.screenshot({ path: '/tmp/ss-sprite-dashboard.png' })
  await browser.close()
})()
```

---

## Sub-Phase 18.4: Fact Editor Dashboard (conditional on Phase 11)

### What

A standalone web page at `GET /dev/facts` on the Fastify backend providing: browsable, searchable fact list from the SQLite facts database; inline editing of any fact field; quiz preview that simulates the in-game 4-choice quiz UI; and category tree with gap analysis (which categories have fewer than N facts, which have no wowFactor, which have default distractors).

**This sub-phase is only required if Phase 11's fact editor was not completed.**

### Where

- Backend routes: `server/src/routes/dev/facts.ts`
- Frontend: `server/src/views/dev-facts.html`
- SQLite database: `public/facts.db` (built by `scripts/build-facts-db.mjs`)

### How

#### Step 1 — Backend routes

`GET /dev/facts/list?category=&search=&page=&limit=50` — paginated fact list with filter.

`GET /dev/facts/:id` — single fact JSON.

`PUT /dev/facts/:id` — update any fact fields. Writes to the seed JSON in `src/data/seed/` and triggers rebuild of `public/facts.db`.

`GET /dev/facts/gaps` — returns gap analysis:
```json
{
  "totalFacts": 522,
  "byCategory": [
    { "path": ["Language", "Japanese"], "count": 400, "missingWowFactor": 12, "missingGaiaComment": 30 }
  ],
  "underrepresentedCategories": [
    { "path": ["Geography"], "count": 8, "recommended": 30 }
  ]
}
```

#### Step 2 — Quiz preview panel

Clicking "Preview Quiz" on any fact renders a simulated 4-choice quiz card using the fact's `correctAnswer` and three randomly selected `distractors`. The panel shows:
- The `quizQuestion` text.
- Four answer buttons in randomized order.
- Clicking any button reveals correct/wrong coloring and shows `explanation` as the "Memory Tip."
- A "Regenerate Distractors" button calls the distractor generation endpoint from Phase 11.

#### Step 3 — Category tree visualization

A collapsible tree matching `CATEGORIES` in `src/data/types.ts`. Each leaf shows fact count, color-coded: red < 10, yellow 10-29, green 30+. Clicking any node filters the fact list to that category.

#### Step 4 — Gap analysis report

A dedicated tab listing: categories below threshold, facts missing `wowFactor`, facts missing `gaiaComment`, facts with fewer than 8 distractors, facts with `funScore` below 4.

### Acceptance Criteria

- Dashboard loads at `http://localhost:3000/dev/facts` within 3 seconds.
- Searching by keyword filters facts in under 200ms.
- Editing a fact field and saving updates the seed JSON file and rebuilds `facts.db`.
- Quiz preview shows exactly 4 choices with correct answer randomized into position.
- Category tree correctly reflects fact counts from the live database.
- Gap analysis correctly identifies facts with fewer than 8 distractors.

### Playwright Test

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.goto('http://localhost:3000/dev/facts')
  await page.waitForSelector('.fact-list', { timeout: 10000 })
  await page.screenshot({ path: '/tmp/ss-fact-dashboard.png' })
  await browser.close()
})()
```

---

## Sub-Phase 18.5: Session Design — Dual Profile System

### What

Define, document, and enforce two distinct session profiles throughout all game systems (DD-V2-135, DD-V2-137, DD-V2-141). This is primarily a **design verification and implementation audit** sub-phase, not a new feature. It produces:

1. A session profile specification document (written inline in this phase doc).
2. A balance simulation validation run (references Phase 8.14 simulator) confirming both profiles produce positive reinforcement.
3. A "cozy session" flow that guides players through a satisfying non-dive visit.
4. An engagement hooks audit ensuring every natural session-end point has a visible forward hook.

### Session Profile Specifications

#### Quick Session — 5-7 Minutes

**Target player context**: Commute, 5-minute break, one-handed on phone.

**Required systems to function within profile:**
- Layer 1-5 mine dive only (20×20 grid at these layers, approximately 180 blocks).
- O2 depth cost factor: 1.0× (layer 1), up to approximately 1.2× (layer 5).
- Expected blocks mined: 60-100 per session (depending on mining efficiency).
- Expected O2 consumption: 40-70% of starting oxygen.
- Expected facts encountered: 3-8 pop quizzes at 8% rate with 15-block cooldown.
- Expected minerals collected: 150-350 dust, 2-8 shards.
- Farm collection: 30 seconds.
- Brief review ritual: 5 cards maximum (≤ 60 seconds).

**Session must feel complete:** Player surfaces from layer 5 or earlier voluntarily. Dive results screen shows loot and facts with celebration animation. GAIA delivers one informational hook (DD-V2-137): "3 more facts to unlock Trilobite revival."

**Timing targets (in game ticks — 1 tick = 1 block move or mine action):**
- Minimum satisfying session: 80 ticks (≈ 4 min at casual pace)
- Target session: 120-150 ticks (≈ 5-7 min)
- Hard cap signal: GAIA suggests surfacing after 180 ticks if still in layer 1-5

#### Deep Session — 15-25 Minutes

**Target player context**: Dedicated gaming session, both hands, sitting.

**Required systems:**
- Layers 10+ access (25×25 to 40×40 grids).
- Full study session after surfacing (10-card deck, ≈ 4 minutes).
- Knowledge Tree exploration: browse 2-3 branches, see mastery progress.
- Crafting in Materializer if materials allow.
- O2 depth cost factor: up to 1.5× at layer 10, 2.5× at layer 20.

**Timing targets:**
- Minimum satisfying session: 300 ticks
- Target session: 500-800 ticks (≈ 15-25 min at moderate pace)
- Hard cap signal: GAIA congratulates and suggests "your brain needs rest" after 1000 ticks

#### Cozy Dome Session — 3-5 Minutes (DD-V2-141)

**Target player context**: Player opens app but does not want to dive at all.

**Designed flow:**
1. Farm collection (tap all mature crops): 30-60 seconds.
2. 5-card study session: 90-120 seconds (triggered automatically if 5+ due cards).
3. Knowledge Tree: browse one branch, tap one mastered node for celebration.
4. GAIA chat: one idle quip plus optional follow-up topic.

**This is a first-class experience, not a lesser mode.** The dome must show clear visual progress indicators without requiring a dive. Knowledge Tree leaf health, farm growth timers, and fossil revival progress must all be visible from the dome.

**Health metric tracking (to be added as a debug counter in DevPanel):**
- Track `zeroDiveSessions` and `totalSessions` in `PlayerStats`.
- DevPanel Debug Info section shows the percentage.
- Target range: 10-40% of sessions are cozy sessions.

#### Step 1 — Add session health metrics to PlayerStats

In `src/data/types.ts`, add to `PlayerStats`:
```typescript
totalSessions: number         // incremented on app open
zeroDiveSessions: number      // incremented when session ends with 0 dives completed
```

Increment `totalSessions` in `GameManager` on app boot. Increment `zeroDiveSessions` in `GameManager` when the app backgrounds/closes and `totalDivesCompleted` did not increase during the session.

#### Step 2 — Add cozy session flow trigger

In `BaseView.svelte` or `DomeView.svelte`, check on app load: if 5+ facts are due for review, show a soft prompt from GAIA: "Ready for a quick study? 5 facts are ready to strengthen!" (not "You have overdue reviews"). Clicking the prompt navigates to `studySession` with a pre-configured 5-card deck.

#### Step 3 — Engagement hooks audit

For each natural session-end point, verify a visible forward hook exists:

| Session-end point | Required hook |
|---|---|
| Post-dive results screen | GAIA info line: X facts until Y unlock, or "Your Biology branch is at N%" |
| Study session complete | Knowledge Tree branch progress bar with next mastery milestone shown |
| Farm collection | Next harvest timer displayed with crop count |
| Fossil revival complete | Zoo population count and next revival target shown |
| Knowledge Tree browse | "X facts remaining in this branch" label on each incomplete branch |
| Layer 5 clear (quick session) | "Continue deeper?" prompt with current loot summary |

Review each of these screens in the codebase and add the hook if missing. File references:
- Post-dive: `src/ui/components/DiveResults.svelte`
- Study: `src/ui/components/StudySession.svelte`
- Farm: `src/ui/components/Farm.svelte`
- Fossil/Zoo: `src/ui/components/Zoo.svelte`, `FossilGallery.svelte`
- Knowledge Tree: `src/ui/components/KnowledgeTree.svelte`
- Layer transition: `src/game/MineScene.ts` or layer summary overlay

#### Step 4 — Balance simulation validation (Phase 8.14 reference)

Run the Phase 8.14 balance simulator with two configurations:
- Config A: `maxLayers: 5, startOxygen: 3` (Quick Session proxy).
- Config B: `maxLayers: 15, startOxygen: 6` (Deep Session proxy).

Confirm:
- Config A: 80-95% O2 survival rate on layers 1-5, average session ends with at least 20% O2 remaining, positive mineral net gain.
- Config B: 60-80% O2 survival rate on layers 10-15, minerals and facts per minute higher than Config A, net knowledge gain (facts learned > 0 per session).

If simulation reveals balance failures, adjust `BALANCE` constants before marking 18.5 complete.

### Acceptance Criteria

- `PlayerStats` has `totalSessions` and `zeroDiveSessions` fields (types pass typecheck).
- Debug Info section of DevPanel shows `Zero-dive %: N%`.
- Cozy session flow: GAIA prompt appears on dome load when 5+ facts are due, navigates to study session.
- Post-dive results screen shows at least one informational GAIA hook line (references DD-V2-137 copy guidelines).
- Balance simulator run with Quick Session config shows 80%+ survival rate.
- Balance simulator run with Deep Session config shows positive mineral and knowledge gain.

### Playwright Test

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("DEV")', { timeout: 15000 })
  // Load "Post-Tutorial" preset to have 5+ due facts in a clean state
  await page.click('button:has-text("DEV")')
  await page.click('text=Presets')
  await page.click('button:has-text("Post-Tutorial")')
  await page.waitForTimeout(500)
  // Check dome for cozy session prompt (if due cards exist)
  await page.screenshot({ path: '/tmp/ss-cozy-session.png' })
  await browser.close()
})()
```

---

## Sub-Phase 18.6: Gentle Review Pressure System

### What

An exhaustive audit of all review-related UI copy and interactions to eliminate anxiety-inducing language patterns, following DD-V2-142. This sub-phase produces: a copy style guide for review language, a pass over all affected component files, and a QA checklist that becomes policy for future UI copy reviews.

### Where

Files that must be audited (all components that display review-related UI):

- `src/ui/components/StudySession.svelte`
- `src/ui/components/StreakPanel.svelte`
- `src/ui/components/KnowledgeTree.svelte`
- `src/ui/components/KnowledgeTreeView.svelte`
- `src/ui/components/KnowledgeStore.svelte`
- `src/ui/components/BaseView.svelte`
- `src/ui/components/rooms/ArchiveRoom.svelte`
- `src/game/managers/GaiaManager.ts`
- `src/game/dialogue/gaiaDialogue.ts` (GAIA dialogue strings)
- `src/ui/components/HUD.svelte`
- `src/ui/components/DiveResults.svelte`

### How

#### Review Pressure Audit Checklist

Work through every file in the list above. For each file, check every user-visible string against each item in this checklist. Mark PASS or FAIL. FAIL items must be rewritten before this sub-phase is marked complete.

**A. Timer and Urgency Language — PROHIBITED**

- [ ] No countdown timer displaying remaining minutes/hours until review expires.
- [ ] No phrases: "Expires in", "Due in", "Overdue by", "Last chance", "Don't forget".
- [ ] No visual urgency color (red, orange, pulsing) applied to review availability indicators.
- [ ] No notification text using the word "urgent", "important", "required", or "must".
- [ ] Review availability shown as neutral: "Ready to review" or "Available now" — not "OVERDUE" in any casing.

**B. Guilt and Obligation Language — PROHIBITED**

- [ ] GAIA never uses phrases: "You're falling behind", "You've been neglecting", "It's been X days since you studied", "Your streak is at risk" (use "Streak protected!" when safe, not fear).
- [ ] No badge count shown in red color scheme for review queue size.
- [ ] Skipping a review session causes zero visible negative feedback (no sad GAIA face, no penalty display, no "you missed it" messaging).
- [ ] Study session entry is always framed as optional: "Ready to strengthen some facts?" not "You have N overdue facts."
- [ ] No language treating review as a daily obligation: "Complete your daily review" → "Your facts are ready when you are."

**C. Positive Reframes — REQUIRED**

- [ ] Overdue facts displayed with warm neutral color (gold/amber, NOT red) with label "Ready to strengthen".
- [ ] GAIA frames available reviews as opportunity: "These facts are ready to grow stronger!" or "Your memory wants a workout!"
- [ ] Bonus dust incentive shown prominently for review completion (the carrot, never the stick).
- [ ] Post-review GAIA message celebrates completion: "That's how memories are made!" not "Good, you finally did it."
- [ ] Knowledge Tree leaf wilting shown with soft desaturation, not alarming withering animation.

**D. Competitive and Comparative Pressure — PROHIBITED**

- [ ] No global leaderboard for review streaks that shows rank vs other players.
- [ ] No "you're behind X% of players" comparisons.
- [ ] No messaging that implies other players are learning faster.

**E. Streak Pressure Calibration**

- [ ] Streak freeze display: shows as "Freeze available" (positive) not "You only have N freezes left" (scarcity anxiety).
- [ ] Streak break messaging: neutral recovery focus ("Start your new streak today!") not shame ("You broke your N-day streak").
- [ ] Streak milestones upcoming: shown as anticipation ("Only 3 days to your 30-day milestone!") only if phrased encouragingly; NEVER as pressure.

**F. GAIA Tone Standards (from DD-V2-142)**

All GAIA lines related to review must use one of these approved emotional registers:
- **Encouraging**: "You've got this! Five quick ones."
- **Celebratory**: "Memory muscle flexed! +20 dust."
- **Curious**: "Ooh, that one surprised you? Let's make it stick."
- **Neutral-informational**: "Three facts ready for review."

Prohibited GAIA registers for review:
- Guilt-adjacent: "Really? You haven't reviewed in 3 days?"
- Urgency-adjacent: "Quick, before it expires!"
- Shame-adjacent: "Tsk tsk, forgetting already?"

#### Step-by-Step Implementation

1. Read each file in the audit list above.
2. Extract every user-visible string literal and template literal.
3. Run the string against each checklist item.
4. For every FAIL: write a replacement string following the approved tone guidelines.
5. Make the edit in the source file.
6. Re-read the file after edits to confirm no prohibited phrases remain.
7. Record in the audit log below.

#### Audit Log Template (fill in during implementation)

```
FILE: src/ui/components/StudySession.svelte
  A.1 Timer countdown: PASS (no timers)
  A.2 Expires/Due language: [PASS/FAIL — original: "..." → replacement: "..."]
  B.1 GAIA guilt: PASS
  C.1 Overdue color: [PASS/FAIL — original CSS: "..." → replacement: "..."]
  ...

FILE: src/game/managers/GaiaManager.ts
  ...
```

#### A/B Test Instrumentation (deferred to Phase 21)

DD-V2-142 calls for A/B testing copy variants to validate anxiety-free framing improves D7 retention. Add a `copyVariant: 'control' | 'gentle'` field to the analytics event payload for review ritual entry events. Actual randomization and dashboard analysis is Phase 21 work; the instrumentation hook must be present.

### Acceptance Criteria

- Every item on the Gentle Review Pressure Audit Checklist is marked PASS with written confirmation.
- No user-visible string containing "overdue", "expir", "falling behind", "neglect", "forgot", or "must review" remains in any audited file.
- Knowledge Tree wilted-leaf color uses `#a09060` (amber-brown) rather than any red shade.
- GAIA review dialogue lines all fall within one of the four approved emotional registers.
- `copyVariant` field added to review ritual entry analytics event (can be placeholder `'gentle'` until Phase 21 randomization).

### Playwright Test

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("DEV")', { timeout: 15000 })
  // Load mid-game preset to have overdue review states
  await page.click('button:has-text("DEV")')
  await page.click('text=Presets')
  await page.click('button:has-text("Mid-Game (3 Rooms)")')
  await page.waitForTimeout(500)
  // Navigate to Archive room (study ritual)
  await page.click('button:has-text("DEV")')
  await page.click('text=Navigation')
  await page.click('button:has-text("Study")')
  await page.waitForTimeout(1000)
  await page.screenshot({ path: '/tmp/ss-review-pressure.png' })
  // Visually inspect: no red badges, no countdown timers, GAIA tone is encouraging
  await browser.close()
})()
```

---

## Sub-Phase 18.7: Quiz Anti-Homework Pass

### What

An audit of every quiz occurrence in the codebase (DD-V2-173) to:
1. Rename quiz-related UI text to use adventure/discovery language.
2. Ensure each of the five quiz types has a narrative justification.
3. Add outcome animations framing results as adventure events, not grade scores.
4. Verify no "test" or "quiz" words appear in any player-facing string.

### Where

Files that must be audited for quiz language:

- `src/ui/components/QuizOverlay.svelte`
- `src/ui/components/StudySession.svelte`
- `src/ui/components/DivePrepScreen.svelte`
- `src/game/managers/QuizManager.ts` (GAIA dialogue strings for quiz events)
- `src/game/managers/StudyManager.ts`
- `src/game/MineScene.ts` (any quiz trigger display text)
- `src/ui/components/HUD.svelte` (quiz streak display)
- `src/data/types.ts` (any player-facing type labels)

### How

#### Quiz Anti-Homework Audit Checklist

**A. Banned Words in Player-Facing Strings — ZERO TOLERANCE**

- [ ] The word "Quiz" does not appear in any button label, overlay title, HUD element, or GAIA dialogue visible to players.
- [ ] The word "Test" does not appear in any player-facing string (internal TypeScript identifiers and type names are exempt).
- [ ] The word "Exam" does not appear in any player-facing string.
- [ ] The word "Grade" does not appear in any player-facing string.
- [ ] The word "Score" is only used for dust/loot reward totals, never for knowledge performance.
- [ ] The word "Wrong" is replaced with "Not quite" or "Try again" in result feedback.
- [ ] The word "Correct" alone is replaced with "That's it!" or "Nailed it!" in result feedback.
- [ ] No letter grades (A, B, C, F) appear anywhere.
- [ ] No percentage accuracy statistics are shown to the player (internal balance simulation only).

**B. Approved Replacement Vocabulary**

| Prohibited | Approved Replacement |
|---|---|
| "Quiz" (overlay title) | "GAIA Challenge!", "Field Scan", "Quick Scan" |
| "Quiz" (HUD streak) | "Scan Streak" |
| "Pop Quiz triggered" | "Field Test incoming!" |
| "Quiz gate" | "Knowledge Gate", "GAIA Checkpoint" |
| "Correct!" | "That's it!", "Nailed it!", "Locked in!" |
| "Wrong!" | "Not quite!", "Hmm, let me remind you..." |
| "Test your knowledge" | "What do you remember?" |
| "Study Quiz" | "Memory Strength" |
| "Quiz Overlay" | (internal only — user-facing title: "GAIA Challenge") |

**C. Narrative Justification Audit — Five Quiz Types**

Each quiz type must have a diegetic (in-world) reason. Verify the following in `QuizManager.ts` and `QuizOverlay.svelte`:

| Quiz Type | Required Narrative Justification | GAIA Framing |
|---|---|---|
| **Pop Quiz** (random in-mine) | GAIA's scanner picks up residual data signatures from ancient deposits | "Scanner ping! Residual data detected — what does it say?" |
| **Quiz Gate** (layer transition) | Access nodes require knowledge authentication to unlock | "Knowledge Gate engaged. Authenticate to proceed." |
| **Artifact Quiz** (appraisal) | GAIA analyzes the artifact using your knowledge as reference | "Artifact uplink — your knowledge calibrates the analysis." |
| **Hazard Quiz** (lava/gas damage) | Quick-thinking recall reduces exposure time | "Rapid field assessment! Your knowledge reduces the damage!" |
| **Layer Entrance Quiz** | Atmospheric sensors require recall calibration at depth | "Depth calibration sequence — what do you recall?" |

Each quiz type must display the appropriate GAIA framing line (not a generic "Quiz time!") before showing the question. Verify each type in `QuizManager.ts` triggers the correct framing string.

**D. Outcome Animation Requirements**

After a quiz answer (correct or wrong), the overlay must show an adventure-narrative animation, not a classroom score flash:

- **Correct answer**: Play a short visual — "treasure chest opens", dust particles burst from the screen center, GAIA toast appears with a celebratory message. Duration: 800ms before auto-advancing.
- **Wrong answer**: Play "hazard mitigated" visual — a ripple effect (CSS `@keyframes`) on the screen border, GAIA toast appears with the memory tip. No red flash, no "X" mark. Duration: 1200ms before auto-advancing (longer so the explanation is readable).
- **Scan Streak milestone** (quiz streak × multiplier): Show current multiplier badge animating up (1x → 1.5x → 2x → 3x) with dust reward particles.

Verify or implement in `QuizOverlay.svelte`.

**E. Study Session Language Audit**

`StudySession.svelte` must use:
- Header: "Memory Strengthening" (not "Study Quiz" or "Review Session")
- Card front label: "What do you recall?" (not "Question:")
- Button labels: "Easy", "Got it", "Didn't get it" (already per DD-V2-095 — verify unchanged)
- Completion screen: "Session complete! Your memory is stronger." (not "Quiz finished. Score: X/Y")

#### Step-by-Step Implementation

1. Read each file in the audit list.
2. Extract every string and template literal that will be visible to a player.
3. Run each string against the banned-words checklist (Section A).
4. Apply approved replacement vocabulary (Section B).
5. Verify narrative framing strings for all five quiz types are present in `QuizManager.ts` (Section C).
6. Verify or add outcome animations in `QuizOverlay.svelte` (Section D).
7. Audit `StudySession.svelte` for approved language (Section E).
8. Record all changes in the audit log below.

#### Audit Log Template

```
FILE: src/ui/components/QuizOverlay.svelte
  A. Banned words:
    - Line 42: "Quiz Complete" → "GAIA Challenge Complete" [FIXED]
    - Line 88: "Correct!" → "Nailed it!" [FIXED]
    - Line 91: "Wrong!" → "Not quite!" [FIXED]
  B. Vocabulary check: PASS after above fixes
  C. Narrative framing: [PASS/FAIL per quiz type]
  D. Outcome animations: [PASS/FAIL]

FILE: src/game/managers/QuizManager.ts
  A. Banned words: [result]
  C. Narrative framing strings:
    - Pop Quiz: [PASS/FAIL — string found: "..."]
    - Quiz Gate: [PASS/FAIL]
    - Artifact: [PASS/FAIL]
    - Hazard: [PASS/FAIL]
    - Layer Entrance: [PASS/FAIL]
```

### Acceptance Criteria

- Zero occurrences of the words "quiz", "test", "exam", "grade" (case-insensitive) in any player-facing string across all audited files. Confirmed by grep: `grep -ri "quiz\|test\|exam\|grade" src/ui src/game --include="*.svelte" --include="*.ts"` produces ONLY internal identifiers and comments, no user-visible strings.
- All five quiz types display their correct GAIA narrative framing line before the question appears.
- Correct answer animation plays dust particles or equivalent positive effect, duration 800ms.
- Wrong answer animation plays non-red border effect, duration 1200ms, no letter grades or accuracy percentages.
- `StudySession.svelte` header reads "Memory Strengthening".
- `QuizOverlay.svelte` title attribute reads "GAIA Challenge" or type-specific variant.
- `HUD.svelte` quiz streak counter labelled "Scan Streak" (if visible).

### Playwright Test

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/ss-mine-quiz-check.png' })
  // Navigate to Study screen and verify language
  await page.click('button:has-text("DEV")')
  await page.click('text=Navigation')
  await page.click('button:has-text("Study")')
  await page.waitForTimeout(1000)
  await page.screenshot({ path: '/tmp/ss-study-language.png' })
  // Verify "Memory Strengthening" header is present
  const header = await page.textContent('h1, .study-title, .session-header')
  console.assert(
    !header?.toLowerCase().includes('quiz'),
    `"quiz" must not appear in study header. Found: "${header}"`
  )
  await browser.close()
})()
```

---

## Verification Gate

After all seven sub-phases are complete, run the following full verification pass:

### Build and Type Checks

- [ ] `npm run typecheck` passes with zero errors.
- [ ] `npm run build` produces a clean production bundle with no warnings about missing exports.

### Functional Verification

- [ ] All nine scenario presets load without errors and visually update the game state.
- [ ] "New Player" preset shows exactly 1 unlocked room, 0 facts, minimal resources.
- [ ] "Endgame (All Rooms)" preset shows all BALANCE.DOME_ROOMS unlocked.
- [ ] "Max Streak" preset shows currentStreak: 100 in Debug Info.
- [ ] Save export produces a valid JSON file matching the snapshot schema.
- [ ] Save import of a previously exported file round-trips: all fields match, Debug Info shows identical values.
- [ ] Importing a malformed JSON file shows "Invalid snapshot file" error string without crashing.
- [ ] Up to 20 snapshots stored; 21st drops oldest.

### Session Profile Verification

- [ ] `PlayerStats` includes `totalSessions` and `zeroDiveSessions` (typecheck confirms).
- [ ] DevPanel Debug Info shows "Zero-dive %: N%" computed correctly.
- [ ] Balance simulator Config A (layers 1-5) shows 80%+ survival rate.
- [ ] Balance simulator Config B (layers 10-15) shows positive mineral and knowledge gain.
- [ ] Post-dive results screen includes at least one informational GAIA engagement hook per DD-V2-137.

### Review Pressure Audit Verification

- [ ] Every item on the Gentle Review Pressure Audit Checklist (18.6) is marked PASS with written record.
- [ ] `grep -ri "overdue\|expir\|falling behind\|neglect" src/ui src/game --include="*.svelte" --include="*.ts"` returns zero player-facing matches.
- [ ] Knowledge Tree wilted-leaf color is `#a09060` (amber-brown), not any red shade.

### Quiz Anti-Homework Audit Verification

- [ ] `grep -ri '"quiz\|"test\|"exam\|"grade\|>Quiz\|>Test\|>Exam' src/ui src/game --include="*.svelte"` returns zero matches in player-facing text.
- [ ] All five quiz type narrative framing strings are present in `QuizManager.ts`.
- [ ] `QuizOverlay.svelte` correct-answer path includes a visual animation effect with duration ≥ 800ms.
- [ ] `QuizOverlay.svelte` wrong-answer path includes a non-red animation effect with duration ≥ 1200ms.
- [ ] `StudySession.svelte` header text is "Memory Strengthening" or equivalent approved phrasing.

### Visual Verification (Playwright screenshots)

- [ ] `/tmp/ss-preset-endgame.png` — Endgame preset loaded, all rooms visible in dome.
- [ ] `/tmp/ss-snapshots.png` — Snapshot list shows saved entry with correct label.
- [ ] `/tmp/ss-cozy-session.png` — Dome shows GAIA review prompt (when facts are due).
- [ ] `/tmp/ss-review-pressure.png` — Study screen shows no red badges, no countdown timers.
- [ ] `/tmp/ss-study-language.png` — Study screen header does not contain "quiz".
- [ ] `/tmp/ss-mine-quiz-check.png` — Mine renders without errors.

---

## Files Affected

### New Files

- `src/dev/presets.ts` — Scenario preset definitions (nine presets, `SCENARIO_PRESETS` array)
- `src/dev/snapshotStore.ts` — Snapshot store utilities (`SaveSnapshot` type, `listSnapshots`, `storeSnapshot`, `deleteSnapshot`, `exportSnapshotBlob`, `parseSnapshotFile`)
- `server/src/routes/dev/sprites.ts` — Sprite dashboard backend route (18.3, conditional)
- `server/src/routes/dev/facts.ts` — Fact editor dashboard backend route (18.4, conditional)
- `server/src/views/dev-sprites.html` — Sprite dashboard frontend (18.3, conditional)
- `server/src/views/dev-facts.html` — Fact editor dashboard frontend (18.4, conditional)

### Modified Files

- `src/ui/components/DevPanel.svelte` — Add Presets section (18.1), add Snapshots section (18.2), add zero-dive session metric to Debug Info (18.5)
- `src/data/types.ts` — Add `totalSessions`, `zeroDiveSessions` to `PlayerStats` (18.5)
- `src/ui/components/StudySession.svelte` — Language audit (18.6 review pressure, 18.7 anti-homework)
- `src/ui/components/StreakPanel.svelte` — Language audit (18.6)
- `src/ui/components/KnowledgeTree.svelte` — Wilted-leaf color change to `#a09060`, language audit (18.6)
- `src/ui/components/KnowledgeTreeView.svelte` — Language audit (18.6)
- `src/ui/components/KnowledgeStore.svelte` — Language audit (18.6)
- `src/ui/components/BaseView.svelte` — Cozy session GAIA prompt logic (18.5), language audit (18.6)
- `src/ui/components/rooms/ArchiveRoom.svelte` — Language audit (18.6)
- `src/game/managers/GaiaManager.ts` — GAIA tone audit for review language (18.6), narrative framing strings for all five quiz types (18.7)
- `src/game/managers/QuizManager.ts` — Narrative framing strings per quiz type (18.7)
- `src/ui/components/QuizOverlay.svelte` — Language audit, outcome animations (18.7)
- `src/ui/components/HUD.svelte` — "Scan Streak" label for quiz streak counter (18.7)
- `src/ui/components/DiveResults.svelte` — Add informational GAIA engagement hook (18.5)
- `src/ui/components/Farm.svelte` — Next harvest timer hook (18.5)
- `src/ui/components/Zoo.svelte` — Next revival target hook (18.5)
- `src/game/GameManager.ts` — Session counter increments (18.5)
- `src/services/saveService.ts` — Default values for new `PlayerStats` fields (18.5)

---

## Sub-Phase 18.8: CI/CD Pipeline

- [ ] Create 3 GitHub Actions workflows: `ci.yml` (typecheck + unit tests on every PR), `deploy-staging.yml` (build + deploy on merge to `main`), `deploy-prod.yml` (manual gate + Docker push). (DD-V2-215)
- [ ] Configure Dependabot for weekly dependency updates with auto-merge for patch versions.

## Sub-Phase 18.9: Testing Strategy

- [ ] Establish Vitest 3-tier test coverage targets: unit tests 90% coverage on all service/utility files, API integration tests 95% route coverage, E2E Playwright smoke tests for the 5 critical user flows. (DD-V2-216)
- [ ] Add `npm run test`, `npm run test:api`, and `npm run test:e2e` scripts to `package.json`; all three must pass in CI before merge.

## Sub-Phase 18.10: Seed Determinism Tests

- [ ] Write golden-snapshot tests for 20 random seeds × 3 depth layers; assert identical mine grid output across builds. (DD-V2-217)
- [ ] Add invariant assertions: no isolated empty cells, all descent shafts reachable, lava density within configured range.

## Sub-Phase 18.11: Monorepo Workspaces

- [ ] Migrate to pnpm workspaces with packages for `app` (Vite/Svelte), `server` (Fastify), and `shared` (types/schemas). (DD-V2-230)
- [ ] Configure Turborepo for cached builds; `turbo build` replaces standalone `npm run build` in CI.

---

## Sub-Phase 18.12: Build-Time Asset Audit (DD-V2-278)

### What

An automated script that runs as part of `npm run build` to enforce two-way integrity between code references and actual sprite files. Unreferenced sprite files produce a build warning (orphan assets waste bundle size and confuse developers). Code references to missing sprite files produce a build error (these are always runtime bugs). At 500+ assets, human memory cannot be relied upon — this must be automated.

### Where

- **New file**: `scripts/audit-assets.mjs` — standalone Node.js ESM script; exits with code 1 on errors
- **Modified**: `package.json` — prepend `node scripts/audit-assets.mjs &&` to the `build` script

### How

#### Step 1 — Create `scripts/audit-assets.mjs`

```js
#!/usr/bin/env node
// scripts/audit-assets.mjs
// Build-time sprite asset audit.
// Warnings: sprite files with no code reference.
// Errors: code references to missing sprite files.
// Exit code 1 if any errors found.

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, basename, extname } from 'node:path'
import { globSync } from 'glob'

const ROOT = new URL('..', import.meta.url).pathname

// --- Collect all sprite files ---
const SPRITE_DIRS = [
  join(ROOT, 'src/assets/sprites'),
  join(ROOT, 'src/assets/sprites-hires'),
]

/** @type {Set<string>} All sprite basenames (without extension) that exist on disk */
const diskSprites = new Set()

for (const dir of SPRITE_DIRS) {
  if (!existsSync(dir)) continue
  for (const file of readdirSync(dir, { recursive: true })) {
    if (extname(file) === '.png') {
      diskSprites.add(basename(file, '.png'))
    }
  }
}

// --- Collect all sprite key references in code ---
const SOURCE_GLOBS = [
  join(ROOT, 'src/**/*.ts'),
  join(ROOT, 'src/**/*.svelte'),
]

/** @type {Set<string>} All sprite keys referenced in source files */
const codeRefs = new Set()

/** @type {Array<{key: string, file: string, line: number}>} References to missing sprites */
const missingRefs = []

for (const pattern of SOURCE_GLOBS) {
  for (const filePath of globSync(pattern)) {
    const content = readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')

    lines.forEach((line, idx) => {
      // Match sprite key patterns: 'gaia_neutral', "obj_knowledge_tree_stage0", etc.
      // Keys are alphanumeric + underscores, used as string literals in load/setTexture calls
      const matches = line.matchAll(/['"]([a-z][a-z0-9_]{2,})['"]/g)
      for (const match of matches) {
        const key = match[1]
        // Heuristic: sprite keys contain underscores and are not TypeScript keywords
        if (key.includes('_')) {
          codeRefs.add(key)
          if (!diskSprites.has(key)) {
            missingRefs.push({ key, file: filePath.replace(ROOT, ''), line: idx + 1 })
          }
        }
      }
    })
  }
}

// --- Find orphaned sprites (on disk but never referenced) ---
const orphans = [...diskSprites].filter(k => !codeRefs.has(k))

// --- Report ---
let hasErrors = false

if (orphans.length > 0) {
  console.warn(`\n⚠  Asset audit: ${orphans.length} unreferenced sprite(s) (warnings):`)
  for (const key of orphans.sort()) {
    console.warn(`   ORPHAN  ${key}.png`)
  }
}

if (missingRefs.length > 0) {
  hasErrors = true
  console.error(`\n✖  Asset audit: ${missingRefs.length} missing sprite reference(s) (errors):`)
  for (const { key, file, line } of missingRefs) {
    console.error(`   MISSING  '${key}'  →  ${file}:${line}`)
  }
}

if (!hasErrors && orphans.length === 0) {
  console.log(`✓  Asset audit passed: ${diskSprites.size} sprites, ${codeRefs.size} references, no issues.`)
} else if (!hasErrors) {
  console.log(`\n✓  Asset audit: no errors (${orphans.length} warning(s) above).`)
} else {
  console.error('\n✖  Asset audit failed. Fix missing sprites before building.')
  process.exit(1)
}
```

#### Step 2 — Wire into build script

In `package.json`:

```json
{
  "scripts": {
    "build": "node scripts/audit-assets.mjs && vite build"
  }
}
```

This ensures the audit runs before Vite compilation, failing fast on missing references.

#### Step 3 — False positive suppression

Some string literals matching the `_`-underscore heuristic are not sprite keys (e.g., TypeScript private field names like `_manager`). Add a denylist of known false positives at the top of `audit-assets.mjs`:

```js
const DENYLIST = new Set([
  // TypeScript/Svelte patterns that match the heuristic but are not sprite keys
  'on_mount', 'on_destroy', 'get_store_value', 'create_component',
])
// In the match loop: if (key.includes('_') && !DENYLIST.has(key)) { ... }
```

Expand this list if false positives appear during initial runs.

### Acceptance Criteria

- [ ] `audit-assets.mjs` script exists at `scripts/audit-assets.mjs`
- [ ] `npm run build` runs the audit before Vite compilation
- [ ] Adding a PNG to `src/assets/sprites/` with no code reference → build prints ORPHAN warning but does not fail
- [ ] Adding a string reference `'nonexistent_sprite'` (with underscore) to any `.ts` or `.svelte` file → build prints MISSING error and exits 1
- [ ] Zero false positive errors on a clean build of the current codebase
- [ ] Audit summary line printed on success: `✓  Asset audit passed: N sprites, M references, no issues.`

---

## Sub-Phase 18.13: Sprite QC Automation Pipeline (DD-V2-274)

### What

A 3-gate automated quality control script that runs between ComfyUI sprite generation and human review. Currently, approximately 30% of generated sprites are rejected during manual review (wrong composition, incomplete background removal, wrong palette). This pipeline catches the most common failure modes automatically, targeting <5% human-review rejection rate.

### Where

- **New file**: `scripts/sprite-qc.mjs` — accepts a directory of generated PNGs as input; outputs a QC report and moves passing sprites to an `approved/` subdirectory
- **Called by**: developers manually after each ComfyUI batch, before moving sprites to `src/assets/`

### How

#### Step 1 — Create `scripts/sprite-qc.mjs`

```js
#!/usr/bin/env node
// scripts/sprite-qc.mjs
// 3-gate automated QC for ComfyUI-generated sprites.
// Usage: node scripts/sprite-qc.mjs <input-dir> [--biome <biome-id>]
//
// Gate 1: Composition — rejects multi-object images (sprite sheets, 4-up grids)
// Gate 2: Background — rejects sprites with incomplete background removal
// Gate 3: Palette — rejects sprites whose dominant colors mismatch target biome palette

import { readdirSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs'
import { join, basename } from 'node:path'
import { createCanvas, loadImage } from 'canvas'  // node-canvas

const [,, inputDir, ...flags] = process.argv
const biomeFlag = flags.indexOf('--biome')
const targetBiome = biomeFlag >= 0 ? flags[biomeFlag + 1] : null

if (!inputDir) {
  console.error('Usage: node scripts/sprite-qc.mjs <input-dir> [--biome <biome-id>]')
  process.exit(1)
}

const approvedDir = join(inputDir, 'approved')
const rejectedDir = join(inputDir, 'rejected')
mkdirSync(approvedDir, { recursive: true })
mkdirSync(rejectedDir, { recursive: true })

// --- Biome palette targets (dominant color ranges in HSL) ---
const BIOME_PALETTES = {
  topsoil:         { hueRange: [20, 50],  satMin: 0.2, lightnessMin: 0.4 },
  volcanic_veins:  { hueRange: [0, 20],   satMin: 0.5, lightnessMin: 0.2 },
  crystal_caverns: { hueRange: [200, 260], satMin: 0.4, lightnessMin: 0.3 },
  abyssal_depths:  { hueRange: [200, 240], satMin: 0.2, lightnessMin: 0.1 },
}

/**
 * Gate 1: Composition check.
 * Rejects images where content occupies multiple separated regions
 * (catches 4-up sprite sheets and multi-object compositions).
 * Uses edge detection: finds bounding boxes of connected edge regions.
 */
async function gateComposition(imageData, w, h) {
  // Simple approach: find the bounding box of non-transparent pixels.
  // If the bounding box has more than 2 disconnected regions, reject.
  const { data } = imageData
  let regions = 0
  let inRegion = false
  // Scan row by row for runs of visible pixels with gaps
  for (let y = 0; y < h; y++) {
    let rowHasContent = false
    for (let x = 0; x < w; x++) {
      const alpha = data[(y * w + x) * 4 + 3]
      if (alpha > 30) { rowHasContent = true; break }
    }
    if (rowHasContent && !inRegion) { regions++; inRegion = true }
    if (!rowHasContent) inRegion = false
  }
  if (regions > 2) return { pass: false, reason: `Composition: ${regions} disconnected content regions (likely sprite sheet or multi-object)` }
  return { pass: true }
}

/**
 * Gate 2: Background removal check.
 * Post-rembg sprites should have near-zero alpha in the outer 10% border.
 * Rejects if mean alpha of outer border pixels > 30.
 */
async function gateBackground(imageData, w, h) {
  const { data } = imageData
  const borderW = Math.floor(w * 0.1)
  const borderH = Math.floor(h * 0.1)
  let totalAlpha = 0
  let count = 0

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inBorder = x < borderW || x >= w - borderW || y < borderH || y >= h - borderH
      if (inBorder) {
        totalAlpha += data[(y * w + x) * 4 + 3]
        count++
      }
    }
  }

  const meanBorderAlpha = totalAlpha / count
  if (meanBorderAlpha > 30) {
    return { pass: false, reason: `Background: outer 10% border mean alpha = ${meanBorderAlpha.toFixed(1)} (threshold: 30) — incomplete background removal` }
  }
  return { pass: true }
}

/**
 * Gate 3: Palette check.
 * Computes dominant color of non-transparent pixels.
 * Rejects if dominant hue is outside target biome hue range.
 * Only runs when --biome flag is provided.
 */
async function gatePalette(imageData, w, h, biomeId) {
  if (!biomeId || !BIOME_PALETTES[biomeId]) return { pass: true }

  const { data } = imageData
  const palette = BIOME_PALETTES[biomeId]
  let rSum = 0, gSum = 0, bSum = 0, count = 0

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 30) {  // only non-transparent pixels
      rSum += data[i]; gSum += data[i+1]; bSum += data[i+2]
      count++
    }
  }

  if (count === 0) return { pass: false, reason: 'Palette: no visible pixels found (fully transparent?)' }

  const r = rSum / count / 255
  const g = gSum / count / 255
  const b = bSum / count / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1))
  let h = 0
  if (max !== min) {
    if (max === r) h = ((g - b) / (max - min) + 6) % 6
    else if (max === g) h = (b - r) / (max - min) + 2
    else h = (r - g) / (max - min) + 4
    h = h * 60
  }

  const [hMin, hMax] = palette.hueRange
  if (h < hMin || h > hMax || s < palette.satMin || l < palette.lightnessMin) {
    return {
      pass: false,
      reason: `Palette: dominant HSL(${h.toFixed(0)}, ${(s*100).toFixed(0)}%, ${(l*100).toFixed(0)}%) outside target range for biome '${biomeId}' (hue ${hMin}-${hMax})`
    }
  }
  return { pass: true }
}

// --- Main loop ---
const files = readdirSync(inputDir).filter(f => f.endsWith('.png'))
const report = []
let passed = 0, rejected = 0

for (const file of files) {
  const filePath = join(inputDir, file)
  const img = await loadImage(filePath)
  const canvas = createCanvas(img.width, img.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  const imageData = ctx.getImageData(0, 0, img.width, img.height)

  const gates = [
    await gateComposition(imageData, img.width, img.height),
    await gateBackground(imageData, img.width, img.height),
    await gatePalette(imageData, img.width, img.height, targetBiome),
  ]

  const failures = gates.filter(g => !g.pass)
  if (failures.length === 0) {
    copyFileSync(filePath, join(approvedDir, file))
    report.push({ file, status: 'PASS' })
    passed++
  } else {
    copyFileSync(filePath, join(rejectedDir, file))
    report.push({ file, status: 'FAIL', reasons: failures.map(f => f.reason) })
    rejected++
    console.warn(`REJECTED  ${file}`)
    for (const { reason } of failures) console.warn(`          ${reason}`)
  }
}

// Write JSON report
writeFileSync(join(inputDir, 'qc-report.json'), JSON.stringify(report, null, 2))

console.log(`\nSprite QC complete: ${passed} passed, ${rejected} rejected out of ${files.length} sprites.`)
console.log(`Approved sprites: ${approvedDir}`)
console.log(`Rejected sprites: ${rejectedDir}`)
console.log(`Full report: ${join(inputDir, 'qc-report.json')}`)
```

#### Step 2 — Install `canvas` dependency

`canvas` (node-canvas) is required for pixel-level image analysis. Add to dev dependencies:

```bash
npm install --save-dev canvas
```

Note: `canvas` requires native compilation. Confirm build succeeds in the project environment before relying on this script in CI.

#### Step 3 — Workflow integration

After each ComfyUI batch completes and rembg post-processing is done, run:

```bash
# For biome-specific sprites (gate 3 active):
node scripts/sprite-qc.mjs /tmp/comfyui-output --biome topsoil

# For non-biome sprites (gate 3 skipped):
node scripts/sprite-qc.mjs /tmp/comfyui-output

# Move approved sprites to src/assets:
cp /tmp/comfyui-output/approved/*.png src/assets/sprites/
```

Document this in `docs/SPRITE_PIPELINE.md` as the mandatory step between ComfyUI output and `src/assets/` ingestion.

#### Step 4 — Tune rejection thresholds

After initial deployment, track rejection rate over 3 batches. If false positive rate (good sprites rejected) exceeds 10%:
- Relax `borderAlpha` threshold from 30 → 50
- Expand hue ranges in `BIOME_PALETTES` by ±10 degrees
- Document the tuning in a comment block at the top of the script

### Acceptance Criteria

- [ ] `scripts/sprite-qc.mjs` exists and runs without errors on a directory of PNG files
- [ ] Gate 1: a known sprite sheet (4 sprites on one PNG) is rejected with "disconnected content regions" reason
- [ ] Gate 2: a PNG with opaque white background (pre-rembg) is rejected with "incomplete background removal" reason
- [ ] Gate 3: a sprite with dominant blue hue submitted with `--biome topsoil` (amber target) is rejected with palette reason
- [ ] A correctly generated sprite (transparent bg, single centered subject, correct palette) passes all 3 gates
- [ ] `qc-report.json` written to input directory with per-file pass/fail and reasons
- [ ] Approved sprites copied to `approved/` subdirectory; rejected sprites to `rejected/` subdirectory

---

*Phase 18 complete when all items in the Verification Gate are checked and all Playwright screenshots confirm visual correctness.*
