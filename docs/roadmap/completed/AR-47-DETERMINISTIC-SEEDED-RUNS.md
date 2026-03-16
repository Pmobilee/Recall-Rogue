# AR-47 — Fully Deterministic Seeded Runs

## Overview
**Goal:** Make every gameplay-affecting random decision flow through the run's seeded PRNG, so that identical seeds produce byte-for-byte identical runs. Card shuffling, fact assignment, reward generation, enemy selection — everything that affects game state must be deterministic given the same seed. Visual/audio randomness (particles, screen shake, audio noise) remains truly random since it doesn't affect gameplay.

**Current state:** The game already has `activateDeterministicRandom(runSeed)` which overrides `Math.random()` globally. However, `deckManager.ts` deliberately uses `crypto.getRandomValues()` via `trueShuffled()` to bypass this for deck shuffles. This means two runs with the same seed get the same map but different card draws.

**Why keep it feeling random:** Mulberry32 is a high-quality PRNG with a period of 2^32. Players cannot distinguish it from true randomness. The shuffle quality is identical to Fisher-Yates with `Math.random()` — the only difference is reproducibility.

**Dependencies:** None
**Estimated complexity:** Medium (mostly replacing crypto RNG calls with seeded ones, plus adding a run-scoped RNG context)

---

## Architecture

### Run-Scoped RNG Context
Instead of relying solely on the global `Math.random()` override (which is fragile — any code path change shifts the sequence), introduce an explicit **RNG context** that gameplay systems draw from:

```typescript
// src/services/seededRng.ts
export interface SeededRng {
  next(): number;           // 0..1 float (like Math.random())
  nextInt(max: number): number; // 0..max-1 integer
  fork(label: string): SeededRng; // Create a sub-stream for a subsystem
}
```

**Forking** is the key design: each subsystem (deck, rewards, enemies, map) gets its own forked RNG stream derived from the run seed + a label hash. This means:
- Adding a new `Math.random()` call in rewards doesn't shift the deck shuffle sequence
- Each subsystem is independently deterministic
- Order of system initialization doesn't matter

### RNG Streams
| Stream Label | Used By | Current Source |
|---|---|---|
| `"deck"` | Deck shuffle, reshuffle, card insertion | `crypto.getRandomValues()` — **must change** |
| `"facts"` | Fact assignment, weighted fact shuffle, cooldown timers | `Math.random()` (seeded globally) — **should use fork** |
| `"rewards"` | Card reward generation, relic selection | `Math.random()` (seeded globally) — **should use fork** |
| `"enemies"` | Enemy assignment in map nodes | `Math.random()` — **should use fork** |
| `"mastery"` | Mastery challenge selection/shuffling | `Math.random()` — **should use fork** |
| `"cardtype"` | Card type allocation shuffle | `Math.random()` — **should use fork** |
| `"map"` | Map generation (already uses local mulberry32) | Local mulberry32 — **keep, just wire to fork** |
| `"vfx"` | Particles, shake, atmosphere | `Math.random()` — **leave as-is, non-gameplay** |
| `"quiz"` | Answer option shuffling in quiz UI | `Math.random()` — **should use fork** |

---

## Sub-steps

### 1. Create `src/services/seededRng.ts` — the RNG context module
- Implement `SeededRng` interface with mulberry32 core
- `createSeededRng(seed: number): SeededRng` — root RNG factory
- `fork(label: string)` — derives a new seed via `hash(parentSeed, label)` using a simple string hash (djb2 or similar)
- `shuffled<T>(rng: SeededRng, items: readonly T[]): T[]` — Fisher-Yates using the given RNG
- `weightedPick<T>(rng: SeededRng, items: T[], weights: number[]): T` — weighted selection
- Export a `runRng` Svelte store (or module-level variable) that holds the active run's root RNG
- Include `reset(seed: number)` to reinitialize for a new run

**Files:** `src/services/seededRng.ts` (new)
**Acceptance:** Unit tests confirm: same seed → same sequence; different seeds → different sequences; forked streams are independent.

### 2. Wire up run lifecycle — initialize RNG on run start, restore on load
- In `runManager.ts` `initializeRun()`: create the root `SeededRng` from `runSeed` and store it
- In `gameFlowController.ts`: replace `activateDeterministicRandom(runSeed)` with the new RNG context initialization
- In `runSaveService.ts`: save/restore RNG state (the internal counter of each forked stream) so mid-run saves produce identical continuations
- Keep `activateDeterministicRandom()` as a fallback for any `Math.random()` calls not yet migrated, but mark it as deprecated

**Files:** `src/services/runManager.ts`, `src/services/gameFlowController.ts`, `src/services/runSaveService.ts`, `src/services/deterministicRandom.ts`
**Acceptance:** RNG context created on run start, persisted across save/load, produces same sequence after restore.

