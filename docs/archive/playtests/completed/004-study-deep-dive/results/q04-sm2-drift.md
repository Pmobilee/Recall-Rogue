# Playtest Report: Seven-Day SM-2 Drift

## Session Narrative
I seeded 15 mixed review states and executed a 7-day loop with daily fast-forward + study pass. Day 1 produced a meaningful session (`reviewed=14`, `againRate=0.071`, `minEase=2.20`, `meanEase=2.553`).

From Day 2 onward, queue size dropped to zero in this scripted path, so no additional daily reviews occurred. That means long-horizon drift behavior was only observable for the first day and could not be fully profiled across all seven days.

## Key Observations
- No ease death spiral on observed data.
- Day-1 again rate was slightly below target band.
- Days 2-7 had no study workload in this setup.

## Measurements
| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Days with non-empty queue | 1/7 | 7/7 (for full drift audit) | FAIL |
| Min ease observed | 2.20 | >1.5 | PASS |
| Again-rate average | ~0.01 overall (0.071 on active day) | 0.08-0.15 | FAIL |
| Ease explosion (>4.0) | None | None | PASS |

## Emotional Arc
- Start: analytical
- Mid: blocked by lack of due cards
- End: inconclusive

## Issues Found
### Balance/Testability: Drift test lost workload after day 1
- Severity: medium
- Description: Daily queue emptied after first simulated day in this harness path.
- Expected: Regular due-card cadence across 7-day simulation.
- Suggested fix: Seed larger/denser due distribution or enforce daily due floor for drift tests.

## Verdict
**INCONCLUSIVE** for full 7-day drift; partial data indicates no catastrophic ease collapse.
