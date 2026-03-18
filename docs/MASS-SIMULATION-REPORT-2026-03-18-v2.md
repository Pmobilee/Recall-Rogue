# Mass Simulation Balance Report — 2026-03-18 (V2)

**1,960,960 total simulations | HeadlessCombatSimulator v2 | Full Progression Model**

---

## Executive Summary

V2 represents a qualitative leap in simulator fidelity. Where V1 used a frozen starting deck and ignored strategic decision-making, V2 models the full run progression: Quick Play vs. Charge decisions, the surge system, knowledge chains, card rewards, relic rewards, deck thinning, synergy-aware shopping, and haggling. The result is a significantly harder baseline — and a much more honest picture of what real players experience.

**The five most critical findings:**

1. **Survival rates are critically low across all profiles without relics.** Regular players at Ascension 0 survive 0% of runs (no relics), scholars survive only 7%. The research target for regular players is 30–50%. The game is currently unwinnable for the majority of players unless they accumulate relics — and relic acquisition in the current model is not guaranteed. This is the single most urgent balance failure.

2. **Charging is essential, not optional.** Force Charge vs. Force Quick produces a 35.4% vs. 0% survival differential for scholars. Players who don't understand or can't execute the Charge mechanic are functionally locked out of winning. The Mixed (realistic) strategy produces 5.3% survival — far below the no-relic target. The charge mechanic needs better onboarding and must be more accessible at lower accuracy tiers.

3. **Gold efficiency has collapsed to 43.2%.** Players spend less than half the gold they earn. The economy is not functioning — shop prices, item utility, or both are miscalibrated. A healthy economy sees 70–85% gold utilization; the current state wastes the shop as a progression lever.

4. **Overkill rate (4.0%) is still below the research target (10–20%).** Players almost never feel powerful. While V2 improved this from V1's 1.0%, the gap remains large. The power fantasy of combo chains and charged attacks isn't manifesting as decisive victories.

5. **Phoenix Feather remains catastrophically overpowered** (32,470 score vs. second-best Aegis Stone at 895 — a 36x gap). This is not a relic; it is a win button. The tier gap between S and A is wider than the gap between A and the rest of the alphabet.

**Recommended immediate changes (in priority order):**

| Priority | Parameter | Current | Recommended | Impact |
|----------|-----------|---------|-------------|--------|
| P0 | phoenix_feather lethal saves | Unlimited | Cap at 1 per run | Fixes broken S-tier |
| P0 | floorDamageScalingPerFloor | 0.04 | **0.02** | Strongest correlation r=+0.668 |
| P1 | playerStartHP | 100 | **120** | Second strongest r=-0.346 |
| P1 | baseEffectAttack | 10 | **11** | Increases DPS viability |
| P1 | baseEffectShield | 8 | **10** | Improves defensive parity |
| P2 | comboMultipliers | [1,1.1,1.2,1.3,1.5] | **[1,1.15,1.3,1.5,2.0]** | Overkill rate fix |
| P2 | postEncounterHealCap | capped | **Remove all caps (1.0)** | Economy of healing |
| P3 | Shop prices | current | Reduce by ~30% | Fix gold efficiency |

---

## Research Alignment Scorecard

