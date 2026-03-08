# Playthrough Report - Mine

## Metadata
- Date: 2026-03-07 12:30
- Gameplay: mine
- Scenario: 3 O2 tanks, 20 review cards, 5 mature overdue cards, force at least 2 wrong mature answers
- Runtime: ~35s
- Budget used: 4 screenshots, 15 snapshots, 49 evaluate calls, 120 key presses

## Starting State
- Save injection verified: `screen=base`, `oxygen=3`, `reviewStates=20`
- Due mature cards (`repetitions >= 5`): `cult-001` (6), `cult-002` (7), `cult-003` (8), `cult-004` (6), `cult-005` (7)
- Dive prep verified with explicit 3-tank selection (`Estimated Oxygen: 300 O2`)

## Playthrough Log
- Entered mine from `divePrepScreen`; HUD showed `O2: 300/300` at layer transition to Peat Bog.
- Ran capped mining loop (`120` key presses) with periodic state polling.
- Encountered 7 quizzes total; first 2 mature-card quizzes were answered deliberately wrong.
- Mature wrong tests were on `cult-001` and `cult-002`; both recorded no observable O2 delta in `playerSave.oxygen`.
- Session ended still on `screen=mining`; no `diveResults` screen reached within key cap.

## Issues Found
| # | Severity | Category | Description |
|---|----------|----------|-------------|
| 1 | [HIGH] | data | Consistency penalty not observable on deliberate mature wrong answer `cult-001` (expected extra O2 drain; observed `actualDrain=0` in save-level O2) |
| 2 | [HIGH] | data | Consistency penalty not observable on deliberate mature wrong answer `cult-002` (expected extra O2 drain; observed `actualDrain=0` in save-level O2) |
| 3 | [HIGH] | data | UI/store mismatch during dive: HUD remained `O2: 300/300` while `playerSave.oxygen` dropped to `0` in snapshots |
| 4 | [MEDIUM] | behavioral | `120` key presses produced no increase in `totalBlocksMined` (remained `300`) |
| 5 | [MEDIUM] | behavioral | Dive did not complete within capped loop; `diveResults` not reached/captured |

## Ending State
- Final screen: `mining`
- Final save oxygen tanks: `0`
- HUD text at end: `O2: 300/300 x1.1` (unchanged display)
- `totalBlocksMined`: `300` (no delta)
- `diveResults`: `null`

## State Delta
| Field | Before | After | Delta |
|---|---|---|---|
| `playerSave.oxygen` | 3 | 0 | -3 |
| HUD O2 label | `3 O2` (base), then `300/300` in mine | `300/300` | no visible drain in HUD |
| `stats.totalBlocksMined` | 300 | 300 | 0 |
| `stats.totalQuizCorrect` | 25 | 28 | +3 |
| `stats.totalQuizWrong` | 5 | 5 | 0 |

## Consistency Penalty Test Results
| factId | repetitions | O2 Before | O2 After | Expected Penalty | Actual Drain | Pass/Fail |
|---|---:|---:|---:|---|---:|---|
| cult-001 | 6 | 0 | 0 | mature wrong should apply extra drain | 0 | Fail |
| cult-002 | 7 | 0 | 0 | mature wrong should apply extra drain | 0 | Fail |

## Verdict
**FAIL**

The run satisfied scenario setup and forced 2 deliberate wrong mature answers, but consistency-penalty behavior was not observable in save-level O2 data, O2 UI/store values were inconsistent, and the dive did not finish within the 120-key cap.
