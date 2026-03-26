# AR-263: Quiz-Reactive Enemy Modifications (5 Enemies)

## Overview

**Goal:** Add quiz-reactive mechanics to 5 enemies whose names reference knowledge/quiz concepts but currently have zero quiz interaction. These enemies should *feel* different from generic stat-stick enemies — quiz performance directly shapes the fight.

**Why:** 83 of 89 enemies are intentionally generic. These 5 are specifically chosen because their names promise quiz interaction that doesn't exist yet. Pop Quiz should test you. Trick Question should trip you up. Brain Fog should erode your knowledge. The Curriculum should demand mastery. The Textbook should require study.

**Dependencies:** AR-260 (HP scaling). Independent of AR-261.
**Estimated complexity:** Medium (2 use existing hooks, 1 uses existing field, 2 need new mechanics)

**Reference:** `docs/RESEARCH/05 Overhaul relics cards.md` lines 305-348

---

## Sub-steps

### 1. Pop Quiz — Correct Charge Stuns, No Charge Enrages

**File:** `src/data/enemies.ts` (enemy `pop_quiz`, Act 1 Common, baseHP 7)

**Current state:** Poison 2/3t, Weakness 1/2t, Attack 2. Generic debuff enemy.

**Add reactive hooks:**

```typescript
// At end of player turn:
onPlayerNoCharge: (ctx) => {
  // No correct Charge this turn → gains +1 permanent Strength
  ctx.enemy.enrageBonusDamage = (ctx.enemy.enrageBonusDamage ?? 0) + 1;
},

onPlayerChargeCorrect: (ctx) => {
  // Correct Charge → stun enemy (skip next action)
  // Implementation: set a "stunned" flag that makes enemy skip its next intent
  ctx.enemy._stunNextTurn = true;
},
```

**New field needed on EnemyInstance:** `_stunNextTurn?: boolean` — checked at enemy turn start, if true skip action and reset flag.

**Integration in enemyManager.ts:** In the enemy action execution path, check `_stunNextTurn` before executing intent. If true, skip action, set to false, show "Stunned!" text.

**Keep:** All existing intents unchanged (Attack, Poison, Weakness).

**Acceptance criteria:**
- Correct Charge → Pop Quiz skips its next action
- No Charge in a turn → Pop Quiz gains +1 Strength permanently
- Existing intent pool unchanged
- Stun visual feedback (text or icon)

### 2. Trick Question — Wrong Charge Locks Fact for Retry

**File:** `src/data/enemies.ts` (enemy `trick_question`, Act 2 Common, baseHP 5)

**Current state:** Vulnerable 1/2t, Attack 2. Generic debuff enemy. Has `chargeResistant: true`.

**Add reactive hook:**

```typescript
onPlayerChargeWrong: (ctx) => {
  // Lock the failed factId. Next turn, one random card in hand gets
  // "Locked" overlay — can ONLY be Charged, quiz forced to use same fact.
  // Stored on enemy instance for the locked card system to read.
  ctx.enemy._lockedFactId = ctx._failedFactId; // factId from the wrong answer
  ctx.enemy._lockTurnsRemaining = 2; // auto-expires after 2 turns
},
```

**New mechanics needed:**

1. **Locked Card state:** Add `isLocked?: boolean` and `lockedFactId?: string` fields to the card instance in hand. When a card is locked:
   - It cannot be Quick Played (QP tap is disabled)
   - It can only be Charged, and the quiz system forces the specific `lockedFactId`
   - Visual: "Locked" overlay (padlock icon or red border) on the card in `CardHand.svelte`

2. **Lock application:** At the start of the player's turn (if `_lockedFactId` is set on enemy), pick one random card in hand and apply lock. Decrement `_lockTurnsRemaining`. At 0, clear lock.

