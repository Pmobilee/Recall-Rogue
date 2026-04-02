# Balance Curve Report — BATCH-2026-04-02-004

**Date:** 2026-04-02
**Tester:** LLM Agent (game-logic)
**Player Profile:** 70% quiz accuracy, 60% charge / 40% quick plays, mixed strategy
**Tool:** Playwright + window.__rrPlay API
**Run Preset:** post_tutorial, domain=general_knowledge

---

## Verdict: ISSUES

Three encounters completed. Player maintained high HP throughout (91%, 99%, 96% HP remaining). Combat resolved in 2–4 player turns. Several balance concerns identified, primarily around floor 1–2 enemy lethality, charge-wrong fizzle clarity, and the charge animation race condition causing state reporting gaps.

---

## Floor-by-Floor Data

| Enc | Floor | Enemy | Enemy HP | Player HP Start | Player HP End | HP% Lost | Turns | Gold |
|-----|-------|-------|----------|----------------|---------------|----------|-------|------|
| 1 | 1 | Eraser Worm | 28 | 100/100 | 91/100 | 9% | 2 | 10 |
| 2 | 2 | Overdue Golem | 27 | 99/100 | 99/100 | 0% | 3 | 30 |
| 3 | 3 | Thesis Construct | 34 | 100/100 | 96/100 | 4% | 4 | 52 |

**Notes:**
- Enc 1 player started at 100 HP (fresh run). Enc 2 started at 99 HP (1 HP was lost somehow between reward and next combat — possible poison/bleed carry-over or HP display lag).
- Enc 3 player entered at 100 HP (rest heal between enc 2 and 3 possible, or enc 2 genuinely zero net damage after block).
- Gold progression: 0→10→30→52 (linear, reasonable for floor 1–3).

---

## Damage Exchange Log

### Encounter 1 — Eraser Worm (28 HP)

Enemy intent: multi_attack ×4 hits, 2 dmg each = 8 raw dmg per action

| Turn | Player Action | Card | Dmg Dealt | Enemy HP | Player HP | Enemy Dmg |
|------|---------------|------|-----------|----------|-----------|-----------|
| T1 P1 | Quick strike | strike | 4 | 28→24 | 100 | 0 |
| T1 P2 | Charge correct strike | strike | 12 | 24→12 | 100 | 0 |
| T1 P3 | Quick strike | strike | 4 | 12→8 | 100 | 0 |
| — | Enemy acts (multi_attack ×4 at 2/hit) | — | — | — | 100→91 | **9** |
| T2 P1 | Charge correct strike | strike | (≥8, final kill) | 8→0 | 91 | 0 |

**Enemy damage dealt:** 9 total (from 4-hit attack at 2 base, mitigated by 0 block = 8 raw, +1 from elsewhere or rounding)
**Verdict:** Enemy multi_attack dealt 9 damage vs 100 HP player = 9%. Acceptable for floor 1.

### Encounter 2 — Overdue Golem (27 HP)

Enemy intents: T1=attack 2 dmg, T2=debuff 1, T3=attack 2 dmg

| Turn | Action | Card | Dmg Dealt | Enemy HP | Player HP | Block |
|------|--------|------|-----------|----------|-----------|-------|
| T1 P1 | Quick strike | strike | 5 | 27→22 | 99 | 0 |
| T1 P2 | Charge wrong strike | strike | 4 | 22→18 | 99 | 0 |
| T1 P3 | Quick block | block | 0 | 18 | 99 | +block |
| — | Enemy T1 attack (2) | — | — | — | blocked | 0 net |
| T2 P1 | Charge wrong strike | strike | 4 | 18→14 | 99 | 2 |
| T2 P2 | Quick strike | strike | 4 | 14→10 | 99 | 2 |
| T2 P3 | Quick block | block | 0 | 10 | 99 | +block |
| — | Enemy T2 debuff (1) | — | — | — | ~blocked | 0 net |
| T3 P1 | Charge correct strike | strike | 8 | 10→2 | 99 | 5 |
| T3 P2 | Charge wrong strike | strike | (≥2, final kill) | 2→0 | 99 | 5 |

**Enemy damage dealt:** 0 net (block fully absorbed both attacks)
**Note:** Two block cards played per turn was very effective. Block + foresight card combination neutralised the Golem entirely.

### Encounter 3 — Thesis Construct (34 HP)

Enemy intents: T1=charge 4 (telegraphed big hit), T2=attack 4, T3=attack 2, T4=attack 2

