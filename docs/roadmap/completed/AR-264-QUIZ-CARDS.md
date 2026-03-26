# AR-264: Quiz-Integrated Card Modifications (5 Cards)

## Overview

**Goal:** Rework 5 cards to interact with the Knowledge Aura and Review Queue systems. Each card gets a distinct quiz-performance identity instead of being a generic stat-stick.

**Why:** These cards have names that promise quiz interaction (Recall, Precision Strike, Knowledge Ward, Smite, Feedback Loop) but their current mechanics are either broken under v3 rules, thematically misaligned, or mechanically boring.

**Dependencies:** AR-261 (Knowledge Aura + Review Queue must exist)
**Estimated complexity:** Medium (5 resolver rewrites + description updates)

**Reference:** `docs/RESEARCH/05 Overhaul relics cards.md` lines 351-396

---

## Design Principle: Standard Pipeline + Custom Bonuses

All 5 cards use the standard `QP × CHARGE_CORRECT_MULTIPLIER (1.5)` pipeline for CC base damage, then add mechanic-specific bonuses on top. This keeps mastery bonuses, relic multipliers, and chain multipliers applying uniformly.

**Runtime formula:** CC = `round(quickPlayValue × 1.5)` + mastery bonus + **mechanic bonus**

---

## Sub-steps

### 1. Recall — Review Queue Redemption Card

**Files:** `src/data/mechanics.ts` (line ~596), `src/services/cardEffectResolver.ts` (line ~1326)

**Current:** `quickPlayValue: 1, chargeWrongValue: 1`. Damage = 1× discard pile size (QP) / 2× discard pile size (CC). Scales with discard pile count.

**New definition in mechanics.ts:**
```typescript
{
  id: 'recall', name: 'Recall', type: 'attack',
  description: 'CC draws from Review Queue. Correct = bonus damage + heal.',
  baseValue: 10, apCost: 1, maxPerPool: 1, tags: ['strike', 'knowledge'],
  launchPhase: 2, unlockLevel: 11,
  quickPlayValue: 10,       // QP: 10 damage flat
  chargeCorrectValue: 30,   // Informational (dead field): CC target with review bonus
  chargeWrongValue: 6,      // CW: 6 damage
  chargeBonusEffect: 'review_queue_recall',
}
```

**New resolver logic:**
```typescript
case 'recall': {
  if (isChargeCorrect) {
    // CC base: round(10 × 1.5) = 15
    const wasReviewFact = advanced?.wasReviewQueueFact ?? false;
    if (wasReviewFact) {
      // Review Queue bonus: +15 damage (total 30) + heal 6
      mechanicBaseValue += 15;
      result.healPlayer = 6;
    } else {
      // Normal CC: +5 damage (total 20)
      mechanicBaseValue += 5;
    }
  }
  // QP: 10 damage (no scaling)
  // CW: 6 damage (no scaling)
  break;
}
```

**Integration:** `turnManager.ts` must pass `wasReviewQueueFact: boolean` to the resolver via `AdvancedResolveOptions` when a Charge correct clears a Review Queue fact.

**Description service:** Show "10 dmg" for QP, "20 dmg" for CC, "30 dmg + heal 6" for CC on review fact (conditional display).

**Acceptance criteria:**
- QP: 10 damage flat
- CC (normal fact): 20 damage
- CC (Review Queue fact): 30 damage + heal player 6 HP
- CW: 6 damage
- Mastery/relic/chain multipliers still apply on top

### 2. Precision Strike — Distractor Count Scaling

**Files:** `src/data/mechanics.ts` (line ~404), `src/services/cardEffectResolver.ts` (line ~931)

**Current:** `quickPlayValue: 4, chargeWrongValue: 3`. Timer passive (+50% longer timer). CC = round(4 × 1.5) = 6.

