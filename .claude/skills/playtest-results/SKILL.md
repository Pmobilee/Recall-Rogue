---
description: "View playtest results: latest logs, reports, and the ranked issue leaderboard"
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

# Playtest Results Viewer

Display the current state of playtest results without running new simulations.

## Arguments
- `leaderboard` (default): Show the ranked issue leaderboard
- `logs`: List recent playtest log files with summaries
- `report <id>`: Show a specific analysis report
- `log <id>`: Show details of a specific playthrough log
- `engagement`: Show engagement and fun score summary across recent runs

## Steps

### Default: Show Leaderboard
1. Run `node tests/playtest/view-leaderboard.mjs`
2. If no leaderboard exists, tell the user to run `/playtest-suite` first

### `logs`: List Recent Logs
1. List files in `data/playtests/logs/` sorted by modification time (newest first)
2. For each log (up to 10), read the JSON and show:
   ```
   File: playthrough-expert-1001-1234567890.json
   Profile: expert | Result: defeat | Floor: 6 | Accuracy: 87.8% | Encounters: 18
   ```

### `report <id>`: Show Report
1. Find the matching file in `data/playtests/reports/`
2. Read and display the issues found:
   ```
   Report: report-playthrough-expert-1001-1234567890.json
   Issues found: 3

   1. [HIGH] balance_damage_spike — Floor 5 boss deals 45 damage in one turn
      Evidence: Turn 89, Floor 5, Encounter 2
      Metric: Enemy dealt 45 damage (56% of 80 HP)

   2. [MEDIUM] balance_combo_unreachable — Max combo never reaches 4 despite 87.8% accuracy
      Evidence: Across all encounters
   ```

### `log <id>`: Show Log Details
1. Find the matching log file
2. Show the summary section and encounter-by-encounter breakdown:
   ```
   Playthrough: playthrough-expert-1001-1234567890
   Profile: expert | Seed: 1001 | Floors: 6 | Mode: headless
   Result: defeat | Final Floor: 6

   Encounter Breakdown:
   Floor | Enc | Enemy          | Result  | Turns | HP Left | Accuracy | Combo
   ------|-----|----------------|---------|-------|---------|----------|------
     1   |  0  | cave_bat       | victory |     3 |      75 |   100.0% |     3
     1   |  1  | crystal_golem  | victory |     4 |      62 |    83.3% |     2
     1   |  2  | crystal_guardian| victory |     5 |      48 |    80.0% |     3
   ```

### `engagement`: Show Engagement Summary
1. List the 10 most recent logs in `data/playtests/logs/`
2. For each, read the JSON and extract `summary.deepStats.engagement` (if present)
3. Show:
   ```
   Engagement & Fun Scores — Recent Runs

   Profile      | Seed  | Floor | Engagement | Fun  | Dead% | Slogs | Streaks (C/W) | Facts | Trend
   -------------|-------|-------|------------|------|-------|-------|---------------|-------|------
   expert       | 42    |    24 |         71 |   74 |  2.1% |     0 |        8 / 2  |   142 |  +0.05
   average      | 42    |     8 |         55 |   52 |  5.3% |     1 |        5 / 4  |    87 |  +0.02
   beginner     | 42    |     3 |         32 |   28 | 12.0% |     2 |        3 / 6  |    34 |  -0.08

   Averages:        Engagement: 53/100 | Fun: 51/100

   Runs with engagement < 30: 1 (beginner)
   Runs with fun < 30: 1 (beginner)
   ```
4. If no runs have deepStats.engagement, tell the user to re-run playtests with deep mode enabled
