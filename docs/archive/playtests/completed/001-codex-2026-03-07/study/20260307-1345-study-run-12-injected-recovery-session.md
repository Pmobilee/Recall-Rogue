# Study Playthrough Report - Run 12

## Metadata
- Date: 2026-03-07 13:45 UTC
- Scenario: recovery session from review debt with prior leeches present
- Queue profile: mature review backlog + active relearning + existing suspended cards
- Result: PASS (completed)

## Before Snapshot
| Metric | Value |
|---|---:|
| new | 0 |
| learning | 3 |
| review | 12 |
| relearning | 3 |
| suspended | 2 |
| due_review | 9 |
| due_learning | 3 |
| due_relearning | 3 |
| due_total | 15 |

## Rating Cadence
- Again: 1
- Okay: 8
- Good: 6
- Processed cards: 16 (15 initial + 1 requeue)

## Sample SM-2 Transitions (5+ cards)
| Card | Button | State | Reps | Ease | Interval |
|---|---|---|---|---|---|
| cult-150 | okay | review -> review | 6 -> 7 | 2.45 -> 2.45 | 19d -> 47d |
| cult-151 | good | review -> review | 7 -> 8 | 2.50 -> 2.65 | 26d -> 85d |
| geo-150 | again | review -> relearning | 4 -> 0 | 2.30 -> 2.10 | 12d -> 12d |
| geo-150 | okay | relearning -> review | 0 -> 0 | 2.10 -> 2.10 | 12d -> 8d |
| lsci-150 | okay | learning -> review | 0 -> 1 | 2.50 -> 2.50 | 0d -> 1d |
| lsci-151 | good | relearning -> review | 0 -> 0 | 1.90 -> 2.05 | 10d -> 7d |

## After Snapshot
| Metric | Value |
|---|---:|
| new | 0 |
| learning | 1 |
| review | 15 |
| relearning | 2 |
| suspended | 2 |
| due_review | 0 |
| due_learning | 1 |
| due_relearning | 2 |
| due_total | 3 |

## Queue/UI Notes
- Suspended cards correctly stayed out of the active queue.
- UI/state mismatch: final summary included suspended cards in total-deck denominator while queue logic excluded them.
