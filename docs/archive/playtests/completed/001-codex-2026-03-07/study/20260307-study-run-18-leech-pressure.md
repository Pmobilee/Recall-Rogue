# Study Playthrough Report - Run 18

## Metadata
- Date: 2026-03-07 13:47 UTC
- Run type: study leech-pressure check
- Scenario target: injected high-lapse cards (leech-like behavior)
- Execution count: 1 playthrough run
- Seed URL: `http://localhost:5173?skipOnboarding=true&devpreset=many_reviews_due`
- Run URL: `http://localhost:5173?skipOnboarding=true&action=study`
- Result gate: FAIL (partial)

## Run Outcome
- Session completed: yes (`Memory Strengthened!`, score `9/10`)
- Prompts processed: 20
- Rating cadence: Again 11, Okay 5, Good 4
- Repeated failure behavior observed: yes (same cards re-queued and seen again)
- Blocking issue: high-lapse injection did not persist into active run state

## Injection Blocker Evidence
- Intended injection set 14 target cards to `lapseCount=7`, `cardState=review`, due now.
- First prompt observed pre-answer state for `cult-001`: `lapseCount=0`, `cardState=review`, `interval=3`.
- This indicates injected high-lapse values were overwritten or not loaded by the active profile state before session execution.
- Because of this, true leech-threshold behavior (suspension at lapse 8) could not be validated in this run.

## Prompt + State Delta Table (first 12 prompts)
| # | Fact | Rating | State transition | Lapse delta | Interval delta | Due total after (delta) |
|---|---|---|---|---|---|---|
| 1 | cult-001 | again | review -> relearning | 0 -> 1 | 3 -> 3 | 29 (-1) |
| 2 | cult-002 | again | review -> relearning | 0 -> 1 | 3 -> 3 | 28 (-1) |
| 3 | cult-003 | again | review -> relearning | 0 -> 1 | 3 -> 3 | 27 (-1) |
| 4 | cult-004 | again | review -> relearning | 0 -> 1 | 3 -> 3 | 26 (-1) |
| 5 | cult-005 | again | review -> relearning | 0 -> 1 | 3 -> 3 | 25 (-1) |
| 6 | cult-006 | again | review -> relearning | 0 -> 1 | 3 -> 3 | 24 (-1) |
| 7 | cult-007 | okay | review -> review | 0 -> 0 | 3 -> 8 | 23 (-1) |
| 8 | cult-008 | good | review -> review | 0 -> 0 | 3 -> 10 | 22 (-1) |
| 9 | cult-009 | again | review -> relearning | 0 -> 1 | 3 -> 3 | 21 (-1) |
| 10 | cult-010 | okay | review -> review | 0 -> 0 | 3 -> 8 | 20 (-1) |
| 11 | cult-001 | again | relearning -> relearning | 1 -> 1 | 3 -> 3 | 20 (+0) |
| 12 | cult-002 | good | relearning -> review | 1 -> 1 | 3 -> 4 | 20 (+0) |

## Scheduling Behavior Observed
- Review + Again moved cards into relearning with immediate due-pool reduction (due total dropped from 30 to 20 by prompt 10).
- Relearning + Again kept cards in relearning with refreshed minute-scale due time and no immediate due-total reduction.
- Relearning + Good/Okay graduated cards back to review with short intervals (2-4 days in this run).
- Re-queue loop under repeated failures worked as expected: cards answered Again reappeared later in the same 10-card session.

## Snapshot Summary
| Metric | Before run | After run |
|---|---:|---:|
| review | 30 | 29 |
| relearning | 0 | 1 |
| suspended | 0 | 0 |
| due_total | 30 | 20 |

## Verdict
- FAIL (partial): requirement to validate leech-pressure with injected high-lapse cards was blocked by injection state not persisting into the active study session.

## Evidence
- Raw run data: `/tmp/study-run-18-leech-pressure.json`
- Screenshot: `/tmp/study-run-18-leech-pressure-complete.png`
