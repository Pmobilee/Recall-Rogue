---
description: "Analyze playtest logs for balance issues, UX problems, and bugs"
---

# ⚠️ AR Phase Doc Required — see `.claude/skills/work-tracking/SKILL.md` for rules.
# ℹ️ This skill is READ-ONLY. Implementation work from findings requires an AR doc — see `.claude/skills/work-tracking/SKILL.md`.

# Playtest Analysis

Analyze one or more headless simulation run files to identify game design issues.

This skill reads output produced by the `/headless-playtest` skill (the headless combat simulator at `tests/playtest/headless/run-batch.ts`). It does NOT read browser bot logs or old `data/playtests/logs/` files.

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

## Steps

1. Read the run file(s) from `data/playtests/runs/{timestamp}/`
2. Read the analysis guide: `tests/playtest/analysis/sonnet-analyzer-prompt.md`
3. For each profile/run batch, compute aggregate statistics across all `SimRunResult` entries
4. Scan for issues using the detection rules below
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

Apply these to the aggregated encounter data:

### Balance Issues
- **balance_damage_spike** (HIGH): In >10% of encounters, `damageTakenTotal / playerHpStart > 0.5` (enemy deals >50% of player's starting HP in one encounter)
- **balance_too_easy** (LOW): Profile survival rate >80% AND avg floors reached = max floors (player trivially completes all encounters)
- **balance_too_hard** (MEDIUM): Profile survival rate <20% AND avg floors reached <5 (dying too early)
- **balance_healing_insufficient** (MEDIUM): Mean `playerHpEnd` after floor 5+ encounters stays below 40% of max HP
- **balance_combo_unreachable** (MEDIUM): Profile `accuracy` > 0.60 but mean `maxCombo` across encounters < 3

### UX Issues
- **ux_no_meaningful_choice** (LOW): Mean `cardsPlayed` per encounter < 2 (player isn't playing cards — hand may be empty or locked)
- **ux_unfun_moment** (LOW): In >15% of encounters, `playerHpStart - playerHpEnd > playerHpStart * 0.5` (half HP lost in one fight)

### Progression Issues
- **progression_difficulty_spike** (HIGH): Mean `turnsUsed` on floor N is >2x mean `turnsUsed` on floor N-1 (averaged across all runs)
- **progression_dead_end** (CRITICAL): Any encounter has `damageDealtTotal === 0` AND `result !== 'victory'` (player can't damage enemy)
- **progression_timeout_rate** (MEDIUM): >5% of encounters end with `result === 'timeout'` (stalemate / turn limit hit)

### Mechanic Issues
- **mechanic_broken** (CRITICAL): Mean `damageDealtTotal` for a card type is 0 across runs where that card type was played
- **mechanic_accuracy_disconnect** (MEDIUM): Profile `accuracy > 0.70` but mean `correctAnswers / cardsPlayed < 0.55` (accuracy not translating to correct plays — possible card effect wiring bug)

### Engagement Issues
- **engagement_boring_run** (MEDIUM): Mean `turnsUsed` per encounter < 2 across all profiles — encounters resolve too quickly, no tension
- **engagement_tedious_grind** (MEDIUM): Mean `turnsUsed` per encounter > 8 — encounters drag on
- **engagement_too_easy** (LOW): Scholar/dedicated profile survival rate > 95% with <5% variance — no challenge for skilled players
- **engagement_frustrating_streaks** (MEDIUM): Mean `wrongAnswers / cardsPlayed > 0.60` for first_timer — too many failures
- **engagement_low_fun** (HIGH): Regular/gamer profile survival rate < 30% — game is frustrating for core audience

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
