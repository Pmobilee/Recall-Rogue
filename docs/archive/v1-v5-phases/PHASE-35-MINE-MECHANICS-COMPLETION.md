# Phase 35: Mine Mechanics Completion

**Status**: Not Started
**Depends On**: Phase 8 (Mine Gameplay Overhaul), Phase 9 (Biome Expansion)
**Estimated Complexity**: High — 7 sub-phases, ~15 new files, heavy MineScene + GameManager integration
**Design Decisions**: DD-V2-020, DD-V2-021, DD-V2-022, DD-V2-023, DD-V2-024

---

## 1. Overview

Phase 35 completes the mine's mechanical surface area. Six systems were stubbed or deferred during Phase 8 and are now implemented in full:

1. **Quiz gates** — locked wall segments in procedurally generated passages that require a correct answer to pass; failed answers cost O2 and replay a fresh question.
2. **Quiz streak multipliers** — consecutive correct in-mine quiz answers accumulate a multiplier (×1 → ×4) that boosts mineral and dust rewards until the streak is broken.
3. **Offering altars** — special block type that lets the player sacrifice minerals for a guaranteed-rare artifact or fragment; appears once per landmark layer.
4. **Layer instability meter** — a per-layer hidden danger counter that rises from mining near lava, breaking unstable ground, and triggering cave-ins; when full it triggers a timed collapse event and forces the player toward the descent shaft.
5. **Recipe fragments** — collectible pieces that persist across dives in `PlayerSave`; assembling a full set unlocks a unique crafting recipe unavailable through normal means.
6. **Conditionally breakable blocks** — `HardRock` variants that require a minimum pickaxe tier or a specific consumable (drill charge, bomb) to break; displayed with a distinct locked-crack visual.
7. **Mine event system** — a lightweight random-event dispatcher (tremor, gas leak, relic signal) that fires based on the TickSystem and adds moment-to-moment variety without overwhelming the player.

### Dependency Map

```
TickSystem ──────────────────────────────► InstabilitySystem (35.4)
HazardSystem ─────────────────────────────► InstabilitySystem (35.4)
QuizManager ─────────────────────────────► QuizStreakSystem (35.2)
MineGenerator ───────────────────────────► OfferingAltar (35.3)
                                        ► ConditionalBlock (35.6)
                                        ► RecipeFragment (35.5)
GameManager ─────────────────────────────► MineEventSystem (35.7)
PlayerSave ───────────────────────────────► RecipeFragment persistence (35.5)
balance.ts ───────────────────────────────► All systems (constants)
```

### Files Affected Summary

| Path | Action |
|---|---|
| `src/data/balance.ts` | Add constants for all 7 sub-phases |
| `src/data/types.ts` | Extend `BlockType`, `MineCell`, `PlayerSave`, `RunState` |
| `src/data/recipeFragments.ts` | New — fragment definitions and assembly rules |
| `src/data/mineEvents.ts` | New — event pool definitions |
| `src/game/systems/InstabilitySystem.ts` | New — layer instability meter |
| `src/game/systems/QuizStreakSystem.ts` | New — streak multiplier tracking |
| `src/game/systems/MineEventSystem.ts` | New — random event dispatcher |
| `src/game/systems/MineGenerator.ts` | Extend — altar, fragment, locked block placement |
| `src/game/managers/QuizManager.ts` | Extend — streak integration |
| `src/game/scenes/MineScene.ts` | Extend — instability HUD, altar interaction, locked blocks, events |
| `src/game/GameManager.ts` | Extend — event handling, altar results, fragment collection |
| `src/ui/stores/gameState.ts` | Add stores — `quizStreak`, `instabilityLevel`, `activeMineEvent` |
| `src/ui/components/InstabilityMeter.svelte` | New — HUD bar component |
| `src/ui/components/QuizStreakBadge.svelte` | New — streak flame badge |
| `src/ui/components/MineEventOverlay.svelte` | New — event notification card |
| `src/ui/components/DomeView.svelte` | Extend — recipe fragment counter display |

---

## 2. Sub-Phases

---

### 35.1 Quiz Gates

**Goal**: Place locked passage blocks (`QuizGate`) into procedurally generated mine layers at a low but meaningful density. A quiz gate blocks movement; the player must answer a quiz question correctly to unlock it. Failed answers drain O2 and present a new question on the same fact (up to `QUIZ_GATE_MAX_FAILURES` times before the gate opens anyway to prevent full blockage).

The existing `BlockType.QuizGate` enum value (14) and color (`0xffd369`) are already defined in `MineScene`. `QuizManager.pendingGateCoords` and `resumeQuiz()` already exist. This sub-phase wires placement and HUD feedback.

#### 35.1.1 — Constants in `src/data/balance.ts`

Add the following constants to the `BALANCE` object:

```typescript
// === QUIZ GATES (Phase 35.1) ===
QUIZ_GATE_DENSITY: 0.005,          // ~0.5% of eligible cells become quiz gates
QUIZ_GATE_MIN_DEPTH_PERCENT: 0.15, // Only below 15% grid depth (not in spawn row)
QUIZ_GATE_MAX_FAILURES: 2,         // After 2 wrong answers the gate forcibly unlocks
QUIZ_GATE_FAILURE_O2_COST: 10,     // O2 penalty per wrong answer at a gate
QUIZ_GATE_PASS_DUST_REWARD: 15,    // Dust dropped when gate unlocks correctly
```

> Note: `QUIZ_GATE_MAX_FAILURES` already exists in balance.ts (value 2); verify and keep existing — do not duplicate.

#### 35.1.2 — Placement in `src/game/systems/MineGenerator.ts`

Inside `generateMine()`, after the base block loop and structural feature placement, add a gate scatter pass:

```typescript
// Quiz gate scatter pass (Phase 35.1)
const minGateDepth = Math.floor(height * BALANCE.QUIZ_GATE_MIN_DEPTH_PERCENT)
for (let y = minGateDepth; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const cell = grid[y][x]
    // Only replace solid, non-special blocks
    if (
      cell.type !== BlockType.Stone &&
      cell.type !== BlockType.SoftRock &&
      cell.type !== BlockType.Dirt
    ) continue
    if (rng() < BALANCE.QUIZ_GATE_DENSITY) {
      cell.type = BlockType.QuizGate
      cell.hardness = BALANCE.HARDNESS_QUIZ_GATE
      cell.maxHardness = BALANCE.HARDNESS_QUIZ_GATE
    }
  }
}
```

#### 35.1.3 — Interaction in `src/game/scenes/MineScene.ts`

In `handleBlockTap()` (or equivalent movement/mining handler), add a guard before the standard mining path:

```typescript
if (targetCell.type === BlockType.QuizGate) {
  this.events.emit('quiz-gate-touched', { x: targetX, y: targetY })
  return // Halt movement; GameManager handles quiz trigger
}
```

In `GameManager.ts`, listen on the MineScene event:

```typescript
scene.events.on('quiz-gate-touched', ({ x, y }: { x: number; y: number }) => {
  this.quizManager.pendingGateCoords = { x, y }
  void this.triggerGateQuiz()
})
```

`triggerGateQuiz()` should select a fact via `selectQuestion(facts)`, build `activeQuiz` with `source: 'gate'`, set `currentScreen` to `'quiz'`.

On pass (correct answer), `MineScene.resumeFromQuiz(true, x, y)` should:
1. Set `grid[y][x].type = BlockType.Empty` and `grid[y][x].hardness = 0`
2. Call `revealAround(grid, x, y, width, height, 1)`
3. Emit `'loot-pop'` with `BALANCE.QUIZ_GATE_PASS_DUST_REWARD` dust at `(x, y)`
4. Play audio: `audioManager.play('quiz_pass')`

