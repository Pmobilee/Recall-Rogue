# Playtest Report: Study Score Feedback Loop

## Session Narrative
I seeded a 20-fact review state and tracked study score over 3 neglectful days followed by 3 diligent days. Neglect phase score stayed flat at `0.460` in this scenario, so the expected drop did not materialize from fast-forward alone.

Diligent phase produced a strong upward trend (`0.565 -> 0.670 -> 0.850`) with tier shift from `average` to `diligent` by day 3, and modeled quiz chance dropped accordingly (`0.493 -> 0.465`).

## Key Observations
- Recovery loop is clearly functional and motivating.
- Neglect penalty signal appears under-responsive in this setup.
- Tier transitions on recovery looked correct.

## Measurements
| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Initial score/tier | 0.460 / average | baseline | - |
| Score after 3 neglect days | 0.460 | should drop | FAIL |
| Score after 3 diligent days | 0.850 / diligent | should recover | PASS |
| Quiz chance trend | 0.504 -> 0.465 | should respond to score | PASS |

## Emotional Arc
- Start: neutral
- Mid: concerned by flat neglect response
- End: encouraged by strong recovery behavior

## Issues Found
### Balance: Neglect decay may be too weak in this state profile
- Severity: medium
- Description: Score did not decrease across 3 no-study days.
- Expected: Clear downward movement after consecutive neglect days.
- Suggested fix: Revisit debt/engagement weighting or neglect-day handling when due set is low.

## Verdict
**FAIL** on the neglect-decay criterion, **PASS** on recovery dynamics.