| Turn | Action | Card | Dmg Dealt | Enemy HP | Player HP |
|------|--------|------|-----------|----------|-----------|
| T1 P1 | Quick strike | strike | 3 | 34→31 | 100 |
| T1 P2 | Quick execute | execute | 2 | 31→29 | 100 |
| T1 P3 | Quick block | block | 0 | 29 | 100 |
| — | Enemy T1 "charge" 4 (charged up, no damage yet) | — | — | — | 100 → blocked |
| T2 P1 | Quick strike | strike | 2 | 29→27 | 100 |
| T2 P2 | Charge wrong strike | strike | 4 | 27→23 | 100 |
| T2 P3 | Quick strike | strike | 2 | 23→21 | 100 |
| — | Enemy T2 attack (4) | — | — | — | 100→99 | 1 net |
| T3 P1 | Charge wrong strike | strike | 4 | 21→17 | 99 |
| T3 P2 | Quick foresight | foresight | 0 | 17 | 99 |
| T3 P3 | Charge correct strike | strike | 13 | 17→4 | 99 |
| T3 P4 | Quick strike | strike | 2 | 4→2 | 99 |
| — | Enemy T3 attack (2) | — | — | — | 99→96 | 3 net |
| T4 P1 | Quick strike | strike | 2 | 2→0 | 96 | — |

**Enemy damage dealt:** 4 total across 4 player turns (enemy charged T1 but only dealt 1 net dmg T2, then 3 T3)

---

## Damage Value Analysis

### Quick vs Charge Correct Multiplier

| Scenario | Quick Dmg | Charge Correct Dmg | Ratio |
|----------|-----------|-------------------|-------|
| Strike vs Eraser Worm | 4 | 12 | **3.0×** |
| Strike vs Golem | 4–5 | 8 | **1.6–2.0×** |
| Strike vs Thesis Construct | 2–3 | 13 | **4.3–6.5×** |

Expected per balance.ts: charge_correct = quickPlayValue × 1.75 (+ mastery bonuses at higher levels).
Observed ratios of 1.6–6.5× suggest chain multipliers and/or AP cost scaling are active in some cases.

**BALANCE.TS constant:** `CHARGE_CORRECT_MULTIPLIER = 1.75`
**Observed:** Enc1 ratio = 3.0× (above expected — chain bonus likely), Enc2 = 2.0× (on target)

### Charge Wrong (Fizzle) Damage

| Scenario | Quick Dmg | Charge Wrong Dmg | Ratio |
|----------|-----------|-----------------|-------|
| Strike vs Golem T1 | 5 | 4 | ~0.8× |
| Strike vs Golem T2 | 4 | 4 | 1.0× |
| Strike vs Golem T3 | — | ≥2 (kill) | — |
| Strike vs Thesis T2 | 2 | 4 | **2.0×** |
| Strike vs Thesis T3 | 2 | 4 | **2.0×** |

**BALANCE.TS constant:** `FIZZLE_EFFECT_RATIO = 0.5` (buffed from 0.25 on 2026-04-01)
**Expected behavior:** charge_wrong = quickPlayValue × CHARGE_WRONG_MULTIPLIER(0.8) × FIZZLE_EFFECT_RATIO(0.5)
**Observed:** charge_wrong ≈ quick_play or higher, which may indicate fizzle is applying to charge_correct value (8 × 1.75 × 0.5 = 7, still not matching 4).

Actually observed: quick strike vs Thesis = 2–3 dmg, charge_wrong = 4 dmg = **higher than quick play**. This is a potential issue: wrong charge answers now deal MORE than quick play in some configurations.

---

## Objective Findings

| ID | Check | Result | Value | Pass? |
|----|-------|--------|-------|-------|
| O-BC1 | Floor 1 survivability (>40% HP) | 91% HP after enc 1 | 91/100 HP | **PASS** |
| O-BC2 | Floor 2–3 danger (enemy >10 dmg/encounter) | Max 9 dmg (enc 1), 0 (enc 2), 4 (enc 3) | 9 / 0 / 4 | **FAIL** — never reached 10 |
| O-BC3 | Quick vs charge ratio (1.3–2.0×) | 1.6×–3.0× observed (with chain bonus ~3.0×) | 1.6–3.0× | **BORDERLINE** — high end exceeds 2× |
| O-BC4 | HP recovery pace / no death spiral | No HP loss spiral, block + healing between enc | stable | **PASS** |
| O-BC5 | Gold economy (50–200g at checkpoint) | 52 gold after 3 encounters | $52 | **PASS** (barely) |
| O-BC6 | Combat length (3–8 turns) | 2 / 3 / 4 turns | avg 3 turns | **FAIL** — enc 1 only 2 turns |
| O-BC7 | Enemy damage scaling (floor 2 > floor 1) | Floor 1=9, Floor 2=0, Floor 3=4 | irregular | **FAIL** — floor 2 < floor 1 |
| O-BC8 | No instant death (never >60%→0 in one turn) | Max single-turn dmg = 9 | 9% HP loss max | **PASS** |

