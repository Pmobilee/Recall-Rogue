# CR-06: Knowledge Combo

> **Goal:** In-turn combo multiplier that rewards consecutive correct answers. Combo count escalates from 1.0x to 2.0x (perfect turn), creating card-ordering strategy: play easy facts first to build combo, or hard facts first for higher base power.

## Overview

| Field | Value |
|-------|-------|
| Dependencies | CR-01 (Card Foundation), CR-02 (Encounter Engine), CR-03 (Combat Scene), CR-04 (Card Hand UI) |
| Estimated Complexity | Small-Medium (0.5-1 day) |
| Priority | P0 — Core Prototype |

The Knowledge Combo is a mechanic unique to educational card games — a within-turn combo multiplier tied to player knowledge confidence. No other card roguelite has this because no other card roguelite has questions to answer. Each consecutive correct answer in a single turn increases a multiplier applied to card effects (GAME_DESIGN.md Section 6, 03_UX_IMPROVEMENTS.md Section 4).

**Strategic depth:** This creates meaningful card-ordering decisions every turn. Play easy facts first to build the combo and let the multiplier amplify harder cards later. OR play hard facts first because their base power is already higher (from difficulty-proportional scaling in GAME_DESIGN.md Section 7), accepting the risk of breaking the combo early.

---

## Sub-steps

### 1. Combo state in TurnManager

**File:** `src/services/turnManager.ts` (created in CR-02)

CR-02 already defines a `comboCount` field in TurnManager. This step adds the full combo logic.

**Combo rules:**
- Combo starts at 0 at the beginning of each player turn
- Increments by 1 on each correct answer
- Resets to 0 on wrong answer
- Resets to 0 when a new player turn begins (enemy turn resets it)
- Skipping a card does NOT reset the combo (skip is neutral)

**Combo multiplier lookup:**
```typescript
const COMBO_MULTIPLIERS: Record<number, number> = {
  0: 1.0,    // No cards played yet
  1: 1.0,    // 1st correct — no bonus
  2: 1.15,   // 2nd consecutive correct
  3: 1.3,    // 3rd
  4: 1.5,    // 4th
  5: 2.0,    // 5th (perfect turn)
}

export function getComboMultiplier(comboCount: number): number {
  return COMBO_MULTIPLIERS[Math.min(comboCount, 5)] ?? 1.0
}
```

**Add to TurnManager state:**
```typescript
interface TurnState {
  // ... existing fields from CR-02
  comboCount: number           // Current consecutive correct in this turn
  comboMultiplier: number      // Current multiplier (derived from comboCount)
  isPerfectTurn: boolean       // True if all 5 cards answered correctly
  cardsPlayedThisTurn: number  // Total cards played (correct + wrong, not skips)
  cardsCorrectThisTurn: number // Correct answers this turn
}
```

**TurnManager methods to add/modify:**
```typescript
/** Called after a correct answer. Increments combo, returns new multiplier. */
incrementCombo(): number

/** Called after a wrong answer. Resets combo to 0, returns 1.0. */
resetCombo(): number

/** Called at start of player turn. Resets combo state. */
resetTurnState(): void

/** Check if this turn is a perfect turn (5/5 correct). */
checkPerfectTurn(): boolean
```

### 2. Apply combo multiplier to card effects

**File:** `src/services/turnManager.ts`

Modify the `resolveCardEffect()` method (from CR-02) to apply the combo multiplier.

**Before applying combo:**
```typescript
// From CR-02:
function resolveCardEffect(card: Card, correct: boolean): CardEffectResult {
  if (!correct) return { fizzle: true }
  const baseEffect = card.baseEffectValue
  // ... difficulty multiplier, speed bonus, etc.
}
```

**After adding combo:**
```typescript
function resolveCardEffect(card: Card, correct: boolean, speedBonusAchieved: boolean): CardEffectResult {
  if (!correct) {
    this.resetCombo()
    return { fizzle: true, comboCount: 0, comboMultiplier: 1.0 }
  }

  this.incrementCombo()
  const comboMultiplier = getComboMultiplier(this.state.comboCount)

  const baseEffect = card.baseEffectValue
  const difficultyMultiplier = getDifficultyMultiplier(card.easeFactor)  // From CR-01
  const speedMultiplier = speedBonusAchieved ? 1.5 : 1.0                // GAME_DESIGN.md §7
  const totalEffect = Math.round(baseEffect * difficultyMultiplier * speedMultiplier * comboMultiplier)

  return {
    fizzle: false,
    effectValue: totalEffect,
    comboCount: this.state.comboCount,
    comboMultiplier,
    isCritical: speedBonusAchieved,
    isPerfectTurn: this.checkPerfectTurn(),
  }
}
```

