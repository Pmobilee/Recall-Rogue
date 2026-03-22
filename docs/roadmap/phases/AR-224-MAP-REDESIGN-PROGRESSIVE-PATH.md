# AR-224: Map Redesign — Progressive Path View

> **Source:** [Playtest Feedback 2026-03-22](../PLAYTEST-FEEDBACK-2026-03-22.md) — Issues #34, #35, #36
> **Priority:** P1 — Major UI overhaul
> **Complexity:** Large (complete map redesign + generation rebalancing)
> **Dependencies:** None (independent system)

---

## Overview

Complete redesign of the dungeon map. Replace the full map overview with a progressive, step-by-step path view. Players see only their NEXT choices, with a scrollable history of past decisions. Also rebalance map generation for better global room distribution and increase desktop floor length to 12 regular nodes.

---

## User's Exact Words

- **#34:** "I hate the map! I from now on don't want to see the entire map of the floor, I want to see the NEXT options we have each time, even the first time we select, and instead of a blue line I want it to be like a path mark with - - - - -> in off white with black borders leading to the circles. These paths must spring from the last selected node, so all we can see after a while is scroll down and see all our choices in the past, along with all the ones we haven't taken, so we can sort of see how through time, centered in the middle of the screen, our choices got us where we are. No more planning beforehand. This means we disable our map animation at the start, and our entire map view!"
- **#35:** "Even though the map is seeded and the same for that seed every time, we must improve our generation and make sure every path sees an elite, a shop, a rest etc more evenly spread. BUT NOT FORCED, people must be able to take paths in their own way and try to avoid, though not always able to avoid. Basically its already pretty good now but not very balanced."
- **#36:** "Also, on desktop, floors can be 12 length so change it!"

---

## Worker Notes — Read Before Implementing

These notes resolve known ambiguities and pitfalls. Implement them exactly as described.

### Correct file locations
- `src/ui/components/DungeonMap.svelte` — the map component. This is what gets redesigned. It is rendered by `CardApp.svelte`.
- `src/ui/components/MapNode.svelte` — individual map node component.
- `src/services/mapGenerator.ts` — map generation logic, `selectMapNode()`, `MAP_CONFIG`.
- `src/services/floorManager.ts` — `FloorState` interface containing `actMap`. Path decision history tracking goes here.
- `src/data/balance.ts` — `MAP_CONFIG` with `ROWS_PER_ACT = 8 as const`. `PRE_BOSS_ROW` and `BOSS_ROW` are reserved rows.
- **Does NOT exist:** `src/ui/screens/MapScreen.svelte`, `src/ui/map/` directory, `src/services/runState.ts`. Do not create files in a `src/ui/map/` directory — all new components go in `src/ui/components/`.

### Path history data doesn't exist yet — add it first
`ActMap.visitedNodeIds` records visited nodes but does NOT record which alternatives were available at each decision point. Once `selectMapNode()` is called, siblings get locked — there is no way to reconstruct "at row 3, nodes n0 and n2 were available and I chose n1" from current data.

**Before any UI work**, add to `FloorState`/`ActMap` in `floorManager.ts`:
```ts
decisionHistory: Array<{ selectedId: string; availableIds: string[] }>
```
Populate this inside `selectMapNode()` in `mapGenerator.ts` at the moment of selection, capturing both the chosen node ID and all sibling IDs that were available. This is the data source for the scrollable history view.

### Desktop floor length — clarify "12 nodes"
`MAP_CONFIG.ROWS_PER_ACT = 8` currently. Rows 6 and 7 are `PRE_BOSS_ROW` and `BOSS_ROW`, leaving 6 regular rows. "12 node floor" means **12 regular rows + pre-boss + boss = `ROWS_PER_ACT = 14`** on desktop.

`ROWS_PER_ACT` is declared `as const` — you must loosen this. Create a `getMapConfig(isDesktop: boolean)` function in `mapGenerator.ts` that returns the appropriate config. Call this instead of reading `MAP_CONFIG` directly wherever row count is used. Mobile retains `ROWS_PER_ACT = 8`.

### Desktop detection
`platformService.ts` exports `isDesktop` where `platform === 'desktop'` means Tauri/Steam only. Browser players on wide monitors return `'web'`. For the Steam launch target this is correct behavior — do not change it.

### Scroll direction — invert from current
Current map renders boss at TOP, start at BOTTOM (SVG convention). The new design requires the opposite: current choices at TOP, history scrolls down below. The entire SVG/DOM layout must be inverted relative to what exists today.

### Cinematic — disable, do not delete
The map reveal cinematic (`playCinematic()`) is gated by a `cinematicPlayedForSeed` Set. Keep all cinematic code intact but add a feature flag (e.g., `MAP_CINEMATIC_ENABLED = false` in `balance.ts` or `MAP_CONFIG`) to disable it. Do not delete the code — it may be repurposed.

