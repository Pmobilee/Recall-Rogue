# Phase 51: Core Loot Loop Fidelity

**Status**: Not Started
**Depends On**: Phase 8 (Mine Gameplay Overhaul — oxygen depletion, backpack, send-up), Phase 35 (Mine Mechanics Completion — AltarSacrificeOverlay, consumables), Phase 30 (Mining Juice — loot physics)
**Estimated Complexity**: High — 2 new full-screen overlays, send-up slot scaling, backpack stack limits, new consumable type, wiring into GameManager and MineScene
**Design Decisions**: DD-021 (sacrifice choice), DD-037 (backpack stacking), DD-038 (decision screen / "The Cloth"), DD-039 (send-up scaling)

---

## 1. Overview

Phase 51 replaces the current automatic-penalty oxygen-depletion path with a player-agency system called "The Sacrifice", and introduces a ceremonial "Decision Screen" (referred to in design docs as "The Cloth") for full-backpack situations. Two additional systems complete the loot loop: depth-scaled send-up slots and precise per-tier stack limits. A fifth addition, the Rescue Beacon consumable, gives players a high-cost escape option that transforms the backpack-vs-safety pre-dive decision into a genuine strategic moment.

The guiding design goal is **player agency and memorable moments**. The sacrifice should feel dramatic ("I had to drop my three best Shards to save a Legendary artifact"). The Cloth should feel ceremonial, not like a pop-up interruption.

### What Exists Already

| File | Status |
|---|---|
| `src/game/GameManager.ts` | Has `handleOxygenDepleted()` — currently applies flat 30% loot penalty; this must be replaced |
| `src/ui/components/AltarSacrificeOverlay.svelte` | Altar-sacrifice overlay; exists but is separate from oxygen-depletion sacrifice |
| `src/ui/components/SendUpOverlay.svelte` | Fixed 3-slot send-up; needs depth-based slot count |
| `src/ui/components/BackpackOverlay.svelte` | Inventory display; needs stack count display ("23/50") |
| `src/data/balance.ts` | Has `SEND_UP_MAX_ITEMS: 3`; needs to become a depth-based lookup |
| `src/data/consumables.ts` | Consumable type definitions; Rescue Beacon must be added |
| `src/data/types.ts` | `InventorySlot` interface; needs stack limit fields |

### What This Phase Adds

- `src/ui/components/SacrificeOverlay.svelte` — oxygen-depletion sacrifice screen; replaces flat penalty
- `src/ui/components/DecisionScreen.svelte` — "The Cloth" full-backpack overlay; drag-to-keep / drag-to-leave
- Balance constants in `src/data/balance.ts`: `SEND_UP_SLOTS_BY_LAYER`, `SACRIFICE_THRESHOLD_BY_LAYER`, `STACK_LIMITS_BY_TIER`, `RESCUE_BEACON_COST`
- `src/data/consumables.ts` extended with `rescue_beacon` entry
- `src/data/types.ts` extended: `InventorySlot.stackLimit`, `InventorySlot.stackCurrent`, `BackpackItemState`
- `src/ui/components/HUD.svelte` — Rescue Beacon activation button (shown when equipped)
- `src/ui/components/rooms/WorkshopRoom.svelte` (or `Materializer.svelte`) — Rescue Beacon crafting recipe visible

---

## 2. Sub-phases

---

### 51.1 — The Sacrifice: Oxygen-Depletion Choice Screen

**Goal**: When the player's oxygen reaches zero during a dive, instead of applying an automatic 30% loot penalty, show a full-screen `SacrificeOverlay`. The player manually selects items to drop until they meet the depth-based sacrifice threshold. Remaining items surface with the player.

#### 51.1.1 — New store slice in `src/ui/stores/gameState.ts`

Add `'sacrifice'` to the `Screen` union type. Add a writable store `sacrificeState` that the overlay reads:

```typescript
// Add to Screen union in src/ui/stores/gameState.ts
// 'sacrifice' | ... (existing union members)

import { writable } from 'svelte/store'

export interface SacrificeState {
  active: boolean
  /** All backpack items at the moment oxygen depleted */
  items: BackpackItemState[]
  /** Number of item slots that MUST be dropped before confirm is enabled */
  requiredDropCount: number
  /** Which item slot indices the player has marked for dropping */
  markedForDrop: Set<number>
}

export const sacrificeState = writable<SacrificeState>({
  active: false,
  items: [],
  requiredDropCount: 0,
  markedForDrop: new Set(),
})
```

`BackpackItemState` is a new lightweight interface in `src/data/types.ts`:

```typescript
/** Snapshot of a single backpack slot for sacrifice/decision-screen display */
export interface BackpackItemState {
  slotIndex: number
  type: 'mineral' | 'artifact' | 'fossil' | 'empty'
  displayName: string
  rarity?: Rarity
  mineralTier?: MineralTier
  stackCurrent?: number
  stackLimit?: number
}
```

#### 51.1.2 — Balance constants in `src/data/balance.ts`

Add the following depth-based sacrifice threshold lookup:

```typescript
// How many inventory slots must be dropped at each layer depth.
// Layer index is 0-based (Layer 1 = index 0).
// Formula: Math.ceil(backpack.filledSlots * SACRIFICE_THRESHOLD_BY_LAYER[layerIdx])
export const SACRIFICE_THRESHOLD_BY_LAYER: Record<number, number> = {
  0: 0.20, // Layer 1 — drop 20% of filled slots
  1: 0.25, // Layer 2
  2: 0.30, // Layer 3
  3: 0.35, // Layer 4
  4: 0.40, // Layer 5
  5: 0.50, // Layer 6
  6: 0.60, // Layer 7
  7: 0.70, // Layer 8
  8: 0.75, // Layer 9+
}
// Layers 9+ use the Layer 8+ value (0.75). Cap at filled slots.
export const SACRIFICE_THRESHOLD_MAX = 0.80
```

#### 51.1.3 — `GameManager.handleOxygenDepleted()` rewrite

Locate `handleOxygenDepleted()` in `src/game/GameManager.ts`. Replace the flat 30% loot penalty with:

1. Pause the dive tick system (`TickSystem.pause()` or equivalent flag).
2. Compute `requiredDropCount`:
   ```typescript
   const layerIdx = Math.min(currentLayer - 1, 8)
   const threshold = SACRIFICE_THRESHOLD_BY_LAYER[layerIdx] ?? SACRIFICE_THRESHOLD_MAX
   const filled = backpack.filter(s => s.type !== 'empty').length
   const required = Math.min(Math.ceil(filled * threshold), filled)
   ```
3. Build `items: BackpackItemState[]` from current backpack state.
4. Set `sacrificeState` store to `{ active: true, items, requiredDropCount: required, markedForDrop: new Set() }`.
5. Transition screen to `'sacrifice'` via `currentScreen` store.
6. Wait for a `sacrifice-confirmed` game event (emitted by the overlay on confirm).
7. On `sacrifice-confirmed`: remove marked slots from the player's in-run backpack, then trigger normal surface ascent animation and return to dome.

**Acceptance Criteria**:
- When oxygen reaches 0, the SacrificeOverlay appears instead of any automatic penalty.
- The overlay shows all backpack items in a scrollable grid.
- The required drop count matches the depth formula above.
- The "Confirm Ascent" button is disabled until enough items are marked.
- Marked items are removed from inventory; remaining items are carried to the surface.
- The overlay does not appear if the backpack is empty (no sacrifice needed — ascend freely).

#### 51.1.4 — `SacrificeOverlay.svelte` component

Create `src/ui/components/SacrificeOverlay.svelte`. Structure:

- Full-screen dark overlay (rgba 0,0,0,0.85).
- Header: "EMERGENCY ASCENT — Lighten Your Load" with depth-based sub-text ("At this depth you must sacrifice [N] items").
- Grid of backpack items rendered as cards. Each card shows: item name, rarity badge (for artifacts), mineral tier icon and stack count (for minerals). Tapping a card marks it for sacrifice (red border overlay). Tapping again unmarks.
- Footer: "Dropping [M] of [N] required" progress bar. "Confirm Ascent" button (disabled until M ≥ N).
- On confirm: emit `sacrifice-confirmed` event via the Svelte `createEventDispatcher` or EventBus.

The component reads from `sacrificeState` store. No Phaser interaction — pure Svelte.

**Acceptance Criteria**:
- SacrificeOverlay is mounted in `App.svelte` and shown when `sacrificeState.active === true`.
- Item grid correctly represents the current backpack.
- Confirm button activates only when the required count is met.
- Tapping "Confirm Ascent" fires the `sacrifice-confirmed` event and sets `sacrificeState.active = false`.

---

### 51.2 — The Decision Screen ("The Cloth"): Full-Backpack Item Choice

**Goal**: When the player mines a block that yields an item but the backpack is full, show `DecisionScreen.svelte` rather than silently discarding the new item or blocking mining. The player drags items between "The Cloth" (items to keep) and "Leave Behind" (items to permanently lose). They can also tap "Take Nothing" to leave without taking the new item.

#### 51.2.1 — Trigger in `MineScene.ts`

In the block-mined resolution path (wherever `addItemToBackpack()` is called or the inventory-full guard fires), when the backpack is full:

1. Pause mining input (set `inputEnabled = false` in MineScene).
2. Build a `DecisionScreenState` and set the `decisionScreenState` store.
3. Transition `currentScreen` to `'decision'`.
4. Resume mining input after a `decision-confirmed` game event is received.

#### 51.2.2 — New store slice in `src/ui/stores/gameState.ts`

Add `'decision'` to the `Screen` union. Add `decisionScreenState` store:

```typescript
export interface DecisionScreenState {
  active: boolean
  /** The newly found item that triggered the full-backpack situation */
  newItem: BackpackItemState
  /** The player's current backpack contents */
  existingItems: BackpackItemState[]
  /** Indices in existingItems the player has chosen to keep (defaults: all) */
  keptIndices: Set<number>
}

export const decisionScreenState = writable<DecisionScreenState>({
  active: false,
  newItem: { slotIndex: -1, type: 'empty', displayName: '' },
  existingItems: [],
  keptIndices: new Set(),
})
```

#### 51.2.3 — `DecisionScreen.svelte` component

Create `src/ui/components/DecisionScreen.svelte`. Structure:

- Split-screen layout (vertical split on mobile, horizontal on desktop ≥768px).
- **Left panel — "The Cloth"**: Stone-slab visual. The new item is displayed prominently on the slab with cinematic lighting (CSS radial gradient glow). Item name, rarity, and a one-sentence flavor description.
- **Right panel — "Your Pack"**: All current backpack items displayed as small cards (same style as SacrificeOverlay cards). Items can be tapped to "move to The Cloth" (player chooses to take new item instead of the tapped item). The moved item replaces the new item on the slab display (the "evicted" old item is now on The Cloth and will be left behind).
- Bottom row: Two buttons — "**Take It** (leave [evicted item name] behind)" and "**Leave It** (leave new item behind)". "Leave It" immediately discards the new item and closes the overlay.
- On "Take It": the new item enters the backpack slot occupied by the evicted item; the evicted item is permanently lost. Emit `decision-confirmed`.
- On "Leave It": the new item is discarded. Emit `decision-confirmed`. GAIA comment: "You walked away. That one had potential, but you chose wisely. Maybe."

