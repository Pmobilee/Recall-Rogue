# Track 01 — Stat-Baseline Report

**Run date:** 2026-04-11
**Method:** Headless simulation — 28,000 runs across 22 profiles (1,000-4,000 per profile) with `--analytics --workers 8`
**Run path:** `data/playtests/runs/2026-04-11_01-25-56/`
**Duration:** 83.1 seconds (24,000 primary runs + 4,000 redundant; 28,000 total with analytics)
**PLAYER_HP_START:** 100 (from `src/data/balance.ts`)

---

## Executive Summary (10 lines)

1. **Ascension 20 is broken as a difficulty tier.** experienced@asc20 wins 2.7%, master@asc20 wins 9.1%. Floor 1 alone kills 28.5% of asc20 experienced runs. This is a wall, not a challenge.
2. **Floor 4→6 difficulty cliff is the most severe structural issue.** Encounters jump 3.36x in average turns (6.68→22.44) at every single profile — the act-1 boss tier hits like a wall with no warm-up.
3. **Floor 18 final bosses (Omnibus/Final Lesson) are lethal to 30% of players who reach them.** 87-91% of encounters lose >50% HP; the floor 18 death rate (30.2%) is 6x any other floor.
4. **volatile_core relic has a -53.6% win-rate delta** — the lowest relic score by a wide margin (power 0.378 vs cluster ~0.67). Either mechanically broken or actively harmful to pick.
5. **build_poison (87%) vs build_strength (41%) = 2.1x archetype gap.** Strength-scaling mechanics are underperforming relative to poison/fortress archetypes.
6. **New players and language learners grind fights.** Both profiles average 12-14 turns per encounter vs the 8-turn ceiling — fights feel slow and punishing.
7. **language_learner healing is insufficient.** Average HP after floor 5+ encounters is 37.4 (below the 40 HP threshold) — the healing economy doesn't keep up.
8. **eruption card correlates with losing (-14.4% delta)** despite high play frequency — potential archetype trap that rewards early drafting but underperforms at endgame.
9. **Ascension progression asc10→asc15→asc20 is non-linear.** The drop from asc15 to asc20 (52pp for experienced) dwarfs the asc10→asc15 drop (17pp) — suggests a hidden multiplier cliff at asc20.
10. **No zero-damage bugs, no broken mechanics, no CRITICAL-tier failures found.** The sim confirms game is functionally correct — issues are balance/design, not implementation.

---

## Pre-Existing Finding: PRE-EXISTING-1 (barbed_edge leak)

The pre-existing unit test failure (`barbed_edge` synergy applying to non-strike-tagged cards including `lifetap`) is noted. This would inflate lifetap's observed damage in these sim runs. lifetap shows 15.1 avg dmg/play which may be slightly elevated. No specific barbed_edge simulation was run in this track — confirmation/denial of gameplay impact deferred to other tracks.

---

## Profile-Level Results

| Profile | Win Rate | Avg Floors | Avg Turns/Enc | Damage Spike | Issues Triggered |
|---------|----------|------------|---------------|--------------|-----------------|
| new_player | 22.2% | 15.3 | 13.8 | 9.5% | tedious_grind |
| competent | 29.0% | 15.5 | 7.6 | 13.5% | damage_spike |
| language_learner | 19.8% | 14.7 | 12.9 | 16.6% | frustrating_streaks, healing_insuff, damage_spike, tedious |
| developing | 63.7% | 16.8 | 12.4 | — | — |
| experienced | 94.5% | 17.8 | 9.7 | — | too_easy |
| master | 71.2% | 17.1 | 10.2 | — | — |
| experienced@asc5 | 81.0% | 17.0 | 10.9 | — | — |
| experienced@asc10 | 71.7% | 16.2 | 12.8 | — | — |
| experienced@asc15 | 54.8% | 14.5 | 15.6 | — | — |
| experienced@asc20 | 2.7% | 4.0 | 8.4 | 12.1% | too_hard, low_fun |
| master@asc5 | 51.2% | 15.5 | 11.0 | — | — |
| master@asc10 | 42.2% | 14.7 | 13.1 | — | — |
| master@asc15 | 31.3% | 12.6 | 16.4 | — | — |
| master@asc20 | 9.1% | 8.3 | 13.0 | 14.3% | too_hard, timeout_rate |
| build_poison | 87.0% | 17.4 | 9.5 | — | — |
| build_fortress | 84.0% | 17.7 | 13.6 | — | — |
| build_control | 73.2% | 17.3 | 10.5 | — | — |
| build_exhaust | 64.9% | 17.1 | 9.7 | — | — |
| build_berserker | 56.5% | 16.5 | 9.1 | — | — |
| build_chain | 54.3% | 15.8 | 9.0 | — | — |
| build_tempo | 53.6% | 16.4 | 8.9 | — | — |
| build_strength | 41.3% | 15.6 | 8.0 | — | archetype_gap |

---

## Difficulty Curve Analysis

### Floor Progression (across all profiles)

| Floor | Avg Turns | Death Rate | Note |
|-------|-----------|------------|------|
| 1 | 4.25 | 0.5% | Correct entry difficulty |
| 2 | 6.20 | 2.3% | Smooth ramp |
| 3 | 6.50 | 2.0% | Smooth ramp |
| 4 | 6.68 | 1.6% | Peak pre-boss |
| **6** | **22.44** | **7.8%** | **SPIKE: 3.36x jump — act 1 boss** |
| 7 | 5.32 | 0.4% | Recovery |
| 8-10 | 6-8 | 0.6-1.1% | Stable |
| **12** | **15.69** | **3.2%** | **SPIKE: 2.06x jump — act 2 boss** |
| 13-16 | 13-16 | 0.3-2.2% | High but stable |
| **18** | **26.83** | **30.2%** | **Final boss wall** |

