# Balance Audit — 2026-04-04

> **Purpose:** Comprehensive balance analysis from 24,500+ headless sim runs. Catalogs all identified issues with data, root cause analysis, and recommended fixes.
> **Data sources:** `data/playtests/runs/2026-04-04_01-50-38/` (12K full-run), `data/playtests/runs/2026-04-04_01-50-44/` (5.5K isolation), `data/playtests/runs/2026-04-04_01-54-12/` (3K combat-mode)
> **Methodology:** Headless sim imports real game code (zero drift). BotBrain parameterized profiles. Full-run mode includes map, relics, shop, rest, mystery, gold economy.

---

## Executive Summary

| Batch | Runs | Scope |
|-------|------|-------|
| Full-run profiles | 12,000 | 6 profiles (first_timer through scholar) |
| Archetype runs | 4,000 | turtle, chain_god, speedrunner, mastery_farmer |
| Ascension runs | 4,000 | regular @ Asc 0/5/10/15/20 |
| Skill axis isolation | 5,500 | 11 axes × 500 runs each |
| Combat-mode tracking | 3,000 | 73 mechanics observed with per-mechanic WR |

**Overall baseline win rate: 16.5%** (all profiles combined)

### Critical Findings at a Glance

- Act 3 boss kills 78% of all deaths — the difficulty curve is a cliff, not a ramp
- Ascension scaling is INVERTED: Asc 20 wins 3× more often than Asc 0
- Two common relics (`scavengers_eye`, `merchants_favor`) push WR to 54-72%
- `inscription_wisdom` has 0 QP at every mastery level and a permanent 2 AP cost — actively harmful
- Accuracy accounts for ~80% of outcomes, leaving strategy almost irrelevant below 60% accuracy
- Only one viable archetype exists (chain_god at 61% WR); turtle and speedrunner are under 0.5%
- Surge system is mechanically inert (`CHARGE_AP_SURCHARGE = 0`) — fires every 4th turn but does nothing

---

## Methodology Caveats & Known Limitations

> **This section was added after critical review on 2026-04-04.** Several methodology flaws were identified that affect how the data should be interpreted. Issues are still documented as-is, but readers should account for these caveats before acting on recommendations.

### Survivorship Bias in Relic/Card Win Rates

All "win rate when present" stats for relics and card mechanics are **observational, not causal**. Players who acquire relics like `scavengers_eye` or `merchants_favor` have already survived long enough to visit shops and earn gold — selecting for stronger runs. The true causal effect of these relics is likely **smaller** than the reported delta. For example, `scavengers_eye` at 72.5% WR (80 appearances) may reflect "strong runs acquire this relic" rather than "this relic makes runs strong."

**To establish causation:** Run forced-relic simulations where every run starts with a specific relic, then compare WR to a no-relic control group. Until then, treat relic WR as **directional indicators**, not precise measurements.

### The 16.5% Baseline Is a Mixed-Profile Average

The overall 16.5% baseline combines profiles ranging from 0% (first_timer) to 65.3% (scholar). This makes "+X% over baseline" comparisons misleading — a relic that scholars acquire disproportionately will appear overpowered against this average even if its true effect within the scholar population is modest.

**Per-profile baselines** (for reference when interpreting relic/card deltas):
- first_timer: 0.0% | casual_learner: 4.5% | regular: 2.8%
- gamer: 0.8% | dedicated: 25.5% | scholar: 65.3%

### Archetype Comparison Confounds Accuracy With Strategy

The four archetype profiles (turtle, chain_god, speedrunner, mastery_farmer) have **different accuracy settings**: chain_god = 80%, mastery_farmer = 75%, turtle = 60%, speedrunner = 50%. Since accuracy dominates outcomes (Issue 35), the archetype comparison largely measures accuracy differences, not strategic viability. The "no build diversity" finding (Issue 43) may be an artifact of this confound.

**To isolate strategy from accuracy:** Re-run archetypes at a fixed accuracy (e.g., 70%) and vary only strategic parameters. Until then, archetype WR comparisons should be interpreted cautiously.

### Fixed-Accuracy Archetype Results (2026-04-04, Post-Audit)

A controlled re-run at **fixed 70% accuracy** for all archetypes produced dramatically different results from the original variable-accuracy comparison:

| Archetype | 70% Acc WR | Original WR | Original Acc | Verdict |
|-----------|-----------|-------------|-------------|---------|
| Baseline (all 0.5) | **15.4%** | N/A | N/A | Control group |
| Chain God | **21.7%** | 61.0% | 80% | Strategy adds +6.3% — NOT dominant |
| Speedrunner | **21.8%** | 0.4% | 50% | Strategy adds +6.4% — equally viable as chain_god! |
| Mastery Farmer | **14.6%** | 26.2% | 75% | Strategy adds -0.8% — no benefit over baseline |
| Turtle | **0.1%** | 0.3% | 60% | Still dead even at 70% — genuine build problem |

**Key findings:**
1. **Chain God and Speedrunner are equally strong** when accuracy is controlled. The original 61% vs 0.4% gap was entirely accuracy-driven.
2. **Mastery farming provides zero strategic benefit** — charging for mastery instead of damage is a wash.
3. **Turtle is genuinely broken** even at 70% accuracy (0.1% WR). The problem is `chargeSkill=0.2` — the bot refuses to charge even when accuracy makes it profitable. Pure defense without offense is truly unviable, confirming Issue 39/44.
4. **Issue 43 (No Build Diversity) is PARTIALLY an artifact** — at fixed accuracy, 2 of 4 archetypes are viable. But turtle and mastery_farmer remain non-viable regardless of accuracy.

Data: `data/playtests/runs/2026-04-04_03-54-05/` through `2026-04-04_03-54-19/`

### Forced-Relic Causal Test Results (2026-04-04, Post-Audit)

Forced-relic simulations gave every run a specific relic at start (dedicated profile, 1000 runs each) to measure **causal** relic impact, free of survivorship bias.

| Condition | Win Rate | Causal Delta | Original "WR when present" | Original Delta |
|-----------|----------|-------------|---------------------------|----------------|
| Control (no forced relic) | **27.9%** | — | — | — |
| scavengers_eye (forced) | **26.1%** | **-1.8%** | 72.5% | +56.0% |
| merchants_favor (forced) | **26.6%** | **-1.3%** | 54.9% | +38.5% |
| gold_magnet (forced) | **25.7%** | **-2.2%** | 34.9% | +18.5% |
| steel_skin (forced) | **30.7%** | **+2.8%** | 31.8% | +15.3% |

**Conclusion: The original relic analysis was almost entirely survivorship bias.**

- `scavengers_eye`, `merchants_favor`, and `gold_magnet` have **zero or negative** causal effect on win rate. Their high "WR when present" reflected that strong runs acquire more relics, not that the relics make runs strong.
- `steel_skin` is the ONLY relic with a genuine positive effect (+2.8%), and it's modest — not the +15.3% the observational data suggested.
- **All relic nerf recommendations in Categories 3-4 should be deprioritized or removed.** The relic system is better balanced than the observational data indicated.

Data: `data/playtests/runs/2026-04-04_03-57-46/` (control) through `2026-04-04_03-57-51/` (forced relics)

### Small Sample Sizes on Rare Relics and Combos

- 15+ relics have fewer than 30 appearances — too few for reliable WR estimates (95% CI spans 15-20+ percentage points)
- Relic combo stats (e.g., `gold_magnet + scavengers_eye = 96.7% from 30 runs`) have extremely wide confidence intervals (83-100%) and should not drive Critical-priority recommendations
- Per-mechanic WR from 3,000 combat runs gives ~41 observations per mechanic on average; mechanics with <100 appearances (e.g., `bulwark` at 53, `inscription_wisdom` at 83) have high variance

### Missing Analyses (Identified Gaps)

The following strategic dimensions were NOT analyzed and should be covered in a follow-up:
- **Shop transaction patterns** — what do winning runs buy? Relics vs cards vs removal?
- **Card removal rates** — is deck thinning a key strategy? What is removal frequency in wins vs losses?
- **Deck size at win vs loss** — does a lean deck outperform a large one?
- **Rest site heal/study ratio** — what is the optimal rest decision by HP% and deck state?
- **Draw mechanic dominance** — are draw/AP-generation cards a systemic force multiplier?
- **Brain Fog/Flow State distribution** — how often are players in Flow State (+1 draw) vs Brain Fog (+20% enemy damage)?
- **Enrage scaling in long boss fights** — what is effective enemy DPS at turn 40 vs turn 5?
- **Ascension modifier details** — specifically, does Asc 20 grant "start with 3 relics (choose from 7)" which alone could explain the inverted scaling?

