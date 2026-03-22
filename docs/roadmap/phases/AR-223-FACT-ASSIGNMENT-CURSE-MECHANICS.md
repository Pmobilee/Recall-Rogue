# AR-223: Fact Assignment & Curse Mechanics

> **Source:** [Playtest Feedback 2026-03-22](../PLAYTEST-FEEDBACK-2026-03-22.md) — Issues #29, #30, #31, #33
> **Priority:** P1 — Core gameplay logic change
> **Complexity:** Medium-Large (fundamental change to fact-card pairing + curse tracking + chain momentum fix)
> **Dependencies:** None (logic-only, independent of UI ARs)

---

## Overview

Four interconnected changes to how facts pair with cards and how curses/momentum work:

1. Facts no longer randomly selected from pool each draw — instead they shuffle between existing deck cards at encounter boundaries.
2. Cards with never-before-seen facts are protected from downgrade/curse.
3. Curses track by FACT across encounters, not by card.
4. Chain momentum (free charge on correct) applies only to the SAME chain color, not all charges.

---

## User's Exact Words

- **#29:** "From now on, we don't randomly select facts from our pool each time, instead, at the end of each encounter, randomly assign all facts to another card in our deck, no more randomly getting new ones from the pool."
- **#30:** "When a card has any upgrade and its received a fact we haven't seen before yet, we don't downgrade or go cursed, but only if that card's fact has never been tried before."
- **#31:** "Curses must travel to following encounters by FACT, not by card. So if a card gets a new fact that was cursed in the previous enemy encounter, it transfers to this other card."
- **#33:** "If you get a card right charged, your next charge OF THAT COLOR is free, NOT EVERY CHARGE!!!"

---

## Sub-Steps

### 1. Fact Shuffling Per Encounter (Replace Per-Draw Pool Assignment)
- **Current behavior:** Each `drawHand()` call selects facts from the FSRS pool and assigns them to drawn cards. Facts rotate every draw.
- **New behavior:**
  - At **run start**: Assign facts to card slots from the FSRS pool (same as now).
  - At **encounter end**: Randomly shuffle all facts between all card slots in the deck. Each card gets a different fact than it had before (if possible — with dedup constraints).
  - During an encounter: Facts stay with their assigned cards for ALL draws within that encounter.
  - **No new facts from the pool mid-run** — the set of facts is fixed at run start, only shuffled between cards.
- **Implementation:** Remove per-draw fact assignment from `drawHand()`. Add `shuffleFactsAtEncounterEnd()` that permutes fact assignments across all deck card slots.
- **Edge case:** If deck has more cards than facts (unlikely but possible), some facts may repeat. Apply cooldown dedup.
- **Acceptance:** Facts stay stable within an encounter. Different facts after each encounter. No new pool draws mid-run.

### 2. New-Fact Protection (No Downgrade/Curse on Unseen Facts)
- **What:** If a card currently has a fact that the player has NEVER attempted (never answered a quiz for this fact in this run), the card is protected:
  - Cannot be downgraded in mastery
  - Cannot become cursed
  - A wrong answer on a first-ever attempt still counts as wrong for FSRS, but the CARD is protected
- **Tracking:** Add `attemptedFactIds: Set<string>` to run state. When a fact is quizzed, add its ID.
- **Check:** Before applying downgrade or curse, check if `attemptedFactIds.has(card.factId)`. If not, skip the penalty.
- **Acceptance:** First-time facts don't penalize the card. Protection only applies once per fact per run.

### 3. Curse Tracking by Fact (Not Card)
- **Current:** Curse state is likely stored on the card object. When facts shuffle, the curse stays with the old card.
- **New:** Curse state must be stored by FACT ID, not card ID. When facts shuffle between cards at encounter end:
  - If a card receives a fact that was cursed → that card becomes cursed
  - If a card's fact gets shuffled away and the new fact is not cursed → card is no longer cursed
- **Implementation:** Change curse tracking from `card.isCursed` to `cursedFactIds: Set<string>` on run state. Card displays curse visual based on whether its current fact ID is in the cursed set.
- **Acceptance:** Curses follow facts when they shuffle. A card that receives a clean fact loses its curse. A card that receives a cursed fact gains the curse.

### 4. Chain Momentum — Color-Specific Free Charge
- **Current behavior (per GAME_DESIGN.md §4 Chain Momentum):** Correct Charge → next Charge is free (any color). `nextChargeFree = true`.
- **New behavior:** Correct Charge → next Charge is free ONLY for cards of the SAME chain color.
- **Implementation:** Change `nextChargeFree: boolean` to `nextChargeFreeForChainType: number | null`. Set to the chainType of the correctly charged card. When checking if a charge is free, compare `card.chainType === nextChargeFreeForChainType`.
- **UI:** CHARGE button shows green "+0 AP" ONLY for cards matching the momentum chain type. Other cards show normal cost.
- **Acceptance:** Free charge momentum only applies to same-color cards. Different color cards pay full cost.

---

## Files Affected

- `src/services/turnManager.ts` — turn flow, encounter end hooks
- `src/services/runState.ts` or equivalent — fact assignment, curse tracking, attempted facts
- `src/services/drawPile.ts` or equivalent — fact shuffling at encounter end
- `src/services/cardEffectResolver.ts` — charge momentum chain type check
- `src/services/chainSystem.ts` — momentum tracking per chain type
- `src/data/balance.ts` — any constants related to fact assignment
- `src/ui/combat/ChargeButton.svelte` — conditional free charge display

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] Facts stay stable within an encounter (same card = same fact across draws)
- [ ] Facts shuffle at encounter end (verified by logging)
- [ ] No new facts from pool mid-run
- [ ] First-time facts don't cause downgrade or curse
- [ ] Curses follow facts across encounter shuffles
- [ ] Chain momentum free charge only applies to matching chain color
- [ ] `npx vitest run` passes (update/add tests for all 4 changes)
- [ ] Update `docs/GAME_DESIGN.md` sections: Fact-Card Pairing (§2), Cursed Cards (§2), Chain Momentum (§4)
