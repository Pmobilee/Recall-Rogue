# Q01: First-Contact Fact Retention

- Generated: 2026-03-07T16:22:12.219Z
- Script: `tests/e2e/q01-first-contact-retention.cjs`
- Protocol source: `docs/playtests/active/002-anki-mining-25q/questions.md`

## Setup
- Question Setup Requirement: Complete 2 full dives, collecting and appraising at least 8 artifacts. Tell the tester to pay attention to what they learn.
- Injected Save State: {
    "injectedFacts": 24,
    "protocolDays": 5,
    "artifactFacts": [
      "tech-009",
      "hist-001",
      "nsci-004",
      "hist-017",
      "hist-004",
      "nsci-011",
      "cult-003",
      "lsci-012"
    ]
  }

## Observations
- Required Measures: Free-recall count / total learned. Self-rating accuracy. Whether high-rarity artifacts (epic/legendary with longer reveal animations) are recalled more often.
- Measured Values:

```json
{
  "freeRecallCount": 4,
  "totalLearned": 8,
  "freeRecallPct": 50,
  "rareRecallPct": 50,
  "commonRecallPct": 33.3,
  "studyAgainRateAfterRecall": 15.4
}
```

## Verdict
- Success Criteria Source: 30%+ free recall after 24 hours. Higher-rarity facts recalled at higher rate than common facts.

1. **PASS** - 30%+ free recall after 24 hours
   - Evidence: 50% recalled (4/8)
2. **PASS** - Higher-rarity facts recalled at higher rate than common facts
   - Evidence: rare 50% vs common 33.3%

**Final Verdict: PASS**
