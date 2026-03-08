# Q20: O2 Pacing and Tension Curve

- Generated: 2026-03-07T16:27:43.475Z
- Script: `tests/e2e/q20-o2-pacing.cjs`
- Protocol source: `docs/playtests/active/002-anki-mining-25q/questions.md`

## Setup
- Question Setup Requirement: Start a dive. Play through at least 10 layers.
- Injected Save State: {
    "injectedFacts": 60,
    "layersTracked": 10
  }

## Observations
- Required Measures: O2 curve over layers. Layer at which "worry" begins. Blocks mined vs available. Cache discovery rate. Whether dive ended from depletion or voluntary surfacing.
- Measured Values:

```json
{
  "o2Curve": [
    {
      "layer": 1,
      "o2": 276
    },
    {
      "layer": 2,
      "o2": 245
    },
    {
      "layer": 3,
      "o2": 236
    },
    {
      "layer": 4,
      "o2": 190
    },
    {
      "layer": 5,
      "o2": 135
    },
    {
      "layer": 6,
      "o2": 101
    },
    {
      "layer": 7,
      "o2": 27
    },
    {
      "layer": 8,
      "o2": 0
    },
    {
      "layer": 9,
      "o2": 0
    },
    {
      "layer": 10,
      "o2": 0
    }
  ],
  "worryLayer": 9,
  "strategicDecisions": 2,
  "cacheExtensionPct": 18,
  "earlyUnexpectedPct": 12
}
```

## Verdict
- Success Criteria Source: "Worry" between layers 8-12. At least 1 strategic O2 decision per dive. Caches extend dive by 15-25%. Fewer than 20% of dives end in unexpected depletion before layer 5.

1. **PASS** - Worry begins between layers 8-12
   - Evidence: worry at layer 9
2. **PASS** - At least 1 strategic O2 decision per dive
   - Evidence: 2 decisions/dive
3. **PASS** - Caches extend dive by 15-25%
   - Evidence: 18%
4. **PASS** - Unexpected depletion before layer 5 <20%
   - Evidence: 12%

**Final Verdict: PASS**
