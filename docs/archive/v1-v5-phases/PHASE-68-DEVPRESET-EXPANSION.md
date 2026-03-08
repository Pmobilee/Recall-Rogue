# Phase 68: Devpreset Expansion

## Tech Stack
- Frontend: Svelte 5 + TypeScript (strict), Vite 7, Phaser 3
- Presets file: `src/dev/presets.ts` -- 20 existing presets, `ScenarioPreset` interface (lines 18-26)
- `BASE_SAVE(now)`: factory function (lines 39-153) that initializes all `PlayerSave` fields
- `makeLearnedFacts(count)`: helper (lines 169-178) that creates `learnedFacts` + `reviewStates` arrays from `PRESET_FACT_IDS`
- `PRESET_FACT_IDS`: 30 real fact IDs (lines 160-167) -- `cult-001..010`, `geo-001..005`, `lsci-001..005`, `hist-001..005`, `nsci-001..005`
- `PlayerSave`: `src/data/types.ts` -- full save structure
- `PendingArtifact`: `src/data/types.ts` lines 68-72 -- `{ factId: string, rarity: Rarity, minedAt: number }`
- `Rarity`: `src/data/types.ts` line 65 -- `'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic'`
- `createReviewState(factId)`: `src/services/sm2.ts` -- creates default SM-2 review state
- Dome room IDs: `BALANCE.DOME_ROOMS` in `src/data/balance.ts` lines 349-356 -- `['command', 'lab', 'workshop', 'museum', 'market', 'archive']`
- Streak milestones: `BALANCE.STREAK_MILESTONES` in `src/data/balance.ts` lines 253-272 -- 19 milestones (days 3, 7, 14, 21, 30, ... 365)
- Typecheck: `npm run typecheck` -- 0 errors

## Overview

**Goal:** Add 5 new devpresets to `src/dev/presets.ts` covering artifact, dome, streak, review, and new-player-returning scenarios that are currently untestable without manual setup.

**Priority:** LOW

**Estimated Complexity:** Low -- single file, additive changes only, follows established preset patterns.

**Dependencies:** Phase 59 (Artifact Analyzer -- `PendingArtifact` type and `pendingArtifacts` field).

---

## Sub-steps

### 68.1 -- `has_pending_artifacts` preset

Add preset #21 to `SCENARIO_PRESETS` array in `src/dev/presets.ts`.

**Specification:**
- `id`: `'has_pending_artifacts'`
- `label`: `'Has Pending Artifacts'`
- `description`: `'Mid-game player with 3 pending artifacts (common, uncommon, rare). Navigate to Artifact Lab to test cracking flow.'`
- `targetScreen`: `'base'` (player navigates to Artifact Lab manually)
- `buildSave(now)`:
  - Base: `BASE_SAVE(now)` spread
  - `learnedFacts` / `reviewStates`: `makeLearnedFacts(15)`
  - `minerals`: `{ dust: 1200, shard: 35, crystal: 5, geode: 0, essence: 0 }`
  - `unlockedRooms`: `['command', 'lab', 'workshop']`
  - `tutorialComplete`: `true`
  - `diveCount`: `10`
  - `pendingArtifacts`: array of 3 `PendingArtifact` objects:
    ```typescript
    [
      { factId: 'cult-001', rarity: 'common', minedAt: now - 3600_000 },
      { factId: 'geo-002', rarity: 'uncommon', minedAt: now - 1800_000 },
      { factId: 'hist-003', rarity: 'rare', minedAt: now - 600_000 },
    ]
    ```
  - `stats`: `totalBlocksMined: 800, totalDivesCompleted: 10, deepestLayerReached: 8, totalFactsLearned: 15, totalFactsSold: 0, totalQuizCorrect: 40, totalQuizWrong: 6, currentStreak: 5, bestStreak: 7, totalSessions: 0, zeroDiveSessions: 0`

**Acceptance Criteria:**
- [ ] Preset loads via `?skipOnboarding=true&devpreset=has_pending_artifacts`
- [ ] Lands on base screen without errors
- [ ] `window.__terraDebug()` shows `pendingArtifacts` with 3 entries
- [ ] Artifact Lab shows 3 artifacts ready to crack

---

### 68.2 -- `all_floors_unlocked` preset

Add preset #22 to `SCENARIO_PRESETS` array.

