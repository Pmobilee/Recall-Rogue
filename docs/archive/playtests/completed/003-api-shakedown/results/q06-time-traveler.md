# Q6: The Time Traveler - SM-2 Interval Testing

- Generated: 2026-03-07T18:50:00Z
- Script: `tests/e2e/batch003-playtest-core.cjs`
- Raw evidence: `docs/playtests/active/003-api-shakedown/results/raw/q06.json`

## Timeline Narrative
**Day 0:** Reviewed 5 tracked cards (`cult-001`..`cult-005`) with grade pattern `good, good, okay, okay, again`.
Intervals immediately diverged as expected in part: two `good` cards moved to interval 10, two `okay` cards to interval 8, and the `again` card dropped into relearning with interval 3 and `lapseCount=1`.

**Day 1 (`fastForward(24)`):** Due queue changed, but none of the original five cards reappeared in the new 25-card queue sample (`returnedDay1 = []`).

**Day 4 total (`fastForward(72)` after Day 1 pass):** Still none of the original tracked cards returned in the sampled due queue (`returnedDay4 = []`).
Final review states for tracked facts collapsed to uniform interval 3 / repetitions 2, indicating state behavior that does not align with expected graded separation over time.

## Key Measurements
- Tracked cards: `cult-001, cult-002, cult-003, cult-004, cult-005`
- Day 0 intervals: `10, 10, 8, 8, 3(relearning)`
- Returned after Day 1: `none`
- Returned after Day 4: `none`
- Final intervals for tracked cards: all `3`

## Success Criteria
| Criterion | Rating | Evidence |
|---|---|---|
| `fastForward()` changes which cards are due | PASS | Queue composition changed after time shift |
| `again` cards return sooner than `good` cards | FAIL | Tracked `again` card did not reappear in sampled due queues |
| Intervals increase with repeated `good` grades | FAIL | Final tracked intervals regressed/uniformized to 3 |
| No 0 or infinite intervals | PASS | All tracked intervals remained finite and >0 |

## Verdict
**FAIL** for SM-2 expectation fidelity in this scenario.

## What I'd change
Audit `fastForward()` + due-queue assembly interactions, especially around `nextReviewAt` normalization and post-session state rewriting that appears to flatten interval separation.
