---
description: "View playtest results: latest logs, reports, and the ranked issue leaderboard"
---

# Playtest Results Viewer

Display the current state of playtest results without running new simulations.

## Arguments
- `leaderboard` (default): Show the ranked issue leaderboard
- `logs`: List recent playtest log files with summaries
- `report <id>`: Show a specific analysis report
- `log <id>`: Show details of a specific playthrough log

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