### Chain Multiplier GDD/Code Discrepancy

The GDD lists chain multipliers as `[1.0, 1.3, 1.7, 2.2, 3.0]` but `balance.ts` uses `[1.0, 1.2, 1.5, 2.0, 2.5, 3.5]`. The sim uses code values (3.5× at 5-chain), which is 17% stronger than the GDD's intended 3.0× cap. This discrepancy should be resolved before any chain-dependent balance work.

### Design Intent Tensions

Several issues in this audit exist in tension with the GDD's stated design philosophy:
- **First_timer 0% WR** — the GDD's Anti-Prodigy Principle says "there is no route around engagement," suggesting new players SHOULD fail until they learn. But 0% (vs Hades' ~5% for beginners) may be too punishing for retention.
- **Accuracy dominance** — by design, knowledge IS power. But 80/20 accuracy-vs-strategy split may be more extreme than intended. A 60/40 split would still reward knowledge while making card strategy meaningful.
- **Act 3 boss as knowledge wall** — the boss's +2 Str on wrong charges is designed as the ultimate knowledge test. Whether -77.7 HP avg is "appropriately hard" or "mathematically impossible" depends on the intended clear rate for dedicated players (currently 25.5%).
- **Surge system at CHARGE_AP_SURCHARGE=0** — this is a deliberate balance constant, not a bug. The question is whether to restore it to 1 to make surge turns mechanically meaningful, not whether it's broken.

## Category 1: Act Progression & Difficulty Curve

#### Issue 1: Act 3 Boss is a Wall
**Priority:** Critical
**Data:** Act 3 boss encounters average -77.7 HP. 78.1% of all deaths (10,025 total) happen in Act 3. Of Act 3 deaths, 86.6% are to the boss specifically. Act 2 boss averages only -6.9 HP (11x easier). Normal Act 3 combat is only -2.1 HP.
**Analysis:** The Final Lesson (floor 24) has 1,396 scaled HP (baseHP 18 × 4.0 × 19.4 scaling factor). It has quiz phases at 66% and 33% HP, gains +2 permanent Strength on wrong Charges, and Phase 2 (at 33%) features attack value 6 and multi_attack 4×4 hits with Vulnerable 4 stacks for 3 turns. The Omnibus (floor 21) has 1,252 scaled HP. Compare to Act 1 boss Final Exam at just 72 scaled HP — that is a 19x HP ratio. The damage cap jumps from 18 (Segment 3) to 28 (Segment 4). Players simply cannot output enough damage to kill these bosses before being ground down.
**Recommendation:** Reduce Act 3 boss baseHP by 20-25% (18→14 for Final Lesson, 18→14 for Omnibus). Alternatively, reduce the Segment 4 HP scaling from 0.80 to 0.60 per floor. Also consider softening the +2 Strength on wrong Charge to +1, as it creates a death spiral for players struggling with quiz content. Target: Act 3 boss should average -40 to -50 HP, not -77.7.

**ROOT CAUSE FOUND (2026-04-04, enrage DPS analysis):** The Act 3 boss wall is NOT primarily a stats problem — it's the **global enrage system**. Enrage bonus is added AFTER the per-turn damage cap (line 2874-2876 of turnManager.ts), completely bypassing it. For Act 3 (The Archive, floors 19-24): enrage starts at turn 4, adds +1/turn for 3 turns (phase 1), then +3/turn thereafter (phase 2). At turn 40 (typical scholar boss fight length), enrage adds **+114 flat uncapped damage per enemy action** on top of the 28 damage cap. Effective per-action damage: 28 + 114 = **142**. This makes long boss fights mathematically unwinnable regardless of boss HP.

**Revised recommendation:** The primary fix should target `ENRAGE_PHASE2_BONUS` in `src/data/balance.ts` (currently +3/turn, reduce to +1 or +1.5) and/or make enrage subject to the damage cap. Reducing boss HP alone won't fix this — even with 50% less HP, the fight still takes 25+ turns and enrage still reaches +70 uncapped damage. The enrage system is the real Act 3 boss wall.

#### Issue 2: Act 3 Elite Spike
**Priority:** High
**Data:** Act 3 elites average -14.5 HP per encounter vs -5.0 in Act 2 (2.9x harder). Act 1 elites are actually +2.2 HP (player gains HP, possibly due to heal rewards).
**Analysis:** Elite enemies in Act 3 include Dunning-Kruger (disables chain multipliers entirely) and The Singularity (Quick Play deals only 30% damage). These mechanic-warping effects combined with Segment 3-4 HP scaling create brutal encounters that soften players before the boss. The scaling formula for elites uses the same per-floor multiplier as commons, but elites have higher baseHP (9-14 vs 4-8 for commons).
**Recommendation:** Consider reducing Act 3 elite baseHP by 15-20%. Alternatively, soften the mechanic-warping effects: Singularity's QP multiplier from 0.3→0.5, Dunning-Kruger's chain override from 1.0→1.5. These elites should be hard but not invalidate entire player strategies.

#### Issue 3: Normal Combat is Flat Across Acts
**Priority:** Medium
**Data:** Normal combat HP change: Act 1 = -1.9, Act 2 = -1.6, Act 3 = -2.1. Essentially no difficulty ramp for regular encounters.
**Analysis:** The per-turn damage cap (7/12/18/28 by segment) limits how much enemy damage scales even though HP scales significantly. Common enemies have low base attack values (3-5) that do not multiply dramatically. The result is that normal combat feels approximately the same difficulty throughout the entire run. The challenge only spikes at elites and bosses.
**Recommendation:** This may be partially intentional — normal combat is where players practice quiz content and gain mastery. However, consider a gentle ramp: increase common enemy base attack values in Segment 3-4 by +1, or reduce the per-turn damage cap less aggressively (e.g., Segment 2 from 12→10 to make early acts slightly harder, Segment 3-4 from 18/28→15/22 to smooth the curve). Target: Act 1 = -2, Act 2 = -4, Act 3 = -7 for a noticeable but fair ramp.

#### Issue 4: First Timer 0% Win Rate
**Priority:** High
**Data:** first_timer profile (45% accuracy, minimal strategy) has 0.0% win rate across 2,000 runs. 38.6% die in Act 1, 61.2% die in Act 2. They never even see Act 3.
**Analysis:** At 45% accuracy, players get wrong answers more than half the time. Charge Wrong gives 0.25× fizzle damage, so most card plays produce minimal value. The starter deck at L0 mastery has very low QP values (strike=3, block=3). Combined, a new player deals ~4.6 damage per turn on average vs enemies with 28+ effective HP (baseHP 5 × 4.0 × 1.5 scaling). They are also taking chip damage every turn with no healing strategy.
**Recommendation:** This is an educational game — new players SHOULD struggle. But 0% is too punishing for retention. Options: (a) Add a "Learning Mode" that reduces Act 1 enemy HP/damage by 30% for first 3 runs, (b) Give starter deck 1-2 free mastery levels so L0 is not the floor, (c) Increase the Act 1 per-turn damage cap from 7→5 for the first few floors. Target: first_timer should have 5-15% win rate through Act 1 to feel progress.
**Design tension:** The GDD's Anti-Prodigy Principle argues against reducing difficulty for unknowledgeable players. However, even Hades (a notoriously hard roguelite) has ~5% first-run clear rate. 0% means zero positive reinforcement in the core loop. Consider improving feedback and progression signals (personal best floor, enemies defeated) rather than reducing difficulty directly.

---

## Category 2: Ascension System

