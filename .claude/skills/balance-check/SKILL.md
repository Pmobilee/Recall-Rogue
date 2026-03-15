---
description: "Analyze mass simulation results: read JSON output, produce narrative balance report with actionable findings"
---

# ⛔ AR PHASE DOC RULE — READ THIS ⛔
#
# This skill is READ-ONLY (analysis/viewing). It does NOT require an AR doc itself.
# HOWEVER: If the results of this analysis lead to implementation work (bug fixes,
# balance changes, new features), that work REQUIRES an AR phase doc BEFORE any
# code is touched. See `.claude/skills/work-tracking/SKILL.md` for the full rule.
#
# The rule: ANY non-trivial implementation (more than a 2-minute single-line fix)
# MUST have an AR doc in `docs/roadmap/phases/AR-NN-SHORT-NAME.md` with all TODOs
# listed BEFORE coding begins. No exceptions.
# ⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔

# Balance Check — Simulation Analysis

Analyze mass combat simulation results and produce a narrative balance report.

## Arguments
Parse from user's message (all optional):
- `mode`: "full" (default), "quick", "diff", "targeted", "deep", "fsrs", "economy", or "all"
- `relics`: comma-separated relic IDs for targeted mode
- `file`: specific result file path (default: most recent in data/balance-reports/runs/)

Examples:
- `/balance-check` — Full audit of latest run
- `/balance-check quick` — Quick flag check only
- `/balance-check diff` — Compare latest run vs baseline
- `/balance-check targeted flame_brand,war_drum` — Focus on specific relics
- `/balance-check deep` — Deep combat: floors, enemies, card types, fun factor
- `/balance-check fsrs` — FSRS progression analysis
- `/balance-check economy` — Economy/unlock pacing
- `/balance-check all` — Read latest of each, produce unified report

## Steps

### Step 1: Load Data
1. Find the most recent JSON file in `data/balance-reports/runs/` (or use the specified `file` path)
2. Read it — it's a `BatteryResult` JSON with structure:
   - `battery`: which battery was run
   - `runAt`: when
   - `gitHash`, `gitDirty`: repo state
   - `balanceFileHash`, `relicResolverHash`: change detection
   - `simulatorOutput`: the raw mass-simulate output containing:
     - `meta`: totalRuns, seedsPerConfig, floors, elapsedMs, mode
     - `controlBaselines`: Record<label, AggregatedMetrics> — no-relic baselines per profile
     - `soloRelicImpact`: array of { relicId, profile, ascension, metrics, impact: { survival, dps, defense, overall }, tier }
     - `comboAnalysis`: array of { relics, metrics, impact, synergyFactor, verdict, expectedOverall, comboOverall }
     - `buildPerformance`: array of { label, profile, metrics }
     - `skillFairness`: array of { loadout, results (per-profile metrics), fairnessRatio, flag }
     - `progressionCurve`: array of { label, stage, relicCount, metrics }
     - `flags`: { overpowered: string[], underpowered: string[], brokenSynergies: string[], immortality: string[] }
   - `summary`: quick-compare fields (sTierCount, fTierCount, brokenSynergyCount, etc.)
3. For `diff` mode, also read `data/balance-reports/baselines/baseline-latest.json`

### Step 2: Analyze (mode-dependent)

#### Full Audit Mode (default)
Produce a report with these sections:

**1. Executive Summary**
- Total runs, seeds, time taken
- Tier distribution: how many relics in S/A/B/C/D/F (target: 0 S, 0 F, majority B/C)
- Flag counts: overpowered, underpowered, broken synergies, immortality
- Overall health verdict: GREEN (0 S/F, 0 broken), YELLOW (1-2 S/F or broken), RED (3+ S/F or any immortality)

**2. Control Baselines**
- Show the no-relic performance per profile
- Commentary: are baselines reasonable? (expert should reach floor 15-20, average floor 3-5, beginner floor 1-3)

**3. Problem Relics (S-tier and F-tier)**
For each S-tier relic:
- Name, impact scores (survival, dps, defense, overall)
- WHY it's overpowered (which metric drives it?)
- Specific nerf suggestion with target numbers

For each F-tier relic:
- Name, impact scores
- WHY it's underperforming
- Specific buff suggestion

**4. Tier List**
Show the complete tier list organized by tier:
- S: (list)
- A: (list with scores)
- B: (list with scores)
- C: (list with scores)
- D: (list with scores)
- F: (list)

**5. Synergy Report**
- Top 10 combos by synergy factor
- For each: relic pair, synergy factor, verdict, and whether it seems intentional
- Any broken synergies (>2.0) get detailed analysis

**6. Fairness Analysis**
- Any expert-favored loadouts (ratio >3.0)?
- Any beginner-punishing effects?
- Are cursed relics (glass_cannon, blood_price) appropriately risky for all skill levels?

**7. Build Performance**
- Compare archetype builds if available
- Which builds are viable? Which are dead?

**8. Recommendations**
Prioritized list (max 10):
- Priority 1 (critical): S-tier nerfs, broken synergy fixes, immortality fixes
- Priority 2 (important): F-tier buffs, fairness violations
- Priority 3 (polish): D-tier buffs, anti-synergy investigation

Each recommendation: what to change, which file, expected impact on metrics.

#### Quick Mode
Only show:
- Executive summary (health verdict)
- Any S/F tier relics (names only)
- Any broken synergies
- Any immortality flags
Keep it under 20 lines.

