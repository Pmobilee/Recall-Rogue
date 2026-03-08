# Q8: The Stress Tester - Edge Cases & Rapid Actions

- Generated: 2026-03-07T18:50:00Z
- Script: `tests/e2e/batch003-playtest-core.cjs`
- Raw evidence: `docs/playtests/active/003-api-shakedown/results/raw/q08.json`

## Edge-Case Matrix
| Action | Expected | Actual | PASS/FAIL |
|---|---|---|---|
| `mineBlock(down)` while not in mine | `ok:false` with clear message | `ok:false`, "Invalid direction: down" | PASS |
| `answerQuiz(0)` with no quiz | `ok:false` | `ok:false`, "Quiz answer button 0 not found" | PASS |
| `gradeCard(good)` outside study | `ok:false` | `ok:false`, "Rating button 'good' not found" | PASS |
| `navigate('totally-not-a-real-screen')` | reject invalid screen | `ok:true`, navigated anyway | FAIL |
| `mineBlock('diagonal')` | `ok:false` invalid direction | `ok:false`, "Invalid direction: diagonal" | PASS |

## Rapid/Boundary Checks
- `look()` called 10x rapidly: no hangs/timeouts observed
- `fastForward(0)`: ok
- `fastForward(-1)`: ok (accepted negative)
- `fastForward(99999)`: ok
- `getQuiz()` with no active quiz: `null` (clean)
- Post-edge sanity: could still start dive, mine, and end dive successfully

## Success Criteria
| Criterion | Rating | Evidence |
|---|---|---|
| Invalid actions return `{ok:false,...}` instead of crashes | FAIL | invalid `navigate()` returned `ok:true` |
| Error messages are descriptive | PASS | all sampled failures had specific messages |
| Game remains functional after stress actions | PASS | sanity run succeeded after edge cases |
| No hangs/timeouts | PASS | none observed |

## API Robustness Score
**B-**.

## Verdict
**FAIL** on strict invalid-action contract due permissive navigation handling.

## What I'd change
Validate screen ids inside `navigate()` against an allowlist and return `ok:false` for unknown targets.