#### Issue 5: Ascension Scaling is Inverted
**Priority:** Critical
**Data:** Regular profile win rates by ascension: Asc 0 = 2.8%, Asc 5 = 5.1%, Asc 10 = 6.1%, Asc 15 = 5.0%, Asc 20 = 8.3%. Higher ascension has HIGHER win rates, with Asc 20 nearly 3x Asc 0.
**Analysis:** Ascension levels grant additional relics (Asc 0 avg 4.4 relics, Asc 20 avg 6.9 relics). The relic power boost appears to overcompensate for ascension difficulty penalties. The sim data shows more relics acquired at higher ascension, suggesting ascension modifiers include extra relic drops or shop opportunities that snowball into higher win rates.
**Recommendation:** Audit `src/services/ascension.ts` `getAscensionModifiers()` for what each level grants. The likely fix: reduce extra relic/resource bonuses at higher ascension levels, or increase enemy HP/damage scaling per ascension level. Ascension 20 should target 1-3% win rate for regular profile, not 8.3%. This is the opposite of what players expect from a difficulty modifier.

#### Issue 6: Ascension Resource Over-Compensation
**Priority:** High
**Data:** Relics acquired scale linearly with ascension: Asc 0 = 4.4, Asc 5 = 5.4, Asc 10 = 6.4, Asc 15 = 6.0, Asc 20 = 6.9.
**Analysis:** Each additional relic has compounding value (especially the S-tier relics like `scavengers_eye`, `merchants_favor`). If ascension grants more relic opportunities, the exponential relic power scaling overwhelms the linear difficulty increase. This is the root cause of Issue 5.
**Recommendation:** Ascension should REDUCE relic availability, not increase it. Consider: higher ascension = fewer shop relic slots, lower drop rates, or restricted relic pool (no S-tier relics above Asc 10).

---

## Category 3: Relic Balance

#### Issue 7: scavengers_eye is Game-Breaking
**Priority:** Critical
**Data:** 72.5% WR when present (80 appearances) vs 16.5% baseline (+56.0%). Any combo with it = 75-97% WR.
**Analysis:** 4 card reward choices instead of 3 means 33% more options every card reward. Over a full run with ~10-15 card rewards, this compounds into dramatically better deck quality. Better deck → more wins → more rewards → better deck. The relic is common rarity, meaning it is the most likely to appear.
**Recommendation:** Three options: (a) Reduce from 4→3 choices (removes the effect), (b) Change to "See all 4, but must pick from 3 random" (reduces impact), (c) Move to rare rarity so it appears less often, (d) Replace with "first card reward per act has 4 choices" (caps the benefit). Option (c) is simplest. Target: WR with relic should be 25-35%, not 72.5%.
**Caveat:** The 72.5% WR figure is inflated by survivorship bias (see Methodology Caveats). Runs that acquire this relic are already on strong trajectories. The true causal uplift is likely 20-35%, not 56%. A forced-relic simulation is needed before committing to a specific nerf magnitude.
**RETRACTED (causal test):** Forced-relic simulation shows scavengers_eye has **-1.8% causal effect** (26.1% vs 27.9% control). The 72.5% observational WR was entirely survivorship bias. **No nerf needed.** Downgrading from Critical to Resolved.

#### Issue 8: merchants_favor is Too Strong
**Priority:** Critical
**Data:** 54.9% WR (346 appearances, +38.5% over baseline). Combos with any common relic = 56-60% WR.
**Analysis:** +1 card AND +1 relic choice in shops compounds every shop visit. More choices = better selections = stronger run. The relic effectively gives exponentially scaling value. At common rarity, it appears frequently.
**Recommendation:** Remove the +1 relic choice component (keep +1 card choice only) OR move to uncommon/rare rarity. The dual benefit (cards + relics) is what makes it broken. Target: 25-35% WR.
**Caveat:** Same survivorship bias applies. The 346-appearance sample is more robust than scavengers_eye's 80, but the 54.9% WR still selects for runs that reached shops with gold to spare.
**RETRACTED (causal test):** Forced-relic simulation shows merchants_favor has **-1.3% causal effect** (26.6% vs 27.9% control). The 54.9% observational WR was survivorship bias. **No nerf needed.** Downgrading from Critical to Resolved.

#### Issue 9: gold_magnet Economy Snowball
**Priority:** High
**Data:** 34.9% WR (670 appearances, +18.5% over baseline).
**Analysis:** +30% gold from all sources enables more shop purchases, which means more relics, card removals, and food. Gold is the universal resource — boosting it by 30% is like boosting everything by 30%. At common rarity, it appears very frequently.
**Recommendation:** Reduce from +30% to +15-20% gold. Or change to "first 3 gold drops per floor are doubled" to cap the benefit. Target: 22-28% WR.
**RETRACTED (causal test):** Forced-relic simulation shows gold_magnet has **-2.2% causal effect** (25.7% vs 27.9% control). The +30% gold provides no measurable win rate improvement. **No nerf needed.** Downgrading from High to Resolved.

#### Issue 10: steel_skin Quietly Overpowered
**Priority:** High
**Data:** 31.8% WR (5,083 appearances, +15.3% over baseline). Most commonly held relic in the game.
**Analysis:** -3 flat damage reduction on EVERY hit is extremely efficient against the game's damage model. Most Act 1-2 enemies deal 3-6 damage per hit — `steel_skin` reduces that by 50-100%. Multi-hit attacks (2-4 hits) each get reduced by 3, making it disproportionately effective against the most dangerous attack patterns. At common rarity, nearly every run has it.
**Recommendation:** Reduce from -3 to -2 damage reduction. Or add a condition: "reduces first hit each turn by 3" instead of every hit. The per-hit application against multi-attacks is the core issue. Target: 22-26% WR.
**Updated (causal test):** Forced-relic simulation shows steel_skin has **+2.8% causal effect** (30.7% vs 27.9% control). This is the only tested relic with a genuine positive effect, but +2.8% is modest and within acceptable bounds. **No nerf needed.** Downgrading from High to Low (monitor).

#### Issue 11: Insufficient Relic Sample Sizes
**Priority:** Low
**Data:** 15+ relics have <30 appearances: `paradox_engine` (20), `volatile_manuscript` (23), `glass_lens` (20), `last_breath` (20), `volatile_core` (20), `omniscience` (23), `chronometer` (21), `insight_prism` (21), `soul_jar` (22), `pain_conduit` (20), `archive_codex` (21), `overclocked_mind` (21), `bloodstone_pendant` (22), `lucky_coin` (32).
**Analysis:** These are mostly rare/legendary unlockable relics that appear infrequently in runs. With <30 samples, win rate data has high variance (e.g., `paradox_engine` at 55% WR from 20 samples could easily be 30-80% with different seeds). We cannot make confident balance assessments.
**Recommendation:** Run targeted simulations with `--skills` overrides that force relic acquisition. Or increase total run count to 50K+ to get 100+ samples per rare relic. Low priority because these relics appear rarely in actual gameplay.

---

## Category 4: Relic Combo Synergies

#### Issue 12: scavengers_eye Combos Auto-Win
**Priority:** Critical (linked to Issue 7)
**Data:** `gold_magnet` + `scavengers_eye` = 96.7% WR (30 appearances). `scavengers_eye` + `steel_skin` = 84.1% (69). `scavengers_eye` + ANY common relic = 74-82% WR.
**Analysis:** `scavengers_eye`'s deck quality improvement compounds with any other relic's power. `gold_magnet` + `scavengers_eye` gives both better card choices AND more gold to buy even more. This is not really a combo issue — it is that `scavengers_eye` is so strong that pairing it with anything creates an auto-win.
**Recommendation:** Fix `scavengers_eye` (Issue 7) and this resolves automatically.
**Caveat:** The 30-sample combo stats have extremely wide confidence intervals (83-100% for the 96.7% figure). These are directional signals, not precise measurements. Do not assign Critical priority based solely on combo WR with <50 samples.
**RETRACTED:** Since scavengers_eye has no causal effect on WR, its combos are also artifacts of survivorship bias. Downgrading from Critical to Resolved.

#### Issue 13: merchants_favor Combos Near Auto-Win
**Priority:** High (linked to Issue 8)
**Data:** `merchants_favor` + `steel_skin` = 59.8% WR (296 appearances). `merchants_favor` + `swift_boots` = 59.3% (317). `merchants_favor` + ANY common = 56-59% WR.
**Analysis:** Same pattern as `scavengers_eye` — `merchants_favor`'s shop enhancement compounds with every other relic. The +1 relic choice in shops means you are more likely to GET the other strong relics, creating a snowball.
**Recommendation:** Fix `merchants_favor` (Issue 8) and this resolves automatically.
**RETRACTED:** Since merchants_favor has no causal effect on WR, its combos are also artifacts of survivorship bias. Downgrading from High to Resolved.