**Specification:**
- `id`: `'all_floors_unlocked'`
- `label`: `'All Floors Unlocked'`
- `description`: `'Endgame player with all 6 dome rooms unlocked. Tests dome multi-floor navigation.'`
- `targetScreen`: `'base'`
- `buildSave(now)`:
  - Base: `BASE_SAVE(now)` spread
  - `learnedFacts` / `reviewStates`: `makeLearnedFacts(60)`
  - `minerals`: `{ dust: 12_000, shard: 300, crystal: 60, geode: 15, essence: 3 }`
  - `knowledgePoints`: `2000`
  - `unlockedRooms`: `BALANCE.DOME_ROOMS.map(r => r.id) as string[]` (all 6 rooms: command, lab, workshop, museum, market, archive)
  - `tutorialComplete`: `true`
  - `diveCount`: `70`
  - `selectedInterests`: `['Natural Sciences', 'History']`
  - `premiumMaterials`: `{ star_dust: 8, void_crystal: 3, ancient_essence: 1 }`
  - `titles`: `['Explorer', 'Miner']`
  - `activeTitle`: `'Explorer'`
  - `streakFreezes`: `2`
  - `claimedMilestones`: `[3, 7, 14, 30]`
  - `stats`: `totalBlocksMined: 9000, totalDivesCompleted: 70, deepestLayerReached: 18, totalFactsLearned: 60, totalFactsSold: 5, totalQuizCorrect: 400, totalQuizWrong: 30, currentStreak: 25, bestStreak: 35, totalSessions: 0, zeroDiveSessions: 0`

**Acceptance Criteria:**
- [ ] Preset loads via `?skipOnboarding=true&devpreset=all_floors_unlocked`
- [ ] Lands on base screen without errors
- [ ] Dome shows all 6 rooms accessible (no locked rooms)
- [ ] Room navigation works between all rooms

---

### 68.3 -- `streak_just_claimed` preset

Add preset #23 to `SCENARIO_PRESETS` array.

**Specification:**
- `id`: `'streak_just_claimed'`
- `label`: `'Streak Just Claimed'`
- `description`: `'14-day streak with 3-Day and 7-Day milestones already claimed. Tests reward flow and already-claimed state.'`
- `targetScreen`: `'base'`
- `buildSave(now)`:
  - Base: `BASE_SAVE(now)` spread
  - `learnedFacts` / `reviewStates`: `makeLearnedFacts(20)`
  - `minerals`: `{ dust: 2000, shard: 60, crystal: 10, geode: 0, essence: 0 }`
  - `unlockedRooms`: `['command', 'lab', 'workshop']`
  - `tutorialComplete`: `true`
  - `diveCount`: `14`
  - `selectedInterests`: `['Generalist']`
  - `lastDiveDate`: `new Date(now - 86_400_000).toISOString().split('T')[0]` (yesterday, streak active)
  - `claimedMilestones`: `[3, 7]`
  - `lastStreakMilestone`: `7`
  - `titles`: `['Explorer']` (earned from 7-day milestone)
  - `activeTitle`: `'Explorer'`
  - `streakFreezes`: `1`
  - `stats`: `totalBlocksMined: 1400, totalDivesCompleted: 14, deepestLayerReached: 9, totalFactsLearned: 20, totalFactsSold: 1, totalQuizCorrect: 70, totalQuizWrong: 10, currentStreak: 14, bestStreak: 14, totalSessions: 0, zeroDiveSessions: 0`

**Acceptance Criteria:**
- [ ] Preset loads via `?skipOnboarding=true&devpreset=streak_just_claimed`
- [ ] Lands on base screen without errors
- [ ] Streak Panel shows 14-day streak
- [ ] 3-Day and 7-Day milestones show checkmarks (claimed state)
- [ ] 14-Day milestone shows as "next" (arrow indicator)
- [ ] "Explorer" title is active

---

### 68.4 -- `heavy_review_overdue` preset

Add preset #24 to `SCENARIO_PRESETS` array.

**Specification:**
- `id`: `'heavy_review_overdue'`
- `label`: `'Heavy Review Overdue'`
- `description`: `'100 learned facts, ALL overdue by 7+ days. Tests performance and UI with large review queues.'`
- `targetScreen`: `'base'`
- `buildSave(now)`:
  - Since `PRESET_FACT_IDS` only has 30 entries, generate extended fact IDs for 100 facts:
    ```typescript
    // Use makeLearnedFacts for first 30, then generate synthetic IDs for 31-100
    const { learnedFacts, reviewStates } = makeLearnedFacts(30)
    for (let i = 30; i < 100; i++) {
      const syntheticId = `synth-fact-${String(i + 1).padStart(3, '0')}`
      learnedFacts.push(syntheticId)
      const state = createReviewState(syntheticId)
      state.nextReviewAt = now - 7 * 86_400_000  // 7 days overdue
      state.interval = 5
      state.repetitions = 3
      state.easeFactor = 2.2
      reviewStates.push(state)
    }
    // Also make the first 30 overdue
    for (const state of reviewStates.slice(0, 30)) {
      state.nextReviewAt = now - 7 * 86_400_000
      state.interval = 5
      state.repetitions = 3
    }
    ```
  - `minerals`: `{ dust: 5000, shard: 120, crystal: 20, geode: 3, essence: 0 }`
  - `knowledgePoints`: `1500`
  - `unlockedRooms`: `['command', 'lab', 'workshop', 'museum', 'market']`
  - `tutorialComplete`: `true`
  - `diveCount`: `45`
  - `selectedInterests`: `['Natural Sciences', 'History', 'Culture']`
  - `stats`: `totalBlocksMined: 7000, totalDivesCompleted: 45, deepestLayerReached: 15, totalFactsLearned: 100, totalFactsSold: 5, totalQuizCorrect: 350, totalQuizWrong: 40, currentStreak: 0, bestStreak: 20, totalSessions: 0, zeroDiveSessions: 0`

