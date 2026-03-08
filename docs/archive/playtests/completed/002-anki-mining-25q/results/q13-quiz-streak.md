# Q13: Quiz Streak Motivation

- Generated: 2026-03-07T16:26:58.189Z
- Script: `tests/e2e/q13-quiz-streak.cjs`
- Protocol source: `docs/playtests/active/002-anki-mining-25q/questions.md`

## Setup
- Question Setup Requirement: Start a dive. Monitor `quizStreak` via `window.__terraDebug()`.
- Injected Save State: {
    "injectedFacts": 50,
    "divesObserved": 3
  }

## Observations
- Required Measures: Max streak per dive. Average streak before break. Dust bonus as % of total. Tester awareness. Emotional response to breaks.
- Measured Values:

```json
{
  "maxStreaks": [
    3,
    5,
    2
  ],
  "tier1PerDive": 0.6666666666666666,
  "tier2DivePct": 33.3,
  "streakDustPct": 9
}
```

## Verdict
- Success Criteria Source: Most players reach tier 1 (3 streak) once per dive. Tier 2 (5) reached in ~30% of dives. Streak dust is 5-15% of total.

1. **FAIL** - Tier 1 reached once per dive
   - Evidence: 0.67 per dive
2. **PASS** - Tier 2 reached in ~30% dives
   - Evidence: 33.3%
3. **PASS** - Streak dust 5-15% of total
   - Evidence: 9%

**Final Verdict: INCONCLUSIVE**
