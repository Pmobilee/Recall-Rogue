# Phase 51 — Emergency UX & Gameplay Fixes

**Priority**: CRITICAL — These bugs block core gameplay loops
**Status**: NOT STARTED
**Reported**: 2026-03-06
**Dependencies**: Phases 0-50 complete, Phase 51 layer-transition camera fix (committed 22433ca) applied
**Executor context**: This document is self-contained. A fresh agent can implement every sub-step using only this file. No other docs needed.

---

## Tech Stack Reminder

- **Frontend**: Svelte 5 + TypeScript (strict), Vite 7, Phaser 3
- **State**: Svelte stores in `src/ui/stores/`; Phaser game events via `this.game.events.emit()`
- **Save**: `playerSave` writable store (persisted via `persistPlayer()`), `singletonWritable` pattern
- **Entry point**: `src/App.svelte` — screen router; `src/game/GameManager.ts` — orchestrates Phaser scenes
- **Mine scene**: `src/game/scenes/MineScene.ts` (~3700 lines)
- **Dome scene**: `src/game/scenes/DomeScene.ts`
- **Quiz/SM-2**: `src/game/managers/QuizManager.ts`, `src/services/factsDB.ts`, `src/ui/stores/playerData.ts` (`updateReviewState`)
- **Typecheck command**: `npm run typecheck` — must report 0 errors (currently 56 pre-existing a11y warnings are OK)
- **Dev server**: `npm run dev` → `http://localhost:5173`; DEV button top-right for god-mode testing

---

## Overview of All Issues

| # | User Report (verbatim) | Severity |
|---|------------------------|----------|
| 51.1 | "when finishing a single level and clicking continue on the screen, i get transported back to the dome instead of directly going to the next level in the mine" | Critical |
| 51.2 | "when manually clicking the mine again, my previous selection is selected and i get transported to level 1 of the mine, but its again an empty level where I cannot move and all I can do is go to the surface" | Critical |
| 51.3 | "I have all these consumables available to cycle through when entering a mine, why are these available without buying them?" | High |
| 51.4 | "the same goes for relics" | High |
| 51.5 | "when I start, I see the option for the standard pickaxe and the reinforced pick, why are these available from the start, and why would it even show the standard pick, instead, we should be able to select gear, and clicking the pickaxe option should open a dropdown to select the pick, by default picking the last selected one in the last mine" | High |
| 51.6 | "i collected an artifact in the mine and surfaced, but I dont see it added to my facts" | High |
| 51.7 | "when entering a mine, im able to select multiple consumables, even of the same type, but I only saw a single one of ONE type available to use" | High |
| 51.8 | "when we exit a mine and we are able to keep any loot, I want the final screen (so only when we decide or are forced to exit the mine) to show what loot we have gained" | Medium |
| 51.9 | "i dont think the base dome level for new players has all the things we need, for example, i have no way to increase floors, examine collected artifacts to turn them to learnable items, or a way to review etc, all i see is the mine entrance, the materializer, the tiny sapling and the mine entrance. I also see the gaia Te... but i cannot click on it." | High |
| 51.10 | "the settings button is under the dev button and on top of some green button I cannot see, these need to be forcefully separated, and can exist on the same layer next to each other, we can simply disable the dev button later when we go to production" | Medium |
| 51.11 | "the floor indication in the dome, the small dots to the right of the screen, should be on top of the dome rendering, now its just stuck on the screen" | Medium |
| 51.12 | "the sidebar on the right should change based on location, like the dome and or the mine to show relevant information, i dont care about my review due in the middle of the mine" | Medium |
| 51.13 | "when going through a mine and opening the gate with the questions, when getting a fact wrong (in general in the game) the NEXT fact asked should NOT be the same one of course!!!" | High |

---

## Sub-step 51.1 — "Continue" after finishing a level always goes to dome

### User Report
> "when finishing a single level and clicking continue on the screen, i get transported back to the dome instead of directly going to the next level in the mine"

### Root Cause (exact)
`src/App.svelte:573–581` — `handleDiveResultsContinue()`:
```typescript
function handleDiveResultsContinue(): void {
  diveResults.set(null)
  const pending = get(pendingArtifacts)
  if (pending.length > 0) {
    getGM()?.reviewNextArtifact()
  } else {
    getGM()?.goToBase()   // ← ALWAYS goes to dome, no "dive deeper" path
  }
}
```
The function never offers the player a way to continue diving. The dive results screen (`src/ui/components/DiveResults.svelte`) only has one "Continue" button wired to this handler.

Additionally, `DiveResults.svelte` does not know whether the exit was voluntary (exit ladder) vs forced (O2 depleted). The `DiveResults` interface (`src/ui/stores/gameState.ts:158–171`) has `forced: boolean` but the component doesn't use it to show different CTAs.

### What Needs to Change

**1. `src/ui/stores/gameState.ts`** — Add `layerCompleted: number` and `canDiveDeeper: boolean` to `DiveResults` interface:
```typescript
export interface DiveResults {
  dustCollected: number
  shardsCollected: number
  crystalsCollected: number
  geodesCollected: number
  essenceCollected: number
  artifactsFound: number
  blocksMined: number
  maxDepth: number
  forced: boolean
  streakDay?: number
  streakBonus?: boolean
  relicsCollected?: Relic[]
  // ADD THESE:
  layerCompleted: number       // 0-indexed layer that was just finished
  canDiveDeeper: boolean       // false if forced exit OR on max layer
}
```

**2. `src/game/GameManager.ts`** — In `endDive()` (~line 1246), populate new fields when setting `diveResults`:
```typescript
// In the diveResults.set({ ... }) call, add:
layerCompleted: this.currentLayer,
canDiveDeeper: !forced && this.currentLayer < BALANCE.MAX_LAYERS - 1,
```

**3. `src/game/GameManager.ts`** — Add `continueToNextLayer()` method. Model it after `handleDescentShaft()` (~line 820) but sourced from stored dive data rather than a live scene:
```typescript
continueToNextLayer(): void {
  if (!this.game) return
  const dr = get(diveResults)
  if (!dr || !dr.canDiveDeeper) return

  const nextLayer = dr.layerCompleted + 1
  this.currentLayer = nextLayer
  currentLayerStore.set(nextLayer)
  this.onLayerAdvance()

  const layerSeed = (this.diveSeed + nextLayer * 1000) >>> 0
  const factIds = factsDB.getAllIds()

  let nextBiome: Biome
  if (this.biomeSequence.length > nextLayer) {
    nextBiome = this.biomeSequence[nextLayer]
  } else {
    const biomeRng = seededRandom(layerSeed ^ 0xb10e5)
    nextBiome = pickBiome(biomeRng, nextLayer)
  }
  currentBiomeStore.set(nextBiome.name)
  currentBiomeId.set(nextBiome.id)

  const oxygenTanks = BALANCE.STARTING_OXYGEN_TANKS   // fresh tanks on new dive-deeper
  diveResults.set(null)
  this.game.scene.stop('MineScene')
  this.game.scene.start('MineScene', {
    seed: layerSeed,
    oxygenTanks,
    inventorySlots: BALANCE.STARTING_INVENTORY_SLOTS,
    facts: factIds,
    layer: nextLayer,
    inventory: [],
    blocksMinedThisRun: 0,
    artifactsFound: [],
    biome: nextBiome,
    companionEffect: this.companionEffect,
  })
  currentScreen.set('mining')
}
```

