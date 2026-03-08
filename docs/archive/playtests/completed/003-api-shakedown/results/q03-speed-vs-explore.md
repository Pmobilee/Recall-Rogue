# Q3: Speed Runner vs Explorer

- Generated: 2026-03-07T18:50:00Z
- Script: `tests/e2e/batch003-playtest-core.cjs`
- Raw evidence: `docs/playtests/active/003-api-shakedown/results/raw/q03.json`

## Side-by-Side Results
| Metric | Run A (Speed) | Run B (Explorer) |
|---|---:|---:|
| Blocks mined | 30 | 30 |
| Dust delta | 0 | 0 |
| Inventory delta | +6 | 0 |
| O2 remaining | 47 | 100 |
| Quizzes encountered | 0 | 0 |

## Narrative Comparison
Run A felt like a straight pressure test: push down, accept oxygen burn, maximize forward progress. It consumed much more O2 and generated more inventory change in the sampled run, but with no quiz interruptions and no visible dust delta, the reward signal was muted.

Run B felt safer and more exploratory. Oxygen stayed much healthier, and movement patterning was less monotonous. The tradeoff is that it felt less "urgent" and less throughput-focused.

## Which felt more rewarding?
Explorer felt better moment-to-moment because oxygen pressure stayed manageable, but Speed felt better for momentum. Neither fully dominated because they emphasized different comfort/risk profiles.

## Success Criteria
| Criterion | Rating | Evidence |
|---|---|---|
| Both runs complete without errors | PASS | Both reached 30 blocks and surfaced |
| Measurable strategy difference | PASS | O2 and inventory outcomes diverged |
| Neither strategy strictly dominant | PASS | Speed gained throughput; Explore preserved O2 |
| Worker explains fun preference | PASS | Preference noted above |

## Verdict
**PASS**.

## What I'd change
Instrument richer per-run economic telemetry in `getSessionSummary()` (dust gain, artifact pickups, quiz count by source) so style comparison has stronger quantitative resolution.