**New definition:**
```typescript
{
  id: 'precision_strike', name: 'Precision Strike', type: 'attack',
  description: 'CC damage scales with question difficulty.',
  baseValue: 8, apCost: 1, maxPerPool: 2, tags: ['strike', 'knowledge'],
  launchPhase: 1, unlockLevel: 4,
  quickPlayValue: 8,        // QP: 8 damage
  chargeCorrectValue: 24,   // Informational: 8 × (2+1) at mastery 0
  chargeWrongValue: 4,      // CW: 4 damage
  // REMOVE timer passive — no more chargeBonusEffect: 'extended_timer'
}
```

**New resolver logic:**
```typescript
case 'precision_strike': {
  if (isChargeCorrect) {
    // CC base: round(8 × 1.5) = 12
    // Bonus: scale with distractor count
    // distractor_count = number of wrong options shown (mastery 0 = 2, mastery 3+ = 4)
    const distractorCount = advanced?.distractorCount ?? 2;
    // Formula: 8 × (distractorCount + 1) - CC_base
    // At mastery 0 (2 distractors): 8 × 3 = 24, bonus = 24 - 12 = 12
    // At mastery 3+ (4 distractors): 8 × 5 = 40, bonus = 40 - 12 = 28
    mechanicBaseValue = 8 * (distractorCount + 1);  // Override CC base entirely
  }
  // QP: 8 damage
  // CW: 4 damage
  break;
}
```

**Integration:** `turnManager.ts` must pass `distractorCount: number` to the resolver via `AdvancedResolveOptions`. This is the number of wrong answer options shown in the quiz (already known at quiz time from mastery level).

**Remove:** Timer passive. If there's a `chargeBonusEffect: 'extended_timer'` or similar, remove it.

**Acceptance criteria:**
- QP: 8 damage
- CC at mastery 0 (2 distractors): 24 damage
- CC at mastery 3+ (4 distractors): 40 damage
- CW: 4 damage
- Timer passive removed
- Distractor count passed from quiz system to resolver

### 3. Knowledge Ward — Charge Accuracy Scaling Shield

**Files:** `src/data/mechanics.ts` (line ~488), `src/services/cardEffectResolver.ts` (line ~1059)

**Current:** `quickPlayValue: 2, chargeWrongValue: 2`. Block = 4 × unique domain count in hand. Broken in curated deck mode (always 1 domain = 4 block, worse than base Block).

**New definition:**
```typescript
{
  id: 'knowledge_ward', name: 'Knowledge Ward', type: 'shield',
  description: 'Block scales with correct Charges this encounter.',
  baseValue: 6, apCost: 1, maxPerPool: 1, tags: ['block', 'knowledge'],
  launchPhase: 2, unlockLevel: 6,
  quickPlayValue: 6,        // QP: 6 × correctCharges (min 1, cap 5)
  chargeCorrectValue: 10,   // Informational: CC at 1 correct charge
  chargeWrongValue: 4,      // CW: 4 block flat
}
```

**New resolver logic:**
```typescript
case 'knowledge_ward': {
  const correctCharges = Math.min(Math.max(advanced?.correctChargesThisEncounter ?? 0, 1), 5);
  if (isChargeCorrect) {
    // CC: 10 × correctCharges (cap 5)
    mechanicBaseValue = 10 * correctCharges;
  } else if (isQuickPlay) {
    // QP: 6 × correctCharges (cap 5)
    mechanicBaseValue = 6 * correctCharges;
  }
  // CW: 4 flat (no scaling)
  break;
}
```

**Values at different charge counts:**

| Correct Charges | QP Block | CC Block |
|----------------|----------|----------|
| 0 (minimum 1) | 6 | 10 |
| 1 | 6 | 10 |
| 3 | 18 | 30 |
| 5 (cap) | 30 | 50 |

