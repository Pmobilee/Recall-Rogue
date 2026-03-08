# Phase 37: Advanced Pet System

## Overview

**Goal**: Expand the companion and pet experience into a living, personality-driven side system that deepens emotional investment in the dome. The centrepiece is the **Dust Cat** — a permanent ambient pet that follows the player in the mine and patrols the dome between dives. Around it, a set of interconnected sub-systems adds feeding/grooming mini-games with a happiness meter, procedurally-assigned personality traits that grant minor gameplay bonuses, combo synergy bonuses when the active dive companion and the Dust Cat's current mood align, a mastery-gated **Legendary evolution** stage (stage 3) for all five companions, and a cosmetics wardrobe (hats, accessories, colour variations) for the Dust Cat.

**Why this phase matters**: The existing pet layer (5 fossil companions, `petAnimations.ts`, GAIA Phase 15.3 commentary) is mechanically functional but emotionally thin. Players unlock a companion and then largely ignore it except as a passive buff source. This phase converts pets from passive buffs into a relationship that rewards daily attention, ties into the spaced-repetition learning loop, and provides a low-intensity tactile activity during cool-down periods between dives.

**Dependencies (must be complete before starting)**:
- Phase 8 — `TickSystem`, `CompanionManager`, `companions.ts` (5 companions, 3 evolution stages, `CompanionState`) must be stable
- Phase 9 — Biome system supplies the biome ID used for Dust Cat mine-entry dialogue
- Phase 10 — `DomeScene.ts` and `petAnimations.ts` provide the canvas rendering layer the Dust Cat will share
- Phase 15 — `GaiaManager.getPetComment()` is the hook used by the Dust Cat's in-dome thought bubbles
- Phase 16 — Farm room and Zoo room (`unlockedRooms` in `PlayerSave`) already exist as rendering targets for Dust Cat ambient wandering
- `petPersonalities.ts` — personality type, mood, and synergy data already stubbed; this phase fully implements the runtime logic

**Estimated complexity**: Medium-high. The Dust Cat mine follower touches both `MineScene.ts` and `DomeScene.ts`. The mini-game is purely Svelte (no Phaser) and uses the existing tap-interaction pattern from Phase 17's gacha reveal. Trait assignment and synergy bonuses hook into `CompanionManager.ts` and `GameManager.ts` cleanly. The Legendary evolution stage requires only extending the existing `CompanionEvolutionStage` tuple from length 3 to length 4.

**Design decisions governing this phase**:
- **DD-V2-040**: Dust Cat as permanent ambient companion — always present, cannot be dismissed, has its own identity separate from the five revived fossil companions
- **DD-V2-041**: Pet mini-games should be tap-based, completable in under 30 seconds, rewarding but not compulsory — they gate happiness bonuses, not core progression
- **DD-V2-042**: Personality traits must be procedurally assigned at first unlock (not player-chosen) to create genuine attachment through surprise discovery; traits are permanent per save slot

---

## Sub-Phases

---

### 37.1 — Dust Cat: Permanent Ambient Pet

**Goal**: Introduce the Dust Cat as a unique permanent companion that appears in both the mine and the dome. In the mine it trails the player sprite. In the dome it wanders autonomously between rooms. Unlike fossil companions it cannot be swapped out or placed in the dig team.

#### 37.1.1 — Data Model

**File**: `src/data/dustCat.ts` (new)

```typescript
/**
 * dustCat.ts
 * All static data for the Dust Cat permanent pet. (DD-V2-040)
 */

/** Possible ambient animations the Dust Cat can play in the dome. */
export type DustCatAmbientAnim =
  | 'walk'
  | 'idle_sit'
  | 'idle_groom'
  | 'idle_sniff'
  | 'sleep'
  | 'react_happy'
  | 'react_excited'
  | 'react_hungry'

/** Mine-layer animation modes for the Dust Cat mine follower. */
export type DustCatMineAnim = 'follow' | 'idle_sniff' | 'react_block'

/** Dust Cat mine-follow behavior config. */
export interface DustCatMineConfig {
  /** Tiles behind the player the cat maintains. */
  followDistance: number
  /** Maximum tiles per second the cat moves to close the gap. */
  moveSpeed: number
  /** Probability per block mined that the cat plays react_block animation. */
  reactChance: number
  /** Minimum ticks between mine reactions to avoid spamming. */
  reactCooldownTicks: number
}

export const DUST_CAT_MINE_CONFIG: DustCatMineConfig = {
  followDistance: 2,
  moveSpeed: 3,
  reactChance: 0.12,
  reactCooldownTicks: 8,
}

/** Sprite keys expected from the sprite pipeline for the Dust Cat. */
export const DUST_CAT_SPRITE_KEYS = {
  walk:          'dust_cat_walk',        // 4-frame walk strip, 48×32 px per frame
  idle_sit:      'dust_cat_idle_sit',    // 2-frame sit strip
  idle_groom:    'dust_cat_idle_groom',  // 4-frame groom strip
  idle_sniff:    'dust_cat_idle_sniff',  // 3-frame sniff strip
  sleep:         'dust_cat_sleep',       // 2-frame sleep strip (eyes closed)
  react_happy:   'dust_cat_react_happy', // 3-frame bounce strip
  react_excited: 'dust_cat_react_excited', // 4-frame roll strip
  react_hungry:  'dust_cat_react_hungry',  // 2-frame ears-down strip
  shadow:        'dust_cat_shadow',      // static 48×8 soft-circle shadow
} as const

/** Logical render size of the Dust Cat sprite in dome tile units. */
export const DUST_CAT_RENDER = { width: 48, height: 32 }

/** Base mine-follow sprite size in Phaser pixel units (matches 32px tile grid). */
export const DUST_CAT_MINE_RENDER = { width: 24, height: 16 }
```

**Acceptance criteria**:
- File exists with no TypeScript errors (`npm run typecheck` passes)
- All exported constants are referenced by at least one later sub-phase

#### 37.1.2 — PlayerSave Extension

**File**: `src/data/types.ts` (modify `PlayerSave`)

Add the following fields to `PlayerSave`:

```typescript
// Phase 37: Advanced Pet System
/** Whether the Dust Cat has been received (given after first completed dome tour). */
dustCatUnlocked?: boolean
/** Current happiness score 0–100. Decays by 2/hour while unlocked. */
dustCatHappiness?: number
/** Unix timestamp of last happiness decay calculation. */
dustCatLastDecayAt?: number
/** Assigned personality trait IDs (exactly 2, assigned at unlock, permanent). */
dustCatTraits?: [string, string]
/** Currently equipped cosmetic IDs for the Dust Cat. Keys: 'hat' | 'accessory' | 'color'. */
dustCatCosmetics?: Record<string, string>
/** Evolution stage for each companion (0-3, extending Phase 8's 0-2). */
companionLegendaryStages?: Record<string, boolean>  // companionId → has reached stage 3
```

**Acceptance criteria**:
- `npm run typecheck` passes
- `dustCatHappiness` clamps to [0, 100] in all write paths (enforced in `playerData.ts`)

#### 37.1.3 — Dust Cat Mine Follower (MineScene)

**File**: `src/game/scenes/MineScene.ts` (modify)

Add a `DustCatFollower` inner class (or object literal) instantiated in `create()` when `playerSave.dustCatUnlocked` is true. It maintains an `x, y` world position that lags behind the player's position by `DUST_CAT_MINE_CONFIG.followDistance` tiles, interpolated at `DUST_CAT_MINE_CONFIG.moveSpeed` tiles/second in `update(delta)`.

Key implementation points:
1. Render the Dust Cat as a `Phaser.GameObjects.Sprite` at depth `PLAYER_DEPTH - 1` so it appears behind the miner.
2. Use `DUST_CAT_SPRITE_KEYS.walk` while moving, `DUST_CAT_SPRITE_KEYS.idle_sniff` when stationary for 1.5+ seconds.
3. Flip `flipX` to match horizontal movement direction.
4. On every block-mined event (`handleMineAction` success path), roll `Math.random() < DUST_CAT_MINE_CONFIG.reactChance` and play `react_block` animation if cooldown has elapsed; reset cooldown counter.
5. On layer descent (existing `descendLayer()` path), briefly play `react_excited` and emit a GAIA thought bubble via `GaiaManager.getPetComment('dust_cat', 'excited')`.
6. Destroy and null the follower sprite in `shutdown()`.