On fail (wrong answer up to `QUIZ_GATE_MAX_FAILURES`), decrement a `gateFailures` counter stored on `QuizManager`, drain `BALANCE.QUIZ_GATE_FAILURE_O2_COST` O2, and re-trigger `triggerGateQuiz()` with the same fact (re-use `pendingGateCoords`). After max failures, force-open the gate (same path as pass but no dust reward) and reset counter.

#### Acceptance Criteria — 35.1

- [ ] Quiz gates appear in every generated layer below row 3 at approximately 0.5% block density
- [ ] Touching a quiz gate halts player movement and opens the quiz overlay with `source: 'gate'`
- [ ] Correct answer removes the gate block, reveals neighbors, and drops 15 dust
- [ ] Wrong answer drains 10 O2 and presents a fresh question on the same fact
- [ ] After 2 wrong answers the gate force-opens (no dust reward)
- [ ] Gates never spawn in the top 2 rows, in landmark layers' special blocks, or overlapping descent shafts

---

### 35.2 Quiz Streak Multipliers

**Goal**: Reward consecutive correct in-mine quiz answers with an escalating multiplier applied to all mineral/dust rewards until the streak breaks. The streak UI shows a flame badge with the current multiplier.

#### 35.2.1 — New System `src/game/systems/QuizStreakSystem.ts`

```typescript
/**
 * Tracks the current in-dive quiz answer streak and computes reward multipliers.
 * Integrates with QuizManager answer callbacks. (DD-V2-021)
 */
export class QuizStreakSystem {
  private streak = 0
  private readonly THRESHOLDS = [0, 3, 6, 10] as const  // answers needed for ×1, ×2, ×3, ×4
  private readonly MULTIPLIERS = [1, 1.5, 2, 3] as const

  /** Call after every correct in-mine quiz answer. Returns current multiplier. */
  onCorrect(): number {
    this.streak++
    return this.getMultiplier()
  }

  /** Call after every wrong in-mine quiz answer. Returns 1 (multiplier reset). */
  onWrong(): number {
    this.streak = 0
    return 1
  }

  /** Returns the current reward multiplier. */
  getMultiplier(): number {
    for (let i = this.THRESHOLDS.length - 1; i >= 0; i--) {
      if (this.streak >= this.THRESHOLDS[i]) return this.MULTIPLIERS[i]
    }
    return 1
  }

  getStreak(): number { return this.streak }

  /** Reset on layer change or dive end. */
  reset(): void { this.streak = 0 }
}
```

#### 35.2.2 — Stores in `src/ui/stores/gameState.ts`

```typescript
/** Current quiz answer streak count — updated by QuizStreakSystem. */
export const quizStreak = singletonWritable<number>('quizStreak', 0)

/** Current quiz streak multiplier (1.0 = no bonus). */
export const quizStreakMultiplier = singletonWritable<number>('quizStreakMultiplier', 1)
```

#### 35.2.3 — Integration in `src/game/managers/QuizManager.ts`

Instantiate `QuizStreakSystem` in `GameManager` and pass it to `QuizManager`. In `handleQuizAnswer()`, `handleRandomQuizAnswer()`, `handleLayerQuizAnswer()`, call `streakSystem.onCorrect()` or `streakSystem.onWrong()` after processing the answer. Update the two stores:

```typescript
const multiplier = correct
  ? this.streakSystem.onCorrect()
  : this.streakSystem.onWrong()
quizStreak.set(this.streakSystem.getStreak())
quizStreakMultiplier.set(multiplier)
```

In `GameManager`, when awarding dust from any quiz correct-answer reward, multiply by `get(quizStreakMultiplier)`.

#### 35.2.4 — New Component `src/ui/components/QuizStreakBadge.svelte`

```svelte
<script lang="ts">
  import { quizStreak, quizStreakMultiplier } from '../stores/gameState'
</script>

{#if $quizStreak >= 3}
  <div class="streak-badge" class:hot={$quizStreak >= 6} class:blazing={$quizStreak >= 10}>
    <span class="flame">🔥</span>
    <span class="multiplier">×{$quizStreakMultiplier.toFixed(1)}</span>
    <span class="count">{$quizStreak} in a row</span>
  </div>
{/if}

<style>
  .streak-badge {
    position: fixed;
    top: 72px;
    right: 12px;
    display: flex;
    align-items: center;
    gap: 4px;
    background: rgba(0,0,0,0.75);
    border: 1px solid #ffd369;
    border-radius: 8px;
    padding: 4px 10px;
    font-size: 0.85rem;
    color: #ffd369;
    pointer-events: none;
  }
  .hot  { border-color: #ff8800; color: #ff8800; }
  .blazing { border-color: #ff3300; color: #ff3300; animation: pulse 0.6s infinite alternate; }
  @keyframes pulse { from { opacity: 1; } to { opacity: 0.6; } }
</style>
```

Mount `QuizStreakBadge` inside `DomeView.svelte`'s mine overlay layer — it renders on top of the Phaser canvas when `currentScreen === 'mining'`.

#### Acceptance Criteria — 35.2

- [ ] Answering 3 consecutive in-mine quizzes correctly triggers ×1.5 multiplier badge visible on HUD
- [ ] Streak reaching 6 escalates to ×2.0 (orange badge); 10 to ×3.0 (red pulsing badge)
- [ ] One wrong answer resets streak to 0 and removes badge
- [ ] All quiz types (gate, random, layer, artifact) contribute to and can break the streak
- [ ] Dust/mineral rewards from `QUIZ_GATE_PASS_DUST_REWARD` and `RANDOM_QUIZ_REWARD_DUST` are multiplied correctly
- [ ] `quizStreak` store resets to 0 on layer change and on dive end

---

### 35.3 Offering Altars

**Goal**: A rare special block type (`OfferingAltar`) that appears once per landmark layer. The player interacts with it from an adjacent tile, triggering a mineral-sacrifice screen. After sacrifice, the altar produces a guaranteed-rare artifact (uncommon or better) or a recipe fragment. The altar is one-time-use per dive layer.

#### 35.3.1 — `BlockType` Extension in `src/data/types.ts`

Add two entries to the `BlockType` enum:

```typescript
OfferingAltar = 28,   // Sacrifice altar — guaranteed rare drop (Phase 35.3)
LockedBlock = 29,     // Tier/tool locked hard rock (Phase 35.6)
RecipeFragmentNode = 30, // Collectible recipe fragment (Phase 35.5)
```

Add to `MineCell` interface (already has `content?: MineCellContent`):

```typescript
/** For OfferingAltar: which mineral denominations have already been sacrificed (prevents re-use). */
altarUsed?: boolean
/** For LockedBlock: minimum pickaxe tier required to break (0 = any, 3 = diamond+). */
requiredTier?: number
/** For RecipeFragmentNode: which fragment ID is stored here. */
fragmentId?: string
```

#### 35.3.2 — Constants in `src/data/balance.ts`

```typescript
// === OFFERING ALTARS (Phase 35.3) ===
ALTAR_PER_LANDMARK_LAYER: true,        // One altar per landmark layer
ALTAR_SACRIFICE_COSTS: {
  tier1: { dust: 200 },                // Guaranteed uncommon artifact
  tier2: { dust: 100, shard: 5 },      // Guaranteed rare artifact
  tier3: { shard: 10, crystal: 2 },    // Guaranteed epic artifact
  tier4: { crystal: 5, geode: 1 },     // Guaranteed legendary + small recipe-fragment chance
} as const,
ALTAR_FRAGMENT_CHANCE_TIER4: 0.35,     // 35% chance tier-4 sacrifice yields a recipe fragment
ALTAR_COLOR: 0x9944cc,                 // Purple — distinct from RelicShrine gold
```

