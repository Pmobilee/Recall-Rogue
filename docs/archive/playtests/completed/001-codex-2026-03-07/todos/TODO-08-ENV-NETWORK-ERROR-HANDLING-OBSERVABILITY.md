# TODO-08 Env Network Error Handling Observability

## Problem statement and impact

Cross-category playthroughs show pervasive runtime noise (`404/500/400`, CORS failures, websocket connection refusal/closure) that often does not block gameplay directly but degrades signal quality, obscures true regressions, and causes intermittent harness instability. The current diagnostics do not clearly separate expected offline/dev noise from genuine product faults.

## Frequency and occurrence in corpus

- `MINE-006` runtime/network noise: 19 mine reports (`raw/analysis-mine-study.md`)
- `DOME-004` runtime/network noise: 18/19 dome reports (`raw/analysis-dome-family.md`)
- `ECON-SAVE-001` runtime API/CORS/ws/HTTP errors: 12/15 economy+save reports (`raw/analysis-econ-save.md`)
- `STUDY-003` runtime/network noise: 3 study reports
- `ONB-003` onboarding API/HMR websocket failures: 5/5 onboarding reports

## Evidence references (spot-checked)

- `docs/playthroughs/codex-2026-03-07/raw/analysis-mine-study.md`
- `docs/playthroughs/codex-2026-03-07/raw/analysis-dome-family.md`
- `docs/playthroughs/codex-2026-03-07/raw/analysis-econ-save.md`
- `docs/playthroughs/codex-2026-03-07/mine/20260307-114154-many-reviews-due.md`
- `docs/playthroughs/codex-2026-03-07/study/20260307-study-run-15-injected-mixed-states.md`
- `docs/playthroughs/codex-2026-03-07/dome/20260307-1304-dome-run-01-post_tutorial.md`
- `docs/playthroughs/codex-2026-03-07/onboarding/20260307-123837-first-boot.md`
- `docs/playthroughs/codex-2026-03-07/economy/20260307-1305-economy-run-01-craft-loop-rich-player.md`
- `docs/playthroughs/codex-2026-03-07/save/20260307-1308-save-run-04-post-tutorial-reload-persist.md`
- `docs/playthroughs/codex-2026-03-07/codex-combined.md`

## Suspected root-cause areas (repo paths)

- `src/services/apiClient.ts` (retry/fallback/error classification)
- `src/services/deltaSync.ts` and `src/services/offlineQueue.ts` (offline-first behavior)
- `src/services/analyticsService.ts` (non-critical analytics failure handling)
- `src/services/wsClient.ts` (websocket reconnection/backoff and noisy logging)
- `src/main.ts` (boot-time network assumptions and startup sequencing)
- `tests/e2e/01-app-loads.cjs` (diagnostic extraction granularity)

## Phased fix plan

### Phase A - Error taxonomy and suppression policy

1. Define explicit classes: expected-offline, transient-network, server-contract, fatal-runtime.
2. Normalize error payload shape with `source`, `severity`, `recoverable`, `userImpact`.
3. Downgrade known expected-offline failures to non-blocking diagnostics in dev playthrough mode.

### Phase B - Resilience and UX signaling

1. Add robust fallback for facts/analytics endpoints when backend absent.
2. Prevent websocket/HMR failures from polluting gameplay error channels.
3. Add minimal user-facing status indicator for degraded network mode where relevant.

### Phase C - Observability and harness integration

1. Emit structured runtime health summary for each E2E run.
2. Update test scripts to treat expected-offline errors as warnings, not hard fail conditions.
3. Add trend metric: error-noise budget per run and category.

## Acceptance criteria

- Playthrough diagnostics clearly separate expected offline/dev failures from actionable regressions.
- Gameplay-critical flows remain testable when API backend is absent.
- E2E scripts no longer fail solely due to known expected-offline error signatures.
- Runtime health report includes categorized error counts and confidence grade.

## Verification protocol

- Playwright interactive:
  - Run standard dev URL with and without backend; compare error taxonomy output.
  - Confirm no critical flow break from expected endpoint failures.
- Automated:
  - `node tests/e2e/01-app-loads.cjs` as mandatory baseline.
  - Re-run category scripts and compare categorized error histograms.
- Unit/integration:
  - Unit tests for error classifier and fallback behavior in `apiClient`/`wsClient`.

## Risk and rollback notes

- Risk: over-suppressing errors may hide real regressions.
- Risk: fallback logic can mask backend contract drift if not audited.
- Rollback: keep strict mode toggle in CI that elevates all network errors for periodic audit runs.

## Priority and effort band

- Priority: `P1` (cross-cutting diagnostic quality and test reliability)
- Estimated effort: `M` (2-4 engineering days)
