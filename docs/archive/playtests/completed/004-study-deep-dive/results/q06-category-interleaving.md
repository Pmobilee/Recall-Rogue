# Playtest Report: Category Interleaving Quality

## Session Narrative
I ran a 20-card mixed session and logged category/type per card. The sequence was heavily interleaved: essentially every card moved to a different category branch.

This avoided category streak fatigue (max consecutive = 1), but transition frequency was very high (`18` transitions), which can feel cognitively jumpy depending on player preference.

## Key Observations
- Strong spread, no category dominance.
- Zero long same-category runs.
- High transition cadence may trade focus for variety.

## Measurements
| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Session cards logged | 20 | 20 | PASS |
| Max consecutive same-category | 1 | <=4 | PASS |
| Dominant-category share | ~5% each (broad spread) | <70% | PASS |
| Jarring transition count | 18 | Low/moderate preferred | WARNING |

## Emotional Arc
- Start: curious
- Mid: brisk/varied
- End: mentally busy but engaged

## Issues Found
### Balance: Interleaving may be over-aggressive
- Severity: low
- Description: Near-constant category switching can feel fragmented.
- Expected: Some clustering to preserve short-term context.
- Suggested fix: Add light batching rule (e.g., allow 2-card micro-clusters before switching).

## Verdict
**PASS** on hard criteria, with a UX tuning note.
