# AR-223: Fact Assignment & Curse Mechanics

> **Source:** [Playtest Feedback 2026-03-22](../PLAYTEST-FEEDBACK-2026-03-22.md) — Issues #29, #30, #31, #33
> **Priority:** P1 — Core gameplay logic change
> **Complexity:** Medium-Large (fundamental change to fact-card pairing + curse tracking + chain momentum fix)
> **Dependencies:** None (logic-only, independent of UI ARs)

---

## Overview

Four interconnected changes to how facts pair with cards and how curses/momentum work:

1. Facts no longer randomly selected from pool each draw — instead they shuffle between existing deck cards at encounter boundaries.
2. Cards with never-before-seen facts are protected from downgrade/curse on first attempt.
3. Curses track by FACT ID across encounters, not by card.
4. Chain momentum (free charge on correct) applies only to the SAME chain color, not all charges.

Sub-steps 1 and 3 are tightly coupled — implement together in one pass. Sub-step 1 is the highest-risk change in the entire AR set.

---

## User's Exact Words

- **#29:** "From now on, we don't randomly select facts from our pool each time, instead, at the end of each encounter, randomly assign all facts to another card in our deck, no more randomly getting new ones from the pool."
- **#30:** "When a card has any upgrade and its received a fact we haven't seen before yet, we don't downgrade or go cursed, but only if that card's fact has never been tried before."
- **#31:** "Curses must travel to following encounters by FACT, not by card. So if a card gets a new fact that was cursed in the previous enemy encounter, it transfers to this other card."
- **#33:** "If you get a card right charged, your next charge OF THAT COLOR is free, NOT EVERY CHARGE!!!"

---

## Sub-Steps

### 1. Fact Shuffling Per Encounter (Replace Per-Draw Pool Assignment)

- **Current behavior:** Each `drawHand()` call in `src/services/deckManager.ts` (lines 230–349) selects facts from the FSRS pool and assigns them to drawn cards. Facts rotate every draw. This system has cooldown filtering, dedup, cursed-fact surfacing (AR-202), `firstDrawBias` weighting, and `currentEncounterSeenFacts` tracking.
- **New behavior:**
  - At **run start**: Assign facts to all card slots from the FSRS pool (same as current `createDeck()` logic).
  - During an encounter: Each card's fact is **stable** — it does not change between draws within the same encounter.
  - At **encounter end**: Call `shuffleFactsAtEncounterEnd()` which randomly permutes all fact assignments across all deck card slots. Each card gets a different fact than it held during the previous encounter (dedup-constrained where possible).
  - **No new facts drawn from the pool mid-run** — the set of facts is fixed at run start. Only their card assignments change at encounter boundaries.
- **Implementation:**
  - Read `deckManager.ts` lines 230–350 IN FULL before writing any code. The existing system is complex and must be understood completely.
  - Remove per-draw fact selection logic from `drawHand()`. Cards should simply read their already-assigned fact.
  - Add `shuffleFactsAtEncounterEnd()` to `src/services/deckManager.ts` (not to encounterBridge — keep it co-located with the other fact assignment logic).
  - In `src/services/encounterBridge.ts`, call `shuffleFactsAtEncounterEnd()` from the encounter-end victory path (alongside existing `addFactsToCooldown()` and `resetEncounterSeenFacts()` calls in `handleEndTurn()`).
  - Add feature flag `STABLE_ENCOUNTER_FACTS_ENABLED = true` in `src/data/balance.ts` so this can be rolled back if needed.
  - Audit ALL callers of `drawHand()` before removing per-draw assignment: `encounterBridge.ts`, `gameFlowController.ts`, `runEarlyBoostController.ts`, and the boss quiz phase.
