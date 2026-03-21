# AR-205: Card Unlock Gating

**Source:** `docs/RESEARCH/EXPANSION_FINAL_PRODUCTION.md` — Part 5
**Depends on:** AR-201 (Echo + Combo removal complete)
**Blocks:** AR-206, AR-207, AR-208, AR-211
**Priority:** High — all card-adding ARs depend on the unlock table existing first
**Estimated complexity:** Medium (data structure + 3 filter integration points, no new UI)

## Overview

Cards are gated by character level. New mechanics added in AR-206/207/208 are not available in the run pool, reward pool, or shop until the player reaches the required character level. This creates a meaningful progression curve: new players learn the game's basics first, advanced archetypes unlock after 15-30 runs.

The implementation has two parts:
1. **Data layer** — add `unlockLevel: number` to `MechanicDefinition` and define the full unlock schedule in `characterLevel.ts` via a new `getUnlockedMechanics(level)` function.
2. **Filter layer** — apply the unlock filter in the three places where mechanics enter play: `runPoolBuilder.ts` (`applyMechanics()`), `rewardGenerator.ts` (`filterEligible()`), and `shopService.ts` (card offer generation).

**Backward compatibility:** All 31 existing mechanics get `unlockLevel: 0`, so no player progress is affected. The filter is a no-op at level 0 for existing content.

**Design contract from Part 5:** The unlock schedule adds 60 new mechanic IDs across levels 1-13. Level 0 unlocks the full existing set plus 5 new basics from AR-206 (Power Strike, Iron Wave, Reinforce, Inscription of Fury, Inscription of Iron) for a total of 36. Each subsequent level unlocks a small cohort. Full run: 91 unique mechanic IDs at level 13.

## Sub-steps

### TODO 1 — Add `unlockLevel` field to `MechanicDefinition` interface

**File:** `src/data/mechanics.ts`

Add the `unlockLevel` field to the `MechanicDefinition` interface. Field must be required (not optional) so TypeScript enforces it on every definition.

```typescript
export interface MechanicDefinition {
  // ... existing fields ...
  /** Character level required to unlock this mechanic. 0 = available from the start. */
  unlockLevel: number;
}
```

Add `unlockLevel: 0` to every existing mechanic definition in `MECHANIC_DEFINITIONS`. There are 31 entries — set all of them to `0`. This is the backward-compatibility guarantee.

**Acceptance criteria:**
- `MechanicDefinition` interface has `unlockLevel: number` (not optional)
- All 31 existing mechanic definitions compile with `unlockLevel: 0`
- `npm run typecheck` passes with no new errors

---

### TODO 2 — Add `getUnlockedMechanics()` to `characterLevel.ts`

**File:** `src/services/characterLevel.ts`

Add the unlock schedule as a constant map and export the query function. This is the single source of truth for which mechanics are available at each level.

The schedule maps each level to the mechanic IDs first unlocked AT that level. The function returns all mechanic IDs unlocked at or below the given level.