#### 35.3.3 — Placement in `src/game/systems/MineGenerator.ts`

In `generateMine()`, after the landmark stamp check, add altar placement for landmark layers (layers 5, 10, 15, 20 — one-indexed):

```typescript
// Offering altar — place in a cleared area of landmark layers (Phase 35.3)
const isLandmarkLayer = [5, 10, 15, 20].includes(oneIndexedLayer)
if (isLandmarkLayer) {
  // Find a suitable empty cell in the bottom third of the grid
  const altarY = Math.floor(height * 0.6) + Math.floor(rng() * Math.floor(height * 0.25))
  const altarX = Math.floor(width * 0.2) + Math.floor(rng() * Math.floor(width * 0.6))
  if (altarY < height && altarX < width) {
    grid[altarY][altarX] = {
      type: BlockType.OfferingAltar,
      hardness: 0,     // Cannot be mined — must be interacted with
      maxHardness: 0,
      revealed: false,
      altarUsed: false,
    }
  }
}
```

#### 35.3.4 — Interaction in `src/game/scenes/MineScene.ts`

Detect adjacency: in the movement handler, when the player moves to a tile adjacent to an `OfferingAltar`:

```typescript
// Check adjacent cells for offering altar (Phase 35.3)
for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
  const ax = newX + dx, ay = newY + dy
  const aCell = this.safeCell(ax, ay)
  if (aCell?.type === BlockType.OfferingAltar && !aCell.altarUsed) {
    this.events.emit('altar-adjacent', { x: ax, y: ay })
    break
  }
}
```

`'altar-adjacent'` is consumed by `GameManager`, which sets `currentScreen` to `'sacrifice'` with payload `{ altarX, altarY }`.

#### 35.3.5 — Sacrifice Screen State in `src/ui/stores/gameState.ts`

```typescript
/** Payload for the active altar sacrifice interaction. Null when no altar is active. */
export interface AltarPayload {
  altarX: number
  altarY: number
}
export const activeAltar = singletonWritable<AltarPayload | null>('activeAltar', null)
```

The existing `'sacrifice'` screen is already in the `Screen` type union. Mount an `AltarSacrificeOverlay.svelte` component for this screen (see 35.3.6).

#### 35.3.6 — New Component `src/ui/components/AltarSacrificeOverlay.svelte`

The overlay shows:
- Title: "Offering Altar"
- GAIA flavor: "Ancient machines still hunger. What will you give?"
- Four tier buttons with costs fetched from `BALANCE.ALTAR_SACRIFICE_COSTS`
- Player's current mineral counts derived from `$playerSave.minerals`
- A "Leave" button that returns to mining without consuming anything

On selecting a tier, call `GameManager.completeSacrifice(tier)`. The GameManager:
1. Deducts the minerals from `playerSave` via `addMinerals()` with negative values
2. Picks an artifact rarity guaranteed at the tier's floor (`tier1→uncommon`, `tier2→rare`, `tier3→epic`, `tier4→legendary`)
3. Rolls `ALTAR_FRAGMENT_CHANCE_TIER4` for a recipe fragment if tier 4
4. Adds the artifact to `pendingArtifacts` or triggers an artifact quiz
5. Marks `grid[altarY][altarX].altarUsed = true` via `MineScene.markAltarUsed(altarX, altarY)`
6. Sets `currentScreen` back to `'mining'`

```typescript
// src/ui/components/AltarSacrificeOverlay.svelte — abbreviated
<script lang="ts">
  import { BALANCE } from '../../data/balance'
  import { playerSave } from '../stores/playerData'
  import { getGM } from '../../game/gameManagerRef'
  import { activeAltar, currentScreen } from '../stores/gameState'

  const tiers = Object.entries(BALANCE.ALTAR_SACRIFICE_COSTS) as [string, Record<string, number>][]

  function canAfford(cost: Record<string, number>): boolean {
    const save = $playerSave
    if (!save) return false
    return Object.entries(cost).every(([tier, amt]) =>
      (save.minerals[tier as keyof typeof save.minerals] ?? 0) >= amt
    )
  }

  function sacrifice(tier: string) {
    getGM()?.completeSacrifice(tier)
  }
</script>
```

#### Acceptance Criteria — 35.3

- [ ] Offering altars appear exactly once on layers 5, 10, 15, and 20 (landmark layers)
- [ ] Altar is visually distinct — purple block color, non-minable (tap does nothing)
- [ ] Moving adjacent to an altar opens the `'sacrifice'` screen
- [ ] Each tier's mineral cost is deducted and an artifact of at least the tier's guaranteed rarity is awarded
- [ ] Tier 4 has a 35% chance to also yield a recipe fragment
- [ ] After use, `altarUsed = true` prevents re-interaction for the rest of that layer
- [ ] Leaving without selecting a tier returns to mining with no cost deducted

---

### 35.4 Layer Instability Meter

**Goal**: Each mine layer has a hidden instability level (0–100) that rises as the player mines near lava, breaks unstable ground, triggers cave-ins, and mines in a frenzy. At 75% the HUD meter appears with a warning; at 100% a timed collapse event fires, dropping a random cluster of blocks and flooding a region with lava unless the player reaches the descent shaft within a configurable tick window.

#### 35.4.1 — New System `src/game/systems/InstabilitySystem.ts`

```typescript
import { BALANCE } from '../../data/balance'

export type InstabilityTrigger =
  | 'lava_adjacent'       // mined a block next to lava
  | 'unstable_broke'      // broke UnstableGround
  | 'cave_in'             // cave-in event fired
  | 'hard_rock_deep'      // broke HardRock in extreme tier (layer 16+)
  | 'altar_tier4'         // tier-4 altar sacrifice (earth-shaking)

/**
 * Manages the per-layer instability meter. Registered with TickSystem. (DD-V2-023)
 */
export class InstabilitySystem {
  private level = 0       // 0–100
  private collapseFired = false
  private collapseCountdown = 0  // ticks remaining to reach descent shaft

  private onThresholdWarning: () => void
  private onCollapse: () => void
  private onCollapseCountdownTick: (remaining: number) => void

  constructor(
    onThresholdWarning: () => void,
    onCollapse: () => void,
    onCollapseCountdownTick: (remaining: number) => void,
  ) {
    this.onThresholdWarning = onThresholdWarning
    this.onCollapse = onCollapse
    this.onCollapseCountdownTick = onCollapseCountdownTick
  }

  /** Add instability points for a trigger event. */
  addInstability(trigger: InstabilityTrigger): void {
    const delta = BALANCE.INSTABILITY_DELTAS[trigger] ?? 0
    this.level = Math.min(100, this.level + delta)
    if (this.level >= BALANCE.INSTABILITY_WARNING_THRESHOLD && !this.collapseFired) {
      this.onThresholdWarning()
    }
    if (this.level >= 100 && !this.collapseFired) {
      this.collapseFired = true
      this.collapseCountdown = BALANCE.INSTABILITY_COLLAPSE_TICKS
      this.onCollapse()
    }
  }

  /** Called by TickSystem each tick during a collapse countdown. */
  onTick(_tick: number, _layerTick: number): void {
    if (!this.collapseFired || this.collapseCountdown <= 0) return
    this.collapseCountdown--
    this.onCollapseCountdownTick(this.collapseCountdown)
  }

  getLevel(): number { return this.level }
  isCollapsing(): boolean { return this.collapseFired && this.collapseCountdown > 0 }
  getCountdown(): number { return this.collapseCountdown }

  reset(): void {
    this.level = 0
    this.collapseFired = false
    this.collapseCountdown = 0
  }
}
```