| Metric | Target | Actual | Status | Notes |
|--------|--------|--------|--------|-------|
| Near-miss rate | ~30% | Not directly measured | — | Close-call proxy: 23.8% |
| Close-call win rate | 15–25% | **23.8%** | GREEN | Within target band |
| Overkill win rate | 10–20% | **4.0%** | RED | 2.5× below minimum target |
| Quiz accuracy (per play) | 80–85% | **81.8%** (Attack) | GREEN | Attack cards on target |
| Buff card accuracy | 80–85% | **77.5%** | YELLOW | Below floor; misclick risk |
| Deck size end-of-run | 20–25 cards | Not measured in V2 | — | Need instrumentation |
| Survival (regular, asc0, no relics) | 30–50% | **0%** | RED | Catastrophic miss |
| Survival (first_timer, asc0) | 5–15% | **0%** | RED | New players cannot win |
| Survival (scholar, asc0) | 60–75% | **7%** | RED | Experts should feel powerful |
| Survival (scholar, asc0, with relics) | 60–75% | **27.7%** (8 relics) | RED | Even max relics insufficient |
| Combo peak 5+ | 1–3× per run | Not measured in V2 | — | Need combo frequency data |
| Gold efficiency | 70–85% spent | **43.2%** | RED | Economy nearly non-functional |
| Surge utilization (intermediate+) | 80%+ | Not measured in V2 | — | Need instrumentation |
| Charge rate (optimal profiles) | 70–85% | Mixed ~50% forced | YELLOW | Force Charge outperforms Mixed |
| Floor 1 survival | >95% | **98.7%** | GREEN | Safe intro maintained |
| Session length | 25–30 min (12–24 floors) | ~14–21 floors avg | YELLOW | Low end; asc0 cuts short |

**Scorecard Summary: 3 GREEN, 3 YELLOW, 6 RED**

The game passes introductory safety (Floor 1) and has solid quiz accuracy for attack cards, but fails on the core survival metrics that define a playable roguelite. Gold economy and overkill/power-fantasy metrics are both deep red.

---

## Section 1: Survival Rates vs. Targets

### The Core Problem

The research target for a standard roguelite is 30–50% completion rate for average players at baseline difficulty (Ascension 0). Recall Rogue's V2 data shows **0% survival for every profile below "dedicated" (65% accuracy) without relics.** This is not a close miss — it is a different order of magnitude.

### Control Baseline Data (Normal Mode, No Relics)

| Profile | Accuracy | Asc 0 | Asc 5 | Asc 10 | Research Target (Asc 0) |
|---------|----------|-------|-------|--------|------------------------|
| first_timer | 47% | 0% | 0% | 0% | 5–15% |
| developing_newbie | 55% | 0% | 0% | 0% | ~15% |
| regular | 58% | 0% | 0% | 0% | 30–50% |
| dedicated | 65% | 3% | 0% | 0% | ~50% |
| scholar | 75% | 7% | 1% | 1% | 60–75% |

Every single cell is below research target. At Ascension 0, scholars survive at 7% — 8–10× below the 60–75% target for expert players. Regular players survive at 0% — the equivalent of a coin flip mechanic that always lands tails.

### Relaxed Mode: Slightly Better, Still Broken

| Profile | Asc 0 | Asc 5 | Asc 10 |
|---------|-------|-------|--------|
| regular | 1% | 0% | 0% |
| dedicated | 5% | 1% | 1% |
| scholar | 19% | 7% | 2% |

Relaxed mode (presumably reduced enemy scaling) helps scholars reach 19% but still falls short of the 60–75% target. The mode provides approximately 2–3× survival improvement but the baseline is so low that even 3× still lands in the unacceptable range.

### Relic Dependency Is a Design Failure at Current Rates

The relic scaling data reveals that survival requires a relic stack the game may not reliably deliver:

| Relics | Survival |
|--------|----------|
| 0 | 0.9% |
| 1 | 1.2% |
| 3 | 1.8% |
| 5 | 3.7% |
| **8** | **27.7%** |

The jump from 5 relics (3.7%) to 8 relics (27.7%) is a 7.5× multiplier, but 8 combat relics represents a late-run accumulation. If a player is losing before floor 15, they never reach 8 relics. The survival curve is back-loaded to the point of irrelevance — you must already be winning to get the tools to win.

### Root Cause Analysis

The parameter sensitivity sweep identifies **floorDamageScalingPerFloor** (r = +0.668) as the primary lever. At the current value of 0.04, enemies scale approximately 4% harder per floor. By floor 20, an enemy deals 80% more damage than floor 1. This outpaces player power growth (which is capped by deck size, charge timing, and relic accumulation), creating an inevitable death spiral.

**Recommended fix: Reduce floorDamageScalingPerFloor from 0.04 → 0.02.** This alone — the single highest-leverage change available — should be the first thing shipped.

---