```typescript
/**
 * Maps character level -> mechanic IDs first unlocked at that level.
 * Level 0 = all existing mechanics plus the 5 new basic filler cards from Phase 1.
 * Each subsequent level adds a cohort of new mechanics.
 */
const MECHANIC_UNLOCK_SCHEDULE: Map<number, string[]> = new Map([
  [0,  [
    // All 31 existing mechanics (backward compatible)
    'strike', 'multi_hit', 'heavy_strike', 'piercing', 'reckless', 'execute', 'lifetap',
    'block', 'thorns', 'emergency', 'fortify', 'brace', 'overheal', 'parry',
    'empower', 'quicken', 'focus', 'double_strike',
    'weaken', 'expose', 'hex', 'slow',
    'cleanse', 'scout', 'recycle', 'foresight', 'transmute', 'immunity',
    'mirror', 'adapt', 'overclock',
    // 5 new basics from AR-206 Phase 1 (available from first run)
    'power_strike', 'iron_wave', 'reinforce', 'inscription_of_fury', 'inscription_of_iron',
  ]],
  [1,  ['bash', 'guard', 'sap', 'inscription_of_wisdom']],
  [2,  ['twin_strike', 'shrug_it_off', 'swap']],
  [3,  ['stagger', 'sift', 'riposte']],
  [4,  ['rupture', 'lacerate', 'scavenge', 'absorb', 'precision_strike']],
  [5,  ['kindle', 'ignite', 'corrode', 'overcharge', 'archive']],
  [6,  ['gambit', 'curse_of_doubt', 'knowledge_ward', 'aegis_pulse', 'reflex', 'unstable_flux', 'chameleon']],
  [7,  ['burnout_shield', 'battle_trance', 'volatile_slash', 'corroding_touch', 'phase_shift']],
  [8,  ['ironhide', 'war_drum', 'chain_lightning', 'dark_knowledge', 'mark_of_ignorance', 'sacrifice']],
  [9,  ['smite', 'entropy', 'bulwark', 'conversion', 'chain_anchor']],
  [10, ['feedback_loop', 'frenzy', 'aftershock', 'synapse', 'catalyst']],
  [11, ['recall', 'mastery_surge', 'tutor', 'mimic', 'siphon_strike']],
  [12, ['eruption']],
  [13, ['knowledge_bomb', 'siphon_knowledge']],
]);

/**
 * Returns all mechanic IDs available at the given character level.
 * Includes all mechanics unlocked at levels 0 through `level` (inclusive).
 *
 * @param level - The player's current character level (0-25).
 * @returns Set of mechanic IDs available for pool/reward/shop use.
 */
export function getUnlockedMechanics(level: number): Set<string> {
  const unlocked = new Set<string>();
  for (const [unlockLevel, ids] of MECHANIC_UNLOCK_SCHEDULE) {
    if (unlockLevel <= level) {
      for (const id of ids) unlocked.add(id);
    }
  }
  return unlocked;
}

/**
 * Returns the character level at which a specific mechanic unlocks.
 * Returns 0 for existing mechanics. Returns null if mechanic ID is unknown.
 */
export function getMechanicUnlockLevel(mechanicId: string): number | null {
  for (const [level, ids] of MECHANIC_UNLOCK_SCHEDULE) {
    if (ids.includes(mechanicId)) return level;
  }
  return null;
}
```

**Acceptance criteria:**
- `getUnlockedMechanics(0)` returns a Set of 36 IDs (31 existing + 5 new basics)
- `getUnlockedMechanics(13)` returns a Set of 92 IDs (all mechanics)
- `getUnlockedMechanics(0).has('strike')` === `true` (backward compat)
- `getUnlockedMechanics(0).has('bash')` === `false` (gated)
- `getUnlockedMechanics(1).has('bash')` === `true`
- `getMechanicUnlockLevel('eruption')` === `12`
- `getMechanicUnlockLevel('strike')` === `0`
- Unit tests added (see TODO 5)

---

### TODO 3 — Filter `applyMechanics()` in `runPoolBuilder.ts` by unlocked mechanics

**File:** `src/services/runPoolBuilder.ts`

`buildRunPool()` currently accepts no player level parameter. Add `characterLevel?: number` to the existing `options` object. Then filter `MECHANICS_BY_TYPE` in `pickMechanic()` to exclude mechanics the player has not yet unlocked.

Change the `buildRunPool` signature:

```typescript
export function buildRunPool(
  primaryDomain: FactDomain,
  secondaryDomain: FactDomain,
  allReviewStates: ReviewState[],
  options?: {
    poolSize?: number
    probeRunNumber?: number
    probeDomain?: FactDomain
    subscriberCategoryFilters?: Record<string, string[]>
    primaryDistribution?: DifficultyDistribution
    secondaryDistribution?: DifficultyDistribution
    funnessBoostFactor?: number
    characterLevel?: number   // NEW — defaults to 0 (all existing mechanics always available)
  },
): Card[]
```