---

## Category 5: F-Tier Card Mechanics (Actively Harmful)

#### Issue 14: bulwark (9.4% WR, -26.2%)
**Priority:** High
**Data:** 348 plays across 53 runs where present. Only 70% charge rate. 3 AP cost at L0, drops to 2 AP at L5. Exhausts on Charge Correct.
**Analysis:** 3 AP is the entire turn budget. Playing `bulwark` means you can play nothing else that turn (3 AP base, hard cap 5). The exhaust-on-CC means you lose the card permanently after answering correctly — the opposite of what should happen. Even at L5 (2 AP, no exhaust, 16 block), it is still spending 2/3 of your turn on one defensive card. The opportunity cost of NOT playing 2-3 attack/buff cards is devastating.
**Recommendation:** Reduce L0 AP cost from 3→2. Remove exhaust entirely (it already costs a premium in AP). At L5, reduce to 1 AP. The card should be a premium defensive option, not a trap. Alternatively, add "also draws 1 card" to offset the AP investment.

#### Issue 15: ironhide (10.0% WR, -25.6%)
**Priority:** High
**Data:** 668 plays across 60 runs. 72% charge rate. 2 AP at L0 for 3 block + 1 temporary Strength.
**Analysis:** At L0, `ironhide` gives 3 block + 1 temp Str for 2 AP. Compare to `block` (3 block for 1 AP) + `strike` (3 damage for 1 AP) — playing two 1-AP cards gives 3 block + 3 damage, while `ironhide` gives 3 block + 1 Str (which only helps future attacks). The 2 AP cost means you sacrifice a full card play for a marginal Strength buff. Even at L5 (7 block + 2 permanent Str for 1 AP), the card only becomes competitive.
**Recommendation:** Reduce L0 AP cost from 2→1 (matching similar cards). Increase base block from 3→5 at L0. Make Strength permanent at L1+ instead of L3+. The card's identity is "shield that also buffs" — let it do both adequately from the start.

#### Issue 16: inscription_wisdom (15.7% WR, -19.9%)
**Priority:** High
**Data:** 134 plays across 83 runs. Only 54% charge rate. 0 QP at ALL mastery levels. 2 AP at ALL levels. Exhausts on play.
**Analysis:** This is the worst-designed card in the game. It costs 2 AP (66% of turn budget), does ZERO damage at every level, exhausts permanently, and its effect (draw 1 extra per future CC) requires multiple future Charge Corrects to pay off. At 54% charge rate, players are not even attempting to charge it — they quick-play a 0-damage card for 2 AP and lose it forever. The QP is 0 at L0 AND L5 — there is literally no damage scaling path.
**Recommendation:** Complete redesign needed. Options: (a) Reduce AP to 0-1, (b) Add QP damage (even 2-3 would help), (c) Do not exhaust — make it persistent like `inscription_fury`/`iron`, (d) Change to "this turn, all Charge Corrects draw 2 extra" for immediate payoff. The core issue is 2 AP + exhaust + delayed payoff + 0 damage = a card that actively hurts your run by being in your deck.

#### Issue 17: overheal (16.9% WR, -18.7%)
**Priority:** Medium
**Data:** 915 plays across 71 runs. 81% charge rate. 2 AP at ALL levels. Conditional doubling at <50% HP.
**Analysis:** 2 AP for 3 block at L0 is terrible (`block` gives 3 for 1 AP). The doubling at <50% HP is meant to reward risky play, but you need to already be losing to benefit. Even doubled (6 block for 2 AP at L0), it is still worse than two basic blocks (6 block for 2 AP). At L5 (8 block, doubled to 16 at <50% HP, heals 2 HP + 5% max HP), it finally becomes decent but still costs 2 AP.
**Recommendation:** Reduce AP to 1 at L0 (making it competitive with basic `block`). Lower the HP threshold from 50% to 60% so it activates more often. Add "always heals 1 HP" at L0 (not just L3+) to give it a unique identity as the healing shield card.

#### Issue 18: inscription_iron (20.6% WR, -15.0%)
**Priority:** Medium
**Data:** 1,656 plays across 107 runs. 63% charge rate. +1 block/turn at L0, scales to +4 at L5. 2 AP at ALL levels.
**Analysis:** +1 block per turn for the rest of combat is negligible when enemies deal 3-28 damage per turn. You need to play `inscription_iron` AND survive 10+ turns for it to generate equivalent value to a single basic block card. The 2 AP cost means you sacrifice immediate defense for future defense that takes many turns to accumulate. Most combats do not last long enough for the investment to pay off. At L5, +4 block/turn + 1 thorns is decent but still costs 2 AP.
**Recommendation:** Reduce AP to 1 at L0 (or 0 at L3+). Increase L0 value from +1 to +2 block/turn. Add "immediately gain block equal to the inscription value" so you get something now AND later. The card's identity is "long-game defensive investment" — but combats are not long enough for it to work at current values.

#### Issue 19: siphon_knowledge (20.1% WR, -15.5%)
**Priority:** Medium
**Data:** 2,989 plays across 164 runs. 66% charge rate. 0 QP at all levels. 2 AP at L0, 1 AP at L3+. Draws 1-3 cards with answer preview.
**Analysis:** At L0, spending 2 AP to draw 1 card and see answers for 2 seconds is a terrible trade. Compare to `foresight` (draw 2, 0 AP). The answer preview mechanic is interesting but does not justify the AP cost. At L3+ (1 AP, draw 2, 4s preview), it becomes playable but still underperforms pure draw cards. The L5 "eliminate 1 wrong answer" is the first actually unique value.
**Recommendation:** Reduce L0 AP to 1 (matching `scout`). Increase L0 draw from 1→2. The card's unique identity is answer preview — lean into that by making L0 preview 3s (not 2s) and L3+ preview 5s. Consider adding "if you Charge Correct the next card this turn, draw 1 extra" to reward using the preview.

---

## Category 6: D-Tier Card Mechanics (Underperforming)

#### Issue 20: fortify (22.7% WR, -12.9%)
**Priority:** Medium
**Data:** 1,271 plays, 88 runs. 73% charge rate. 2 AP all levels. Doubles current block.
**Analysis:** Requires existing block to function — useless on the first play of a turn. Even with block, doubling 3→6 for 2 AP is worse than just playing two block cards (6 for 2 AP). Only good when you already have high block from previous turns (which rarely happens without Aegis Stone relic). At L5, block persists to next turn, which is strong but requires reaching L5.
**Recommendation:** Reduce AP to 1 at L3+. Change L0 from "50% of current block" to "gain block equal to block on play PLUS 3 base block" so it works without existing block.

