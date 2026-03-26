# AR-265: Relic Overhaul (6 Relics)

## Overview

**Goal:** Fix 3 broken relics (reference removed v3 systems) and upgrade 3 boring relics with quiz-integrated mechanics tied to Knowledge Aura and Review Queue.

**Why:** Scar Tissue, Scholar's Crown, and Akashic Record reference systems removed in v3 (cursed cards, FSRS tiers, auto-charge). They literally do nothing. Domain Mastery Sigil is an unconditional +30% in curated mode (always active = no decision). Memory Nexus and Lucky Coin are generic with no quiz identity.

**Dependencies:** AR-261 (Knowledge Aura + Review Queue)
**Estimated complexity:** High (6 complete relic redesigns + resolver changes + save migration)

**Reference:** `docs/RESEARCH/05 Overhaul relics cards.md` lines 399-450

---

## Sub-steps

### 1. Scar Tissue — Wrong Charges Build Future Power

**Files:** `src/data/relics/starters.ts` (line ~629), `src/services/relicEffectResolver.ts`

**Current:** `cursed_qp_reduction` (value 0.85). Cursed cards use 0.85× QP instead of 0.70×. Cursed card system removed in v3 — **does nothing**.

**New mechanic:** Every wrong Charge this run permanently adds +2 flat damage to all future correct Charges.

**Definition update:**
```typescript
{
  id: 'scar_tissue',
  name: 'Scar Tissue',
  description: 'Each wrong Charge adds +2 damage to all future correct Charges this run.',
  rarity: 'uncommon',
  category: 'offensive',  // Changed from 'defensive'
  trigger: 'on_charge_wrong',  // Changed from 'permanent'
  effects: [{
    effectId: 'scar_tissue_stack',
    description: '+2 flat damage per wrong Charge (cumulative, run-persistent)',
    value: 2,
  }],
}
```

**Resolver logic:**
- `on_charge_wrong`: Increment a run-persistent counter (`scarTissueStacks`)
- `on_charge_correct`: Add `scarTissueStacks × 2` flat damage to the card's resolved damage (at the relic flat bonus step in the damage pipeline)

**State:** `scarTissueStacks: number` stored on the run state. Persists across encounters. Resets at run start.

**Visual:** Relic icon shows counter of accumulated stacks.

**Acceptance criteria:**
- Each wrong Charge adds +2 to all future correct Charge damage
- Stacks persist across encounters within the run
- Counter displayed on relic icon
- At 5 wrong charges: +10 flat damage on every correct Charge

### 2. Scholar's Crown — Review Queue Damage Bonus

**Files:** `src/data/relics/unlockable.ts` (line ~209), `src/services/relicEffectResolver.ts`

**Current:** FSRS tier-based bonuses (+10%/+40%/+75%). Tiers decoupled from combat in v3 — **broken**.

**New mechanic:** +40% damage on Review Queue facts, +10% on all other Charges.

**Definition update:**
```typescript
{
  id: 'scholars_crown',
  name: "Scholar's Crown",
  description: '+40% damage on Review Queue facts. +10% on all other Charges.',
  rarity: 'rare',
  category: 'knowledge',
  trigger: 'on_charge_correct',
  unlockCost: 55, unlockLevel: 16,
  effects: [{
    effectId: 'review_queue_damage_bonus',
    description: '+40% damage on review facts, +10% on other charges',
    value: 40,
    secondaryValue: 10,
  }],
}
```

**Resolver logic:**
- `on_charge_correct`: If the fact was in the Review Queue (check `wasReviewQueueFact` flag from turnManager), apply 1.4× multiplier. Otherwise, apply 1.1× multiplier.
- Applied at the relic multiplier step in the damage pipeline.

**Acceptance criteria:**
- Correct Charge on Review Queue fact: +40% damage
- Correct Charge on normal fact: +10% damage
- Multiplier applies after base damage + mastery + flat bonuses

### 3. Domain Mastery Sigil — Aura-Driven AP Swing

**Files:** `src/data/relics/unlockable.ts` (line ~230), `src/services/relicEffectResolver.ts`

**Current:** `domain_concentration_bonus` +30% for 4+ same-domain cards. Always active in curated mode — **boring** (unconditional buff with zero interaction).

**New mechanic:** +1 AP per turn in Flow State (Aura ≥ 7). -1 AP per turn in Brain Fog (Aura 0-3).