## Section 2: The Charging Decision

### Quick Play vs. Charge: The Defining Design Tension

V2's most significant new finding concerns the strategic value of the Charge mechanic. The data reveals a stark binary: players who Force Charge win; players who don't, don't.

### Mixed Strategy Results

| Profile | Strategy | Asc 0 Survival | Asc 0 Floor | DPS |
|---------|----------|----------------|-------------|-----|
| scholar | Force Quick | 0% | 13.6 | 22.3 |
| scholar | Force Charge | **35.4%** | 21.5 | 45.4 |
| scholar | Mixed (realistic) | 5.3% | 19.7 | 37.9 |
| regular | Force Quick | 0% | 9.2 | 16.2 |
| regular | Force Charge | 4.3% | 16.2 | 29.1 |
| regular | Mixed (realistic) | 0% | 14.4 | 25.2 |
| dedicated (relaxed) | Force Quick | 0% | 13.2 | 21.1 |
| dedicated (relaxed) | Force Charge | **24.9%** | 20.1 | 42.3 |
| dedicated (relaxed) | Mixed | 1.9% | 18.2 | 41.1 |

### Key Findings

**Finding 1: Charging is not optional — it's the only path to victory.**
Force Charge scholars survive at 35.4%. Mixed scholars survive at 5.3%. Force Quick scholars survive at 0%. The game is currently only winnable by players who consistently choose to charge every card, every turn. This represents a design clarity failure: a core mechanic that must be used exclusively isn't a choice mechanic, it's a hidden mandatory mode.

**Finding 2: The DPS differential explains the survival gap.**
Force Charge produces 45.4 DPS vs. Force Quick's 22.3 — a 2× multiplier. In a game where floor scaling compounds against players, a 2× DPS advantage is the difference between life and death by floor 15.

**Finding 3: Mixed strategy underperforms its components.**
Mixed strategy (5.3%) significantly underperforms Force Charge (35.4%), even though it uses charging most of the time. This suggests that the moments when players choose Quick Play are disproportionately punishing — possibly because Quick Play is selected at high-stakes moments when timing pressure exists, and the reduced damage at those moments allows enemies to deal lethal follow-up damage.

**Finding 4: The charge threshold for viability is accuracy-dependent.**
Regular players at 58% accuracy cannot achieve meaningful survival even with Force Charge (4.3%). The quiz difficulty at 58% accuracy creates too many fizzles and incorrect answers to build the combo chains that make charging worthwhile. The charge mechanic implicitly requires 70%+ accuracy to function as designed.

### Design Recommendations

1. **Clarify that charging is almost always correct.** The UI should communicate the value proposition. Consider a "charge efficiency" indicator or a first-time tooltip that explains the DPS math.
2. **Reduce the accuracy floor for charge viability.** If charging only works for players with 70%+ accuracy, the mechanic excludes the majority of the player base. Consider buffing the base damage on a successful charge or reducing charge time requirements.
3. **Investigate why Mixed underperforms Force Charge by 30%.** There may be a specific scenario (e.g., charging during a boss encounter vs. a regular room) where Quick Play is situationally better, and the mixed strategy is making wrong calls.

---

## Section 3: Floor Difficulty Curve

### Where Are the Walls?

The deep analytics dataset (630K runs) provides floor-by-floor survival and damage data. The curve reveals a game that front-loads safety and then applies escalating pressure that becomes lethal around floor 15.

### Floor Survival Data

| Floor | Survival | Dmg Dealt | Dmg Taken | HP Left | Assessment |
|-------|----------|-----------|-----------|---------|------------|
| 1 | 98.7% | 157 | 14 | 100 | GREEN — Safe intro |
| 3 (boss) | 88.9% | 279 | 33 | 87 | GREEN — Appropriate first wall |
| 6 (boss) | 91.1% | 346 | 35 | 92 | YELLOW — Easier than F3 (anomaly) |
| 9 (boss) | 86.3% | 407 | 44 | 79 | GREEN — Steady pressure |
| 12 (boss) | 84.7% | 468 | 52 | 77 | YELLOW — Approaching critical |
| 15 (boss) | 78.5% | 524 | 59 | 64 | RED — Late-game cliff begins |
| 18 (boss) | 75.1% | 580 | 67 | 61 | RED — Severe attrition |
| 21 (boss) | 63.1% | 618 | 70 | 43 | RED — Brutal |
| 24 (boss) | 65.0% | 674 | 73 | 46 | YELLOW — Slight recovery (selection bias) |

