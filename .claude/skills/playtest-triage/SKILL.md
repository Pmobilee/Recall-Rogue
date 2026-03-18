---
description: "Triage playtest reports: deduplicate, score, and rank issues on a leaderboard"
---

# ⚠️ AR Phase Doc Required — see `.claude/skills/work-tracking/SKILL.md` for rules.
# ℹ️ This skill is READ-ONLY. Implementation work from findings requires an AR doc — see `.claude/skills/work-tracking/SKILL.md`.

# Playtest Triage

Review all analysis reports, deduplicate issues, score them, and maintain a ranked leaderboard.

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
      "title": "Floor 7 boss damage spike kills beginners in 2 turns",
      "description": "...",
      "frequency": 4,
      "affectedProfiles": ["beginner", "struggling", "average", "impatient"],
      "firstSeen": "2026-03-10T...",
      "lastSeen": "2026-03-10T...",
      "rank": 1,
      "score": 30.0,
      "status": "open",
      "sourceReports": ["report-playthrough-beginner-42-...", "..."],
      "bestEvidence": { "metric": "Enemy dealt 53 damage in one turn", "floor": 7, "profileId": "beginner" },
      "reproductionSteps": ["Use profile: beginner, seed: 42", "Reach floor 7"]
    }
  ]
}
```

## Output
Print a ranked table of the top 10 issues:
```
# | Sev    | Title                              | Freq | Score | Profiles
1 | HIGH   | Floor 7 boss damage spike...       |    4 |  30.0 | beginner, struggling, average, impatient
2 | MEDIUM | Shield cards never played...        |    3 |  13.5 | beginner, struggling, impatient
```

Also run: `node tests/playtest/view-leaderboard.mjs` to display the formatted table.