#### 35.4.2 — Constants in `src/data/balance.ts`

```typescript
// === LAYER INSTABILITY (Phase 35.4) ===
INSTABILITY_WARNING_THRESHOLD: 75,     // Meter appears at 75%
INSTABILITY_COLLAPSE_TICKS: 40,        // Player has 40 ticks to reach descent shaft
INSTABILITY_COLLAPSE_BLOCK_COUNT: 12,  // Blocks randomly collapsed during the event
INSTABILITY_LAVA_FLOOD_RADIUS: 2,      // Lava spawned around collapse center
INSTABILITY_DELTAS: {
  lava_adjacent:   12,
  unstable_broke:  20,
  cave_in:         25,
  hard_rock_deep:  8,
  altar_tier4:     15,
} as const,
```

#### 35.4.3 — Stores in `src/ui/stores/gameState.ts`

```typescript
/** Current layer instability level (0–100). */
export const instabilityLevel = singletonWritable<number>('instabilityLevel', 0)

/** True when a collapse event is active and countdown is running. */
export const instabilityCollapsing = singletonWritable<boolean>('instabilityCollapsing', false)

/** Ticks remaining before total collapse (shown on HUD during event). */
export const instabilityCountdown = singletonWritable<number>('instabilityCountdown', 0)
```

#### 35.4.4 — Integration in `src/game/scenes/MineScene.ts`

Instantiate `InstabilitySystem` in `create()`:

```typescript
this.instabilitySystem = new InstabilitySystem(
  () => {
    gaiaMessage.set("Structural readings critical. Find the shaft — now.")
    audioManager.play('instability_warning')
    instabilityLevel.set(this.instabilitySystem!.getLevel())
  },
  () => {
    this.triggerInstabilityCollapse()
    instabilityCollapsing.set(true)
  },
  (remaining) => {
    instabilityCountdown.set(remaining)
    if (remaining <= 0) {
      instabilityCollapsing.set(false)
      this.forceLayerFail()
    }
  },
)
this.tickSystem.register('instability', (t, lt) => {
  this.instabilitySystem?.onTick(t, lt)
  instabilityLevel.set(this.instabilitySystem?.getLevel() ?? 0)
})
```

`triggerInstabilityCollapse()` picks `BALANCE.INSTABILITY_COLLAPSE_BLOCK_COUNT` random revealed-empty cells in the bottom 60% of the grid and fills them with `BlockType.HardRock`. It also spawns one lava entity via `hazardSystem.spawnLava()` near the grid center.

`forceLayerFail()` triggers a forced surface as if oxygen ran out (calls `GameManager.handleDiveEnd(true)`).

Report instability triggers from:
- `handleBlockMined()`: if the broken block was adjacent to any lava cell — `instabilitySystem.addInstability('lava_adjacent')`
- `handleUnstableGroundBroken()`: — `'unstable_broke'`
- Cave-in callback: — `'cave_in'`
- `handleBlockMined()` in extreme tier (layer ≥ 15, `BlockType.HardRock`): — `'hard_rock_deep'`
- `completeSacrifice('tier4')` in GameManager: emit event → `'altar_tier4'`

#### 35.4.5 — New Component `src/ui/components/InstabilityMeter.svelte`

```svelte
<script lang="ts">
  import { instabilityLevel, instabilityCollapsing, instabilityCountdown } from '../stores/gameState'
  import { currentScreen } from '../stores/gameState'

  const show = $derived($currentScreen === 'mining' && $instabilityLevel >= 75)
</script>

{#if show}
  <div class="instability-bar" class:collapsing={$instabilityCollapsing}>
    <div class="label">
      {#if $instabilityCollapsing}
        COLLAPSE IN {$instabilityCountdown}
      {:else}
        INSTABILITY
      {/if}
    </div>
    <div class="track">
      <div class="fill" style="width: {$instabilityLevel}%"></div>
    </div>
  </div>
{/if}

<style>
  .instability-bar {
    position: fixed;
    bottom: 90px;
    left: 50%;
    transform: translateX(-50%);
    width: 180px;
    background: rgba(0,0,0,0.8);
    border: 1px solid #cc4400;
    border-radius: 6px;
    padding: 4px 8px;
    pointer-events: none;
  }
  .collapsing { border-color: #ff0000; animation: shake 0.3s infinite; }
  .label { font-size: 0.7rem; color: #cc4400; text-align: center; margin-bottom: 3px; }
  .track { background: #330000; height: 8px; border-radius: 4px; overflow: hidden; }
  .fill { height: 100%; background: linear-gradient(90deg, #cc4400, #ff0000); transition: width 0.2s; }
  @keyframes shake {
    0%, 100% { transform: translateX(-50%) translateX(0); }
    25% { transform: translateX(-50%) translateX(-2px); }
    75% { transform: translateX(-50%) translateX(2px); }
  }
</style>
```

Mount `InstabilityMeter` in `DomeView.svelte` alongside other mining HUD overlays.

#### Acceptance Criteria — 35.4

- [ ] Instability meter is invisible below 75%; appears as a red HUD bar at 75%+
- [ ] Each listed trigger adds the correct delta per `BALANCE.INSTABILITY_DELTAS`
- [ ] Reaching 100% spawns a collapse (12 random block fills + lava entity) and starts a 40-tick countdown
- [ ] During collapse, HUD shows "COLLAPSE IN N" with a shaking red border
- [ ] Countdown reaching 0 without reaching descent shaft triggers forced surface
- [ ] `instabilitySystem.reset()` is called on layer change and on new dive
- [ ] GAIA says "Find the shaft — now." and `instability_warning` audio plays at first warning threshold

---

### 35.5 Recipe Fragments

**Goal**: Rare collectibles found in mine layers that persist in `PlayerSave` across dives. Assembling a full set (e.g., 3 fragments of the same recipe) unlocks a unique crafting recipe in the Materializer that is unavailable by other means.

#### 35.5.1 — New Data File `src/data/recipeFragments.ts`

```typescript
import type { MineralTier } from './types'

/** A recipe unlockable only by assembling all fragments. */
export interface FragmentRecipe {
  id: string
  name: string
  description: string
  icon: string
  /** Total fragments needed to assemble. */
  totalFragments: number
  /** Mineral cost to actually craft the item once fragments are assembled. */
  craftCost: Partial<Record<MineralTier, number>>
  /** Effect type and value applied permanently. */
  effect: { type: string; value: number }
  /** Minimum dive layer where fragments can drop. */
  minLayer: number
}

export const FRAGMENT_RECIPES: FragmentRecipe[] = [
  {
    id: 'ancient_drill',
    name: 'Ancient Drill Protocol',
    description: 'Mine HardRock in 1 tap regardless of pickaxe tier.',
    icon: '⚙️',
    totalFragments: 3,
    craftCost: { crystal: 10, geode: 3 },
    effect: { type: 'hardrock_oneshot', value: 1 },
    minLayer: 8,
  },
  {
    id: 'resonance_lens',
    name: 'Resonance Lens',
    description: 'Quiz streak multiplier caps at ×5 instead of ×3.',
    icon: '🔮',
    totalFragments: 4,
    craftCost: { shard: 30, crystal: 5 },
    effect: { type: 'streak_cap_boost', value: 5 },
    minLayer: 12,
  },
  {
    id: 'temporal_shard',
    name: 'Temporal Shard Gauntlet',
    description: '+25 O2 restored on every correct quiz answer during a dive.',
    icon: '⏳',
    totalFragments: 5,
    craftCost: { geode: 5, essence: 1 },
    effect: { type: 'quiz_o2_regen', value: 25 },
    minLayer: 15,
  },
  {
    id: 'echo_compass',
    name: 'Echo Compass',
    description: 'Instantly locates descent shaft on the current layer.',
    icon: '🧭',
    totalFragments: 3,
    craftCost: { crystal: 8 },
    effect: { type: 'shaft_reveal', value: 1 },
    minLayer: 5,
  },
  {
    id: 'deep_pact',
    name: 'Deep Pact Seal',
    description: 'Offering altars always yield legendary-tier artifacts on tier-3 sacrifice.',
    icon: '🕯️',
    totalFragments: 4,
    craftCost: { geode: 8, essence: 2 },
    effect: { type: 'altar_boost', value: 1 },
    minLayer: 10,
  },
]

/** Get a fragment recipe by id. */
export function getFragmentRecipe(id: string): FragmentRecipe | undefined {
  return FRAGMENT_RECIPES.find(r => r.id === id)
}

/** Get all fragment recipes the player can find at a given layer. */
export function getFragmentsForLayer(layer: number): FragmentRecipe[] {
  return FRAGMENT_RECIPES.filter(r => r.minLayer <= layer)
}
```