### SVG path styling — arrowheads require `<marker>`
Current map paths use `<path class="map-edge">` with `stroke-dasharray` for locked edges. The new dashed arrows require SVG `<marker>` definitions for arrowheads. Define a `<defs>` block with a marker element in the SVG and reference it via `marker-end` on each path.

### Map rebalancing — global only, no per-path constraint solving
`assignRoomTypes()` in `mapGenerator.ts` already enforces global counts: 1 rest, 2 shops spaced 2+ rows apart, 2 mystery events, 1-2 elites. These are global counts, not per-path guarantees.

"No path should have 4+ consecutive combat rooms" is a per-PATH constraint and is significantly harder to implement correctly. This is **out of scope for this AR**. Focus on improving the global room distribution weights and spacing rules so that the existing global guarantees are more likely to produce balanced-feeling paths in practice. Document per-path constraint enforcement as a future enhancement (AR-225 or similar). Do not attempt to implement full per-path constraint satisfaction here.

### Seed stability — document as breaking change
If the PRNG call sequence in `mapGenerator.ts` changes (e.g., because `ROWS_PER_ACT` changes or room assignment logic changes), existing saved seeds will produce different maps. This is a **known breaking change** — document it clearly in the PR. Do not attempt to preserve old seed layouts.

---

## Sub-Steps

### 1. Data Layer — Add `decisionHistory` to `FloorState`

**Do this first, before any UI work.**

- **What:** Add `decisionHistory: Array<{ selectedId: string; availableIds: string[] }>` to the `ActMap` or `FloorState` interface in `src/services/floorManager.ts`.
- **What:** Populate it inside `selectMapNode()` in `src/services/mapGenerator.ts`. At the moment of selection, record the selected node ID and all sibling node IDs that shared the same row and were reachable from the previous selected node.
- **What:** Initialize `decisionHistory` as an empty array in map generation.
- **Acceptance:** After selecting each node, `floorManager.getFloorState().actMap.decisionHistory` contains one entry per decision made, with both `selectedId` and `availableIds` correctly populated.

### 2. Desktop Floor Length — `getMapConfig(isDesktop)`

- **What:** In `src/data/balance.ts`, add `MAP_CINEMATIC_ENABLED = false` flag. Loosen `ROWS_PER_ACT` from `as const` if needed.
- **What:** In `src/services/mapGenerator.ts`, create `getMapConfig(isDesktop: boolean)` returning a config object. Desktop: `ROWS_PER_ACT = 14` (12 regular + `PRE_BOSS_ROW` + `BOSS_ROW`). Mobile: `ROWS_PER_ACT = 8` (unchanged).
- **What:** Replace all direct reads of `MAP_CONFIG.ROWS_PER_ACT` (and related constants) with calls to `getMapConfig(isDesktop)`. Use `platformService.isDesktop` to determine the platform at map generation time.
- **What:** Disable the map reveal cinematic via the `MAP_CINEMATIC_ENABLED` flag. Keep `playCinematic()` code intact.
- **Seed note:** This changes the PRNG call sequence — document as breaking change.
- **Acceptance:** Desktop maps generate 14 rows (12 selectable + pre-boss + boss). Mobile maps generate 8 rows. Cinematic does not play. Cinematic code is still present.

### 3. Disable Full Map View

- **What:** In `src/ui/components/DungeonMap.svelte`, remove or gate off any rendering that shows all nodes simultaneously. The player must not be able to see nodes beyond their current decision row.
- **What:** Remove or disable the map reveal animation at floor start (guard on `MAP_CINEMATIC_ENABLED`).
- **What:** The map now only renders: the current decision row (next choices) + the scrollable history below it.
- **Acceptance:** On entering a floor, no full map is shown. No animation plays. Only next choices are visible.

### 4. Progressive Path View — Current Choices

- **What:** Redesign `src/ui/components/DungeonMap.svelte` to show only the player's immediate next choices.
- **Layout:**
  - Top of the scrollable area: the last selected node (or the starting position for row 0), centered horizontally.
  - Below the selected node: dashed arrow paths branching out to each available next node (2-3 options).
  - Each available node shows its room type icon (combat, shop, rest, elite, mystery, treasure, boss).
  - Current choice nodes have a glowing border to indicate they are interactive.
- **Scroll direction:** Current choices are at the TOP. History scrolls DOWN below. This is inverted from the current SVG layout — the layout must be restructured accordingly.
- **Interaction:** Clicking a node calls `selectMapNode()` as before. The view then updates: the chosen node becomes the new "last selected" at top, and the next row of choices appears below it.
- **Acceptance:** Only next choices visible. Selection advances the view. No future rows exposed.

### 5. Dashed Arrow Path Styling