### 3. Convert `deckManager.ts` — replace crypto shuffle with seeded shuffle
- Remove `trueShuffled()` (the `crypto.getRandomValues` version)
- Replace with `shuffled(rng, items)` using the `"deck"` fork
- Convert `weightedFactShuffle()` to use `"facts"` fork
- Convert cooldown timer RNG (`FACT_COOLDOWN_MIN + Math.floor(...)`) to use `"facts"` fork
- Convert `insertCardWithDelay()` random index to use `"deck"` fork

**Files:** `src/services/deckManager.ts`
**Acceptance:** Same seed → same card draw order, same fact assignments, same cooldown timers across two runs.

### 4. Convert reward and pool generation
- `rewardGenerator.ts`: use `"rewards"` fork for all weighted selections
- `runPoolBuilder.ts`: use `"rewards"` fork for weighted shuffles and pool building
- `cardTypeAllocator.ts`: use `"cardtype"` fork for type allocation shuffle

**Files:** `src/services/rewardGenerator.ts`, `src/services/runPoolBuilder.ts`, `src/services/cardTypeAllocator.ts`
**Acceptance:** Same seed → same reward offerings, same card pool composition.

### 5. Convert mastery and enemy assignment
- `masteryChallengeService.ts`: use `"mastery"` fork
- `mapGenerator.ts` `assignEnemyIds()`: use `"enemies"` fork (currently the only non-seeded part of map gen)

**Files:** `src/services/masteryChallengeService.ts`, `src/services/mapGenerator.ts`
**Acceptance:** Same seed → same mastery challenges, same enemy encounters.

### 6. Convert quiz answer shuffling
- `CardCombatOverlay.svelte` and `QuizOverlay.svelte`: shuffle answer options using `"quiz"` fork
- This ensures the position of the correct answer is deterministic per seed (important for replay verification)

**Files:** `src/ui/components/CardCombatOverlay.svelte`, `src/ui/components/QuizOverlay.svelte`
**Acceptance:** Same seed → correct answer appears in same position each time.

### 7. Creature damage variance
- `src/game/entities/Creature.ts`: any damage variance RNG should use a `"combat"` fork
- Verify all combat math is deterministic

**Files:** `src/game/entities/Creature.ts`
**Acceptance:** Same seed → same damage rolls.

### 8. Deprecate global Math.random override
- Once all gameplay systems use explicit RNG forks, remove or gate `activateDeterministicRandom()`
- Keep it only as a safety net during transition (log warnings when it's hit)
- VFX code (`CombatAtmosphereSystem`, `ScreenShakeSystem`, `EnemySpriteSystem`, `CampfireEffect`, `GachaReveal`, particles) should use raw `Math.random()` — these are cosmetic

**Files:** `src/services/deterministicRandom.ts`
**Acceptance:** No gameplay code calls `Math.random()` directly. VFX code still uses it freely.

### 9. Add determinism verification test
- Create a test that runs two simulated games with the same seed and asserts:
  - Same map layout
  - Same card draw order (first 5 hands)
  - Same reward offerings
  - Same enemy encounters
  - Same fact-to-card assignments
- This is the regression gate — if any future change breaks determinism, this test catches it

**Files:** `tests/determinism.test.ts` (new)
**Acceptance:** Test passes. Changing the seed produces different results. Same seed always produces identical results.

---

## Files Affected
| File | Change |
|------|--------|
| `src/services/seededRng.ts` (NEW) | Core RNG context module |
| `src/services/deckManager.ts` | Replace crypto shuffle, use forked RNG |
| `src/services/runManager.ts` | Initialize RNG context on run start |
| `src/services/gameFlowController.ts` | Wire RNG context to run lifecycle |
| `src/services/runSaveService.ts` | Save/restore RNG state |
| `src/services/deterministicRandom.ts` | Deprecate global override |
| `src/services/rewardGenerator.ts` | Use rewards fork |
| `src/services/runPoolBuilder.ts` | Use rewards fork |
| `src/services/cardTypeAllocator.ts` | Use cardtype fork |
| `src/services/masteryChallengeService.ts` | Use mastery fork |
| `src/services/mapGenerator.ts` | Use enemies fork for assignEnemyIds |
| `src/game/entities/Creature.ts` | Use combat fork for damage variance |
| `src/ui/components/CardCombatOverlay.svelte` | Use quiz fork for answer shuffle |
| `src/ui/components/QuizOverlay.svelte` | Use quiz fork for answer shuffle |
| `tests/determinism.test.ts` (NEW) | Regression test for seed determinism |

## Verification Gate
- [x] `npm run typecheck` — 0 errors
- [x] `npm run build` — succeeds
- [x] `npx vitest run` — all existing tests pass
- [x] Determinism test: same seed → identical game state (map, draws, rewards, enemies)
- [x] Determinism test: different seed → different game state
- [x] Save/load mid-run preserves RNG state — continuation is deterministic
- [x] VFX still looks natural (particles, shake, atmosphere not robotically repeating)
- [x] Daily expedition mode works correctly with daily seed
- [x] Scholar challenge mode works correctly with weekly seed
- [x] Full playthrough: game feels identical to current (no perceptible randomness change)
- [x] No `crypto.getRandomValues` calls in gameplay code paths
- [x] Existing playtest suite passes without regressions
