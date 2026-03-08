# Study Playthrough Report - Run 17

## Metadata
- Date: 2026-03-07 13:42 UTC
- Run type: study summary consistency check
- Scenario: `many_reviews_due` preset, medium cadence ratings
- URL: `http://localhost:5173?skipOnboarding=true&devpreset=many_reviews_due`
- Result gate: PASS

## Cadence and Session Path
- Playthrough count: 1
- Session cadence pattern: `Okay, Good, Again, Good, Okay, Good` (repeated across two 5-card sessions)
- Mid session answered: 6 (one Again re-queue)
- End session answered: 6 (one Again re-queue)
- Summary shown both times: `5 / 5` and `Perfect session! Your knowledge grows stronger.`

## Due Count Consistency Check (Visible vs Store)
| Checkpoint | Visible due count | Store-derived due count | Delta |
|---|---:|---:|---:|
| Start | 35 | 35 | 0 |
| Mid | 30 | 30 | 0 |
| End | 25 | 25 | 0 |

## Mismatch Thresholds
- PASS threshold: `delta = 0`
- WARN threshold: `delta = 1`
- FAIL threshold: `delta >= 2`
- Observed max delta: `0` (no mismatches)

## Consistency Verdict
- Start/mid/end visible due counters are fully consistent with store-derived due counts.
- No threshold violations.
- Final verdict: PASS.

## Evidence
- Raw run data: `/tmp/study-run-17-summary-consistency.json`