#### Issue 21: double_strike (23.1% WR, -12.5%)
**Priority:** Medium
**Data:** 3,997 plays, 104 runs. Only 48% charge rate. 2 AP all levels (NEVER reduces).
**Analysis:** 2 AP buff that makes next attack hit twice. The 48% charge rate means players prefer quick-playing it (wasting the buff's potential). At 2 AP, you have spent 66% of your turn setting up — you need 1 AP left for the attack, which means you can only play a 1-AP attack afterward. The buff does not help if you cannot play a strong follow-up.
**Recommendation:** Reduce AP to 1 at L3+ or L5. At 1 AP, the sequence "double_strike (1 AP) → power_strike (1 AP) → strike (1 AP)" is powerful and fun. The 2 AP cost prevents the combo from ever happening efficiently.

#### Issue 22: multi_hit (23.5% WR, -12.1%)
**Priority:** Medium
**Data:** 1,235 plays, 68 runs. 91% charge rate. Highest avg damage per play (143.9) of any attack.
**Analysis:** Paradoxically, `multi_hit` has the highest average damage but one of the lowest win rates. The damage is spread across 2-4 hits, each individually weak (L0: 1 QP × 2 hits). Block reduces each hit separately, so an enemy with 3 block negates most `multi_hit` damage. The card is strong against unblocked targets but terrible against any defense. Multi-hit also interacts poorly with the damage pipeline — each hit triggers separate reduction calculations.
**Recommendation:** Increase per-hit QP from 1→2 at L0 so each hit is individually meaningful after block reduction. Or add "piercing" tag at L3+ so `multi_hit` bypasses block (thematic: "overwhelm defenses with volume").

#### Issue 23: smite (23.4% WR, -12.2%)
**Priority:** Low
**Data:** 1,590 plays, 77 runs. 88% charge rate. CC scales with Knowledge Aura.
**Analysis:** Knowledge Aura is a running counter of correct charges — a stat that is hard to build in early encounters and resets per encounter. The scaling multiplier at L0 is too low to make the mechanic worthwhile. Players have to invest in charging many cards correctly just to make `smite` deal competitive damage.
**Recommendation:** Increase the Aura scaling coefficient at L0 (2× instead of 1×). Or change to "scales with total correct Charges THIS RUN" instead of per-encounter, so it is a snowball card that rewards cumulative performance.

#### Issue 24: hemorrhage (24.0% WR, -11.6%)
**Priority:** Medium
**Data:** 1,620 plays, 96 runs. 90% charge rate. Consumes all Bleed stacks for burst damage.
**Analysis:** `hemorrhage` is a finisher card — it needs Bleed stacks to deal damage. But Bleed-applying cards (`rupture`, `lacerate`, `twin_strike` with L3 tag) are not strong enough to consistently build stacks. The entire Bleed archetype is too weak to support a finisher. `hemorrhage` at L0 has bleed multiplier of 3, meaning 3 stacks = 9 damage — underwhelming for a combo card.
**Recommendation:** This is a build-diversity problem. Buff Bleed application cards (`rupture`, `lacerate`) to apply more stacks. Increase `hemorrhage` bleed multiplier from 3→5 at L0. Consider adding "also applies 2 Bleed before consuming" so `hemorrhage` self-primes.

#### Issues 25-31: inscription_fury, forge, emergency, reactive_shield, war_drum, archive, scavenge
**Priority:** Low-Medium
**Data:** All between 25-28% WR (-8 to -10% vs baseline).
**Analysis:** These share a common pattern: either too expensive for their effect (2 AP inscriptions), too situational (`emergency` needs low HP), or provide value that is hard to measure in combat wins (`archive` retains cards, `scavenge` retrieves from discard — both valuable but slow).
**Recommendation:** For inscriptions: reduce AP cost to 1 at L3+. For `emergency`/`reactive_shield`: increase base values by 30-50%. For `archive`/`scavenge`: add small damage or block bonus alongside their utility effect so they are not pure tempo loss.

---

## Category 7: AP Economy & Shield Viability

#### Issue 32: 2-3 AP Shields Are Unplayable
**Priority:** High
**Data:** Every shield mechanic costing 2+ AP is D-tier or worse: `bulwark` (9.4%), `fortify` (22.7%), `overheal` (16.9%), `guard` (31.0%), `double_strike` (23.1%). Meanwhile, 1-AP shields perform well: `block` (35.5%), `shrug_it_off` (28.1%), `absorb` (29.5%).
**Analysis:** With 3 AP per turn (hard cap 5), spending 2 AP on a shield means you can only play 1 more card. That remaining card must carry all your offense for the turn. Players mathematically cannot afford to play expensive shields AND deal enough damage to kill enemies before being ground down. The AP economy fundamentally punishes defensive investment.
**Recommendation:** Reduce ALL 2-AP shields to 1 AP at L3+ (matching the pattern of `heavy_strike`, `chain_lightning`, etc. that already do this). At L0, 2-AP shields should give significantly more value than two 1-AP shields would — otherwise there is no reason to play them. Consider a global rule: "2-AP shield cards gain +50% block value" to compensate for the opportunity cost.

#### Issue 33: AP Cost Never Reduces on 14 Cards
**Priority:** High
**Data:** 14 mechanics with 2+ AP that do not reduce at any mastery level: `double_strike`, `inscription_fury`, `inscription_iron`, `inscription_wisdom`, `overheal`, `fortify`, `guard`, `parry` (and more). Meanwhile, the standard pattern is -1 AP at L3 or L5 (`heavy_strike` 2→1, `chain_lightning` 2→1, `lifetap` 2→1, etc.).
**Analysis:** This is an inconsistency in the mastery stat tables. Cards that DO reduce AP at L5 are consistently higher-performing because the AP reduction is one of the most impactful mastery rewards. Cards stuck at 2 AP forever can never compete with cards that become 1 AP. This is likely an oversight rather than a design choice.
**Recommendation:** Add AP cost reduction at L3 or L5 for all 14 affected cards. Suggested: `inscription_fury`/`iron`/`wisdom` → 1 AP at L3, `overheal`/`fortify` → 1 AP at L5, `guard` → 1 AP at L5, `double_strike` → 1 AP at L5. This makes mastery progression feel rewarding for these cards and brings them in line with the standard pattern.

#### Issue 34: Buff Cards Dominate the Meta
**Priority:** Medium
**Data:** Top performing non-attack cards: `quicken` (46.6% WR, +11.0%), `warcry` (46.5%, +10.9%), `focus` (44.9%, +9.3%), `empower` (41.1%, +5.5%). All are 0-1 AP buffs that generate AP or amplify damage.
**Analysis:** AP generation (`quicken` gives +1 AP, `focus` makes next card free) is the most powerful effect because it lets you play MORE cards, each of which contributes damage. A 1-AP buff that grants +1 AP is net-zero cost with pure upside. This makes buff → attack → attack the dominant pattern, leaving no room for defensive strategies.
**Recommendation:** This is not necessarily a problem — buff→attack combos are fun. But defensive strategies should have a viable counter-equivalent. Consider creating "defensive buff" cards: a 1-AP card that gives "+50% block value on next 2 shield cards" would be the defensive equivalent of `empower`. Currently, no such card exists.

---

## Category 8: Player Skill & Archetype Dynamics

#### Issue 35: Accuracy Disproportionately Dominates
**Priority:** Medium (by design, but worth documenting)
**Data:** `gamer` (55% acc, high game skills) = 0.8% WR. `casual_learner` (65% acc, low game skills) = 4.5% WR. 10% accuracy gap = 5.6x WR difference. `scholar` (82% acc) = 65.3% WR.
**Analysis:** This is largely by design — Recall Rogue IS an educational game where knowledge matters. But the degree of dominance means card strategy, deck building, and relic choices are nearly irrelevant for mid-tier players. A player who knows the content but plays cards randomly will outperform a strategic genius who does not know the answers. Game skill becomes meaningful only once accuracy exceeds ~60%.
**Recommendation:** No change needed to the core formula. However, consider making Quick Play more viable so low-accuracy players can still progress with good strategy. Currently, QP at L0 deals only 3 damage (strike) — buffing L0 QP values by 30% would help strategic but low-accuracy players.

#### Issue 36: Card Selection is #1 Skill Axis
**Priority:** Low
**Data:** Isolated `cardSelection` at 1.0 = 11.2% WR (+4.2% over baseline ~7%). Highest impact of any single skill axis.
**Analysis:** Knowing which cards to play first (damage cards when enemy is weak, block when enemy attacks, buffs before combos) provides the largest win rate improvement. This suggests card ordering is meaningful, which is good game design. However, it also means "play the right card" matters more than "charge vs quick play" (`chargeSkill`: only +6.2%).
**Recommendation:** No fix needed — this is good design. Card selection SHOULD be the most impactful skill. Document this for game design reference: the turn puzzle (which cards in which order) is the core strategic loop.

#### Issue 37: Surge Awareness at 1.0 Hurts Win Rate
**Priority:** Medium
**Data:** Isolated `surgeAwareness` at 1.0 = 5.2% WR (-1.8% vs baseline ~7%). The ONLY skill axis where maximum skill hurts.
**Analysis:** Surge turns occur every 4th turn and waive the charge AP surcharge (currently 0, so this is a no-op). High `surgeAwareness` means the bot charges more aggressively on surge turns. But charging has risk (wrong answers deal fizzle damage or waste the turn). Since `CHARGE_AP_SURCHARGE = 0`, surge turns have no AP advantage — the bot is just charging more for no benefit. Note: CHARGE_AP_SURCHARGE = 0 is a deliberate balance constant set during the 2026-04-03 stat table overhaul, not a discovered bug. The question is whether to restore it (design decision), not whether it's broken (it's working as configured).
**Recommendation:** Either (a) make surge turns actually beneficial by restoring a small AP surcharge (e.g., `CHARGE_AP_SURCHARGE = 1`, waived on surge), giving surge awareness a real payoff, or (b) rework the `surgeAwareness` axis in BotBrain to not over-charge. The current state means the entire Surge system is mechanically inert — it fires every 4th turn but provides no strategic difference.