- **What:** Replace current solid/dashed blue lines with dashed arrow paths styled as `- - - - ->`.
- **SVG implementation:**
  - Add a `<defs>` block to the SVG with a `<marker>` element defining an arrowhead.
  - Each path uses `stroke-dasharray` for the dash pattern and `marker-end` referencing the arrowhead marker.
  - Active paths (leading to available choices): off-white (`#F5F0E6`) dashes, 1–2px black outline/shadow, arrowhead pointing to destination node.
  - History paths (already traveled): same style but at reduced opacity (50–70%) to distinguish from current.
- **Acceptance:** All paths are clearly dashed arrows. No solid blue lines remain. Arrowheads are visible and correctly oriented.

### 6. Scrollable Path History

- **What:** Below the current choice view, render all past decisions using `decisionHistory` from Step 1.
- **Layout:**
  - Vertical timeline, centered horizontally.
  - Each past row: the selected node at full color with solid border + all unselected alternatives at 30% opacity with dashed border.
  - Dashed arrow paths connect each row of history vertically, selected-to-selected.
  - The player can scroll down to see their full decision history.
- **Component:** Implement in `src/ui/components/DungeonMap.svelte` directly, or extract to `src/ui/components/MapPathHistory.svelte` if it becomes large. Do NOT create a `src/ui/map/` directory.
- **Visual states:**
  - Selected past node: full color, solid border.
  - Unselected past node: 30% opacity, dashed border.
  - Current choices: full color, glowing border (interactive).
- **Acceptance:** Scrolling down reveals full decision history. Selected vs. available-but-unchosen nodes are clearly distinguished.

### 7. Map Generation Rebalancing

- **Scope:** Global distribution improvement only. Per-path constraint solving is out of scope for this AR.
- **What:** Review and tune `assignRoomTypes()` in `src/services/mapGenerator.ts`. Goals:
  - Improve spacing of elites across rows so they are less likely to cluster.
  - Ensure shops and rest sites are distributed across earlier and later rows, not concentrated at one end.
  - Adjust mystery event placement to be more spread across paths.
  - Improve combat room weighting in early rows vs. late rows if currently imbalanced.
- **What NOT to do:** Do not attempt to guarantee that every individual path through the map encounters a specific room type. That requires per-path constraint satisfaction and is deferred as a future enhancement.
- **Verification:** Run 100+ seeds via a script or the headless sim, log room type distribution across rows. Confirm distribution is more even than before. Document per-path enforcement as a future enhancement (e.g., AR-225).
- **Acceptance:** Room distribution statistics across 100 seeds show improvement. Global counts still satisfy existing rules (1 rest, 2 shops, etc.). No regressions to map generation stability.

---

## Files Affected

- `src/services/floorManager.ts` — add `decisionHistory` to `FloorState`/`ActMap` interface
- `src/services/mapGenerator.ts` — populate `decisionHistory` in `selectMapNode()`; add `getMapConfig(isDesktop)`; rebalancing improvements
- `src/data/balance.ts` — `MAP_CINEMATIC_ENABLED` flag; loosen `ROWS_PER_ACT` const if needed
- `src/ui/components/DungeonMap.svelte` — complete redesign (progressive view, history, scroll direction inversion, disable cinematic)
- `src/ui/components/MapNode.svelte` — visual state updates (selected, unselected-past, current-choice)
- `src/ui/components/MapPathHistory.svelte` (NEW, optional) — extract history section if it becomes large
- `docs/GAME_DESIGN.md` — update Run Structure, Map System, Floor Length sections

**Does NOT create:**
- `src/ui/screens/MapScreen.svelte` (does not exist, do not create)
- `src/ui/map/` directory (do not create — all components go in `src/ui/components/`)
- `src/services/runState.ts` (does not exist, do not create)

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] `npx vitest run` passes
- [ ] `decisionHistory` populated correctly after each `selectMapNode()` call
- [ ] No full map view visible at any point during a run
- [ ] No map reveal animation plays at floor start
- [ ] Cinematic code is still present in source but gated by `MAP_CINEMATIC_ENABLED = false`
- [ ] Only next choices visible at each decision point
- [ ] Current choices render at TOP; history scrolls DOWN below (inverted from old layout)
- [ ] Dashed arrow paths in off-white (`#F5F0E6`) with black borders and SVG arrowheads
- [ ] Past selected nodes: full color, solid border
- [ ] Past unselected nodes: 30% opacity, dashed border
- [ ] Current choice nodes: full color, glowing border
- [ ] Desktop (`platformService.isDesktop`): floors generate 14 rows (12 regular + pre-boss + boss)
- [ ] Mobile: floors still generate 8 rows (unchanged)
- [ ] Map generation rebalancing: run 100 seeds, confirm improved room type distribution vs. baseline
- [ ] Seed stability documented as breaking change in commit message
- [ ] Per-path constraint enforcement noted as future enhancement (not implemented here)
- [ ] `docs/GAME_DESIGN.md` updated: Run Structure, Map System, Floor Length
- [ ] All new components are in `src/ui/components/` — no `src/ui/map/` directory created
- [ ] Playwright visual inspection: progressive path view renders correctly at 1920x1080 landscape