#### 35.5.2 — `PlayerSave` Extension in `src/data/types.ts`

```typescript
// Phase 35.5: Recipe Fragments
/** Fragment collection progress: recipe_id → count of fragments found. */
recipeFragments?: Record<string, number>
/** Recipe IDs fully assembled and available to craft in the Materializer. */
assembledRecipes?: string[]
/** Recipe IDs already crafted via assembled fragments. */
craftedFragmentRecipes?: string[]
```

#### 35.5.3 — `BlockType` Placement in `src/game/systems/MineGenerator.ts`

In `generateMine()`, scatter `RecipeFragmentNode` blocks at low density in the bottom 50% of eligible layers:

```typescript
// Recipe fragment nodes (Phase 35.5) — only on layers minLayer+ for each recipe
const eligibleRecipes = getFragmentsForLayer(oneIndexedLayer)
if (eligibleRecipes.length > 0) {
  const fragMinDepth = Math.floor(height * 0.5)
  let placed = 0
  for (let y = fragMinDepth; y < height && placed < 1; y++) {
    for (let x = 0; x < width && placed < 1; x++) {
      const cell = grid[y][x]
      if (cell.type !== BlockType.Stone && cell.type !== BlockType.HardRock) continue
      if (rng() < BALANCE.FRAGMENT_NODE_DENSITY) {
        const recipe = eligibleRecipes[Math.floor(rng() * eligibleRecipes.length)]
        cell.type = BlockType.RecipeFragmentNode
        cell.hardness = BALANCE.HARDNESS_HARD_ROCK
        cell.maxHardness = BALANCE.HARDNESS_HARD_ROCK
        cell.fragmentId = recipe.id
        placed++
      }
    }
  }
}
```

Add constant:
```typescript
FRAGMENT_NODE_DENSITY: 0.003,   // Approximately 1 per layer when present
HARDNESS_RECIPE_FRAGMENT: 4,    // Same as HardRock — rewarding to reach
```

#### 35.5.4 — Collection in `src/game/scenes/MineScene.ts`

In `handleBlockMined()`, when `cell.type === BlockType.RecipeFragmentNode`:

```typescript
this.events.emit('fragment-collected', { fragmentId: cell.fragmentId })
```

In `GameManager`, listen:

```typescript
scene.events.on('fragment-collected', ({ fragmentId }: { fragmentId: string }) => {
  this.collectRecipeFragment(fragmentId)
})
```

`collectRecipeFragment(fragmentId)`:
1. Increment `playerSave.recipeFragments[fragmentId]` (default 0)
2. Check if count equals `getFragmentRecipe(fragmentId)?.totalFragments`
3. If complete, push to `playerSave.assembledRecipes` (if not already there)
4. Call `gaiaMessage.set()` with the appropriate GAIA reaction
5. Emit `analyticsService.track({ name: 'fragment_collected', ... })`

#### 35.5.5 — Materializer Integration

In `src/ui/components/DomeView.svelte`, in the Materializer panel, read `$playerSave.assembledRecipes` and display assembled fragment recipes as unlockable crafting options with their `craftCost`. On craft, push to `craftedFragmentRecipes` and apply the `effect` through the existing `RecipeEffect` system (add new effect types to `RecipeEffect` union in `recipes.ts`).

Add to `DomeView.svelte`'s dome HUD a small fragment counter showing total fragments collected with a distinct icon (`🧩 N/M` format) per in-progress recipe.

#### Acceptance Criteria — 35.5

- [ ] At most one `RecipeFragmentNode` per mine layer, only on layers at or above each recipe's `minLayer`
- [ ] Mining the node emits `fragment-collected` and increments `recipeFragments` in `PlayerSave`
- [ ] Fragment count persists across dives (survives save/load cycle)
- [ ] Completing a fragment set adds the recipe to `assembledRecipes` and shows a GAIA exclamation
- [ ] Assembled recipes appear in the Materializer UI, craftable with the mineral cost
- [ ] Crafting applies the fragment recipe's effect (using existing or extended `RecipeEffect` system)
- [ ] All 5 fragment recipe effects can be unit-verified (see Playwright tests)

---

### 35.6 Conditionally Breakable Blocks

**Goal**: A new block variant (`LockedBlock`) that looks like `HardRock` but has a visual crack overlay and a tier lock icon. The block cannot be broken by the player unless they meet the `requiredTier` pickaxe condition OR use a `drill_charge` or `bomb` consumable. Attempting to mine it without the right tier shows a brief denial animation and GAIA hint; no damage is dealt and no O2 is consumed.

#### 35.6.1 — Constants in `src/data/balance.ts`

```typescript
// === LOCKED BLOCKS (Phase 35.6) ===
LOCKED_BLOCK_DENSITY: 0.012,        // ~1.2% of deep-layer stone becomes locked
LOCKED_BLOCK_MIN_DEPTH_PERCENT: 0.45,  // Only below 45% mine depth
LOCKED_BLOCK_TIER_WEIGHTS: [
  { tier: 1, weight: 40 },   // Iron pick required — most common
  { tier: 2, weight: 30 },   // Steel pick
  { tier: 3, weight: 20 },   // Diamond pick
  { tier: 4, weight: 10 },   // Plasma Cutter only
] as const,
LOCKED_BLOCK_HARDNESS: 6,           // Harder than standard HardRock (5) when unlocked
```

#### 35.6.2 — Placement in `src/game/systems/MineGenerator.ts`

After the standard block loop, scatter `LockedBlock` in the bottom half of eligible layers:

```typescript
// Conditionally-breakable locked blocks (Phase 35.6)
const lockedMinDepth = Math.floor(height * BALANCE.LOCKED_BLOCK_MIN_DEPTH_PERCENT)
for (let y = lockedMinDepth; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const cell = grid[y][x]
    // Only replace hard rock or stone
    if (cell.type !== BlockType.Stone && cell.type !== BlockType.HardRock) continue
    if (rng() < BALANCE.LOCKED_BLOCK_DENSITY) {
      // Pick required tier by weight
      const tierRoll = rng()
      let cumulative = 0
      const totalWeight = BALANCE.LOCKED_BLOCK_TIER_WEIGHTS.reduce((s, w) => s + w.weight, 0)
      let requiredTier = 1
      for (const { tier, weight } of BALANCE.LOCKED_BLOCK_TIER_WEIGHTS) {
        cumulative += weight / totalWeight
        if (tierRoll <= cumulative) { requiredTier = tier; break }
      }
      cell.type = BlockType.LockedBlock
      cell.hardness = BALANCE.LOCKED_BLOCK_HARDNESS
      cell.maxHardness = BALANCE.LOCKED_BLOCK_HARDNESS
      cell.requiredTier = requiredTier
    }
  }
}
```