**4. `src/ui/components/DiveResults.svelte`** — Update props and template:
```typescript
// Props
interface Props {
  onContinue: () => void
  onDiveDeeper?: () => void   // ADD
}
let { onContinue, onDiveDeeper }: Props = $props()
```
In the template, replace the single "Continue" button with conditional CTAs:
```svelte
<div class="cta-row">
  {#if $diveResults?.canDiveDeeper && onDiveDeeper}
    <button class="continue-btn secondary" type="button" onclick={onContinue}>
      Return to Dome
    </button>
    <button class="continue-btn primary" type="button" onclick={onDiveDeeper}>
      Dive Deeper →
    </button>
  {:else}
    <button class="continue-btn" type="button" onclick={onContinue}>
      Continue
    </button>
  {/if}
</div>
```

**5. `src/App.svelte`** — Wire up the new handler at the DiveResults render site (~line 919):
```svelte
<DiveResults
  onContinue={handleDiveResultsContinue}
  onDiveDeeper={() => { diveResults.set(null); getGM()?.continueToNextLayer() }}
/>
```
Note: `handleDiveResultsContinue` already calls `diveResults.set(null)`, so the onDiveDeeper lambda can call `continueToNextLayer()` directly after clearing results.

### Acceptance Criteria
- [ ] After voluntarily exiting the mine (exit ladder), DiveResults shows BOTH "Return to Dome" (secondary) and "Dive Deeper →" (primary) buttons
- [ ] After forced exit (O2 depleted), DiveResults shows ONLY "Continue" / "Return to Dome" — no dive deeper option
- [ ] Clicking "Dive Deeper →" immediately starts the next layer (layer+1) in MineScene — no dome visit
- [ ] Clicking "Return to Dome" behaves as before (goes to dome, processes artifacts if any)
- [ ] `canDiveDeeper` is false on the last layer (BALANCE.MAX_LAYERS - 1)
- [ ] Typecheck: 0 new errors

---

## Sub-step 51.2 — Re-entering mine after dome visit is unresponsive

### User Report
> "when manually clicking the mine again, my previous selection is selected and i get transported to level 1 of the mine, but its again an empty level where I cannot move and all I can do is go to the surface"

### Root Cause (exact)

