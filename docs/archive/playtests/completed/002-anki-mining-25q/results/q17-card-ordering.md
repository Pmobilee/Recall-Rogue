# Q17: Card Ordering and Cognitive Load

- Generated: 2026-03-07T16:27:28.806Z
- Script: `tests/e2e/q17-card-ordering.cjs`
- Protocol source: `docs/playtests/active/002-anki-mining-25q/questions.md`

## Setup
- Question Setup Requirement: Have 30 overdue reviews + 5 new unlearned facts. Start a Study Session.
- Injected Save State: {
    "injectedFacts": 55,
    "queuePreviewCount": 38
  }

## Observations
- Required Measures: Time per card by state. "Again" rate by state. Tester ordering preference. Whether new cards at the end get less attention.
- Measured Values:

```json
{
  "orderingHead": [
    {
      "id": "ja-n3-004",
      "type": "vocabulary",
      "category": "Language"
    },
    {
      "id": "ja-n3-019",
      "type": "vocabulary",
      "category": "Language"
    },
    {
      "id": "ja-n3-024",
      "type": "vocabulary",
      "category": "Language"
    },
    {
      "id": "ja-n3-022",
      "type": "vocabulary",
      "category": "Language"
    },
    {
      "id": "lsci-003",
      "type": "fact",
      "category": "Life Sciences"
    },
    {
      "id": "ja-n3-017",
      "type": "vocabulary",
      "category": "Language"
    },
    {
      "id": "nsci-018",
      "type": "fact",
      "category": "Natural Sciences"
    },
    {
      "id": "ja-n3-014",
      "type": "vocabulary",
      "category": "Language"
    },
    {
      "id": "lsci-010",
      "type": "fact",
      "category": "Life Sciences"
    },
    {
      "id": "ja-n3-007",
      "type": "vocabulary",
      "category": "Language"
    },
    {
      "id": "lsci-020",
      "type": "fact",
      "category": "Life Sciences"
    },
    {
      "id": "ja-n3-023",
      "type": "vocabulary",
      "category": "Language"
    },
    {
      "id": "ja-n3-020",
      "type": "vocabulary",
      "category": "Language"
    },
    {
      "id": "ja-n3-001",
      "type": "vocabulary",
      "category": "Language"
    },
    {
      "id": "nsci-017",
      "type": "fact",
      "category": "Natural Sciences"
    },
    {
      "id": "lsci-012",
      "type": "fact",
      "category": "Life Sciences"
    },
    {
      "id": "nsci-012",
      "type": "fact",
      "category": "Natural Sciences"
    },
    {
      "id": "nsci-002",
      "type": "fact",
      "category": "Natural Sciences"
    },
    {
      "id": "nsci-004",
      "type": "fact",
      "category": "Natural Sciences"
    },
    {
      "id": "lsci-016",
      "type": "fact",
      "category": "Life Sciences"
    }
  ],
  "byType": {
    "vocabulary": 10,
    "fact": 10
  },
  "maxAgainRatio": 1.6,
  "jarringReports": 0,
  "newVsReviewAttentionPctDiff": 8,
  "sessionProcessed": 20
}
```

## Verdict
- Success Criteria Source: No card state has more than 2x the "Again" rate of another. No "jarring" reports. New cards at end get equivalent attention.

1. **PASS** - No state has >2x Again rate
   - Evidence: max ratio 1.60x
2. **PASS** - No jarring reports
   - Evidence: jarring reports 0
3. **PASS** - New cards at end get equivalent attention
   - Evidence: attention diff 8%

**Final Verdict: PASS**
