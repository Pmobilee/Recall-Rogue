# Phase 61: Dome Floor Navigation Fix

## Tech Stack
- Frontend: Svelte 5 + TypeScript (strict), Vite 7, Phaser 3
- Dome Scene: `src/game/scenes/DomeScene.ts` -- multi-floor Phaser scene
- Dome Manifest: `src/game/domeManifest.ts` -- sprite keys and URL maps
- Hub Floors: `src/data/hubFloors.ts` -- room definitions, floor layouts (10 floors: starter, farm, workshop, zoo, museum, market, research, archive, observatory, gallery)
- Hub Layout Types: `src/data/hubLayout.ts` -- `HubFloor`, `HubStack`, `HubSaveState` (contains `unlockedFloorIds: string[]`)
- Player Save: `playerSave` store in `src/ui/stores/playerData.ts` with both `unlockedRooms: string[]` and `hubState: HubSaveState`
- Floor Navigation UI: `src/ui/components/FloorIndicator.svelte` -- pip buttons for each floor
- Hub View: `src/ui/components/HubView.svelte` -- derives `unlockedIds` from `hubState.unlockedFloorIds`
- Balance Config: `src/data/balance.ts` -- `BALANCE.DOME_ROOMS` (6 entries: command, lab, workshop, museum, market, archive)
- Presets: `src/dev/presets.ts` -- `endgame_all_rooms` has all rooms, `post_tutorial` has 2 rooms
- Typecheck: `npm run typecheck` -- must report 0 errors

## Overview

**Goal:** Fix the dome floor navigation so players can actually visit floors beyond Floor 0 (Starter Hub). Currently all floor buttons except Floor 0 are always disabled, even when the player has all rooms unlocked.

**Priority:** CRITICAL -- C1 finding. Without this fix, 9 of 10 dome floors (Farm, Workshop, Zoo, Museum, Market, Research Lab, Archive, Observatory, Achievement Gallery) are completely inaccessible.

**Dependencies:** All prior phases (0-59) complete.

**Estimated Complexity:** Medium -- root cause is a data mapping disconnect between two parallel unlock systems, but the fix touches save schema, presets, hub view, and floor indicator logic.

---

## Root Cause Analysis

There are **two parallel unlock systems** that use different ID namespaces:

### System A: `playerSave.unlockedRooms` (legacy room system)
- Used by: `BaseView.svelte`, `DiveResults.svelte`, `DevPanel.svelte`, `PostDiveHooks.svelte`, `playerData.ts` auto-unlock logic
- IDs from `BALANCE.DOME_ROOMS`: `'command'`, `'lab'`, `'workshop'`, `'museum'`, `'market'`, `'archive'`
- Only 6 rooms defined
- Presets populate this field (e.g., `unlockedRooms: allRoomIds` where `allRoomIds = BALANCE.DOME_ROOMS.map(r => r.id)`)

### System B: `playerSave.hubState.unlockedFloorIds` (floor-based system)
- Used by: `HubView.svelte` (line 50), `FloorIndicator.svelte`, `DomeScene.ts`, `Materializer.svelte`, `WorkshopRoom.svelte`, `hubService.ts`, `LockedFloorPreview.svelte`, `DailyBriefing.svelte`
- IDs from `hubFloors.ts`: `'starter'`, `'farm'`, `'workshop'`, `'zoo'`, `'museum'`, `'market'`, `'research'`, `'archive'`, `'observatory'`, `'gallery'`
- 10 floors defined
- Default: `['starter']` (from `defaultHubSaveState()`)
- Presets set `hubState: defaultHubSaveState()` which only unlocks `'starter'`

### The Disconnect
- Presets set `unlockedRooms: allRoomIds` (System A IDs) but leave `hubState.unlockedFloorIds` at default `['starter']` (System B)
- `HubView.svelte` reads from System B (`hubState.unlockedFloorIds`) to determine which floors to show
- `FloorIndicator.svelte` receives `unlockedIds` from HubView and disables buttons for floors not in the list
- Result: only `'starter'` (Floor 0) is ever enabled, regardless of `unlockedRooms`