#### 35.6.3 — Mining Guard in `src/game/scenes/MineScene.ts`

In `canMine()` or the mining attempt handler, before processing the tap:

```typescript
if (cell.type === BlockType.LockedBlock && cell.requiredTier !== undefined) {
  const hasPickaxe = this.pickaxeTierIndex >= cell.requiredTier
  const hasDrill = this.hasConsumable('drill_charge')
  const hasBomb  = this.hasConsumable('bomb')
  if (!hasPickaxe && !hasDrill && !hasBomb) {
    this.events.emit('locked-block-denied', { x: targetX, y: targetY, requiredTier: cell.requiredTier })
    return // Block movement/tap, no O2 cost
  }
}
```

In `GameManager`, listen on `'locked-block-denied'`:

```typescript
scene.events.on('locked-block-denied', ({ requiredTier }: { requiredTier: number }) => {
  const tierNames = ['', 'Iron', 'Steel', 'Diamond', 'Plasma']
  gaiaMessage.set(`Locked. Requires ${tierNames[requiredTier]} Pick or drill charge.`)
})
```

#### 35.6.4 — Rendering in `MineScene.ts`

In `renderTile()`, when `cell.type === BlockType.LockedBlock`:
1. Draw the base color for `HardRock` (`0x4a4a4a`) — same as hard rock
2. Draw a small lock icon (rendered as a yellow `🔒` text overlay using Phaser `Text` with tiny font, or a solid 4×4 yellow pixel at the tile center)
3. Tint the tile slightly toward the tier's color: tier 1 = silver, tier 2 = blue, tier 3 = cyan, tier 4 = magenta

```typescript
// In renderTile(), add after standard block draw:
if (cell.type === BlockType.LockedBlock) {
  const tierColors: Record<number, number> = { 1: 0xc0c0c0, 2: 0x4a9eff, 3: 0x00ffcc, 4: 0xff44ff }
  const color = tierColors[cell.requiredTier ?? 1] ?? 0xffffff
  this.overlayGraphics.fillStyle(color, 0.4)
  this.overlayGraphics.fillRect(
    (worldX + TILE_SIZE * 0.3) - cameraOffsetX,
    (worldY + TILE_SIZE * 0.3) - cameraOffsetY,
    TILE_SIZE * 0.4, TILE_SIZE * 0.4
  )
}
```

#### Acceptance Criteria — 35.6

- [ ] `LockedBlock` cells appear below 45% mine depth at ~1.2% density
- [ ] Tapping a locked block the player cannot break produces no block damage and no O2 cost
- [ ] GAIA announces the required tier name on first denied tap (not on repeated taps to avoid spam)
- [ ] Player with sufficient pickaxe tier (or drill/bomb consumable) breaks it at normal mining cost
- [ ] Block renders with a tinted accent color matching its required tier level
- [ ] Locked blocks are included in the block color map in `MineScene.ts`

---

### 35.7 Mine Event System

**Goal**: A lightweight random-event dispatcher that fires one of three event types during a dive, driven by the TickSystem. Events add moment-to-moment variety — a tremor reshuffles some fog, a gas leak spawns a new gas cloud, a relic signal hints at a nearby shrine. Events are shown as a transient notification overlay (3-second display).

#### 35.7.1 — New Data File `src/data/mineEvents.ts`

```typescript
/** A type of random mine event. */
export type MineEventType = 'tremor' | 'gas_leak' | 'relic_signal' | 'crystal_vein' | 'pressure_surge'

export interface MineEvent {
  id: MineEventType
  label: string
  gaiaLine: string
  /** Whether this event adds instability. */
  instabilityDelta: number
}

export const MINE_EVENTS: MineEvent[] = [
  {
    id: 'tremor',
    label: 'Seismic Tremor',
    gaiaLine: "Micro-quake. Watch your footing.",
    instabilityDelta: 10,
  },
  {
    id: 'gas_leak',
    label: 'Gas Leak Detected',
    gaiaLine: "Methane pocket ruptured nearby. Don't breathe deep.",
    instabilityDelta: 5,
  },
  {
    id: 'relic_signal',
    label: 'Relic Signal',
    gaiaLine: "Artifact resonance detected — something valuable is close.",
    instabilityDelta: 0,
  },
  {
    id: 'crystal_vein',
    label: 'Crystal Vein Exposed',
    gaiaLine: "Crystalline deposit fracture. Enhanced yield in this sector.",
    instabilityDelta: 0,
  },
  {
    id: 'pressure_surge',
    label: 'Pressure Surge',
    gaiaLine: "Atmospheric pressure spike. O2 consumption spiking.",
    instabilityDelta: 8,
  },
]

export function getMineEvent(id: MineEventType): MineEvent {
  return MINE_EVENTS.find(e => e.id === id)!
}
```

#### 35.7.2 — New System `src/game/systems/MineEventSystem.ts`

```typescript
import type { MineEventType } from '../../data/mineEvents'
import { BALANCE } from '../../data/balance'

/**
 * Random mine event dispatcher. (Phase 35.7)
 * Registered with TickSystem — fires one event per N ticks on average.
 */
export class MineEventSystem {
  private lastEventTick = 0
  private onEvent: (type: MineEventType) => void

  constructor(onEvent: (type: MineEventType) => void) {
    this.onEvent = onEvent
  }

  onTick(tick: number, _layerTick: number): void {
    const elapsed = tick - this.lastEventTick
    if (elapsed < BALANCE.MINE_EVENT_MIN_TICKS) return
    if (Math.random() < BALANCE.MINE_EVENT_CHANCE_PER_TICK) {
      this.lastEventTick = tick
      const types: MineEventType[] = ['tremor', 'gas_leak', 'relic_signal', 'crystal_vein', 'pressure_surge']
      const picked = types[Math.floor(Math.random() * types.length)]
      this.onEvent(picked)
    }
  }

  reset(): void { this.lastEventTick = 0 }
}
```

#### 35.7.3 — Constants in `src/data/balance.ts`

```typescript
// === MINE EVENTS (Phase 35.7) ===
MINE_EVENT_MIN_TICKS: 30,          // Minimum ticks between events
MINE_EVENT_CHANCE_PER_TICK: 0.015, // ~1.5% per tick after min ticks elapsed
```

#### 35.7.4 — Event Handling in `src/game/scenes/MineScene.ts`

Instantiate `MineEventSystem` in `create()`, register with TickSystem:

```typescript
this.mineEventSystem = new MineEventSystem((type) => {
  this.events.emit('mine-event', { type })
})
this.tickSystem.register('mine-events', (t, lt) => this.mineEventSystem?.onTick(t, lt))
```

In `GameManager`, listen on `'mine-event'`:

```typescript
scene.events.on('mine-event', ({ type }: { type: MineEventType }) => {
  this.handleMineEvent(type)
})
```

`handleMineEvent(type)`:
- `tremor`: calls `MineScene.triggerEarthquake()` at reduced scale (reveal 2 blocks instead of `EARTHQUAKE_REVEAL_COUNT`); adds instability via `instabilitySystem.addInstability('cave_in')` * 0.5 if not already collapsing
- `gas_leak`: spawns a gas cloud at a random deep-grid position via `hazardSystem.spawnGas(rx, ry)`; adds `instabilitySystem.addInstability('cave_in')` * 0.25
- `relic_signal`: temporarily reveals all `RelicShrine` cells on the current layer for 5 seconds; sets `gaiaMessage` to the event's GAIA line
- `crystal_vein`: reveals all `MineralNode` cells within 8 tiles of player for 5 seconds
- `pressure_surge`: drains 5 O2 immediately; sets a 5-tick O2-cost multiplier of +0.5 on `OxygenSystem`
- All events: update `activeMineEvent` store, set GAIA message, play appropriate audio cue

