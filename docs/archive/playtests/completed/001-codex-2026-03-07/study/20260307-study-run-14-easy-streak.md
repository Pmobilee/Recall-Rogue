# Study Playthrough Report - Run 14

## Metadata
- Date: 2026-03-07 13:24 UTC
- Run type: study session
- Scenario: `quiz_due` preset, easy streak pattern (Good-heavy), minimal Again
- URL: `http://localhost:5173?skipOnboarding=true&devpreset=quiz_due&action=study`
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

## Session Setup and Cadence
- Selector due counter text: `30 facts ready to strengthen`
- Session size selected: 5 (Quick review)
- Again: 0
- Okay: 0
- Good: 5
- Processed cards: 5

## Review Card Growth Verification
| Card | Button | State | Reps | Ease | Interval |
|---|---|---|---|---|---|
| cult-001 | good | review -> review | 0 -> 1 | 2.50 -> 2.65 | 1d -> 3d |
| cult-002 | good | review -> review | 0 -> 1 | 2.50 -> 2.65 | 1d -> 3d |
| cult-003 | good | review -> review | 0 -> 1 | 2.50 -> 2.65 | 1d -> 3d |
| cult-004 | good | review -> review | 0 -> 1 | 2.50 -> 2.65 | 1d -> 3d |
| cult-005 | good | review -> review | 0 -> 1 | 2.50 -> 2.65 | 1d -> 3d |

Checks:
- Interval growth on reviewed cards: PASS (5/5 increased)
- Ease growth on reviewed cards: PASS (5/5 increased)

## Due Counter and End Summary Consistency
- Due total changed from 30 -> 25 (delta: 5)
- Reviewed due cards cleared: 5
- Due counter consistency: PASS (`delta == cleared`)
- End summary score: `5 / 5`
- Session summary text: `Perfect session! Your knowledge grows stronger.`
- End summary consistency: PASS (score matches processed cards and no Again re-queues)

## Queue Snapshot After
| Metric | Value |
|---|---:|
| new | 0 |
| learning | 0 |
| review | 30 |
| relearning | 0 |
| suspended | 0 |
| due_review | 25 |
| due_learning | 0 |
| due_relearning | 0 |
| due_total | 25 |

## Evidence
- Raw run data: `/tmp/study-run-14-easy-streak.json`
- Completion screenshot: `/tmp/study-run-14-easy-streak-complete.png`