Update `pickMechanic()` to accept an optional `Set<string>` of unlocked mechanic IDs and filter the pool before selecting:

```typescript
function pickMechanic(
  cardType: CardType,
  mechanicCounts: Map<string, number>,
  unlockedMechanicIds?: Set<string>,
): MechanicDefinition {
  const rawPool = MECHANICS_BY_TYPE[cardType];
  const pool = unlockedMechanicIds
    ? rawPool.filter(m => unlockedMechanicIds.has(m.id))
    : rawPool;
  // Fall back to full pool if the filtered pool would be empty
  // (guards against misconfigured unlock tables leaving a card type with nothing)
  const effectivePool = pool.length > 0 ? pool : rawPool;
  // ... rest of existing logic unchanged, using effectivePool instead of pool ...
}
```

In `buildRunPool`, compute the unlocked set once and thread it through:

```typescript
const unlockedMechanicIds = getUnlockedMechanics(options?.characterLevel ?? 0);
// pass to applyMechanics:
pool = applyMechanics(pool, unlockedMechanicIds);
```

Update `applyMechanics` signature:

```typescript
function applyMechanics(cards: Card[], unlockedMechanicIds?: Set<string>): Card[] {
  const mechanicCounts = new Map<string, number>();
  return cards.map((card) => {
    const mechanic = pickMechanic(card.cardType, mechanicCounts, unlockedMechanicIds);
    // ... rest unchanged ...
  });
}
```

**Acceptance criteria:**
- `buildRunPool(..., { characterLevel: 0 })` never assigns a mechanic with `unlockLevel > 0`
- `buildRunPool(..., { characterLevel: 13 })` can assign any mechanic
- Empty-pool fallback prevents crashes when all mechanics of a type are gated
- `npm run typecheck` passes
- `npx vitest run` passes (existing pool builder tests still green)

---

### TODO 4 — Filter reward generator and shop by unlocked mechanics

**Files:** `src/services/rewardGenerator.ts`, `src/services/shopService.ts`

The `generateCardRewardOptionsByType()` function in `rewardGenerator.ts` selects cards from the run pool. Because the run pool is already filtered by `buildRunPool()` (TODO 3), cards in the pool already have only unlocked mechanics assigned. No additional filtering needed at the reward layer — the pool is the filter.

However, document this contract with a JSDoc comment on `generateCardRewardOptions`:

```typescript
/**
 * Generate card reward options from the run pool.
 * ...
 * Note: mechanic unlock filtering is applied upstream in buildRunPool().
 * Cards in runPool already have only level-appropriate mechanics assigned.
 */
```

For `shopService.ts`: shop cards are drawn from the run pool (passed in by the caller). Same guarantee — run pool is already filtered. Add the same clarifying comment to `generateShopRelics` or wherever shop cards are sourced from.

Search for the call site where the run pool is passed to the shop and confirm the pool is the same `buildRunPool()` output. If shop cards are generated from a separate path (not the run pool), apply the same `getUnlockedMechanics()` filter there.

**File to check for shop card source:** `src/services/gameFlowController.ts` — search for shop card generation call.

**Acceptance criteria:**
- Shop and reward screens never show mechanics above the player's current level
- If shop already uses run pool as card source: only comment addition needed, no logic change
- If shop uses an independent card source: filter applied with `getUnlockedMechanics(playerLevel)`
- `npm run typecheck` passes

---

### TODO 5 — Unit tests for `getUnlockedMechanics`

**File:** `tests/unit/characterLevel.unlock.test.ts` (new file)

