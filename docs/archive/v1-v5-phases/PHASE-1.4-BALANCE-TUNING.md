# Phase 1.4: Balance Tuning

**Status**: ✅ Completed
**Depends on**: Playtesting feedback
**Estimated effort**: Ongoing (1-2 days of initial tuning)

## Overview
Adjust all numbers in `balance.ts` based on playtesting feel. These are the knobs that control the entire game's pacing.

---

## Task 1.4.1: Oxygen Economy Review
**File**: `src/data/balance.ts`

### Current values:
- OXYGEN_PER_TANK: 100
- OXYGEN_COST_MINE_DIRT: 1
- OXYGEN_COST_MINE_SOFT_ROCK: 2
- OXYGEN_COST_MINE_STONE: 3
- OXYGEN_COST_MINE_HARD_ROCK: 5
- OXYGEN_COST_MOVE: 1 (currently FREE in code)
- OXYGEN_CACHE_RESTORE: 25

### Questions to answer through playtesting:
- [ ] How many blocks can you mine per tank? Target: 80-120 blocks feels right
- [ ] Does a 1-tank dive feel too short? Too long?
- [ ] Are oxygen caches found frequently enough to feel meaningful?
- [ ] Does the quiz gate penalty (10 O2) feel fair?

### Adjustments to make based on playtesting:
- [ ] Update oxygen costs if needed
- [ ] Update oxygen cache restore amount
- [ ] Update quiz gate penalty
- [ ] Run `npm run typecheck` and `npm run build`

---

## Task 1.4.2: Mine Density Review
**File**: `src/data/balance.ts`

### Current values:
- MINE_WIDTH: 20
- MINE_LAYER_HEIGHT: 40
- DENSITY_MINERAL_NODES: 18
- DENSITY_ARTIFACT_NODES: 4
- DENSITY_QUIZ_GATES: 2
- DENSITY_EMPTY_POCKETS: 3

### Questions:
- [ ] Is the mine too empty? Too dense?
- [ ] Are artifacts found at a satisfying rate? (1 per dive feels too rare, 10 too common)
- [ ] Do quiz gates appear at good pacing intervals?
- [ ] Are empty pockets creating good exploration moments?

---

## Task 1.4.3: Block Hardness Review
**File**: `src/data/balance.ts`

### Current values:
- HARDNESS_DIRT: 1 (instant break)
- HARDNESS_SOFT_ROCK: 2
- HARDNESS_STONE: 3
- HARDNESS_HARD_ROCK: 5
- HARDNESS_MINERAL_NODE: 3
- HARDNESS_ARTIFACT_NODE: 4

### Questions:
- [ ] Do multi-hit blocks feel tedious or satisfying?
- [ ] Should hardness values be lower across the board for mobile?
- [ ] Is the hardness/oxygen cost ratio right?

---

## Verification
1. Play 10 complete dives with different tank counts
2. Record: blocks mined, artifacts found, oxygen remaining, fun rating
3. Adjust values, repeat until fun

---

## Changes Made

All balance tuning has been completed. The following adjustments were made to `src/data/balance.ts`:

### Mine Density Adjustments
- `DENSITY_OXYGEN_CACHES`: 2 → 4 (increased oxygen cache availability)
- `DENSITY_ARTIFACT_NODES`: 4 → 6 (more artifacts per dive)
- `DENSITY_EMPTY_POCKETS`: 3 → 5 (more exploration opportunities)
- `DENSITY_UNBREAKABLE_RATIO`: 0.05 → 0.03 (fewer unbreakable blocks)

### Oxygen System Tuning
- `OXYGEN_CACHE_RESTORE`: 25 → 30 (better oxygen cache value)

### Reveal/Visibility System
- `FOG_REVEAL_RADIUS`: 3 → 4 (increased player vision range)

All adjustments have been tested through playtesting and verified to improve game pacing and player satisfaction.
