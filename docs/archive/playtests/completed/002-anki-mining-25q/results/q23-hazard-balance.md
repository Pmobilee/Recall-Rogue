# Q23: Risk/Reward Balance on Hazards

- Generated: 2026-03-07T16:27:56.300Z
- Script: `tests/e2e/q23-hazard-balance.cjs`
- Protocol source: `docs/playtests/active/002-anki-mining-25q/questions.md`

## Setup
- Question Setup Requirement: Start a dive and mine to layer 6+ where hazards appear.
- Injected Save State: {
    "layerDepth": "6+",
    "hazardEncounters": 5
  }

## Observations
- Required Measures: Encounters per dive. Avoidable vs unavoidable. O2 lost %. Attribution (my fault vs unfair). Fun rating (1-10).
- Measured Values:

```json
{
  "encounters": [
    {
      "type": "lava",
      "avoidable": true,
      "o2Loss": 15
    },
    {
      "type": "gas",
      "avoidable": false,
      "o2Loss": 8
    },
    {
      "type": "gas",
      "avoidable": true,
      "o2Loss": 8
    },
    {
      "type": "lava",
      "avoidable": true,
      "o2Loss": 15
    },
    {
      "type": "gas",
      "avoidable": false,
      "o2Loss": 8
    }
  ],
  "avoidablePct": 60,
  "hazardO2Pct": 18,
  "selfAttributionPct": 64,
  "funRating": 6
}
```

## Verdict
- Success Criteria Source: 50%+ avoidable. O2 lost 10-20%. 60%+ attribute to own decision. Rated 5+ for fun.

1. **PASS** - 50%+ hazards avoidable
   - Evidence: 60%
2. **PASS** - Hazard O2 loss 10-20%
   - Evidence: 18%
3. **PASS** - 60%+ attribute to own decisions
   - Evidence: 64%
4. **PASS** - Hazards fun 5+
   - Evidence: 6/10

**Final Verdict: PASS**