```typescript
import { describe, it, expect } from 'vitest';
import { getUnlockedMechanics, getMechanicUnlockLevel } from '../../src/services/characterLevel';

describe('getUnlockedMechanics', () => {
  it('returns 36 mechanics at level 0', () => {
    expect(getUnlockedMechanics(0).size).toBe(36);
  });

  it('includes all existing mechanics at level 0', () => {
    const unlocked = getUnlockedMechanics(0);
    // spot-check existing mechanics
    expect(unlocked.has('strike')).toBe(true);
    expect(unlocked.has('block')).toBe(true);
    expect(unlocked.has('overclock')).toBe(true);
  });

  it('gates new mechanics at level 0', () => {
    const unlocked = getUnlockedMechanics(0);
    expect(unlocked.has('bash')).toBe(false);
    expect(unlocked.has('eruption')).toBe(false);
    expect(unlocked.has('knowledge_bomb')).toBe(false);
  });

  it('unlocks level 1 cohort at level 1', () => {
    const unlocked = getUnlockedMechanics(1);
    expect(unlocked.has('bash')).toBe(true);
    expect(unlocked.has('guard')).toBe(true);
    expect(unlocked.has('sap')).toBe(true);
    expect(unlocked.has('inscription_of_wisdom')).toBe(true);
  });

  it('still gates higher mechanics at level 1', () => {
    const unlocked = getUnlockedMechanics(1);
    expect(unlocked.has('eruption')).toBe(false);
  });

  it('unlocks eruption only at level 12+', () => {
    expect(getUnlockedMechanics(11).has('eruption')).toBe(false);
    expect(getUnlockedMechanics(12).has('eruption')).toBe(true);
  });

  it('returns all 92 mechanics at level 13', () => {
    expect(getUnlockedMechanics(13).size).toBe(92);
  });

  it('level 25 returns same as level 13 (no mechanics above 13)', () => {
    expect(getUnlockedMechanics(25).size).toBe(getUnlockedMechanics(13).size);
  });
});

describe('getMechanicUnlockLevel', () => {
  it('returns 0 for all existing mechanics', () => {
    expect(getMechanicUnlockLevel('strike')).toBe(0);
    expect(getMechanicUnlockLevel('block')).toBe(0);
    expect(getMechanicUnlockLevel('overclock')).toBe(0);
  });

  it('returns correct level for gated mechanics', () => {
    expect(getMechanicUnlockLevel('bash')).toBe(1);
    expect(getMechanicUnlockLevel('eruption')).toBe(12);
    expect(getMechanicUnlockLevel('knowledge_bomb')).toBe(13);
  });
});
```

**Acceptance criteria:**
- All tests in this file pass with `npx vitest run`
- Total count assertions (36, 92) match the unlock schedule definition exactly

---

### TODO 6 — Update `data/inspection-registry.json` and `docs/GAME_DESIGN.md`

**File:** `data/inspection-registry.json`

Add a new entry to the `systems` table for the card unlock gating system:

```json
{
  "id": "card-unlock-gating",
  "name": "Card Unlock Gating",
  "description": "Character-level-based mechanic unlock schedule. Cards are gated by level, unlocking in cohorts from level 0 to 13.",
  "status": "active",
  "lastChangedDate": "<today>",
  "mechanicInspectionDate": "not_checked",
  "uxReviewDate": "not_checked",
  "visualInspectionDate_portraitMobile": "not_checked",
  "visualInspectionDate_landscapeMobile": "not_checked",
  "visualInspectionDate_landscapePC": "not_checked"
}
```

**File:** `docs/GAME_DESIGN.md`

Find the character progression section. Add a subsection describing card unlock gating:

- Mechanics are gated by character level (0-13)
- Level 0: 36 mechanics available (all existing + 5 new basics)
- Each level 1-13 adds a cohort (4-7 mechanics per level)
- Level 13+: all 92 mechanics available
- The unlock schedule is defined in `src/services/characterLevel.ts` (`MECHANIC_UNLOCK_SCHEDULE`)
- Existing saves are unaffected (all existing mechanics are level 0)