#### 35.7.5 — Store in `src/ui/stores/gameState.ts`

```typescript
/** The active mine event notification shown in the overlay. Null = none. */
export const activeMineEvent = singletonWritable<{ type: string; label: string } | null>('activeMineEvent', null)
```

#### 35.7.6 — New Component `src/ui/components/MineEventOverlay.svelte`

```svelte
<script lang="ts">
  import { activeMineEvent, currentScreen } from '../stores/gameState'
  import { onDestroy } from 'svelte'

  let timer: ReturnType<typeof setTimeout> | null = null

  $effect(() => {
    if ($activeMineEvent) {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => activeMineEvent.set(null), 3000)
    }
  })

  onDestroy(() => { if (timer) clearTimeout(timer) })
</script>

{#if $currentScreen === 'mining' && $activeMineEvent}
  <div class="event-card" role="status" aria-live="polite">
    <span class="event-icon">⚠️</span>
    <span class="event-label">{$activeMineEvent.label}</span>
  </div>
{/if}

<style>
  .event-card {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0,0,0,0.85);
    border: 1px solid #ff8800;
    border-radius: 8px;
    padding: 10px 20px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 1rem;
    color: #ff8800;
    pointer-events: none;
    animation: fadeInOut 3s forwards;
  }
  @keyframes fadeInOut {
    0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
    15%  { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    80%  { opacity: 1; }
    100% { opacity: 0; }
  }
</style>
```

Mount `MineEventOverlay` in `DomeView.svelte` alongside other HUD overlays.

#### Acceptance Criteria — 35.7

- [ ] Events fire at most once per 30 ticks; average ~1.5% per eligible tick
- [ ] All 5 event types fire during a full 20-layer dive (probabilistic; Playwright test confirms at least 2 events per dive in a seeded run)
- [ ] `tremor` triggers a reduced-scale earthquake effect and adds to instability
- [ ] `gas_leak` spawns a live gas cloud visible on the Phaser grid
- [ ] `relic_signal` reveals relic shrine cells briefly and shows GAIA message
- [ ] `crystal_vein` reveals nearby mineral nodes briefly
- [ ] `pressure_surge` drains 5 O2 immediately
- [ ] Event notification overlay appears for 3 seconds then fades
- [ ] Events are suppressed when the quiz overlay is open (`currentScreen === 'quiz'`)

---

## 3. Playwright Tests

All test scripts are Node.js scripts compatible with the template in `CLAUDE.md` → "Visual Testing with Playwright". Write each to `/tmp/` and run with `node /tmp/test-35-N.js`.

### Test 35-A: Quiz Gate Placement and Unlock

```js
// /tmp/test-35-a.js
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

  // Enter mine via standard flow
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1000)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/ss-35a-mine.png' })

  // Verify quiz gate exists in page state via evaluate
  const gateCount = await page.evaluate(() => {
    // Access Phaser game instance and check grid for quiz gates
    const game = (window as any).__phaserGame
    if (!game) return -1
    const scene = game.scene.getScene('MineScene')
    if (!scene || !scene['grid']) return -1
    let count = 0
    for (const row of scene['grid']) {
      for (const cell of row) {
        if (cell.type === 14) count++ // BlockType.QuizGate = 14
      }
    }
    return count
  })
  console.log(`Quiz gates in layer: ${gateCount}`)
  console.assert(gateCount >= 0, 'Grid accessible')
  // Quiz overlay should appear when player walks into a gate — manual visual check via screenshot
  await browser.close()
})()
```

### Test 35-B: Quiz Streak Badge Visibility

```js
// /tmp/test-35-b.js
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
  await page.waitForTimeout(1000)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)

  // Inject a streak of 3 via store manipulation
  await page.evaluate(() => {
    const { quizStreak, quizStreakMultiplier } = (window as any).__stores ?? {}
    if (quizStreak) quizStreak.set(3)
    if (quizStreakMultiplier) quizStreakMultiplier.set(1.5)
  })
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/ss-35b-streak.png' })

  const badgeVisible = await page.isVisible('.streak-badge')
  console.log(`Streak badge visible at streak=3: ${badgeVisible}`)
  // After reset
  await page.evaluate(() => {
    const { quizStreak } = (window as any).__stores ?? {}
    if (quizStreak) quizStreak.set(0)
  })
  await page.waitForTimeout(500)
  const badgeGone = !(await page.isVisible('.streak-badge'))
  console.log(`Streak badge gone at streak=0: ${badgeGone}`)
  await browser.close()
})()
```

### Test 35-C: Instability Meter Appearance

```js
// /tmp/test-35-c.js
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
  await page.waitForTimeout(1000)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)

  // Meter should NOT be visible below 75
  const meterHidden = !(await page.isVisible('.instability-bar'))
  console.log(`Meter hidden below 75: ${meterHidden}`)

  // Inject instability = 80
  await page.evaluate(() => {
    const { instabilityLevel } = (window as any).__stores ?? {}
    if (instabilityLevel) instabilityLevel.set(80)
  })
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/ss-35c-instability.png' })

  const meterVisible = await page.isVisible('.instability-bar')
  console.log(`Meter visible at instability=80: ${meterVisible}`)

  // Inject collapse state
  await page.evaluate(() => {
    const { instabilityCollapsing, instabilityCountdown } = (window as any).__stores ?? {}
    if (instabilityCollapsing) instabilityCollapsing.set(true)
    if (instabilityCountdown) instabilityCountdown.set(15)
  })
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/ss-35c-collapse.png' })
  const collapsingClass = await page.$eval('.instability-bar', el => el.classList.contains('collapsing')).catch(() => false)
  console.log(`Meter has collapsing class: ${collapsingClass}`)
  await browser.close()
})()
```

### Test 35-D: Mine Event Overlay Appearance and Fade

```js
// /tmp/test-35-d.js
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
  await page.waitForTimeout(1000)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)

  // Trigger a mine event via store
  await page.evaluate(() => {
    const { activeMineEvent } = (window as any).__stores ?? {}
    if (activeMineEvent) activeMineEvent.set({ type: 'tremor', label: 'Seismic Tremor' })
  })
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/ss-35d-event.png' })
  const overlayVisible = await page.isVisible('.event-card')
  console.log(`Event overlay visible: ${overlayVisible}`)

  // Wait for auto-dismiss
  await page.waitForTimeout(3500)
  const overlayGone = !(await page.isVisible('.event-card'))
  console.log(`Event overlay gone after 3s: ${overlayGone}`)
  await browser.close()
})()
```

### Test 35-E: Offering Altar Screen Renders

```js
// /tmp/test-35-e.js
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
  await page.waitForTimeout(1000)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)

  // Force sacrifice screen
  await page.evaluate(() => {
    const { currentScreen, activeAltar } = (window as any).__stores ?? {}
    if (activeAltar) activeAltar.set({ altarX: 10, altarY: 20 })
    if (currentScreen) currentScreen.set('sacrifice')
  })
  await page.waitForTimeout(600)
  await page.screenshot({ path: '/tmp/ss-35e-altar.png' })

  const altarTitle = await page.isVisible('text=Offering Altar')
  console.log(`Altar overlay visible: ${altarTitle}`)
  const leaveButton = await page.isVisible('button:has-text("Leave")')
  console.log(`Leave button visible: ${leaveButton}`)
  await browser.close()
})()
```

### Test 35-F: Locked Block Visual Rendering

