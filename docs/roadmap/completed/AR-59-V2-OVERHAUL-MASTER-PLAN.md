# AR-59 — V2 Overhaul: Master Plan

> **Type:** Master phase document (parent of AR-59.1 through AR-59.23)
> **Status:** COMPLETE — all 23 sub-ARs implemented
> **Priority:** Critical — this is the entire product direction shift
> **Estimated effort:** ~8-10 weeks across sprints

---

## Overview

This document is the **single source of truth** for the complete Recall Rogue v2 overhaul. It specifies every system change, addition, removal, and research item required to transform the current game into the v2 design described in `docs/RESEARCH/recall-rogue-overhaul-v2.md`.

### The Core Shift

**v1 philosophy:** Quiz on every card play — learning is a toll.
**v2 philosophy:** Quiz is optional but powerful — learning is a multiplier.

Every player action remains functional without quizzing. Charging (taking the quiz on a card play) costs +1 AP and unlocks 3.0× power. Wrong answers give 0.7× (worse than Quick Play, never bricked). The optimization path and the learning path converge at high play.

### What Does NOT Change

| System | Status | Notes |
|--------|--------|-------|
| FSRS spaced repetition engine | KEEP | All quiz moments update FSRS |
| Tier system (1 / 2a / 2b / 3) | KEEP | Powers Charge scaling |
| Mastery Trial mechanic | KEEP | More dramatic under v2 — golden card, Tier 3 = auto-Charge |
| Domain/categoryL2 tagging | KEEP | Powers Knowledge Chain system |
| Fact-per-encounter random assignment | KEEP | Cards pair with random facts each draw |
| Per-draw fact shuffling | KEEP | Preserves educational breadth |
| Dynamic timer system | KEEP | Still used for Charged quizzes |
| Echo mechanic | MODIFY | Echo cards now force Charge-only play |
| First-person dungeon perspective | KEEP | Phaser canvas + Svelte overlay |
| Act map with branching paths | MODIFY | 4 regions → 3 acts |
| Canary System (adaptive difficulty) | KEEP | Retune thresholds for lower quiz frequency |
| Learning Threshold Reward Gate | KEEP | Retune sample sizes |
| Bounty Quests | KEEP | Reword for Charge system |
| Daily Expedition | KEEP | Critical for retention |
| Lore Discovery | KEEP | Mastery milestones unchanged |
| wowFactor display | KEEP | Fires on Tier 1 correct Charge |
| Tier-up celebrations | KEEP | Fires on correct Charge tier advance |
| Gold economy | KEEP | ~400-800g per run, shops still use gold |
| Mastery Coins (Hub relic unlocks) | KEEP | Simplified — 25 free, 17 require coins |
| Fact Discovery System (per-run) | ADD | Free First Charge — first Charge of any fact costs 0 AP, wrong = 1.0× (no penalty) |

---

## Sub-AR Index

