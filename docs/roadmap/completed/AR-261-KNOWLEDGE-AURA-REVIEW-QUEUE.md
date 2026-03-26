# AR-261: Knowledge Aura + Review Queue Systems

## Overview

**Goal:** Add two new per-encounter subsystems that make quiz performance shape the battlefield beyond individual card plays. These are **foundation systems** — AR-264 (cards), AR-265 (relics), and AR-266 (events) depend on them.

**Why:** Currently, correct/wrong answers only affect individual card plays via the QP×1.5 multiplier. Knowledge Aura makes your *pattern* of quiz performance reshape combat (enemies hit harder during Brain Fog, you draw more in Flow State). Review Queue makes wrong answers tangible — visible mistakes that specific cards/relics can reference for redemption bonuses.

**Dependencies:** AR-260 (HP scaling) should be done first
**Blocks:** AR-264, AR-265, AR-266
**Estimated complexity:** Medium-High (new combat subsystems + UI + turnManager integration)

**Reference:** `docs/RESEARCH/05 Overhaul relics cards.md` lines 258-289

---

## Sub-steps

### 1. Create Knowledge Aura Module

**New file:** `src/services/knowledgeAuraSystem.ts`

Follow the `chainSystem.ts` pattern: private module state, pure exported functions, no Svelte/Phaser imports.

```typescript
// === Knowledge Aura System (AR-261) ===
// Per-encounter gauge (0-10) driven by Charge accuracy.
// Three states: Brain Fog (0-3), Neutral (4-6), Flow State (7-10).

export type AuraState = 'brain_fog' | 'neutral' | 'flow_state';

export interface AuraSnapshot {
  level: number;
  state: AuraState;
}

const AURA_MIN = 0;
const AURA_MAX = 10;
const AURA_START = 5;
const BRAIN_FOG_THRESHOLD = 3;   // 0-3 inclusive
const FLOW_STATE_THRESHOLD = 7;  // 7-10 inclusive

let _auraLevel: number = AURA_START;

/** Reset aura to starting value. Called at encounter start. */
export function resetAura(): void { ... }

/** Adjust aura by delta, clamped to [0, 10]. */
export function adjustAura(delta: number): void { ... }

/** Get current aura state. */
export function getAuraState(): AuraState { ... }

/** Get current numeric aura level. */
export function getAuraLevel(): number { ... }

/** Get full snapshot for UI/resolver consumption. */
export function getAuraSnapshot(): AuraSnapshot { ... }
```

**Aura adjustment rules:**
| Event | Delta |
|-------|-------|
| Correct Charge | +1 |
| Wrong Charge | -2 |
| Quick Play | 0 (no change) |

**State effects:**
| Range | State | Effect |
|-------|-------|--------|
| 0-3 | Brain Fog | Enemies deal +20% damage |
| 4-6 | Neutral | Nothing |
| 7-10 | Flow State | Draw +1 card per turn |

**Acceptance criteria:**
- Module exports `resetAura`, `adjustAura`, `getAuraState`, `getAuraLevel`, `getAuraSnapshot`
- Aura clamps to [0, 10] — never goes below 0 or above 10
- State thresholds: 0-3 = brain_fog, 4-6 = neutral, 7-10 = flow_state
- No imports from Svelte, Phaser, or stores

### 2. Create Review Queue Module

**New file:** `src/services/reviewQueueSystem.ts`

Same pattern as knowledgeAuraSystem — private state, pure functions.

```typescript
// === Review Queue System (AR-261) ===
// Per-encounter list of factIds from wrong Charge answers.
// Specific cards (Recall) and relics (Scholar's Crown) reference it.

let _queue: string[] = [];

/** Reset queue. Called at encounter start. */
export function resetReviewQueue(): void { ... }

/** Add a factId to the queue (from a wrong Charge). */
export function addToReviewQueue(factId: string): void { ... }

/** Check if a factId is in the review queue. */
export function isReviewQueueFact(factId: string): boolean { ... }

/** Remove a factId from the queue (correct Charge on reviewed fact). Returns true if it was present. */
export function clearReviewQueueFact(factId: string): boolean { ... }

/** Get top N facts for UI display. */
export function getTopReviewFacts(n: number): string[] { ... }

/** Get current queue length. */
export function getReviewQueueLength(): number { ... }
```

**Acceptance criteria:**
- Module exports all listed functions
- `addToReviewQueue` does not add duplicates (same factId twice)
- `clearReviewQueueFact` returns `true` if the fact was in the queue (for triggering bonus effects)
- No imports from Svelte, Phaser, or stores

### 3. Integrate into turnManager.ts

**File:** `src/services/turnManager.ts`

**Integration points:**

1. **Encounter start** (in `startEncounter()` or equivalent):
   ```typescript
   import { resetAura } from './knowledgeAuraSystem';
   import { resetReviewQueue } from './reviewQueueSystem';

   // At encounter start:
   resetAura();
   resetReviewQueue();
   ```

2. **Charge correct path** (~line 1162, where `consecutiveCorrectThisEncounter` is incremented):
   ```typescript
   import { adjustAura } from './knowledgeAuraSystem';
   import { clearReviewQueueFact } from './reviewQueueSystem';

   adjustAura(+1);
   const wasReviewFact = clearReviewQueueFact(factId);
   // wasReviewFact flag can be passed to card resolver for bonus damage
   ```

3. **Charge wrong path** (~line 862):
   ```typescript
   adjustAura(-2);
   addToReviewQueue(factId);
   ```

4. **Quick Play path:** No aura/queue changes needed.

**Acceptance criteria:**
- Aura adjusts on every Charge (correct: +1, wrong: -2)
- Wrong Charge factIds are added to review queue
- Correct Charge on a review queue fact clears it
- Both systems reset at encounter start