**Acceptance Criteria**:
- DecisionScreen appears when backpack is full and a new item is found.
- Left panel displays the new item with a visual slab/cloth presentation.
- Right panel shows existing backpack items; tapping one marks it as the "evict" candidate.
- "Take It" button only enabled when a backpack item has been selected to evict.
- "Leave It" closes the overlay immediately, discarding the new item.
- All backpack-state transitions are reflected correctly in the post-mine inventory.

---

### 51.3 — Send-Up Slots: Depth-Scaled

**Goal**: The send-up slot count scales by current layer instead of being fixed at 3. Layer 1 descent = 1 slot, Layer 2 = 2 slots, Layer 3 = 3 slots, Layer 4–5+ = 4 slots (cap).

#### 51.3.1 — Balance table in `src/data/balance.ts`

Replace the scalar `SEND_UP_MAX_ITEMS: 3` with a layer-indexed array:

```typescript
// Keep the old scalar for migration reference:
// SEND_UP_MAX_ITEMS: 3  ← DEPRECATED, replaced by SEND_UP_SLOTS_BY_LAYER

/** Max items a player can send to the surface from a given layer (1-based layer index). */
export const SEND_UP_SLOTS_BY_LAYER: Record<number, number> = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
}
/** Default cap for layers beyond the explicit table (layer 5+). */
export const SEND_UP_SLOTS_MAX = 4
```

Add a helper function (exported from `balance.ts`):

```typescript
/** Returns the number of send-up slots available at the given 1-based layer index. */
export function getSendUpSlots(layer: number): number {
  return SEND_UP_SLOTS_BY_LAYER[layer] ?? SEND_UP_SLOTS_MAX
}
```

#### 51.3.2 — `SendUpOverlay.svelte` update

In `src/ui/components/SendUpOverlay.svelte`, replace any hardcoded `3` or `SEND_UP_MAX_ITEMS` references with a call to `getSendUpSlots(currentLayer)`. The slot count header should read "Send Up (max [N] items from Layer [L])". The slot grid should render exactly `N` slots.

**Acceptance Criteria**:
- At Layer 1, only 1 send-up slot is available; extra items cannot be slotted.
- At Layer 3+, 3 or 4 slots are available.
- The overlay header dynamically shows the correct slot count for the current layer.
- Existing send-up logic (mineral and artifact types) continues to work correctly.

---

### 51.4 — Backpack Stacking with Tier Limits

**Goal**: Enforce precise stack limits per mineral tier and artifact rarity. Display stacks as "23/50" in inventory UI.

#### 51.4.1 — Stack limit constants in `src/data/balance.ts`

```typescript
/** Maximum number of a given mineral tier that fits in a single backpack slot. */
export const MINERAL_STACK_LIMITS: Record<MineralTier, number> = {
  dust:    50,
  shard:   20,
  crystal:  5,
  geode:    2,
  essence:  1,
}

/** Number of backpack SLOTS an artifact of a given rarity occupies. */
export const ARTIFACT_SLOT_COST: Record<Rarity, number> = {
  common:    1,
  uncommon:  1,
  rare:      2,
  epic:      2,
  legendary: 3,
  mythic:    3,
}

/** Number of backpack slots a fossil fragment occupies. */
export const FOSSIL_SLOT_COST = 3
```

#### 51.4.2 — `InventorySlot` extension in `src/data/types.ts`

Add two optional fields to `InventorySlot`:

```typescript
export interface InventorySlot {
  type: 'mineral' | 'artifact' | 'fossil' | 'empty'
  mineralTier?: MineralTier
  mineralAmount?: number      // Stack count (was already present)
  /** Maximum stack size for this slot. Set when the slot is initialized. */
  stackLimit?: number
  artifactRarity?: Rarity
  factId?: string
}
```

#### 51.4.3 — `BackpackOverlay.svelte` display update

In `src/ui/components/BackpackOverlay.svelte`, for each `InventorySlot` where `type === 'mineral'` and `stackLimit` is set, render the stack as `"[mineralAmount]/[stackLimit]"` in small text beneath the mineral icon.