**Multiplier stacking order:**
1. Base effect value (from card/fact)
2. Difficulty multiplier (from SM-2 ease factor — harder facts = stronger cards)
3. Speed bonus (1.5x if answered in first 25% of timer)
4. Combo multiplier (1.0x-2.0x based on consecutive correct)
5. Round to nearest integer

### 3. ComboCounter.svelte — Visual component

**File:** `src/ui/components/ComboCounter.svelte`

This component was stubbed in CR-05 step 9. This step fully implements it with all combo-level visuals.

**Props:**
```typescript
interface ComboCounterProps {
  comboCount: number       // 0-5
  isPerfectTurn: boolean   // True when 5th card is correct
}
```

**Rendering by combo level (from GAME_DESIGN.md Section 6):**

| comboCount | Display | Font Size | Effects |
|------------|---------|-----------|---------|
| 0-1 | Nothing (hidden) | — | — |
| 2 | "2x" golden text | 20px | Slight golden glow (text-shadow: 0 0 8px #FFD700) |
| 3 | "3x" golden text | 24px | Brighter glow + particle ring |
| 4 | "4x" golden text | 28px | Strong glow + screen edge pulse |
| 5 | "PERFECT!" golden text | 36px | Full celebration burst |

**Position:** Right side of the screen, vertically at the boundary between display zone and interaction zone (~52% from top, 16dp from right edge).

**`data-testid="combo-counter"`**

**Combo increment animation (plays on every combo increase):**
```css
.combo-pop {
  animation: comboPop 300ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
@keyframes comboPop {
  0%   { transform: scale(1.5); opacity: 0.7; }
  50%  { transform: scale(1.6); opacity: 1; }
  100% { transform: scale(1.0); opacity: 1; }
}
```

**Combo reset animation (plays when combo breaks on wrong answer):**
```css
.combo-break {
  animation: comboBreak 200ms ease-out forwards;
}
@keyframes comboBreak {
  0%   { transform: scale(1.0); opacity: 1; }
  100% { transform: scale(0.5); opacity: 0; }
}
```

### 4. Particle ring at combo 3+

**File:** `src/ui/components/ComboCounter.svelte`

At combo count 3 and above, display a ring of orbiting particles around the combo text.

**Implementation (CSS-based for performance):**
- 8 small circles (6x6dp each, gold color #FFD700)
- Arranged in a 30dp radius circle around the combo text center
- Rotate the entire ring container: `animation: spin 2s linear infinite`
- Each particle has slight opacity variation (0.6-1.0) for shimmer effect
- At combo 4+: particles increase to 12, radius increases to 40dp
- At combo 5: particles are 16, radius 50dp, each particle is larger (8x8dp)

```css
.particle-ring {
  animation: spin 2s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

**Generate particle positions with Svelte:**
```svelte
{#each particles as particle, i}
  <div
    class="orbit-particle"
    style:left="{Math.cos(i * 2 * Math.PI / particles.length) * radius + radius}px"
    style:top="{Math.sin(i * 2 * Math.PI / particles.length) * radius + radius}px"
  />
{/each}
```

### 5. Screen edge pulse at combo 4

**File:** `src/ui/components/CombatOverlay.svelte`

At combo count 4, add a golden vignette pulse on the screen edges.

**Implementation:**
- Absolute-positioned div covering the full screen
- CSS `box-shadow: inset 0 0 60px 20px rgba(255, 215, 0, 0.15)`
- Pulse animation: opacity 0 → 0.15 → 0 over 400ms, triggered on combo reaching 4
- Only the left and right edges glow (top and bottom are less visible)
- `pointer-events: none` so it doesn't block interaction
- Remove when combo resets

### 6. Perfect turn celebration (combo 5)

**File:** `src/ui/components/ComboCounter.svelte` + `src/services/juiceManager.ts` + `src/game/scenes/CombatScene.ts`

When all 5 cards in a turn are answered correctly:

**Svelte side (ComboCounter):**
1. "PERFECT!" text replaces "5x", font size 36px, gold with strong glow
2. Text bounces in with exaggerated spring animation over 500ms
3. All remaining cards in hand (there should be none, but if any) glow gold border

**JuiceManager side:**
1. Triple haptic: `tapHeavy()` x3, 80ms delays
2. Sound stub: `emitSound('combo-5')`

**Phaser side (CombatScene):**
1. Gold particle explosion: 50 particles from screen center (max budget, using existing emitter)
2. Lifespan: 500ms (longer than normal burst)
3. Speed: 150-300 (faster than normal)
4. Brief screen flash: gold tint (#FFD700) at 20% opacity, 200ms fade

**Trigger:** JuiceManager detects `isPerfectTurn: true` in the CardEffectResult from step 2, fires the celebration sequence after the 5th card's normal juice stack completes (500ms delay).

### 7. Combo interaction with card ordering strategy

**File:** No new file — this is emergent from the system, but document it for testing.

The combo system creates a strategic decision every turn:

**Strategy A — "Build the Combo":**
- Play easy/confident cards first (1st, 2nd, 3rd)
- Save hard/uncertain cards for later positions (4th, 5th)
- Benefit: hard cards get 1.5x-2.0x combo multiplier if you answer correctly
- Risk: if you get a hard card wrong at position 4, you lose the combo bonus on card 5

**Strategy B — "Front-load Power":**
- Play hard cards first (they have higher base power from difficulty-proportional scaling)
- Hard facts at ease factor 1.0-1.49 get 1.6x base multiplier
- Easy facts at ease factor 2.5+ only get 0.8x base multiplier
- Benefit: hard cards deal more base damage even at 1.0x combo
- Risk: if you fail early, combo never builds and remaining easy cards are weak

**This is not implemented in code — it's a natural consequence of the combo multiplier + difficulty-proportional power systems interacting. Players discover this organically.**

**Testing:** Verify that a 5-card perfect turn with all easy facts (0.8x base) at 2.0x combo deals MORE total damage than 5 hard facts (1.6x base) at 1.0x combo (3 wrong, 2 correct). This validates the "build the combo" strategy as viable.

---

## Acceptance Criteria

| # | Criterion | How to Verify |
|---|-----------|---------------|
| 1 | Combo count increments on correct answer | Play 3 correct cards, verify comboCount === 3 via `window.__terraDebug()` |
| 2 | Combo resets on wrong answer | Play 2 correct then 1 wrong, verify comboCount === 0 |
| 3 | Combo resets at start of new player turn | Complete a turn with 3-combo, verify next turn starts at 0 |
| 4 | Skip does NOT reset combo | Play 2 correct, skip 1, play correct → verify comboCount === 3 |
| 5 | Multiplier applied correctly: 2nd card at 1.15x, 5th at 2.0x | Check resolved damage values in console/debug |
| 6 | ComboCounter hidden at combo 0-1 | Screenshot — no combo text visible after first card |
| 7 | ComboCounter shows "2x" with glow at combo 2 | Screenshot after 2nd correct answer |
| 8 | Particle ring appears at combo 3 | Screenshot — 8 orbiting particles visible |
| 9 | Screen edge pulse at combo 4 | Screenshot — golden vignette visible at edges |
| 10 | Perfect turn celebration fires at combo 5 | Screenshot — "PERFECT!" text + gold burst |
| 11 | `data-testid="combo-counter"` present | DOM query verification |
| 12 | Combo multiplier stacks with speed bonus and difficulty multiplier correctly | Unit test: base 10, difficulty 1.3x, speed 1.5x, combo 2.0x = 39 |
| 13 | 60fps maintained during combo 5 celebration | Performance timing check |

---

## Verification Gate

- [ ] `npm run typecheck` passes with 0 errors
- [ ] `npm run build` succeeds
- [ ] `npx vitest run` passes (add unit tests for combo multiplier math)
- [ ] Combo counter visual at each level (2, 3, 4, 5) verified via Playwright screenshots
- [ ] Combo resets on wrong answer — verified via `browser_evaluate` state check
- [ ] Combo resets on new turn — verified via state check
- [ ] Skip does not break combo — verified via state check
- [ ] Perfect turn celebration fires all effects (haptic, particles, text, sound stub)
- [ ] Multiplier math correct: `round(base * difficulty * speed * combo)` — verified via unit test
- [ ] No console errors during combo sequences
- [ ] 60fps maintained during combo 5 celebration

---

## Files Affected

| Action | File |
|--------|------|
| MODIFY | `src/services/turnManager.ts` — Add combo state, incrementCombo(), resetCombo(), getComboMultiplier(), apply multiplier in resolveCardEffect() |
| MODIFY | `src/ui/components/ComboCounter.svelte` — Full implementation (was stubbed in CR-05): all 5 combo levels, particle ring, animations |
| MODIFY | `src/ui/components/CombatOverlay.svelte` — Add screen edge pulse at combo 4, wire comboCount to ComboCounter |
| MODIFY | `src/services/juiceManager.ts` — Add perfect turn celebration trigger, combo-level haptic escalation |
| MODIFY | `src/game/scenes/CombatScene.ts` — Add gold particle burst and gold screen flash for perfect turn |
| CREATE | `src/services/__tests__/combo.test.ts` — Unit tests for combo multiplier math, reset logic, stacking |