#### Diff Mode
Compare latest run against baseline. Sections:
1. **What Changed** — Tier distribution before/after, flag count deltas
2. **Improved** — Relics that moved toward B/C tier (list with old->new tier and scores)
3. **Regressed** — Relics that moved away from B/C, or new broken combos
4. **Unchanged Problems** — Flags present in both baseline and current
5. **Verdict** — Did the rebalance achieve its goals? Summarize in 2-3 sentences.

#### Targeted Mode
Filter all analysis to just the specified relics:
- Their solo impact (tier, scores)
- All combos involving them
- Their appearance in any builds
- Before/after if baseline exists

#### Deep Combat Analysis (mode = "deep")
When the user runs `/balance-check deep`:
1. Find the most recent JSON in `data/balance-reports/runs/` that contains `deepAnalysis` (or was generated by `--mode deep`)
2. The JSON has `deepAnalysis` containing: `perFloorStats`, `perEnemyStats`, `cardTypeEffectiveness`, `funFactorMetrics`, `relicCountScaling`
3. Produce a report with these sections:

**1. Floor Difficulty Curve**
- Show survival-to-floor-N for all 24 floors
- Identify "the wall" — where survival drops most sharply
- Identify recovery floors after bosses
- Is the dropoff gradual (good) or cliff-like (bad)?

**2. Enemy Danger Ranking**
- Top 10 hardest enemies by defeat rate
- Which enemies need HP/damage nerfs?
- Which enemies are pushovers (>95% defeat rate)?
- Boss difficulty ranking

**3. Card Type Meta**
- Which card types are most/least played?
- Accuracy by card type (should be similar)
- Average damage per card type
- Fizzle rates — are any types particularly punishing?

**4. Fun Factor Verdict**
- Close-call win rate (target: 15-25%)
- Comeback win rate (target: 5-15%)
- Overkill win rate (target: 20-40%)
- Is the game too swingy? Too predictable?

**5. Relic Count Scaling**
- Survival rate by relic count
- Is there a sweet spot?
- Diminishing returns analysis

#### FSRS Progression Analysis (mode = "fsrs")
When the user runs `/balance-check fsrs`:
1. Find the most recent JSON generated by fsrs-simulate.ts
2. It has `masteryMilestones`, `tierDistributionOverTime`, `domainCompletionCurves`, `factEncounterFrequency`
3. Produce a report:

**1. Mastery Velocity**
- Time to master 10/50/100/500 facts at each accuracy level
- Is progression too slow or fast?

**2. The Accuracy Sweet Spot**
- What minimum accuracy gives reasonable mastery?
- Below what accuracy is mastery practically impossible?

**3. Domain Completion Forecast**
- Time to complete each domain
- Which domains take longest?

**4. Review Balance**
- Avg/min/max encounters per fact
- StdDev — are some facts over/under-reviewed?
- Is the distribution fair?

**5. Retention Prediction**
- Final tier distribution
- What % of facts are in each tier?
- At current pace, when would all facts be mastered?

#### Economy Analysis (mode = "economy")
When the user runs `/balance-check economy`:
1. Find the most recent JSON generated by economy-simulate.ts
2. It has `currencyPerRun`, `unlockProgression`, `runsToUnlockAll`, `optimalUnlockOrder`
3. Produce a report:

**1. Earning Rate Summary**
- Currency per run at each skill level
- Is the gap between beginner and expert too large?

**2. Unlock Timeline**
- When each relic becomes affordable
- Milestones at 50/100/200/500 runs

**3. ROI Ranking**
- Best relics to buy first (top 10 by ROI)
- Any relics that are traps (high cost, low impact)?

**4. Free-to-Play Pacing**
- Is the grind reasonable? (Target: 100-200 runs for core relics, 300-500 for all)
- At 2 runs/day, how many months?

**5. Progression Feel**
- Does unlocking feel rewarding?
- Is there a "dead zone" where no unlocks happen for too long?

#### All Mode
When the user runs `/balance-check all`:
1. Read the most recent combat sweep, deep, fsrs, and economy JSONs from `data/balance-reports/runs/`
2. Produce a unified report combining all sections from Full Audit, Deep Combat, FSRS Progression, and Economy Analysis modes
3. Cross-reference findings: e.g., do economy unlock timings align with FSRS mastery velocity? Do floor difficulty curves match enemy danger rankings?

### Step 3: Write Report
Save the analysis as markdown to `data/balance-reports/reports/analysis-{battery}-{date}.md`
where `{battery}` comes from the result file and `{date}` is today's date in YYYY-MM-DD format.

Tell the user the file path when done.

## Key Thresholds

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| Solo impact overall | -10 to +25 (C/B) | S (>50) or F (<-10) | >100 |
| Combo synergy factor | 0.8-1.5 | 1.5-2.0 (strong) | >2.0 (broken) |
| Skill fairness ratio | 1.0-3.0 | 3.0-5.0 | >5.0 |
| Expert survival | 10%-60% | >80% | >99% |
| Average survival | 0%-15% | >30% | >50% |

## Important Notes
- Read the ENTIRE simulation JSON — it's typically 80-200KB, well within context
- Use actual numbers from the data, not vague assessments
- Reference specific relics by their ID (e.g., `flame_brand`, not "the fire relic")
- For buff/nerf suggestions, reference the effect values in `src/services/relicEffectResolver.ts`
- The style should match `docs/RESEARCH/relic-balance-report.md` — tables, specific numbers, actionable