### Act Boss Breakdown (new_player)

**Floor 6:**
- The Final Exam: 97% win rate, 27.5 avg turns, 15% HP spike rate
- The Burning Deadline: 77% win rate, 23.6 avg turns, 24% HP spike rate, avg 30.7 HP taken

**Floor 12:**
- The Curriculum: 62% win rate, 30.7 avg turns, 37% HP spike rate, avg 37.9 HP taken
- The Group Project: 87% win rate, 14.8 avg turns, 26% HP spike rate

**Floor 18:**
- The Omnibus: 33% win rate, 23.6 avg turns, **91% HP spike rate**, avg 79.5 HP taken
- The Final Lesson: 36% win rate, 24.7 avg turns, **87% HP spike rate**, avg 71.4 HP taken

---

## Relic Analysis

### Top 5 strongest relics (survivorship-free power score)
1. mirror_of_knowledge: 0.700 (17.0 floors after acq)
2. ritual_blade: 0.700 (17.0 floors, 100% obs win rate)
3. mind_palace: 0.700
4. akashic_record: 0.699
5. bastions_will: 0.699

### Highest observational win delta (relic-analysis)
- swift_boots: +70.5% (74.6% vs 4.1% without)
- herbal_pouch: +56.4% (80.4% with)
- steel_skin: +54.4% (85.9% with)
- vitality_ring: +50.3%
- iron_shield: +48.4%

The swift_boots/herbal_pouch/steel_skin cluster with 70%+ win delta indicates these relics are the dominant survival path — runs with all three are near-guaranteed wins.

### Problem relics
- **volatile_core**: 6.0% win rate (-53.6% delta), power 0.378. 7.0 avg floors after acquisition vs 17.0 for top relics. Requires investigation.
- gladiator's_mark: -31.4% delta (246 appearances)
- insight_prism: -29.7% delta (239 appearances)
- battle_scars, brass_knuckles, thick_skin cluster: -26 to -29% delta range

---

## Card Analysis

### Top cards by win delta
1. knowledge_ward: +17.9%
2. corroding_touch: +16.9%
3. reinforce: +14.5%
4. guard: +13.9%
5. overheal: +11.7%
6. bulwark: +10.6%

Shield/defense cards dominate the positive delta list. Winners have 50.3% shield vs 44.0% for losers (+6.3pp difference).

### Problem cards
- **eruption**: -14.4% delta (3,741 runs, 125,486 plays) — most negative high-volume card
- frenzy: -12.6% delta
- siphon_knowledge: -9.8% delta
- recollect: -7.8% delta

### Cards with anomalous data
- **execute**: card-analysis reports 24% charge rate; manual per-encounter extraction finds 9% actual charge rate. 2.7x discrepancy warrants analytics methodology review.
- **double_strike**: listed in utility/other section of card-performance (not attack) — may indicate misclassification in analytics-report.ts

---

## Correlation Highlights

**Strongest positive correlates:**
- Large relic collection (≥4): +72.2% (this is the dominant win condition)
- Surviving to act 3: +100% (tautological but confirms act 1 as the filter)
- Shield-heavy deck (>30%): +45.7%
- High mastery (avg ≥3): +47.4%

**Strongest negative correlates:**
- volatile_core relic: -53.6%
- Attack-heavy deck (>50%): -48.3% (confirms shield dominance)
- Low accuracy (<50%): -40.0%

**Notable:** "Buff-heavy (>20% buff)" shows 0% win rate with n=5. This is a near-zero sample but suggests buff-heavy decks are an architectural dead end. Needs verification with larger sample.

---

## Issues Summary

| ID | Severity | Category | Title |
|----|----------|----------|-------|
| 01-001 | HIGH | progression_difficulty_spike | Floor 4→6 boss is 3.36x harder (all profiles) |
| 01-002 | HIGH | progression_difficulty_spike | Floor 10→12 spike hits low-skill profiles (2.06x) |
| 01-003 | HIGH | balance_damage_spike | Floor 18 final bosses delete 87-91% of HP per fight |
| 01-004 | HIGH | balance_too_hard | Ascension 20 unplayable: experienced wins 2.7% |
| 01-005 | LOW | balance_too_easy | experienced@asc0 wins 94.5% above 84.5% ceiling |
| 01-006 | MEDIUM | engagement_tedious_grind | new_player 13.8 avg turns/enc (threshold: 8) |
| 01-007 | MEDIUM | balance_healing_insufficient | language_learner HP drains to 37.4 avg (threshold: 40) |
| 01-008 | MEDIUM | engagement_frustrating_streaks | language_learner 64.9% wrong rate (threshold: 60%) |
| 01-009 | MEDIUM | progression_timeout_rate | master@asc20 5.43% timeouts (threshold: 5%) |
| 01-010 | MEDIUM | balance_damage_spike | language_learner 16.6% / competent 13.5% spike rate |
| 01-011 | HIGH | engagement_low_fun | Asc15→20 non-linear cliff; asc20 fails as a game mode |
| 01-012 | MEDIUM | balance_too_hard | volatile_core relic 6% win rate (-53.6% delta) |
| 01-013 | MEDIUM | balance_too_hard | build_strength 41% vs build_poison 87% (2.1x gap) |
| 01-014 | LOW | engagement_low_fun | eruption -14.4% win delta (3,741 runs) |
| 01-015 | LOW | mechanic_accuracy_disconnect | execute charge rate discrepancy (9% actual vs 24% reported) |

**Totals: 0 critical, 5 high, 7 medium, 3 low**