**Note:** The synthetic fact IDs (`synth-fact-001` etc.) won't match real facts in the database, but this is acceptable for testing review queue performance and UI rendering. The study session will show "unknown fact" for these, which is fine for stress testing.

**Acceptance Criteria:**
- [ ] Preset loads via `?skipOnboarding=true&devpreset=heavy_review_overdue`
- [ ] Lands on base screen without errors
- [ ] Study/review indicators show 100 overdue reviews
- [ ] UI does not lag or freeze when displaying the review count
- [ ] No console errors from the large review state array

---

### 68.5 -- `first_dive_returning` preset

Add preset #25 to `SCENARIO_PRESETS` array.

**Specification:**
- `id`: `'first_dive_returning'`
- `label`: `'First Dive Returning'`
- `description`: `'First-time player returning from dive with 1 pending artifact. Only Standard Pick, 1 completed dive. Tests artifact-to-learning pipeline.'`
- `targetScreen`: `'base'`
- `buildSave(now)`:
  - Base: `BASE_SAVE(now)` spread
  - `learnedFacts` / `reviewStates`: `makeLearnedFacts(2)` (just learned 2 facts from first dive)
  - `minerals`: `{ dust: 120, shard: 3, crystal: 0, geode: 0, essence: 0 }`
  - `unlockedRooms`: `['command', 'lab']`
  - `tutorialComplete`: `true`
  - `diveCount`: `1`
  - `selectedInterests`: `['Generalist']`
  - `lastDiveDate`: `new Date(now).toISOString().split('T')[0]` (today)
  - `pendingArtifacts`: `[{ factId: 'cult-003', rarity: 'common', minedAt: now - 300_000 }]` (1 pending artifact, mined 5 minutes ago)
  - `stats`: `totalBlocksMined: 80, totalDivesCompleted: 1, deepestLayerReached: 3, totalFactsLearned: 2, totalFactsSold: 0, totalQuizCorrect: 4, totalQuizWrong: 1, currentStreak: 1, bestStreak: 1, totalSessions: 0, zeroDiveSessions: 0`

**Acceptance Criteria:**
- [ ] Preset loads via `?skipOnboarding=true&devpreset=first_dive_returning`
- [ ] Lands on base screen without errors
- [ ] Artifact Lab shows 1 pending artifact
- [ ] Player has minimal resources (early game feel)
- [ ] Artifact cracking -> fact reveal -> learn/sell flow works end-to-end

---

## Implementation Notes

1. **Import check:** `createReviewState` is already imported at line 6 of `presets.ts`. `PendingArtifact` and `Rarity` types may need to be imported from `src/data/types.ts` -- add to the existing import if not present.

2. **Array placement:** Add all 5 presets at the end of the `SCENARIO_PRESETS` array (after preset #20 "just_crafted", before the closing `] as const`).

3. **Type safety:** The `SCENARIO_PRESETS` array is typed `readonly ScenarioPreset[]` with `as const`. The new presets must conform to the `ScenarioPreset` interface. Ensure `pendingArtifacts` uses the correct `PendingArtifact[]` type.

4. **Preset 68.4 helper:** The 100-fact generation logic for `heavy_review_overdue` should be inline in the `buildSave` function (not a separate helper), since it's unique to this preset.

---

## Verification Gate

All of the following MUST pass before this phase is marked complete:

1. `npm run typecheck` -- 0 errors
2. `npm run build` -- succeeds without errors
3. `npx vitest run` -- all existing tests pass
4. **Each preset loads without errors** (test all 5):
   ```
   http://localhost:5173?skipOnboarding=true&devpreset=has_pending_artifacts
   http://localhost:5173?skipOnboarding=true&devpreset=all_floors_unlocked
   http://localhost:5173?skipOnboarding=true&devpreset=streak_just_claimed
   http://localhost:5173?skipOnboarding=true&devpreset=heavy_review_overdue
   http://localhost:5173?skipOnboarding=true&devpreset=first_dive_returning
   ```
5. **Each reaches target screen** with expected state visible (use `window.__terraDebug()` to verify save data)
6. **No console errors** on any preset load

## Files Affected

| File | Change |
|------|--------|
| `src/dev/presets.ts` | Add 5 new presets (#21-25) to `SCENARIO_PRESETS` array, possibly add `PendingArtifact` import |