**Definition update:**
```typescript
{
  id: 'domain_mastery_sigil',
  name: 'Domain Mastery Sigil',
  description: 'Flow State: +1 AP per turn. Brain Fog: -1 AP per turn.',
  rarity: 'rare',
  category: 'knowledge',
  trigger: 'on_turn_start',  // Changed from 'permanent'
  unlockCost: 55, unlockLevel: 18,
  effects: [{
    effectId: 'aura_ap_modifier',
    description: '+1 AP in Flow, -1 AP in Brain Fog',
    value: 1,
  }],
}
```

**Resolver logic:**
- `on_turn_start`: Check `getAuraState()`:
  - `flow_state`: Grant +1 AP (4 total, still subject to hard cap of 5)
  - `brain_fog`: Reduce AP by 1 (2 total, minimum 1)
  - `neutral`: No change (3 AP standard)

**Acceptance criteria:**
- Flow State: player has 4 AP
- Brain Fog: player has 2 AP
- Neutral: player has 3 AP (standard)
- AP changes are clearly communicated to the player
- Subject to existing AP hard cap (5)

### 4. Akashic Record — Spaced Recall Bonus

**Files:** `src/data/relics/unlockable.ts` (line ~665), `src/services/relicEffectResolver.ts`

**Current:** Tier-based hint + T3 auto-charge multiplier. Both systems removed — **broken**.

**New mechanic:** +50% damage + draw 1 card when a Charge selects a fact not seen in 3+ encounters.

**Definition update:**
```typescript
{
  id: 'akashic_record',
  name: 'Akashic Record',
  description: '+50% damage and draw 1 when recalling a fact not seen in 3+ encounters.',
  rarity: 'legendary',
  category: 'knowledge',
  trigger: 'on_charge_correct',
  unlockCost: 75, unlockLevel: 22,
  effects: [{
    effectId: 'spaced_recall_bonus',
    description: '+50% damage + draw 1 on well-spaced facts',
    value: 50,
  }],
}
```

**New state:** Track `lastSeenEncounter: number` per fact in `InRunFactState`. Increment encounter counter at encounter start. When a fact is used for a Charge, update its `lastSeenEncounter` to current encounter number.

**Resolver logic:**
- `on_charge_correct`: Check if `currentEncounter - fact.lastSeenEncounter >= 3` (or fact has never been seen). If so: +50% damage multiplier + draw 1 extra card.

**Integration:** `InRunFactState` (check where this is defined — likely in `src/services/` or `src/data/`). Add `lastSeenEncounter?: number` field. Update it in turnManager when a fact is used.

**Acceptance criteria:**
- Fact not seen in 3+ encounters: +50% damage + draw 1
- Fact seen recently (< 3 encounters ago): no bonus
- First time seeing a fact: triggers bonus (never seen = qualifies)
- `lastSeenEncounter` tracked per fact across the run

### 5. Memory Nexus — Guided Review Flag

**Files:** `src/data/relics/starters.ts` (line ~309), `src/services/relicEffectResolver.ts`

**Current:** `encounter_charge_draw_bonus` — draw 2 after 3 correct charges. Fire-and-forget counter — **boring**.

**New mechanic:** At encounter start, flag 1 card for review (highest `wrongCount` in FSRS state). Correct Charge on flagged card = +1 mastery + draw 1.

**Definition update:**
```typescript
{
  id: 'memory_nexus',
  name: 'Memory Nexus',
  description: 'Flags 1 card each encounter for review. Correct Charge = +1 mastery + draw 1.',
  rarity: 'uncommon',
  category: 'knowledge',
  trigger: 'on_encounter_start',
  effects: [{
    effectId: 'guided_review_flag',
    description: 'Flag card with highest wrongCount for review bonus',
    value: 1,
  }],
}
```

**Implementation:**
1. At encounter start: find the card in hand with the highest `wrongCount` in its in-run FSRS state. Flag it (`isFlaggedForReview: true`).
2. Visual: Pin icon (📌) on the flagged card in `CardHand.svelte`.
3. If the flagged card is Charged correctly: +1 mastery to that card + draw 1 extra card. Clear flag.
4. If Quick Played, or a different card is Charged, or wrong answer: flag disappears with no penalty.

**New field on card instance:** `isFlaggedForReview?: boolean`

**Acceptance criteria:**
- One card flagged per encounter (highest wrongCount)
- Pin visual on flagged card
- Correct Charge on flagged card: +1 mastery + draw 1
- Any other action: flag clears, no penalty
- If no cards have wrongCount > 0: no flag (relic is dormant)

