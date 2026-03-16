# AR-57 — Implement Placeholder Card Mechanics

## Overview
**Goal:** Implement the 7 Phase 1 card mechanics that are currently placeholder (defined in mechanics.ts but have no effect resolution code). These mechanics are assigned to cards in the run pool but do nothing when played.

**Placeholder mechanics:**
1. thorns (shield) — "Gain block and retaliate"
2. cleanse (utility) — "Remove all debuffs. Draw 1 card"
3. empower (buff) — "Buff next card +30%"
4. recycle (utility) — "Cycle card" (return hand card to draw pile, draw new)
5. emergency (shield) — "Gain block. Double if HP below 30%"
6. mirror (wild) — "Copy previous card effect"
7. adapt (wild) — "Adaptive wild effect"

**Dependencies:** AR-56 (status effects working — needed for cleanse).
**Estimated complexity:** Medium (each mechanic is 5-15 lines in cardEffectResolver.ts).

## Sub-steps

### 1. Implement thorns
- In `cardEffectResolver.ts`, add `case 'thorns'`:
  - Apply block = finalValue (same as regular block)
  - Set `turnState.thornsActive = true` and `turnState.thornsValue = secondaryValue` (2)
  - In enemy attack resolution (turnManager.ts), if `thornsActive`, deal thornsValue damage back to enemy
- Add `thornsActive` and `thornsValue` to TurnState

**Acceptance:** Playing a Thorns card gives block AND deals 2 damage back when enemy attacks.

### 2. Implement cleanse
- In `cardEffectResolver.ts`, add `case 'cleanse'`:
  - Clear all debuffs from `playerState.statusEffects` (keep buffs)
  - Draw 1 card from draw pile

**Acceptance:** Playing Cleanse removes all player debuffs and draws 1 card.

### 3. Implement empower
- In `cardEffectResolver.ts`, add `case 'empower'`:
  - Set `turnState.buffNextCardPct = finalValue` (30 = +30%)
  - Next card played this turn gets `baseEffectValue * 1.3`
- Buff consumed after one card play

**Acceptance:** Empower → next card deals 30% more damage/block.

### 4. Implement recycle
- In `cardEffectResolver.ts`, add `case 'recycle'`:
  - Pick a random non-recycle card from hand
  - Move it to the bottom of the draw pile
  - Draw 1 new card

**Acceptance:** Playing Recycle swaps a hand card for a new draw.

### 5. Implement emergency
- In `cardEffectResolver.ts`, add `case 'emergency'`:
  - Apply block = finalValue
  - If player HP < 30% of max, double the block

**Acceptance:** Emergency gives normal block above 30% HP, double block below 30%.

### 6. Implement mirror
- In `cardEffectResolver.ts`, add `case 'mirror'`:
  - If there was a previous card effect this turn (`turnState.lastCardEffect`), replay it
  - If no previous effect, apply 0 (fizzle)
- Store `lastCardEffect` in TurnState after each card resolves

**Acceptance:** Mirror copies the last card's effect. First card mirror = fizzle.

### 7. Implement adapt
- In `cardEffectResolver.ts`, add `case 'adapt'`:
  - Check enemy's current intent type
  - If enemy will attack: apply block = finalValue (defensive adapt)
  - If enemy will defend/buff: apply damage = finalValue (offensive adapt)
  - If enemy will debuff: cleanse 1 debuff (utility adapt)

**Acceptance:** Adapt reacts to enemy intent — blocks attacks, damages defenders, cleanses debuffs.

### 8. Update GAME_DESIGN.md
- Document all 7 newly implemented mechanics with their exact behavior

**Files:** `docs/GAME_DESIGN.md`
**Acceptance:** All 7 mechanics documented.

## Files Affected
| File | Changes |
|------|---------|
| `src/services/cardEffectResolver.ts` | 7 new case handlers |
| `src/services/turnManager.ts` | thorns retaliation, buffNextCard, lastCardEffect |
| `src/data/card-types.ts` | Add thornsActive, thornsValue, buffNextCardPct, lastCardEffect to TurnState |
| `docs/GAME_DESIGN.md` | Document all mechanics |

## Verification Gate
- [ ] All 7 mechanics produce correct effects when cards are played
- [ ] Thorns retaliates on enemy attack
- [ ] Cleanse removes debuffs
- [ ] Empower buffs next card
- [ ] Recycle swaps a hand card
- [ ] Emergency doubles block below 30% HP
- [ ] Mirror copies last effect
- [ ] Adapt reacts to enemy intent
- [ ] `npm run typecheck` — 0 errors
- [ ] `npx vitest run` — all tests pass
