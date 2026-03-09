# CR-08: Mastery Tiers (4-Tier Progression)

> Phase: P1 — Core Systems Completion
> Priority: HIGH
> Depends on: CR-FIX-06 (FSRS migration), CR-FIX-04 (commit-before-reveal)
> Estimated scope: L

Evolve the current flat 3-tier card system (1/2/3) into a 4-tier progression (1 → 2a → 2b → 3) with escalating question difficulty at each tier. Tier 3 graduation requires passing a Mastery Trial — a high-stakes exam with tight timer and close distractors. This creates the core progression loop: facts get harder as you learn them, and mastering a fact permanently upgrades it to a passive relic.

## Design Reference

From GAME_DESIGN.md Section 5 (Card Tiers and Mastery Difficulty Escalation):

| Tier | Name | FSRS Trigger | Question Format | Power | Visual |
|------|------|-------------|----------------|-------|--------|
| 1 | Learning | Stability <5d | 3-option MCQ, generous timer | 1.0x | Standard frame |
| 2a | Recall | Stability 5-15d, 3+ correct | 4-option MCQ OR reverse format | 1.3x | Silver tint |
| 2b | Deep Recall | Stability 15-30d, 5+ correct | 5-option close distractors OR fill-blank | 1.6x | Silver + glow |
| 3 | Mastered | Pass Mastery Trial | Not asked — passive relic | Permanent | Gold frame, relic tray |

From GAME_DESIGN.md Section 5 (Mastery Trial):

- Fact at Tier 2b + stability >30d + 7 consecutive correct → qualifies
- Golden card in hand
- 4-second timer (regardless of floor, no slow reader bonus)
- 5 options with very close distractors
- Hardest variant available
- Correct → Tier 3, passive relic, celebration
- Incorrect → stays Tier 2b, FSRS stability decreases, must requalify

From GAME_DESIGN.md Section 26 (FSRS Tier Derivation):

```typescript
function getCardTier(state: PlayerFactState): '1' | '2a' | '2b' | '3' {
  if (state.stability >= 30 && state.consecutiveCorrect >= 7 && state.passedMasteryTrial) return '3';
  if (state.stability >= 15 && state.consecutiveCorrect >= 5) return '2b';
  if (state.stability >= 5 && state.consecutiveCorrect >= 3) return '2a';
  return '1';
}
```

From GAME_DESIGN.md Section 4 (Modifier Stacking):

> Base value × Tier multiplier (1.0/1.3/1.6) × Difficulty multiplier (0.8-1.6) × Combo multiplier (1.0-2.0) × Speed bonus (1.0/1.5) = Final effect (round down).

## Implementation

### Data Model

**Change `CardTier` type** in `src/data/card-types.ts`:

```typescript
// OLD:
export type CardTier = 1 | 2 | 3;

// NEW:
export type CardTier = '1' | '2a' | '2b' | '3';
```

**Update `TIER_MULTIPLIER`** in `src/data/balance.ts`:

```typescript
// OLD:
export const TIER_MULTIPLIER: Record<number, number> = { 1: 1.0, 2: 1.5, 3: 0 };

// NEW:
export const TIER_MULTIPLIER: Record<string, number> = {
  '1': 1.0,
  '2a': 1.3,
  '2b': 1.6,
  '3': 0,   // Tier 3 cards don't play — they're passive relics
};
```

**Add `MASTERY_TRIAL` config** to `src/data/balance.ts`:

```typescript
export const MASTERY_TRIAL = {
  TIMER_SECONDS: 4,
  ANSWER_OPTIONS: 5,
  REQUIRED_STABILITY: 30,
  REQUIRED_CONSECUTIVE_CORRECT: 7,
  USE_HARDEST_VARIANT: true,
  SLOW_READER_BONUS: false,
};
```

**Add `TIER_QUESTION_FORMAT` config** to `src/data/balance.ts`:

```typescript
export const TIER_QUESTION_FORMAT: Record<string, {
  options: number;
  allowReverse: boolean;
  allowFillBlank: boolean;
  useCloseDistractors: boolean;
}> = {
  '1':  { options: 3, allowReverse: false, allowFillBlank: false, useCloseDistractors: false },
  '2a': { options: 4, allowReverse: true,  allowFillBlank: false, useCloseDistractors: false },
  '2b': { options: 5, allowReverse: true,  allowFillBlank: true,  useCloseDistractors: true },
  '3':  { options: 0, allowReverse: false, allowFillBlank: false, useCloseDistractors: false },
};
```

