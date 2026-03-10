---
description: "Run full playtest pipeline: simulate games across multiple profiles, analyze logs, triage issues, and display ranked results"
---

# Playtest Suite — Full Pipeline

Run the complete playtesting pipeline in one command: simulate → analyze → triage → display results.

## Arguments
Parse from the user's message (all optional):
- `profiles`: comma-separated list of profiles to run (default: "beginner,average,expert,struggling")
- `seed`: base RNG seed (default: random; each profile gets seed, seed+1, seed+2, etc.)
- `floors`: max floors per simulation (default: 12)
- `count`: number of runs PER profile (default: 1)
- `mode`: "headless" (default) or "visual"
- `skip-triage`: if present, skip the triage step (just run + analyze)

Examples:
- `/playtest-suite` — run 4 profiles × 1 run each, analyze, triage, show leaderboard
- `/playtest-suite profiles=beginner,expert floors=6` — just 2 profiles, 6 floors each
- `/playtest-suite count=3 seed=42` — 3 runs per profile with deterministic seeds
- `/playtest-suite profiles=all` — run all 6 profiles

## Pipeline Steps

### Step 1: Run Simulations (parallel)
For each profile in the list, spawn a background Agent worker:

```bash
PLAYTEST_PROFILE={profile} PLAYTEST_SEED={seed} PLAYTEST_FLOORS={floors} npx vitest run tests/playtest/runners/run-headless.test.ts --reporter=verbose
```

Run ALL profiles in parallel using the Agent tool with `run_in_background: true`.
Wait for all to complete.

Collect the output log file paths from each run.

### Step 2: Analyze Logs
For each new log file produced in Step 1, read the log JSON and analyze it for issues.

Read the analysis guide at `tests/playtest/analysis/sonnet-analyzer-prompt.md` for the full detection checklist.

For each log, scan for these issue patterns (at minimum):

**Balance Issues:**
- `balance_damage_spike` (HIGH): Enemy deals >50% of player's current HP in one enemy turn. Check `turns[]` where `phase === 'enemy_turn'` and `outcome.damageReceived > 0.5 * previous_snapshot.playerHP`
- `balance_too_easy` (LOW): 3+ consecutive encounters in `summary.encounterResults` where `playerHPRemaining > 0.9 * playerMaxHP` (80 default)
- `balance_too_hard` (MEDIUM): Player defeated on floors 1-3
- `balance_healing_insufficient` (MEDIUM): Player never heals above 60% HP after floor 3
- `balance_combo_unreachable` (MEDIUM): `summary.overallAccuracy > 0.6` but `summary.maxCombo < 3`

**Progression Issues:**
- `progression_difficulty_spike` (HIGH): An encounter's `turnsToResolve` is >2× the average of the previous floor's encounters
- `progression_dead_end` (CRITICAL): An encounter has `damageDealt === 0` (all cards blocked)

**UX Issues:**
- `ux_unfun_moment` (LOW): Player HP drops from >70% to <20% within a single encounter
- `mechanic_unused` (LOW): A card type appears in 0 `play_card` actions across the entire run

For each issue found, create a JSON object:
```json
{
  "id": "issue-{playthroughId}-{seq}",
  "playthroughId": "...",
  "profileId": "...",
  "category": "balance_damage_spike",
  "severity": "high",
  "title": "Short description (max 120 chars)",
  "description": "Detailed explanation with numbers",
  "evidence": {
    "turnSeqs": [12, 13],
    "floor": 3,
    "encounter": 2,
    "metric": "Enemy dealt 53 damage (66% of player's 80 HP)"
  },
  "reproductionSteps": ["Profile: beginner, Seed: 42", "Floor 3, Encounter 2"],
  "suggestedFix": "Optional"
}
```

Write report JSON to `data/playtests/reports/report-{playthroughId}.json`.

### Step 3: Triage & Rank
Read all reports from `data/playtests/reports/`.
Read existing leaderboard from `data/playtests/leaderboard.json` (create if missing).

**Deduplicate** by canonical key `{category}_{floor_bucket}`:
- Floor buckets: early (1-3), mid_early (4-6), mid (7-9), late (10-12), endgame (13+)

For each canonical issue group:
- Count frequency across playthroughs
- List affected profiles
- Pick best evidence
- Score: `severity_weight × frequency × breadth_factor`
  - Weights: critical=10, high=5, medium=3, low=1, cosmetic=0.5
  - Breadth: 1.0 (1 profile), 1.25 (2), 1.5 (3+)

Write updated `data/playtests/leaderboard.json`.

### Step 4: Display Results
Show the user:

1. **Run Summary Table:**
```
Profile      | Result  | Floor | Encounters | Accuracy | Max Combo
-------------|---------|-------|------------|----------|----------
beginner     | defeat  |     2 |          4 |    48.1% |         2
average      | defeat  |     5 |         13 |    72.3% |         3
expert       | victory |    12 |         36 |    89.5% |         5
struggling   | defeat  |     1 |          2 |    35.0% |         1
```

2. **Top Issues (from leaderboard):**
```
# | Severity | Title                                  | Freq | Score | Profiles
1 | HIGH     | Floor 3 boss damage spike              |    3 |  22.5 | beginner, struggling, average
2 | MEDIUM   | Combo cap unreachable for low-accuracy  |    2 |   9.0 | beginner, struggling
```

3. **Also mention:** `Run 'node tests/playtest/view-leaderboard.mjs' for the full ranked leaderboard`

## Important Notes
- Run simulations in PARALLEL (background agents or sequential bash commands)
- Do NOT skip the analysis step — raw logs without analysis are not useful
- The triage step is cumulative — it merges with previous leaderboard data
- If `profiles=all`, use: beginner, average, expert, speed-runner, struggling, impatient