### 6. Lucky Coin — Wrong-Answer Safety Net

**Files:** `src/data/relics/starters.ts` (line ~149), `src/services/relicEffectResolver.ts`

**Current:** `random_encounter_buff` — random buff at encounter start. No player agency — **boring**.

**New mechanic:** After 3 wrong Charges in a single encounter, next Charge automatically succeeds.

**Definition update:**
```typescript
{
  id: 'lucky_coin',
  name: 'Lucky Coin',
  description: 'After 3 wrong Charges in one encounter, your next Charge auto-succeeds.',
  rarity: 'common',
  category: 'knowledge',
  trigger: 'on_charge_wrong',
  effects: [{
    effectId: 'auto_succeed_safety_net',
    description: 'Auto-correct after 3 wrong charges per encounter',
    value: 3,
  }],
}
```

**Implementation:**
1. Track `wrongChargesThisEncounter: number` (reset at encounter start)
2. After each wrong Charge: increment counter
3. When counter reaches 3: set `autoSucceedNextCharge: true` flag
4. On next Charge: auto-select correct answer (counts as correct for mastery, chain, Aura, everything)
5. Reset counter and flag after auto-succeed triggers
6. Counter resets each encounter

**Visual:** Coin flip animation when the auto-succeed triggers. Show "Lucky!" text.

**Integration:** The auto-succeed needs to intercept the quiz system — when the quiz would present, auto-select the correct answer. This hooks into turnManager's charge flow, before the quiz is presented to the player.

**Acceptance criteria:**
- 3 wrong Charges → next Charge auto-succeeds
- Auto-succeed counts as correct for all purposes (mastery, chain, Aura)
- Resets each encounter
- Coin flip visual + "Lucky!" feedback
- Players who know their deck never trigger it (no advantage for experts)

### 7. Save Migration

**File:** `src/services/saveMigration.ts`

Add migration for runs-in-progress that have old relic versions:
- Scar Tissue: initialize `scarTissueStacks: 0`
- Scholar's Crown: clear old tier-based state
- Domain Mastery Sigil: clear old domain concentration state
- Akashic Record: clear old tier-based state
- Memory Nexus: clear old charge counter state
- Lucky Coin: initialize `wrongChargesThisEncounter: 0`

**Acceptance criteria:** Existing saves load without errors. Old relic state gracefully migrated.

### 8. Update GDD

**File:** `docs/GAME_DESIGN.md` §16 Relic System

Update all 6 relic descriptions with new mechanics. Remove references to:
- Cursed card system (Scar Tissue)
- FSRS tiers / auto-charge (Scholar's Crown, Akashic Record)
- Domain concentration (Domain Mastery Sigil)

**Acceptance criteria:** All 6 relics documented with accurate new mechanics.

---

## Files Affected

| File | Change |
|------|--------|
| `src/data/relics/starters.ts` | 3 relic definitions (Scar Tissue, Memory Nexus, Lucky Coin) |
| `src/data/relics/unlockable.ts` | 3 relic definitions (Scholar's Crown, Domain Mastery Sigil, Akashic Record) |
| `src/services/relicEffectResolver.ts` | Rewrite resolution for all 6 relics |
| `src/services/turnManager.ts` | New trigger wiring (auto-succeed, review flag, scar stacks) |
| `src/ui/components/CardHand.svelte` | Pin icon for Memory Nexus flagged card |
| `src/data/relics/types.ts` | New effect IDs if needed |
| `src/services/saveMigration.ts` | Migration for mid-run saves |
| `docs/GAME_DESIGN.md` | §16 relic descriptions |
| Test files | Unit tests for all 6 relics |

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] `npx vitest run` — all tests pass
- [ ] Playwright: Scar Tissue counter increments on wrong charge, damage bonus visible on correct charge
- [ ] Playwright: Scholar's Crown bonus damage on Review Queue fact (trigger review queue first)
- [ ] Playwright: Domain Mastery Sigil AP changes with Aura state (verify AP count display)
- [ ] Playwright: Akashic Record bonus on spaced facts (play multiple encounters)
- [ ] Playwright: Memory Nexus pin icon on flagged card, mastery bonus on correct charge
- [ ] Playwright: Lucky Coin auto-succeed after 3 wrong charges (coin flip animation)
- [ ] Save migration: load old save with these relics — no errors
- [ ] Headless sim completes with all 6 relic changes