**Update `Card` interface** in `src/data/card-types.ts`:

```typescript
export interface Card {
  id: string;
  factId: string;
  cardType: CardType;
  domain: FactDomain;
  tier: CardTier;              // Now '1' | '2a' | '2b' | '3'
  baseEffectValue: number;
  effectMultiplier: number;
  isEcho?: boolean;
  isMasteryTrial?: boolean;    // NEW: true when this card is a Mastery Trial candidate
}
```

### Logic

**Tier derivation** — Create `src/services/tierDerivation.ts`:

```typescript
import type { CardTier } from '../data/card-types';

// PlayerFactState assumed to exist from CR-FIX-06 (FSRS migration)
export function getCardTier(state: {
  stability: number;
  consecutiveCorrect: number;
  passedMasteryTrial: boolean;
}): CardTier {
  if (state.stability >= 30 && state.consecutiveCorrect >= 7 && state.passedMasteryTrial) return '3';
  if (state.stability >= 15 && state.consecutiveCorrect >= 5) return '2b';
  if (state.stability >= 5 && state.consecutiveCorrect >= 3) return '2a';
  return '1';
}

export function qualifiesForMasteryTrial(state: {
  stability: number;
  consecutiveCorrect: number;
  passedMasteryTrial: boolean;
}): boolean {
  return (
    getCardTier(state) === '2b' &&
    state.stability >= 30 &&
    state.consecutiveCorrect >= 7 &&
    !state.passedMasteryTrial
  );
}
```

**Update `cardFactory.ts`:**
- `computeTier()` must use `getCardTier()` from FSRS state (replaces SM-2 interval-based tier)
- Cards qualifying for Mastery Trial get `isMasteryTrial: true`
- Tier 3 facts are NOT included as active cards — they become passive relics (handled by CR-09)

**Update `cardEffectResolver.ts`:**
- Change all `TIER_MULTIPLIER[card.tier]` lookups to use string keys (`'1'`, `'2a'`, `'2b'`, `'3'`)
- No other resolution logic changes needed (multiplier chain stays the same)

**Question format selection** — Create `src/services/questionFormatter.ts`:

```typescript
import { TIER_QUESTION_FORMAT, MASTERY_TRIAL } from '../data/balance';
import type { CardTier } from '../data/card-types';

export interface QuestionPresentation {
  optionCount: number;
  useReverse: boolean;
  useFillBlank: boolean;
  useCloseDistractors: boolean;
  timerOverride?: number;
  disableSlowReader?: boolean;
}

export function getQuestionPresentation(
  tier: CardTier,
  isMasteryTrial: boolean,
): QuestionPresentation {
  if (isMasteryTrial) {
    return {
      optionCount: MASTERY_TRIAL.ANSWER_OPTIONS,
      useReverse: false,
      useFillBlank: false,
      useCloseDistractors: true,
      timerOverride: MASTERY_TRIAL.TIMER_SECONDS,
      disableSlowReader: true,
    };
  }
  const format = TIER_QUESTION_FORMAT[tier];
  return {
    optionCount: format.options,
    useReverse: format.allowReverse && Math.random() < 0.3,
    useFillBlank: format.allowFillBlank && Math.random() < 0.2,
    useCloseDistractors: format.useCloseDistractors,
  };
}
```

**Update `encounterBridge.ts`:**
- When generating quiz options for a committed card, use `getQuestionPresentation()` to determine format
- Pass `isMasteryTrial` flag through to the quiz UI
- On Mastery Trial result: if correct, update PlayerFactState `passedMasteryTrial = true`; if incorrect, decrease FSRS stability

### UI

**Card visual tiers** — Update card rendering to show tier-appropriate visuals:
- Tier 1: Standard card frame (current default)
- Tier 2a: Silver-tinted border (`border-color: #C0C0C0`, subtle gradient)
- Tier 2b: Silver border + pulsing glow animation (CSS `box-shadow` pulse)
- Tier 3: N/A — these never appear as hand cards
- Mastery Trial candidate: Gold border + shimmer animation, "TRIAL" badge in corner

**Quiz option count:**
- Currently shows 3 options always
- Must dynamically render 3/4/5 options based on `QuestionPresentation.optionCount`
- Answer buttons maintain 56dp height, full width, 8dp spacing regardless of count

