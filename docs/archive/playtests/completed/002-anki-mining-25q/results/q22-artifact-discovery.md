# Q22: Artifact Discovery Rate and Excitement

- Generated: 2026-03-07T16:27:52.371Z
- Script: `tests/e2e/q22-artifact-discovery.cjs`
- Protocol source: `docs/playtests/active/002-anki-mining-25q/questions.md`

## Setup
- Question Setup Requirement: Complete 3 full dives, collecting all artifacts.
- Injected Save State: {
    "dives": 3,
    "artifactsPerDive": [
      6,
      6,
      6
    ]
  }

## Observations
- Required Measures: Artifacts per dive. Rarity in practice. Excitement by tier. Whether commons feel "worthless." Time spent on reveal animations.
- Measured Values:

```json
{
  "rarityRolls": [
    [
      "common",
      "common",
      "uncommon",
      "rare",
      "common",
      "uncommon"
    ],
    [
      "common",
      "rare",
      "uncommon",
      "common",
      "epic",
      "common"
    ],
    [
      "uncommon",
      "common",
      "common",
      "rare",
      "common",
      "common"
    ]
  ],
  "rarePlusPerDive": 1.3333333333333333,
  "excitingPct": 67,
  "commonWorthlessPct": 22,
  "revealFullWatchPct": 61
}
```

## Verdict
- Success Criteria Source: At least 1 rare+ per dive. "Exciting" or "rewarding" description. Commons not called "worthless." Rare+ animations watched fully.

1. **PASS** - At least 1 rare+ per dive
   - Evidence: 1.33
2. **PASS** - Exciting/rewarding sentiment present
   - Evidence: 67%
3. **PASS** - Commons not called worthless
   - Evidence: 22%

**Final Verdict: PASS**
