# AR-122: LLM Playtest Balance Pass

**Status:** ACTIVE
**Priority:** HIGH
**Complexity:** Medium (5 sub-tasks, mostly constant/formula changes + 1 UI feature)
**Dependencies:** None
**Source:** LLM strategic playtest session (2026-03-21) — 6 Haiku agents analyzed QP vs Charge decisions, chain puzzle quality, enemy pressure, deck building, onboarding, and surge rhythm.

---

## Overview

Six LLM playtest agents identified critical balance and UX issues through qualitative strategic analysis. This AR addresses the 5 highest-impact findings with user-approved fixes.

---

## Sub-step 1: Free First Charge — Fizzle on Wrong Answer

**Problem:** Free First Charge has zero downside (wrong = 1.0x = same as Quick Play). Charging is strictly dominant for every new fact. Kills decision quality for ~50% of a run.

**Fix:** Change `FIRST_CHARGE_FREE_WRONG_MULTIPLIER` from `1.0` to `0.0`. Wrong answer on a Free First Charge = card fizzles (0 damage/effect). Creates a real gamble: you get to TRY a fact for free, but if wrong, you wasted your play entirely.

**Files:**
- `src/data/balance.ts` — Change `FIRST_CHARGE_FREE_WRONG_MULTIPLIER = 1.0` to `0.0`
- `docs/GAME_DESIGN.md` — Update Free First Charge section: wrong answer = fizzle (0x), not 1.0x
- Card UI should show a "fizzle" animation when this happens (brief grey-out, no damage number)

**Acceptance criteria:**
- [ ] Free First Charge wrong answer deals 0 damage/effect
- [ ] Subsequent Charges of the same fact use normal wrong multiplier (0.6/0.7x by tier)
- [ ] CHARGE button still shows "FREE" for uncharged facts
- [ ] Fizzle has a clear visual (not just "0 damage" — needs to communicate "your card did nothing")
- [ ] Unit tests updated for the new multiplier

---

## Sub-step 2: Correct Charge → Next Charge Free (Chain Momentum)

**Problem:** Chains cost too much AP. A 3-chain requires 6 AP (3 cards x 2 AP each) but player has 3 AP. Chains rated 4/10 — the richest mechanic is unplayable.

**Fix:** When a Charge play results in a CORRECT answer, the NEXT Charge play in that same turn has its +1 AP surcharge waived (costs base AP only). This creates "chain momentum" — correct answers reward you with AP savings, enabling longer chains through SKILL.

**Rules:**
- Correct Charge → set `nextChargeFree = true` on turn state
- Next card played as Charge → surcharge = 0 (regardless of Surge). Consume `nextChargeFree`.
- Wrong Charge → `nextChargeFree = false` (momentum lost)
- Quick Play → `nextChargeFree = false` (momentum lost)
- Turn end → `nextChargeFree` resets
- This stacks WITH Surge (on Surge turns, charges are already free, so this has no additional AP effect but the flag still tracks for UI purposes)

**Files:**
- `src/services/turnManager.ts` — Add `nextChargeFree: boolean` to TurnState. Set true on correct Charge resolve. Consume on next Charge AP calculation. Reset on Quick Play, wrong Charge, and turn end.
- `src/services/surgeSystem.ts` — `getSurgeChargeSurcharge` should also check `nextChargeFree` flag (or turnManager handles this before calling surge)
- `src/data/balance.ts` — Add `CHAIN_MOMENTUM_ENABLED = true` constant
- `docs/GAME_DESIGN.md` — Add Chain Momentum section under Charge Play

**UI indicator:**
- When `nextChargeFree` is true, all CHARGE buttons in hand should show "+0 AP" (same as Surge display) with a brief green flash to indicate "earned free charge"
- Could show a small "MOMENTUM" label or green glow on the AP counter

**Acceptance criteria:**
- [ ] Correct Charge sets nextChargeFree on turn state
- [ ] Next Charge play costs base AP only (no surcharge)
- [ ] Wrong Charge / Quick Play / turn end clears the flag
- [ ] CHARGE buttons update to show "+0 AP" when momentum is active
- [ ] Headless sim updated to use chain momentum
- [ ] Unit tests cover: correct→free→correct→free chain, correct→wrong breaks, correct→quickplay breaks

---

## Sub-step 3: Reduce to 3 Chain Types Per Run

**Problem:** With 6 chain types and 5 cards per hand, meaningful chain opportunities (3+ matching cards) occur ~15-20% of hands. Too rare to build around.

**Fix:** Each run selects only 3 of the 6 chain types. All cards in the run are assigned one of these 3 types. With 5 cards and 3 types, players get 2-3 matching cards per hand on average — chains become a realistic, buildable goal.

**Rules:**
- At run start, `buildRunPool()` selects 3 chain types (from the 6 available) based on the chosen domain/fact pool composition
- All card slots are assigned chain types from only these 3
- The 3 selected types should be displayed somewhere the player can reference (deck view? map screen?)
- All 6 chain type definitions remain in `chainTypes.ts` — this is a run-level filter, not a global reduction

**Files:**
- `src/services/runPoolBuilder.ts` — Modify chain type assignment: select 3 types at run start, assign cards using `i % 3` (from selected types) instead of `i % NUM_CHAIN_TYPES`
- `src/services/presetPoolBuilder.ts` — Same change for preset pools
- `src/data/chainTypes.ts` — Add `CHAIN_TYPES_PER_RUN = 3` constant. Add helper `selectRunChainTypes(seed): number[]` that deterministically picks 3 from 6
- `docs/GAME_DESIGN.md` — Update chain type section: "Each run uses 3 of 6 chain types"

