# Study Playthrough Report - Run 05

## Metadata
- Date: 2026-03-07 13:17 UTC
- Scenario: `quiz_due` relearning-heavy recovery run
- Queue profile: lapse recovery with low-ease review set
- Result: PASS (completed)

## Before Snapshot
| Metric | Value |
|---|---:|
| new | 1 |
| learning | 2 |
| review | 8 |
| relearning | 6 |
| suspended | 0 |
| due_review | 5 |
| due_learning | 1 |
| due_relearning | 6 |
| due_total | 12 |

## Rating Cadence
- Again: 5
- Okay: 7
- Good: 3
- Processed cards: 16 (12 initial + 4 requeues)

## Sample SM-2 Transitions (5+ cards)
| Card | Button | State | Reps | Ease | Interval |
|---|---|---|---|---|---|
| cult-041 | again | review -> relearning | 4 -> 0 | 2.10 -> 1.90 | 8d -> 8d |
| cult-042 | again | review -> suspended (leech-like) | 2 -> 0 | 1.50 -> 1.30 | 6d -> 6d |
| cult-043 | okay | relearning -> review | 0 -> 0 | 1.90 -> 1.90 | 12d -> 8d |
| geo-030 | good | relearning -> review | 0 -> 0 | 1.80 -> 1.95 | 10d -> 7d |
| lsci-030 | okay | learning -> review | 0 -> 1 | 2.50 -> 2.50 | 0d -> 1d |
| lsci-031 | again | relearning -> relearning | 0 -> 0 | 1.85 -> 1.85 | 7d -> 7d |

## After Snapshot
| Metric | Value |
|---|---:|
| new | 1 |
| learning | 1 |
| review | 9 |
| relearning | 5 |
| suspended | 1 |
| due_review | 0 |
| due_learning | 1 |
| due_relearning | 5 |
| due_total | 6 |

## Queue/UI Notes
- Relearning graduation used 70% interval retention as expected.
- Queue anomaly: one relearning card reappeared twice consecutively after rapid Again -> Again sequence.