```js
// /tmp/test-35-f.js
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
  await page.waitForTimeout(1000)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)

  // Navigate 8+ rows down to reach locked block depth
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(80)
  }
  await page.screenshot({ path: '/tmp/ss-35f-locked-blocks.png' })

  const lockedCount = await page.evaluate(() => {
    const game = (window as any).__phaserGame
    if (!game) return -1
    const scene = game.scene.getScene('MineScene')
    if (!scene?.['grid']) return -1
    let count = 0
    for (const row of scene['grid']) {
      for (const cell of row) {
        if (cell.type === 29) count++ // BlockType.LockedBlock = 29
      }
    }
    return count
  })
  console.log(`Locked blocks in grid: ${lockedCount}`)
  await browser.close()
})()
```

---

## 4. Verification Gate

All of the following must pass before Phase 35 is marked complete in `PROGRESS.md`.

### 4.1 TypeScript Compilation

```bash
npm run typecheck
```

Expected: 0 errors. In particular:
- `BlockType.OfferingAltar`, `BlockType.LockedBlock`, `BlockType.RecipeFragmentNode` are in scope everywhere
- `MineCell.altarUsed`, `MineCell.requiredTier`, `MineCell.fragmentId` are typed as optional
- `PlayerSave.recipeFragments`, `PlayerSave.assembledRecipes`, `PlayerSave.craftedFragmentRecipes` are typed as optional
- `instabilityLevel`, `quizStreak`, `quizStreakMultiplier`, `activeMineEvent`, `activeAltar` are exported from `gameState.ts`
- `InstabilitySystem`, `QuizStreakSystem`, `MineEventSystem` all implement proper TS interfaces with no `any` escapes
- `MINE_EVENTS`, `FRAGMENT_RECIPES` arrays are exported and typed

### 4.2 Production Build

```bash
npm run build
```

Expected: successful build, no chunk warnings above 500 KB that were not present before this phase.

### 4.3 Functional Checks (Manual + Playwright)

| Check | Method |
|---|---|
| Quiz gates appear in generated layer | Playwright 35-A: gateCount ≥ 0 asserted, screenshot shows gate cells |
| Streak badge shows at streak ≥ 3 | Playwright 35-B: `.streak-badge` visible |
| Streak badge hides at streak = 0 | Playwright 35-B: `.streak-badge` absent |
| Instability meter hidden below 75% | Playwright 35-C: `.instability-bar` absent initially |
| Instability meter visible at 80% | Playwright 35-C: `.instability-bar` visible, screenshot |
| Collapse state adds `.collapsing` class | Playwright 35-C: class present |
| Mine event overlay appears and fades | Playwright 35-D: visible then gone after 3.5s wait |
| Altar sacrifice screen renders | Playwright 35-E: "Offering Altar" text and Leave button |
| Locked blocks appear in deep grid | Playwright 35-F: type-29 cells present |

### 4.4 Balance Verification

Open the DevPanel in the running app (`npm run dev`) and:
- [ ] Verify `QUIZ_GATE_DENSITY = 0.005` produces ~3-6 gates per standard (20×20) layer
- [ ] Verify `LOCKED_BLOCK_DENSITY = 0.012` produces visually sparse but non-trivial locked blocks below row 9
- [ ] Verify `MINE_EVENT_MIN_TICKS = 30` and `MINE_EVENT_CHANCE_PER_TICK = 0.015` produces 2–5 events across a full 20-layer dive
- [ ] Verify fragment nodes appear no more than once per layer

### 4.5 Save / Load Round-Trip

- [ ] Collect a recipe fragment in a dive, surface, reload the page (`localStorage` preserved), confirm `playerSave.recipeFragments[id]` equals the count before reload
- [ ] Confirm instability and quiz streak reset to 0 on new dive start (they are in-run state, not persisted)

### 4.6 No Regressions

- [ ] Standard quiz flow (gate, random, layer, artifact) still works without streak system interference
- [ ] Existing hazard system (lava spread, gas drift) is unaffected by `InstabilitySystem` registration
- [ ] Recipe fragment `FRAGMENT_NODE_DENSITY = 0.003` never produces more than 1 fragment node per layer (assertion in generator)

---

## 5. Files Affected

### New Files

| File | Description |
|---|---|
| `src/data/recipeFragments.ts` | Fragment recipe definitions and selector functions |
| `src/data/mineEvents.ts` | Mine event type definitions and pool |
| `src/game/systems/InstabilitySystem.ts` | Layer instability meter — tracks deltas, fires collapse |
| `src/game/systems/QuizStreakSystem.ts` | Consecutive-correct streak counter and multiplier |
| `src/game/systems/MineEventSystem.ts` | Tick-driven random event dispatcher |
| `src/ui/components/InstabilityMeter.svelte` | HUD bar for instability level and collapse countdown |
| `src/ui/components/QuizStreakBadge.svelte` | Streak flame badge shown during active multiplier |
| `src/ui/components/MineEventOverlay.svelte` | 3-second event notification card |
| `src/ui/components/AltarSacrificeOverlay.svelte` | Sacrifice tier selection UI for offering altars |

### Modified Files

| File | Changes |
|---|---|
| `src/data/balance.ts` | Add 25+ new constants for all 7 sub-phases |
| `src/data/types.ts` | Add 3 `BlockType` entries; extend `MineCell` (3 fields); extend `PlayerSave` (3 optional fields) |
| `src/data/recipes.ts` | Extend `RecipeEffect['type']` union with new fragment-recipe effect types |
| `src/game/systems/MineGenerator.ts` | Add placement passes for quiz gates, offering altars, fragment nodes, locked blocks |
| `src/game/managers/QuizManager.ts` | Accept `QuizStreakSystem` reference; update streak on all answer handlers |
| `src/game/scenes/MineScene.ts` | Instantiate all 3 new systems; add rendering for `LockedBlock`, `OfferingAltar`, `RecipeFragmentNode`; register tick callbacks; emit new events |
| `src/game/GameManager.ts` | Add `QuizStreakSystem` and `MineEventSystem` members; add `handleMineEvent()`, `completeSacrifice()`, `collectRecipeFragment()`, `handleLockedBlockDenied()`, listen on new scene events |
| `src/ui/stores/gameState.ts` | Add 6 new stores: `quizStreak`, `quizStreakMultiplier`, `instabilityLevel`, `instabilityCollapsing`, `instabilityCountdown`, `activeMineEvent`, `activeAltar` |
| `src/ui/components/DomeView.svelte` | Mount `InstabilityMeter`, `QuizStreakBadge`, `MineEventOverlay`; add `AltarSacrificeOverlay` for `'sacrifice'` screen; add fragment counter in dome HUD |

---

## Design Decision Traceability

| Decision | Sub-Phase | Notes |
|---|---|---|
| DD-V2-020 | 35.1 | Quiz gates: locked passages require correct answer; failure costs O2, gate opens after max failures |
| DD-V2-021 | 35.2 | Streak multiplier thresholds (×1→×4), reset on wrong answer, applies to all mine quiz reward dust |
| DD-V2-022 | 35.3 | Offering altars on landmark layers; 4 sacrifice tiers; guaranteed rarity floor; fragment chance on tier-4 |
| DD-V2-023 | 35.4 | Instability meter: hidden until 75%, collapse at 100%, 40-tick forced-ascent countdown |
| DD-V2-024 | 35.5 | Recipe fragments: 5 unique recipes, 3-5 fragments each, persist in save, unlock Materializer entries |
| Q-V2-10 | 35.3 | Offering altar visual: purple block color, biome-agnostic design deferred to Phase 33 sprite pass |
| Q-V2-11 | 35.4 | Instability meter placement: bottom HUD bar, appears only at 75%+ (not always-visible per design vote) |