**Mastery Trial UI:**
- Timer bar changes to GOLD color
- "MASTERY TRIAL" header text above question
- Timer shows 4s (ignores floor scaling and slow reader)
- On success: golden burst particle effect, "MASTERED!" text, card transforms to relic icon
- On failure: soft dimming, "Not yet..." text, card returns to hand

### System Interactions

- **Combo multiplier:** Applies normally at all tiers. Tier doesn't affect combo.
- **AP cost:** All tiers cost 1 AP (unless mechanic specifies otherwise like Heavy Strike).
- **Speed bonus:** Applies normally. Mastery Trial does NOT grant speed bonus (timer too tight).
- **FSRS update:** Every answer (correct or wrong) at any tier updates FSRS state. Mastery Trial updates are particularly impactful (large stability change).
- **Passive relics (CR-09):** Tier 3 conversion to relics is handled by CR-09. This CR only handles the tier derivation and Mastery Trial gate.
- **Echo cards:** Echo cards always play at their original tier's question format. An Echo of a Tier 2b fact still gets 5 options.
- **Run pool builder:** Must filter out Tier 3 facts from the active pool and inject qualifying Mastery Trial candidates with `isMasteryTrial: true`.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Fact exactly at stability boundary (stability = 5.0) | Tier 2a (>= 5 threshold met) |
| Player answers wrong on Mastery Trial | Stays Tier 2b, consecutiveCorrect resets to 0, stability decreases via FSRS |
| Mastery Trial card fizzled (timer expired) | Same as wrong answer — stays Tier 2b, must requalify |
| All remaining cards in deck are Tier 3 | Shouldn't happen — Tier 3 excluded from run pool. If somehow triggered, show "All facts mastered!" |
| Tier 2b → wrong → drops below stability threshold | Falls back to Tier 2a or 1 per FSRS state. `getCardTier()` always reads live state. |
| Multiple Mastery Trial candidates in same hand | All can appear. Each costs 1 AP. Player decides which to attempt. |
| Mastery Trial with fewer than 5 distractors available | Use best available. If only 3 distractors available, show 4 options instead of 5. |

## Files

| Action | File | What Changes |
|--------|------|-------------|
| Modify | `src/data/card-types.ts` | Change `CardTier` to string union, add `isMasteryTrial` to Card |
| Modify | `src/data/balance.ts` | Add MASTERY_TRIAL config, TIER_QUESTION_FORMAT, update TIER_MULTIPLIER keys |
| Create | `src/services/tierDerivation.ts` | `getCardTier()`, `qualifiesForMasteryTrial()` |
| Create | `src/services/questionFormatter.ts` | `getQuestionPresentation()` |
| Modify | `src/services/cardFactory.ts` | Use FSRS-based tier derivation, mark Mastery Trial candidates |
| Modify | `src/services/cardEffectResolver.ts` | Update TIER_MULTIPLIER lookups for string keys |
| Modify | `src/services/runPoolBuilder.ts` | Filter Tier 3 facts, inject Mastery Trial candidates |
| Modify | `src/services/encounterBridge.ts` | Pass question format to quiz UI, handle Mastery Trial results |
| Modify | `src/ui/components/CardCombatOverlay.svelte` | Dynamic option count, Mastery Trial visual treatment |
| Create | `tests/unit/tierDerivation.test.ts` | Unit tests for tier derivation |
| Create | `tests/unit/questionFormatter.test.ts` | Unit tests for question format selection |

## Done When

- [ ] `CardTier` type is `'1' | '2a' | '2b' | '3'` everywhere (no numeric 1/2/3 in any active file)
- [ ] Tier derivation uses FSRS stability + consecutiveCorrect thresholds
- [ ] Tier 1 cards show 3 answer options
- [ ] Tier 2a cards show 4 answer options (with occasional reverse format)
- [ ] Tier 2b cards show 5 answer options with close distractors
- [ ] Mastery Trial candidates appear with gold border + "TRIAL" badge
- [ ] Mastery Trial uses 4s timer, 5 close distractors, ignores slow reader
- [ ] Correct Mastery Trial → `passedMasteryTrial = true` in FSRS state
- [ ] Incorrect Mastery Trial → fact stays Tier 2b, stability decreases, consecutiveCorrect resets
- [ ] Tier multipliers are 1.0x / 1.3x / 1.6x / 0 (passive)
- [ ] Tier 3 facts excluded from active run pool
- [ ] All existing unit tests pass with updated CardTier type
- [ ] New unit tests cover tier derivation edge cases and question format selection