### Additionally
- `BALANCE.DOME_ROOMS` only has 6 entries but `hubFloors.ts` defines 10 floors
- The IDs don't match: `'command'` vs `'starter'`, `'lab'` vs `'research'`, etc.
- The auto-unlock logic in `playerData.ts` updates `unlockedRooms` but not `hubState.unlockedFloorIds`
- `hubService.ts` has its own `unlockFloor()` that updates `hubState.unlockedFloorIds` but this is never called from the auto-unlock path

---

## Sub-steps

### 61.1 -- Unify the ID namespace

**Goal:** Establish a single source of truth for which floors/rooms are unlocked. The floor-based system (System B) is the canonical one because it maps directly to `hubFloors.ts` floor definitions used by DomeScene.

**File:** `src/data/balance.ts`

**Tasks:**
1. Update `BALANCE.DOME_ROOMS` to align IDs with `hubFloors.ts` floor IDs:
   - `'command'` -> `'starter'` (floor index 0)
   - `'lab'` stays but needs to map to a floor (currently no floor has id `'lab'` -- research floor has id `'research'`)
   - Add missing entries for: `'farm'`, `'zoo'`, `'research'`, `'observatory'`, `'gallery'`
2. Alternatively (recommended): Keep `BALANCE.DOME_ROOMS` as-is for backward compatibility but add a mapping function that converts legacy room IDs to floor IDs

**File:** `src/ui/stores/playerData.ts`

**Tasks:**
1. Add a derived/computed property or migration function that syncs `unlockedRooms` to `hubState.unlockedFloorIds`
2. When `unlockedRooms` changes, ensure corresponding floor IDs are added to `hubState.unlockedFloorIds`
3. The mapping should be:
   - `'command'` -> `'starter'` (always unlocked)
   - `'lab'` -> no direct floor equivalent (lab actions are on starter floor), OR map to `'research'`
   - `'workshop'` -> `'workshop'`
   - `'museum'` -> `'museum'`
   - `'market'` -> `'market'`
   - `'archive'` -> `'archive'`
   - Additional floor-only IDs: `'farm'`, `'zoo'`, `'research'`, `'observatory'`, `'gallery'`

**Acceptance Criteria:**
- A mapping exists from legacy room IDs to floor IDs
- When playerSave loads, `hubState.unlockedFloorIds` is populated based on `unlockedRooms` if not already set
- No data loss for existing saves

### 61.2 -- Fix HubView floor derivation

**Goal:** Ensure `HubView.svelte` correctly determines which floors are accessible.

**File:** `src/ui/components/HubView.svelte`

**Current code (line 50):**
```typescript
const unlockedIds = $derived($playerSave?.hubState?.unlockedFloorIds ?? ['starter'])
```

**Tasks:**
1. Change `unlockedIds` derivation to merge both sources: `hubState.unlockedFloorIds` AND the mapped version of `unlockedRooms`
2. The merged set should include:
   - All IDs from `hubState.unlockedFloorIds`
   - All floor IDs that correspond to entries in `unlockedRooms` (via the mapping from 61.1)
3. Deduplicate the merged array
4. Ensure `'starter'` is always included

**Acceptance Criteria:**
- With `endgame_all_rooms` preset, `unlockedIds` contains all 10 floor IDs
- With `post_tutorial` preset, `unlockedIds` contains only `['starter']`
- With `mid_game_3_rooms` preset, `unlockedIds` contains `['starter']` plus floors corresponding to `['command', 'lab', 'workshop']`

### 61.3 -- Fix FloorIndicator button logic

**Goal:** Ensure floor buttons are correctly enabled/disabled and clicking works.

**File:** `src/ui/components/FloorIndicator.svelte`

**Current code (line 23):**
```svelte
{@const isUnlocked = unlockedIds.includes(floor.id)}
```

**Tasks:**
1. Verify that `floors` prop receives the full `hubStack.floors` array (all 10 floors) -- currently correct (HubView line 321: `floors={hubStack.floors}`)
2. Verify that `unlockedIds` prop receives the corrected merged array from 61.2
3. Verify that `floor.id` matches the IDs in `unlockedIds` -- this should work once 61.1/61.2 are done since both use `hubFloors.ts` IDs
4. Verify the `onFloorSelect` callback correctly calls `handleFloorSelect` which sets `floorIndex`
5. Verify `goToFloor(floorIndex)` is called on the DomeScene when `floorIndex` changes (HubView lines 85-91)