- **Systems that need migration or redesign due to this change:**
  - **Cooldown filtering:** Facts that were on cooldown after the last encounter should not be in the shuffle pool. Apply this constraint during `shuffleFactsAtEncounterEnd()` rather than per-draw.
  - **Cursed-fact surfacing (AR-202):** `CURSED_AUTO_CURE_THRESHOLD` and `consecutiveCursedDraws` become meaningless with stable encounter facts — curses are now always visible because the fact is always present. These fields need redesign or removal.
  - **`firstDrawBias` weighting:** This was a per-draw concern. With stable facts it no longer applies within an encounter; remove or repurpose.
  - **`currentEncounterSeenFacts` tracking:** Still valid — reset at encounter end after the shuffle.
- **Reward cards / new card gap:** When a player earns a new card mid-run as a reward, its fact must come from the pool (the pool-draw ban applies to existing cards, not genuinely new card slots). Allow pool draws ONLY for new card slots being added to the deck. Document this as an explicit exception in code comments.
- **Save compatibility:** Mid-run saves that used the old per-draw model will not have stable fact assignments. On load, if `cardFactAssignments` is missing, fall back to one-time assignment from the pool and log a migration notice.
- **Edge case:** If deck has more card slots than available facts, some facts may repeat across cards. Apply cooldown dedup as best-effort.
- **Acceptance criteria:**
  - Facts are stable within an encounter (same card = same fact across all draws in that encounter).
  - Facts shuffle at encounter end (verified by logging before/after assignments).
  - No new facts drawn from pool mid-run except for newly added reward cards.
  - `STABLE_ENCOUNTER_FACTS_ENABLED = false` reverts to the old per-draw behavior.

---

### 2. New-Fact Protection (No Downgrade/Curse on Unseen Facts)

- **What:** If a card currently has a fact that the player has NEVER attempted (never answered a quiz for this fact ID in this run), the card is protected for that attempt:
  - Cannot be downgraded in mastery.
  - Cannot become cursed.
  - A wrong answer on a first-ever attempt still counts as wrong for FSRS scheduling, but the card penalty is suppressed.
- **Scope:** Protection is per-fact-ID across the entire run, not per card-fact pairing. Once a fact has been attempted once, it loses protection permanently for the rest of the run.
- **Tracking:** Add `attemptedFactIds: Set<string>` to the `RunState` interface in `src/services/runManager.ts` (alongside the existing `cursedFactIds: Set<string>` at line 62).
- **Check:** In `src/services/turnManager.ts`, before applying downgrade or curse logic on a wrong answer, check `!runState.attemptedFactIds.has(card.factId)`. If not yet attempted, skip the penalty, then add the fact ID to `attemptedFactIds`.
- **Interaction with Relaxed mode:** Wrong answers at mastery 0 currently add to `cursedFactIds` (turnManager.ts line 746). With this protection in place, a first-attempt wrong answer must NOT add to `cursedFactIds` either.
- **Do not conflate** with `firstChargeFreeFactIds` in `discoverySystem.ts` — that tracks a different mechanic. These are separate sets with separate purposes.
- **Serialization:** `attemptedFactIds` must be serialized in `encounterBridge.ts > serializeEncounterSnapshot()` so it survives app backgrounding and mid-run saves.
- **Acceptance criteria:**
  - First-time facts (never attempted in this run) do not cause mastery downgrade or curse on a wrong answer.
  - FSRS scheduling still updates correctly on wrong answers regardless of protection.
  - Protection applies exactly once per fact per run. Second wrong answer on same fact applies full penalties.

---

### 3. Curse Tracking by Fact (Not Card)