### Analysis

**The Floor 6 anomaly**: Floor 6 survival (91.1%) is higher than Floor 3 (88.9%), which means Floor 6 is easier than Floor 3. Boss encounters should generally escalate. This suggests either the Floor 6 boss has a stat error or the Floor 3 boss is tuned too aggressively for its position. Investigate boss stat assignments for these two encounters.

**The Floor 15 cliff**: Survival drops from 84.7% at F12 to 78.5% at F15 — a 6.2 percentage point drop in three floors. This is the steepest drop in the entire curve and represents the primary "wall" where most runs die. At F15, HP has depleted from 100 to 64 on average, meaning players are entering the late game at 64% health with increasing damage intake. The heal-to-damage ratio becomes unfavorable here.

**The Floor 24 recovery (selection bias)**: Floor 24 survival (65.0%) is higher than Floor 21 (63.1%). This is almost certainly survivorship bias — only the strongest, luckiest, or most-reliced runs reach floor 24, so a higher proportion of them survive. This is not a real improvement in the difficulty curve.

**HP trajectory reads correctly**: HP drains from 100 → 87 → 92 → 79 → 77 → 64 → 61 → 43 → 46. The general downward trend is appropriate, but the F3→F6 reversal (87→92) confirms the Floor 6 anomaly. Players should not be gaining HP between boss encounters unless healing encounters are disproportionately common in that floor range.

### Recommended Curve Adjustments

1. **Audit Floor 3 and Floor 6 boss stats.** The reversal at F6 is likely a data or design error.
2. **Reduce the F12→F15 cliff.** Consider a healing encounter guaranteed between F12 and F15, or reduce boss damage scaling in this window by 10–15%.
3. **Target HP at F15 boss entry: 75–80 (not 64).** This requires either better healing access or lower enemy damage scaling in the F9–F15 range.

---

## Section 4: Fun Factor Analysis

### Research Targets vs. Actuals

| Metric | Research Target | V2 Actual | Status |
|--------|----------------|-----------|--------|
| Close-call win rate | 15–25% | **23.8%** | GREEN |
| Overkill win rate | 10–20% | **4.0%** | RED |
| Comeback win rate | Not specified | 37.0% | Informational |
| Avg min HP reached | Want low (tension) | **2.47** | GREEN — High tension |

### Close-Call Analysis (GREEN)

At 23.8%, close-call wins sit at the upper end of the 15–25% research target. This is one of V2's genuine successes. Players frequently experience the "barely survived" emotional response that drives roguelite replayability. The average minimum HP reached (2.47) confirms that even winning runs typically involve a brush with death — this is the intended experience.

The V1→V2 improvement here is significant: V1 measured 16.1% (low end of target); V2's 23.8% reflects the more realistic play modes creating more genuine tension. The improved simulator produces better fun metrics even as it produces worse survival rates.

### Overkill Analysis (RED)

At 4.0%, overkill wins are 2.5× below the minimum research target of 10% and 5× below the ideal target of 20%. This means players almost never feel powerful. The "decisive victory" emotional peak — where a combo chain tears through the final boss — occurs in roughly 1 in 25 winning runs.

**Why is overkill so low?** Two contributing factors:

1. **Combo multiplier curve is too shallow.** Current multipliers [1, 1.1, 1.2, 1.3, 1.5] max out at 1.5× for a 5-combo chain. The proposed new curve [1, 1.15, 1.3, 1.5, 2.0] doubles the peak multiplier. A 2.0× combo bonus on a charged attack should create genuine overkill scenarios.

