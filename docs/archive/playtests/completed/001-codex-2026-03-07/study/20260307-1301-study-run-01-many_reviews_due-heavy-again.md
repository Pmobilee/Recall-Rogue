# Study Playthrough Report - Run 01

## Metadata
- Date: 2026-03-07 13:01 UTC
- Scenario: `many_reviews_due` with heavy Again lapse cadence
- Queue profile: review-heavy with injected high-lapse cards
- Result: PASS (completed)

## Before Snapshot
| Metric | Value |
|---|---:|
| new | 2 |
| learning | 3 |
| review | 12 |
| relearning | 3 |
| suspended | 0 |
| due_review | 12 |
| due_learning | 2 |
| due_relearning | 3 |
| due_total | 17 |

## Rating Cadence
- Again: 10
- Okay: 6
- Good: 1
- Processed cards: 23 (17 initial + 6 requeues)

## Sample SM-2 Transitions (5+ cards)
| Card | Button | State | Reps | Ease | Interval |
|---|---|---|---|---|---|
| cult-001 | again | review -> relearning | 6 -> 0 | 2.60 -> 2.40 | 21d -> 21d |
| cult-004 | again | review -> relearning | 7 -> 0 | 2.50 -> 2.30 | 18d -> 18d |
| geo-003 | again | review -> suspended (leech-like) | 4 -> 0 | 1.70 -> 1.50 | 9d -> 9d |
| lsci-002 | okay | relearning -> review | 0 -> 0 | 2.00 -> 2.00 | 10d -> 7d |
| cult-008 | good | review -> review | 5 -> 6 | 2.55 -> 2.70 | 12d -> 40d |
| geo-006 | okay | learning -> review | 0 -> 1 | 2.50 -> 2.50 | 0d -> 1d |

## After Snapshot
| Metric | Value |
|---|---:|
| new | 2 |
| learning | 1 |
| review | 8 |
| relearning | 8 |
| suspended | 1 |
| due_review | 0 |
| due_learning | 1 |
| due_relearning | 8 |
| due_total | 9 |

## Queue/UI Notes
- Requeue behavior matched spec: Again cards returned later in same session.
- UI mismatch: header showed "17 due" while active queue rose to 23 after requeues.
- Minor ordering anomaly: one newer due review card displayed before an older overdue card after repeated Again events.
