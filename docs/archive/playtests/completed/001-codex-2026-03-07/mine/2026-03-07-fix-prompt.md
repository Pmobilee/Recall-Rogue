# Task: Fix 2 Mine Gameplay Issues from Playthrough Testing

Fix two bugs found during mine playthrough testing. Both relate to layer descent mechanics.

---

## Issue 1: O2 Max Resets on Layer Descent (HIGH)

### Symptom
When the player descends from layer 1 to layer 2, the HUD O2 bar shows "71/71" (100% full) even though the player has consumed 229 of their original 300 O2. The bar is misleading — it always appears full on a new layer regardless of actual O2 depletion.

### Root Cause
In `src/game/GameManager.ts` lines 322-330, `handleDescentShaft()` converts the current O2 to fractional tanks:

```ts
const restoredOxygen = Math.min(
  data.oxygenState.current + BALANCE.LAYER_OXYGEN_BONUS + companionLayerO2,
  data.oxygenState.max
)
const oxygenTanks = restoredOxygen / BALANCE.OXYGEN_PER_TANK
```

Then at line 377-379, this fractional value is passed to MineScene:

```ts
this.game.scene.start('MineScene', {
  seed: layerSeed,
  oxygenTanks,
  ...
})
```

In `src/game/scenes/MineScene.ts` line 222, `init()` stores the fractional tanks:

```ts
this.oxygenTanks = data.oxygenTanks ?? BALANCE.STARTING_OXYGEN_TANKS
```

Then at line 386, `create()` calls:

```ts
this.oxygenState = createOxygenState(this.oxygenTanks)
```

In `src/game/systems/OxygenSystem.ts` lines 12-18, `createOxygenState()` sets BOTH current AND max to the same value:

```ts
export function createOxygenState(tanks: number): OxygenState {
  const totalOxygen = tanks * BALANCE.OXYGEN_PER_TANK
  return {
    current: totalOxygen,
    max: totalOxygen,  // <-- BUG: max is set to current, not original max
  }
}
```

So with 0.71 fractional tanks, both current and max become 71, and the bar shows 100%.

The initial oxygen state is pushed to HUD stores via the `mine-started` event in `src/game/GameEventBridge.ts` lines 57-59:

```ts
events.on('mine-started', (data) => {
  oxygenCurrent.set(data.oxygen.current)
  oxygenMax.set(data.oxygen.max)
  ...
})
```

### Fix

**Approach**: Add a `diveMaxOxygen` field to `MineSceneData` that preserves the original max O2 for the entire dive. Pass it through layer transitions so the HUD always shows `current / diveMax` instead of `current / layerMax`.

**Step-by-step:**

1. **`src/game/systems/OxygenSystem.ts`** — Add a `diveMax` field to `OxygenState`:
   ```ts
   export type OxygenState = {
     current: number
     max: number
     diveMax: number  // Original max O2 for the entire dive (does not reset per layer)
   }
   ```
   Update `createOxygenState` to accept an optional `diveMax` parameter:
   ```ts
   export function createOxygenState(tanks: number, diveMax?: number): OxygenState {
     const totalOxygen = tanks * BALANCE.OXYGEN_PER_TANK
     return {
       current: totalOxygen,
       max: totalOxygen,
       diveMax: diveMax ?? totalOxygen,
     }
   }
   ```
   Make sure `consumeOxygen` and `addOxygen` both spread `...state` so they preserve `diveMax` (they already do via spread — verify this).

2. **`src/game/scenes/MineScene.ts`** — Add `diveMaxOxygen` to `MineSceneData` interface (around line 94):
   ```ts
   export interface MineSceneData {
     ...
     diveMaxOxygen?: number  // Original max O2 for the entire dive
     ...
   }
   ```
   In `init()` (around line 222), store it:
   ```ts
   this.diveMaxOxygen = data.diveMaxOxygen ?? (data.oxygenTanks ?? BALANCE.STARTING_OXYGEN_TANKS) * BALANCE.OXYGEN_PER_TANK
   ```
   Add the field declaration near line 116:
   ```ts
   /** @internal */ public diveMaxOxygen: number = BALANCE.STARTING_OXYGEN_TANKS * BALANCE.OXYGEN_PER_TANK
   ```
   In `create()` (line 386), pass `diveMaxOxygen` to `createOxygenState`:
   ```ts
   this.oxygenState = createOxygenState(this.oxygenTanks, this.diveMaxOxygen)
   ```

3. **`src/game/GameManager.ts`** — In `handleDescentShaft()` (around line 377), pass `diveMaxOxygen` through to the new MineScene:
   ```ts
   this.game.scene.start('MineScene', {
     seed: layerSeed,
     oxygenTanks,
     diveMaxOxygen: data.oxygenState.diveMax,  // Preserve original max across layers
     inventorySlots: data.inventory.length,
     ...
   })
   ```
   Also update the `descent-shaft-entered` event emission in `src/game/scenes/MineScene.ts` (around line 1109) to include `diveMax` — it already spreads the oxygenState object which will now include `diveMax`.