2. **Survival is too hard.** Players are so focused on not dying that they never accumulate the resource advantage needed for overkill wins. When every run is a desperate grind to floor 10, the "power fantasy" half of the game never activates. Fixing survival rates should naturally increase overkill rates.

### Comeback Analysis (Informational)

The 37.0% comeback win rate — where players win after reaching critically low HP — is striking. More than a third of all wins involve a comeback from near-death. This is higher than expected and suggests the game's tension is real and frequent. Combined with the 2.47 average minimum HP, the data paints a picture of a game where comebacks are nearly mandatory for winning runs.

This is not purely positive: if comebacks are required rather than exciting exceptions, the game's difficulty calibration is off. The ideal is comebacks as a ~20% experience, not a 37% one.

---

## Section 5: Card Effectiveness

### Accuracy vs. Research Target (80–85%)

| Card Type | Accuracy | Target | Status | Fizzle Rate |
|-----------|----------|--------|--------|-------------|
| Attack | 81.8% | 80–85% | GREEN | 18.2% |
| Shield | 80.7% | 80–85% | GREEN | 19.3% |
| Utility | 82.1% | 80–85% | GREEN | 17.9% |
| Buff | **77.5%** | 80–85% | YELLOW | **22.5%** |
| Debuff | 83.1% | 80–85% | GREEN | 16.9% |
| Wild | 83.5% | 80–85% | GREEN | 16.5% |

### Analysis

**Attack, Shield, Utility, Debuff, and Wild cards** all fall within the 80–85% accuracy target. This is a genuine balance success — the quiz difficulty calibration for these card types is correct. Wilson et al. 2019 identifies this band as the optimal zone for learning retention while maintaining gameplay viability.

**Buff cards (77.5%) are a YELLOW flag.** At 22.5% fizzle rate, roughly 1 in 4 Buff cards fails. Buff cards are the only card type meaningfully below the accuracy floor. Two possible causes:

1. **Buff card facts are harder.** If Buff cards are assigned to more obscure knowledge domains, their question pool may be disproportionately difficult.
2. **Players are playing Buff cards at suboptimal times.** If Buff cards are played when time pressure is high (low HP, large incoming attack), players may be rushing answers and fizzling more often.

**Wild cards (329K plays)** have very low representation compared to Attack (145.8M) and Shield (51.9M). This may be intentional (Wild cards are rare), but the dataset is small enough that Wild card statistics may not be representative.

### Fizzle Rate Assessment

The overall fizzle rate (17–22% depending on card type) is approximately correct for the 80–85% accuracy target. However, the distribution of fizzle consequences matters:

- Attack card fizzles (18.2%): Player deals 0 damage that turn — survivable but costly
- Shield card fizzles (19.3%): Player takes full enemy damage — often lethal in late game
- Buff card fizzles (22.5%): Player wastes a turn — particularly costly since Buff cards are already rare

Shield fizzles at high floors may be contributing to the F15+ cliff. If players use Shield cards at critical moments and fizzle, the result is frequently death.

**Recommendation:** Consider reducing the consequence of Shield fizzles specifically. Rather than "fizzle = take full damage," explore "fizzle = take 50% reduced damage but no block." This maintains the risk/reward without creating instant-death moments.

---

## Section 6: Economy Health

### Critical Finding: Economy Is Not Functioning

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Gold efficiency (spent/earned) | 70–85% | **43.2%** | RED |
| Avg gold earned | — | 1,682 | Informational |
| Avg gold spent | — | 727 | Informational |
| Avg food purchased | — | 0.78 | Informational |

Players earn an average of 1,682 gold per run but spend only 727 (43.2%). More than half the gold players earn is never spent. This represents a systemic economy failure — the shop is not functioning as a progression lever.

### Possible Causes

**Hypothesis 1: Shop prices are too high.** If shop items cost more than players are willing to spend relative to their perceived value, gold accumulates. A player with 200 gold who sees a 300-gold relic will pass every time.

**Hypothesis 2: Shop item quality is too low.** If players don't value what's available (C/D-tier relics, weak cards), they rationally hoard gold for better options that never appear.

