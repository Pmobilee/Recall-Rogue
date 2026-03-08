# TODO-03 Study Queue Accounting SM2

## Problem statement and impact

Study core SM-2 behavior is broadly functional, but UI counters and queue accounting drift from processed-state reality in mixed cadence sessions. Reported mismatches include due badges lagging queue updates, completion summaries understating processed interactions, and tie-order anomalies under equal timestamp/requeue pressure. This can confuse players and weakens confidence in spaced-repetition integrity.

## Frequency and occurrence in corpus

- `STUDY-001` UI counters/summaries drift: 8 reports (`raw/analysis-mine-study.md`)
- `STUDY-002` queue ordering/requeue anomalies: 5 reports (`raw/analysis-mine-study.md`)
- Most other study runs pass core behavior, so this is primarily accounting/representation correctness.

## Evidence references (spot-checked)

- `docs/playthroughs/codex-2026-03-07/raw/analysis-mine-study.md`
- `docs/playthroughs/codex-2026-03-07/study/20260307-1301-study-run-01-many_reviews_due-heavy-again.md`
- `docs/playthroughs/codex-2026-03-07/study/20260307-1305-study-run-02-many_reviews_due-mixed-cadence.md`
- `docs/playthroughs/codex-2026-03-07/study/20260307-1313-study-run-04-quiz_due-balanced.md`
- `docs/playthroughs/codex-2026-03-07/study/20260307-1321-study-run-06-quiz_due-backlog-suppresses-new.md`
- `docs/playthroughs/codex-2026-03-07/study/20260307-1333-study-run-09-post_tutorial-easy-streak.md`
- `docs/playthroughs/codex-2026-03-07/study/20260307-1337-study-run-10-injected-leech-pressure.md`
- `docs/playthroughs/codex-2026-03-07/study/20260307-1341-study-run-11-injected-mixed-state-chaos.md`
- `docs/playthroughs/codex-2026-03-07/study/20260307-1345-study-run-12-injected-recovery-session.md`

## Suspected root-cause areas (repo paths)

- `src/game/managers/StudyManager.ts` (queue construction, tie-break and requeue semantics)
- `src/services/sm2.ts` (rating transitions and interval/ease updates)
- `src/ui/components/StudySession.svelte` (header counts, remaining text, completion summary)
- `src/ui/components/StudyStation.svelte` (due-count badge derivation)
- `src/ui/stores/playerData.ts` (due-card selectors and aggregate counters)

## Phased fix plan

### Phase A - Accounting model alignment

1. Define canonical terms: `queueLength`, `cardsSeen`, `responsesSubmitted`, `cardsStudied`, `dueRemaining`.
2. Map each UI label to exact backing metric and document formula inline in code comments/JSDoc.
3. Add debug snapshot method that returns all study counters in one object per step.

### Phase B - Queue ordering determinism

1. Enforce stable comparator for equal `nextReviewAt` using deterministic tie keys (`cardState priority`, `factId`).
2. Verify requeue placement for `Again` cards is spec-compliant and never immediate duplicate unless intended.
3. Ensure suspended cards are excluded consistently from queue and denominator metrics.

### Phase C - UI synchronization hardening

1. Refactor StudySession labels to derive from canonical store values only, avoiding stale local copies.
2. Add render-tick guard so badges and completion panel update atomically after state mutation.
3. Add targeted tests for known drift cases from corpus.

## Acceptance criteria

- Header due count equals active queue count at every answer step (no one-step lag).
- Completion summary `cards studied` equals canonical `responsesSubmitted` or documented equivalent metric.
- Requeue behavior for repeated `Again` is deterministic across reloads with identical injected state.
- Suspended cards never appear in remaining-count text or active session queue.

## Verification protocol

- Playwright:
  - Run mixed-state and relearning-heavy presets; capture counter tuple before and after each answer.
  - Validate deterministic question ordering across two runs with identical injected payload.
- Automated checks:
  - Existing study run scripts in `study/` plus a new deterministic ordering script.
- Unit/integration:
  - `npx vitest run` with added tests for queue comparator, requeue placement, and summary metrics.

## Risk and rollback notes

- Risk: deterministic tie-break change can alter perceived review cadence.
- Risk: changing summary semantics may break analytics dashboards expecting old metric names.
- Rollback: version counter schema (`studyCountersV2`) and dual-publish old/new metrics for one release window.

## Priority and effort band

- Priority: `P1` (learning-system trust and UI correctness)
- Estimated effort: `M` (2-4 engineering days)