4. **`src/game/GameEventBridge.ts`** — In the `mine-started` handler (line 57-59), use `diveMax` for the max store:
   ```ts
   events.on('mine-started', (data) => {
     oxygenCurrent.set(data.oxygen.current)
     oxygenMax.set(data.oxygen.diveMax)  // Use diveMax, not per-layer max
     ...
   })
   ```
   In the `oxygen-changed` handler (line 70-72), also use `diveMax`:
   ```ts
   events.on('oxygen-changed', (state: OxygenState) => {
     oxygenCurrent.set(state.current)
     oxygenMax.set(state.diveMax)  // Use diveMax so bar shows dive-wide progress
     ...
   })
   ```
   **Important**: The low-O2 GAIA warning check on line 73 should ALSO use `diveMax` for the ratio calculation:
   ```ts
   if (!gm.gaiaManager.gaiaLowO2Warned && state.diveMax > 0 && state.current / state.diveMax < 0.25) {
   ```

5. **`src/ui/components/HUD.svelte`** — No changes needed. It already reads from `$oxygenCurrent` and `$oxygenMax` stores. With the store now set to `diveMax`, the HUD will automatically show the correct ratio.

### Acceptance Criteria
- After descending from layer 1 to layer 2, the O2 bar must NOT show 100% when most O2 has been consumed.
- Example: if player starts with 300 O2, uses 229, gets +15 bonus on descent = 86 current. Bar should show "86/300" (28%), not "86/86" (100%).
- The `diveMax` value must remain constant across all layer transitions within a single dive.
- `addOxygen` must still clamp to the per-layer `max` (not `diveMax`) — oxygen caches should not be able to exceed the layer's current max.

---

## Issue 2: Layer Speedrunning — No Mining Requirement for Descent (MEDIUM)

### Symptom
Player reached layer 19 (of 20 max) with only 58 total blocks mined across the entire dive — about 3 blocks per layer. Descent shafts are immediately usable without mining a meaningful number of blocks on the current layer.

### Root Cause
In `src/game/scenes/MineBlockInteractor.ts` lines 569-597, the `BlockType.DescentShaft` case has boss gate checks and animation triggers, but NO minimum-blocks-mined check. The player can walk to a descent shaft and use it immediately after entering any layer.

There is no per-layer blocks-mined counter. Only `blocksMinedThisRun` exists (cumulative across all layers, declared in `src/game/scenes/MineScene.ts` line 141).

### Fix

**Step-by-step:**

1. **`src/data/balance.ts`** — Add a new constant (near the other mining constants, around line 109):
   ```ts
   MIN_BLOCKS_PER_LAYER_FOR_DESCENT: 10,  // Must mine this many blocks on current layer before descent shaft activates
   ```

2. **`src/game/scenes/MineScene.ts`** — Add a per-layer block counter field (near line 141):
   ```ts
   /** @internal */ public blocksMinedThisLayer = 0
   ```
   In `init()` (around line 232), ensure it resets to 0 (it will be 0 by default on each new MineScene start, but be explicit):
   ```ts
   this.blocksMinedThisLayer = 0
   ```

3. **`src/game/scenes/MineBlockInteractor.ts`** — Increment the per-layer counter alongside `blocksMinedThisRun`. Find the line where `scene.blocksMinedThisRun += 1` is incremented (there are several locations — lines 258, 976, 1298). Add `scene.blocksMinedThisLayer += 1` immediately after each one. The main location at line 258:
   ```ts
   scene.blocksMinedThisRun += 1
   scene.blocksMinedThisLayer += 1
   ```
   Do the same at lines 976 and 1298 (these are for mineral vein mining and drill charge destruction respectively).

4. **`src/game/scenes/MineBlockInteractor.ts`** — Add a minimum-blocks gate in the `BlockType.DescentShaft` case (line 569). Insert this check BEFORE the boss gate check:
   ```ts
   case BlockType.DescentShaft: {
     // Require minimum blocks mined on this layer before allowing descent
     if (scene.blocksMinedThisLayer < BALANCE.MIN_BLOCKS_PER_LAYER_FOR_DESCENT) {
       scene.game.events.emit('gaia-toast', `Mine at least ${BALANCE.MIN_BLOCKS_PER_LAYER_FOR_DESCENT - scene.blocksMinedThisLayer} more blocks to stabilize the shaft.`)
       return
     }
     // Phase 36: Boss gate check ...
   ```
   Make sure to import BALANCE at the top of MineBlockInteractor.ts if it isn't already imported (check existing imports first — it likely is already imported).

5. **`src/game/scenes/MineScene.ts`** — In the `blocksMinedThisRun += 1` increment inside the quiz gate handling (around line 760), also add `this.blocksMinedThisLayer += 1`.

### Acceptance Criteria
- Player must mine at least 10 blocks on the current layer before the descent shaft can be used.
- If the player steps onto a descent shaft before mining enough blocks, a GAIA toast message appears telling them how many more blocks they need.
- The per-layer counter resets when entering each new layer.
- The counter is independent from `blocksMinedThisRun` (which is cumulative across all layers).

---

## Verification Steps (run after both fixes)

1. **Typecheck**: `npm run typecheck` — must pass with 0 errors.
2. **Unit tests**: `npx vitest run` — all tests must pass.
3. **Manual verification via Playwright**:
   - Navigate to `http://localhost:5173?skipOnboarding=true&devpreset=mid_dive_active`
   - Enter the mine and check that the O2 bar shows `current/diveMax` (not 100% after descent).
   - Verify the per-layer counter blocks descent shaft usage when fewer than 10 blocks are mined.

---

## Do NOT Change

- Quiz trigger rates or SM-2 algorithm — these are working correctly.
- Dust reward amounts — working as designed.
- Layer entrance quiz system — working correctly.
- Pop quiz cooldown or chance constants — working as designed.
- Any Svelte store patterns or reactivity — unrelated to these fixes.