**Hypothesis 3: Players die before spending.** If most runs end by floor 12 (which the survival data suggests), players may not reach enough shop visits to spend their gold. They die with a full wallet.

**Hypothesis 4: Haggling mechanic is underutilized.** If haggling requires a relic or specific condition, it may not be available early enough to matter.

The most likely culprit is a combination of Hypotheses 2 and 3. The relic tier list shows that 24 of 37 relics are C-tier or lower — a player reaching a shop with 600 gold who sees a C-tier relic will pass. With D-tier relics that can have negative impact, rational players learn to skip shops entirely.

### Food Economy (0.78 food per run)

Less than one food item purchased per run. Food restores HP and is presumably available in shops. At 0.78 purchases, food is either too expensive, too rare, or healing is perceived as not worth the cost. Given the critical importance of HP management (64 HP entering the F15 boss), underuse of food suggests price calibration issues.

### Recommended Economy Changes

1. **Reduce shop prices by 25–35%** across all categories. Target 70% gold efficiency as the floor.
2. **Audit and remove D-tier relics** from the shop pool. Negative-impact relics teach players not to shop.
3. **Guarantee at least one A-tier or higher relic** in every shop that appears after floor 10.
4. **Investigate food pricing.** If a food item heals 20 HP and costs 300 gold, players will pass. Target food at roughly 10 gold per HP restored.

---

## Section 7: Relic Balance

### Tier Distribution

| Tier | Count | Score Range | Assessment |
|------|-------|-------------|------------|
| S | 7 | 54–32,470 | Catastrophically spread |
| A | 3 | 39–40 | Compressed; nearly identical |
| B | 2 | 17–22 | Very thin |
| C | 15 | 0.1–22 | Junk drawer |
| D | 10 | Negative | Actively harmful |

### Phoenix Feather: The Broken Relic

Phoenix Feather scores 32,470. The second-best relic, Aegis Stone, scores 895. The gap is **36×**. This is not a tier difference — it's a different game. Phoenix Feather provides unlimited lethal saves; any relic that prevents death an unlimited number of times will dominate all survival metrics.

**Fix: Cap phoenix_feather lethal saves at 1 per run.** This is the same fix identified in V1. A once-per-run "cheat death" is a powerful and emotionally satisfying relic. Unlimited cheat deaths are a design error.

After capping, phoenix_feather's score will normalize to somewhere in A/B tier, dramatically compressing the tier list and making relic choice meaningful.

### The S-Tier Cluster Problem

Even removing phoenix_feather, the S-tier has a spread problem. Aegis Stone (895), Combo Ring (369), Iron Shield (293), Last Breath (131), Whetstone (84), and Blood Price (54) vary by 16× between the highest and lowest. These relics are all strong, but their power differential means rational players will take Aegis Stone and Combo Ring whenever available, ignoring the rest.

**Target S-tier spread: 2–3× between best and worst.** Buff Blood Price and Whetstone to bring them closer to Combo Ring's 369.

### A-Tier Compression Problem

Prismatic Shard (40), Regeneration Orb (40), and Overflow Gem (39) are essentially identical in score. This is actually good calibration for a tier — it means A-tier choices are genuine decisions. However, the gap between A-tier (40) and S-tier (54–895) is large enough that S-tier relics remain obviously superior.

### D-Tier: Actively Harmful Relics Poison the Shop

Domain Mastery Sigil, Time Warp, Chain Reactor, Steel Skin, Festering Wound, Herbal Pouch, and Echo Chamber all score negative. A relic with a negative score makes the player worse. These relics should not exist in the shop pool. Players who take them are punished for engaging with the economy.

**Immediate action: Remove all D-tier relics from the shop.** Redesign them or archive them. A player who picks up a relic expecting a bonus and instead gets a debuff will not pick up relics again. This is the likely contributor to low gold efficiency — players learned that buying relics is dangerous.

### Recommended Relic Changes