### 4. Wire Brain Fog Effect — Enemy Damage +20%

**File:** `src/services/enemyManager.ts` (in damage application)

When `getAuraState() === 'brain_fog'`, multiply enemy damage by 1.2.

Find the enemy damage application path (where `ENEMY_TURN_DAMAGE_CAP` is applied) and add the Brain Fog multiplier:

```typescript
import { getAuraState } from './knowledgeAuraSystem';

// In enemy damage calculation, after base damage but before cap:
if (getAuraState() === 'brain_fog') {
  damage = Math.round(damage * 1.2);
}
```

**Acceptance criteria:**
- Enemy damage is 1.2× during Brain Fog (aura 0-3)
- No damage change during Neutral or Flow State
- Damage cap (`ENEMY_TURN_DAMAGE_CAP`) still applies after the multiplier

### 5. Wire Flow State Effect — Draw +1 Card

**File:** `src/services/turnManager.ts` or `src/services/relicEffectResolver.ts` (wherever base draw count is computed)

When `getAuraState() === 'flow_state'`, add +1 to the turn's draw count.

Find the draw count calculation (currently base 5 cards, modified by relics) and add:

```typescript
import { getAuraState } from './knowledgeAuraSystem';

// In draw count calculation:
let drawCount = BASE_HAND_SIZE; // 5
drawCount += relicDrawBonus;
if (getAuraState() === 'flow_state') {
  drawCount += 1;
}
```

**Acceptance criteria:**
- Player draws +1 card per turn when in Flow State (aura 7-10)
- Standard draw count when in Neutral or Brain Fog
- Stacks with relic draw bonuses

### 6. Knowledge Aura UI — Visual Indicator

**File:** `src/ui/components/CardCombatOverlay.svelte`

Add a visual indicator near the player HP bar showing the current aura state:

- **Position:** Near player HP bar (ring, badge, or small gauge)
- **Colors:** Blue/purple at low (Brain Fog), neutral at mid, warm gold at high (Flow State)
- **Display:** Show the numeric aura level (0-10) and current state label
- **Transitions:** Smooth color transitions as aura changes
- **Scaling:** All sizes use `calc(Npx * var(--layout-scale, 1))`, all fonts use `calc(Npx * var(--text-scale, 1))`

**Acceptance criteria:**
- Aura indicator is visible during combat
- Updates in real-time when aura changes
- Color reflects current state (blue/purple for Brain Fog, gold for Flow State)
- No hardcoded px values

### 7. Review Queue UI — Small Icons

**File:** `src/ui/components/CardCombatOverlay.svelte`

Add a small display near the chain indicator showing the review queue:

- **Position:** Near chain display area
- **Display:** Show top 3 review queue facts as small card-like icons or question marks
- **Count badge:** If queue has >3 items, show "+N" badge
- **Empty state:** Hidden when queue is empty
- **Scaling:** All sizes use `calc(Npx * var(--layout-scale, 1))`

**Acceptance criteria:**
- Review queue icons visible when queue has items
- Hidden when queue is empty
- Shows top 3 with overflow count
- No hardcoded px values

### 8. Unit Tests

**New file:** `tests/unit/knowledgeAuraSystem.test.ts`
**New file:** `tests/unit/reviewQueueSystem.test.ts`

Test cases for Knowledge Aura:
- `resetAura()` sets level to 5
- `adjustAura(+1)` increments, clamped at 10
- `adjustAura(-2)` decrements, clamped at 0
- State thresholds: 0→brain_fog, 3→brain_fog, 4→neutral, 6→neutral, 7→flow_state, 10→flow_state
- Edge case: aura at 1, wrong charge (-2) → clamped to 0

Test cases for Review Queue:
- `resetReviewQueue()` clears all entries
- `addToReviewQueue(id)` adds to queue
- No duplicate factIds
- `isReviewQueueFact(id)` returns correct boolean
- `clearReviewQueueFact(id)` returns true when present, false when not
- `getTopReviewFacts(3)` returns at most 3

**Acceptance criteria:** All tests pass.

### 9. Update GDD

**File:** `docs/GAME_DESIGN.md`

Add new sections:
- **§4.7 Knowledge Aura** — describe gauge, states, effects, interaction rules
- **§4.8 Review Queue** — describe queue mechanics, which cards/relics reference it

**Acceptance criteria:** Both systems are documented with all rules and values.

---

## Files Affected

| File | Change |
|------|--------|
| NEW: `src/services/knowledgeAuraSystem.ts` | Knowledge Aura module |
| NEW: `src/services/reviewQueueSystem.ts` | Review Queue module |
| `src/services/turnManager.ts` | Lifecycle integration (encounter start, charge correct/wrong) |
| `src/services/enemyManager.ts` | Brain Fog damage multiplier |
| `src/ui/components/CardCombatOverlay.svelte` | Aura indicator + Review Queue icons |
| NEW: `tests/unit/knowledgeAuraSystem.test.ts` | Aura unit tests |
| NEW: `tests/unit/reviewQueueSystem.test.ts` | Queue unit tests |
| `docs/GAME_DESIGN.md` | New §4.7 and §4.8 |

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] `npx vitest run` — all tests pass (including new ones)
- [ ] Playwright visual: aura indicator visible during combat, updates on charge
- [ ] Playwright visual: review queue icons appear after wrong charge, disappear on correct
- [ ] Brain Fog: enemy damage visibly higher at aura 0-3 (check via console log or `__terraDebug`)
- [ ] Flow State: draw count is 6 instead of 5 at aura 7+ (verify via card hand count)