| Sub-AR | Title | Category | Priority | Dependencies | Status |
|--------|-------|----------|----------|--------------|--------|
| [59.1](#ar-591--quick-play--charge-play-system) | Quick Play / Charge Play System | A: Core Combat | P0 | none | ✅ DONE |
| [59.2](#ar-592--charge-gesture-ux-fling-up) | Charge Gesture UX (Fling-Up) | A: Core Combat | P0 | 59.1 | ✅ DONE |
| [59.3](#ar-593--knowledge-chain-system) | Knowledge Chain System | A: Core Combat | P0 | 59.1 | ✅ DONE |
| [59.4](#ar-594--knowledge-surge-every-3rd-turn) | Knowledge Surge (Every 3rd Turn) | A: Core Combat | P0 | 59.1 | ✅ DONE |
| [59.5](#ar-595--3-act-run-structure) | 3-Act Run Structure | B: Run Structure | P1 | 59.1 | ✅ DONE |
| [59.6](#ar-596--starter-deck-simplification) | Starter Deck Simplification | B: Run Structure | P1 | none | ✅ DONE |
| [59.7](#ar-597--boss-quiz-phases) | Boss Quiz Phases | B: Run Structure | P1 | 59.5, 59.13 | ✅ DONE |
| [59.8](#ar-598--card-mechanics-rebalance-for-quick-playcharge) | Card Mechanics Rebalance | C: Card Mechanics | P1 | 59.1 | ✅ DONE |
| [59.9](#ar-599--removearchive-unused-mechanics) | Remove/Archive Unused Mechanics | C: Card Mechanics | P1 | 59.8 | ✅ DONE |
| [59.10](#ar-5910--5-slot-relic-system) | 5-Slot Relic System | D: Relics | P1 | none | ✅ DONE |
| [59.11](#ar-5911--v2-relic-catalogue-42-relics) | v2 Relic Catalogue (42 relics) | D: Relics | P1 | 59.10 | ✅ DONE |
| [59.12](#ar-5912--relic-acquisition-flow-in-run) | Relic Acquisition Flow (In-Run) | D: Relics | P1 | 59.10, 59.5 | ✅ DONE |
| [59.13](#ar-5913--v2-enemy-roster) | v2 Enemy Roster | E: Enemies | P1 | 59.5 | ✅ DONE |
| [59.14](#ar-5914--rest-site-three-choices) | Rest Site: Three Choices | F: Rest/Shop | P2 | 59.5 | ✅ DONE |
| [59.15](#ar-5915--shop-haggling) | Shop Haggling | F: Rest/Shop | P2 | none | ✅ DONE |
| [59.16](#ar-5916--charge-play-animation-system) | Charge Play Animation System | G: Visual/UX | P2 | 59.1, 59.2 | ✅ DONE |
| [59.17](#ar-5917--chain-visual-system) | Chain Visual System | G: Visual/UX | P2 | 59.3 | ✅ DONE |
| [59.18](#ar-5918--surge-visual-system) | Surge Visual System | G: Visual/UX | P2 | 59.4 | ✅ DONE |
| [59.19](#ar-5919--removearchive-deprecated-systems) | Remove/Archive Deprecated Systems | H: Cleanup | P1 | 59.1–59.4 | ✅ DONE |
| [59.20](#ar-5920--echo-mechanic-v2) | Echo Mechanic v2 | I: Echo | P2 | 59.1 | ✅ DONE |
| [59.21](#ar-5921--game_designmd-full-rewrite) | GAME_DESIGN.md Full Rewrite | J: Docs | P3 | all | ✅ DONE |
| [59.22](#ar-5922--architecturemd-update) | ARCHITECTURE.md Update | J: Docs | P3 | all | ✅ DONE |
| [59.23](../completed/AR-59.23-FACT-DISCOVERY-SYSTEM.md) | Fact Discovery System | A: Core Combat | P1 | 59.1 | ✅ DONE |

---

## Recommended Implementation Order

```
Sprint 1 (Week 1-2): Core Loop Overhaul
  AR-59.1  Quick Play / Charge Play System       ← foundation, everything depends on this
  AR-59.2  Charge Gesture UX + CHARGE! Button    ← wired to 59.1
  AR-59.6  Starter Deck Simplification           ← quick win, no dependencies
  AR-59.5  3-Act Run Structure                   ← needed to test the loop end-to-end
  AR-59.3  Knowledge Chain System                ← new multiplier layer
  AR-59.17 Chain Visual System                   ← chains are unusable without visuals
  AR-59.8  Card Mechanics Rebalance              ← QP/Charge values for all 25 mechanics
  AR-59.9  Remove/Archive Unused Mechanics       ← after 59.8
  AR-59.19 Remove Deprecated Systems             ← clean up old combo, speed bonus, archetypes

Sprint 2 (Week 3-4): Surge + Boss + Feel + Discovery
  AR-59.23 Fact Discovery System                 ← cardHint + per-run discovery tracking (depends on 59.1 ✓)
  AR-59.4  Knowledge Surge (every 3rd turn)      ← changes turn rhythm
  AR-59.18 Surge Visual System                   ← surge needs visuals to communicate
  AR-59.7  Boss Quiz Phases                      ← depends on 59.5 + enemies
  AR-59.16 Charge Play Animation System          ← polish the core interaction
  Sound design pass (not a separate AR)

Sprint 3 (Week 5-6): Relics + Enemies + Side Systems
  AR-59.10 5-Slot Relic System                   ← relic economy overhaul
  AR-59.11 v2 Relic Catalogue (20 priority)      ← build-arounds first, stat sticks later
  AR-59.12 Relic Acquisition Flow                ← depends on 59.10 + 59.5
  AR-59.13 v2 Enemy Roster (key enemies)         ← Examiner, Mimic, Timer Wyrm, Archivist
  AR-59.14 Rest Site: Three Choices              ← independent
  AR-59.15 Shop Haggling                         ← independent

Sprint 4 (Week 7-8): Polish + Playtest
  AR-59.11 v2 Relic Catalogue (complete to 42)   ← finish remaining relics
  AR-59.13 v2 Enemy Roster (complete all acts)   ← finish all enemies
  AR-59.20 Echo Mechanic v2                      ← Charge-only echoes
  Balance tuning pass (not a separate AR)
  GET 5-10 REAL HUMANS TO PLAY

Sprint 5 (Week 9-10): Documentation + Ship
  AR-59.21 GAME_DESIGN.md Full Rewrite           ← after all implementation
  AR-59.22 ARCHITECTURE.md Update
  categoryL2 coverage verification
  Ascension levels (10)
  Daily Expedition mode updates
```

---

## Design Decisions (Q&A Resolved)

These decisions were resolved via Q&A on 2026-03-16 and are BINDING for all sub-ARs.

### D1 — Card Play UX (Quick Play + CHARGE Button)
**Decision:** Keep existing two-tap flow. Tap once to inspect/pop card → tap popped card = Quick Play. ADDITIONALLY, a floating "CHARGE!" button appears above the popped card as an explicit Charge trigger. Fling/drag up gesture is the power-user shortcut (same result as the button).
**Rationale:** Discoverable UX — new players see the button, experienced players use the gesture.

### D2 — Tier 3 Auto-Charge Is Strictly Better (Confirmed)
**Decision:** Tier 3 cards auto-resolve at 1.2×, no quiz, no +1 AP surcharge. Strictly better than Quick Play in every way. This is intentional — mastering a fact IS the reward. A player with 15 Mastered facts plays a fundamentally easier game. They earned it.

### D3 — Research Justification Reframing
**Decision:** Update GAME_DESIGN.md to reframe from "every card play is retrieval practice" to "every Charged play is HIGH-QUALITY retrieval practice with emotional stakes." Cite Bjork's desirable difficulties — fewer, harder, voluntary retrievals beat forced ones. Commit-before-reveal rule still applies WITHIN Charging (once you fling past threshold, quiz appears, no backing out).

### D4 — Wrong Charge at 0.7× Is Intentionally Generous
**Decision:** 0.7× is more generous than old 20% fizzle. Justified because: (1) player already spent +1 AP to Charge, (2) 0.7× is still worse than Quick Play's 1.0× so there's always a penalty, (3) double punishment (wasted AP + below-base effect) is sufficient. No additional AP penalty on wrong Charge.

### D5 — Anti-Quick-Play-Only Enforcement
**Decision:** Both mechanical and difficulty tuning enforce Charging:
- **Act 1:** Beatable with pure Quick Play (enemy HP 20-40). Teaches basics.
- **Act 2:** Gets tight. Enemies have 50-70 HP + block/healing. Enrage timers at turn 6-8. Need burst damage. The Examiner gains +3 Strength per non-Charge turn.
- **Act 3:** Cannot be Quick Played through. Enemies 65-120 HP. The Librarian is immune to Quick Play damage. Boss quiz phases are mandatory.
- **Surge turns:** Free Charging every 3rd turn nudges even reluctant players.
- **Ramp feels natural:** Act 1 teaches QP → Act 2 teaches "you should Charge" → Act 3 teaches "you must Charge well."

### D6 — Chain Probability Fix (5-8 Active categoryL2 Groups Per Run)
**Decision:** The run pool builder must concentrate on **5-8 active categoryL2 groups** per run (based on selected domains). With all ~50 values spread uniformly, chain probability is too low (~18% for a 2-chain). With 5-8 groups: 2-chain probability ~70-80%, 3-chain ~20-30%. This is consistent with existing design (run pool selects from 2 domains). Tag Magnet relic and Swift Boots further improve odds. Base probability must be viable WITHOUT relics.

### D7 — Facts Shuffle Per Draw (Unchanged)
**Decision:** Keep per-draw shuffling (current behavior). Each hand draws fresh fact-to-mechanic pairings. Chain opportunities shift every turn within the same fight, keeping the puzzle fresh. Per-encounter would make hands feel same-y.

### D8 — No Cap on Peak Multipliers
**Decision:** Allow peak multipliers (9.0×–10.5×) uncapped. These require 5-chain + all Charged correct + Surge + Legendary relic — a perfect storm happening maybe once per 10-15 runs. This is the "broken build" fantasy (Balatro allows 10^39). If playtesting shows it trivializes content, tune enemy HP up rather than capping multipliers.

### D9 — First Surge on Turn 2 (Not Turn 3)
**Decision:** First Surge comes on turn 2, then every 3 turns after: turns 2, 5, 8, 11... This ensures short fights (3-4 turns) see at least one Surge. Also improves onboarding — new players see Surge on their second turn ever.

### D10 — 3 Quizzes on Surge Turn Is Intended
**Decision:** With 3 AP and free Charging, players can Charge 3 cards on a Surge turn = 3 rapid quizzes. This is the HIGH INTENSITY moment. The contrast with normal turns (0-1 quizzes) makes Surge feel special. If playtesting shows it's overwhelming, fallback: "first 2 Charges free, 3rd costs +1 AP." But try full-free first.

### D11 — Keep STS-Style Branching Maps, Use 24-30 Enemies Per Act
**Decision:** Keep STS-style branching within each 7-8 node act. Reuse existing map generation with `ROWS_PER_ACT` reduced from 15 to 7-8. Use 24-30 of the 88 existing enemy sprites per act (some shared across acts with stat scaling). Don't simplify to linear — branching paths are where "path toward elites for relics vs avoid them for safety" decisions live.

### D12 — Cut Retreat-or-Delve
**Decision:** Remove retreat-or-delve checkpoints. A 25-minute run doesn't need mid-run exit points. Save/resume handles mid-session quits. Retreat-or-delve was designed for the old 90-minute structure.

### D13 — Gold Economy Still Exists
**Decision:** Gold is earned from combat (~15-25g per regular, ~40-60g per elite/boss), spent at shops, and modified by economy relics (Gold Magnet +30%, Lucky Coin +flat). Typical run total ~400-800g. The v2 doc's shop pricing section implies gold — make it explicit in all docs.

### D14 — Keep Mastery Coins, Simplified
**Decision:** Start with 25 relics unlocked (Commons + some Uncommons). The remaining ~17 (Rares + Legendaries) require Mastery Coin purchases from the Hub. Hub Anvil/Relic Archive still exists for unlocking. Preserves the "mastered facts earn meta-currency" loop while ensuring viable builds from run 1.

### D15 — Add Relic Reroll Mechanic
**Decision:** At boss/mini-boss relic selection (pick 1 of 3), player can spend 50g to reroll all 3 options. Once per selection. Prevents build-bricking. Additionally, a "Merchant's Favor" relic (already in v2 spec) gives 4 relic choices instead of 3.

### D16 — Exclude Relics Requiring Unbuilt Mechanics
**Decision:** Toxic Bloom (requires multi-enemy encounters) and any other relic requiring unbuilt mechanics are excluded from Phase 1 launch. Keep catalogue at ~38-40 functional relics. Add excluded relics when their mechanics ship.

### D17 — Keep All 88 Enemy Sprites
**Decision:** Use 8-10 unique enemies per act (24-30 total) with distinct behaviors. Remaining sprites become visual variants (same behavior, different look + minor stat tweaks: e.g., Cave Bat vs Cave Bat Alpha). Ascension modes introduce unused enemies as harder variants. Nothing is wasted.

### D18 — Forced-Charge Encounters Are Act 2+ Only
**Decision:** The Examiner (first forced-Charge encounter) is Act 2. By then, players have had ~6-8 combats with optional Charging, 3-4 Surge turns with free Charging, and a mini-boss. The escalating Strength (+3/turn) is slow enough to learn on the spot. Intent panel telegraphs: "The Examiner studies your hesitation. +3 Strength." The Librarian (QP-immune) is Act 3 — a skill check, not a learning moment.

### D19 — "Weakest Domain" = Lowest Run Accuracy per categoryL2
**Decision:** Track per-categoryL2 accuracy during the current run. At Curator's 33% quiz phase, select facts from the categoryL2 with lowest accuracy this run. If tied, use the one with most wrong answers. Calculable from existing run state — no FSRS lookup mid-combat.

### D20 — Study Upgrades Are Player Choice (Not Random)
**Decision:** After each correct Study answer at a rest site, show 3 deck cards → player picks which one to upgrade. Same pick-1-of-3 flow as current upgrade. The v2 doc saying "random" was incorrect. Player agency matters.

### D21 — Meditate Is Limited; Shop Removal Still Exists
**Decision:** Meditate = 1 free card removal per rest site visit, max 1 rest site per act = 2-3 free removals per run. Shop removal starts at 50g (down from 75g due to shorter runs/less gold), +25g per removal. They serve different purposes: Meditate = free trim, shop removal = intentional deck thinning investment.

### D22 — Systems to Keep/Modify/Cut

| System | Status | Notes |
|--------|--------|-------|
| Canary System (invisible adaptive difficulty) | KEEP | Retune thresholds for lower quiz frequency |
| Learning Threshold Reward Gate | KEEP | Retune — fewer quizzes means noisier accuracy %, adjust sample size minimums |
| Bounty Quests | KEEP | Reword some to reference Charge system: "Charge 5 cards," "Complete a 4-chain" |
| Daily Expedition | KEEP | Critical for retention. Same seed, same scoring |
| Lore Discovery | KEEP | Mastery milestones at 10/25/50/100 mastered facts. Low effort, high emotional payoff |
| Ascension Mode | KEEP | Launch with 10 levels (not 20). Each reuses content at higher difficulty |

### D23 — wowFactor, Tier-Up Celebrations, Card Upgrades

| Feature | Status | Notes |
|---------|--------|-------|
| wowFactor display | KEEP | Still fires on Tier 1 correct Charge answers |
| Tier-up celebrations | KEEP | Fires on correct Charge that advances a fact tier |
| Rest site "pick 1 of 3" upgrade | CUT | Study IS the rest site upgrade path now |
| Post-mini-boss upgrade | CUT | Post-mini-boss still heals 15%, but no upgrade. First mini-boss = relic reward |
| Card upgrades from Study | KEEP | Primary upgrade path at rest sites |
| Mystery room upgrade events | KEEP | Rare alternative upgrade source |

### D24 — FSRS Tier Thresholds Retuned

With 45-70 quizzes per run (vs 150+), each fact gets quizzed ~2-4 times per run instead of ~6-10. Stability thresholds (time-based) are fine. `consecutiveCorrect` requirements reduced:

| Tier | Old Requirement | New Requirement |
|------|----------------|-----------------|
| 2a | 2+ consecutive correct + stability ≥2d | **Unchanged** |
| 2b | 3+ consecutive correct + stability ≥5d | **2+ consecutive correct + stability ≥5d** (reduced from 3) |
| 3 | 4+ consecutive correct + stability ≥10d + trial | **3+ consecutive correct + stability ≥10d + trial** (reduced from 4) |

### D25 — Onboarding Redesign

**Run 1 flow:**
- **Turns 1-2:** Only Quick Play available (Charge button hidden). Tutorial tooltips: "Tap a card to inspect. Tap again to play."
- **Turn 2 (first Surge):** Surge triggers. Tutorial: "KNOWLEDGE SURGE! Tap CHARGE to answer for 3× power!" One guided Charge tutorial. Player sees the power difference.
- **Turns 3+:** Both Quick Play and Charge available. Tooltip: "Drag up or tap CHARGE for bonus power, or tap to Quick Play."
- **First chain opportunity:** When 2+ hand cards share categoryL2, tooltip: "Matching cards! Play them in sequence for a chain bonus."
- **Act 1 mini-boss:** No forced Charging, but HP tuned so pure Quick Play barely wins.

**Run 2:** Study mode selector unlocks. No other gating.
**Run 3+:** Full system available. No further tutorials.

No forced Story Mode. No archetype selection. No artificial gating beyond Run 1 tutorial overlays.

### D26 — Fact Discovery System ("Free First Charge")

> **v2 Revision (2026-03-17):** Original overlay + cardHint design scrapped. Replaced with "Free First Charge" — see rationale below.

**Decision:** The first time a player Charges any fact in a run, the Charge is FREE: 0 AP surcharge, wrong answer = 1.0× (same as Quick Play, no penalty), correct answer = full Charge multiplier. The CHARGE button displays "FREE" instead of "+1 AP" when a free Charge is available. After the free Charge is used, the fact behaves normally for the rest of the run (+1 AP surcharge, 0.7× on wrong). Tracked via `firstChargeFreeFactIds: Set<string>` in RunState.

**Rationale:** The original design (discovery overlay + `cardHint` hints on cards) was rejected because it created **card avoidance behavior**. Players would see cards without hint text and rationally avoid Charging them ("no hint = unknown = risky"). This worked directly against the educational goal of encouraging exploration. The Free First Charge design removes all per-card visual states. The only signal is the CHARGE button label — the natural action point — which is non-stigmatizing. Players have zero downside to free-Charging every new fact, which maximizes exploration and learning.

**Key rules:**
- Free Charge applies to every fact once per run, regardless of FSRS tier
- AP surcharge = 0 on free Charge (base card AP cost unchanged)
- Wrong answer on free Charge = 1.0× (not 0.7×) — identical to Quick Play outcome
- Correct answer on free Charge = full tier Charge multiplier (2.5×/3.0×/3.5×)
- `firstChargeFreeFactIds: Set<string>` in RunState — resets on new run, NOT between encounters
- Tier 3 auto-Charge does NOT consume free Charge (player made no choice)
- No cardHint, no discovery overlay, no card-level visual states — only the CHARGE button label changes

**Run arc:** Act 1 = most CHARGE buttons say "FREE" → explore freely. Act 2 = mix of "FREE" and "+1 AP" → selectively Charge known facts. Act 3 = mostly "+1 AP" → veteran players Charge with confidence.

**Removed from original design:** cardHint field, discovery overlay, amber/golden card glows, "MASTERED" label, cardHint content pipeline, onboarding tooltips about discovery.

**Implementation:** See `docs/roadmap/phases/AR-59.23-FACT-DISCOVERY-SYSTEM.md`

---

## Category A: Core Combat Overhaul

### AR-59.1 — Quick Play / Charge Play System

**Goal:** Replace quiz-on-every-card-play with a two-mode system. Tapping a card plays it instantly at base power. Flinging it upward triggers a quiz with a big multiplier reward but AP surcharge.

**Change type:** MODIFY (core combat loop)

#### Key Changes

| Item | Current State | Target State |
|------|--------------|--------------|
| Card play trigger | Tap → quiz → resolve | Tap popped card → instant 1.0× (no quiz) |
| Quiz opt-in | Always required | Charge gesture only (see AR-59.2) |
| Charge cost | N/A | +1 AP surcharge on top of card's base cost |
| Charge correct | N/A | 3.0× (Tier 2a default) |
| Charge wrong | 20% fizzle (0.2× on wrong) | 0.7× — plays weaker but still resolves |
| Speed bonus | +50% on fast answer | REMOVE — replaced by relic-based speed bonuses |
| Partial fizzle | 20% effect on wrong | REMOVE — replaced by Charge wrong = 0.7× |

**Tier-Based Charge Scaling:**

| Tier | Display Name | Quick Play | Charge Correct | Charge Wrong | Charge AP Cost |
|------|-------------|------------|----------------|--------------|----------------|
| 1 | Learning | 1.0× | 2.5× | 0.6× | +1 AP |
| 2a | Proven | 1.0× | 3.0× | 0.7× | +1 AP |
| 2b | Proven+ | 1.0× | 3.5× | 0.7× | +1 AP |
| 3 | Mastered | 1.2× always | Auto-Charged, no quiz | N/A | +0 AP (free) |

**Design note:** Tier 3 cards never ask for a quiz — they auto-resolve at 1.2× with no AP surcharge. This is the PAYOFF for genuine mastery. Players feel their learning become power.

**0-AP cards:** A 0-AP card costs 1 AP to Charge (the quiz IS the AP cost). Quicken and Foresight at 0-AP stay "free quiz cards."

**AP display:** Card info overlay must show "+1 AP" surcharge indicator when Charge threshold reached. Surge turn shows "+0 AP."

#### Files Affected

| File | Change |
|------|--------|
| `src/services/turnManager.ts` | MODIFY: add `chargeMode`, AP surcharge logic, Tier-based multiplier lookup |
| `src/services/cardEffectResolver.ts` | MODIFY: accept `playMode: 'quick' \| 'charge'`, apply multiplier before effect resolution |
| `src/services/gameFlowController.ts` | MODIFY: remove quiz-gating from default card play path; add Charge flow |
| `src/ui/components/CardCombatOverlay.svelte` | MODIFY: AP display, Charge cost indicator, remove fizzle toast |
| `src/ui/components/CardHand.svelte` | MODIFY: tap-popped = Quick Play, gesture = Charge (see AR-59.2) |
| `src/data/balance.ts` | MODIFY: add `CHARGE_MULTIPLIERS`, `CHARGE_WRONG_MULTIPLIERS`, remove speed bonus table |
| `src/data/mechanics.ts` | MODIFY: remove `fizzleChance`, add Quick Play / Charge value columns |

#### Dependencies
- None — this is the root dependency for most other sub-ARs.

#### Acceptance Criteria
- [ ] Tapping a popped card plays it immediately at 1.0× with no quiz
- [ ] Charge gesture (see AR-59.2) triggers quiz, costs +1 AP, resolves at correct multiplier for fact's tier
- [ ] Tier 3 cards auto-resolve at 1.2× with no quiz prompt and no AP surcharge
- [ ] Wrong Charge answer resolves at 0.7× (not 20%)
- [ ] Speed bonus is fully removed — `balance.ts` has no `SPEED_BONUS` constant
- [ ] Partial fizzle is fully removed — `balance.ts` has no `FIZZLE_CHANCE` constant
- [ ] `npx vitest run` passes (update all affected tests)
- [ ] `npm run typecheck` passes

---

### AR-59.2 — Charge Gesture UX (Fling-Up)

**Goal:** Add a floating "CHARGE!" button as the primary discoverable Charge trigger, plus a fling-up gesture as a power-user shortcut. Tap popped card = Quick Play remains unchanged.

**Change type:** MODIFY (input handling in CardHand.svelte; add CHARGE button to CardCombatOverlay)

#### Interaction Specification

**Two ways to Charge (both equivalent):**

1. **CHARGE! Button (primary, discoverable):**
   - When a card is popped/inspected (first tap), a floating "CHARGE!" button appears above the card
   - Tapping the button = Charge Play (quiz triggers, +1 AP surcharge)
   - Button is golden/amber, prominent, clearly labeled
   - Button hidden during Surge turns where Charge is free? No — still shown, but cost indicator changes to "+0 AP"

2. **Fling/Drag Up (power-user shortcut):**
   | Drag Distance | State | Visual |
   |--------------|-------|--------|
   | 0–40px drag | Inspect | Card follows finger. Info overlay appears. |
   | 40–80px drag | Charging | Golden glow builds. "CHARGE" text fades in. Card scales to 1.15×. |
   | 80px+ drag | Ready to Charge | Green "ready" glow pulses. Release here → quiz triggers. |
   | Release < 40px | Cancel | Card returns to hand position. No action. |

**Quick Play flow (unchanged):**
- Tap card → card pops up with info overlay
- Tap popped card again → Quick Play (instant 1.0×, no quiz)

**Desktop:** Same interactions — CHARGE button clickable, mouse drag-up for fling gesture.

**Why not hold-to-charge:** Conflicts with tap-to-inspect. Accidental charges would feel punishing. The fling is deliberate and satisfying ("pull back the slingshot"), impossible to trigger accidentally.

#### Files Affected

| File | Change |
|------|--------|
| `src/ui/components/CardHand.svelte` | MODIFY: full gesture handler rewrite — touch/pointer events, threshold tracking, cancel logic |
| `src/ui/components/CardCombatOverlay.svelte` | MODIFY: "CHARGE" text overlay, golden glow CSS states, "+1 AP" cost badge at 40px threshold |

#### Dependencies
- AR-59.1 (must know what Quick Play vs Charge do before wiring gestures)

#### Acceptance Criteria
- [ ] Tap (no drag) on a popped card triggers Quick Play with no quiz
- [ ] "CHARGE!" button appears above popped/inspected card
- [ ] Tapping CHARGE button triggers quiz with +1 AP surcharge
- [ ] CHARGE button shows "+1 AP" cost (or "+0 AP" during Surge)
- [ ] Both button and fling gesture produce identical Charge behavior
- [ ] Dragging 0–40px shows card following finger with info overlay
- [ ] Dragging 40–80px shows golden glow + "CHARGE" text + 1.15× card scale
- [ ] Dragging 80px+ shows pulsing green glow; release triggers quiz
- [ ] Releasing below 40px returns card to hand with no action
- [ ] Desktop mouse drag-up works identically; CHARGE button is clickable
- [ ] No accidental Charge on normal taps (test with rapid taps)
- [ ] `npm run typecheck` passes

---

### AR-59.3 — Knowledge Chain System

**Goal:** Reward consecutive same-`categoryL2` cards played in a single turn with escalating damage multipliers. The visual system must communicate chain state without cluttering the hand.

**Change type:** ADD (new system) + MODIFY (card resolution, hand display)

#### Chain Multiplier Table

| Chain Length | Multiplier | Visual |
|-------------|-----------|--------|
| 1 (no chain) | 1.0× | Normal |
| 2-chain | 1.3× | Subtle glow, thin connecting line |
| 3-chain | 1.7× | Bright glow, particle trail, chain sound |
| 4-chain | 2.2× | Screen edge pulse, chain lightning VFX |
| 5-chain | 3.0× | Full celebration, screen shake, "KNOWLEDGE CHAIN!" text |

**Stacking:** Chain multiplier is multiplicative with Charge multiplier. Example: 3-chain Charged correct = 1.7× × 3.0× = 5.1× per card.

**Reset condition:** Chain resets at start of each new turn OR when a card with a different `categoryL2` is played.

**Fact assignment stays random:** Card mechanics (Strike, Block, etc.) are randomly paired with facts each draw. Same card mechanic may have different `categoryL2` in each encounter. Players must read their hand each turn.

**Run Pool categoryL2 Concentration (D6):** The run pool builder must select **5-8 active categoryL2 groups** for the run. With all ~50 values spread uniformly, chain probability is too low (~18% for a 2-chain in a 5-card hand). With 5-8 active groups, 2-chain probability rises to ~70-80%, 3-chain to ~20-30%. This is consistent with existing domain selection logic — just ensure the pool concentrates on a handful of categoryL2 values. Tag Magnet relic and Swift Boots further improve odds. Base chain probability must be viable WITHOUT relics.

**Vocabulary secondary chain groups:** Vocabulary facts can chain on their semantic bin (`food`, `family`, `verbs`, etc.) as a secondary group. Two Japanese words both tagged `food` chain together even if one is N5 and one is N4. This reuses existing semantic bin data — no new generation required. (RESEARCH ITEM: confirm semantic bin field exists and is populated — see Research section.)

#### Chain Color Mapping

12 distinct colors assigned to `categoryL2` value buckets (approximately 4–5 `categoryL2` values per color). Exact mapping TBD during implementation — colors should be visually distinct at small size (2–3px frame edge).

| Color | Example categoryL2 values |
|-------|--------------------------|
| Red | `asia_oceania`, related |
| Orange | `europe`, related |
| Yellow | `americas`, related |
| Green | `science_biology`, related |
| Teal | `science_chemistry`, related |
| Cyan | `science_physics`, related |
| Blue | `planets_moons`, related |
| Purple | `japanese_n5`, `japanese_n4`, related |
| Pink | `vocabulary_food`, `vocabulary_family`, related |
| Gold | `history_ancient`, related |
| White | `mathematics`, related |
| Gray | default / uncategorized |

#### Files Affected

| File | Change |
|------|--------|
| `src/services/NEW chainSystem.ts` | ADD: chain state tracking, `categoryL2` → color mapping, multiplier lookup |
| `src/services/cardEffectResolver.ts` | MODIFY: read current chain length before effect calc, pass to multiplier |
| `src/ui/components/CardHand.svelte` | MODIFY: render chain color tint on left frame edge; pulse animation for matching cards |
| `src/data/balance.ts` | MODIFY: add `CHAIN_MULTIPLIERS` constant array |

#### Dependencies
- AR-59.1 (chain multiplier stacks with Charge multiplier, both must be in effect at same time)

#### Acceptance Criteria
- [ ] Playing 2 consecutive same-`categoryL2` cards in one turn applies 1.3× to second card
- [ ] 3-chain applies 1.7×, 4-chain 2.2×, 5-chain 3.0×
- [ ] Chain counter resets at turn start
- [ ] Playing a different `categoryL2` card breaks the chain (counter resets)
- [ ] Chain multiplier stacks multiplicatively with Charge multiplier
- [ ] Cards in hand show 2–3px colored tint on left frame edge matching their `categoryL2`
- [ ] When 2+ cards share `categoryL2`, their tints pulse in sync
- [ ] Chain play shows brief glowing line connecting resolved cards
- [ ] `npx vitest run` passes (unit tests for chain multiplier calc)
- [ ] `npm run typecheck` passes

---

### AR-59.4 — Knowledge Surge (Every 3rd Turn)

**Goal:** Every 3rd player turn is a Surge turn where Charge costs +0 AP instead of +1. This creates combat rhythm (Normal → Normal → SURGE) and predictable burst windows.

**Change type:** ADD (new system) + MODIFY (turn counter, AP display)

#### Surge Timing
- **First Surge on turn 2** (not turn 3). Then every 3 turns after: turns 2, 5, 8, 11, 14...
- This ensures short fights (3-4 turns) see at least one Surge
- Improves onboarding — new players see Surge on their second turn
- Surge status resets if combat ends (new encounter starts at turn 1)
- Surge is purely AP-cost based — multipliers (3.0×, 0.7×) do not change during Surge

#### Surge Announcement Sequence

| Phase | Duration | Effect |
|-------|----------|--------|
| Flash | 0.15s | Screen edges pulse warm golden/amber once |
| Label | 0.3s | AP counter briefly shows "SURGE" text |
| Sound | 0.3s | Low bass thrum (power-up hum, not explosion) |
| Persist | Full turn | Cards glow golden; AP shows lightning bolt icon; gold particle overlay |

#### During Surge Turn

- Fling-up Charge threshold slightly reduced (easier to trigger, encourages Charging)
- AP counter shows lightning bolt icon in place of the number
- Background: subtle gold particle overlay (uses existing ambient particle system, recolored gold)
- Charge cost shows "0" (not "+1") in card info overlay and AP display
- Cards have persistent golden shimmer edge

#### Surge End

- Golden glow fades smoothly (0.3s)
- Normal card colors return
- Brief dim pulse signals end of Surge

#### Relation to Knowledge Combo System

Surge REPLACES the Knowledge Combo system. The Combo multiplier (up to 2.0×) is removed entirely. Surge is a fixed-rhythm burst window, not a streak-based escalation.

#### Files Affected

| File | Change |
|------|--------|
| `src/services/turnManager.ts` | MODIFY: add `turnCounter`, `isSurgeTurn()`, reset on combat end |
| `src/ui/components/CardCombatOverlay.svelte` | MODIFY: Surge announcement sequence, golden card glow, lightning bolt AP icon |
| `src/data/balance.ts` | MODIFY: add `SURGE_FREQUENCY = 3`, remove `COMBO_MULTIPLIER` table |
| `src/services/NEW surgeSystem.ts` | ADD: Surge state, announcement trigger, visual state management |

#### Dependencies
- AR-59.1 (Surge modifies Charge AP cost — must know how Charge AP cost works)

#### Acceptance Criteria
- [ ] Every 3rd turn is flagged as a Surge turn by `turnManager`
- [ ] During Surge, Charge costs 0 AP (no surcharge)
- [ ] Surge announcement: 0.5s total, golden edge flash, "SURGE" AP text, bass thrum
- [ ] Cards display golden shimmer during Surge turn
- [ ] AP counter shows lightning bolt icon during Surge
- [ ] Charge cost overlay shows "0" (not "+1") during Surge
- [ ] Surge ends cleanly — golden glow fades 0.3s, normal colors return
- [ ] Turn counter resets on new encounter
- [ ] Knowledge Combo system constants removed from `balance.ts`
- [ ] `npx vitest run` passes
- [ ] `npm run typecheck` passes

---

## Category B: Run Structure Overhaul

### AR-59.5 — 3-Act Run Structure

**Goal:** Compress the run from 4 regions × 6 floors (24 floors) to 3 acts × 7-8 nodes (~16-18 rooms). Target: ~25 min run.

**Change type:** MODIFY (map generation, region definitions, floor progression)

#### New Run Structure

| Act | Name | Floors | Node Budget | Key Features |
|-----|------|--------|-------------|-------------|
| 1 | The Shallows | 1–4 | 7–8 nodes | Deck building, learn combat |
| 2 | The Depths | 5–8 | 7–8 nodes | Synergy testing, first elite |
| 3 | The Archive | 9–12 | 7–8 nodes | Build payoff, final boss |

#### Act 1 Node Distribution (The Shallows)

| Node Type | Count | Notes |
|-----------|-------|-------|
| Combat (weak) | 3–4 | Card rewards, deck building |
| Mystery Room | 0–1 | Random events, bonus content |
| Shop | 0–1 | Early purchases, card removal |
| Mini-Boss | 1 | Act gate; relic choice 1-of-3 |

#### Act 2 Node Distribution (The Depths)

| Node Type | Count | Notes |
|-----------|-------|-------|
| Combat (medium) | 3–4 | Harder enemies, synergy testing |
| Elite | 1 | Guaranteed relic drop; quiz-forcing enemy |
| Rest Site | 1 | Rest / Study / Meditate |
| Shop or Mystery | 0–1 | Optional |
| Boss | 1 | Act gate; quiz phase at 50% HP |

#### Act 3 Node Distribution (The Archive)

| Node Type | Count | Notes |
|-----------|-------|-------|
| Combat (hard) | 3–4 | Build-or-die encounters |
| Elite | 1 | Final relic opportunity |
| Rest Site | 1 | Last heal/upgrade chance |
| Shop | 0–1 | Final purchases |
| Final Boss | 1 | Act gate; 2 quiz phases at 66% and 33% |

#### Run Metrics

| Metric | v1 | v2 |
|--------|----|----|
| Total rooms | ~24 | ~16–18 |
| Boss/mini-boss fights | 4 (1 per region) | 2–3 |
| Shops | 2–3 | 1–2 |
| Rest sites | 2–3 | 1–2 |
| Estimated run time | 40–60 min | 25–30 min |
| Quizzes per run | 150+ | 45–70 |

**Endless mode:** Remove from v2 scope. Mark as future feature. Do not implement as part of this AR.

**Retreat-or-delve checkpoints:** CUT (D12). A 25-minute run does not need mid-run exit points. Save/resume handles mid-session quits.

#### Files Affected

| File | Change |
|------|--------|
| Map generation code (identify during implementation) | MODIFY: reduce from 4-region × 6-floor to 3-act × 7-8-node |
| Region/act definition files | MODIFY: 4 regions → 3 acts with new names/enemy pools |
| `src/data/balance.ts` | MODIFY: act/floor constants |
| Dungeon map UI screen | MODIFY: display 3 acts, not 4 regions |

#### Dependencies
- AR-59.1 (combat must be playable in shorter sessions)

#### Acceptance Criteria
- [ ] New run generates exactly 3 acts
- [ ] Each act generates 7–8 nodes on a branching path
- [ ] Node type distribution matches tables above (with ±1 tolerance for randomness)
- [ ] Mini-boss always appears at Act 1 end; bosses at Act 2 and Act 3 ends
- [ ] Endless mode option is removed or hidden from UI
- [ ] Run completes in ~25-30 min on median player pace (verify with playtest timer)
- [ ] `npm run typecheck` passes

---

### AR-59.6 — Starter Deck Simplification

**Goal:** Replace ~15-card typed starter deck (with archetype selection) with a fixed 10-card deck. Remove archetype selection screen entirely.

**Change type:** MODIFY (starter deck definition) + REMOVE (archetype selection UI)

#### New Starter Deck

| Card | Count | AP | Effect |
|------|-------|----|--------|
| Strike | 5 | 1 | 8 damage |
| Block | 4 | 1 | 6 shield |
| Surge | 1 | 0 | Draw 2 cards |

**Design rationale:**
- 10 cards cycles every 2 turns (draw 5 per turn) — each reward card is a 10% deck change, immediately impactful
- All interesting mechanics come from rewards only — starter is deliberately functional-but-boring
- Single Surge card teaches utility cards exist; Charging it (1 AP) for draw 3 introduces the Charge value proposition naturally
- No archetype selection — interesting builds emerge via relic choices during the run (see AR-59.11)

#### Files Affected

| File | Change |
|------|--------|
| `src/services/encounterBridge.ts` (or equivalent starter deck builder) | MODIFY: hard-code 10-card starter |
| `src/data/balance.ts` | MODIFY: `STARTER_DECK` constant |
| Archetype selection UI component(s) | REMOVE: hide or archive the archetype selection screen |

#### Dependencies
- None — this is a standalone simplification.

#### Acceptance Criteria
- [ ] New run always starts with exactly 5 Strike + 4 Block + 1 Surge
- [ ] No archetype selection screen shown at run start
- [ ] Deck viewer shows 10 cards
- [ ] `npm run typecheck` passes

---

### AR-59.7 — Boss Quiz Phases

**Goal:** At specific HP thresholds, combat pauses and enters a rapid-fire quiz phase. Correct answers damage the boss; wrong answers buff it.

**Change type:** ADD (new boss phase system)

#### Boss Quiz Phase Triggers

| Boss | Phase | Trigger HP | Question Count | Timer |
|------|-------|-----------|----------------|-------|
| The Archivist (Act 2) | Phase 1 | 50% HP | 5 questions | Standard |
| The Curator (Act 3) | Phase 1 | 66% HP | 5 questions | Standard |
| The Curator (Act 3) | Phase 2 | 33% HP | 8 questions | 4 seconds each (RAPID FIRE) |

#### Phase Outcomes Per Question

| Result | Effect |
|--------|--------|
| Correct (Archivist/Curator P1) | Boss loses 10% remaining HP + player gains buff |
| Wrong (Archivist/Curator P1) | Boss gains +3 Strength |
| Correct (Curator P2 — Rapid Fire) | 5 direct damage to boss |
| Wrong (Curator P2 — Rapid Fire) | Boss heals 5 HP |

#### UX Flow

1. Boss HP crosses threshold
2. Combat pauses. Screen dims slightly. Boss visually "pulls back."
3. "QUIZ PHASE" text flashes center screen with dramatic sound cue
4. Cards disappear. Questions appear rapid-fire in center screen.
5. After all questions: results summary flash (X correct / Y total)
6. Boss reacts (damaged/empowered based on results)
7. Combat resumes with cards returning to hand

#### Files Affected

| File | Change |
|------|--------|
| `src/services/NEW bossQuizPhase.ts` | ADD: phase trigger detection, question queue, outcome resolution |
| `src/services/turnManager.ts` | MODIFY: check for boss phase triggers on damage; pause turn |
| Enemy definitions for The Archivist and The Curator | ADD: `quizPhaseThresholds`, `quizPhaseQuestionCount` |
| Combat scene / CombatScene.ts | MODIFY: handle phase pause/resume, card hide/show |

#### Dependencies
- AR-59.5 (acts must exist for The Archivist and The Curator to be in them)
- AR-59.13 (boss enemies must be defined)

#### Research needed: Boss Quiz Phase UX — see Research Items section.

#### Acceptance Criteria
- [ ] The Archivist triggers quiz phase at exactly 50% HP
- [ ] The Curator triggers phases at 66% and 33% HP
- [ ] During phase: cards are hidden, questions appear center screen
- [ ] Correct answers in Archivist phase: boss HP reduced, player buffed
- [ ] Wrong answers in Archivist phase: boss gains +3 Strength
- [ ] Curator P2 is Rapid Fire: 4-second timer, correct = 5 dmg, wrong = boss heals 5
- [ ] Results summary shown after phase
- [ ] Combat resumes correctly after phase ends
- [ ] `npm run typecheck` passes

---

## Category C: Card Mechanics Overhaul

### AR-59.8 — Card Mechanics Rebalance for Quick Play/Charge

**Goal:** Define explicit Quick Play, Charged Correct, and Charged Wrong values for all 25 Phase 1 mechanics. Buff/debuff Charging gives qualitatively different effects (not just bigger numbers).

**Change type:** MODIFY (all 25 mechanics in `mechanics.ts` and `balance.ts`)

#### Complete Mechanics Table

| Card | Type | AP | Quick Play (1.0×) | Charged Correct (3.0×) | Charged Wrong (0.7×) | Special Charge Notes |
|------|------|----|-------------------|------------------------|----------------------|---------------------|
| Strike | Attack | 1 | 8 dmg | 24 dmg | 5.6 dmg | — |
| Multi-Hit | Attack | 2 | 4×3 (12 total) | 12×3 (36 total) | 2.8×3 (8.4 total) | — |
| Heavy Strike | Attack | 3 | 20 dmg | 60 dmg | 14 dmg | Charge costs 4 AP total |
| Piercing | Attack | 1 | 6 dmg (ignores block) | 18 dmg | 4.2 dmg | — |
| Reckless | Attack | 1 | 12 dmg, 3 self-dmg | 36 dmg, 3 self-dmg | 8.4 dmg, 3 self-dmg | Self-damage stays flat |
| Execute | Attack | 1 | 6 (+8 if target <30% HP) | 18 (+24 if <30%) | 4.2 (+5.6 if <30%) | 42 dmg Charged vs low HP |
| Lifetap | Attack | 2 | 8 dmg, heal 20% | 24 dmg, heal 20% | 5.6 dmg, heal 20% | Heal % stays flat |
| Block | Shield | 1 | 6 block | 18 block | 4.2 block | — |
| Thorns | Shield | 1 | 6 block, 3 reflect | 18 block, 9 reflect | 4.2 block, 2.1 reflect | Reflect scales with Charge |
| Emergency | Shield | 1 | 4 (8 if <30% HP) | 12 (24 if <30%) | 2.8 (5.6 if <30%) | HP threshold check flat |
| Fortify | Shield | 2 | 7 persistent block | 21 persistent block | 4.9 persistent block | Carries between turns |
| Brace | Shield | 1 | Block = enemy intent | Block = 3× enemy intent | Block = 0.7× enemy intent | Scales off enemy dmg |
| Overheal | Shield | 2 | 10 (2× if <50% HP) | 30 (2× if <50%) | 7 (2× if <50%) | HP threshold check flat |
| Quicken | Buff | 0 | +1 AP this turn | +1 AP + draw 1 card | +1 AP (no draw) | Charge costs 1 AP total |
| Empower | Buff | 1 | Next card +50% | Next card +75% | Next card +35% | Charge bonus qualitative |
| Focus | Buff | 1 | Next card -1 AP | Next 2 cards -1 AP | Next card -1 AP | Charged = 2 discounts |
| Double Strike | Buff | 2 | Next attack hits 2× | Next attack 2× + Pierce | Next attack hits 1× | Charged adds Pierce quality |
| Weaken | Debuff | 1 | -25% enemy dmg, 2t | -40% enemy dmg, 3t | -20% enemy dmg, 1t | — |
| Expose | Debuff | 1 | +50% dmg taken, 1t | +75% dmg taken, 2t | +35% dmg taken, 1t | — |
| Hex | Debuff | 1 | 3 poison, 3t (9 total) | 8 poison, 3t (24 total) | 2 poison, 3t (6 total) | — |
| Slow | Debuff | 2 | Skip enemy action | Skip + Weaken 1t | Skip (no Weaken) | Charged = qualitative extra |
| Scout | Utility | 1 | Draw 2 cards | Draw 3 cards | Draw 1 card | — |
| Foresight | Utility | 0 | Draw 2 cards | Draw 3 + see next intent | Draw 1 card | Charge costs 1 AP total |
| Recycle | Utility | 1 | Draw 3 cards | Draw 4 + 1 from discard | Draw 2 cards | — |
| Mirror | Wild | 1 | Copy last card effect | Copy at 1.3× power | Copy at 0.7× power | Mirrors the chain too |
| Adapt | Wild | 1 | Auto-pick best effect | Auto at 1.5× power | Auto at 0.7× power | — |

**Key balance principles:**
1. Wrong answers always give SOMETHING (0.7×) — never a total waste, but always worse than Quick Play (1.0×)
2. Buff/debuff Charging gives qualitatively different bonus effects, not just bigger numbers (see Focus: 1 discount → 2 discounts; Double Strike: adds Pierce)
3. 0-AP cards (Quicken, Foresight) cost 1 AP to Charge — the quiz IS the AP cost

#### Files Affected

| File | Change |
|------|--------|
| `src/data/mechanics.ts` | MODIFY: add `quickPlayValue`, `chargeCorrectValue`, `chargeWrongValue` (or equivalent) for all 25 mechanics |
| `src/data/balance.ts` | MODIFY: update all numeric constants to match table above |
| `src/services/cardEffectResolver.ts` | MODIFY: read play mode and apply correct values from mechanics table |
| `src/services/cardDescriptionService.ts` | MODIFY: display QP / Charged descriptions in card tooltip |

#### Dependencies
- AR-59.1 (play mode must exist before per-mode values make sense)

#### Acceptance Criteria
- [ ] All 25 mechanics have explicit Quick Play, Charge Correct, and Charge Wrong values defined
- [ ] Buff/debuff cards give qualitatively different Charged bonuses (not just scaled numbers)
- [ ] 0-AP cards Charge for 1 AP total
- [ ] Card tooltip clearly shows QP and Charged values
- [ ] `npx vitest run` passes (update cardEffectResolver tests)
- [ ] `npm run typecheck` passes

---

### AR-59.9 — Remove/Archive Unused Mechanics

**Goal:** v2 has exactly 25 mechanics. Current codebase has 31. Identify and archive the 6 removed mechanics without deleting them.

**Change type:** REMOVE (archive 6 mechanics)

#### Mechanic Audit

Current 31 mechanics from v1 (all must be audited against the 25 in AR-59.8):

**Mechanics NOT present in v2 spec (candidates for archival):** Parry, Cleanse, Transmute, Immunity, Overclock, and at least one other. Exact list requires cross-referencing `mechanics.ts` against the 25-mechanic table in AR-59.8.

**Process:**
1. List all mechanics currently in `mechanics.ts`
2. Cross-reference against the 25 in AR-59.8 table
3. For each mechanic NOT in v2: add `archived: true` flag and comment `// ARCHIVED: AR-59.9 — not in v2 mechanic set`
4. Remove archived mechanics from card reward pools
5. Archived mechanics remain in the file (not deleted) — they may return in future phases

#### Files Affected

| File | Change |
|------|--------|
| `src/data/mechanics.ts` | MODIFY: flag 6 mechanics as `archived: true` |
| Card pool / reward generation files | MODIFY: filter out `archived: true` mechanics from reward draws |
| `src/data/balance.ts` | MODIFY: remove any constants unique to archived mechanics |

#### Dependencies
- AR-59.8 (must know the final 25-mechanic list before archiving)

#### Acceptance Criteria
- [ ] Exactly 25 mechanics are active (non-archived) in the codebase
- [ ] 6 archived mechanics have `archived: true` flag and explanatory comment
- [ ] Archived mechanics never appear in card rewards
- [ ] All active mechanics have QP/Charge values defined (see AR-59.8)
- [ ] `npx vitest run` passes
- [ ] `npm run typecheck` passes

---

## Category D: Relic System Overhaul

### AR-59.10 — 5-Slot Relic System

**Goal:** Cap active relics at 5 slots. When at capacity, acquiring a new relic requires selling one to make room (or passing). Remove the unlimited collection model.

**Change type:** MODIFY (relic system core) + REMOVE (Mastery Coin economy, Hub relic shop)

#### Slot Rules

- **5 active slots** per run (default)
- **Scholar's Gambit relic** expands to 6 slots (Cursed)
- **At 5/5:** New relic acquisition screen shows all 5 current relics + the new one. Player must sell one to make room OR pass on the new relic.
- **Selling** refunds partial gold value (exact refund % TBD — RESEARCH: see balance notes)

#### Systems to Modify

| System | Status | Notes |
|--------|--------|-------|
| Mastery Coins | KEEP (simplified) | Start with 25 relics unlocked (Commons + some Uncommons). Remaining ~17 (Rares + Legendaries) require Mastery Coin purchases from the Hub. Hub Anvil/Relic Archive persists for unlocking. |
| Hub relic shop / Relic Archive | KEEP | Hub still exists for Mastery Coin relic unlocks. |
| Relic synergy complexity | SIMPLIFY | v2 has simpler relic interactions than v1 |

**Relic Reroll:** At boss/mini-boss relic selection (pick 1 of 3), player can spend 50g to reroll all 3 options. Once per selection. Prevents build-bricking. Merchant's Favor relic gives 4 choices instead of 3.

#### Files Affected

| File | Change |
|------|--------|
| Relic state / relic collection store | MODIFY: add `activeRelics: Relic[]` (max 5), `replaceRelic()` action |
| `src/ui/components/RelicTray.svelte` | MODIFY: display max-5 slots visually; show empty slot indicators |
| Relic acquisition flow | MODIFY: show sell-or-pass UI when at capacity |
| Mastery Coin store / Hub relic shop | REMOVE |
| `src/data/balance.ts` | MODIFY: remove `MASTERY_COIN_*` constants; add `MAX_RELIC_SLOTS = 5` |

#### Dependencies
- None — this is a standalone structural change.

#### Acceptance Criteria
- [ ] Player can hold at most 5 relics (or 6 with Scholar's Gambit)
- [ ] Acquiring relic at 5/5 triggers sell-or-pass UI
- [ ] Selling a relic returns partial gold value
- [ ] `RelicTray.svelte` shows 5 slots with visual empty indicators
- [ ] Mastery Coins remain in game state; Hub relic shop kept for unlocking Rares/Legendaries
- [ ] 25 relics (Commons + some Uncommons) available from run 1 without Mastery Coins
- [ ] Relic reroll: spend 50g at boss/mini-boss selection to reroll all 3 options (once per selection)
- [ ] `npm run typecheck` passes

---

### AR-59.11 — v2 Relic Catalogue (42 Relics)

**Goal:** Replace the current 50-relic catalogue with v2's 42 relics. Build-arounds (~60%) and stat-sticks (~40%).

**Change type:** MODIFY (relic data files — merge, rewrite)

#### Relic Categories and Counts

| Category | Count | Type |
|----------|-------|------|
| Chain Relics | 4 | Build-around |
| Speed Relics | 3 | Build-around |
| Glass Cannon Relics | 3 | Build-around |
| Defense Relics | 4 | Build-around |
| Poison Relics | 3 | Build-around |
| Burst Relics | 3 | Build-around |
| Knowledge Relics | 4 | Build-around |
| Economy Relics | 4 | Utility |
| Stat Stick Relics | 8 | Stat-stick |
| Special / Cursed | 4 | Special |
| **Total** | **42** | — |

**Rarity distribution (regular drops):** Common 50%, Uncommon 30%, Rare 15%, Legendary 5%
**Rarity distribution (boss drops):** Common 20%, Uncommon 35%, Rare 30%, Legendary 15%

**Pity timer:** If no Uncommon+ relic offered in 4 consecutive drops → next drop is guaranteed Uncommon+.

#### Key Build-Around Relics (implement first)

These should be prioritized in Sprint 3 as they define run archetypes:

| Relic | Rarity | Category | Effect Summary |
|-------|--------|----------|----------------|
| Chain Reactor | Rare | Chain | 3+ chains deal 4 splash dmg per link |
| Quicksilver Quill | Rare | Speed | <2s correct Charge → additional 1.5× multiplier |
| Aegis Stone | Uncommon | Defense | Block carries between turns (max 25); at 25 → Thorns 3 |
| Capacitor | Rare | Burst | Unused AP stored; gained next turn (max 3) |
| Scholar's Crown | Rare | Knowledge | Tier 2+ Charged +30%; Tier 3 auto-Charged +50% |
| Double Down | Rare | Burst | Once/encounter: Charge same card twice; 2 correct = 5×, 1 = 1.5×, 0 = 0.3× |
| Volatile Core | Uncommon (Cursed) | Glass Cannon | +40% attack dmg; wrong Charge = 5 dmg to player AND enemy |

#### Files Affected

| File | Change |
|------|--------|
| `src/data/relics/starters.ts` | MODIFY or MERGE into single relics.ts |
| `src/data/relics/unlockable.ts` | MODIFY or MERGE into single relics.ts |
| `src/data/relics/NEW relics.ts` | ADD (or merge existing): all 42 relics with rarity, category, effect |
| `src/services/relicEffectResolver.ts` | MODIFY: implement all new relic effects |
| `src/data/balance.ts` | MODIFY: rarity weight constants, pity timer constants |

#### Dependencies
- AR-59.10 (5-slot system must exist)
- AR-59.1 (Charge system must exist — many relics reference Charged plays)
- AR-59.3 (Chain system must exist — Chain Reactor, Resonance Crystal, etc.)

#### Acceptance Criteria
- [ ] All 42 relics exist in data files with correct rarity, category, and effect
- [ ] Build-around relics (see key list above) are fully implemented in `relicEffectResolver.ts`
- [ ] Rarity drop weights match spec (50/30/15/5 regular; 20/35/30/15 boss)
- [ ] Pity timer: 4 consecutive no-Uncommon+ → next guaranteed Uncommon+
- [ ] Scholar's Gambit expands relic slots to 6
- [ ] `npx vitest run` passes (relic effect tests)
- [ ] `npm run typecheck` passes

---

### AR-59.12 — Relic Acquisition Flow (In-Run)

**Goal:** All relics come from in-run encounters only. Remove starter relic selection at run start. Define drop source rules.

**Change type:** REMOVE (starter relic selection) + MODIFY (encounter reward flow)

#### Relic Drop Sources

| Source | Acquisition | Rarity |
|--------|-------------|--------|
| Mini-boss kill | Choice of 1-of-3 | Regular weights |
| Elite kill | Guaranteed 1 drop | Regular weights |
| Boss kill | Choice of 1-of-3 | Boss weights (higher) |
| Regular combat | 10% chance drop | Regular weights |

#### Files Affected

| File | Change |
|------|--------|
| `src/ui/components/StarterRelicSelection.svelte` | REMOVE: archive this component |
| Encounter reward flow | MODIFY: add relic drop logic per source type |
| Run start flow | MODIFY: no relic offered at run start |
| `src/data/balance.ts` | MODIFY: add `REGULAR_COMBAT_RELIC_DROP_CHANCE = 0.10` |

#### Dependencies
- AR-59.10 (5-slot system)
- AR-59.11 (relic catalogue)
- AR-59.5 (run structure — mini-boss, elite, boss node types must exist)

#### Acceptance Criteria
- [ ] Run starts with 0 relics (no starter selection screen)
- [ ] Mini-boss kill presents 1-of-3 relic choice
- [ ] Elite kill drops 1 relic (guaranteed)
- [ ] Boss kill presents 1-of-3 with higher rarity weights
- [ ] Regular combat has 10% relic drop chance
- [ ] `StarterRelicSelection.svelte` is archived (not rendered)
- [ ] `npm run typecheck` passes

---

## Category E: Enemy & Encounter Overhaul

### AR-59.13 — v2 Enemy Roster

**Goal:** Replace 88-enemy roster with 12 focused enemies, each with quiz-integrated behaviors. Single-enemy encounters only.

**Change type:** MODIFY (enemy definitions) — existing enemies replaced or mapped to new ones

#### Complete Enemy Roster

**Act 1: The Shallows**

| Enemy | Type | HP | Damage | Special Mechanic |
|-------|------|-----|--------|-----------------|
| Cave Bat | Common | 19 | 8–11 | None. Pure intro, telegraphed attacks. |
| Crystal Golem | Common | 38 | 12 (every 2t) | Gains block on off-turns; can charge for 25 dmg spike |
| Toxic Spore | Common | 15 | 8 + poison | Low HP, DoT. Teaches burst-to-kill urgency. |
| Timer Wyrm | Mini-Boss | 45 | 12 | Enrages after turn 4: +5 dmg/turn permanently |

**Act 2: The Depths**

| Enemy | Type | HP | Damage | Special Mechanic |
|-------|------|-----|--------|-----------------|
| Shadow Mimic | Common | 30 | 8 | Copies wrong-Charged card's effect against you |
| The Examiner | Elite | 55 | 10 | Gains +3 Strength every turn you don't Charge ≥1 card |
| Bone Collector | Common | 35 | 10 | Heals 5 HP on each wrong Charge by player |
| The Archivist | Boss | 80 | 12 | Quiz Phase at 50% HP (see AR-59.7) |

**Act 3: The Archive**

| Enemy | Type | HP | Damage | Special Mechanic |
|-------|------|-----|--------|-----------------|
| The Scholar | Common | 40 | 6 | Heals 5 HP when player Charges correctly |
| The Nullifier | Elite | 70 | 14 | Negates all chain bonuses (chains form visually, give 1.0×) |
| The Librarian | Elite | 65 | 12 | Immune to Quick Play damage — only Charged attacks deal damage |
| The Curator | Final Boss | 120 | 15 | Quiz phases at 66% and 33% HP (see AR-59.7) |

**Single-enemy only:** No multi-enemy encounters at launch. Enemy variety comes from behavior, not quantity.

**Enemy sprite reuse:** Existing 88-enemy sprite assets should be audited for reuse. RESEARCH: see Research Items section.

#### Files Affected

| File | Change |
|------|--------|
| Enemy definition files | MODIFY: define 12 v2 enemies with HP, damage, special mechanics |
| `src/services/enemyManager.ts` (or equivalent) | MODIFY: act-based enemy pools, single-enemy encounter logic |
| Enemy sprite mappings | MODIFY: map 12 enemies to appropriate existing sprites or flag for new art |
| `src/data/balance.ts` | MODIFY: enemy HP/damage constants |

#### Dependencies
- AR-59.5 (run structure — enemies must be assigned to the correct act)
- AR-59.1 (enemy mechanics reference Charge system: Mimic, Examiner, Bone Collector, Librarian)

#### Acceptance Criteria
- [ ] All 12 enemies are defined with correct HP, damage, and special mechanics
- [ ] Special mechanics are implemented (Mimic copies wrong-Charged effect, Examiner gains Strength, etc.)
- [ ] Enemy pools are per-act: Act 1 gets Shallows enemies, Act 2 gets Depths, etc.
- [ ] The Librarian correctly reduces Quick Play damage to 0
- [ ] The Nullifier correctly zeros out chain multipliers
- [ ] No multi-enemy encounter nodes
- [ ] `npx vitest run` passes (enemy mechanic tests)
- [ ] `npm run typecheck` passes

---

## Category F: Rest Site & Shop Overhaul

### AR-59.14 — Rest Site: Three Choices

**Goal:** Replace current 2-choice rest site (Rest / Upgrade Card) with 3-choice (Rest / Study / Meditate).

**Change type:** MODIFY (rest site UI + logic) + ADD (Study flow, Meditate flow)

#### Three Choices

| Choice | Effect | Quiz? |
|--------|--------|-------|
| Rest | Heal 30% max HP | No |
| Study | 5 questions presented; each correct → player picks which of 3 deck cards to upgrade | 3–5 questions |
| Meditate | Remove 1 card from deck (deck thinning). Limited to 1 removal per rest site visit. | No |

#### Study Flow Details

**Study flow:** After each correct answer, show 3 cards from the deck → player picks which one to upgrade (same pick-1-of-3 flow as current upgrades). Wrong answers: no penalty, correct answer shown.

1. Player selects "Study"
2. 5 facts from deck's fact pool presented one at a time
3. Each correct answer: 3 deck cards shown → player picks one to upgrade with `isUpgraded: true` (boosted values, "+" suffix, blue glow border)
4. Wrong answers: no penalty, correct answer shown (learning moment)
5. After 5 questions (or early exit): return to map

**Upgrade priority:** Cards offered for upgrade sorted by tier (Tier 2b > 2a > 1). Higher-tier facts = better card improvements from Study.

#### Meditate Flow Details

**Meditate:** Remove 1 card from deck. Limited to 1 removal per rest site visit. Max 1 rest site per act = 2-3 free removals per run.

1. Player selects "Meditate"
2. Player's full deck shown — tap a card to select it for removal
3. Confirmation prompt ("Remove [Card Name] from your deck? This cannot be undone.")
4. Card is permanently removed from this run's deck
5. Cannot remove a second card at this rest site (Meditate option grays out after use)

#### Files Affected

| File | Change |
|------|--------|
| Rest site UI component | MODIFY: add third "Meditate" choice; rework Study to be quiz-based |
| Rest site game logic | MODIFY: implement Study question loop, Meditate card removal |
| `src/data/balance.ts` | MODIFY: `REST_HEAL_PERCENT = 0.30`, `STUDY_QUESTION_COUNT = 5` |

#### Dependencies
- AR-59.5 (rest sites are act nodes — must exist in run structure)

#### Acceptance Criteria
- [ ] Rest site shows exactly three choices: Rest, Study, Meditate
- [ ] Rest heals exactly 30% max HP
- [ ] Study: 5 questions; each correct shows 3 deck cards → player picks which to upgrade
- [ ] Study: wrong answers show correct answer but no penalty
- [ ] Study: upgrade offer shows cards sorted by tier (Tier 2b > 2a > Tier 1)
- [ ] Meditate: player selects card to remove; confirmation required; card gone from deck
- [ ] Meditate: limited to 1 removal per rest site visit (option grays out after first use)
- [ ] `npm run typecheck` passes

---

### AR-59.15 — Shop Haggling

**Goal:** Add optional quiz before each purchase for a 30% discount.

**Change type:** ADD (haggle button + quiz flow per purchase)

#### Haggling Rules

- Available before every card and relic purchase
- Player may choose to skip haggling and pay full price (no penalty)
- Haggle = answer 1 question:
  - Correct → 30% discount on that item
  - Wrong → pay full price (no further penalty)
- One haggle attempt per item per visit (cannot retry on same item)

#### Pricing Reference

| Item | Base Price | Haggled Price |
|------|-----------|---------------|
| Common card | 50g | 35g |
| Uncommon card | 80g | 56g |
| Rare card | 140g | 98g |
| Common relic | 100g | 70g |
| Uncommon relic | 160g | 112g |
| Rare relic | 250g | 175g |
| Card removal (1st) | 75g | 53g |
| Card removal (+n) | 75g + 25n | (75+25n) × 0.7 |

#### Files Affected

| File | Change |
|------|--------|
| Shop UI component | ADD: "Haggle" button on each item; quiz overlay flow |
| Shop logic / pricing | MODIFY: apply 0.70 discount multiplier on haggle success |
| `src/data/balance.ts` | MODIFY: add `SHOP_HAGGLE_DISCOUNT = 0.30`; update card/relic base prices to match above |

#### Dependencies
- None — shop system already exists.

#### Acceptance Criteria
- [ ] Each shop item has a "Haggle" button
- [ ] Haggling triggers a single quiz question
- [ ] Correct answer: item price reduced by 30%
- [ ] Wrong answer: full price shown, no other penalty
- [ ] Cannot haggle on same item twice in one shop visit
- [ ] Card removal price escalates correctly with haggle option
- [ ] `npm run typecheck` passes

---

## Category G: Visual & UX Overhaul

### AR-59.16 — Charge Play Animation System

**Goal:** Make Quick Play feel fast and Charge Play feel dramatic. The contrast between the two modes is the core UX feel of v2.

**Change type:** MODIFY (animation sequences in CardHand.svelte, CardCombatOverlay.svelte)

#### Animation Sequence: Charge Play

| Phase | Duration | Visual |
|-------|----------|--------|
| Fling up | 200ms | Card lifts with golden glow building |
| Quiz appears | 150ms | Panel slides in above hand; timer starts |
| Correct answer | 500ms | GREEN flash; power particles; screen shake; effect resolves at 3.0× |
| Wrong answer | 300ms | Brief red dim (not punishing); correct answer shown 1.5s in blue; card plays at 0.7× muted |

#### Animation Sequence: Quick Play

| Phase | Duration | Visual |
|-------|----------|--------|
| Tap | 200ms | Card taps, instant effect resolve, lightning fast |

**The contrast is the message:** Quick Play feels snappy and casual. Charge Play feels deliberate and dramatic. Players should viscerally understand the difference within the first encounter.

#### Files Affected

| File | Change |
|------|--------|
| `src/ui/components/CardHand.svelte` | MODIFY: Quick Play tap animation (200ms), Charge fling-up animation |
| `src/ui/components/CardCombatOverlay.svelte` | MODIFY: Charge correct flash, Charge wrong dim, correct-answer reveal |

#### Dependencies
- AR-59.1 (Quick Play and Charge must be functional)
- AR-59.2 (gesture UX must be in place)

#### Acceptance Criteria
- [ ] Quick Play resolves in ≤200ms from tap to effect — feels instant
- [ ] Charge fling animation shows golden glow building (200ms)
- [ ] Correct Charge: green flash + particles + screen shake
- [ ] Wrong Charge: brief red dim + correct answer shown 1.5s in blue
- [ ] Quick Play and Charge Play feel perceptually distinct in rhythm
- [ ] `npm run typecheck` passes

---

### AR-59.17 — Chain Visual System

**Goal:** Cards in hand show their `categoryL2` chain color as a 2–3px tint on left frame edge. Matching cards pulse in sync. Chain resolution shows connecting line.

**Change type:** ADD (chain color system) + MODIFY (card rendering in hand)

#### Visual Specification

- **Frame edge tint:** 2–3px colored tint on left edge of card (visible in fan overlap)
- **Pulse:** When 2+ cards in hand share `categoryL2`, their tinted edges pulse in sync (0.5s cycle)
- **Chain resolution:** Thin glowing line briefly connects played cards during resolution (animation only, not persistent)
- **12 colors:** See color mapping table in AR-59.3

#### Files Affected

| File | Change |
|------|--------|
| `src/ui/components/CardHand.svelte` | MODIFY: render left-edge tint per card's `categoryL2` color; sync pulse CSS animation |
| `src/services/NEW chainVisuals.ts` | ADD: `categoryL2` → color mapping, pulse sync logic |

#### Dependencies
- AR-59.3 (chain system must exist — colors map from same `categoryL2` values)

#### Acceptance Criteria
- [ ] Every card in hand has a 2–3px colored tint on its left frame edge
- [ ] Color is consistent per `categoryL2` across all cards
- [ ] When 2+ cards share `categoryL2`, their tints pulse in sync
- [ ] Chain resolution shows brief glowing connecting line between played cards
- [ ] Colors are visually distinct at card size (test on mobile resolution)
- [ ] `npm run typecheck` passes

---

### AR-59.18 — Surge Visual System

**Goal:** Surge turns are announced with a 0.5s golden flash sequence and sustained golden visual state through the turn.

**Change type:** MODIFY (CardCombatOverlay, CombatScene particle system)

#### Visual States

| State | Trigger | Duration | Visuals |
|-------|---------|----------|---------|
| Announce | Surge turn starts | 0.5s | Screen edge amber pulse, AP shows "SURGE", bass thrum |
| Active | Full Surge turn | Until turn end | Golden card shimmer, lightning bolt AP icon, gold particle overlay |
| Fade | Turn ends | 0.3s | Golden glow fades, dim pulse |

#### Files Affected

| File | Change |
|------|--------|
| `src/ui/components/CardCombatOverlay.svelte` | MODIFY: Surge announcement sequence, golden card glow state, lightning bolt AP icon |
| Phaser CombatScene | MODIFY: gold particle overlay during Surge (recolor existing ambient particles) |

#### Dependencies
- AR-59.4 (Surge system must be implemented — visuals are presentation layer of that system)

#### Acceptance Criteria
- [ ] Surge announcement: 0.5s total, amber screen edge pulse, "SURGE" AP text, bass thrum
- [ ] During Surge turn: cards have golden shimmer edge
- [ ] AP counter shows lightning bolt icon (not a number) during Surge
- [ ] Gold particle overlay visible on background during Surge
- [ ] Surge end: golden glow fades smoothly over 0.3s
- [ ] `npm run typecheck` passes

---

## Category H: Systems to Remove/Archive

### AR-59.19 — Remove/Archive Deprecated Systems

**Goal:** Clean out all v1 systems that have been replaced by v2 equivalents. Archive code (don't delete) where possible.

**Change type:** REMOVE (system-level removals) + ARCHIVE (move to `_archived/` or flag inline)

#### Removal Checklist

| System | Current Location | Action | Replaced By |
|--------|-----------------|--------|-------------|
| Knowledge Combo system | `turnManager.ts`, `balance.ts` | ARCHIVE | Knowledge Chain + Knowledge Surge |
| Speed bonus system | `balance.ts`, `cardEffectResolver.ts` | ARCHIVE | Quicksilver Quill relic |
| Archetype selection | UI screen, run start flow | ARCHIVE | Emergent builds via relics |
| Starter relic selection | `StarterRelicSelection.svelte` | ARCHIVE | In-run relic acquisition (AR-59.12) |
| Partial fizzle (20%) | `balance.ts`, `cardEffectResolver.ts` | DELETE (already replaced in AR-59.1) | Quick Play / Charge wrong 0.7× |
| Retreat-or-delve checkpoints | (identify location) | ARCHIVE | Not needed — 25-min runs, save/resume handles quits (D12) |

#### Systems to KEEP (do NOT archive)

| System | Action | Notes |
|--------|--------|-------|
| Canary System (adaptive difficulty) | KEEP — retune | Retune thresholds for lower quiz frequency |
| Learning Threshold Reward Gate | KEEP — retune | Adjust sample size minimums for lower quiz count |
| Bounty Quests | KEEP — reword | Reword to reference Charge system: "Charge 5 cards," "Complete a 4-chain" |
| Daily Expedition | KEEP unchanged | Critical for retention. Same seed, same scoring. |
| Lore Discovery | KEEP unchanged | Mastery milestones at 10/25/50/100 mastered facts |
| Ascension Mode | KEEP — scope limit | Launch with 10 levels (not 20). Each reuses content at higher difficulty. |
| wowFactor display | KEEP unchanged | Still fires on Tier 1 correct Charge answers |
| Tier-up celebrations | KEEP unchanged | Fires on correct Charge that advances a fact tier |
| Mastery Coins | KEEP — simplified | See D14. 25 relics free; ~17 Rares/Legendaries require coins. Hub remains. |
| Hub relic shop / Relic Archive | KEEP — for coin unlocks | See D14. Not removed; scoped to Mastery Coin unlocks only. |

**Archival approach:**
- Svelte components: remove from rendering; move source to `src/_archived-mining/` or `src/_archived-v1/`
- TypeScript constants in `balance.ts`: comment out with `// ARCHIVED: AR-59.19` prefix
- TypeScript logic blocks: wrap in `if (false) { // ARCHIVED: AR-59.19 ... }` or move to `_archived/`

#### Files Affected

| File | Change |
|------|--------|
| `src/services/turnManager.ts` | MODIFY: remove combo counter, combo multiplier logic |
| `src/data/balance.ts` | MODIFY: remove `COMBO_*`, `SPEED_BONUS_*`, `FIZZLE_CHANCE` constants; keep `MASTERY_COIN_*` |
| `src/services/cardEffectResolver.ts` | MODIFY: remove speed bonus calc, partial fizzle calc |
| `src/ui/components/StarterRelicSelection.svelte` | ARCHIVE |
| Archetype selection component(s) | ARCHIVE |
| Retreat-or-delve checkpoint UI/logic | ARCHIVE |

#### Dependencies
- AR-59.1–AR-59.4 must all be complete and passing before this cleanup runs (ensures replacements are live before removals)

#### Acceptance Criteria
- [ ] `balance.ts` has no `COMBO_MULTIPLIER`, `SPEED_BONUS`, or `FIZZLE_CHANCE` constants
- [ ] `MASTERY_COIN_*` constants remain in `balance.ts` (Mastery Coins kept per D14)
- [ ] No combo counter visible in game UI
- [ ] Archetype selection screen is not reachable in any game flow
- [ ] StarterRelicSelection is not rendered at run start
- [ ] Retreat-or-delve checkpoints are not present in any game flow
- [ ] Mastery Coin currency remains functional for Hub relic unlocks (not removed)
- [ ] Canary System, Learning Threshold, Bounty Quests, Daily Expedition, Lore Discovery NOT archived — their retuning tracked separately
- [ ] `npx vitest run` passes (remove/update tests that tested archived systems)
- [ ] `npm run typecheck` passes

---

## Category I: Echo Mechanic Update

### AR-59.20 — Echo Mechanic v2

**Goal:** Echo cards (created when wrong Charge answer is given) now force Charge-only play. The echo is a mandatory retry opportunity.

**Change type:** MODIFY (echo card behavior)

#### Echo v2 Rules

| Condition | Effect |
|-----------|--------|
| Echo card in hand | Translucent card, dashed purple border, chromatic aberration (keep existing visual) |
| Playing an Echo card | Can ONLY be played Charged (Quick Play is disabled on Echo cards) |
| Echo: Correct answer | Golden flash, resolves at normal Charge power, FSRS records double credit |
| Echo: Wrong answer | Discarded, 0.5× effect, FSRS records second miss |
| With Insight Prism relic | Echo auto-succeeds (no quiz required) |

**v1 behavior changed:**
- v1: Echo could be played Quick Play (not forced)
- v2: Echo ALWAYS forces Charge — it's a second chance to learn the fact

**Echo creation trigger:** Unchanged — 85% chance to create an Echo when a Charged answer is wrong.

#### Files Affected

| File | Change |
|------|--------|
| `src/services/cardEffectResolver.ts` | MODIFY: Echo cards disable Quick Play path, always route to Charge |
| Echo card creation logic | MODIFY: keep 85% trigger chance; update outcome values |
| `src/data/balance.ts` | MODIFY: `ECHO_CREATION_CHANCE = 0.85`, `ECHO_WRONG_POWER = 0.5` |

#### Dependencies
- AR-59.1 (Quick Play / Charge system must exist — Echo is a restriction of that system)

#### Acceptance Criteria
- [ ] Echo cards cannot be Quick Played (tap does nothing or shows tooltip)
- [ ] Echo cards trigger quiz when played (same Charge gesture or tap forces quiz)
- [ ] Correct Echo: normal power, FSRS double credit (mark as consecutive correct × 2)
- [ ] Wrong Echo: 0.5× effect, discarded from hand, FSRS second miss
- [ ] Insight Prism relic causes Echo to auto-succeed without quiz
- [ ] Echo visual unchanged: translucent, dashed purple border, chromatic aberration
- [ ] `npx vitest run` passes
- [ ] `npm run typecheck` passes

---

## Category J: Documentation

### AR-59.21 — GAME_DESIGN.md Full Rewrite

**Goal:** Rewrite `docs/GAME_DESIGN.md` to reflect the v2 design spec. Archive v1 version.

**Change type:** MODIFY (full rewrite) — do this LAST, after all implementation is complete.

**Process:**
1. Copy current `docs/GAME_DESIGN.md` to `docs/GAME_DESIGN_V1_ARCHIVE.md`
2. Rewrite `docs/GAME_DESIGN.md` based on the implemented v2 systems
3. Source of truth for the rewrite: `docs/RESEARCH/recall-rogue-overhaul-v2.md` + actual implemented behavior

**Dependencies:** All other sub-ARs must be complete.

---

### AR-59.22 — ARCHITECTURE.md Update

**Goal:** Update `docs/ARCHITECTURE.md` to reflect new systems, removed systems, and changed data flow.

**Change type:** MODIFY (targeted updates, not full rewrite)

**Sections to update:**
- New systems: `chainSystem.ts`, `surgeSystem.ts`, `bossQuizPhase.ts`, `chainVisuals.ts`
- Removed systems: combo counter, speed bonus, archetype selection, Mastery Coins, Hub relic shop
- Changed data flow: Quick Play / Charge path in `gameFlowController.ts`
- Relic system: 5-slot model, new acquisition flow
- Run structure: 3-act map

**Dependencies:** All other sub-ARs must be complete.

---

## Research Items

The following items need investigation before or during implementation. Each is tagged with the sub-AR that depends on it.

| # | Research Item | Depends On | Status |
|---|--------------|------------|--------|
| R1 | **Chain categoryL2 coverage audit** — Are all ~50 existing `categoryL2` values suitable as chain groups? Do vocabulary facts have semantic bins that can serve as secondary chain groups? What is the field name and population rate? | AR-59.3 | RESEARCH NEEDED |
| R2 | **Gesture conflict analysis** — Does the fling-up Charge gesture conflict with any existing scroll/swipe behaviors on mobile Capacitor? Test specifically on Android. | AR-59.2 | RESEARCH NEEDED |
| R3 | **Boss Quiz Phase UX wireframes** — Exact layout for the quiz phase interrupt screen. Cards hidden, questions center, timer display, results summary. Needs visual spec before implementation. | AR-59.7 | RESEARCH NEEDED |
| R4 | **Enemy sprite reuse audit** — Which of the 88 existing enemy sprites can be mapped to the 12 v2 enemies? Identify gaps requiring new sprite generation. | AR-59.13 | RESEARCH NEEDED |
| R5 | **Relic balance verification** — The 42-relic catalogue has very specific numbers (e.g., Chain Reactor +4 splash, Quicksilver Quill 1.5× for <2s). These require playtesting to validate. Run simulated playtests. | AR-59.11 | RESEARCH NEEDED |
| R6 | **Run length verification** — Does a 3-act × 7-8 node run actually hit the ~25 min target? Run playtest campaign: `npm run playtest:campaign -- --runs 50` after AR-59.5 is live. | AR-59.5 | RESEARCH NEEDED |
| R7 | **Chain + Charge multiplier ceiling** — Is 5-chain (3.0×) + Charged correct (3.0×) = 9.0× too powerful? With Prismatic Shard: 3.5× × 3.0× = 10.5×. On Surge turns with Chain Lightning build, peak turn can hit 10.5× per card × 5 cards. Balance test needed. | AR-59.3, AR-59.11 | RESEARCH NEEDED |
| R8 | **Surge cadence** — Is every 3rd turn the right frequency? Too frequent = Charge pressure overwhelming. Too rare = Surge loses excitement. Needs playtesting after AR-59.4 is live. | AR-59.4 | RESEARCH NEEDED |
| R9 | **Sell-to-make-room relic pricing** — What fraction of gold value should be refunded when selling a relic to make room? 50%? 25%? Flat rate? | AR-59.10 | RESEARCH NEEDED |

---

## Verification Gate (Full Overhaul)

Before marking AR-59 as complete and moving this doc to `completed/`:

### Code Quality
- [ ] `npm run typecheck` passes with zero errors
- [ ] `npm run build` produces clean production build
- [ ] `npx vitest run` passes all tests (240+ tests; update broken tests, do not skip)

### Functional Checklist
- [ ] Quick Play: tap popped card → instant resolve, no quiz, ≤200ms
- [ ] Charge Play: fling up → quiz → 3.0× or 0.7×, costs +1 AP
- [ ] Tier 3 auto-Charge: resolves at 1.2× with no quiz and no AP surcharge
- [ ] Knowledge Chains: 2/3/4/5-chain gives correct multipliers, resets each turn
- [ ] Chain colors: visible left-edge tint on all cards in hand
- [ ] Surge: every 3rd turn, 0.5s announcement, AP free charge, golden visuals
- [ ] Starter deck: 5 Strike + 4 Block + 1 Surge, no archetype selection
- [ ] Run structure: 3 acts generate, ~16-18 rooms, ~25-30 min
- [ ] 5-relic slot: sell-to-make-room when at capacity
- [ ] All 42 relics acquirable from correct sources
- [ ] 12 v2 enemies with correct special mechanics
- [ ] Boss quiz phases trigger at correct HP thresholds
- [ ] Rest site: all 3 choices (Rest / Study / Meditate) functional
- [ ] Shop haggling: quiz option before purchase, 30% discount on correct
- [ ] Echo cards: force Charge-only, correct outcomes on success/failure
- [ ] Deprecated systems removed: no combo counter, no speed bonus, no archetypes, no Mastery Coins

### Documentation
- [ ] `docs/GAME_DESIGN.md` fully updated to v2
- [ ] `docs/ARCHITECTURE.md` updated with new systems and removed systems
- [ ] All sub-AR docs checked off and moved to `docs/roadmap/completed/`

### Visual / Playtest
- [ ] Playwright screenshot: Quick Play resolves fast, no UI glitch
- [ ] Playwright screenshot: Charge gesture shows golden glow at 40px and 80px drag
- [ ] Playwright screenshot: Surge turn shows golden card shimmer and lightning bolt AP icon
- [ ] Playwright screenshot: Chain colors visible on card frame edges in hand
- [ ] Human playtest: at least 5 players attempt a full run without instruction; note where confused or bored
- [ ] Run timer: median run length is 25–30 minutes (run playtest campaign)

---

## Files Summary (All Sub-ARs)

### New Files to Create

| File | Purpose | Sub-AR |
|------|---------|--------|
| `src/services/chainSystem.ts` | Chain detection, multiplier lookup, state | 59.3 |
| `src/services/surgeSystem.ts` | Surge state, announcement trigger | 59.4 |
| `src/services/bossQuizPhase.ts` | Boss phase trigger, question queue, outcome | 59.7 |
| `src/services/chainVisuals.ts` | `categoryL2` → color mapping, pulse sync | 59.17 |
| `docs/GAME_DESIGN_V1_ARCHIVE.md` | Archive of v1 design doc | 59.21 |

### Files with Major Modifications

| File | Changes |
|------|---------|
| `src/services/turnManager.ts` | Charge AP cost, Surge turn counter, Boss phase pause |
| `src/services/cardEffectResolver.ts` | Quick Play / Charge value dispatch, chain multiplier |
| `src/services/gameFlowController.ts` | Remove quiz gate from default play path |
| `src/ui/components/CardHand.svelte` | Gesture rewrite, chain tint render, Surge golden state |
| `src/ui/components/CardCombatOverlay.svelte` | Charge overlay, Surge AP icon, Boss phase UI |
| `src/data/balance.ts` | Comprehensive update: new constants, removed constants |
| `src/data/mechanics.ts` | QP / Charge value columns for all 25 mechanics |
| `src/services/cardDescriptionService.ts` | Show QP and Charged descriptions |
| `src/services/relicEffectResolver.ts` | All 42 v2 relic effects |

### Files to Archive

| File | Notes |
|------|-------|
| `src/ui/components/StarterRelicSelection.svelte` | Run start relic selection removed in v2 |
| Archetype selection component(s) | Identify location; archive |
| Retreat-or-delve checkpoint component(s) | Identify location; archive (D12) |

**NOT archived (kept):** Hub relic shop, Mastery Coin store, Canary System, Learning Threshold Reward Gate, Bounty Quests, Daily Expedition, Lore Discovery, Ascension Mode, wowFactor, tier-up celebrations. See D14 and D22.

---

*This document is the master plan for the Recall Rogue v2 overhaul. Each sub-AR (59.1–59.22) should be created as its own phase document in `docs/roadmap/phases/` when that sub-AR is ready to be implemented. Do not create all sub-AR docs at once — create each one just before its sprint begins.*