For artifact slots where `ARTIFACT_SLOT_COST[rarity] > 1`, render a visual indicator showing how many physical slots the artifact occupies (e.g., a 2-slot indicator for Rare/Epic artifacts).

#### 51.4.4 — Stack overflow in `InventoryManager.ts` (or `GameManager.ts`)

In `src/game/managers/InventoryManager.ts` (or wherever items are added to the backpack), when adding a mineral:

1. Find the first slot of the same `mineralTier` that has `mineralAmount < stackLimit`.
2. Add to that slot up to the limit; overflow spills into a new slot.
3. If no partial stack exists, open a new slot and set `stackLimit = MINERAL_STACK_LIMITS[tier]`.

**Acceptance Criteria**:
- A single slot can hold at most 50 Dust, 20 Shards, 5 Crystals, 2 Geodes, or 1 Essence.
- When a stack limit is reached, a new slot is opened automatically.
- BackpackOverlay displays "23/50" format for partially filled stacks.
- Legendary and Mythic artifacts display as 3-slot items visually.

---

### 51.5 — Rescue Beacon Consumable

**Goal**: Add a craftable, equippable consumable that triggers emergency extraction with zero loot loss when activated mid-dive.

#### 51.5.1 — `consumables.ts` entry

Add to the consumable definitions in `src/data/consumables.ts`:

```typescript
{
  id: 'rescue_beacon',
  name: 'Rescue Beacon',
  description: 'Emergency extraction with zero loot loss. Activates a light beam that pulls you to the surface instantly.',
  icon: '🔆',
  maxStack: 1,
  /** Rescue beacons cannot stack — only one can be brought per dive. */
  equippableSlots: 1,
  /** Rarely drops from deep chest blocks (Layer 5+). */
  dropChance: 0.005,
  craftable: true,
  recipeId: 'recipe_rescue_beacon',
}
```

#### 51.5.2 — Recipe in `src/data/recipes.ts`

Add the crafting recipe (or in `src/data/balance.ts` as constants first):

```typescript
// In balance.ts:
export const RESCUE_BEACON_COST_CRYSTAL = 200
export const RESCUE_BEACON_COST_GEODE = 2
```

Add the recipe object in `src/data/recipes.ts` (or wherever standard recipes are defined):

```typescript
{
  id: 'recipe_rescue_beacon',
  name: 'Rescue Beacon',
  outputConsumableId: 'rescue_beacon',
  outputCount: 1,
  ingredients: [
    { mineralTier: 'crystal', amount: 200 },
    { mineralTier: 'geode', amount: 2 },
  ],
  unlockRequirement: null, // available from start once materials exist
}
```

#### 51.5.3 — HUD activation button in `src/ui/components/HUD.svelte`

When the player has `rescue_beacon` in their `activeConsumables` for the current dive, show a dedicated "Beacon" button in the HUD (distinct from the standard consumable slot). Tapping it:

1. Shows a 1-second confirmation micro-overlay ("Activate Rescue Beacon? All loot preserved.") with confirm/cancel.
2. On confirm: emit `rescue-beacon-activated` game event.

#### 51.5.4 — Activation handling in `GameManager.ts`

Listen for `rescue-beacon-activated`:

1. Remove `rescue_beacon` from the player's consumable inventory (consumed on use).
2. Do NOT apply any loot sacrifice or penalty.
3. Trigger the surface ascent sequence immediately (skip oxygen depletion flow entirely).
4. Play a special audio cue: `audioManager.playSound('rescue_beacon_activate')` — use a synth tone fallback if the asset doesn't exist.
5. Show a brief visual: a white radial-gradient "beam of light" pulse centered on the miner sprite (can be a Phaser Graphics object that fades over 1.5 seconds).
6. Emit `analytics:rescue_beacon_used` with `{ layer: currentLayer }`.