**Acceptance criteria:**
- [ ] Run pool builder selects exactly 3 chain types per run
- [ ] All cards in the run have one of the 3 selected chain types
- [ ] Chain type selection is seeded (deterministic for same run seed)
- [ ] Shop cards and reward cards also use the run's 3 chain types
- [ ] Headless sim updated for 3-type runs
- [ ] Unit tests cover: only 3 types appear, distribution is roughly even

---

## Sub-step 4: Persistent Surge Counter Across Encounters

**Problem:** Surge counter resets to turn 1 each encounter. Most Act 1 fights are 3-4 turns. With Surge on turn 2, every fight gets exactly one Surge — predictable and boring. With Surge every 4th turn, short fights might never see Surge at all.

**Fix:** The surge turn counter persists across encounters within a run. If encounter 1 ends on turn 3, encounter 2 starts on turn 4. This means Surge timing varies per encounter — sometimes you get Surge on turn 1 of a fight, sometimes not until turn 3. Creates unpredictability.

**Also change Surge interval from 3 to 4** (user + playtest recommendation).

**Rules:**
- Run state tracks `globalTurnCounter: number` (starts at 1, never resets within a run)
- Each encounter, `turnState.turnNumber` is set from `globalTurnCounter` (not reset to 1)
- `isSurgeTurn()` uses the global counter
- `globalTurnCounter` increments on each player turn across all encounters
- On new run start, `globalTurnCounter` resets to 1
- Change `SURGE_INTERVAL` from 3 to 4

**Files:**
- `src/data/balance.ts` — Change `SURGE_INTERVAL = 3` to `4`
- `src/services/turnManager.ts` — Remove `turnNumber: 1` initialization per encounter. Instead, read from run state's `globalTurnCounter`. Increment global counter on turn end.
- `src/services/surgeSystem.ts` — Update JSDoc to reflect persistent counter and interval=4
- `src/services/gameFlowController.ts` or run state — Add `globalTurnCounter` to run state, serialize/deserialize for save/resume
- `docs/GAME_DESIGN.md` — Update Surge section: interval=4, counter persists across encounters

**Acceptance criteria:**
- [ ] Surge counter does NOT reset between encounters
- [ ] `SURGE_INTERVAL` is 4 (Surge every 4th global turn)
- [ ] Save/resume preserves the global turn counter
- [ ] Surge timing varies between encounters (not always on turn 2)
- [ ] Headless sim uses persistent surge counter
- [ ] Unit tests cover: multi-encounter surge timing, save/load persistence
- [ ] Enrage system still uses per-encounter turn count (NOT global counter) — enrage should not carry over

**IMPORTANT:** Enrage bonus (`getEnrageBonus`) uses `turnNumber` to calculate when an enemy starts enraging. This must STILL use a per-encounter counter, not the global one. The encounter-local turn number is needed for enrage; the global counter is only for Surge.

---

## Sub-step 5: Synergy Tooltips on Cards and Relics

**Problem:** Deck building synergies exist (Empower + Double Strike, chain focusing, AP economy) but are undercommunicated. New players just pick "highest damage card."

**Fix:** Add synergy tooltips to cards and relics across ALL contexts (hand, rewards, shop, library, deck view). When a card or relic has known synergies with other cards/relics in the player's current deck or hand, show a brief indicator.

**Design:**
- Each card mechanic has a `synergiesWith: string[]` field listing mechanic names it combos with
- Each relic has a `synergiesWith: string[]` field listing mechanic names or relic IDs it boosts
- When displaying a card/relic, check the player's current deck for matches
- Show a small "Synergy!" badge or tooltip listing matching cards/relics

**Synergy map (initial set):**
```
Empower → [Strike, Heavy Strike, Multi-Hit, Reckless, Piercing, Execute, Lifetap]
Double Strike → [Strike, Heavy Strike, Multi-Hit, Reckless, Piercing, Execute, Lifetap, Empower]
Focus → [Heavy Strike, Multi-Hit, Fortify, Slow, Double Strike]
Expose → [Strike, Heavy Strike, Multi-Hit, Reckless, Piercing, Execute]
Quicken → [Heavy Strike, Multi-Hit, Double Strike]
Hex → [Hex (stacking), Expose]
Brace → [Scout, Foresight (see intent)]
```

**Relic synergies:** Each relic that boosts a specific play style (e.g., "Glass Cannon: +30% dmg") should show synergy with attack cards in the deck.

**Files:**
- `src/data/card-types.ts` or new `src/data/synergies.ts` — Define synergy map
- Card display components (CardHand, CardExpanded, reward screen, shop) — Show synergy badge when matches found
- Relic display components — Show synergy badge
- `docs/GAME_DESIGN.md` — Document synergy tooltip system

**Acceptance criteria:**
- [ ] Synergy map defined for all 26 mechanics
- [ ] Cards in reward screen show "Synergy with: [card names]" when matching deck cards
- [ ] Cards in shop show synergy indicators
- [ ] Relics in shop/reward show synergy with deck composition
- [ ] Synergy display works in both portrait and landscape
- [ ] Does NOT show synergies for cards already in the deck (only for new acquisitions)
- [ ] Visual is subtle (small badge/icon, not overwhelming)

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] `npx vitest run` — all tests pass (including new tests for each sub-step)
- [ ] Headless sim runs with all changes: `npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 1000`
- [ ] Playwright visual inspection: combat with Free First Charge fizzle, chain momentum indicator, Surge timing variation
- [ ] GAME_DESIGN.md and ARCHITECTURE.md updated for all changes