**Bug A — TickSystem callback leak**
`src/game/scenes/MineScene.ts:3676–3692` — `handleShutdown()` only unregisters one callback:
```typescript
private handleShutdown(): void {
  this.hazardSystem?.clearAll()
  TickSystem.getInstance().unregister('hazard-system')  // ← only this one
  this.lootPop?.destroy()
  // ... (instability and mine-events are NOT unregistered)
}
```
Meanwhile, `create()` registers three callbacks:
```typescript
TickSystem.getInstance().register('hazard-system', ...)   // line ~541
TickSystem.getInstance().register('instability', ...)     // line ~565
TickSystem.getInstance().register('mine-events', ...)     // line ~576
```
On `currentLayer === 0` (fresh dive), `resetAll()` clears callbacks. But on layer descent, only `resetLayerTick()` is called (doesn't clear callbacks). The stale `instability` and `mine-events` callbacks from the previous scene instance remain registered and point to destroyed scene objects. When the new scene's `create()` runs, they get re-registered (overwriting the old ones), but in the brief window between `handleShutdown()` and `create()` completing, if `TickSystem.advance()` is called, the stale callbacks may throw — silently breaking scene initialization.

**Bug B — Double shutdown listener**
`src/game/scenes/MineScene.ts:580` registers the shutdown handler on every `create()`:
```typescript
this.events.on('shutdown', this.handleShutdown, this)
```
Phaser's EventEmitter3 does NOT deduplicate `.on()` calls. After stop→start→stop, `handleShutdown()` fires **twice** on the second stop. This double-invocation calls `.destroy()` on already-destroyed objects (e.g., `this.lootPop?.destroy()` on a null/destroyed LootPopSystem), which may throw or corrupt scene state before the next `create()` runs.

### What Needs to Change

**`src/game/scenes/MineScene.ts` — `handleShutdown()` method (~line 3676)**

Add the two missing unregistrations and a guard against double-registration:
```typescript
private handleShutdown(): void {
  // Guard: remove this listener immediately so it doesn't fire twice on stop→start→stop
  this.events.off('shutdown', this.handleShutdown, this)

  this.hazardSystem?.clearAll()
  TickSystem.getInstance().unregister('hazard-system')
  TickSystem.getInstance().unregister('instability')    // ADD
  TickSystem.getInstance().unregister('mine-events')    // ADD
  this.lootPop?.destroy()
  this.biomeParticles?.destroyAll()
  this.biomeParticles = null
  this.audioManager?.stopAll()
  this.audioManager = null
  this.glowSystem?.destroy()
  this.glowSystem = null
  this.animatedTileSystem?.reset()
  this.animatedTileSystem = null
  this.gearOverlay?.destroy()
  this.gearOverlay = null
  this.game.events.off('mineSwingFrame')
}
```

The `this.events.off(...)` at the top ensures that on scene stop→start→stop, the handler registered in the first `create()` is removed before it can be re-invoked, and the new handler registered in the second `create()` will be the sole listener.

### Acceptance Criteria
- [ ] Player can: start dive → exit ladder → dome → "Mine Entrance" → second dive is fully interactive
- [ ] Tiles are clickable, player sprite is visible and responds to input, O2 bar counts down
- [ ] No JS console errors during second dive startup
- [ ] TickSystem has exactly 3 callbacks after second scene `create()` ('hazard-system', 'instability', 'mine-events') — no duplicates
- [ ] If TickSystem is a singleton, verify `Object.keys(ts.callbacks).length === 3` (or however the map is exposed for testing)

---

## Sub-step 51.3 — All consumables available without buying them

### User Report
> "I have all these consumables available to cycle through when entering a mine, why are these available without buying them?"

### Root Cause (exact)
`src/ui/components/DivePrepScreen.svelte` — `cycleConsumableSlot()` (~line 113):
```typescript
function cycleConsumableSlot(slot: SlotIndex): void {
  selectedLoadout.update(l => {
    const slots = [...l.consumableSlots] as [string | null, string | null, string | null]
    const currentId = slots[slot]
    const currentIdx = currentId ? CONSUMABLE_OPTIONS.findIndex(c => c.id === currentId) : -1
    const nextIdx = (currentIdx + 1) % (CONSUMABLE_OPTIONS.length + 1)
    slots[slot] = nextIdx < CONSUMABLE_OPTIONS.length ? CONSUMABLE_OPTIONS[nextIdx].id : null
    return { ...l, consumableSlots: slots }
  })
}
```
`CONSUMABLE_OPTIONS` is the full list of all consumable types — it is never filtered by what the player actually owns. `playerSave.consumables` (`Record<string, number>`) tracks owned quantities but is completely ignored here.

Additionally, no quantity is deducted when the player goes into a dive with consumables selected — the consumables are "infinite" in the current implementation.

### What Needs to Change

**`src/ui/components/DivePrepScreen.svelte`**

1. Import `playerSave` store (already imported for other uses — confirm it's accessible).

2. Compute `ownedConsumableOptions` as a derived value:
```typescript
const ownedConsumableOptions = $derived(
  CONSUMABLE_OPTIONS.filter(c => ($playerSave?.consumables?.[c.id] ?? 0) > 0)
)
```

3. Rewrite `cycleConsumableSlot()` to cycle ONLY through owned types, respecting that each owned quantity can only be allocated across slots up to its owned count:
```typescript
function cycleConsumableSlot(slot: SlotIndex): void {
  selectedLoadout.update(l => {
    const slots = [...l.consumableSlots] as [string | null, string | null, string | null]

    // Build a remaining-availability map
    const owned: Record<string, number> = {}
    for (const opt of ownedConsumableOptions) {
      owned[opt.id] = $playerSave?.consumables?.[opt.id] ?? 0
    }
    // Deduct slots already used (excluding current slot being cycled)
    for (let i = 0; i < 3; i++) {
      if (i !== slot && slots[i]) {
        owned[slots[i]!] = Math.max(0, (owned[slots[i]!] ?? 0) - 1)
      }
    }

    // Build the cycle list: only types with remaining availability
    const available = ownedConsumableOptions.filter(c => owned[c.id] > 0)
    if (available.length === 0) {
      slots[slot] = null
      return { ...l, consumableSlots: slots }
    }

    const currentId = slots[slot]
    const currentIdx = currentId ? available.findIndex(c => c.id === currentId) : -1
    // Cycle: current → next available → ... → null → first available
    if (currentIdx === available.length - 1) {
      slots[slot] = null
    } else if (currentIdx === -1) {
      slots[slot] = available[0].id
    } else {
      slots[slot] = available[currentIdx + 1].id
    }
    return { ...l, consumableSlots: slots }
  })
}
```

4. Show owned count badge on each filled slot in the template:
```svelte
{#if slotId}
  <span class="cons-owned">×{$playerSave?.consumables?.[slotId] ?? 0}</span>
{/if}
```

5. Show empty state when no consumables owned:
```svelte
{#if ownedConsumableOptions.length === 0}
  <p class="empty-hint">Find consumables while mining to equip them here.</p>
{/if}
```

**`src/game/GameManager.ts`** — In `startDive()` (~line 1025), after consuming oxygen tanks, deduct one of each selected consumable type from `playerSave.consumables`:
```typescript
// Deduct consumables from save before dive starts
const loadout = get(selectedLoadout)
if (loadout.consumableSlots) {
  const consumed: Record<string, number> = {}
  for (const id of loadout.consumableSlots) {
    if (id) consumed[id] = (consumed[id] ?? 0) + 1
  }
  playerSave.update(s => {
    if (!s) return s
    const consumables = { ...(s.consumables ?? {}) }
    for (const [id, qty] of Object.entries(consumed)) {
      consumables[id] = Math.max(0, (consumables[id] ?? 0) - qty)
    }
    return { ...s, consumables }
  })
}
```

**`src/data/types.ts`** — Ensure `PlayerSave.consumables` is typed:
```typescript
consumables?: Record<string, number>  // quantity owned per consumable ID
```
If the field doesn't exist, add it and add a migration guard in `src/services/saveService.ts`:
```typescript
if (!save.consumables) save.consumables = {}
```

### Acceptance Criteria
- [ ] Fresh player: all 3 consumable slots show empty with "Find consumables while mining" hint
- [ ] After receiving a bomb via DEV panel (+Bomb button), bomb appears as cycleable option
- [ ] Owned count badge (e.g. "×2") shown on each slot when filled
- [ ] Cannot cycle to a consumable type when owned count is 0
- [ ] Cannot select same type in 2 slots when only 1 owned
- [ ] Starting a dive deducts 1 of each selected consumable type from owned inventory
- [ ] After deduction, refreshing dive prep shows updated counts

---

## Sub-step 51.4 — All relics shown without finding them

### User Report
> "the same goes for relics"

### Root Cause (exact)
`src/ui/components/DivePrepScreen.svelte` (~line 167):
```typescript
const displayRelics = $derived(
  $relicVault.length > 0 ? $relicVault : RELIC_CATALOGUE
)
```
`RELIC_CATALOGUE` is the full list of every relic in the game. When `relicVault` is empty (always for new players), the fallback exposes every relic for selection. This was a dev shortcut, never intended for production.

The `relicVault` store (`src/ui/stores/playerData.ts` or `gameState.ts`) tracks only relics the player has actually found during dives. For fresh players it is `[]`.

### What Needs to Change

**`src/ui/components/DivePrepScreen.svelte`**

Remove the `RELIC_CATALOGUE` fallback entirely. Always use `$relicVault`:
```typescript
// BEFORE:
const displayRelics = $derived(
  $relicVault.length > 0 ? $relicVault : RELIC_CATALOGUE
)

// AFTER:
const displayRelics = $derived($relicVault)
```

Add an empty state in the template when vault is empty:
```svelte
{#if displayRelics.length === 0}
  <p class="empty-hint">No relics discovered yet — find them during dives!</p>
{:else}
  <div class="relic-list">
    {#each displayRelics as relic}
      <!-- existing relic button markup unchanged -->
    {/each}
  </div>
{/if}
```

Remove the `RELIC_CATALOGUE` import from `DivePrepScreen.svelte` if no longer used elsewhere in that file.

### Acceptance Criteria
- [ ] Fresh player: relic section shows only "No relics discovered yet" — no relic buttons
- [ ] After finding a relic in a mine and surfacing, it appears in vault on next dive prep screen
- [ ] DEV panel (if it has a "give relic" function) still works for testing — this is server-side or store manipulation, not affected by this UI change
- [ ] Equipping works correctly once relics are in vault
- [ ] Typecheck: no import errors after removing RELIC_CATALOGUE

---

## Sub-step 51.5 — Pickaxe UI shows all tiers; should be owned-only dropdown

### User Report
> "when I start, I see the option for the standard pickaxe and the reinforced pick, why are these available from the start, and why would it even show the standard pick, instead, we should be able to select gear, and clicking the pickaxe option should open a dropdown to select the pick, by default picking the last selected one in the last mine"

### Root Cause (exact)
`src/ui/components/DivePrepScreen.svelte` (~line 242):
```svelte
<div class="pickaxe-grid">
  {#each PICKAXE_OPTIONS as pick}     <!-- ALL pickaxes, no ownership check -->
    {@const isSelected = $selectedLoadout.pickaxeId === pick.id}
    <button class={`pickaxe-btn${isSelected ? ' selected' : ''}`} ...>
```
`PICKAXE_OPTIONS` is a static list of every pickaxe tier. There is no `playerSave.ownedPickaxes` field — pickaxe progression is tracked differently (tier index in balance config), but UI doesn't filter by what the player has reached.

Additionally, the flat grid pattern shows every pickaxe simultaneously, even if the player only has one. The user wants a "gear slot" UX: one button showing the selected pickaxe, tapping reveals a dropdown of owned options.

### What Needs to Change

**`src/data/types.ts`** — Add `ownedPickaxes: string[]` to `PlayerSave`:
```typescript
ownedPickaxes?: string[]   // list of pickaxe IDs the player can use; default ['pickaxe_standard']
```

**`src/services/saveService.ts`** — Migration guard for existing saves:
```typescript
if (!save.ownedPickaxes || save.ownedPickaxes.length === 0) {
  save.ownedPickaxes = ['pickaxe_standard']
}
```

**`src/ui/components/DivePrepScreen.svelte`**

1. Compute owned pickaxes from save:
```typescript
const ownedPickaxes = $derived(
  PICKAXE_OPTIONS.filter(p => ($playerSave?.ownedPickaxes ?? ['pickaxe_standard']).includes(p.id))
)
```

2. Add local state for dropdown:
```typescript
let pickaxeDropdownOpen = $state(false)
```

3. Replace the pickaxe grid with a gear-slot + dropdown pattern:
```svelte
<!-- Gear slot button -->
<div class="gear-slot-wrap">
  <button
    class="gear-slot-btn"
    type="button"
    onclick={() => { pickaxeDropdownOpen = !pickaxeDropdownOpen }}
    aria-label="Select pickaxe"
  >
    <span class="gear-slot-icon">⛏</span>
    <span class="gear-slot-name">{currentPickaxeName}</span>
    <span class="gear-slot-arrow">{pickaxeDropdownOpen ? '▲' : '▼'}</span>
  </button>

  {#if pickaxeDropdownOpen}
    <div class="gear-dropdown">
      {#each ownedPickaxes as pick}
        <button
          class={`gear-option${$selectedLoadout.pickaxeId === pick.id ? ' selected' : ''}`}
          type="button"
          onclick={() => { selectPickaxe(pick.id); pickaxeDropdownOpen = false }}
        >
          {pick.name}
          {#if $selectedLoadout.pickaxeId === pick.id}<span class="checkmark">✓</span>{/if}
        </button>
      {/each}
    </div>
  {/if}
</div>
```

4. Persist last-used pickaxe: `selectedLoadout` already persists `pickaxeId` across sessions via the store — confirm this is backed by `singletonWritable` or localStorage so it survives page refresh.

**`src/game/GameManager.ts`** — When the player upgrades/crafts a pickaxe, push to `ownedPickaxes`:
```typescript
playerSave.update(s => s ? {
  ...s,
  ownedPickaxes: [...(s.ownedPickaxes ?? ['pickaxe_standard']), newPickaxeId]
} : s)
```

### Acceptance Criteria
- [ ] Fresh player: one gear slot shows "Standard Pickaxe"; tapping reveals dropdown with only that option
- [ ] Dropdown closes after selection
- [ ] Last-selected pickaxe is pre-selected on next dive prep (persists across sessions)
- [ ] Reinforced pickaxe does NOT appear in dropdown until crafted/unlocked
- [ ] After unlocking a second pickaxe (via DEV panel or crafting), it appears in the dropdown
- [ ] Typecheck: no errors with new optional `ownedPickaxes` field

---

## Sub-step 51.6 — Artifact mined but never appears in facts

### User Report
> "i collected an artifact in the mine and surfaced, but I dont see it added to my facts"

### Root Cause (to verify)
The artifact pipeline exists and is partially wired:

1. **Mine side**: `ArtifactNode` block is mined → added to `this.inventory` in `MineScene` as `{ type: 'artifact', factId: '...' }`
2. **Surface side**: `endDive()` in `GameManager.ts:~1275` processes inventory:
```typescript
if (slot.type === 'artifact' && slot.factId) {
  artifactFactIds.push(slot.factId)
}
```
3. **Queue**: `pendingArtifacts.update(existing => [...existing, ...artifactFactIds])` — pushes fact IDs to the pending queue
4. **Review trigger**: `handleDiveResultsContinue()` in `App.svelte:573`:
```typescript
const pending = get(pendingArtifacts)
if (pending.length > 0) {
  getGM()?.reviewNextArtifact()
} else {
  getGM()?.goToBase()
}
```
5. **Study Manager**: `reviewNextArtifact()` sets `currentScreen.set('factReveal')` to show the artifact appraisal

**Suspected bug locations** (verify in order):
- Is `slot.factId` actually populated when `ArtifactNode` is mined? Check `MineScene.ts` where ArtifactNode blocks are collected — the `factId` field must be set on the inventory slot.
- Is `pendingArtifacts` populated correctly? Add a `console.log` temporarily in `endDive()` after the pendingArtifacts update to confirm IDs are pushed.
- Is `factReveal` screen properly implemented? `currentScreen.set('factReveal')` must match a rendered branch in `App.svelte`.
- After viewing the artifact, is `updateReviewState(factId, ...)` called to add it to the knowledge base?

### What Needs to Change

**Verify/Fix 1 — `src/game/scenes/MineScene.ts`**: Find where ArtifactNode blocks are collected (search for `type: 'artifact'` or `ArtifactNode` in the mining logic). Confirm the inventory push includes a `factId`:
```typescript
// Should look like:
this.inventory[emptySlot] = {
  type: 'artifact',
  factId: cell.content?.factId ?? null,   // ← must be non-null
  artifactRarity: cell.content?.artifactRarity,
}
```
If `factId` is null/undefined at collection time, fix by ensuring `MineGenerator.ts` populates `cell.content.factId` when placing ArtifactNode blocks.

**Verify/Fix 2 — `src/App.svelte`**: Confirm `factReveal` screen branch exists:
```svelte
{:else if $currentScreen === 'factReveal'}
  <!-- Artifact appraisal / fact reveal screen -->
```
If this branch is missing or broken, the player sees a blank/wrong screen after surfacing.

**Verify/Fix 3 — After artifact review**: The fact reveal/appraisal screen must call `updateReviewState(factId, true, category)` to register the fact as learned, AND call `playerSave.update(s => ({ ...s, learnedFacts: [...s.learnedFacts, factId] }))` to mark it as known.

**Verify/Fix 4 — `pendingArtifacts` dequeue**: After each artifact is reviewed, `pendingArtifacts.update(arr => arr.slice(1))` must be called so the queue advances. Confirm `StudyManager.reviewNextArtifact()` does this after each fact reveal.

### Acceptance Criteria
- [ ] Mine an ArtifactNode block (use DEV panel "Force Artifact" or find one naturally)
- [ ] Surface using exit ladder
- [ ] Click "Continue" on DiveResults
- [ ] Artifact appraisal/fact reveal screen appears immediately (before dome)
- [ ] After completing the appraisal quiz, the fact appears in `playerSave.learnedFacts`
- [ ] Fact is visible in Knowledge Tree or study queue
- [ ] `pendingArtifacts` is empty after all artifacts are reviewed

---

## Sub-step 51.7 — Same consumable selectable multiple times beyond owned quantity

### User Report
> "when entering a mine, im able to select multiple consumables, even of the same type, but I only saw a single one of ONE type available to use"

### Root Cause (exact)
The same `CONSUMABLE_OPTIONS` cycle described in 51.3. The cycle does not track how many times a given type has already been selected across other slots. Result: player can put "bomb" in all 3 slots even with only 1 bomb owned.

### What Needs to Change
This is fully resolved by the fix in **Sub-step 51.3** — the rewritten `cycleConsumableSlot()` maintains a remaining-availability map that deducts already-allocated slots. No additional changes needed beyond 51.3.

### Acceptance Criteria
- [ ] With 1 bomb owned: selecting bomb in slot 1 → slot 2 cycling skips bomb (0 remaining)
- [ ] With 2 bombs owned: can fill slots 1 and 2 with bombs, but slot 3 skips bomb
- [ ] Removing bomb from slot 1 makes it available again in other slots

---

## Sub-step 51.8 — No loot summary shown on mine exit

### User Report
> "when we exit a mine and we are able to keep any loot, I want the final screen (so only when we decide or are forced to exit the mine) to show what loot we have gained"

### Root Cause (exact)
The DiveResults interface (`src/ui/stores/gameState.ts:158–171`) tracks some fields:
```typescript
export interface DiveResults {
  dustCollected: number
  shardsCollected: number
  crystalsCollected: number
  geodesCollected: number
  essenceCollected: number
  artifactsFound: number
  blocksMined: number
  maxDepth: number
  forced: boolean
  // ... partial only
}
```
But `DiveResults.svelte` doesn't render a comprehensive loot breakdown. Additionally, `App.svelte:970-998` has an inline loot block inside the screen router that partially shows minerals — this is fragmented and doesn't show artifacts, relics, or facts learned.

### What Needs to Change

**`src/ui/stores/gameState.ts`** — Extend `DiveResults` interface (also required by 51.1):
```typescript
export interface DiveResults {
  // existing fields...
  forced: boolean
  layerCompleted: number        // from 51.1
  canDiveDeeper: boolean        // from 51.1
  // NEW:
  artifactNames: string[]       // fact titles of artifacts found (for display)
  relicNames: string[]          // names of relics found this run
  factsLearnedCount: number     // new facts added to learnedFacts this dive
  layersReached: number         // how many layers were completed
  lootLostToForce: boolean      // true if forced exit caused loot loss
}
```

**`src/game/GameManager.ts`** — Populate new fields in `endDive()`:
```typescript
// When building the diveResults object, add:
artifactNames: artifactFactIds.map(id => factsDB.getById(id)?.front ?? id),
relicNames: (results.collectedRelics ?? []).map(r => r.name),
factsLearnedCount: this.newFactsThisDive,
layersReached: this.currentLayer,
lootLostToForce: forced && !this.currentDiveInsured && !isTutorialFirstDepletion,
```

**`src/ui/components/DiveResults.svelte`** — Build out the loot summary card. Remove the dependency on App.svelte's inline block:
```svelte
<div class="loot-card">
  <h3 class="loot-title">Loot Secured</h3>

  {#if $diveResults?.lootLostToForce}
    <p class="loot-warning">⚠ Run cut short — 30% of in-pack minerals lost</p>
  {:else}
    <p class="loot-safe">✓ Safe return — all loot secured</p>
  {/if}

  <div class="loot-grid">
    {#if $diveResults?.dustCollected > 0}
      <div class="loot-item"><span class="loot-icon">💨</span> {$diveResults.dustCollected} Dust</div>
    {/if}
    {#if $diveResults?.shardsCollected > 0}
      <div class="loot-item"><span class="loot-icon">🔷</span> {$diveResults.shardsCollected} Shards</div>
    {/if}
    {#if $diveResults?.crystalsCollected > 0}
      <div class="loot-item"><span class="loot-icon">💎</span> {$diveResults.crystalsCollected} Crystals</div>
    {/if}
    {#if $diveResults?.geodesCollected > 0}
      <div class="loot-item gem"><span class="loot-icon">🟤</span> {$diveResults.geodesCollected} Geodes</div>
    {/if}
    {#if $diveResults?.essenceCollected > 0}
      <div class="loot-item essence"><span class="loot-icon">✨</span> {$diveResults.essenceCollected} Essence</div>
    {/if}
    {#if ($diveResults?.artifactNames?.length ?? 0) > 0}
      <div class="loot-item artifact">
        <span class="loot-icon">🏺</span>
        {$diveResults?.artifactNames.length} Artifact{$diveResults?.artifactNames.length !== 1 ? 's' : ''}
        <span class="loot-names">{$diveResults?.artifactNames.join(', ')}</span>
      </div>
    {/if}
    {#if ($diveResults?.relicNames?.length ?? 0) > 0}
      <div class="loot-item relic">
        <span class="loot-icon">🔮</span>
        {$diveResults?.relicNames.length} Relic{$diveResults?.relicNames.length !== 1 ? 's' : ''}
        <span class="loot-names">{$diveResults?.relicNames.join(', ')}</span>
      </div>
    {/if}
  </div>

  <div class="run-stats">
    <span>Blocks mined: {$diveResults?.blocksMined ?? 0}</span>
    <span>Depth reached: Layer {($diveResults?.layersReached ?? 0) + 1}</span>
    {#if ($diveResults?.factsLearnedCount ?? 0) > 0}
      <span>Facts learned: {$diveResults?.factsLearnedCount}</span>
    {/if}
  </div>
</div>
```

**`src/App.svelte`** — Remove the inline loot rendering block from the `{:else if $currentScreen === 'diveResults'}` branch (lines ~970–998). The DiveResults component now owns all loot display.

### Acceptance Criteria
- [ ] After any exit, DiveResults shows a loot card with all non-zero mineral types
- [ ] Artifacts found shown with count and names
- [ ] Relics found shown with count and names
- [ ] Facts learned count shown (when > 0)
- [ ] Blocks mined and depth shown in run stats
- [ ] Forced exit shows "30% minerals lost" warning
- [ ] Voluntary exit shows "Safe return" confirmation
- [ ] Zero-quantity items are hidden (no "Dust: 0")

---

## Sub-step 51.9 — Starter dome missing critical rooms; GAIA terminal not clickable

### User Report
> "i dont think the base dome level for new players has all the things we need, for example, i have no way to increase floors, examine collected artifacts to turn them to learnable items, or a way to review etc, all i see is the mine entrance, the materializer, the tiny sapling and the mine entrance. I also see the gaia Te... but i cannot click on it."

### Root Cause (to investigate)

**GAIA Terminal not clickable**: The dome renders room tiles as Phaser game objects in `DomeScene.ts`. The GAIA room tile appears to render but may be missing an interactive zone, or its zone is covered by another element (wrong depth/z-order), or the pointer event on the canvas is blocked by a Svelte overlay at that position.

In `DomeScene.ts` around line 337, GAIA thought bubble taps work:
```typescript
zone.on('pointerdown', () => {
  hubEvents.emit('gaia-bubble-tap', text)
  this.hideThoughtBubble()
})
```
But the **room tile itself** (the GAIA terminal as a room you walk up to) may not have a separate click handler. Search `DomeScene.ts` for the GAIA room type and confirm its `pointerdown` event handler is registered, unblocked, and dispatches to `currentScreen.set(...)` or similar.

**Missing rooms**: The dome's starting floor (floor 0 / tier 1) has limited room slots. The following must be accessible from floor 1:
1. **Study Room / Review** → `currentScreen.set('studySession')` or `'study'`
2. **Artifact Lab** → triggers `reviewNextArtifact()` when artifacts pending, or shows "No artifacts yet"
3. **Floor Upgrade** → shows crafting cost to unlock the next floor tier
4. GAIA terminal → opens GAIA chat/dialogue

### What Needs to Change

**`src/game/scenes/DomeScene.ts`** — Search for the GAIA room tile placement and confirm it has:
```typescript
const gaiaZone = this.add.zone(gaiaTileX, gaiaTileY, TILE_SIZE, TILE_SIZE).setInteractive()
gaiaZone.setDepth(50)   // must be above other dome tiles
gaiaZone.on('pointerdown', () => {
  this.game.events.emit('open-gaia-panel')  // or equivalent
})
```
If the zone exists but depth is wrong, increase its depth. If the zone is missing, add it at the correct tile position.

**`src/App.svelte`** — Wire `'open-gaia-panel'` game event to show the GAIA dialogue:
```typescript
game.events.on('open-gaia-panel', () => {
  currentScreen.set('gaiaChat')  // or equivalent
})
```

**`src/ui/stores/hubLayout.ts`** (or equivalent) — Ensure the following rooms are in the default floor-1 layout for new players:
- Study/Review room (even if it shows "Due: 0" when empty)
- Artifact Lab (shows locked state with "Mine artifacts to unlock" when no artifacts found)
- Floor Upgrade panel (shows cost to unlock tier 2)

If any room is gated behind a progression flag, set its unlock condition to `true` for floor 1 so new players always see it.

**`src/game/scenes/DomeScene.ts`** — For each missing room, register a click zone that emits the appropriate screen change. Reference how existing rooms (Materializer, Mine Entrance) are wired.

### Acceptance Criteria
- [ ] GAIA terminal is clickable and opens a GAIA dialogue/chat panel
- [ ] From dome floor 1, player can access: Study Queue, Artifact Lab, Floor Upgrade
- [ ] Artifact Lab shows "No artifacts yet — find them in mines" when `pendingArtifacts.length === 0`
- [ ] Artifact Lab immediately shows the appraisal flow when `pendingArtifacts.length > 0`
- [ ] Study Queue shows fact due count and allows starting a review session
- [ ] Floor Upgrade shows current tier, upgrade cost, and a button to purchase

---

## Sub-step 51.10 — Settings button hidden behind DEV button

### User Report
> "the settings button is under the dev button and on top of some green button I cannot see, these need to be forcefully separated, and can exist on the same layer next to each other, we can simply disable the dev button later when we go to production"

### Root Cause (exact)
`src/ui/components/DevPanel.svelte` — `.dev-toggle`:
```css
.dev-toggle {
  position: fixed;
  top: 4px;
  right: 4px;
  z-index: 9999;
}
```
The settings button (find it: `grep -rn "settings.*btn\|btn.*settings\|⚙\|settings-toggle" src/`) likely also uses `position: fixed; top: 4px; right: 4px` or similar, causing it to sit under the DEV button at identical coordinates.

### What Needs to Change

**Step 1**: Find the settings button component/element:
```bash
grep -rn "settings\|⚙\|gear.*btn\|btn.*gear" src/ --include="*.svelte" | grep -i "fixed\|position\|top.*right"
```

**Step 2**: Establish a non-overlapping layout. Since DEV button is at `top: 4px; right: 4px` (width ~44px):
- Settings button → `top: 4px; right: 52px` (4px gap + DEV button width)
- Or: stack them with `top: 48px; right: 4px` (below DEV)

Recommended horizontal layout (both visible at top-right):
```css
/* DevPanel.svelte — no change to position needed, but document it */
.dev-toggle {
  position: fixed;
  top: 4px;
  right: 4px;
  z-index: 9999;
}

/* Settings button component — shift left of DEV */
.settings-toggle {
  position: fixed;
  top: 4px;
  right: 52px;   /* 4px gap + ~44px DEV button */
  z-index: 9998;
}
```

**Step 3**: On production (when DEV button is hidden), settings button should revert to `right: 4px`. This can be done via a CSS variable or by conditionally adding a class when `import.meta.env.PROD` is true.

### Acceptance Criteria
- [ ] Both buttons fully visible, no overlap, at any viewport width ≥ 320px
- [ ] Settings button opens the settings screen when clicked
- [ ] DEV button opens the dev panel when clicked
- [ ] Both buttons remain in top-right area (consistent with current layout intent)

---

## Sub-step 51.11 — Floor indicator dots visible on all screens, not just dome

### User Report
> "the floor indication in the dome, the small dots to the right of the screen, should be on top of the dome rendering, now its just stuck on the screen"

### Root Cause (to investigate)
The floor dots likely come from a Svelte component using `position: fixed`. Find it:
```bash
grep -rn "floor.*dot\|floorDot\|floor-dot\|level.*dot\|dot.*level\|floor.*pip\|tier-pip" src/ --include="*.svelte"
```
Based on `FloorUpgradePanel.svelte` which has `.tier-pip` elements, the dots may be rendered there, OR they may be a separate HUD component that's always visible.

If in a Svelte overlay, it needs a `{#if $currentScreen === 'dome'}` wrapper.
If in Phaser (DomeScene), it is already scoped to the dome scene and should work — investigate why it persists between scenes (may be a setScrollFactor issue).

### What Needs to Change

**If it's a Svelte component**: Wrap the floor dot element/component with:
```svelte
{#if $currentScreen === 'dome' || $currentScreen === 'base'}
  <FloorDotIndicator />
{/if}
```

**If it's in Phaser DomeScene**: Ensure the game objects are destroyed in the scene's `shutdown`/`destroy` handler, not just hidden. Or set `setScrollFactor(0)` only while the scene is active.

**If the dots are inside a HUD component** that's always rendered (like `HUD.svelte`): Move them out of the always-on HUD into a dome-only component.

### Acceptance Criteria
- [ ] Floor dots visible only when `currentScreen === 'dome'` or `'base'`
- [ ] Floor dots NOT visible during mine, quiz, study, or results screens
- [ ] Floor dots correctly show current dome tier/level

---

## Sub-step 51.12 — Sidebar content not context-aware

### User Report
> "the sidebar on the right should change based on location, like the dome and or the mine to show relevant information, i dont care about my review due in the middle of the mine"

### Root Cause (exact)
`src/ui/components/DesktopSidePanel.svelte` always renders the same content regardless of `currentScreen`:
```typescript
// Always shows:
// - Player name + streak
// - Facts Mastered count
// - Due for Review count (urgency-colored)
// - Keyboard Shortcuts (collapsed)
```
No import of `currentScreen` store — it has no awareness of the active screen.

### What Needs to Change

**`src/ui/components/DesktopSidePanel.svelte`**

Import the needed stores:
```typescript
import { currentScreen } from '../stores/gameState'
import { currentLayer, oxygenState } from '../stores/gameState'  // or wherever mine state is exported
// Also import blocksMinedThisRunStore, artifactsFoundThisRunStore if they exist
```

Define derived mining stats panel content:
```typescript
const isMining = $derived($currentScreen === 'mining')
const isDome   = $derived($currentScreen === 'dome' || $currentScreen === 'base')
const isStudy  = $derived($currentScreen === 'studySession' || $currentScreen === 'quiz' || $currentScreen === 'factReveal')
```

In the template, switch panel content based on context:
```svelte
<aside class="desktop-side-panel" aria-label="Session overview">

  {#if isMining}
    <!-- Mining panel: real-time mine stats -->
    <div class="panel-section">
      <span class="panel-label">Layer</span>
      <span class="panel-value">{$currentLayer + 1}</span>
    </div>
    <div class="panel-section">
      <span class="panel-label">Oxygen</span>
      <div class="o2-bar">
        <div class="o2-fill" style="width: {oxygenPct}%"></div>
      </div>
      <span class="panel-value">{Math.round(oxygenPct)}%</span>
    </div>
    <!-- blocks mined, artifacts found this run if stores exist -->

  {:else if isStudy}
    <!-- Study panel: session progress -->
    <div class="panel-player">...</div>
    <div class="panel-stats">
      <div class="stat-row">
        <span class="stat-label">Due for Review</span>
        <span class="stat-value due-count">{$dueCount}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Streak</span>
        <span class="stat-value">{$currentStreak} days</span>
      </div>
    </div>

  {:else}
    <!-- Dome / default panel: knowledge overview (existing content) -->
    <div class="panel-player">
      <span class="panel-avatar">⛏</span>
      <div class="panel-info">
        <span class="panel-name">{$displayName}</span>
        <span class="panel-streak">{$currentStreak} day streak</span>
      </div>
    </div>
    <div class="panel-stats">
      <div class="stat-row">
        <span class="stat-label">Facts Mastered</span>
        <span class="stat-value">{$totalMastered}</span>
      </div>
      <div class="stat-row due-row" data-urgency={$dueUrgency}>
        <span class="stat-label">Due for Review</span>
        <span class="stat-value due-count">{$dueCount}</span>
      </div>
    </div>
    <div class="panel-shortcuts">
      <!-- existing keyboard shortcuts panel -->
    </div>
  {/if}

</aside>
```

Add O2 bar styles and mining-specific stats styles. The oxygen percentage can be derived from the `oxygenState` store if it's exported from `gameState.ts`.

### Acceptance Criteria
- [ ] During mine: sidebar shows Layer, Oxygen bar, and any available mine-session stats
- [ ] During dome: sidebar shows Facts Mastered, Due for Review, Streak (existing layout)
- [ ] During quiz/study: sidebar shows Due count and Streak
- [ ] Content switches instantly on `currentScreen` change
- [ ] The desktop media query (≥1200px, pointer:fine) still applies — sidebar hidden on mobile

---

## Sub-step 51.13 — Wrong quiz answer: next question can be the same fact

### User Report
> "when going through a mine and opening the gate with the questions, when getting a fact wrong (in general in the game) the NEXT fact asked should NOT be the same one of course!!!"

### Root Cause (exact)
`src/game/GameManager.ts:943` — `getInterestWeightedFact()` calls:
```typescript
const fact = factsDB.getPacedFact({
  learnedFacts: ps.learnedFacts,
  reviewStates: ps.reviewStates,
  unlockedFactIds: ps.unlockedFactIds,
  newFactsThisDive: this.newFactsThisDive,
  interestWeights,
  // ← NO excludeIds parameter — recently asked/failed facts can be immediately re-asked
})
```
`factsDB.getPacedFact()` (`src/services/factsDB.ts:286`) also has no `excludeIds` parameter in its current signature.

### What Needs to Change

**`src/game/GameManager.ts`**

Add instance fields to track recent quiz facts:
```typescript
private lastAskedFactId: string | null = null
private recentlyFailedFactIds: Set<string> = new Set()
```

Reset in `startDive()`:
```typescript
this.lastAskedFactId = null
this.recentlyFailedFactIds = new Set()
```

Reset `recentlyFailedFactIds` on layer change (in `handleDescentShaft()` or `continueToNextLayer()`):
```typescript
this.recentlyFailedFactIds = new Set()
```

Update `getInterestWeightedFact()` to track and pass exclusions:
```typescript
private getInterestWeightedFact(): Fact | null {
  const ps = get(playerSave)
  const excludeIds = [
    ...(this.lastAskedFactId ? [this.lastAskedFactId] : []),
    ...Array.from(this.recentlyFailedFactIds),
  ]

  if (ps) {
    // ... existing interestWeights setup ...
    const fact = factsDB.getPacedFact({
      learnedFacts: ps.learnedFacts,
      reviewStates: ps.reviewStates,
      unlockedFactIds: ps.unlockedFactIds,
      newFactsThisDive: this.newFactsThisDive,
      interestWeights,
      excludeIds,  // ADD THIS
    })
    if (fact) {
      this.lastAskedFactId = fact.id  // track last asked
      // ... existing new-fact tracking ...
      return fact
    }
  }
  // ... existing fallback ...
}
```

Update all quiz answer handlers to populate `recentlyFailedFactIds` on wrong answer. In `GameManager.handleQuizAnswer()` and `handleLayerQuizAnswer()` etc.:
```typescript
handleQuizAnswer(correct: boolean): void {
  const quiz = get(activeQuiz)
  if (quiz && !correct) {
    this.recentlyFailedFactIds.add(quiz.fact.id)
    // Keep set bounded: if > 5 entries, remove oldest (FIFO via iteration)
    if (this.recentlyFailedFactIds.size > 5) {
      const first = this.recentlyFailedFactIds.values().next().value
      this.recentlyFailedFactIds.delete(first)
    }
  }
  this.quizManager.handleQuizAnswer(correct)
}
// Apply the same pattern to handleRandomQuizAnswer, handleLayerQuizAnswer, handleOxygenQuizAnswer
```

**`src/services/factsDB.ts`** — Add `excludeIds?: string[]` parameter to `getPacedFact()`:
```typescript
getPacedFact(opts: {
  learnedFacts: string[]
  reviewStates: Array<{ factId: string; repetitions: number; nextReviewAt: number }>
  unlockedFactIds?: string[]
  newFactsThisDive?: number
  interestWeights?: Record<string, number>
  maxNewPerDive?: number
  excludeIds?: string[]   // ADD THIS
}): Fact | null {
  const excludeSet = new Set(opts.excludeIds ?? [])

  // In the "due facts" selection, filter out excluded:
  const dueFacts = opts.reviewStates.filter(rs =>
    rs.nextReviewAt <= now && !excludeSet.has(rs.factId)  // ADD exclude check
  )

  // In the unlocked-not-learned selection:
  const unlockedNotLearned = unlockedIds.filter(id =>
    !learnedSet.has(id) && !excludeSet.has(id)  // ADD exclude check
  )

  // In the random/interest-weighted fallback:
  const allFacts = this.getAll().filter(f => !excludeSet.has(f.id))  // ADD exclude check
  // ...
}
```

### Acceptance Criteria
- [ ] Answer a quiz question wrong → next quiz question is a different fact (ID check)
- [ ] The failed fact is not asked again for at least 3 subsequent quizzes in the same dive
- [ ] After descending to a new layer, the exclusion set resets (failed facts can appear again on new layer)
- [ ] `lastAskedFactId` ensures even correctly-answered facts don't repeat immediately
- [ ] If the fact pool is very small (< 5 facts), gracefully falls back to allowing repeats rather than returning null

---

## Playwright Test Scripts

All scripts use Chrome at `http://localhost:5173`. Run with `node /tmp/test-51-N.js`.

### Test 51.1 — Dive Deeper CTA appears on voluntary exit
```js
// /tmp/test-51-1.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'], executablePath: '/opt/google/chrome/chrome' })
  const p = await b.newPage()
  await p.setViewportSize({ width: 1200, height: 800 })
  await p.goto('http://localhost:5173')
  await p.waitForTimeout(1500)

  // Skip onboarding (age gate, name, guest, skip×2, start)
  const age = await p.$('button:has-text("18+")')
  if (age) {
    await age.click(); await p.waitForTimeout(300)
    await p.fill('input[type="text"]', 'Tester')
    await (await p.$('button:has-text("Start Exploring")')).click(); await p.waitForTimeout(400)
    await (await p.$('button:has-text("Continue as Guest")')).click(); await p.waitForTimeout(400)
    let skip = await p.$('button:has-text("Skip")')
    if (skip) { await skip.click(); await p.waitForTimeout(300) }
    skip = await p.$('button:has-text("Skip")')
    if (skip) { await skip.click(); await p.waitForTimeout(300) }
    const start = await p.$('button:has-text("Start")')
    if (start) { await start.click(); await p.waitForTimeout(500) }
  }

  // DEV: Quick Dive
  await (await p.$('.dev-toggle')).click(); await p.waitForTimeout(200)
  const navToggle = await p.$('button:has-text("Navigation")')
  if (navToggle) await navToggle.click(); await p.waitForTimeout(200)
  await (await p.$('button:has-text("Quick Dive")')).click()
  await p.waitForTimeout(4000)

  // DEV: Force surface (exit ladder via DEV or trigger run-complete event)
  // Use JS injection to call endDive(false) for voluntary exit
  await p.evaluate(() => {
    window.__gm = window.__gm || document.querySelector('[data-gm]')
    // Trigger voluntary exit via game events
    const game = window.Phaser?.Game?.instances?.[0]
    if (game) game.events.emit('run-complete', { forced: false })
  })
  await p.waitForTimeout(2000)
  await p.screenshot({ path: '/tmp/test-51-1.png' })

  // Assert: DiveResults screen is showing
  const diveDeeper = await p.$('button:has-text("Dive Deeper")')
  const returnDome = await p.$('button:has-text("Return to Dome")')
  console.log('Dive Deeper button present:', !!diveDeeper)
  console.log('Return to Dome button present:', !!returnDome)

  await b.close()
})()
```

### Test 51.2 — Second dive is interactive
```js
// /tmp/test-51-2.js
// After first dive + dome + re-enter mine, verify tiles respond to clicks
// Key assertion: clicking a tile adjacent to player results in player movement
;(async () => {
  // ... setup and first dive ...
  // ... surface → dome → mine entrance ...
  // After second mine starts, inject a click at player-adjacent tile
  await p.evaluate(() => {
    const scene = window.__phaser?.scene?.getScene('MineScene')
    if (!scene) { console.log('FAIL: MineScene not active'); return }
    console.log('isPaused:', scene.isPaused)
    console.log('player:', scene.player?.gridX, scene.player?.gridY)
  })
  await p.screenshot({ path: '/tmp/test-51-2.png' })
})()
```

### Test 51.3 — Fresh player sees no consumables
```js
// /tmp/test-51-3.js
;(async () => {
  // Clear save
  await p.evaluate(() => localStorage.removeItem('recall-rogue-save'))
  await p.reload(); await p.waitForTimeout(1000)
  // ... skip onboarding ...
  // Open dive prep
  // Assert: consumable slots show empty/locked state, NOT "Bomb" or "Flare" etc.
  const bombSlot = await p.$('.consumable-btn:has-text("💣")')
  console.log('Bomb slot visible on fresh player (should be false):', !!bombSlot)
  await p.screenshot({ path: '/tmp/test-51-3.png' })
})()
```

### Test 51.4 — Fresh player sees no relics
```js
// /tmp/test-51-4.js
;(async () => {
  // Clear save, skip onboarding, open dive prep
  // Assert: relic section shows empty state message
  const emptyHint = await p.$('.empty-hint:has-text("No relics")')
  const relicBtn = await p.$('.relic-btn')
  console.log('Empty hint visible:', !!emptyHint)
  console.log('Relic button visible (should be false):', !!relicBtn)
  await p.screenshot({ path: '/tmp/test-51-4.png' })
})()
```

### Test 51.9 — GAIA terminal clickable
```js
// /tmp/test-51-9.js
;(async () => {
  // Load game, enter dome
  // Click the GAIA terminal area (center of dome, or wherever it's positioned)
  // Use mouse coordinates based on screenshot inspection
  await p.mouse.click(120, 503)  // approximate GAIA terminal position (adjust after screenshot)
  await p.waitForTimeout(500)
  const gaiaPanel = await p.$('[class*="gaia"]') // whatever the GAIA panel selector is
  console.log('GAIA panel opened:', !!gaiaPanel)
  await p.screenshot({ path: '/tmp/test-51-9.png' })
})()
```

### Test 51.10 — Settings and DEV buttons not overlapping
```js
// /tmp/test-51-10.js
;(async () => {
  await p.goto('http://localhost:5173')
  await p.waitForTimeout(1000)
  const devBox = await p.$eval('.dev-toggle', el => el.getBoundingClientRect())
  const settingsBtn = await p.$('[class*="settings"]') // find settings button selector
  if (settingsBtn) {
    const settingsBox = await settingsBtn.evaluate(el => el.getBoundingClientRect())
    const overlapsX = devBox.left < settingsBox.right && devBox.right > settingsBox.left
    const overlapsY = devBox.top < settingsBox.bottom && devBox.bottom > settingsBox.top
    console.log('Buttons overlap (should be false):', overlapsX && overlapsY)
    console.log('DEV box:', devBox)
    console.log('Settings box:', settingsBox)
  }
  await p.screenshot({ path: '/tmp/test-51-10.png' })
})()
```

### Test 51.13 — No repeat quiz after wrong answer
```js
// /tmp/test-51-13.js
;(async () => {
  // Quick dive, force quiz, answer wrong
  // Record fact ID, force another quiz, confirm different fact ID
  await p.evaluate(() => {
    const quiz = window.__svelte_state?.activeQuiz  // however stores are accessible
    console.log('Quiz fact ID:', quiz?.fact?.id)
  })
  // Answer wrong (click option that is NOT correct)
  // Force another quiz
  // Assert: new quiz.fact.id !== previous fact ID
})()
```

---

## Verification Gate

Before marking Phase 51 complete, ALL of the following must pass:

### Code Quality
- [ ] `npm run typecheck` — 0 errors (56 pre-existing a11y warnings acceptable, no new errors)
- [ ] `npm run build` — successful build, no warnings that weren't there before

### Functional — Critical (51.1, 51.2)
- [ ] Voluntary exit → DiveResults shows "Dive Deeper →" and "Return to Dome" buttons
- [ ] "Dive Deeper →" starts the next mine layer without visiting dome
- [ ] Forced exit → DiveResults shows only "Return to Dome" / "Continue"
- [ ] Second dive after dome visit: player can move, tiles are clickable, O2 counts down

### Functional — High (51.3–51.7, 51.13)
- [ ] Fresh player: 0 consumables in dive prep; all slots empty
- [ ] Fresh player: 0 relics in dive prep; "No relics found yet" shown
- [ ] Fresh player: only "Standard Pickaxe" in gear slot dropdown
- [ ] Consumable selection deducts owned quantity; cannot over-select
- [ ] Artifact mined → after surfacing → fact appears in knowledge base
- [ ] Wrong quiz answer → next quiz is a different fact

### Functional — Medium (51.8–51.12)
- [ ] DiveResults loot card shows all non-zero mineral types, artifact names, relic names
- [ ] GAIA terminal is clickable in dome; opens GAIA panel
- [ ] Study queue accessible from dome floor 1
- [ ] Settings button visible and not overlapping DEV button
- [ ] Floor dots only visible during dome screen
- [ ] Sidebar shows mine stats (layer, oxygen) during mining; knowledge stats in dome

### Visual Verification
- [ ] Playwright screenshot: mine layer 0 — player visible, tiles rendered, HUD visible
- [ ] Playwright screenshot: mine layer 1 (after second entry) — same as above, not blank
- [ ] Playwright screenshot: DiveResults — both CTA buttons visible on voluntary exit
- [ ] Playwright screenshot: DivePrepScreen fresh player — empty consumables, empty relics, single pickaxe slot
- [ ] Playwright screenshot: dome — GAIA terminal area, settings and DEV buttons visible side-by-side

---

## Files Affected (Complete List)

| File | Change |
|------|--------|
| `src/ui/stores/gameState.ts` | Extend `DiveResults` interface with `layerCompleted`, `canDiveDeeper`, `artifactNames`, `relicNames`, `factsLearnedCount`, `layersReached`, `lootLostToForce` |
| `src/game/GameManager.ts` | Add `continueToNextLayer()`, `lastAskedFactId`, `recentlyFailedFactIds`; fix `endDive()` to populate new DiveResults fields; fix `handleQuizAnswer*()` to populate recentlyFailedFactIds; fix `startDive()` to deduct consumables |
| `src/game/scenes/MineScene.ts` | Fix `handleShutdown()`: add `events.off()` guard + unregister `instability` and `mine-events` from TickSystem |
| `src/game/scenes/DomeScene.ts` | Fix GAIA terminal click handler; add missing room zones (study, artifact lab, upgrade) |
| `src/ui/components/DiveResults.svelte` | Add `onDiveDeeper` prop; conditional CTA buttons; expanded loot summary card |
| `src/ui/components/DivePrepScreen.svelte` | Owned-only consumables with qty badge; owned-only relics; pickaxe gear-slot + dropdown |
| `src/ui/components/DesktopSidePanel.svelte` | Context-aware content: mining stats / dome knowledge / study progress |
| `src/ui/components/DevPanel.svelte` | Adjust position to not overlap settings button |
| Floor dot component (TBD via grep) | Add `{#if $currentScreen === 'dome'}` conditional |
| Settings button component (TBD via grep) | Adjust `right` CSS offset to sit left of DEV button |
| `src/data/types.ts` | Add `ownedPickaxes?: string[]` to `PlayerSave` |
| `src/services/saveService.ts` | Migration guard: set `ownedPickaxes = ['pickaxe_standard']` if missing |
| `src/services/factsDB.ts` | Add `excludeIds?: string[]` parameter to `getPacedFact()`; filter excluded IDs at each selection point |
| `src/App.svelte` | Wire `onDiveDeeper` to `continueToNextLayer()`; remove inline loot block from diveResults branch |