**Acceptance Criteria**:
- Rescue Beacon appears in the Materializer workshop room as a craftable item at 200 Crystal + 2 Geode cost.
- When equipped (in `activeConsumables`), a Beacon button appears on the in-dive HUD.
- Activating the beacon surfaces the player with full loot, no sacrifice triggered.
- The beacon is consumed on use; the player's inventory no longer has it after surfacing.
- The beacon can also appear rarely as a mine drop from deep chests (Layer 5+).

---

## 3. Verification Gate

- [ ] `npm run typecheck` passes with 0 errors.
- [ ] `npm run build` completes successfully.
- [ ] Play through a dive to oxygen depletion on Layer 1: SacrificeOverlay appears, requires dropping ≥20% of filled slots, confirm surfaces with remaining loot.
- [ ] Play through a dive to oxygen depletion on Layer 8+: SacrificeOverlay requires dropping ≥75% of filled slots.
- [ ] Fill backpack completely, then mine a mineral node: DecisionScreen appears with the new item on The Cloth.
- [ ] Tap "Leave It" on DecisionScreen: new item discarded, backpack unchanged.
- [ ] Tap an existing item then "Take It": new item enters backpack, old item lost.
- [ ] Verify Send-Up Overlay shows 1 slot on Layer 1, 4 slots on Layer 4+.
- [ ] Verify Dust stacks cap at 50 per slot; 51st Dust opens a new slot.
- [ ] Craft a Rescue Beacon in the Workshop (requires 200 Crystal + 2 Geode).
- [ ] Equip the Rescue Beacon and dive: beacon HUD button is visible.
- [ ] Activate beacon: surface with full loot, no SacrificeOverlay shown.
- [ ] Playwright screenshot of SacrificeOverlay confirms item grid is populated and confirm button is initially disabled.

---

## 4. Playwright Test Script

```js
// /tmp/test-phase-51.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

  // Open DevPanel and trigger oxygen depletion
  await page.click('button:has-text("DEV")', { force: true })
  await page.waitForTimeout(500)
  // Use dev preset to set O2 to 1 and fill backpack
  // Then trigger oxygen depletion
  await page.screenshot({ path: '/tmp/ss-51-sacrifice.png' })

  // Verify DecisionScreen by filling backpack then mining
  await page.screenshot({ path: '/tmp/ss-51-decision.png' })

  await browser.close()
})()
```

---

## 5. Files Affected

### Modified
- `src/game/GameManager.ts` — replace `handleOxygenDepleted()` flat penalty with SacrificeOverlay trigger; add `rescue-beacon-activated` handler
- `src/game/scenes/MineScene.ts` — trigger DecisionScreen when backpack full on item pickup
- `src/game/managers/InventoryManager.ts` — stack overflow logic using `MINERAL_STACK_LIMITS`
- `src/data/balance.ts` — add `SACRIFICE_THRESHOLD_BY_LAYER`, `SEND_UP_SLOTS_BY_LAYER`, `getSendUpSlots()`, `MINERAL_STACK_LIMITS`, `ARTIFACT_SLOT_COST`, `FOSSIL_SLOT_COST`, `RESCUE_BEACON_COST_CRYSTAL`, `RESCUE_BEACON_COST_GEODE`
- `src/data/types.ts` — add `BackpackItemState`, extend `InventorySlot` with `stackLimit`
- `src/data/consumables.ts` — add `rescue_beacon`
- `src/data/recipes.ts` — add `recipe_rescue_beacon`
- `src/ui/stores/gameState.ts` — add `'sacrifice'` and `'decision'` to Screen union; add `sacrificeState`, `decisionScreenState` stores
- `src/ui/components/SendUpOverlay.svelte` — use `getSendUpSlots(layer)` for slot count
- `src/ui/components/BackpackOverlay.svelte` — display `stackCurrent/stackLimit` for mineral slots
- `src/ui/components/HUD.svelte` — Rescue Beacon activation button

### New
- `src/ui/components/SacrificeOverlay.svelte`
- `src/ui/components/DecisionScreen.svelte`