- **Current state:** `cursedFactIds: Set<string>` ALREADY EXISTS on `RunState` (line 62 of `src/services/runManager.ts`). The `card.isCursed` flag is ALREADY derived per-draw from `cursedFactIds` in `deckManager.ts` line 319: `card.isCursed = cursedFactIds.has(factId)`. Sub-step 3 is therefore PARTIALLY IMPLEMENTED.
- **What is actually missing:** With stable encounter facts (sub-step 1), `card.isCursed` must be re-derived correctly each time facts are reshuffled at encounter end. Specifically: after `shuffleFactsAtEncounterEnd()` reassigns facts to cards, any card that receives a fact ID present in `cursedFactIds` must display the curse visual; any card whose old cursed fact was shuffled away and replaced with a non-cursed fact must lose the curse visual.
- **No new data structure is needed.** The `cursedFactIds` set already does the right thing — the curse follows the fact ID, and `card.isCursed` is derived from the set. The only work is ensuring the derivation runs after each shuffle.
- **Implementation:** Ensure `drawHand()` (or whatever derives `card.isCursed`) runs AFTER `shuffleFactsAtEncounterEnd()` in the encounter-end sequence, so derived flags are fresh.
- **Do not** add a separate `card.isCursed` field that is set and stored independently — the derived approach from `cursedFactIds` is correct and must be preserved.
- **Acceptance criteria:**
  - Curses follow fact IDs when facts shuffle at encounter end.
  - A card that receives a cursed fact gains the curse visual.
  - A card that had a cursed fact shuffled away loses the curse visual.
  - No new data structures — existing `cursedFactIds` set is sufficient.

---

### 4. Chain Momentum — Color-Specific Free Charge

- **Current behavior (per GAME_DESIGN.md §4 Chain Momentum):** Correct Charge → `nextChargeFree = true` on TurnState → next Charge of ANY color is free.
- **New behavior:** Correct Charge → free charge ONLY for the SAME chain color as the card that was correctly charged.
- **Implementation:**
  - Change `nextChargeFree: boolean` on `TurnState` to `nextChargeFreeForChainType: number | null`.
  - `nextChargeFree` is referenced in 7+ places in `src/services/turnManager.ts` (lines 474, 589, 590, 592, 594, 611, 691, 1706, 2109). Update all of them.
  - When a Charge resolves correctly, set `nextChargeFreeForChainType = card.chainType` (the color of the card that was charged).
  - When checking if an incoming charge is free: compare `card.chainType === turnState.nextChargeFreeForChainType`.
  - Reset to `null` after consuming the free charge (same logic as current boolean reset).
  - **Priority order for free-charge sources** (highest priority wins): `warcryFreeChargeActive` (AR-207, waives charge for ANY color) > `nextChargeFreeForChainType` (color-specific momentum). Warcry free charge is applied first; if already free from warcry, do not consume momentum.
  - Update `src/ui/components/CardHand.svelte`: change `nextChargeFree: boolean` prop to `chargeMomentumChainType: number | null`. Each card compares `card.chainType === chargeMomentumChainType` to determine whether to show green "+0 AP" on its charge button. Cards of other colors show full cost.
  - The headless simulator imports `turnManager.ts` and `TurnState` directly — the type change will break it. Update `tests/playtest/headless/simulator.ts` and `tests/playtest/headless/browser-shim.ts` as needed.
  - Run headless sim BEFORE the change to capture baseline win rates, then AFTER to confirm no regression: `npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 1000`
- **Acceptance criteria:**
  - Free charge momentum only applies to cards matching the momentum chain color.
  - Cards of other colors pay full AP cost even if momentum is active.
  - Warcry free charge (AR-207) still correctly overrides all charges regardless of color.
  - CHARGE button shows green "+0 AP" only for matching-color cards.
  - Headless sim win rates within ±3% of baseline.

---

## Files Affected

