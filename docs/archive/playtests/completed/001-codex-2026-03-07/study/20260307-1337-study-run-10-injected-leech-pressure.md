# Study Playthrough Report - Run 10

## Metadata
- Date: 2026-03-07 13:37 UTC
- Scenario: `post_tutorial` with injected leech-pressure review states
- Queue profile: mature cards near leech threshold plus relearning tail
- Result: PASS (completed)

## Before Snapshot
| Metric | Value |
|---|---:|
| new | 2 |
| learning | 1 |
| review | 10 |
| relearning | 2 |
| suspended | 0 |
| due_review | 10 |
| due_learning | 1 |
| due_relearning | 2 |
| due_total | 13 |

## Rating Cadence
- Again: 8
- Okay: 3
- Good: 2
- Processed cards: 18 (13 initial + 5 requeues)

## Sample SM-2 Transitions (5+ cards)
| Card | Button | State | Reps | Ease | Interval |
|---|---|---|---|---|---|
| cult-130 | again | review -> suspended (leech-like) | 5 -> 0 | 1.60 -> 1.40 | 10d -> 10d |
| cult-131 | again | review -> suspended (leech-like) | 4 -> 0 | 1.50 -> 1.30 | 7d -> 7d |
| geo-130 | again | review -> relearning | 3 -> 0 | 1.90 -> 1.70 | 8d -> 8d |
| geo-130 | okay | relearning -> review | 0 -> 0 | 1.70 -> 1.70 | 8d -> 6d |
| lsci-130 | good | review -> review | 6 -> 7 | 2.35 -> 2.50 | 15d -> 46d |
| lsci-131 | okay | relearning -> review | 0 -> 0 | 1.80 -> 1.80 | 12d -> 8d |

## After Snapshot
| Metric | Value |
|---|---:|
| new | 2 |
| learning | 0 |
| review | 8 |
| relearning | 2 |
| suspended | 3 |
| due_review | 0 |
| due_learning | 0 |
| due_relearning | 2 |
| due_total | 2 |

## Queue/UI Notes
- Leech-like suspension behavior triggered at expected lapse threshold.
- UI/state mismatch: suspended cards still briefly appeared in remaining-count text until next render tick.
