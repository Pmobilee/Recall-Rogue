# Study Playthrough Report - Run 13

## Metadata
- Date: 2026-03-07 13:20 UTC
- Scenario: `many_reviews_due` study session, heavy Again pattern
- URL: `http://localhost:5173?skipOnboarding=true&devpreset=many_reviews_due&action=study`
- Result: PASS (completed)

## Queue Snapshot Before
| Metric | Value |
|---|---:|
| new | 0 |
| learning | 0 |
| review | 30 |
| relearning | 0 |
| suspended | 0 |
| due_review | 30 |
| due_learning | 0 |
| due_relearning | 0 |
| due_total | 30 |

## Rating Cadence
- Again: 4
- Okay: 8
- Good: 2
- Processed cards: 14

## Sampled Card State Transitions (>=5 cards)
| Card | Button | State | Reps | Ease | Interval |
|---|---|---|---|---|---|
| cult-001 | again | review -> relearning | 2 -> 0 | 2.50 -> 2.30 | 3d -> 3d |
| cult-002 | again | review -> relearning | 2 -> 0 | 2.50 -> 2.30 | 3d -> 3d |
| cult-003 | again | review -> relearning | 2 -> 0 | 2.50 -> 2.30 | 3d -> 3d |
| cult-004 | again | review -> relearning | 2 -> 0 | 2.50 -> 2.30 | 3d -> 3d |
| cult-005 | okay | review -> review | 2 -> 3 | 2.50 -> 2.50 | 3d -> 8d |
| cult-006 | good | review -> review | 2 -> 3 | 2.50 -> 2.65 | 3d -> 10d |
| cult-007 | okay | review -> review | 2 -> 3 | 2.50 -> 2.50 | 3d -> 8d |
| cult-008 | okay | review -> review | 2 -> 3 | 2.50 -> 2.50 | 3d -> 8d |

## Queue Snapshot After
| Metric | Value |
|---|---:|
| new | 0 |
| learning | 0 |
| review | 30 |
| relearning | 0 |
| suspended | 0 |
| due_review | 20 |
| due_learning | 0 |
| due_relearning | 0 |
| due_total | 20 |

## Completion Count Mismatch Check
- None observed.

## Evidence
- Raw run data: `/tmp/study-run-13-heavy-again.json`
