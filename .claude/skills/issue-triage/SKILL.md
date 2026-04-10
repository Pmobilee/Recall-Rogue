---
name: issue-triage
description: "Triage playtest reports: deduplicate, score, and rank issues on a leaderboard"
user_invocable: true
---

# Issue Triage

This is a read-only analysis skill. It produces findings; implementation work from those findings is planned and tracked per `.claude/rules/task-tracking.md` and `.claude/skills/feature-pipeline/SKILL.md`.

Review all analysis reports, deduplicate issues, score them, and maintain a ranked leaderboard.

## Data Sources

Reports come from `/sim-report`, which reads headless sim output from `data/playtests/runs/` and writes structured reports to `data/playtests/reports/report-*.json`.

The triage skill reads from `data/playtests/reports/report-*.json` and writes to `data/playtests/leaderboard.json`.

## Player Profiles

The six headless sim profiles are:

- `first_timer` — new player, minimal game knowledge
- `casual_learner` — plays occasionally, moderate accuracy
- `regular` — consistent player, average performance
- `gamer` — optimizes play, high win rate target
- `dedicated` — committed learner, strong accuracy
- `scholar` — top-tier accuracy and deck building

## Steps

1. Read all report files from `data/playtests/reports/report-*.json`
2. Read existing leaderboard from `data/playtests/leaderboard.json` (create if missing)
3. Extract all issues from all reports
4. **Deduplicate** by grouping issues with the same `(category, floor_bucket)`:
   - Floor buckets: 1-3 (early), 4-6 (mid-early), 7-9 (mid), 10-12 (late), 13+ (endgame)
   - Issues in the same category AND floor bucket are considered the same canonical issue
5. For each canonical issue:
   - Count frequency (how many playthroughs triggered it)
   - List affected player profiles
   - Pick the best evidence (most dramatic metric)
   - Compute score: `severity_weight × frequency × breadth_factor`
     - severity_weight: critical=10, high=5, medium=3, low=1, cosmetic=0.5
     - breadth_factor: 1.0 (1 profile), 1.25 (2 profiles), 1.5 (3+ profiles)
6. Merge into leaderboard (update existing entries or add new ones)
7. Sort by score descending, assign ranks
8. Write updated `data/playtests/leaderboard.json`

## Leaderboard JSON Format
```json
{
  "updatedAt": "ISO timestamp",
  "totalPlaythroughs": 6,
  "totalIssues": 15,
  "issues": [
    {
      "canonicalId": "balance_damage_spike_mid",
      "category": "balance_damage_spike",
      "severity": "high",
      "title": "Floor 7 boss damage spike kills first_timers in 2 turns",
      "description": "...",
      "frequency": 4,
      "affectedProfiles": ["first_timer", "casual_learner", "regular", "gamer"],
      "firstSeen": "2026-03-10T...",
      "lastSeen": "2026-03-10T...",
      "rank": 1,
      "score": 30.0,
      "status": "open",
      "sourceReports": ["report-playthrough-first_timer-42-...", "..."],
      "bestEvidence": { "metric": "Enemy dealt 53 damage in one turn", "floor": 7, "profileId": "first_timer" },
      "reproductionSteps": ["Use profile: first_timer, seed: 42", "Reach floor 7"]
    }
  ]
}
```

## Output
Print a ranked table of the top 10 issues:
```
# | Sev    | Title                              | Freq | Score | Profiles
1 | HIGH   | Floor 7 boss damage spike...       |    4 |  30.0 | first_timer, casual_learner, regular, gamer
2 | MEDIUM | Shield cards never played...        |    3 |  13.5 | first_timer, casual_learner, gamer
```

Also run: `node tests/playtest/view-leaderboard.mjs` to display the formatted table.