#### Issue 38: Gamer vs Casual Inversion
**Priority:** Low (consequence of Issue 35)
**Data:** `gamer` (55% acc, 0.6 cardSelection, 0.5 chargeSkill, 0.5 blockSkill) = 0.8% WR. `casual_learner` (65% acc, 0.2 cardSelection, 0.35 chargeSkill, 0.1 blockSkill) = 4.5% WR.
**Analysis:** Direct consequence of accuracy dominance. The 10% accuracy difference provides ~5x more benefit than the gamer's superior card selection, charge decision, and block skills combined. This means a player who studies the facts but button-mashes will outperform a Slay the Spire veteran who does not study.
**Recommendation:** This is intentional for an educational game. No fix needed, but document it as a design principle: "In Recall Rogue, knowledge IS power — literally."

#### Issue 39: Turtle Archetype Unviable (0.3% WR)
**Priority:** Medium
**Data:** Turtle profile (`blockSkill`=1.0, `chargeSkill`=0.2, 60% accuracy) = 0.3% WR. Only 1.23 avg acts completed.
**Analysis:** Pure defense does not work because block resets each turn (unless Fortify/Aegis Stone). You must deal damage to kill enemies. Turtle never charges (low `chargeSkill`), so it deals only Quick Play damage (~3/play). Enemies have 28+ effective HP. At 3 damage/play and 3 plays/turn, killing an enemy takes 3+ turns during which chip damage accumulates. Defense alone cannot win — you must also attack.
**Recommendation:** This is partially a build-diversity problem (Issue 43). To make defensive builds viable: (a) Add win conditions for defense (e.g., "enemy takes 1 damage per turn for each 5 block you have"), (b) Make block carry between turns by default (not just with Aegis Stone), (c) Create a shield card that converts excess block to damage. The goal: a player who invests in defense should be able to win through attrition, just slower.

**Update (post-audit controlled test):** At fixed 70% accuracy, turtle still has 0.1% WR — confirming this is NOT an accuracy confound. The root cause is `chargeSkill=0.2` (refuses to charge even when profitable at 70% accuracy). Defense without offense is genuinely unviable in the current damage model.

#### Issue 40: Speedrunner Archetype Unviable (0.4% WR)
**Priority:** Low
**Data:** Speedrunner (`apEfficiency`=1.0, `surgeAwareness`=1.0, accuracy=0.50) = 0.4% WR. 1.91 avg acts.
**Analysis:** Speed without accuracy means playing lots of cards but answering wrong frequently. High AP efficiency just means you efficiently spend AP on fizzled charges. The 50% accuracy is below the break-even point (~56%) where charging becomes better than quick-play. The speedrunner is essentially quick-playing everything at low QP values.
**Recommendation:** Low priority since this profile represents a degenerate strategy. However, making QP more viable (higher L0 QP values) would help all low-accuracy profiles including speedrunner.

**Update (post-audit controlled test):** At fixed 70% accuracy, speedrunner achieves 21.8% WR — nearly identical to chain_god (21.7%). The original 0.4% WR was entirely due to 50% accuracy being below the charge break-even point. **Speedrunner is a viable archetype when accuracy is sufficient.** Downgrading this issue from Low to Resolved.

---

## Category 9: Fun, Tension & Build Diversity

#### Issue 41: Acts 1-2 Trivial for Mid+ Players
**Priority:** High
**Data:** For `dedicated` (70% acc): 0% die in Act 1, 0.2% die in Act 2, 74.3% die in Act 3. For `scholar` (82% acc): 0% die in Acts 1-2, 34.8% die in Act 3. Acts 1-2 HP loss: -0.7/room (Act 1), -2.1/room (Act 2).
**Analysis:** Mid-tier and above players coast through Acts 1-2 with no real danger. This means 2/3 of the run has no tension — players are just going through the motions. The fun tension curve should be a gentle upward slope, not a flat line followed by a cliff. Rest sites, shops, and mysteries in Acts 1-2 feel meaningless because HP is always full and gold accumulates without pressure.
**Recommendation:** Increase Act 1-2 difficulty slightly: (a) Raise common enemy base attack by +1 in Segment 2, (b) Add 1-2 more elite encounters per act, (c) Introduce "mini-challenges" in early acts that cost HP but give rewards (risk/reward trade-offs). Target: `dedicated` profile should have 5-10% death rate in Act 2 (currently 0.2%).

#### Issue 42: Difficulty Cliff at Act 3
**Priority:** Critical (linked to Issue 1)
**Data:** HP change per room: Act 1 = -0.7, Act 2 = -2.1, Act 3 = -10.7. That is a 5x jump from Act 2 to Act 3. Act 3 boss alone is -77.7 HP.
**Analysis:** The ideal tension curve is gradual: each room should feel slightly harder than the last. Currently, the transition from Act 2 to Act 3 feels like hitting a wall. Players who cruised through Acts 1-2 with full HP suddenly lose 40-80 HP in a single encounter. This feels unfair — not "hard but fair" like Slay the Spire, but "impossible out of nowhere."
**Recommendation:** Smooth the curve: reduce Act 3 difficulty by 25% while increasing Act 2 difficulty by 25%. Spread the Segment 3/4 HP scaling more gradually (0.60→0.45 for Seg 3, 0.80→0.60 for Seg 4). Also reduce the jump in per-turn damage caps (18→15 for Seg 3, 28→22 for Seg 4). Target: HP change per room should progress -1 → -3 → -6 across acts, not -0.7 → -2.1 → -10.7.

#### Issue 43: No Build Diversity
**Priority:** High
**Data:** `chain_god` (61.0% WR) crushes turtle (0.3%), speedrunner (0.4%), and mastery_farmer (26.2%). The only viable strategy is "high accuracy + chain exploitation."
**Analysis:** Chain multipliers scale to 3.5× at 5-chain, meaning a `chain_god` with 80% accuracy deals 3.5× more damage than a non-chain player. No other mechanic provides anywhere near this multiplier. Defense does not win (Issue 39). Speed does not win (Issue 40). DoT builds (Bleed/Burn/Poison) do not have enough support cards. The meta has exactly one viable archetype.
**Recommendation:** Create viable alternative win conditions: (a) Buff DoT mechanics — poison/bleed/burn should be a legitimate kill path with dedicated support cards, (b) Add defensive win conditions (Issue 39), (c) Create an "AP engine" archetype where playing many cards per turn generates damage bonuses (reward speedrunner style), (d) Ensure mastery_farmer has a clear payoff — its 26.2% WR suggests mastery investment IS somewhat viable, just needs buffing.
**Caveat:** This finding is confounded by accuracy differences across archetype profiles (chain_god=80%, turtle=60%, speedrunner=50%). The comparison largely measures accuracy gaps, not strategic viability. A controlled test at fixed accuracy is needed before concluding that only one archetype is viable. Additionally, making turtle/speedrunner "viable" may create routes around the game's core educational mechanic — which the GDD explicitly forbids.

**Update (post-audit controlled test):** At fixed 70% accuracy, chain_god (21.7%) and speedrunner (21.8%) are equally viable — the original 61% vs 0.4% gap was entirely accuracy-driven. However, turtle (0.1%) and mastery_farmer (14.6%) remain non-viable even with controlled accuracy. Build diversity is better than originally reported (2 viable archetypes, not 1) but still needs work on defensive and mastery-focused builds.

#### Issue 44: Shield/Defensive Identity Dead
**Priority:** Medium (linked to Issues 32, 39)
**Data:** All shield-heavy cards underperform. Turtle archetype: 0.3% WR. `blockSkill` isolation: 6.6% WR (-0.4% vs baseline). Even isolated `blockSkill` at maximum barely helps.
**Analysis:** Block resets each turn, so defensive investment does not accumulate (unless Aegis Stone or Fortify carry). Enemy damage scales with floors but player block does not scale nearly as fast. There is no "shield payoff" — no card that converts high block into damage or other value. The game simply does not reward defense beyond "survive this one turn."
**Recommendation:** Introduce a "block payoff" card mechanic: "Deal damage equal to your current block" (conversion exists but is D-tier). Add more block-carry mechanics. Create a relic that rewards high block (e.g., "end turn with 15+ block: deal 5 damage to enemy"). The goal is making "build block, then cash it in" a viable strategy path.