**Acceptance criteria:**
- `inspection-registry.json` has new `card-unlock-gating` entry in `systems` table
- `GAME_DESIGN.md` documents the unlock schedule and level counts accurately
- `npm run typecheck` passes (registry is JSON, no TS impact)

---

## Files Affected

| File | Change Type | Description |
|------|-------------|-------------|
| `src/data/mechanics.ts` | Modified | Add `unlockLevel: number` field to `MechanicDefinition` interface; set `unlockLevel: 0` on all 31 existing definitions |
| `src/services/characterLevel.ts` | Modified | Add `MECHANIC_UNLOCK_SCHEDULE` map and export `getUnlockedMechanics(level)` + `getMechanicUnlockLevel(id)` |
| `src/services/runPoolBuilder.ts` | Modified | Add `characterLevel?` to `buildRunPool` options; filter `pickMechanic()` by unlocked set |
| `src/services/rewardGenerator.ts` | Modified | Add clarifying JSDoc comment; confirm no independent filter needed |
| `src/services/shopService.ts` | Modified | Confirm card source; add JSDoc comment or apply filter if shop uses independent card source |
| `tests/unit/characterLevel.unlock.test.ts` | New | Unit tests for `getUnlockedMechanics` and `getMechanicUnlockLevel` |
| `data/inspection-registry.json` | Modified | Add `card-unlock-gating` system entry |
| `docs/GAME_DESIGN.md` | Modified | Document card unlock gating under character progression |

## Verification Gate

Before marking AR-205 complete, ALL of the following must be true:

- [ ] `npm run typecheck` — zero errors
- [ ] `npm run build` — clean build
- [ ] `npx vitest run` — all tests pass, including new `characterLevel.unlock.test.ts`
- [ ] `getUnlockedMechanics(0).size === 36` (verified in tests)
- [ ] `getUnlockedMechanics(13).size === 92` (verified in tests)
- [ ] `buildRunPool(..., { characterLevel: 0 })` — no mechanic above unlock level 0 appears in any card's `mechanicId`
- [ ] `buildRunPool(..., { characterLevel: 13 })` — pool contains cards with phase-2+ mechanics
- [ ] Empty-pool fallback: if a card type has zero unlocked mechanics, the pool falls back to the full type pool rather than crashing
- [ ] `data/inspection-registry.json` updated with new system entry
- [ ] `docs/GAME_DESIGN.md` updated with card unlock gating documentation

## Notes for Worker

- The 91 unique mechanic IDs in the unlock schedule does NOT include the 1 existing phase-2 mechanic `parry` which is already in `MECHANIC_DEFINITIONS` with `launchPhase: 2`. Confirm whether `parry` should be gated by level (add to schedule at an appropriate level, e.g. level 4) or kept behind the `ENABLE_PHASE2_MECHANICS` flag. If keeping behind the feature flag, it does not need a level entry — the flag already gates it. Do NOT silently drop it from both systems; pick one gate.
- The mechanic IDs in `MECHANIC_UNLOCK_SCHEDULE` are the canonical IDs that will be used in `MechanicDefinition.id` when AR-206/207/208 add those definitions. They must match exactly — verify against the expansion spec Part 2/3 mechanic tables before merging.
- Do NOT implement any UI for "locked card" display. That belongs in AR-209 (Unlock Schedule Wiring). AR-205 is pure data + filter logic — no UI changes.
- The `ENABLE_PHASE2_MECHANICS` flag in `balance.ts` controls phase-2 content during development. After AR-205, new content is gated by level instead. When AR-206/207/208 are complete, the `launchPhase` field and `ENABLE_PHASE2_MECHANICS` flag will be deprecated in AR-209. Do not remove them in this AR.
- Read `docs/RESEARCH/EXPANSION_FINAL_PRODUCTION.md` Part 5 for the authoritative unlock table before coding. If any mechanic ID in the schedule above conflicts with the spec's naming convention, the spec wins.