**Integration:** `correctChargesThisEncounter` counter from AR-262 (or turnManager's existing counter).

**Remove:** Domain diversity scaling (`handDomains` parameter no longer used).

**Acceptance criteria:**
- Block scales with correct charges this encounter (min 1, cap 5)
- QP at 0 charges: 6 block. At 5 charges: 30 block.
- CC at 0 charges: 10 block. At 5 charges: 50 block.
- CW: 4 block flat
- Domain diversity scaling completely removed

### 4. Smite — Knowledge Aura Scaling Attack

**Files:** `src/data/mechanics.ts` (line ~580), `src/services/cardEffectResolver.ts` (line ~1277)

**Current:** `quickPlayValue: 5, chargeWrongValue: 4`. CC = 10 + (3 × average hand mastery). Weird metric.

**New definition:**
```typescript
{
  id: 'smite', name: 'Smite', type: 'attack',
  description: 'CC damage scales with Knowledge Aura.',
  baseValue: 10, apCost: 2, maxPerPool: 1, tags: ['strike', 'knowledge', 'heavy'],
  launchPhase: 2, unlockLevel: 9,
  quickPlayValue: 10,       // QP: 10 damage
  chargeCorrectValue: 40,   // Informational: CC at Aura 5
  chargeWrongValue: 6,      // CW: 6 damage + Aura -1
}
```

**New resolver logic:**
```typescript
case 'smite': {
  if (isChargeCorrect) {
    // CC base: round(10 × 1.5) = 15
    // Bonus: +6 per Aura level
    const auraLevel = getAuraLevel(); // from knowledgeAuraSystem
    mechanicBaseValue = 10 + (6 * auraLevel);
    // At Aura 5 (neutral): 10 + 30 = 40
    // At Aura 8 (Flow): 10 + 48 = 58
    // At Aura 3 (Brain Fog): 10 + 18 = 28
  } else if (isChargeWrong) {
    // CW: 6 damage + Aura drops by 1
    mechanicBaseValue = 6;
    adjustAura(-1); // Extra Aura penalty on CW
  }
  // QP: 10 damage
  break;
}
```

**Remove:** Hand mastery average scaling (`handMasteryValues` parameter no longer used).

**Acceptance criteria:**
- QP: 10 damage
- CC at Aura 5: 40 damage
- CC at Aura 8 (Flow State): 58 damage
- CC at Aura 3 (Brain Fog): 28 damage
- CW: 6 damage AND Aura -1 (extra penalty beyond the standard -2 from wrong charge)
- Hand mastery scaling completely removed

### 5. Feedback Loop — Flow State Bonus / Aura Crash on Wrong

**Files:** `src/data/mechanics.ts` (line ~588), `src/services/cardEffectResolver.ts` (line ~1297)

**Current:** `quickPlayValue: 3, chargeWrongValue: 0`. CC = 20. CW = 0 (complete fizzle). Already has the game's strongest "knowledge or nothing" identity.

**New definition:**
```typescript
{
  id: 'feedback_loop', name: 'Feedback Loop', type: 'attack',
  description: 'CC: high damage. Flow State bonus. CW: 0 damage + Aura crash.',
  baseValue: 5, apCost: 1, maxPerPool: 1, tags: ['strike', 'knowledge', 'risky'],
  launchPhase: 2, unlockLevel: 10,
  quickPlayValue: 5,        // QP: 5 damage (safety play)
  chargeCorrectValue: 40,   // Informational: CC base
  chargeWrongValue: 0,      // CW: 0 damage (complete fizzle)
}
```

**New resolver logic:**
```typescript
case 'feedback_loop': {
  if (isChargeCorrect) {
    // CC: 40 damage base
    mechanicBaseValue = 40;
    // Flow State bonus: +16 if Aura >= 7
    if (getAuraState() === 'flow_state') {
      mechanicBaseValue += 16;  // Total: 56
    }
  } else if (isChargeWrong) {
    // CW: 0 damage AND Aura crashes by 3
    mechanicBaseValue = 0;
    adjustAura(-3); // Extra -3 (on top of the standard -2 from wrong charge = -5 total)
  }
  // QP: 5 damage
  break;
}
```

**Damage summary:**

| Mode | Damage | Aura Effect |
|------|--------|-------------|
| QP | 5 | None |
| CC (neutral) | 40 | +1 (standard) |
| CC (Flow State) | 56 | +1 (standard) |
| CW | 0 | -3 extra (total -5 with standard -2) |

**Acceptance criteria:**
- QP: 5 damage
- CC: 40 damage
- CC in Flow State: 56 damage
- CW: 0 damage AND Aura drops by 3 extra (total -5)
- Existing L3 mastery bonus (QP applies 1 Weakness) preserved if still relevant

### 6. Update Card Description Service

**File:** `src/services/cardDescriptionService.ts`

Update `getShortCardDescription`, `getDetailedCardDescription`, and `getCardDescriptionParts` for all 5 cards:

- **Recall:** "10 dmg" (QP) / "20 dmg, 30 on review" (CC) / "6 dmg" (CW)
- **Precision Strike:** "8 dmg" (QP) / "8 × options dmg" (CC) / "4 dmg" (CW)
- **Knowledge Ward:** "6 × charges block" (QP) / "10 × charges block" (CC) / "4 block" (CW)
- **Smite:** "10 dmg" (QP) / "10 + 6×Aura dmg" (CC) / "6 dmg" (CW)
- **Feedback Loop:** "5 dmg" (QP) / "40 dmg (+16 Flow)" (CC) / "0 dmg" (CW)

Use dynamic values where possible (e.g., show actual current Aura level in Smite description during combat).

**Acceptance criteria:** Card descriptions accurately reflect new mechanics. Dynamic values update during combat.

### 7. Pass New Context to Resolver

**File:** `src/services/turnManager.ts`

Add new fields to `AdvancedResolveOptions` (in cardEffectResolver.ts):

```typescript
// New fields for AR-264:
wasReviewQueueFact?: boolean;    // For Recall
distractorCount?: number;        // For Precision Strike
correctChargesThisEncounter?: number; // For Knowledge Ward
// Aura level accessed directly via getAuraLevel() import — no need to pass
```

Populate these in turnManager when calling the resolver:
- `wasReviewQueueFact`: set to true if `clearReviewQueueFact(factId)` returned true
- `distractorCount`: from the quiz question that was just answered
- `correctChargesThisEncounter`: from the encounter counter (AR-262 or existing)

**Acceptance criteria:** All new context fields populated correctly and available to resolver.

### 8. Unit Tests

Add test cases for each card's new resolver logic:
- Recall: QP/CC-normal/CC-review/CW with correct values
- Precision Strike: CC at different distractor counts (2, 3, 4)
- Knowledge Ward: QP/CC at different correct charge counts (0, 1, 3, 5, 6→capped to 5)
- Smite: CC at different Aura levels (0, 3, 5, 8, 10)
- Feedback Loop: CC normal, CC flow, CW aura crash

**Acceptance criteria:** All tests pass.

### 9. Update GDD

**File:** `docs/GAME_DESIGN.md`

Update card descriptions in the relevant section for all 5 cards. Document:
- New mechanics and scaling formulas
- Interaction with Knowledge Aura / Review Queue systems
- Removal of old mechanics (timer passive, domain diversity, hand mastery)

**Acceptance criteria:** All 5 cards documented with accurate mechanics.

---

## Files Affected

| File | Change |
|------|--------|
| `src/data/mechanics.ts` | Update 5 card definitions (quickPlayValue, chargeWrongValue, description, tags) |
| `src/services/cardEffectResolver.ts` | Rewrite 5 switch cases with new bonus logic |
| `src/services/cardDescriptionService.ts` | Update descriptions for 5 cards |
| `src/services/turnManager.ts` | Pass new context to resolver (wasReviewQueueFact, distractorCount, correctCharges) |
| `docs/GAME_DESIGN.md` | Update card documentation |
| Test files | New unit tests for all 5 cards |

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] `npx vitest run` — all tests pass
- [ ] Playwright: Recall deals bonus damage on Review Queue fact (trigger wrong charge first, then play Recall)
- [ ] Playwright: Precision Strike shows different damage at different mastery levels
- [ ] Playwright: Knowledge Ward block increases with more correct charges
- [ ] Playwright: Smite damage changes when Aura level changes
- [ ] Playwright: Feedback Loop deals 0 on wrong charge, high damage on correct
- [ ] Card descriptions update dynamically during combat
