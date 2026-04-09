---
description: "Analyze playtest logs for balance issues, UX problems, and bugs"
---

# ⚠️ AR Phase Doc Required — see `.claude/skills/work-tracking/SKILL.md` for rules.
# ℹ️ This skill is READ-ONLY. Implementation work from findings requires an AR doc — see `.claude/skills/work-tracking/SKILL.md`.

# Playtest Analysis

Analyze one or more headless simulation run files to identify game design issues.

This skill reads output produced by the `/balance-sim` skill (the headless combat simulator at `tests/playtest/headless/run-batch.ts`). It does NOT read browser bot logs or old `data/playtests/logs/` files.

## Arguments
Parse from the user's message:
- `file`: path to a specific run file (e.g. `data/playtests/runs/2026-03-21_14-00-00/combined.json`), OR
- `latest`: analyze the most recent run in `data/playtests/runs/latest/combined.json`, OR
- `profile <id>`: analyze a specific profile file (e.g. `data/playtests/runs/latest/scholar.json`), OR
- `all`: analyze all profiles in the latest run folder

## Data Location and Format

Headless sim output lives in `data/playtests/runs/{timestamp}/`:
- `combined.json` — all profiles merged; top-level fields: `timestamp`, `description`, `totalRuns`, `runsPerProfile`, `durationSeconds`, `profiles[]`, `config`, `results[]`
- `{profile_id}.json` — per-profile array of `SimRunResult` objects

### SimRunResult schema
```typescript
{
  runId: string;
  options: Required<SimOptions>;   // correctRate, chargeRate, encounterCount, etc.
  encounters: EncounterSummary[];
  totalTurns: number;
  totalDamageDealt: number;
  totalDamageTaken: number;
  totalCardsPlayed: number;
  totalCorrect: number;
  totalWrong: number;
  accuracy: number;               // 0-1
  floorsReached: number;
  finalHP: number;
  survived: boolean;
  ascensionLevel: number;
  durationMs: number;
}
```

### EncounterSummary schema
```typescript
{
  encounterIndex: number;
  floor: number;
  enemyId: string;
  enemyName: string;
  result: 'victory' | 'defeat' | 'timeout';
  turnsUsed: number;
  damageDealtTotal: number;
  damageTakenTotal: number;
  cardsPlayed: number;
  correctAnswers: number;
  wrongAnswers: number;
  maxCombo: number;
  playerHpStart: number;
  playerHpEnd: number;
}
```

### Profiles (new set)
| Profile ID | Correct Rate | Notes |
|---|---|---|
| `first_timer` | 45% | New player, low accuracy |
| `casual_learner` | 65% | Plays occasionally |
| `regular` | 62% | Intermediate strategy |
| `gamer` | 55% | Optimal strategy, low accuracy |
| `dedicated` | 70% | Consistent, high charge rate |
| `scholar` | 82% | Near-perfect accuracy |

## Analytics Output (when run with --analytics flag)

When the sim is run with `npm run sim:analytics`, additional analytics reports are generated in `{run_dir}/analytics/`:

- `balance-report.md` — Win rate table by profile × ascension level
- `card-analysis.md` + `.json` — Per-mechanic win rate correlation, deck type distributions
- `relic-analysis.md` + `.json` — Per-relic win rates, relic combos (⚠️ survivorship bias — use relic-performance.md instead)
- `enemy-analysis.md` + `.json` — Deadliest enemies, most-failed, floor difficulty curve
- `archetype-analysis.md` — Build viability comparison (8 archetype builds)
- `correlation-report.md` — Top positive/negative balance correlations
- `relic-performance.md` — **Survivorship-free** relic scoring: avg floors after acquisition, damage/AP, power score
- `card-performance.md` — **Survivorship-free** card efficiency: damage/AP, charge rate, floor delta
- `archetype-performance.md` — Multi-dimensional archetype scoring: HP efficiency, deck diversity, avg floors

