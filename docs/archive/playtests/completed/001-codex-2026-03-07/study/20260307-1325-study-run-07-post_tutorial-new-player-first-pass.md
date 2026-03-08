# Study Playthrough Report - Run 07

## Metadata
- Date: 2026-03-07 13:25 UTC
- Scenario: `post_tutorial` new-player first study pass
- Queue profile: mostly new cards, no mature review debt
- Result: PASS (completed)

## Before Snapshot
| Metric | Value |
|---|---:|
| new | 12 |
| learning | 0 |
| review | 0 |
| relearning | 0 |
| suspended | 0 |
| due_review | 0 |
| due_learning | 0 |
| due_relearning | 0 |
| due_total | 0 |

## Rating Cadence
- Again: 2
- Okay: 6
- Good: 2
- Processed cards: 10 (daily new-card cap)

## Sample SM-2 Transitions (5+ cards)
| Card | Button | State | Reps | Ease | Interval |
|---|---|---|---|---|---|
| geo-100 | good | new -> review | 0 -> 1 | 2.50 -> 2.65 | 0d -> 4d |
| geo-101 | okay | new -> learning | 0 -> 0 | 2.50 -> 2.50 | 0d -> 0d |
| geo-102 | okay | new -> learning | 0 -> 0 | 2.50 -> 2.50 | 0d -> 0d |
| geo-103 | again | new -> learning | 0 -> 0 | 2.50 -> 2.50 | 0d -> 0d |
| cult-100 | good | new -> review | 0 -> 1 | 2.50 -> 2.65 | 0d -> 4d |
| cult-101 | okay | new -> learning | 0 -> 0 | 2.50 -> 2.50 | 0d -> 0d |

## After Snapshot
| Metric | Value |
|---|---:|
| new | 2 |
| learning | 8 |
| review | 2 |
| relearning | 0 |
| suspended | 0 |
| due_review | 0 |
| due_learning | 8 |
| due_relearning | 0 |
| due_total | 8 |

## Queue/UI Notes
- Daily new-card cap enforced at 10 cards.
- UI/state mismatch: start badge showed "0 due" even though the session surfaced capped new cards.
