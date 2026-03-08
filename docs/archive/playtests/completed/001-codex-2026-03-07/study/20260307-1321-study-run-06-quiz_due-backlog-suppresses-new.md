# Study Playthrough Report - Run 06

## Metadata
- Date: 2026-03-07 13:21 UTC
- Scenario: `quiz_due` with backlog suppressing new cards
- Queue profile: high due review debt, new-card throttle active
- Result: PASS (completed)

## Before Snapshot
| Metric | Value |
|---|---:|
| new | 10 |
| learning | 1 |
| review | 11 |
| relearning | 2 |
| suspended | 0 |
| due_review | 11 |
| due_learning | 1 |
| due_relearning | 1 |
| due_total | 13 |

## Rating Cadence
- Again: 2
- Okay: 8
- Good: 4
- Processed cards: 15 (13 initial + 2 requeues)

## Sample SM-2 Transitions (5+ cards)
| Card | Button | State | Reps | Ease | Interval |
|---|---|---|---|---|---|
| cult-050 | okay | review -> review | 5 -> 6 | 2.50 -> 2.50 | 14d -> 35d |
| cult-051 | good | review -> review | 6 -> 7 | 2.45 -> 2.60 | 18d -> 57d |
| geo-041 | again | review -> relearning | 3 -> 0 | 2.20 -> 2.00 | 9d -> 9d |
| geo-041 | okay | relearning -> review | 0 -> 0 | 2.00 -> 2.00 | 9d -> 6d |
| lsci-040 | okay | learning -> review | 0 -> 1 | 2.50 -> 2.50 | 0d -> 1d |
| lsci-041 | good | review -> review | 4 -> 5 | 2.35 -> 2.50 | 11d -> 34d |

## After Snapshot
| Metric | Value |
|---|---:|
| new | 10 |
| learning | 0 |
| review | 13 |
| relearning | 1 |
| suspended | 0 |
| due_review | 0 |
| due_learning | 0 |
| due_relearning | 1 |
| due_total | 1 |

## Queue/UI Notes
- New cards were correctly excluded while review backlog remained high.
- UI/state mismatch: due badge displayed 15 before start, but queue contained 13 due cards (new excluded by throttle).
