# Study Playthrough Report - Run 02

## Metadata
- Date: 2026-03-07 13:05 UTC
- Scenario: `many_reviews_due` mixed rating cadence
- Queue profile: high overdue review load plus light learning tail
- Result: PASS (completed)

## Before Snapshot
| Metric | Value |
|---|---:|
| new | 4 |
| learning | 2 |
| review | 14 |
| relearning | 1 |
| suspended | 0 |
| due_review | 14 |
| due_learning | 2 |
| due_relearning | 1 |
| due_total | 17 |

## Rating Cadence
- Again: 4
- Okay: 10
- Good: 5
- Processed cards: 20 (17 initial + 3 requeues)

## Sample SM-2 Transitions (5+ cards)
| Card | Button | State | Reps | Ease | Interval |
|---|---|---|---|---|---|
| cult-011 | good | review -> review | 6 -> 7 | 2.50 -> 2.65 | 24d -> 83d |
| cult-012 | okay | review -> review | 5 -> 6 | 2.40 -> 2.40 | 16d -> 38d |
| geo-002 | again | review -> relearning | 3 -> 0 | 2.30 -> 2.10 | 11d -> 11d |
| geo-002 | okay | relearning -> review | 0 -> 0 | 2.10 -> 2.10 | 11d -> 8d |
| lsci-007 | okay | learning -> review | 0 -> 1 | 2.50 -> 2.50 | 0d -> 1d |
| lsci-008 | good | learning -> review | 0 -> 1 | 2.50 -> 2.65 | 0d -> 4d |

## After Snapshot
| Metric | Value |
|---|---:|
| new | 4 |
| learning | 1 |
| review | 15 |
| relearning | 1 |
| suspended | 0 |
| due_review | 0 |
| due_learning | 1 |
| due_relearning | 1 |
| due_total | 2 |

## Queue/UI Notes
- Due stack was consumed in expected priority order (review -> learning/relearning).
- UI/state mismatch: completion panel listed "17 cards studied" while state delta reflected 20 processed interactions including requeues.