3. **Lock resolution:**
   - Correct retry: card plays at **2× power** (double the CC damage). Lock clears.
   - Wrong retry: enemy heals **8 HP** (doubled from research doc's 4). Lock persists (already has turn limit).

**Files affected:**
- `src/data/enemies.ts` (Trick Question definition)
- `src/services/turnManager.ts` (lock application at turn start, lock resolution on charge)
- `src/ui/components/CardHand.svelte` (locked card visual overlay)
- Card instance type (add `isLocked`, `lockedFactId` fields)

**Acceptance criteria:**
- Wrong Charge vs Trick Question → one card locked next turn
- Locked card can only be Charged with the same fact
- Correct retry → 2× power, lock cleared
- Wrong retry → enemy heals 8 HP
- Lock auto-expires after 2 turns max
- Locked card visual clearly distinguishable

### 3. Brain Fog — Mastery Erosion on No-Charge Turns

**File:** `src/data/enemies.ts` (enemy `brain_fog`, Act 2 Common, baseHP 7)

**Current state:** Poison 2/3t, Weakness 1/2t. Generic debuff enemy.

**Add reactive hook:**

```typescript
onEnemyTurnStart: (ctx) => {
  // If player made 0 correct Charges last turn,
  // one random card in hand with mastery >= 2 loses 1 mastery level.
  if (!ctx.playerChargedCorrectLastTurn) {
    // Find eligible cards (mastery >= 2)
    const eligible = ctx.playerHand.filter(c => (c.masteryLevel ?? 0) >= 2);
    if (eligible.length > 0) {
      const target = eligible[Math.floor(Math.random() * eligible.length)];
      target.masteryLevel = (target.masteryLevel ?? 0) - 1;
      // Trigger "Fog Erosion" visual effect on the card
    }
  }
},
```

**New context needed:** `onEnemyTurnStart` context needs `playerChargedCorrectLastTurn: boolean` and `playerHand` access. Check if `EnemyTurnStartContext` already has these — if not, extend it.

**Mastery downgrade:** Check if `cardUpgradeService.ts` has a `downgradeMastery` function. If not, the inline `masteryLevel - 1` is sufficient since mastery is just a number field.

**Visual:** Brief purple mist animation on the card that lost mastery. Can be a CSS class that triggers then fades.

**Acceptance criteria:**
- 0 correct Charges last turn + card with mastery ≥ 2 in hand → 1 mastery lost on random eligible card
- Cards below mastery 2 are immune
- At least 1 correct Charge → no erosion
- Visual feedback on the eroded card

### 4. The Curriculum — Phase 2 Blocks Quick Play Attacks

**File:** `src/data/enemies.ts` (enemy `the_curriculum`, Act 2 Boss, baseHP 14)

**Current state:** "Living crystal. Status effects don't stick. It just keeps coming." Attack, Defend, Multi-attack, Heal. Generic boss with status immunity.

**Modification:** Add phase transition at 50% HP:

```typescript
phaseTransitionAt: 0.5,  // 50% HP triggers phase 2

// Phase 2 modifications:
phase2: {
  quickPlayDamageMultiplier: 0.0,  // QP attacks deal ZERO damage
  // Shield, utility, buff, debuff cards still work via Quick Play
  strengthBonus: 2,  // +2 Strength on phase transition
}
```

The `quickPlayDamageMultiplier` field **already exists** on `EnemyTemplate` — The Singularity uses 0.3. Setting it to 0.0 at phase transition is a natural extension.

**Implementation:** In the phase transition handler (enemyManager.ts or turnManager.ts), when The Curriculum crosses 50% HP:
1. Set `quickPlayDamageMultiplier = 0.0` on the enemy instance
2. Add +2 Strength via `enrageBonusDamage += 2`
3. Show phase transition text: "The Curriculum enters Final Exam mode"

**Keep:** All existing Phase 1 intents unchanged. Status immunity stays.

**Acceptance criteria:**
- Phase 1 (100-50% HP): Normal behavior, QP works normally
- Phase 2 (<50% HP): QP attack cards deal 0 damage. QP shield/utility cards work normally.
- +2 Strength on transition
- Phase transition visual/text feedback

### 5. The Textbook — Hardcover Armor Mechanic

**File:** `src/data/enemies.ts` (enemy `the_textbook`, Act 2 Mini-Boss, baseHP 8)

**Current state:** Defend 2, Charge 5, Attack 2. Boring block-and-hit mini-boss.

**New mechanic — Hardcover armor:**

```typescript
// On enemy template:
hardcoverArmor: 16,  // Starting armor (doubled from research doc's 8)

// Reactive:
onPlayerChargeCorrect: (ctx) => {
  ctx.enemy._hardcover = Math.max(0, (ctx.enemy._hardcover ?? 0) - 4);  // -4 per correct
  if (ctx.enemy._hardcover === 0 && !ctx.enemy._hardcoverBroken) {
    // Hardcover broken! Apply Vulnerable 2 turns
    applyStatusEffect(ctx.enemy.statusEffects, { type: 'vulnerable', value: 1, turnsRemaining: 2 });
    ctx.enemy._hardcoverBroken = true;
  }
},

onPlayerChargeWrong: (ctx) => {
  if (!ctx.enemy._hardcoverBroken) {
    ctx.enemy._hardcover = Math.min(16, (ctx.enemy._hardcover ?? 0) + 2);  // +2 per wrong
  }
},
```

**New field on EnemyInstance:** `_hardcover?: number` — initialized from template's `hardcoverArmor` value at encounter start.

**Damage reduction in enemyManager.ts:** In `applyDamageToEnemy` (or equivalent), when `_hardcover > 0`:
- If play mode is Quick Play: reduce damage by `_hardcover` (minimum 1 damage per hit)
- If play mode is Charge (correct or wrong): full damage, no reduction from hardcover
- Hardcover does NOT reduce Charge damage — it only reduces QP damage

**Visual:** Book icon with number on enemy health bar showing current hardcover. Breaking animation when it hits 0.

**Acceptance criteria:**
- Starts with 16 hardcover armor
- Correct Charge → -4 hardcover
- Wrong Charge → +2 hardcover (if not already broken)
- At 0 hardcover → Vulnerable 2 turns, hardcover stays broken
- QP damage reduced by hardcover amount (minimum 1)
- Charge damage NOT reduced by hardcover
- Visual indicator shows current hardcover value

---

## New Mechanics Summary

| Mechanic | Scope | Files |
|----------|-------|-------|
| Enemy stun (`_stunNextTurn`) | Pop Quiz only | enemies.ts, enemyManager.ts |
| Locked card (fact retry) | Trick Question only | enemies.ts, turnManager.ts, CardHand.svelte, card types |
| Mastery erosion | Brain Fog only | enemies.ts, turnManager.ts context |
| Phase 2 QP block | The Curriculum only | enemies.ts, phase transition handler |
| Hardcover armor | The Textbook only | enemies.ts, enemyManager.ts damage pipeline |

## Files Affected

| File | Change |
|------|--------|
| `src/data/enemies.ts` | 5 enemy definitions modified |
| `src/services/enemyManager.ts` | Stun check, hardcover damage reduction, hardcover initialization |
| `src/services/turnManager.ts` | Locked card application/resolution, mastery erosion context |
| `src/ui/components/CardHand.svelte` | Locked card visual overlay |
| `docs/GAME_DESIGN.md` §8 | Update 5 enemy descriptions with new mechanics |

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] `npx vitest run` — all tests pass
- [ ] Playwright: Pop Quiz stuns after correct charge (verify via `__terraDebug` or console)
- [ ] Playwright: Trick Question locks a card after wrong charge (verify locked visual in hand)
- [ ] Playwright: Brain Fog erodes mastery (verify via card mastery display)
- [ ] Playwright: The Curriculum phase 2 — QP attacks show 0 damage
- [ ] Playwright: The Textbook — hardcover counter decrements on correct charge
- [ ] Headless sim still completes (may need to update sim to handle new mechanics)