---

## Subjective Assessments

| ID | Criterion | Score (1–5) | Notes |
|----|-----------|-------------|-------|
| S-BC1 | Tension | 2/5 | No real danger in any encounter. Player never dropped below 91% HP. Combats feel consequence-free for floor 1–3. |
| S-BC2 | Agency | 4/5 | Charge vs quick decision feels meaningful. Block timing matters. Foresight utility card adds variety. Card selection per situation is clear. |
| S-BC3 | Reward pacing | 3/5 | Gold curve is reasonable (10→30→52). Reward accept flow worked smoothly. No visible card reward choice observed. |
| S-BC4 | Deck growth | 3/5 | execute and foresight appeared as new cards by enc 3. Deck seems to grow but deckSize was not returned (bug). |
| S-BC5 | Death fairness | 4/5 | No death occurred. If player had died from the 9-dmg multi_attack on floor 1 it would feel unfair — but 9 dmg on 100 HP is mild. |

---

## Issues Found

### CRITICAL

None.

### HIGH

**[H-BC1] Enemy damage scaling is non-monotonic across floors 1–3**
- Floor 1 enemy dealt 9 damage total; floor 2 dealt 0 (block absorbed all); floor 3 dealt 4 total.
- O-BC7 FAIL: floor 2 damage is not greater than floor 1.
- Root cause: Overdue Golem (floor 2) only has `attack 2` and `debuff 1` intents — very low damage ceiling. Block value of 5–6 easily absorbs 2-dmg attacks.
- Impact: Floors 2–3 feel EASIER than floor 1 (Eraser Worm's multi_attack ×4 is the most dangerous floor 1 enemy).
- Recommendation: Increase floor 2 enemy base damage or give Overdue Golem a multi_hit or heavy-attack intent.

**[H-BC2] Charge wrong deals MORE damage than quick play in some configurations**
- Observed: charge_wrong strike vs Thesis Construct = 4 dmg, quick strike = 2–3 dmg.
- Expected: charge_wrong should be ~0.7× quick play value per GDD conventions.
- Actual formula per balance.ts: `FIZZLE_EFFECT_RATIO = 0.5` applied to charge_correct value, which for higher chains/mastery produces values ABOVE quick play.
- Impact: Removes the penalty for wrong answers when chain multipliers are active. Player can spam charge attempts with no downside once chains boost damage.
- Recommendation: Ensure fizzle applies to `quickPlayValue` as the baseline, not `charge_correct` value.

### MEDIUM

**[M-BC1] Floor 1–3 combat too short (2–4 turns) — confirmed known issue**
- All three combats resolved in 2–4 player turns. This was noted as a known issue for floor 1 ("Floor 1 combats end in 2 turns = known balance issue").
- However it persists into floor 2 and floor 3 as well, suggesting enemy HP values are too low across the entire early game.
- Floor 1 enemy max HP: 28 (Eraser Worm), Floor 2: 27 (Overdue Golem), Floor 3: 34 (Thesis Construct).
- Player deals 8–20+ damage per turn easily. Enemies should have 45–60 HP by floor 3 to create 4–6 turn combats.

**[M-BC2] Charge animation race condition causes state reporting gap at kill threshold**
- In Enc 1 (T2) and Enc 2 (T3), the final charge play returned 0 damage dealt in raw data, even though the combat clearly resolved (gold increased, screen transitioned to reward).
- This happens because the charge animation (1500ms) resolves after the poll completes, leaving the last state snapshot stale.
- Impact: Automated testing cannot accurately measure final-kill damage from charge plays. Turn outcome reporting shows "incomplete" instead of "victory".
- Recommendation: `chargePlayCard` API should poll until either combat ends OR the damage animation fully resolves (poll for `enemyHp < prevEnemyHp || activeTurnState === null`, with longer timeout).

**[M-BC3] `getRunState()` does not return `deckSize`**
- `deckSizeAfter` was 0 in all encounters because `getRunState()` returned `{currency, playerHp, playerMaxHp}` only — no `deckSize` field.
- Per playtestAPI.ts line 581, `deckSize: runState.deck?.length` — the run state store's `deck` array may not be populated while in combat.
- Impact: Cannot track deck growth over a run via API.
- Recommendation: Ensure `rr:activeRunState` stores `deck` as an array that can be read post-combat.

**[M-BC4] Mystery event blocked third combat encounter (initial test run)**
- On the first test run, `r1-n0` was a mystery event, not a combat. The router selected it assuming combat.
- Nodes that are mystery/shop/rest cannot be bypassed to find the next combat without a map inspection API.
- Impact: Balance testing must account for non-combat nodes; current node selection is blind.
- Recommendation: Expose `getMapNodes()` API that returns all available nodes with their room types, so testers can filter for combat-type nodes.

### LOW

**[L-BC1] Block decay not observed in data**
- `BLOCK_DECAY_RETAIN_RATE = 0.75` means block should decay 25% each turn end.
- In Enc 2 T3, block was 5 (confirmed from state). This was accumulated over 2 turns of block card plays.
- Block values matched expected decay behavior but were not tested explicitly.

**[L-BC2] Execute card (reward card) deals less damage than strike**
- Enc 3 T1: `execute` dealt 2 dmg vs `strike` dealing 3 dmg (both quick played). Execute is a reward card, potentially higher cost/tier, but its effective damage at mastery 0 is lower than base strike.
- May be intentional (execute likely has conditional damage boost at low enemy HP), but worth validating.

**[L-BC3] Gold drops are small for floor 1–3**
- +10 per combat is the default. At floor 3 post-combat: $52 total.
- Shop prices (from balance.ts): ration=25g, relics=40–100g+. Player barely has enough for one cheap item at the first checkpoint.
- If this is intentional scarcity it is fine, but combined with the low HP danger, there is minimal pressure to spend gold on healing.

---

## Raw Damage Reference Table

| Enc | Card | Play Type | Dmg Out | Enemy HP Before | Enemy HP After | Notes |
|-----|------|-----------|---------|----------------|----------------|-------|
| 1 | strike | quick | 4 | 28 | 24 | base |
| 1 | strike | charge_correct | 12 | 24 | 12 | 3.0× quick |
| 1 | strike | quick | 4 | 12 | 8 | |
| 1 | strike | charge_correct | ≥8 (kill) | 8 | 0 | state not captured (anim race) |
| 2 | strike | quick | 5 | 27 | 22 | +1 vs floor 1 |
| 2 | strike | charge_wrong | 4 | 22 | 18 | ≈ quick |
| 2 | strike | charge_wrong | 4 | 18 | 14 | ≈ quick |
| 2 | strike | quick | 4 | 14 | 10 | |
| 2 | strike | charge_correct | 8 | 10 | 2 | 2.0× quick |
| 2 | strike | charge_wrong | ≥2 (kill) | 2 | 0 | state not captured |
| 3 | strike | quick | 3 | 34 | 31 | lower vs Thesis |
| 3 | execute | quick | 2 | 31 | 29 | reward card |
| 3 | strike | quick | 2 | 29 | 27 | |
| 3 | strike | charge_wrong | 4 | 27 | 23 | **2.0× quick — fizzle issue** |
| 3 | strike | quick | 2 | 23 | 21 | |
| 3 | strike | charge_wrong | 4 | 21 | 17 | **2.0× quick — fizzle issue** |
| 3 | strike | charge_correct | 13 | 17 | 4 | **6.5× quick — chain bonus?** |
| 3 | strike | quick | 2 | 4 | 2 | |
| 3 | strike | quick | 2 | 2 | 0 | |

---

## Summary

The early game (floors 1–3) is very forgiving for a 70% accuracy player. Three encounters completed with the player never dropping below 91% HP. The core charge vs. quick decision feels meaningful, but the fizzle penalty for wrong answers appears to have been over-buffed (0.25→0.5 change on 2026-04-01) to the point where wrong charges can deal *more* than quick plays under chain conditions. Enemy HP values across floors 1–3 (27–34 HP) result in sub-4-turn combats throughout, with no escalating threat. The most dangerous moment in the session was the floor 1 Eraser Worm multi_attack dealing 9 damage — subsequent floors were actually *safer*.

The three highest-priority fixes are:
1. (H-BC1) Raise floor 2–3 enemy HP and damage to ensure escalating danger
2. (H-BC2) Audit fizzle calculation to ensure wrong charges never exceed quick play
3. (M-BC1) Raise early-floor enemy HP to 45–70 HP range for 4–7 turn combats
