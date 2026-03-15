---
description: "Analyze playtest logs for balance issues, UX problems, and bugs"
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

# Playtest Analysis

Analyze one or more playthrough log files to identify game design issues.

## Arguments
Parse from the user's message:
- `log`: path to a specific log file, OR
- `latest`: analyze the most recent log in `data/playtests/logs/`, OR
- `all`: analyze all unanalyzed logs (no matching report in `data/playtests/reports/`)

## Steps

1. Read the playthrough log JSON file(s) from `data/playtests/logs/`
2. Read the analysis guide: `tests/playtest/analysis/sonnet-analyzer-prompt.md`
3. For each log, scan for issues using the detection rules below
4. Write a report JSON to `data/playtests/reports/report-{playthroughId}.json`

## Detection Rules

Scan the log's turns array and summary for these patterns:

### Balance Issues
- **balance_damage_spike** (HIGH): Enemy deals >50% of player's current HP in one enemy turn
- **balance_too_easy** (LOW): Player defeats 3+ consecutive enemies with >90% HP remaining
- **balance_too_hard** (MEDIUM): Player reaches 0 HP or <10% HP on floor 1-3
- **balance_healing_insufficient** (MEDIUM): Player never heals above 60% HP after floor 3
- **balance_combo_unreachable** (MEDIUM): Player has >60% accuracy but never reaches combo 3+

### UX Issues
- **ux_dead_turn** (MEDIUM): Turn where all cards in hand are buff/debuff but no valid targets exist
- **ux_no_meaningful_choice** (LOW): Hand contains 5 cards of the same type
- **ux_unfun_moment** (LOW): Player HP drops from >70% to <20% in a single encounter

### Progression Issues
- **progression_difficulty_spike** (HIGH): Encounter takes >2x the average turns of the previous floor
- **progression_dead_end** (CRITICAL): Player cannot damage enemy (all cards blocked by immunity)

### Canary Issues
- **canary_not_triggering** (MEDIUM): Player gets 3+ wrong answers on a floor but canary stays neutral
- **canary_over_compensating** (LOW): Canary activates assist mode when player accuracy >70%

### Mechanic Issues
- **mechanic_unused** (LOW): A card type appears in 0 played cards across the entire run
- **mechanic_broken** (CRITICAL): Card effect produces 0 damage/shield/heal when it shouldn't

### Engagement Issues (when deepStats.engagement is present)
- **engagement_boring_run** (MEDIUM): `engagementScore < 30` — run lacked meaningful decisions
- **engagement_tedious_grind** (MEDIUM): `slogEncounters > 2` OR `deadTurnPct > 15%` — encounters drag
- **engagement_too_easy** (LOW): `snowballEncounters` > 50% of total encounters — no challenge
- **engagement_fact_staleness** (LOW): `factRepeatRate > 0.40` — too many repeated facts
- **engagement_frustrating_streaks** (MEDIUM): `wrongStreakMax > 5` — too many wrong answers in a row
- **engagement_low_fun** (HIGH): `funScore < 25` for expert or average profiles — run was not enjoyable

## Report Format

Write JSON matching this schema:
```json
{
  "playthroughId": "string",
  "profileId": "string",
  "analyzedAt": "ISO timestamp",
  "issueCount": 0,
  "engagementSummary": {
    "engagementScore": 0,
    "funScore": 0,
    "avgTurnsPerEncounter": 0,
    "avgCardsPlayedPerEncounter": 0,
    "deadTurnPct": 0,
    "snowballEncounters": 0,
    "slogEncounters": 0,
    "correctStreakMax": 0,
    "wrongStreakMax": 0,
    "uniqueFactsSeen": 0,
    "factRepeatRate": 0,
    "accuracyTrend": 0
  },
  "issues": [
    {
      "id": "issue-{playthroughId}-{seq}",
      "playthroughId": "string",
      "profileId": "string",
      "category": "balance_damage_spike",
      "severity": "high",
      "title": "Short description (max 120 chars)",
      "description": "Detailed explanation",
      "evidence": {
        "turnSeqs": [12, 13, 14],
        "floor": 3,
        "encounter": 2,
        "metric": "Player HP dropped from 65 to 12 in one enemy turn (enemy dealt 53 damage)"
      },
      "reproductionSteps": ["Use profile: beginner, seed: 42", "Reach floor 3, encounter 2", "End player turn"],
      "suggestedFix": "Optional suggestion"
    }
  ]
}
```

## Output
Report a summary: total issues by severity (critical/high/medium/low), engagement scores (engagement/fun), and list the top 3 most severe issues with their titles.
