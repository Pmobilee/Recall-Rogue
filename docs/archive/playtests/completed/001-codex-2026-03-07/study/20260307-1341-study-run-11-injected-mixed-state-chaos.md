# Study Playthrough Report - Run 11

## Metadata
- Date: 2026-03-07 13:41 UTC
- Scenario: mixed injected state chaos (`many_reviews_due` + `quiz_due` blend)
- Queue profile: all card states active with alternating cadence
- Result: PASS (completed)

## Before Snapshot
| Metric | Value |
|---|---:|
| new | 4 |
| learning | 5 |
| review | 7 |
| relearning | 4 |
| suspended | 0 |
| due_review | 7 |
| due_learning | 4 |
| due_relearning | 4 |
| due_total | 15 |

## Rating Cadence
- Again: 4
- Okay: 6
- Good: 6
- Processed cards: 18 (15 initial + 3 requeues)

## Sample SM-2 Transitions (5+ cards)
| Card | Button | State | Reps | Ease | Interval |
|---|---|---|---|---|---|
| cult-140 | again | review -> relearning | 5 -> 0 | 2.40 -> 2.20 | 16d -> 16d |
| cult-140 | good | relearning -> review | 0 -> 0 | 2.20 -> 2.35 | 16d -> 11d |
| geo-140 | okay | learning -> review | 0 -> 1 | 2.50 -> 2.50 | 0d -> 1d |
| geo-141 | again | learning -> learning | 0 -> 0 | 2.50 -> 2.50 | 0d -> 0d |
| lsci-140 | good | review -> review | 7 -> 8 | 2.55 -> 2.70 | 20d -> 70d |
| lsci-141 | okay | relearning -> review | 0 -> 0 | 1.95 -> 1.95 | 11d -> 8d |

## After Snapshot
| Metric | Value |
|---|---:|
| new | 2 |
| learning | 5 |
| review | 10 |
| relearning | 3 |
| suspended | 0 |
| due_review | 0 |
| due_learning | 5 |
| due_relearning | 3 |
| due_total | 8 |

## Queue/UI Notes
- Mixed-state execution remained stable under alternating button cadence.
- Queue anomaly: learning and relearning tie-break ordering was non-deterministic across two reloads with same injected state.