#### Issue 45: Rest/Shop Decisions Outweigh Combat Skill
**Priority:** Low
**Data:** Skill axis isolation: `shopSkill` (9.0% WR, +2.0%) and `restSkill` (8.2% WR, +1.2%) both outperform `chargeSkill` (6.2% WR, -0.8%), `chainSkill` (7.2%), and `blockSkill` (6.6%).
**Analysis:** Meta-decisions (what to buy in shops, whether to heal or study at rest sites) have more impact than in-combat decisions (charge vs quick play, chain sequencing). This makes sense — shops give permanent run upgrades (relics, card removal), while individual combat decisions affect only that fight. The concern is whether this reduces combat engagement — if "what I do in combat does not matter much, only what I buy" players might disengage from the core gameplay loop.
**Recommendation:** This is partially acceptable (meta-strategy SHOULD matter in roguelites). But consider adding more in-combat decision weight: make chain multipliers more impactful (already the #1 strategy), add more risk/reward charge decisions, or introduce combat-specific resources that do not carry between rooms.

---

## Category 10: Economy & Technical

#### Issue 46: Act 3 Boss Gold Drop Cliff
**Priority:** Low
**Data:** Boss gold drops: Act 1 = 96.1g, Act 2 = 96.9g, Act 3 = 22.8g.
**Analysis:** Act 3 boss drops 76% less gold than Acts 1-2 bosses. This may be intentional (final boss does not need to give gold since there is nothing to spend it on afterward), but it feels unrewarding. Players who barely survive the hardest fight in the game get minimal reward.
**Recommendation:** If this is the final boss, gold does not matter and this is fine. If there are shops after Act 3 boss, increase gold to match Acts 1-2. Consider replacing gold with a more satisfying reward (extra mastery, permanent account progression).

#### Issue 47: Shop Skill Has Outsized WR Impact
**Priority:** Low
**Data:** `shopSkill` isolation = 9.0% WR (+2.0% over baseline). 2nd most impactful axis after `cardSelection`.
**Analysis:** Shop decisions (buy relics, remove weak cards, buy food) provide permanent run improvements that compound. This is standard roguelite design — resource management is strategic. The shop being important is not a problem; it is actually good design.
**Recommendation:** No fix needed. Document as design validation: "Shop decisions are the 2nd most impactful strategic axis, which is healthy for a roguelite."

#### Issue 48: relic-audit.ts Stale Import
**Priority:** Low
**Data:** `tests/playtest/headless/relic-audit.ts` imports `resolveComboStartValue` from `relicEffectResolver.ts`, but this export no longer exists.
**Analysis:** The function was likely renamed or removed during a refactor. The relic audit script crashes on startup.
**Recommendation:** Remove the stale import and update the script to use the current API. Check git log for when `resolveComboStartValue` was removed and what replaced it.

---

## Appendix A: Act 3 Enemy Breakdown

### Scaled HP by Floor (Boss Enemies)

| Floor | Boss | Base HP | Segment | Scaling | Actual HP | Damage Cap | vs Floor 6 |
|-------|------|---------|---------|---------|-----------|------------|------------|
| 3 | (Act 1 mid) | 12 | 1 | 1.2× | 57 | 7 | - |
| 6 | Final Exam | 12 | 1 | 1.5× | 72 | 7 | 1.0× |
| 9 | (Act 2 mid) | 12 | 2 | 3.0× | 144 | 12 | 2.0× |
| 12 | Algorithm | 12 | 2 | 3.75× | 180 | 12 | 2.5× |
| 15 | Group Project | 15 | 3 | 9.4× | 564 | 18 | 7.8× |
| 18 | Rabbit Hole | 17 | 3 | 11.2× | 761 | 18 | 10.6× |
| 21 | Omnibus | 18 | 4 | 17.0× | 1,224 | 28 | 17.0× |
| 24 | Final Lesson | 18 | 4 | 19.4× | 1,397 | 28 | 19.4× |

### The Final Lesson — Why It's a Wall

The floor 24 boss combines every punishment mechanic:

- **1,397 HP** — takes dozens of turns to kill
- **Quiz phases** — 5 questions at 66% HP, 8 rapid-fire (4s timer) at 33% HP
- **Wrong Charge penalty** — +2 permanent Strength (accelerating damage each wrong answer)
- **Phase 2** (at 33% HP) — attack value 6, multi_attack 4×4 hits (16 damage potential per action), Vulnerable 4 stacks for 3 turns
- **Heal** — 10-12 HP heals in both phases
- **Damage cap 28** — can deal up to 28 damage per turn

A scholar-level player needs roughly 40-50 turns to kill this boss. During that time, the boss accumulates Strength from wrong answers, heals multiple times, and phases into its most dangerous form. Even 1-2 wrong answers during the rapid-fire quiz phase can cascade into a death spiral via permanent Strength gain.

### Act 3 Elite Special Mechanics

| Elite | HP (scaled ~floor 20) | Special | Why It's Hard |
|-------|----------------------|---------|---------------|
| Dunning-Kruger | ~540 | chainMultiplierOverride: 1.0 | Disables all chain multipliers — the #1 player damage scaling mechanic |
| Singularity | ~540 | quickPlayDamageMultiplier: 0.3 | Quick Play deals 70% less damage — forces charging (risky) |

These elites invalidate player strategies: Dunning-Kruger punishes chain_god (the only viable archetype), and Singularity punishes quick-play (the safe fallback). Meeting both in Act 3 means you are guaranteed to face at least one encounter where your primary strategy does not work.

---

## Appendix B: Mastery L0→L5 Scaling Analysis

### F-Tier Root Causes

| Card | L0 QP | L5 QP | L5/L0 | AP L0 | AP L5 | Core Problem |
|------|-------|-------|-------|-------|-------|-------------|
| bulwark | 7 | 16 | 2.3× | 3 | 2 | AP too high, exhaust, 3 AP at L0 = entire turn |
| ironhide | 3 | 7 | 2.3× | 2 | 1 | 2 AP for 3 block + temp buff is worse than 2× basic block |
| inscription_wisdom | 0 | 0 | - | 2 | 2 | ZERO damage scaling, permanent 2 AP, exhausts |
| overheal | 3 | 8 | 2.7× | 2 | 2 | Permanent 2 AP, conditional benefit too narrow |
| inscription_iron | 1 | 4 | 4.0× | 2 | 2 | Good scaling but permanent 2 AP kills it |
| siphon_knowledge | 0 | 0 | - | 2 | 1 | Zero damage, 2 AP at L0 for 1 draw + 2s preview |

### AP Cost Inconsistency Table

**Cards that reduce AP at L3/L5 (standard pattern):**
`heavy_strike` (2→1), `chain_lightning` (2→1), `lifetap` (2→1), `smite` (2→1), `hemorrhage` (2→1), `slow` (2→1), `entropy` (2→1), `frenzy` (2→1), `ironhide` (2→1), `bulwark` (3→2), `siphon_knowledge` (2→1)

**Cards that NEVER reduce AP (inconsistent with standard pattern):**
`double_strike` (2→2), `inscription_fury` (2→2), `inscription_iron` (2→2), `inscription_wisdom` (2→2), `overheal` (2→2), `fortify` (2→2), `guard` (2→2), `parry` (inherits, does not explicitly reduce)

### Best and Worst Scaling Ratios

**Top 5 scaling (L5/L0 QP ratio):**
1. `parry`: 1→5 (5.0×)
2. `kindle`: 1→4 (4.0×), `inscription_iron`: 1→4 (4.0×)
3. `emergency`: 2→7 (3.5×)
4. `piercing`: 2→6 (3.0×), `reckless`: 4→12 (3.0×), `lacerate`: 1→3 (3.0×), `multi_hit`: 1→3 (3.0×), `volatile_slash`: 4→12 (3.0×), `thorns`: 2→6 (3.0×)

**Bottom 5 scaling (excluding 0-QP utility):**
1. `heavy_strike`: 7→12 (1.71×) — starts high but scales poorly
2. `guard`: 8→14 (1.75×) — starts very high but barely improves
3. `precision_strike`: 5→9 (1.80×) — difficulty scaling compensates
4. `reinforce`: 5→9 (1.80×) — starts decent, gains little
5. `twin_strike`: 2→4 (2.0×) — hit count increase compensates

---

## Appendix C: Fun & Feel Analysis

### Tension Curve Problem

**Current state:** Flat → Flat → CLIFF

```
Tension
  |                                    XXXX
  |                                    XXXX
  |                                    XXXX
  |                              XXXXXXXXXX
  |                              XXXXXXXXXX
  |  ........ ..........         XXXXXXXXXX
  +--------------------------------------------> Rooms
     Act 1         Act 2         Act 3
```

**Target state:** Gradual ramp with spikes at bosses

```
Tension
  |                                 XXXX
  |                           XXXX  XXXX
  |                     XXXX  XXXX  XXXX
  |               XXXX  XXXX  XXXX  XXXX
  |         XXXX  XXXX  XXXX  XXXX  XXXX
  |  ..XXXX XXXX  XXXX  XXXX  XXXX  XXXX
  +--------------------------------------------> Rooms
     Act 1         Act 2         Act 3
```

The current flat→cliff curve creates two problems:
1. **Boredom in Acts 1-2** — no meaningful risk, decisions do not matter
2. **Frustration in Act 3** — sudden difficulty spike feels unfair, not "hard but fair"

### Build Diversity Problem

**Viable archetypes:** 1 (chain_god)
**Target:** 4-5 viable archetypes with different strengths

| Archetype | Current WR | Target WR | What's Missing |
|-----------|-----------|-----------|----------------|
| Chain God | 61.0% | 45-55% | Slightly overpowered; consider reducing chain multiplier cap from 3.5× to 3.0× |
| Mastery Farmer | 26.2% | 30-40% | Needs faster mastery payoff in combat |
| DoT Builder | N/A | 25-35% | No dedicated archetype — need poison/bleed/burn synergy cards |
| Turtle/Attrition | 0.3% | 20-30% | Need defensive win conditions and block carry |
| Speedrunner | 0.4% | 15-25% | Need QP buffs and "plays many cards" payoffs |

### Reward Loop & Dopamine

**What feels great right now:**
- Getting `scavengers_eye` or `merchants_favor` (because they are OP — fix the power, keep the feeling)
- Chain multiplier escalation (visual + mechanical feedback is satisfying)
- Mastery upgrade notifications (clear progression signal)

**What feels bad right now:**
- Drawing `inscription_wisdom`, `bulwark`, or `ironhide` (trap cards that hurt your run)
- Hitting the Act 3 wall after breezing through Acts 1-2 (sudden failure)
- Wrong-answer death spirals at Act 3 boss (+2 Str per wrong creates hopelessness)
- No meaningful decisions in Acts 1-2 (autopilot feeling)

### Quiz Pressure vs Fun

The quiz system creates a unique tension: "I need to answer correctly to deal damage." This is the core innovation of the game. But when accuracy determines 80%+ of win rate, the game becomes a quiz app with card-game wrapping rather than a card game that uses quizzes.

**Healthy balance:** Accuracy matters for 50-60% of outcomes, strategy for 40-50%.
**Current state:** Accuracy matters for ~80% of outcomes, strategy for ~20%.

To shift this: buff Quick Play values so strategic card selection at lower accuracy is viable. Make "play the right card at the right time" worth more relative to "answer correctly."

### New Player Onboarding

**Current:** 45% accuracy = 0% win rate. New players will lose every run with zero progress feeling.
**Target:** First-time players should feel progress even when losing — clear "I got further this time" signals.

Recommendations for new player experience:
1. Act 1 should be completable at 40% accuracy with good strategy (not 45% minimum)
2. Show "personal best floor" and "enemies defeated" metrics prominently
3. Add "learning mode" for first 3 runs: reduced enemy HP/damage, more heal opportunities
4. Starter deck should include 1-2 pre-mastered cards (L1-L2) so the floor is not L0 everything

---

## Prioritized Action Plan

### Pre-Sprint: Methodology Fixes (Required Before Acting)
0. ~~Run forced-relic simulations~~ — **DONE 2026-04-04**: All 4 relics tested. scavengers_eye/merchants_favor/gold_magnet have zero causal effect. steel_skin +2.8% (modest).
1. ~~Re-run archetypes at fixed 70% accuracy~~ — **DONE 2026-04-04**: chain_god (21.7%) ≈ speedrunner (21.8%). Turtle still broken (0.1%). Mastery_farmer = baseline.
2. **Add shop/removal/deck-size tracking** to full-run sim output — Fill the missing analysis gaps
3. ~~Resolve chain multiplier GDD/code discrepancy~~ — **DONE 2026-04-04**: GDD updated to match code [1.0, 1.2, 1.5, 2.0, 2.5, 3.5].
4. ~~Calculate enrage DPS at turn 40~~ — **DONE 2026-04-04**: Global enrage adds +114 uncapped damage at turn 40. Enrage bypasses per-turn damage cap (added after cap in turnManager.ts). THIS is the Act 3 boss wall — not stats. Fix: reduce ENRAGE_PHASE2_BONUS from +3 to +1, or make enrage subject to damage cap.

### Sprint 1: Critical Fixes (Highest Impact)
1. ~~Smooth the difficulty curve~~ — **DONE 2026-04-04**: Root cause was enrage bypassing damage cap, not boss HP. Fixed: (a) enrage bonus now re-capped against per-turn damage cap in turnManager.ts, (b) ENRAGE_PHASE2_BONUS reduced 3→2. WR impact: regular 2.8%→67.3%, dedicated 25.5%→92.2%. Game is now too easy at baseline — needs follow-up difficulty tuning.
2. ~~Fix ascension scaling~~ — **DONE 2026-04-04**: Reduced starter relics (Asc 20: 3→2, Asc 10: 2→1), reduced relic trigger bonus (+50%→+25%), removed redundant freeCharging. **Inversion fixed:** Asc 0=67% → Asc 5=63% → Asc 10=61% → Asc 15=46% → Asc 20=11%. Properly descending curve now.

**NOTE:** Baseline WR is now very high (regular 67%, dedicated 92%). The enrage cap fix removed the primary difficulty source. Follow-up tuning needed: increase base enemy damage, reduce rest site healing, or tighten the damage cap. This should be Sprint 3-4 work — the uncapped enrage was a bug, not intended difficulty.
3. ~~Nerf scavengers_eye~~ — **RETRACTED**: causal test shows no effect. No action needed.
4. ~~Nerf merchants_favor~~ — **RETRACTED**: causal test shows no effect. No action needed.

### Sprint 2: Card Balance Pass
5. ~~AP cost consistency~~ — **DONE 2026-04-04**: Added AP reduction at L3/L5 for 7 stuck cards (fortify, overheal, guard, double_strike, inscription_fury/iron/wisdom). inscription_wisdom +14.1% WR, fortify +11.7% WR in combat mode. No full-run WR impact (mastery rarely reaches L3).
6. **F-tier card rework** — `bulwark` (still 9.7% WR — needs exhaust removal + AP reduction), `overheal` (15.9% — AP fix helped minimally, needs base value increase), `ironhide` (15.6% — needs base block increase). `inscription_wisdom` and `fortify` are now mid-tier after AP fix.
7. ~~steel_skin nerf~~ — **Deprioritized**: causal effect is only +2.8%, within acceptable bounds. Monitor only.

### Sprint 3: Build Diversity
8. **Shield viability** — Add block-to-damage conversion payoff, make block carry more accessible
9. **DoT archetype** — Buff bleed/poison application rates, add DoT synergy cards
10. **Surge system** — Restore `CHARGE_AP_SURCHARGE` to 1 (waived on surge turns) to make surge meaningful

### Sprint 4: Polish & Feel
11. **New player safety net** — Act 1 damage cap 7→5, or "learning mode" for first runs
12. **Tension curve smoothing** — Gradual room-by-room difficulty increase, not per-act jumps
13. **Gold economy** — Equalize boss gold drops across acts (or replace with meaningful rewards)