Read these files FIRST before doing manual analysis — they contain pre-computed insights. **For relic balance, ALWAYS prefer relic-performance.md over relic-analysis.md.**

### Extended FullRunResult Fields (analytics mode)

When analytics mode is active, `SimRunResult` entries include additional fields:

```typescript
{
  encounters: EncounterSummary[];           // full per-encounter breakdown
  finalDeckMechanics: string[];             // mechanic IDs in deck at run end
  finalDeckTypeDistribution: Record<string, number>; // archetype tag counts
  deckEvolution: DeckSnapshot[];            // deck state at each reward pick
  masteryAtEnd: Record<string, number>;     // mechanicId → mastery level at end
}
```

## Steps

### Phase 0: Generate Thresholds (ALWAYS run first)

> **Why runtime thresholds matter:** The game's balance changes constantly — HP values, damage multipliers, AP costs, and enemy stats are all tuned regularly. Hardcoded thresholds like "survival rate > 80% is too easy" become stale immediately after a balance pass. Phase 0 generates contextual thresholds from current game state so detection rules stay accurate regardless of when they run.

1. Read `src/data/balance.ts` — extract: `PLAYER_HP_START`, `PLAYER_AP_START`, base damage values, any named constants that drive combat math
2. Read the profiles table in this skill's own docs (below) to get each profile's target win rate
3. Check for recent baseline data at `data/playtests/runs/latest/combined.json` — if present, use each profile's actual survival rate from the last clean run as the historical baseline; if absent, use the fallback defaults below
4. Compute per-profile dynamic thresholds:

```
For each profile:
  target_win_rate = from table below (or from balance.ts comments if overridden)
  too_easy_threshold = target_win_rate × 1.3        (cap at 0.97)
  too_hard_threshold = target_win_rate × 0.5        (floor at 0.05)
  high_skill_too_easy = target_win_rate × 1.15      (for dedicated/scholar)
  damage_spike_pct = PLAYER_HP_START × 0.5          (50% of current HP constant)
  healing_low_pct = PLAYER_HP_START × 0.4           (40% of current HP constant)
```

**Fallback target win rates** (use when no baseline data exists):
| Profile | Target Win Rate |
|---|---|
| `first_timer` | 22% |
| `casual_learner` | 58% |
| `regular` | 52% |
| `gamer` | 38% |
| `dedicated` | 65% |
| `scholar` | 86% |

### Phase 1: Load and Aggregate

1. Read the run file(s) from `data/playtests/runs/{timestamp}/`
2. Read the analysis guide: `tests/playtest/analysis/sonnet-analyzer-prompt.md`
3. For each profile/run batch, compute aggregate statistics across all `SimRunResult` entries
4. Scan for issues using the detection rules below (which reference the thresholds computed in Phase 0)
5. Write a report JSON to `data/playtests/reports/report-{timestamp}-{profileId}.json`

## Analysis Approach

Because headless sim produces hundreds or thousands of runs per profile (not a single playthrough), aggregate across all runs first:

- **Survival rate**: `survived === true` count / total runs
- **Average floors reached**: mean of `floorsReached`
- **Average accuracy**: mean of `accuracy`
- **Encounter-level stats**: flatten all `encounters[]` arrays, group by `enemyName` or `floor`
- **HP at death**: for `survived === false` runs, note `finalHP` and `floorsReached`
- **Damage ratios**: mean of `totalDamageDealt / totalDamageTaken` per run
- **Accuracy vs outcome**: bin runs by accuracy quartile and compare survival rates

## Detection Rules

Apply these to the aggregated encounter data. All percentage thresholds are **dynamic** — computed in Phase 0 from current `balance.ts` values and per-profile target win rates. Do not substitute hardcoded numbers; derive them at analysis time.

### Balance Issues

