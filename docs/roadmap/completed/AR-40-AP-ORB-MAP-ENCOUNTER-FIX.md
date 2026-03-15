# AR-40: AP Orb Position, Map Distribution, Encounter Start Fix

**Status:** Complete
**Created:** 2026-03-15
**Depends on:** AR-39 (completed)

## Overview

Fix 3 issues: (1) AP orb is at top-left corner, needs to be slightly above center of the combat overlay, (2) dungeon map needs StS-style room distribution — rest before boss, elites/shops scattered throughout instead of clustered at rows 12-13, (3) tapping a combat node on the dungeon map never calls startEncounterForRoom() causing an 8s timeout.

## Deliverables

Total: 3 files edited, 4 verification steps

## Tasks

### Section A: AP Orb — Move to Above Center

- [x] **A.1** Edit `src/ui/components/CardCombatOverlay.svelte` CSS — change `.ap-orb` from `top: calc(8px + var(--safe-top)); left: 40px;` to `top: 38%; left: 12px;` — positions it slightly above the vertical center of the overlay, near the left edge
  - Acceptance: AP orb visible at roughly 38% from top of viewport, left side

### Section B: Dungeon Map — StS-Style Distribution

- [x] **B.1** Edit `src/data/balance.ts` `MAP_CONFIG` — change `FORCED_ELITE_ROW: 12` to remove the forced elite row entirely (set to `-1` or remove the special-casing) — elites should be scattered via weighted distribution instead
  - Acceptance: no row forces all-elite
- [x] **B.2** Edit `src/data/balance.ts` `MAP_CONFIG` — change `PRE_BOSS_ROW: 13` to always be `'rest'` (not 50/50 rest/shop) — the row before boss is ALWAYS a rest stop, like StS
  - Acceptance: row 13 is always rest
- [x] **B.3** Edit `src/services/mapGenerator.ts` `assignRoomTypes` — remove the `FORCED_ELITE_ROW` special case that forces all nodes to elite. Instead, elites appear naturally via weighted distribution starting from `ELITE_MIN_ROW`
  - Acceptance: elites appear organically in rows 5-12 based on distribution weights
- [x] **B.4** Edit `src/services/mapGenerator.ts` `assignRoomTypes` — change `PRE_BOSS_ROW` case from `rng() < 0.5 ? 'rest' : 'shop'` to always `'rest'`
  - Acceptance: row before boss is always rest
- [x] **B.5** Edit `src/data/balance.ts` `ROOM_DISTRIBUTION` — increase elite weight in later segments so elites appear more in segments 3-4: segment 1 elite 0.06, segment 2 elite 0.10, segment 3 elite 0.14, segment 4 elite 0.16. Reduce mystery slightly to compensate.
  - Acceptance: elites become more common deeper in the dungeon
- [x] **B.6** Edit `src/data/balance.ts` `MAP_CONFIG` — set `ELITE_MIN_ROW: 6` (elites can't appear before row 6, giving early floors for easy combat)
  - Acceptance: first 5 rows are combat/mystery/treasure only

### Section C: Fix Encounter Start — Missing startEncounterForRoom Call

- [x] **C.1** Edit `src/services/gameFlowController.ts` — at the `case 'combat':` block in the map node selection handler (around line 1245-1249), add `await startEncounterForRoom()` after `currentScreen.set('combat')`. The function containing this switch must be async.
  - Acceptance: tapping a combat node on the map properly starts the encounter without 8s timeout
- [x] **C.2** Verify the containing function is already async (if not, make it async)
  - Acceptance: no TypeScript errors from adding await

### Section D: Verification Gate

- [x] **D.1** Run `npm run typecheck` — 0 errors
  - Acceptance: 0 ERRORS
- [x] **D.2** Run `npm run build` — succeeds
  - Acceptance: build completes
- [x] **D.3** Playwright verify — AP orb visible at mid-left during combat
  - Acceptance: AP number visible and not at extreme top
- [x] **D.4** Playwright verify — encounter starts without timeout on map node tap
  - Acceptance: combat loads immediately, no "timed out" console warning

## Files Affected

| File | Action | Task |
|------|--------|------|
| `src/ui/components/CardCombatOverlay.svelte` | EDIT | A.1 |
| `src/data/balance.ts` | EDIT | B.1-B.2, B.5-B.6 |
| `src/services/mapGenerator.ts` | EDIT | B.3-B.4 |
| `src/services/gameFlowController.ts` | EDIT | C.1-C.2 |