| File | Sub-steps | Notes |
|---|---|---|
| `src/services/deckManager.ts` | 1, 3 | Main file for sub-step 1. Lines 230–349: per-draw fact assignment. Add `shuffleFactsAtEncounterEnd()`. Remove per-draw pool selection. |
| `src/services/runManager.ts` | 2, 3 | `RunState` interface. `cursedFactIds: Set<string>` already at line 62. Add `attemptedFactIds: Set<string>`. |
| `src/services/encounterBridge.ts` | 1, 2 | Call `shuffleFactsAtEncounterEnd()` from victory path in `handleEndTurn()`. Serialize `attemptedFactIds` in `serializeEncounterSnapshot()`. |
| `src/services/turnManager.ts` | 2, 4 | Wrong-answer penalty guard (sub-step 2). Replace `nextChargeFree` with `nextChargeFreeForChainType` (7+ references). |
| `src/data/balance.ts` | 1 | Add `STABLE_ENCOUNTER_FACTS_ENABLED = true` feature flag. |
| `src/ui/components/CardHand.svelte` | 4 | Change prop `nextChargeFree: boolean` to `chargeMomentumChainType: number | null`. Per-card color comparison for charge button display. |
| `src/services/chainSystem.ts` | 4 | Potentially update per-color momentum tracking if chain system owns any of this state. |
| `src/services/cardEffectResolver.ts` | 4 | Charge momentum check at resolve time — update to color-aware comparison. |
| `tests/playtest/headless/simulator.ts` | 4 | Update TurnState usage for `nextChargeFreeForChainType`. |

**Files that do NOT exist — do not create or reference:**
- `src/services/runState.ts` — does not exist; RunState is in `runManager.ts`
- `src/services/drawPile.ts` — does not exist; draw logic is in `deckManager.ts`
- `src/ui/combat/ChargeButton.svelte` — does not exist; charge button is inline in `CardHand.svelte`

---

## Worker Notes

These notes are for the implementing worker to prevent common pitfalls:

1. **Sub-steps 1 and 3 must be implemented together in one pass.** They share the same data flow (fact assignment → `isCursed` derivation). Doing them separately risks an intermediate broken state.
2. **Read `deckManager.ts` lines 230–350 in full before writing a single line of code.** The existing fact assignment system (AR-93 + AR-202) is intricate. Understand all of it before changing any of it.
3. **Audit all callers of `drawHand()` before removing per-draw assignment.** Callers include: `encounterBridge.ts`, `gameFlowController.ts`, `runEarlyBoostController.ts`, and the boss quiz phase. Each must be compatible with stable facts.
4. **`cursedFactIds` already exists — do not re-implement it.** Sub-step 3 is about ensuring the shuffle triggers correct re-derivation, not about building a new data structure.
5. **Reward cards are an explicit exception** to the no-new-pool-draws rule. When a new card slot is added to the deck as a reward, it must draw its initial fact from the pool. Add a clear code comment marking this exception.
6. **Run the headless sim before and after sub-step 4.** Chain momentum is a balance lever. A 1000-run baseline before the change and 1000-run check after will catch any unintended win-rate shift. Target: within ±3% of baseline.
7. **Feature-flag sub-step 1** with `STABLE_ENCOUNTER_FACTS_ENABLED` in `balance.ts`. This is the highest-risk change — a clean rollback path is mandatory.

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] `npx vitest run` passes — add/update tests for all 4 changes
- [ ] Facts are stable within an encounter (verified by logging fact IDs before/after draws)
- [ ] Facts shuffle at encounter end (verified by logging before/after assignments)
- [ ] No new facts drawn from pool mid-run (except reward card additions)
- [ ] `STABLE_ENCOUNTER_FACTS_ENABLED = false` reverts to old per-draw behavior
- [ ] First-time facts (not in `attemptedFactIds`) do not cause mastery downgrade or curse
- [ ] FSRS scheduling still updates on wrong answers regardless of new-fact protection
- [ ] Curses follow fact IDs through shuffles (card receiving cursed fact gains curse; losing cursed fact loses curse)
- [ ] `warcryFreeChargeActive` (AR-207) still waives charge for any color regardless of momentum
- [ ] Chain momentum free charge applies ONLY to cards of the matching chain color
- [ ] CHARGE button shows green "+0 AP" only for matching-color cards
- [ ] Headless sim win rates within ±3% of pre-change baseline (run 1000 rounds before and after sub-step 4)
- [ ] `docs/GAME_DESIGN.md` updated: Fact-Card Pairing (§2), Cursed Cards (§2), Chain Momentum (§4)
- [ ] `data/inspection-registry.json` updated: `lastChangedDate` for affected systems (quiz system, chain momentum, cursed cards)