#### balance_damage_spike
**Principle:** A single encounter should not routinely delete half the player's health bar.
**Dynamic threshold:** In >10% of encounters, `damageTakenTotal / playerHpStart > 0.5` where `playerHpStart` is read from `balance.ts` (`PLAYER_HP_START`). If that constant has changed since last baseline, scale the 0.5 factor accordingly (e.g., if HP went from 100 → 120, the absolute threshold rises but the 50% ratio stays stable).
**Severity:** HIGH always.

#### balance_too_easy
**Principle:** A profile should not trivially complete all encounters with no challenge.
**Dynamic threshold:** Profile survival rate > `too_easy_threshold` (= `target_win_rate × 1.3`, capped at 0.97) AND avg floors reached = max floors.
**How to compute target_win_rate:** Use per-profile value from Phase 0 fallback table; override with balance.ts comment if present; override again with historical baseline if available.
**Severity:** LOW if survival rate is within 10% above threshold, MEDIUM if >10% above threshold.

#### balance_too_hard
**Principle:** A profile should not die consistently before seeing meaningful content.
**Dynamic threshold:** Profile survival rate < `too_hard_threshold` (= `target_win_rate × 0.5`, floored at 0.05) AND avg floors reached < 5.
**Severity:** MEDIUM. Escalate to HIGH if avg floors reached < 2 (dying on floor 1-2 consistently).

#### balance_healing_insufficient
**Principle:** Players who survive long enough should not be perpetually low on HP.
**Dynamic threshold:** Mean `playerHpEnd` after floor 5+ encounters stays below `healing_low_pct` (= `PLAYER_HP_START × 0.4`). Scale with current HP constant from balance.ts.
**Severity:** MEDIUM.

#### balance_combo_unreachable
**Principle:** Players with sufficient accuracy should be able to build combos — if they can't, something in the mechanic chain is broken.
**Dynamic threshold:** Profile `accuracy` > 0.60 but mean `maxCombo` across encounters < 3.
**Severity:** MEDIUM. This threshold (0.60 accuracy, combo < 3) is mechanic-structural, not balance-tuning-dependent — keep these values fixed.

### UX Issues

#### ux_no_meaningful_choice
**Principle:** Players should be playing cards every encounter, not sitting idle.
**Dynamic threshold:** Mean `cardsPlayed` per encounter < 2. This is mechanic-structural — keep fixed.
**Severity:** LOW. Escalate to MEDIUM if mean drops below 1.

#### ux_unfun_moment
**Principle:** Losing half your HP in a single fight feels bad and should be rare.
**Dynamic threshold:** In >15% of encounters, `playerHpStart - playerHpEnd > playerHpStart * 0.5`. Scale `playerHpStart` from current `PLAYER_HP_START` in balance.ts.
**Severity:** LOW. Escalate to MEDIUM if rate exceeds 25%.

### Progression Issues

#### progression_difficulty_spike
**Principle:** Difficulty should ramp smoothly — a sudden 2x effort jump on a single floor breaks pacing.
**Dynamic threshold:** Mean `turnsUsed` on floor N is >2x mean `turnsUsed` on floor N-1, averaged across all runs. This ratio is structural — keep fixed at 2x.
**Severity:** HIGH always when triggered.

#### progression_dead_end
**Principle:** The player must always be able to deal damage; zero damage output is a hard bug.
**Dynamic threshold:** Any encounter with `damageDealtTotal === 0` AND `result !== 'victory'`. No dynamic scaling — this is a binary correctness check.
**Severity:** CRITICAL always.

#### progression_timeout_rate
**Principle:** Stalemates should be rare edge cases, not a regular outcome.
**Dynamic threshold:** >5% of encounters end with `result === 'timeout'`. This is mechanic-structural — keep fixed.
**Severity:** MEDIUM.

### Mechanic Issues

#### mechanic_broken
**Principle:** Any card type that was played but dealt zero damage is almost certainly bugged.
**Dynamic threshold:** Mean `damageDealtTotal` for a card type is 0 across runs where that card type was played. Binary check — no dynamic scaling.
**Severity:** CRITICAL always.

