# Study Playthrough Report - Run 08

## Metadata
- Date: 2026-03-07 13:29 UTC
- Scenario: `post_tutorial` with injected new + learning mix
- Queue profile: onboarding carryover cards and first due learning steps
- Result: PASS (completed)

## Before Snapshot
| Metric | Value |
|---|---:|
| new | 8 |
| learning | 4 |
| review | 2 |
| relearning | 0 |
| suspended | 0 |
| due_review | 1 |
| due_learning | 4 |
| due_relearning | 0 |
| due_total | 5 |

## Rating Cadence
- Again: 3
- Okay: 7
- Good: 2
- Processed cards: 13 (10 initial + 3 requeues)

## Sample SM-2 Transitions (5+ cards)
| Card | Button | State | Reps | Ease | Interval |
|---|---|---|---|---|---|
| geo-110 | okay | learning -> review | 0 -> 1 | 2.50 -> 2.50 | 0d -> 1d |
| geo-111 | again | learning -> learning | 0 -> 0 | 2.50 -> 2.50 | 0d -> 0d |
| cult-110 | good | new -> review | 0 -> 1 | 2.50 -> 2.65 | 0d -> 4d |
| cult-111 | okay | new -> learning | 0 -> 0 | 2.50 -> 2.50 | 0d -> 0d |
| lsci-110 | again | review -> relearning | 2 -> 0 | 2.30 -> 2.10 | 6d -> 6d |
| lsci-110 | okay | relearning -> review | 0 -> 0 | 2.10 -> 2.10 | 6d -> 4d |

## After Snapshot
| Metric | Value |
|---|---:|
| new | 4 |
| learning | 6 |
| review | 4 |
| relearning | 0 |
| suspended | 0 |
| due_review | 0 |
| due_learning | 6 |
| due_relearning | 0 |
| due_total | 6 |

## Queue/UI Notes
- New and learning cards coexisted without crash.
- Queue anomaly: one learning card with same `nextReviewAt` timestamp repeatedly floated to the top after requeue.
