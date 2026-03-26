# AR-262: Accuracy Grade System

## Overview

**Goal:** Add a post-encounter accuracy grade that gives reward quality bonuses. Pure upside — no punishment for struggling, only bonuses for quiz excellence.

**Why:** Currently, quiz performance only matters during the encounter. Accuracy Grade extends the value of good quiz performance into the reward phase, giving players another reason to engage with Charging over Quick Play.

**Dependencies:** AR-260 (HP scaling). Independent of AR-261 (no Aura/Queue dependency).
**Estimated complexity:** Small (new module + reward integration + UI badge)

**Reference:** `docs/RESEARCH/05 Overhaul relics cards.md` lines 290-301

---

## Sub-steps

### 1. Create Accuracy Grade Module

**New file:** `src/services/accuracyGradeSystem.ts`

```typescript
// === Accuracy Grade System (AR-262) ===
// Post-encounter quiz accuracy affects card reward quality.
// Bonuses only above 80%. No penalties for struggling.

export type AccuracyGrade = 'C' | 'B' | 'A' | 'S';

export interface GradeResult {
  grade: AccuracyGrade;
  accuracy: number;          // 0-100 percentage
  bonusCardOptions: number;  // 0 or 1
  guaranteeUncommon: boolean;
}

/** Thresholds — only bonuses above 80%, no penalties. */
const GRADE_THRESHOLDS = {
  S: 90,  // +1 card option AND guaranteed uncommon+
  A: 80,  // +1 card option
  B: 60,  // Normal rewards
  C: 0,   // Normal rewards (below 60%)
};

/**
 * Calculate accuracy grade from encounter charge stats.
 * If no charges were attempted, returns grade C with no bonuses.
 */
export function calculateAccuracyGrade(chargesAttempted: number, chargesCorrect: number): GradeResult { ... }
```

**Grade rules:**

| Accuracy | Grade | Effect |
|----------|-------|--------|
| 90%+ | S | +1 card option (4 instead of 3) AND guaranteed uncommon+ |
| 80-89% | A | +1 card option (4 instead of 3) |
| 60-79% | B | Normal rewards |
| Below 60% | C | Normal rewards |

**Edge cases:**
- 0 charges attempted (QP-only encounter) → grade C, no bonuses
- 1 charge attempted, 1 correct (100%) → grade S

**Acceptance criteria:** Module exports `calculateAccuracyGrade`. Returns correct grade and bonuses for all threshold boundaries.

### 2. Track Charge Attempts Per Encounter

**File:** `src/services/turnManager.ts`

Add two counters to encounter state:
- `chargesAttemptedThisEncounter: number` — incremented on every Charge (correct or wrong)
- `chargesCorrectThisEncounter: number` — incremented on correct Charge only

These may already be partially tracked (check `consecutiveCorrectThisEncounter` — that's streak, not total). If total counters don't exist, add them:

```typescript
// At encounter start:
chargesAttemptedThisEncounter = 0;
chargesCorrectThisEncounter = 0;

// On charge correct:
chargesAttemptedThisEncounter++;
chargesCorrectThisEncounter++;

// On charge wrong:
chargesAttemptedThisEncounter++;
```

**Acceptance criteria:** Both counters are tracked accurately and accessible at encounter end.

### 3. Integrate Grade into Reward Generation

**File:** `src/services/encounterBridge.ts` or wherever card rewards are generated after combat

At encounter end:
1. Call `calculateAccuracyGrade(attempted, correct)` to get grade
2. Pass `bonusCardOptions` and `guaranteeUncommon` to the reward generation function
3. Reward generator adds +1 to card option count if `bonusCardOptions > 0`
4. Reward generator forces minimum rarity to uncommon if `guaranteeUncommon`

Find where the card reward screen receives its options count (currently 3 cards to choose from). Add the bonus:

```typescript
const grade = calculateAccuracyGrade(chargesAttempted, chargesCorrect);
const cardOptionCount = BASE_CARD_OPTIONS + grade.bonusCardOptions; // 3 + 0 or 1
const minRarity = grade.guaranteeUncommon ? 'uncommon' : undefined;
```

**Acceptance criteria:**
- 80%+ accuracy → 4 card options shown in reward screen
- 90%+ accuracy → 4 card options AND at least one is uncommon or better
- Below 80% → standard 3 card options, normal rarity distribution
- QP-only encounters → standard rewards (no penalty)

### 4. Display Grade Badge on Reward Screen

**File:** Reward UI component (card selection overlay)

Show a grade badge (S/A/B/C) on the reward screen after combat:
- **S grade:** Gold badge with shimmer effect
- **A grade:** Silver badge
- **B/C grade:** Subtle or no badge (don't rub it in)
- Position: top of reward screen, near "Choose a card" header
- **Scaling:** All sizes use `calc(Npx * var(--layout-scale, 1))`

**Acceptance criteria:**
- Grade badge visible on reward screen for A and S grades
- B/C grades show subtle or no badge
- No hardcoded px values

### 5. Unit Tests

**New file:** `tests/unit/accuracyGradeSystem.test.ts`

Test cases:
- 0 attempts → grade C, no bonuses
- 1/1 correct (100%) → grade S
- 9/10 correct (90%) → grade S
- 8/10 correct (80%) → grade A
- 7/10 correct (70%) → grade B
- 5/10 correct (50%) → grade C
- Boundary: 89% → grade A (not S)
- Boundary: 79% → grade B (not A)

**Acceptance criteria:** All tests pass.

### 6. Update GDD

**File:** `docs/GAME_DESIGN.md`

Add new section (§4.9 or appropriate location):
- **Accuracy Grade** — describe the grading system, thresholds, reward bonuses
- Note: pure upside, no penalties for low accuracy

**Acceptance criteria:** System documented with all thresholds and effects.

---

## Files Affected

| File | Change |
|------|--------|
| NEW: `src/services/accuracyGradeSystem.ts` | Grade calculation module |
| `src/services/turnManager.ts` | Charge attempt/correct counters |
| `src/services/encounterBridge.ts` | Pass grade to reward generation |
| Reward UI component | Grade badge display |
| NEW: `tests/unit/accuracyGradeSystem.test.ts` | Unit tests |
| `docs/GAME_DESIGN.md` | New accuracy grade section |

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] `npx vitest run` — all tests pass
- [ ] Playwright visual: grade badge appears on reward screen after combat
- [ ] Verify: 90%+ accuracy → 4 card options (count cards in reward picker)
- [ ] Verify: QP-only encounter → 3 card options, no badge