#### mechanic_accuracy_disconnect
**Principle:** High-accuracy profiles should translate that accuracy into correct card plays; a gap here signals a wiring bug.
**Dynamic threshold:** Profile `accuracy > 0.70` but mean `correctAnswers / cardsPlayed < 0.55`. Thresholds are mechanic-structural — keep fixed.
**Severity:** MEDIUM.

### Engagement Issues

#### engagement_boring_run
**Principle:** Encounters that resolve in 1-2 turns offer no decision space or tension.
**Dynamic threshold:** Mean `turnsUsed` per encounter < 2 across all profiles. Structural — keep fixed.
**Severity:** MEDIUM.

#### engagement_tedious_grind
**Principle:** Encounters that drag past 8 turns feel like a slog and kill pacing.
**Dynamic threshold:** Mean `turnsUsed` per encounter > 8 across all profiles. Structural — keep fixed.
**Severity:** MEDIUM.

#### engagement_too_easy
**Principle:** Skilled players (scholar/dedicated) should face meaningful challenge.
**Dynamic threshold:** Scholar or dedicated profile survival rate > `high_skill_too_easy` (= `target_win_rate × 1.15`) with run-to-run variance < 5%. Use profile-specific target win rates from Phase 0.
**How this differs from balance_too_easy:** This fires even if avg floors < max, to catch scenarios where skilled players win effortlessly but don't always complete every floor.
**Severity:** LOW.

#### engagement_frustrating_streaks
**Principle:** New players should fail often but not so often that every fight feels hopeless.
**Dynamic threshold:** Mean `wrongAnswers / cardsPlayed > 0.60` for `first_timer` profile. Structural ratio — keep fixed. If `first_timer` target win rate is adjusted in balance.ts comments, re-evaluate this threshold.
**Severity:** MEDIUM.

#### engagement_low_fun
**Principle:** The core audience (regular/gamer profiles) must have a viable path to winning; consistent failure is churn.
**Dynamic threshold:** Regular or gamer profile survival rate < `too_hard_threshold` for their profile (from Phase 0). Do NOT use a fixed 30% — use the profile's own computed too_hard_threshold.
**Severity:** HIGH always when triggered.

## Report Format

Write JSON matching this schema:
```json
{
  "runTimestamp": "string",
  "profileId": "string (or 'all' for combined)",
  "analyzedAt": "ISO timestamp",
  "runsAnalyzed": 0,
  "issueCount": 0,
  "aggregateSummary": {
    "survivalRate": 0,
    "avgFloorsReached": 0,
    "avgAccuracy": 0,
    "avgTurnsPerEncounter": 0,
    "avgDamageDealtPerEncounter": 0,
    "avgDamageTakenPerEncounter": 0,
    "avgCardsPlayedPerRun": 0,
    "avgMaxComboPerEncounter": 0,
    "timeoutRate": 0,
    "deathFloorDistribution": { "1": 0, "2": 0, "3": 0 }
  },
  "issues": [
    {
      "id": "issue-{timestamp}-{profileId}-{seq}",
      "profileId": "string",
      "category": "balance_damage_spike",
      "severity": "high",
      "title": "Short description (max 120 chars)",
      "description": "Detailed explanation with aggregate evidence",
      "evidence": {
        "floor": 3,
        "enemyName": "optional — specific enemy if applicable",
        "metric": "23% of encounters on floor 3 took >50% player HP (n=230 encounters)",
        "runsAffected": 47,
        "pctAffected": 0.23
      },
      "reproductionSteps": ["Run: npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 100 --profile regular", "Look for encounters on floor 3 with damageTakenTotal > playerHpStart * 0.5"],
      "suggestedFix": "Optional suggestion"
    }
  ]
}
```

## Output
Report a summary: total runs analyzed, survival rates by profile, avg floors reached, and list the top 3 most severe issues with their titles and affected percentages.
