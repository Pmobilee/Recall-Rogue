# Playtest Report: Consistency Penalty Cross-System

## Session Narrative
I studied five facts (`cult-001..005`) with `Good`, then entered mine and repeatedly forced quiz events to try to catch a matching studied fact and fail it deliberately. Quiz forcing worked, but no matching studied fact appeared in this sample window.

Because no match occurred, the cross-system consistency path (extra O2 penalty, warning line, additional ease penalty) could not be validated empirically in this run.

## Key Observations
- Study-to-mine setup completed correctly.
- Forced quiz loop did not hit studied IDs in allotted attempts.
- No consistency warning/ease-penalty evidence captured.

## Measurements
| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Studied fact IDs tracked | 5 | >=5 | PASS |
| Matched studied fact in mine quiz | No | Yes | FAIL |
| Consistency warning shown | No | Yes | INCONCLUSIVE |
| Extra O2 / ease penalty measured | No | Yes | INCONCLUSIVE |

## Emotional Arc
- Start: controlled
- Mid: repetitive randomization
- End: inconclusive

## Issues Found
### Testability gap: Cross-system consistency requires deterministic fact targeting
- Severity: medium
- Description: Random quiz selection prevented reliable match with recently studied IDs.
- Expected: Practical deterministic route to reproduce consistency penalty.
- Suggested fix: Add `forceQuizForFact(factId)` in playtest API.

## Verdict
**INCONCLUSIVE**.