**Acceptance Criteria:**
- Floor pip buttons are enabled (not greyed out) for unlocked floors
- Clicking an enabled pip button scrolls the Phaser camera to that floor
- Locked floor pips show grey dot and are disabled
- Floor label text updates to show the name of the selected floor

### 61.4 -- Fix DomeScene floor rendering for unlocked floors

**Goal:** Ensure DomeScene renders all unlocked floors, not just starter.

**File:** `src/game/scenes/DomeScene.ts`

**Current code:** `getUnlockedFloors()` (line 413) filters `this.floors` by `this.unlockedIds` which comes from `setHubState()` or `init()`.

**Tasks:**
1. Verify that `setHubState()` receives the corrected `unlockedIds` from HubView (line 80)
2. Verify that `renderAllFloors()` iterates over all unlocked floors (line 462-471)
3. Verify that `goToFloor(index)` correctly computes camera scroll target (line 243-267)
4. Verify that object tap hit-testing works on non-zero floors (line 697-725)

**Acceptance Criteria:**
- DomeScene renders tiles and objects for all unlocked floors stacked vertically
- Camera tween smoothly scrolls between floors
- Tapping objects on any floor triggers the correct action

### 61.5 -- Update presets to populate hubState

**Goal:** Ensure dev presets correctly set `hubState.unlockedFloorIds` so floor navigation works immediately with presets.

**File:** `src/dev/presets.ts`

**Tasks:**
1. Find `allRoomIds` definition: `BALANCE.DOME_ROOMS.map(r => r.id)` -- this produces legacy IDs
2. For `endgame_all_rooms` and similar presets that set `unlockedRooms: allRoomIds`, also set `hubState` with all floor IDs:
   ```typescript
   hubState: {
     ...defaultHubSaveState(),
     unlockedFloorIds: ['starter', 'farm', 'workshop', 'zoo', 'museum', 'market', 'research', 'archive', 'observatory', 'gallery'],
     floorTiers: { starter: 1, farm: 1, workshop: 1, zoo: 1, museum: 1, market: 1, research: 1, archive: 1, observatory: 1, gallery: 1 },
   }
   ```
3. For `mid_game_3_rooms` (unlockedRooms: `['command', 'lab', 'workshop']`), set:
   ```typescript
   hubState: {
     ...defaultHubSaveState(),
     unlockedFloorIds: ['starter', 'workshop'],
     floorTiers: { starter: 1, workshop: 0 },
   }
   ```
4. For `post_tutorial` (unlockedRooms: `['command']`), `hubState` can stay default (`unlockedFloorIds: ['starter']`)
5. For `five_rooms` preset (unlockedRooms includes farm, zoo), add corresponding floor IDs
6. Update all other presets that set `unlockedRooms` to also set matching `hubState.unlockedFloorIds`

**Acceptance Criteria:**
- `endgame_all_rooms`: `hubState.unlockedFloorIds` contains all 10 floor IDs
- `post_tutorial`: `hubState.unlockedFloorIds` is `['starter']`
- `mid_game_3_rooms`: `hubState.unlockedFloorIds` contains `['starter', 'workshop']` at minimum
- All presets pass typecheck

### 61.6 -- Add save migration for existing saves

**Goal:** Existing player saves that have `unlockedRooms` populated but `hubState.unlockedFloorIds` at default should be automatically migrated.

**File:** `src/services/saveService.ts`

**Tasks:**
1. In the save parsing/validation logic (around line 173), add migration:
   - If `unlockedRooms` contains entries beyond `['command']` but `hubState.unlockedFloorIds` is only `['starter']`:
   - Map each legacy room ID to its floor ID and add to `hubState.unlockedFloorIds`
2. Use the same mapping function created in 61.1
3. Ensure idempotency -- running migration on an already-migrated save should not change it

