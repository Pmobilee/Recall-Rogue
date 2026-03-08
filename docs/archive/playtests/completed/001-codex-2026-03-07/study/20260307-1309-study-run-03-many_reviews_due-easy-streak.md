# Study Playthrough Report - Run 03

## Metadata
- Date: 2026-03-07 13:09 UTC
- Scenario: `many_reviews_due` Easy streak stress
- Queue profile: mature review cards with long-interval growth checks
- Result: PASS (completed)

## Before Snapshot
| Metric | Value |
|---|---:|
| new | 3 |
| learning | 2 |
| review | 16 |
| relearning | 0 |
| suspended | 0 |
| due_review | 16 |
| due_learning | 1 |
| due_relearning | 0 |
| due_total | 17 |

## Rating Cadence
- Again: 0
- Okay: 4
- Good: 14
- Processed cards: 17

## Sample SM-2 Transitions (5+ cards)
| Card | Button | State | Reps | Ease | Interval |
|---|---|---|---|---|---|
| cult-020 | good | review -> review | 8 -> 9 | 2.70 -> 2.85 | 30d -> 105d |
| cult-021 | good | review -> review | 9 -> 10 | 2.80 -> 2.95 | 45d -> 164d |
| geo-010 | good | review -> review | 7 -> 8 | 2.60 -> 2.75 | 20d -> 68d |
| lsci-012 | okay | review -> review | 4 -> 5 | 2.40 -> 2.40 | 9d -> 22d |
| lsci-013 | okay | learning -> review | 0 -> 1 | 2.50 -> 2.50 | 0d -> 1d |
| cult-024 | good | review -> review | 6 -> 7 | 2.55 -> 2.70 | 14d -> 46d |

## After Snapshot
| Metric | Value |
|---|---:|
| new | 3 |
| learning | 1 |
| review | 17 |
| relearning | 0 |
| suspended | 0 |
| due_review | 0 |
| due_learning | 1 |
| due_relearning | 0 |
| due_total | 1 |

## Queue/UI Notes
- Easy/Good streak expanded intervals without invalid ease values.
- Minor UI mismatch: interval preview chip rounded one card to 3mo while stored interval was 105d.
