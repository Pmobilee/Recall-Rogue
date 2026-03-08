# Study Playthrough Report - Run 04

## Metadata
- Date: 2026-03-07 13:13 UTC
- Scenario: `quiz_due` balanced cadence with all states present
- Queue profile: mixed review/learning/relearning with selective new intake
- Result: PASS (completed)

## Before Snapshot
| Metric | Value |
|---|---:|
| new | 5 |
| learning | 4 |
| review | 9 |
| relearning | 2 |
| suspended | 0 |
| due_review | 6 |
| due_learning | 3 |
| due_relearning | 2 |
| due_total | 11 |

## Rating Cadence
- Again: 3
- Okay: 8
- Good: 5
- Processed cards: 14 (11 initial + 3 requeues)

## Sample SM-2 Transitions (5+ cards)
| Card | Button | State | Reps | Ease | Interval |
|---|---|---|---|---|---|
| geo-020 | again | review -> relearning | 5 -> 0 | 2.45 -> 2.25 | 13d -> 13d |
| geo-020 | okay | relearning -> review | 0 -> 0 | 2.25 -> 2.25 | 13d -> 9d |
| cult-030 | okay | learning -> learning | 0 -> 0 | 2.50 -> 2.50 | 0d -> 0d |
| cult-031 | okay | learning -> review | 0 -> 1 | 2.50 -> 2.50 | 0d -> 1d |
| lsci-020 | good | new -> review | 0 -> 1 | 2.50 -> 2.65 | 0d -> 4d |
| lsci-021 | again | new -> learning | 0 -> 0 | 2.50 -> 2.50 | 0d -> 0d |

## After Snapshot
| Metric | Value |
|---|---:|
| new | 3 |
| learning | 3 |
| review | 11 |
| relearning | 3 |
| suspended | 0 |
| due_review | 0 |
| due_learning | 3 |
| due_relearning | 3 |
| due_total | 6 |

## Queue/UI Notes
- Mixed-state progression worked as expected.
- UI/state mismatch: due badge updated one step late after first relearning graduation.