```typescript
// Snippet: DustCatFollower update call inside MineScene.update()
if (this.dustCatFollower && playerSave.dustCatUnlocked) {
  this.dustCatFollower.update(delta, this.player.x, this.player.y)
}
```

**Acceptance criteria**:
- Dust Cat sprite appears in the mine 2 tiles behind the miner when `dustCatUnlocked = true`
- Cat faces the direction of recent movement (flipX correct)
- Cat plays sniff idle when player has not moved for 1.5 s
- Cat plays brief reaction on block mine (capped at cooldown)
- No visible z-order conflict with player sprite
- `npm run typecheck` passes; `npm run build` succeeds

#### 37.1.4 — Dust Cat Dome Wanderer (DomeScene)

**File**: `src/game/scenes/DomeScene.ts` (modify)

After the existing pet animation update loop (which renders fossil companion pets), add a `DustCatWanderer` sub-object that:

1. Picks a random valid floor to "live" on (defaults to floor 0 — Starter Hub — until Zoo room is unlocked, then can also roam floor with Zoo).
2. Moves between randomly sampled waypoints within the floor's walkable x-range using the same linear interpolation logic as existing `PetActor`.
3. When reaching a waypoint, rolls for an ambient animation (`idle_sit` 30%, `idle_groom` 25%, `idle_sniff` 25%, `sleep` 10%, `react_happy` 10% if happiness ≥ 70) and plays it before picking the next waypoint.
4. Renders a static `shadow` sprite below the cat at 50% alpha.
5. Exposed method `setHappinessLevel(value: number)` that adjusts animation weights at runtime — below 30 happiness the `react_hungry` animation replaces `react_happy` in the pool.

**Acceptance criteria**:
- Dust Cat visible and moving in DomeScene when `dustCatUnlocked = true`
- Ambient animations play in correct proportions
- Wanderer does not leave floor bounds
- `setHappinessLevel()` changes behaviour without restarting the scene

---

### 37.2 — Feeding & Grooming Mini-Games

**Goal**: Add two 20–30-second tap mini-games accessible from the dome's Zoo room: **Feed** (tap falling food items) and **Groom** (swipe / tap dust clumps). Both increase the happiness meter. The happiness meter drives the DustCatWanderer animation weights (37.1.4) and unlocks the synergy bonus (37.4).

#### 37.2.1 — Happiness Decay Model

**File**: `src/ui/stores/playerData.ts` (modify)

Add a `tickDustCatHappiness()` function called once on app focus and once on app blur (via the existing `visibilitychange` handler in `saveService.ts`):

```typescript
/**
 * Decay Dust Cat happiness based on elapsed real time.
 * Rate: -2 per hour. Floor: 0. Ceil: 100.
 * Called on app focus and blur to avoid mid-session decay jumps.
 */
export function tickDustCatHappiness(): void {
  playerSave.update(s => {
    if (!s.dustCatUnlocked || s.dustCatHappiness === undefined) return s
    const now = Date.now()
    const lastDecay = s.dustCatLastDecayAt ?? now
    const elapsedHours = (now - lastDecay) / 3_600_000
    const decay = elapsedHours * 2  // 2 points per hour
    return {
      ...s,
      dustCatHappiness: Math.max(0, (s.dustCatHappiness ?? 100) - decay),
      dustCatLastDecayAt: now,
    }
  })
}
```

Also add `addDustCatHappiness(amount: number)` that clamps to [0, 100] and persists via `persistPlayer()`.

**Acceptance criteria**:
- `tickDustCatHappiness()` produces correct decay for a 2-hour gap (expect -4 points)
- `addDustCatHappiness(15)` at happiness 90 clamps to 100
- Happiness persists across saves (appears in `playerSave` snapshot)

#### 37.2.2 — Feed Mini-Game Component

**File**: `src/ui/components/PetFeedGame.svelte` (new)

A fullscreen Svelte overlay (pointer-events: auto, z-index 300) that:

1. Shows the Dust Cat sprite at centre-bottom using an `<img>` tag pointing to the walk sprite sheet (animated via CSS `steps()`).
2. Spawns 8 food items (small mineral icons: dust, shard, crystal based on player's current mineral stock) as absolutely-positioned `<button>` elements that fall from random x positions at top of the screen. Fall duration: 2.0 s CSS `animation`.
3. Player taps/clicks a food item before it leaves the screen to "catch" it — the button disappears and the cat plays a brief satisfied wiggle (CSS class swap).
4. Each caught item awards `+3` happiness (max 8 items = +24 happiness cap per session).
5. After 20 s the game ends regardless; tallies caught items, shows score text, and emits `dispatch('complete', { caught, happinessGained })`.
6. A cooldown of 60 minutes is stored in `playerSave.dustCatLastFed` (new optional field in `PlayerSave`). While on cooldown the Feed button in the Zoo room shows "Fed recently" and is disabled.

**Key Svelte template structure**:

```svelte
<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte'
  import { playerSave, addDustCatHappiness } from '../../ui/stores/playerData'
  import { persistPlayer } from '../../ui/stores/playerData'

  const dispatch = createEventDispatcher<{ complete: { caught: number; happinessGained: number } }>()

  let caught = 0
  let items: Array<{ id: number; x: number; mineral: string; alive: boolean }> = []
  let gameActive = false
  let endTimer: ReturnType<typeof setTimeout>

  function startGame() { /* spawn items, set timer */ }
  function catchItem(id: number) { /* remove item, increment caught, play wiggle */ }
  function endGame() {
    gameActive = false
    const happinessGained = caught * 3
    addDustCatHappiness(happinessGained)
    persistPlayer()
    playerSave.update(s => ({ ...s, dustCatLastFed: Date.now() }))
    dispatch('complete', { caught, happinessGained })
  }

  onMount(startGame)
  onDestroy(() => clearTimeout(endTimer))
</script>
```

**Acceptance criteria**:
- Food items fall at randomised x positions from top of screen
- Tapping a food item removes it and increments caught counter
- Game ends after 20 s if not all items caught
- `addDustCatHappiness()` called with correct total on end
- 60-minute cooldown stored; Feed button disabled while on cooldown
- No runtime TypeScript errors; component renders without crashing

#### 37.2.3 — Groom Mini-Game Component

**File**: `src/ui/components/PetGroomGame.svelte` (new)

A fullscreen Svelte overlay that:

1. Shows the Dust Cat at centre; 6–10 "dust clump" sprites (`<button>` elements styled as fuzzy circles, 40–60 px diameter) are scattered over the cat sprite.
2. Each tap/click on a dust clump plays a puff particle effect (CSS `@keyframes` scale + opacity out), removes the clump, and awards `+4` happiness.
3. All clumps cleared = bonus: `+8` extra happiness and the cat plays `react_excited` animation.
4. 25-second time limit. On end, dispatches `complete`.
5. Cooldown: 90 minutes stored in `playerSave.dustCatLastGroomed`.

**Acceptance criteria**:
- 6–10 dust clumps rendered at random positions over the cat
- Tap removes clump with CSS puff
- Bonus happiness awarded for clearing all clumps
- 90-minute cooldown respected
- Dispatches `complete` event with `{ cleared, happinessGained }`

#### 37.2.4 — Happiness Meter HUD Component

**File**: `src/ui/components/DustCatHappinessMeter.svelte` (new)

A small (120 × 16 px) bar shown in the Zoo room panel header. It reads `$playerSave.dustCatHappiness`, displays a filled progress bar with three colour zones (red 0–30, amber 31–60, green 61–100), and a small face emoji that changes by zone. Clicking it opens a tooltip: "Feed or groom your cat to keep happiness up. Low happiness reduces synergy bonuses."

**Acceptance criteria**:
- Bar width reflects `dustCatHappiness / 100`
- Colour zone transitions correct
- Tooltip text matches spec above

---

### 37.3 — Pet Personality Traits

**Goal**: At Dust Cat unlock, permanently assign two personality traits from a pool of 10. Traits give minor passive gameplay bonuses and change the cat's in-dome animation weights and GAIA commentary pool. The existing `petPersonalities.ts` has trait *types* stubbed; this sub-phase builds the full runtime system.

#### 37.3.1 — Trait Definitions

**File**: `src/data/petTraits.ts` (new)

```typescript
/**
 * petTraits.ts
 * Full definition of all Dust Cat personality traits. (DD-V2-042)
 * Each trait has a name, description, passive bonus, and
 * a modifier map for dome animation weights.
 */

export type TraitId =
  | 'playful'    // +3% quiz score bonus (curiosity keeps cat engaged)
  | 'curious'    // +1 extra fog-of-war reveal tile on entry per layer
  | 'loyal'      // +5 happiness restored per mine dive completed
  | 'stubborn'   // Happiness decays 25% slower (−1.5/hr instead of −2/hr)
  | 'timid'      // Cat reacts to hazard blocks; GAIA warns player 1 tick earlier
  | 'brave'      // Cat react_excited on boss floor entry; +2% block damage
  | 'lazy'       // Happiness minimum floor: 20 (cat never goes below 20)
  | 'energetic'  // +1 extra food item spawned in Feed mini-game (9 instead of 8)
  | 'scholar'    // +1 knowledge point per 5 facts reviewed while cat happiness >= 60
  | 'nocturnal'  // Happiness decays 50% slower during 22:00–06:00 local time

export interface PetTrait {
  id: TraitId
  name: string
  description: string
  /** Short label for the trait chip in the UI. */
  label: string
  /** Passive effect description shown in tooltip. */
  effectDescription: string
  /** Animation weight modifiers for DustCatWanderer. Keys = DustCatAmbientAnim. */
  animWeightMods: Partial<Record<string, number>>
  /** Colour used for the trait chip badge. */
  badgeColor: string
}

export const PET_TRAITS: Record<TraitId, PetTrait> = {
  playful: {
    id: 'playful',
    name: 'Playful',
    label: 'Playful',
    description: 'Always ready for a game. Turns learning into fun.',
    effectDescription: '+3% to quiz score bonus rewards',
    animWeightMods: { react_happy: 3, react_excited: 2, idle_groom: -1 },
    badgeColor: '#FF7043',
  },
  curious: {
    id: 'curious',
    name: 'Curious',
    label: 'Curious',
    description: 'Investigates every corner of the mine and dome alike.',
    effectDescription: '+1 fog-of-war reveal tile per layer entry',
    animWeightMods: { idle_sniff: 3, walk: 1 },
    badgeColor: '#29B6F6',
  },
  loyal: {
    id: 'loyal',
    name: 'Loyal',
    label: 'Loyal',
    description: 'Sticks close and celebrates every safe return.',
    effectDescription: '+5 happiness on mine return',
    animWeightMods: { react_happy: 2, idle_sit: 1 },
    badgeColor: '#66BB6A',
  },
  stubborn: {
    id: 'stubborn',
    name: 'Stubborn',
    label: 'Stubborn',
    description: 'Does things at its own pace. Prefers its own schedule.',
    effectDescription: 'Happiness decays 25% slower',
    animWeightMods: { sleep: 2, idle_sit: 2, walk: -1 },
    badgeColor: '#8D6E63',
  },
  timid: {
    id: 'timid',
    name: 'Timid',
    label: 'Timid',
    description: 'Startles easily, but that means it senses danger first.',
    effectDescription: 'GAIA hazard warning fires 1 tick earlier when cat is following',
    animWeightMods: { idle_sniff: 2, react_happy: -1 },
    badgeColor: '#AB47BC',
  },
  brave: {
    id: 'brave',
    name: 'Brave',
    label: 'Brave',
    description: 'Fearless in the face of the unknown.',
    effectDescription: '+2% block damage; plays excited anim on boss floors',
    animWeightMods: { react_excited: 3, walk: 2, sleep: -2 },
    badgeColor: '#EF5350',
  },
  lazy: {
    id: 'lazy',
    name: 'Lazy',
    label: 'Lazy',
    description: 'Content to nap anywhere. Hard to disappoint.',
    effectDescription: 'Happiness never drops below 20',
    animWeightMods: { sleep: 4, idle_sit: 2, walk: -2 },
    badgeColor: '#78909C',
  },
  energetic: {
    id: 'energetic',
    name: 'Energetic',
    label: 'Energetic',
    description: 'Boundless energy. Could run circles around the drill.',
    effectDescription: '+1 food item in Feed mini-game',
    animWeightMods: { walk: 3, react_excited: 2, sleep: -3 },
    badgeColor: '#FFCA28',
  },
  scholar: {
    id: 'scholar',
    name: 'Scholar',
    label: 'Scholar',
    description: 'Sits attentively during study sessions. Pays close attention.',
    effectDescription: '+1 knowledge point per 5 facts reviewed at happiness >= 60',
    animWeightMods: { idle_sit: 3, idle_groom: 1 },
    badgeColor: '#5C6BC0',
  },
  nocturnal: {
    id: 'nocturnal',
    name: 'Nocturnal',
    label: 'Nocturnal',
    description: 'Most alert after dark. Happiness barely fades at night.',
    effectDescription: 'Happiness decays 50% slower between 22:00–06:00 local time',
    animWeightMods: { sleep: -2, walk: 2, idle_sniff: 1 },
    badgeColor: '#26C6DA',
  },
}

/** All trait IDs as an ordered array for random selection. */
export const ALL_TRAIT_IDS: TraitId[] = Object.keys(PET_TRAITS) as TraitId[]

/**
 * Randomly assign two distinct trait IDs. Uses the provided seeded random if
 * given, otherwise Math.random(). (DD-V2-042: traits are permanent per save.)
 *
 * @param seed - Optional numeric seed for deterministic assignment.
 */
export function assignTraits(seed?: number): [TraitId, TraitId] {
  const rng = seed !== undefined
    ? (() => { let s = seed; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xFFFFFFFF } })()
    : Math.random.bind(Math)
  const pool = [...ALL_TRAIT_IDS]
  const idxA = Math.floor(rng() * pool.length)
  const [traitA] = pool.splice(idxA, 1)
  const idxB = Math.floor(rng() * pool.length)
  const traitB = pool[idxB]
  return [traitA, traitB]
}
```

**Acceptance criteria**:
- `assignTraits()` always returns two distinct trait IDs
- `assignTraits(42)` is deterministic (same result on every call with seed 42)
- All 10 trait definitions compile with no TypeScript errors

#### 37.3.2 — Trait Assignment at Dust Cat Unlock

**File**: `src/ui/stores/playerData.ts` (modify)

Add `unlockDustCat()` function:

```typescript
/**
 * Unlock the Dust Cat for this player. Assigns two permanent personality traits
 * using the player's ID as the random seed. (DD-V2-042)
 */
export function unlockDustCat(): void {
  playerSave.update(s => {
    if (s.dustCatUnlocked) return s  // idempotent
    const seed = parseInt(s.playerId.replace(/\D/g, '').slice(0, 8) || '42', 10)
    const [traitA, traitB] = assignTraits(seed)
    return {
      ...s,
      dustCatUnlocked: true,
      dustCatHappiness: 100,
      dustCatLastDecayAt: Date.now(),
      dustCatTraits: [traitA, traitB],
      dustCatCosmetics: {},
    }
  })
  persistPlayer()
}
```

Call `unlockDustCat()` from `GameManager.ts` after the player completes their first full dome tour (navigated to all unlocked rooms at least once). This check uses the existing `hubState.visitedRooms` or equivalent — add a `firstDomeTourComplete` boolean to `HubSaveState` in `hubLayout.ts` if not already present.

**Acceptance criteria**:
- `unlockDustCat()` is idempotent
- Traits are correctly stored in `playerSave.dustCatTraits`
- `dustCatHappiness` starts at 100
- `npm run typecheck` passes

#### 37.3.3 — Trait Effect Application

**File**: `src/game/managers/CompanionManager.ts` (modify)

Add a static `getDustCatBonuses(traits: TraitId[])` method that returns an object of active bonus flags:

```typescript
import type { TraitId } from '../../data/petTraits'
import { PET_TRAITS } from '../../data/petTraits'

export interface DustCatBonuses {
  quizScoreBonus: number         // from 'playful'
  extraRevealTile: boolean       // from 'curious'
  returnHappinessGain: number    // from 'loyal'
  decayRateMultiplier: number    // from 'stubborn' or 'nocturnal'
  hazardEarlyWarn: boolean       // from 'timid'
  blockDamageBonus: number       // from 'brave'
  happinessFloor: number         // from 'lazy'
  extraFeedItem: boolean         // from 'energetic'
  scholarKpBonus: boolean        // from 'scholar'
}

static getDustCatBonuses(traits: [TraitId, TraitId] | undefined): DustCatBonuses {
  const defaults: DustCatBonuses = {
    quizScoreBonus: 0, extraRevealTile: false, returnHappinessGain: 0,
    decayRateMultiplier: 1, hazardEarlyWarn: false, blockDamageBonus: 0,
    happinessFloor: 0, extraFeedItem: false, scholarKpBonus: false,
  }
  if (!traits) return defaults
  for (const id of traits) {
    if (id === 'playful') defaults.quizScoreBonus += 0.03
    if (id === 'curious') defaults.extraRevealTile = true
    if (id === 'loyal') defaults.returnHappinessGain += 5
    if (id === 'stubborn') defaults.decayRateMultiplier *= 0.75
    if (id === 'timid') defaults.hazardEarlyWarn = true
    if (id === 'brave') defaults.blockDamageBonus += 0.02
    if (id === 'lazy') defaults.happinessFloor = Math.max(defaults.happinessFloor, 20)
    if (id === 'energetic') defaults.extraFeedItem = true
    if (id === 'scholar') defaults.scholarKpBonus = true
    if (id === 'nocturnal') {
      const h = new Date().getHours()
      if (h >= 22 || h < 6) defaults.decayRateMultiplier *= 0.5
    }
  }
  return defaults
}
```

Integrate the bonuses in `GameManager.ts`:
- `quizScoreBonus`: add to `QuizManager.getScoreMultiplier()` (new method, returns 1.0 baseline)
- `extraRevealTile`: call `revealAround(x, y, radius + 1)` on layer entry in `MineScene`
- `returnHappinessGain`: call `addDustCatHappiness(n)` in `GameManager.onDiveComplete()`
- `blockDamageBonus`: add to existing `blockDamage` effect resolution in `MiningSystem.ts`
- `hazardEarlyWarn`: in `HazardSystem.ts`, fire GAIA warning when hazard is within 3 tiles instead of 2

**Acceptance criteria**:
- `getDustCatBonuses(['playful', 'brave'])` returns `{ quizScoreBonus: 0.03, blockDamageBonus: 0.02, ... }`
- `getDustCatBonuses(['stubborn', 'nocturnal'])` at 23:00 returns `decayRateMultiplier` approx 0.375
- Bonuses are applied in the mine when `dustCatUnlocked = true` and not applied when false

---

### 37.4 — Companion Synergy System

**Goal**: When the player takes a fossil companion on a dive **and** the Dust Cat's happiness is 60+, an additional "synergy bonus" activates based on the specific companion + Dust Cat trait combination. This rewards both pet maintenance (happiness) and intentional companion selection. The existing `COMPANION_SYNERGIES` array in `petPersonalities.ts` is expanded and wired into `CompanionManager`.

#### 37.4.1 — Synergy Data Expansion

**File**: `src/data/petPersonalities.ts` (modify)

Extend `CompanionSynergy` with a `dustCatTraitRequirement` field and add 10 new entries combining the 5 fossil companions with specific Dust Cat traits:

```typescript
export interface CompanionSynergy {
  companionA: string                    // fossil companion ID (e.g. 'comp_borebot')
  companionB: string                    // 'dust_cat' for Dust Cat synergies
  synergyName: string
  description: string
  /** Minimum Dust Cat happiness required (0 for non-Dust Cat synergies). */
  minHappiness: number
  /** TraitId that must be present in dustCatTraits, or null for any trait. */
  dustCatTraitRequired: string | null
  bonus: {
    type: 'mineral_bonus' | 'fact_bonus' | 'defense_bonus' | 'speed_bonus'
          | 'o2_bonus' | 'quiz_bonus' | 'xp_bonus'
    magnitude: number
  }
}
```

Add the following new synergy entries to `COMPANION_SYNERGIES`:

```typescript
// Dust Cat synergies (companionB = 'dust_cat')
{ companionA: 'comp_borebot', companionB: 'dust_cat', synergyName: 'Iron Paws',
  description: 'Borebot\'s drilling rhythm matches the cat\'s energetic pace: +8% mineral drops',
  minHappiness: 60, dustCatTraitRequired: 'energetic',
  bonus: { type: 'mineral_bonus', magnitude: 0.08 } },

{ companionA: 'comp_lumis', companionB: 'dust_cat', synergyName: 'Dark Explorer',
  description: 'Lumis lights the way; the curious cat finds more: +1 sonar pulse per layer',
  minHappiness: 60, dustCatTraitRequired: 'curious',
  bonus: { type: 'speed_bonus', magnitude: 0.10 } },

{ companionA: 'comp_medi', companionB: 'dust_cat', synergyName: 'Steady Presence',
  description: 'The loyal cat\'s calming aura amplifies Medi\'s regen: +4 O2 per layer',
  minHappiness: 60, dustCatTraitRequired: 'loyal',
  bonus: { type: 'o2_bonus', magnitude: 4 } },

{ companionA: 'comp_archivist', companionB: 'dust_cat', synergyName: 'Scholar\'s Circle',
  description: 'Cat and Archivist in perfect academic accord: +10% quiz XP',
  minHappiness: 60, dustCatTraitRequired: 'scholar',
  bonus: { type: 'quiz_bonus', magnitude: 0.10 } },

{ companionA: 'comp_carapace', companionB: 'dust_cat', synergyName: 'Fortified Bond',
  description: 'Brave cat + armored shell: lethal absorb triggers one extra time per dive',
  minHappiness: 60, dustCatTraitRequired: 'brave',
  bonus: { type: 'defense_bonus', magnitude: 1 } },

// Generic Dust Cat synergies (no trait requirement — only happiness threshold)
{ companionA: 'comp_borebot', companionB: 'dust_cat', synergyName: 'Happy Digger',
  description: 'A content cat inspires better drilling: +4% mineral drops',
  minHappiness: 80, dustCatTraitRequired: null,
  bonus: { type: 'mineral_bonus', magnitude: 0.04 } },

{ companionA: 'comp_lumis', companionB: 'dust_cat', synergyName: 'Warm Light',
  description: 'Happy cat makes tunnels feel safer: +5% move speed',
  minHappiness: 80, dustCatTraitRequired: null,
  bonus: { type: 'speed_bonus', magnitude: 0.05 } },

{ companionA: 'comp_medi', companionB: 'dust_cat', synergyName: 'Comfort Care',
  description: 'A happy cat reduces anxiety, boosting Medi\'s efficiency: +2 O2/layer',
  minHappiness: 80, dustCatTraitRequired: null,
  bonus: { type: 'o2_bonus', magnitude: 2 } },

{ companionA: 'comp_archivist', companionB: 'dust_cat', synergyName: 'Attentive Audience',
  description: 'The cat\'s rapt attention sharpens recall: +5% quiz XP',
  minHappiness: 80, dustCatTraitRequired: null,
  bonus: { type: 'quiz_bonus', magnitude: 0.05 } },

{ companionA: 'comp_carapace', companionB: 'dust_cat', synergyName: 'Shield of Affection',
  description: 'Even Carapace is inspired by the happy cat: +5% damage reduction',
  minHappiness: 80, dustCatTraitRequired: null,
  bonus: { type: 'defense_bonus', magnitude: 0.05 } },
```

Update `findSynergy()` to also match `'dust_cat'` as `companionB` and add a second parameter for happiness and trait:

```typescript
/**
 * Find active synergy between a fossil companion and the Dust Cat.
 * Returns the highest-magnitude applicable synergy, or null.
 *
 * @param companionId - The active fossil companion ID.
 * @param dustCatHappiness - Current Dust Cat happiness (0-100).
 * @param dustCatTraits - Assigned trait IDs for the Dust Cat.
 */
export function findDustCatSynergy(
  companionId: string,
  dustCatHappiness: number,
  dustCatTraits: [string, string] | undefined,
): CompanionSynergy | null {
  const eligible = COMPANION_SYNERGIES.filter(s =>
    s.companionB === 'dust_cat' &&
    s.companionA === companionId &&
    dustCatHappiness >= s.minHappiness &&
    (s.dustCatTraitRequired === null || dustCatTraits?.includes(s.dustCatTraitRequired))
  )
  if (eligible.length === 0) return null
  // Return the entry with highest magnitude
  return eligible.reduce((best, s) =>
    s.bonus.magnitude > best.bonus.magnitude ? s : best
  )
}
```

**Acceptance criteria**:
- `findDustCatSynergy('comp_archivist', 60, ['scholar', 'lazy'])` returns the Scholar's Circle synergy
- `findDustCatSynergy('comp_archivist', 59, ['scholar', 'lazy'])` returns the generic 'Attentive Audience' at happiness 80? No — happiness is 59, below both thresholds; returns null
- `findDustCatSynergy('comp_borebot', 85, ['energetic', 'playful'])` returns the higher-magnitude 'Iron Paws' (trait match) over 'Happy Digger' (generic)

#### 37.4.2 — Synergy Activation in GameManager

**File**: `src/game/GameManager.ts` (modify `startDive()`)

After building the companion effect, check for a Dust Cat synergy and store its bonus in `RunState` or as a local variable consumed by the relevant systems:

```typescript
// In startDive(), after setCompanion():
const save = get(playerSave)
const dustCatSynergy = (save.dustCatUnlocked && this.companionManager.getCompanionDef())
  ? findDustCatSynergy(
      this.companionManager.getCompanionDef()!.id,
      save.dustCatHappiness ?? 0,
      save.dustCatTraits,
    )
  : null
this.activeDustCatSynergy = dustCatSynergy
```

Expose `getActiveDustCatSynergy(): CompanionSynergy | null` and consume it in:
- `MiningSystem.ts` (`mineral_bonus` → multiply drop amount)
- `OxygenSystem.ts` (`o2_bonus` → add to layer descent regen)
- `QuizManager.ts` (`quiz_bonus` → multiply knowledge point award)
- `MineScene.ts` movement (`speed_bonus` → reduce movement O2 cost by magnitude)

**File**: `src/ui/stores/gameState.ts` (modify)

Add store:

```typescript
/** Active Dust Cat synergy during a dive, or null. */
export const activeDustCatSynergy = writable<import('../../data/petPersonalities').CompanionSynergy | null>(null)
```

Display the synergy name in the existing HUD's companion badge tooltip (extend `CompanionBadge.svelte` or equivalent).

**Acceptance criteria**:
- Active synergy name visible in HUD during dive when conditions are met
- Synergy does not activate when `dustCatHappiness < minHappiness`
- `mineral_bonus` synergy correctly increases mineral drop amounts
- `o2_bonus` synergy visible in layer transition O2 restoration log

---

### 37.5 — Legendary Evolution Path

**Goal**: Add a 4th evolution stage (stage 3, "Legendary") to all five fossil companions, gated behind 300 mastered facts and a Dust Cat happiness requirement (70+). This is the hardest evolution gate in the game and represents true long-term mastery.

#### 37.5.1 — Data Model Extension

**File**: `src/data/companions.ts` (modify)

Change `CompanionDefinition.evolutionPath` tuple type from length-3 to length-4:

```typescript
/** All four evolution stages (index 0-3). Index 3 is the Legendary stage. */
evolutionPath: [
  CompanionEvolutionStage,
  CompanionEvolutionStage,
  CompanionEvolutionStage,
  CompanionEvolutionStage,
]
```

Add stage 3 entry to each companion in `COMPANION_CATALOGUE`. Example for Borebot:

```typescript
{
  stage: 3,
  stageName: 'Legendary Drill',
  shardsRequired: 400,
  masteredFactsRequired: 300,
  dustCatHappinessRequired: 70,   // new field — see below
  affinityMagnitude: 0.70,
  secondaryEffect: {
    effectId: 'chainMine',
    magnitude: 3,
    description: 'Chain mine: breaking one block has 20% chance to break up to 3 adjacent blocks',
  },
  spriteKey: 'comp_borebot_3',
}
```

Add `dustCatHappinessRequired?: number` to `CompanionEvolutionStage`:

```typescript
export interface CompanionEvolutionStage {
  stage: number
  stageName: string
  shardsRequired: number
  masteredFactsRequired: number
  /** Minimum Dust Cat happiness required to unlock this stage. Undefined = no requirement. */
  dustCatHappinessRequired?: number
  affinityMagnitude: number
  secondaryEffect?: { effectId: string; magnitude: number; description: string }
  spriteKey: string
}
```

Add the Legendary stages for all 5 companions:

| Companion     | Legendary Stage Name  | shardsRequired | masteredFacts | dustCatHappiness | affinityMagnitude | Secondary Effect |
|---------------|-----------------------|---------------|---------------|------------------|-------------------|------------------|
| Borebot       | Legendary Drill       | 400            | 300           | 70               | 0.70              | Chain mine: 20% chance to break 3 adjacent blocks |
| Lumis         | Celestial Blazing     | 350            | 300           | 70               | 6                 | Reveal all artifact nodes on layer entry |
| Medikit Mk II | Apex Regeneration     | 450            | 300           | 70               | 2 (ticks)         | Revive twice per run (not once) |
| The Archivist | Omniscient Scholar    | 400            | 300           | 70               | 22                | Quiz correct always restores 5 extra O2 |
| Carapace      | Ancient Elder         | 500            | 300           | 70               | 0.50              | Absorb two lethal hits per layer + hazard quiz negation |

**Acceptance criteria**:
- All 5 companions have `evolutionPath` of length 4
- `npm run typecheck` passes
- Stage 3 entries reference valid sprite keys

#### 37.5.2 — Evolution Logic Update

**File**: `src/game/managers/CompanionManager.ts` (modify)

Update `canEvolve()` and `evolve()` to support stage 3:

```typescript
static canEvolve(
  state: CompanionState,
  masteredFactsCount: number,
  availableShards: number,
  dustCatHappiness: number,
): boolean {
  const def = COMPANION_CATALOGUE.find(c => c.id === state.companionId)
  if (!def) return false
  const nextStage = state.currentStage + 1
  if (nextStage > 3) return false
  const evolution = def.evolutionPath[nextStage]
  const happinessOk = evolution.dustCatHappinessRequired === undefined
    || dustCatHappiness >= evolution.dustCatHappinessRequired
  return (
    availableShards >= evolution.shardsRequired &&
    masteredFactsCount >= evolution.masteredFactsRequired &&
    happinessOk
  )
}
```

Update `evolve()` to accept `nextStage > 2` (remove the `>= 2` cap).

Update `getEffectiveStage()` cap from `Math.min(2, ...)` to `Math.min(3, ...)`.

**File**: `src/ui/components/HubView.svelte` (or wherever the evolution UI lives — modify)

Show the Legendary evolution option when stage 2 is complete. Display: "Requires 300 mastered facts + 70 Dust Cat happiness + 400 shards". If Dust Cat is not unlocked or happiness is too low, the button is greyed with tooltip "Your Dust Cat needs more care before this evolution is possible."

**Acceptance criteria**:
- `canEvolve()` returns false at happiness 69, true at happiness 70 (stage 3)
- Legendary evolution button shown only after stage 2 is reached
- Evolution completes correctly; `state.currentStage` becomes 3
- Stage 3 secondary effect is applied in mine via `getSecondaryEffect()`

#### 37.5.3 — Legendary Sprite Request Stubs

**File**: `src/game/spriteManifest.ts` (modify)

Add sprite key stubs for all 5 legendary stage sprites, flagged as `'placeholder'` until ComfyUI generation is run:

```typescript
// Legendary companion sprites (Phase 37.5)
comp_borebot_3:    { src: 'companions/comp_borebot_3.png',    status: 'placeholder' },
comp_lumis_3:      { src: 'companions/comp_lumis_3.png',      status: 'placeholder' },
comp_medi_3:       { src: 'companions/comp_medi_3.png',       status: 'placeholder' },
comp_archivist_3:  { src: 'companions/comp_archivist_3.png',  status: 'placeholder' },
comp_carapace_3:   { src: 'companions/comp_carapace_3.png',   status: 'placeholder' },
// Dust Cat sprites (Phase 37.1)
dust_cat_walk:          { src: 'pets/dust_cat_walk.png',          status: 'placeholder' },
dust_cat_idle_sit:      { src: 'pets/dust_cat_idle_sit.png',      status: 'placeholder' },
dust_cat_idle_groom:    { src: 'pets/dust_cat_idle_groom.png',    status: 'placeholder' },
dust_cat_idle_sniff:    { src: 'pets/dust_cat_idle_sniff.png',    status: 'placeholder' },
dust_cat_sleep:         { src: 'pets/dust_cat_sleep.png',         status: 'placeholder' },
dust_cat_react_happy:   { src: 'pets/dust_cat_react_happy.png',   status: 'placeholder' },
dust_cat_react_excited: { src: 'pets/dust_cat_react_excited.png', status: 'placeholder' },
dust_cat_react_hungry:  { src: 'pets/dust_cat_react_hungry.png',  status: 'placeholder' },
dust_cat_shadow:        { src: 'pets/dust_cat_shadow.png',        status: 'placeholder' },
```

**Acceptance criteria**:
- All placeholder keys referenced by DustCatFollower and DustCatWanderer are present in the manifest
- BootScene's placeholder fallback (solid colour rect) renders without crash when sprites are missing
- `npm run build` succeeds

---

### 37.6 — Pet Cosmetics

**Goal**: Add a wardrobe of hats, accessories, and colour palette swaps for the Dust Cat. Cosmetics are earned through gameplay (milestones, seasonal events, duel wins) and equipped from the Zoo room. They render on top of the Dust Cat sprite in both the dome and the mine.

#### 37.6.1 — Cosmetic Data

**File**: `src/data/dustCatCosmetics.ts` (new)

```typescript
/**
 * dustCatCosmetics.ts
 * Wardrobe items for the Dust Cat permanent pet. (DD-V2-040)
 */

export type DustCatCosmeticSlot = 'hat' | 'accessory' | 'color'

export interface DustCatCosmetic {
  id: string
  slot: DustCatCosmeticSlot
  name: string
  description: string
  /** Sprite overlay key (hat/accessory) or CSS filter string (color). */
  spriteKey?: string
  colorFilter?: string   // CSS filter, e.g. 'hue-rotate(180deg)'
  /** How this cosmetic is unlocked. */
  unlockMethod: 'milestone' | 'duel_win' | 'season' | 'shop' | 'starter'
  /** Specific unlock condition description. */
  unlockDescription: string
  /** Mineral cost if unlockMethod is 'shop'. */
  shopCost?: Partial<Record<string, number>>
}

export const DUST_CAT_COSMETICS: DustCatCosmetic[] = [
  // Hats
  {
    id: 'hat_none', slot: 'hat', name: 'No Hat', description: 'Just the cat.',
    unlockMethod: 'starter', unlockDescription: 'Default',
  },
  {
    id: 'hat_miner_helmet', slot: 'hat', name: 'Miner Helmet',
    description: 'A tiny hard hat that matches yours.',
    spriteKey: 'cat_hat_miner_helmet',
    unlockMethod: 'milestone', unlockDescription: 'Complete 10 dives',
  },
  {
    id: 'hat_wizard', slot: 'hat', name: 'Wizard Hat',
    description: 'Points skyward with mysterious authority.',
    spriteKey: 'cat_hat_wizard',
    unlockMethod: 'milestone', unlockDescription: 'Master 50 facts',
  },
  {
    id: 'hat_crown', slot: 'hat', name: 'Crystal Crown',
    description: 'For the cat who rules the dome.',
    spriteKey: 'cat_hat_crown',
    unlockMethod: 'shop', unlockDescription: 'Purchase from shop',
    shopCost: { crystal: 5, geode: 1 },
  },
  {
    id: 'hat_expedition', slot: 'hat', name: 'Expedition Cap',
    description: 'For veteran explorers. And their cats.',
    spriteKey: 'cat_hat_expedition',
    unlockMethod: 'season', unlockDescription: 'Season 1 reward',
  },
  // Accessories
  {
    id: 'acc_none', slot: 'accessory', name: 'No Accessory', description: 'Clean look.',
    unlockMethod: 'starter', unlockDescription: 'Default',
  },
  {
    id: 'acc_bowtie', slot: 'accessory', name: 'Bowtie',
    description: 'Dapper. Irresistible.',
    spriteKey: 'cat_acc_bowtie',
    unlockMethod: 'shop', unlockDescription: 'Purchase from shop',
    shopCost: { shard: 30 },
  },
  {
    id: 'acc_bandana', slot: 'accessory', name: 'Dust Bandana',
    description: 'Protection from the grit below.',
    spriteKey: 'cat_acc_bandana',
    unlockMethod: 'milestone', unlockDescription: 'Mine 500 blocks total',
  },
  {
    id: 'acc_scarf', slot: 'accessory', name: 'Crystal Scarf',
    description: 'Hand-woven from crystalline threads.',
    spriteKey: 'cat_acc_scarf',
    unlockMethod: 'duel_win', unlockDescription: 'Win 5 knowledge duels',
  },
  {
    id: 'acc_badge', slot: 'accessory', name: 'Scholar Badge',
    description: 'Awarded for academic distinction.',
    spriteKey: 'cat_acc_badge',
    unlockMethod: 'milestone', unlockDescription: 'Master 100 facts',
  },
  // Colour variations
  {
    id: 'color_default', slot: 'color', name: 'Dust Grey',
    description: 'The natural colour of a deep-earth cat.',
    unlockMethod: 'starter', unlockDescription: 'Default',
  },
  {
    id: 'color_obsidian', slot: 'color', name: 'Obsidian Black',
    description: 'Deep black, like the void biome.',
    colorFilter: 'brightness(0.3) contrast(1.2)',
    unlockMethod: 'milestone', unlockDescription: 'Reach layer 20',
  },
  {
    id: 'color_crystal_blue', slot: 'color', name: 'Crystal Blue',
    description: 'Luminescent, like a geode at depth.',
    colorFilter: 'hue-rotate(200deg) saturate(1.8)',
    unlockMethod: 'shop', unlockDescription: 'Purchase from shop',
    shopCost: { crystal: 8 },
  },
  {
    id: 'color_lava_orange', slot: 'color', name: 'Lava Orange',
    description: 'Warm as the magma biome.',
    colorFilter: 'hue-rotate(25deg) saturate(2)',
    unlockMethod: 'season', unlockDescription: 'Season 2 reward',
  },
  {
    id: 'color_void_purple', slot: 'color', name: 'Void Purple',
    description: 'A rare aberration found in the anomaly biomes.',
    colorFilter: 'hue-rotate(270deg) saturate(1.5)',
    unlockMethod: 'duel_win', unlockDescription: 'Win 20 knowledge duels',
  },
]

/** Find a Dust Cat cosmetic by ID. */
export function getDustCatCosmetic(id: string): DustCatCosmetic | undefined {
  return DUST_CAT_COSMETICS.find(c => c.id === id)
}

/** Get all cosmetics for a given slot. */
export function getDustCatCosmeticsBySlot(slot: DustCatCosmeticSlot): DustCatCosmetic[] {
  return DUST_CAT_COSMETICS.filter(c => c.slot === slot)
}

/** Check if a player owns a cosmetic (by examining playerSave). */
export function playerOwnsDustCatCosmetic(
  cosmeticId: string,
  ownedCosmetics: string[],
): boolean {
  const item = getDustCatCosmetic(cosmeticId)
  if (!item) return false
  if (item.unlockMethod === 'starter') return true
  return ownedCosmetics.includes(cosmeticId)
}
```

**Acceptance criteria**:
- 15 cosmetics defined (5 hats, 5 accessories, 5 colour variations)
- `getDustCatCosmeticsBySlot('hat')` returns exactly 5 entries
- Starter cosmetics always owned (no lock check needed)

#### 37.6.2 — Cosmetic Equip Logic

**File**: `src/ui/stores/playerData.ts` (modify)

Add `equipDustCatCosmetic(slot: DustCatCosmeticSlot, cosmeticId: string)`:

```typescript
/**
 * Equip a Dust Cat cosmetic. Only applies if player owns it.
 *
 * @param slot - 'hat' | 'accessory' | 'color'
 * @param cosmeticId - The cosmetic ID to equip.
 */
export function equipDustCatCosmetic(slot: string, cosmeticId: string): void {
  playerSave.update(s => {
    const owned = playerOwnsDustCatCosmetic(cosmeticId, s.ownedCosmetics)
    if (!owned) return s
    return {
      ...s,
      dustCatCosmetics: { ...(s.dustCatCosmetics ?? {}), [slot]: cosmeticId },
    }
  })
  persistPlayer()
}
```

Add `unlockDustCatCosmetic(cosmeticId: string)` that adds to `playerSave.ownedCosmetics` (reusing the existing array):

```typescript
export function unlockDustCatCosmetic(cosmeticId: string): void {
  playerSave.update(s => {
    if (s.ownedCosmetics.includes(cosmeticId)) return s
    return { ...s, ownedCosmetics: [...s.ownedCosmetics, cosmeticId] }
  })
  persistPlayer()
}
```

#### 37.6.3 — Cosmetic Wardrobe UI

**File**: `src/ui/components/DustCatWardrobe.svelte` (new)

A panel displayed in the Zoo room, opened by tapping the Dust Cat. Layout:
- Three columns: Hats, Accessories, Colours.
- Each column shows a vertical list of cosmetic items; locked items are shown greyed with a lock icon and unlock description.
- Tapping an owned item equips it and calls `equipDustCatCosmetic()`.
- A preview section shows the Dust Cat sprite with currently equipped cosmetics applied (CSS filter for colour; absolute-positioned overlay `<img>` for hat/accessory).
- A "Close" button dismisses the panel.

```svelte
<script lang="ts">
  import { playerSave } from '../../ui/stores/playerData'
  import { equipDustCatCosmetic } from '../../ui/stores/playerData'
  import { getDustCatCosmeticsBySlot, playerOwnsDustCatCosmetic } from '../../data/dustCatCosmetics'
  import type { DustCatCosmeticSlot } from '../../data/dustCatCosmetics'

  export let onClose: () => void = () => {}

  const slots: DustCatCosmeticSlot[] = ['hat', 'accessory', 'color']
  $: equipped = $playerSave.dustCatCosmetics ?? {}
  $: ownedCosmetics = $playerSave.ownedCosmetics ?? []

  function equip(slot: DustCatCosmeticSlot, id: string) {
    equipDustCatCosmetic(slot, id)
  }
</script>
```

**Acceptance criteria**:
- Wardrobe shows 3 columns of cosmetics
- Locked items are visually distinct from owned items
- Equipping updates the preview immediately (reactive Svelte store)
- Close button dismisses panel
- No TypeScript errors

#### 37.6.4 — Cosmetic Rendering in Phaser (DomeScene)

**File**: `src/game/scenes/DomeScene.ts` (modify `DustCatWanderer`)

When the DustCatWanderer is initialised, read `playerSave.dustCatCosmetics` and:
1. If a hat cosmetic with `spriteKey` is equipped: create a second `Phaser.GameObjects.Sprite` at `depth + 1`, follow the cat position with y offset `-8 px` to sit on top of the head.
2. If an accessory cosmetic with `spriteKey` is equipped: same pattern, offset depends on slot (bowtie: y + 8; bandana: y + 4; etc.).
3. If a colour cosmetic with `colorFilter` is equipped: apply `cat.setTint(tintFromFilter(colorFilter))` where `tintFromFilter` maps common filter strings to approximate Phaser integer tints.

```typescript
/** Approximate tint mapping from CSS filter presets to Phaser tint integers. */
const COLOR_FILTER_TINTS: Record<string, number> = {
  'brightness(0.3) contrast(1.2)':    0x222222,  // Obsidian Black
  'hue-rotate(200deg) saturate(1.8)': 0x3399FF,  // Crystal Blue
  'hue-rotate(25deg) saturate(2)':    0xFF8800,  // Lava Orange
  'hue-rotate(270deg) saturate(1.5)': 0xAA44FF,  // Void Purple
}
```

**Acceptance criteria**:
- Hat overlay sprite tracks the Dust Cat position correctly during walking
- Colour tint changes when `dustCatCosmetics.color` is changed and DomeScene re-initialised
- No z-order conflict between hat overlay and floor objects

---

## Playwright Test Scripts

### Test 37-A: Dust Cat Unlock and Mine Follow

```javascript
// /tmp/test-37a-dustcat.js
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

  // Inject: unlock Dust Cat via console
  await page.evaluate(() => {
    const mod = window.__svelte_stores__ // adjust to actual store export path
    // Force unlock via playerSave update
    document.dispatchEvent(new CustomEvent('test:unlock-dust-cat'))
  })
  await page.waitForTimeout(500)

  // Enter the mine
  await page.click('button:has-text("Dive")')
  await page.waitForSelector('button:has-text("Enter Mine")', { timeout: 8000 })
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)

  // Screenshot: mine with Dust Cat follower
  await page.screenshot({ path: '/tmp/test-37a-mine.png' })
  console.log('37-A: mine screenshot saved to /tmp/test-37a-mine.png')

  await browser.close()
})()
```

### Test 37-B: Feeding Mini-Game

```javascript
// /tmp/test-37b-feed.js
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

  // Navigate to Zoo room (assume dome is accessible)
  // This test is illustrative — adjust selectors to actual UI
  await page.click('[data-room="zoo"]').catch(() => {})
  await page.waitForTimeout(1000)

  // Open feed game
  await page.click('button:has-text("Feed")').catch(() => {})
  await page.waitForSelector('.pet-feed-game', { timeout: 5000 }).catch(() => {})
  await page.screenshot({ path: '/tmp/test-37b-feed-open.png' })

  // Click 3 food items
  const items = await page.$$('.food-item')
  for (let i = 0; i < Math.min(3, items.length); i++) {
    await items[i].click()
    await page.waitForTimeout(200)
  }
  await page.screenshot({ path: '/tmp/test-37b-feed-progress.png' })

  // Wait for game end (20s or all items caught)
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/test-37b-feed-end.png' })
  console.log('37-B: screenshots saved to /tmp/test-37b-feed-*.png')

  await browser.close()
})()
```

### Test 37-C: Personality Traits Display

```javascript
// /tmp/test-37c-traits.js
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

  // Inject assigned traits
  await page.evaluate(() => {
    document.dispatchEvent(new CustomEvent('test:set-dust-cat-traits',
      { detail: { traits: ['playful', 'scholar'] } }))
  })
  await page.waitForTimeout(500)

  // Navigate to Zoo room and open wardrobe
  await page.click('[data-room="zoo"]').catch(() => {})
  await page.waitForTimeout(1000)
  await page.screenshot({ path: '/tmp/test-37c-traits.png' })
  console.log('37-C: traits screenshot saved')

  await browser.close()
})()
```

### Test 37-D: Legendary Evolution Button

```javascript
// /tmp/test-37d-legendary.js
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

  // Inject: set companion to stage 2, happiness to 75
  await page.evaluate(() => {
    document.dispatchEvent(new CustomEvent('test:set-legendary-prereqs', {
      detail: { companionId: 'comp_borebot', stage: 2, happiness: 75, masteredFacts: 300 }
    }))
  })
  await page.waitForTimeout(500)

  // Navigate to companion view
  await page.screenshot({ path: '/tmp/test-37d-legendary-prereq.png' })
  console.log('37-D: screenshot saved — check for Legendary button')

  await browser.close()
})()
```

---

## Verification Gate

The following checklist **must pass completely** before Phase 37 is marked complete.

### TypeScript & Build

- [ ] `npm run typecheck` exits with 0 errors after all sub-phases are applied
- [ ] `npm run build` completes with no errors (chunk size warnings are acceptable)
- [ ] No `any` types introduced in new files except where unavoidable with proper `// eslint-disable-next-line` comment

### Unit Logic Verification

- [ ] `assignTraits(42)` is deterministic — run twice, get same two trait IDs
- [ ] `assignTraits()` never returns duplicate trait IDs
- [ ] `CompanionManager.canEvolve(state, 299, 400, 70)` at stage 2 returns `false` (facts < 300)
- [ ] `CompanionManager.canEvolve(state, 300, 400, 70)` at stage 2 returns `true`
- [ ] `CompanionManager.canEvolve(state, 300, 400, 69)` at stage 2 returns `false` (happiness too low)
- [ ] `findDustCatSynergy('comp_archivist', 60, ['scholar', 'lazy'])` returns non-null synergy
- [ ] `findDustCatSynergy('comp_archivist', 59, ['scholar', 'lazy'])` returns `null`
- [ ] `tickDustCatHappiness()` decays by exactly 4 after a 2-hour gap
- [ ] `addDustCatHappiness(50)` at happiness 70 results in 100, not 120

### Functional Behaviour

- [ ] Dust Cat sprite appears in MineScene when `dustCatUnlocked = true` (Playwright screenshot confirms)
- [ ] Dust Cat does not appear in MineScene when `dustCatUnlocked = false`
- [ ] Feed mini-game opens from Zoo room, food items fall, tapping them removes them
- [ ] Feed mini-game ends after 20 s even if items remain
- [ ] Groom mini-game opens, dust clumps respond to tap with CSS puff, clears and awards bonus happiness
- [ ] Happiness meter in Zoo room reflects real-time `dustCatHappiness` store value
- [ ] Legendary evolution button visible in companion UI when stage 2 + prerequisites met
- [ ] Legendary evolution button greyed/disabled when happiness < 70
- [ ] Wardrobe panel opens from Zoo room, shows 3 columns with correct item counts
- [ ] Equipping a cosmetic updates the preview immediately
- [ ] Active Dust Cat synergy name appears in dive HUD when conditions are met
- [ ] Synergy does not appear when happiness < `minHappiness`

### Visual Check (Playwright screenshots)

- [ ] `test-37a-mine.png` shows Dust Cat sprite trailing the miner
- [ ] `test-37b-feed-open.png` shows falling food items over Dust Cat
- [ ] `test-37c-traits.png` shows two trait chips in Zoo room panel
- [ ] `test-37d-legendary-prereq.png` shows Legendary button (not greyed)

### Save/Load Persistence

- [ ] `dustCatUnlocked`, `dustCatHappiness`, `dustCatTraits`, `dustCatCosmetics` all persist through save/load cycle
- [ ] `companionLegendaryStages` persists through save/load cycle
- [ ] Happiness decay resumes correctly after app is closed and reopened (decay is time-based, not session-based)

### Performance

- [ ] Dust Cat follower in MineScene does not increase frame time by more than 2 ms on a 60 Hz baseline
- [ ] DustCatWanderer in DomeScene does not increase particle count above the 50-particle cap (cat is not a particle)
- [ ] Mini-game overlays have no memory leaks — all intervals/timeouts cleared in `onDestroy`

---

## Files Affected

### New Files

| File | Description |
|------|-------------|
| `src/data/dustCat.ts` | Dust Cat static config, sprite keys, mine/dome behaviour constants |
| `src/data/petTraits.ts` | 10 personality trait definitions, `assignTraits()` function |
| `src/data/dustCatCosmetics.ts` | 15 cosmetic definitions (hats, accessories, colours), equip helpers |
| `src/ui/components/PetFeedGame.svelte` | Falling-food tap mini-game for Dust Cat feeding |
| `src/ui/components/PetGroomGame.svelte` | Dust-clump tap mini-game for Dust Cat grooming |
| `src/ui/components/DustCatHappinessMeter.svelte` | Happiness bar widget for Zoo room panel |
| `src/ui/components/DustCatWardrobe.svelte` | Cosmetic equip panel opened from Zoo room |

### Modified Files

| File | Changes |
|------|---------|
| `src/data/types.ts` | Add 6 Dust Cat fields to `PlayerSave`; add `dustCatLastFed`, `dustCatLastGroomed` |
| `src/data/companions.ts` | Extend `CompanionEvolutionStage` with `dustCatHappinessRequired?`; add stage 3 to all 5 companions; change tuple type to length 4 |
| `src/data/petAnimations.ts` | Add `dust_cat` entry to `PET_ANIMATIONS`; export `DUST_CAT_ANIM_WEIGHTS` default table |
| `src/data/petPersonalities.ts` | Extend `CompanionSynergy` with `minHappiness` and `dustCatTraitRequired`; add 10 Dust Cat synergy entries; update `findSynergy()` and add `findDustCatSynergy()` |
| `src/data/gaiaDialogue.ts` | Add `dustCatPetComment` trigger pool (8 lines × 3 moods for Dust Cat specifically) |
| `src/game/managers/CompanionManager.ts` | Update `canEvolve()` to accept `dustCatHappiness`; update `evolve()` for stage 3; add `getDustCatBonuses()` static method; `getEffectiveStage()` cap → 3; add `getActiveDustCatSynergy()` |
| `src/game/GameManager.ts` | Call `tickDustCatHappiness()` on dive complete; apply trait bonuses from `getDustCatBonuses()`; compute and store `activeDustCatSynergy` at dive start; call `unlockDustCat()` after first dome tour |
| `src/game/scenes/MineScene.ts` | Add `DustCatFollower` inner class: follow position, animation FSM, block-mine reaction, layer-descent reaction |
| `src/game/scenes/DomeScene.ts` | Add `DustCatWanderer` inner class: waypoint patrol, ambient animation weights, cosmetic overlays, `setHappinessLevel()` |
| `src/game/managers/GaiaManager.ts` | Add `getPetComment('dust_cat', mood)` support; fire thought bubble on Dust Cat layer descent |
| `src/game/systems/MiningSystem.ts` | Apply `blockDamageBonus` from `getDustCatBonuses()` |
| `src/game/systems/OxygenSystem.ts` | Apply `o2_bonus` from `activeDustCatSynergy` on layer regen |
| `src/game/systems/HazardSystem.ts` | Apply `hazardEarlyWarn` from `getDustCatBonuses()` (fire warning at 3 tiles instead of 2) |
| `src/game/managers/QuizManager.ts` | Apply `quizScoreBonus` from `getDustCatBonuses()`; apply `quiz_bonus` from `activeDustCatSynergy` |
| `src/game/managers/SaveManager.ts` | Include `dustCatLastFed`, `dustCatLastGroomed` in auto-save snapshot |
| `src/game/spriteManifest.ts` | Add placeholder entries for 9 Dust Cat sprites and 5 legendary companion sprites |
| `src/ui/stores/playerData.ts` | Add `tickDustCatHappiness()`, `addDustCatHappiness()`, `unlockDustCat()`, `equipDustCatCosmetic()`, `unlockDustCatCosmetic()` |
| `src/ui/stores/gameState.ts` | Add `activeDustCatSynergy` writable store |
| `src/services/saveService.ts` | Include `dustCatLastDecayAt` in visibility-change decay call; call `tickDustCatHappiness()` on `visibilitychange` |
| `src/data/hubLayout.ts` | Add `firstDomeTourComplete?: boolean` to `HubSaveState` (used by unlock trigger) |