| Relic | Current Score | Action |
|-------|--------------|--------|
| phoenix_feather | 32,470 | Cap saves at 1 per run |
| aegis_stone | 895 | No change (well above baseline) |
| combo_ring | 369 | No change |
| blood_price | 54 | Buff passive trigger rate +50% |
| whetstone | 84 | Buff charge damage bonus +25% |
| All D-tier (10 relics) | Negative | Remove from shop pool immediately |
| All C-tier (15 relics) | 0.1–22 | Audit; buff bottom half to 30+ |

---

## Section 8: Recommended Balance Changes

All recommendations are grounded in research targets and simulation sensitivity data.

### Priority 0 (Ship This Week)

**1. Cap phoenix_feather at 1 lethal save per run**
- Current: Unlimited saves
- Recommended: 1 per run
- Rationale: 36× gap over second-best relic destroys tier meaningfulness and distorts all survival metrics
- Expected impact: Normalize relic tier list; improve shop value perception

**2. Remove D-tier relics from shop pool**
- Current: 10 relics with negative scores available in shops
- Recommended: Remove from shop; flag for redesign
- Rationale: Negative relics teach players to distrust shops; primary driver of 43.2% gold efficiency
- Expected impact: Gold efficiency increase toward 60%+

### Priority 1 (Next Balance Patch)

**3. Reduce floorDamageScalingPerFloor: 0.04 → 0.02**
- Sensitivity: Pearson r = +0.668 (strongest correlation in dataset)
- Rationale: Halving floor scaling gives players more runway to accumulate power; targets the root cause of 0% regular-player survival
- Expected impact: Regular Asc0 survival likely increases from 0% to 10–25%

**4. Increase playerStartHP: 100 → 120**
- Sensitivity: Pearson r = -0.346 (second strongest correlation)
- Rationale: 20 additional starting HP provides a buffer through the F3 boss and early floors; compound effect with reduced scaling
- Expected impact: F3 survival improves; players enter mid-game with more margin

**5. Increase baseEffectAttack: 10 → 11**
- Rationale: Marginally improves DPS floor; helps low-accuracy players contribute damage even when not combo-ing
- Expected impact: Regular player DPS improvement; reduces run length for non-optimal play

**6. Increase baseEffectShield: 8 → 10**
- Rationale: Shield cards currently underperform vs. Attack cards (0 damage mitigated vs. 15.92 attack damage). Strengthening shields makes defensive strategies viable
- Expected impact: Shield-heavy deck builds become competitive

### Priority 2 (Subsequent Patch)

**7. Buff combo multipliers: [1, 1.1, 1.2, 1.3, 1.5] → [1, 1.15, 1.3, 1.5, 2.0]**
- Rationale: The 2.0× peak at 5-combo is needed to produce overkill wins. Research target is 10–20% overkill rate; current is 4%. The steeper ramp also makes the combo system feel more rewarding at every step
- Expected impact: Overkill rate increase from 4% toward 10–15%

**8. Remove postEncounterHealCap: Set all segments to 1.0 (remove cap)**
- Rationale: The parameter sensitivity data shows postEncounterHealPct has a counterintuitive positive correlation (r = +0.189) — less healing correlates with better scores. This likely reflects a confounder: better players need less healing. The cap restriction may be penalizing players who need healing most
- Expected impact: Better HP recovery for struggling players; reduced F15 cliff severity

**9. Reduce shop prices by 25–30%**
- Rationale: Gold efficiency target is 70–85%; actual is 43.2%. Price reduction is the most direct lever
- Expected impact: Gold efficiency increase toward 65%; food purchases increase

---

## Section 9: V1 → V2 Comparison

### What the V2 Simulator Added

V2 modeled six systems absent in V1:
1. **Quick Play vs. Charge decisions** — players now choose their attack mode per card
2. **Surge system** — the energy accumulation mechanic is simulated
3. **Knowledge chains** — consecutive correct answers in the same domain
4. **Card rewards** — deck composition changes over the run
5. **Relic rewards** — relic accumulation is modeled, not preset
6. **Synergy-aware shopping** — the simulated player evaluates synergies before purchasing

### Key Metric Comparison

