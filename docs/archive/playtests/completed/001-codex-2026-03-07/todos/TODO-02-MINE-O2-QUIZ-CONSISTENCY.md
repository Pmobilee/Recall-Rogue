# TODO-02 Mine O2 Quiz Consistency

## Problem statement and impact

Mine sessions show repeated consistency defects around oxygen presentation/state sync, quiz penalty observability, and progression telemetry under active input. In dedicated consistency runs, HUD and persisted O2 diverge, mature-card wrong-answer penalties are not reliably observable, and some runs show zero block delta despite movement inputs. This undermines trust in the mine loop and invalidates core balance telemetry.

## Frequency and occurrence in corpus

- `MINE-005` O2 HUD/store divergence + consistency penalty defects: 4 reports (`raw/analysis-mine-study.md`)
- `MINE-003` no mining progress despite input: 15 reports (`raw/analysis-mine-study.md`)
- Related noise overlap (`MINE-006`/`MINE-004`) amplifies diagnosis difficulty across 19 and 16 reports.

## Evidence references (spot-checked)

- `docs/playthroughs/codex-2026-03-07/raw/analysis-mine-study.md`
- `docs/playthroughs/codex-2026-03-07/mine/2026-03-07-1230-3tanks-20cards-consistency.md`
- `docs/playthroughs/codex-2026-03-07/mine/2026-03-07-1015-full-dive-20-cards.md`
- `docs/playthroughs/codex-2026-03-07/mine/20260307-mine-run-15-custom-mature-a.md`
- `docs/playthroughs/codex-2026-03-07/mine/20260307-mine-run-16-custom-mature-b.md`
- `docs/playthroughs/codex-2026-03-07/mine/20260307-1333-mine-run-04-mid_dive_active.md`
- `docs/playthroughs/codex-2026-03-07/mine/20260307-1342-mine-run-11-many_reviews_due_short.md`
- `docs/playthroughs/codex-2026-03-07/mine/20260307-mine-run-14-many_reviews_due-long.md`
- `docs/playthroughs/codex-2026-03-07/mine/codex-combined.md`

## Suspected root-cause areas (repo paths)

- `src/game/scenes/MineScene.ts` (O2 HUD binding, quiz overlay timing, mining progress emission)
- `src/game/GameManager.ts` (dive lifecycle state handoff and per-layer transitions)
- `src/game/managers/QuizManager.ts` (consistency penalty guard conditions)
- `src/game/systems/OxygenSystem.ts` (canonical O2 state ownership)
- `src/ui/components/HUD.svelte` (display source-of-truth for O2)
- `src/ui/stores/playerData.ts` (persisted `stats.totalBlocksMined`, O2 save synchronization)
- `tests/e2e/02-mine-quiz-flow.cjs` (assertion depth for penalty + HUD/state alignment)

## Phased fix plan

### Phase A - Telemetry truth and reproducibility

1. Add deterministic debug counters for `blocksMinedThisDive`, `quizShown`, `quizAnswered`, `o2DrainEvents`.
2. Log both HUD O2 and save O2 at each quiz answer and each descent transition.
3. Add one controlled test fixture profile with mature due cards and fixed O2 tanks for repeatable runs.

### Phase B - State alignment and penalty enforcement

1. Ensure O2 display always derives from a single canonical state atom during dive.
2. Audit and enforce mature-review wrong-answer penalty path in `QuizManager` with card-state guard.
3. Validate block-mined stat increments only on true block-break events and not movement/no-op input.
4. Protect against layer-transition O2 re-init drift by carrying canonical max/current values across scene boundaries.

### Phase C - Behavioral test lock

1. Extend mine E2E script to force one deliberate wrong answer on mature review and assert O2 penalty delta.
2. Add assertions comparing HUD O2 text and store O2 for each checkpoint.
3. Add a minimum mined-block delta check when movement and mining actions are confirmed.

## Acceptance criteria

- Mature `review` card answered wrong produces measurable extra O2 drain versus control answer path.
- HUD O2 and persisted/state O2 remain in sync at all sampled checkpoints (max tolerated drift: 0).
- Runs with confirmed mining inputs show positive block delta by end of scripted action window.
- Dive completion and results screen capture include consistent O2 and quiz outcome totals.

## Verification protocol

- Playwright interactive:
  - Start with `?skipOnboarding=true&devpreset=many_reviews_due` and `custom_mature_*` states.
  - Inspect `window.__terraDebug()` before/after deliberate wrong mature answer.
  - Confirm `window.__terraLog` contains penalty event with expected reason.
- Automated:
  - `node tests/e2e/02-mine-quiz-flow.cjs`
  - Add one new consistency script for mature penalty and O2 parity.
- Unit/integration:
  - Unit tests for `QuizManager.isConsistencyViolation` branches.
  - Integration test for O2 state carryover across layer descent.

## Risk and rollback notes

- Risk: tightening penalty logic can over-penalize learning/relearning if card-state check is wrong.
- Risk: O2 source-of-truth refactor may break HUD refresh cadence.
- Rollback: keep previous penalty thresholds/logic path behind a temporary config toggle and compare telemetry.

## Priority and effort band

- Priority: `P1` (gameplay correctness and trust)
- Estimated effort: `M-L` (3-5 engineering days including telemetry and tests)