**Acceptance Criteria:**
- A save with `unlockedRooms: ['command', 'lab', 'workshop', 'museum']` and default `hubState` gets migrated to include `['starter', 'workshop', 'museum']` in `unlockedFloorIds`
- A save with correctly populated `hubState.unlockedFloorIds` is not modified
- Migration runs once on load, not on every save

### 61.7 -- Sync auto-unlock logic

**Goal:** When the existing auto-unlock in `playerData.ts` adds a room to `unlockedRooms` after a dive, also add the corresponding floor ID to `hubState.unlockedFloorIds`.

**File:** `src/ui/stores/playerData.ts`

**Current auto-unlock code (around line 358-440):**
```typescript
const currentRooms = save.unlockedRooms ?? ['command']
const newlyUnlocked = BALANCE.DOME_ROOMS
  .filter(room => room.unlockDives > 0 && newDiveCount >= room.unlockDives && !currentRooms.includes(room.id))
```

**Tasks:**
1. After adding newly unlocked room IDs to `unlockedRooms`, also add the mapped floor IDs to `hubState.unlockedFloorIds`
2. Use the mapping function from 61.1
3. Also update `floorTiers` for newly unlocked floors (set to tier 0)

**Acceptance Criteria:**
- Completing dive #3 (which unlocks `'workshop'` room) also adds `'workshop'` to `hubState.unlockedFloorIds`
- The floor button for Workshop becomes enabled immediately after the dive
- No duplicate entries in `unlockedFloorIds`

---

## Verification Gate

All of the following must pass before Phase 61 is marked complete:

1. **Typecheck:** `npm run typecheck` -- 0 errors
2. **Build:** `npm run build` -- succeeds without errors
3. **Unit tests:** `npx vitest run` -- all tests pass
4. **Preset: endgame_all_rooms:**
   - Navigate to `?skipOnboarding=true&devpreset=endgame_all_rooms`
   - Screenshot the FloorIndicator -- all 10 pip buttons should be visible
   - All pips should be enabled (not grey), current pip (Floor 0) should be highlighted green
   - Click each pip -- camera should tween to each floor showing its objects
   - Use `browser_evaluate(() => window.__terraDebug())` to confirm DomeScene has 10 unlocked floors
5. **Preset: post_tutorial:**
   - Navigate to `?skipOnboarding=true&devpreset=post_tutorial`
   - Only Floor 0 pip should be enabled, all others grey/disabled
   - Clicking disabled pips should do nothing
6. **Preset: mid_game_3_rooms:**
   - Navigate to `?skipOnboarding=true&devpreset=mid_game_3_rooms`
   - Correct subset of floor pips enabled (starter + mapped rooms)
7. **Object interaction:**
   - On any non-zero floor, tapping an interactive object triggers the correct action
   - Verify via console logs or `hubEvents` emission
8. **Save migration:**
   - Create a save with `unlockedRooms: ['command', 'workshop', 'museum']` but default `hubState`
   - Reload -- verify floors for workshop and museum are now accessible

---

## Files Affected

| File | Change Type |
|------|-------------|
| `src/data/balance.ts` | Possibly update `DOME_ROOMS` IDs or add mapping |
| `src/ui/stores/playerData.ts` | Add room-to-floor mapping, sync auto-unlock |
| `src/ui/components/HubView.svelte` | Fix `unlockedIds` derivation to merge both sources |
| `src/ui/components/FloorIndicator.svelte` | Verify (likely no changes needed) |
| `src/game/scenes/DomeScene.ts` | Verify (likely no changes needed) |
| `src/dev/presets.ts` | Add `hubState` with correct `unlockedFloorIds` to all presets |
| `src/services/saveService.ts` | Add save migration for existing saves |
| `src/data/hubLayout.ts` | Possibly add/export mapping constant |

---

## Risk Assessment

- **Low risk:** FloorIndicator and DomeScene code is already correct -- they just receive wrong data
- **Medium risk:** Two parallel ID systems means any fix must handle both, or migrate one to the other
- **Key decision:** Whether to fully deprecate `unlockedRooms` in favor of `hubState.unlockedFloorIds`, or keep both in sync. Recommended: keep both for now with a sync layer, plan full migration for a future phase
- **Backward compatibility:** Must preserve existing saves -- migration in saveService handles this