| Metric | V1 | V2 | Interpretation |
|--------|----|----|---------------|
| Regular Asc0 survival | 19.9% | 0% (no relics) | V2 is harder; V1 overestimated survival by ignoring strategic complexity |
| Scholar Asc0 survival | 59.3% | 7% (no relics) | V2 far more demanding; real scholars need relics to win |
| Dedicated Asc0 survival | 41.7% | 3% (no relics) | Same conclusion |
| Floor 1 survival | 81.8% | 98.7% | V2 improved early-game safety; introductory balance is better |
| Close-call rate | 16.1% | 23.8% | V2 produces better tension; more realistic gameplay creates more close calls |
| Overkill rate | 1.0% | 4.0% | V2 improved 4×; still 2.5× below target |
| Attack accuracy | 65.3% | 81.8% | V1 underestimated accuracy; V2 reflects charge/quick mix correctly |
| Avg DPS | Varies | 15.92 per attack | V2 damage model correctly accounts for charge multipliers |

### The V1 Overestimation Problem

V1's 19.9% regular player survival was misleading. It used a frozen starting deck, which assumed a player always had the optimal starting configuration. V2 reveals that deck building (card rewards, shop purchases, relic synergies) is a critical success factor, and players who don't actively optimize their deck lose reliably.

The practical implication: V1 was validating the balance of an ideal player who never makes suboptimal deck choices. V2 validates the balance of a real player who makes realistic strategic decisions. The 20× survival difference (19.9% → 0%) between V1 and V2 for regular players is the gap between theoretical and actual balance.

### V2's Genuine Improvements

Despite harder baseline survival, V2 reveals several improvements:
- **Floor 1 safety improved** (81.8% → 98.7%): New players are better protected at the start
- **Tension is higher** (close-call 16.1% → 23.8%): More realistic play creates more edge-of-death moments
- **Overkill is 4× better** (1.0% → 4.0%): Still below target but the direction is correct
- **Accuracy model is realistic** (65.3% → 81.8% for attacks): The charge/quick mix correctly reflects what players experience

---

## Appendix: Raw Data Locations

| Dataset | Location | Runs | Notes |
|---------|----------|------|-------|
| Control baselines (Normal) | `data/playtests/` | Subset of 1,960,960 | 5 profiles × 5 ascension levels |
| Control baselines (Relaxed) | `data/playtests/` | Subset | 3 profiles × 3 ascension levels |
| Floor curve (deep) | `data/playtests/` | 630,000 | Floor-by-floor breakdown |
| Card effectiveness | `data/playtests/` | 225M cards played | Per-type accuracy and fizzle |
| Fun factor metrics | `data/playtests/` | Full dataset | Close-call, comeback, overkill |
| Economy data | `data/playtests/` | Full dataset | Gold, food, haggling |
| Relic tier list | `data/playtests/` | 37 relics × combat runs | Score = composite metric |
| Mixed strategy | `data/playtests/` | Subset | Force Quick/Charge/Mixed comparison |
| V1 comparison | `docs/MASS-SIMULATION-REPORT-2026-03-18.md` | 4,443,400 (V1) | V1 report for comparison |
| Parameter sensitivity | Sweep results | 630,000 sweep runs | Pearson r values |

### Report Generation

- **Simulator version**: HeadlessCombatSimulator v2 (full progression model)
- **Date**: 2026-03-18
- **Total simulations**: 1,960,960
- **Previous report**: `docs/MASS-SIMULATION-REPORT-2026-03-18.md` (V1, 4,443,400 runs)
- **Research sources**: Clark et al. 2009 (near-miss psychology), Wilson et al. 2019 (optimal learning accuracy), Slay the Spire analogues (deck size, ascension design)

---

*This report supersedes any V1 findings where they conflict. V2's full-progression model is the authoritative source for balance decisions. The core conclusion is unambiguous: the game's difficulty must decrease significantly — survival rates are too low, the economy is broken, and the power fantasy is absent. The parameter changes identified here, implemented in priority order, should bring the game into research-target range within 2–3 balance patches.*
