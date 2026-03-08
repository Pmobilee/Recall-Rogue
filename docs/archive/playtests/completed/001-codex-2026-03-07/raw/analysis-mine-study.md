# Mine + Study Canonical Analysis (2026-03-07)

## Executive summary

- Scope analyzed: all markdown reports under `mine/` and `study/` (55 individual run reports + 2 combined summary reports read for cross-checking).
- Counting method for frequency: **individual run reports only** (combined files excluded from frequency math to avoid double-counting).
- Mine findings are dominated by control-path access failures, automation/runtime instability, and repeated console/network noise that reduces test signal quality.
- Study findings are mostly correctness-adjacent UI/queue consistency issues; core scheduling behavior is generally reported as functional.
- Canonical issues produced: **9** (6 mine, 3 study) with stable IDs.

## Frequency-ranked issue table

| ID | Title | Severity | Frequency (# reports) |
|---|---|---|---:|
| MINE-006 | Recurrent runtime/network error noise during mine runs | MEDIUM | 19 |
| MINE-001 | Mine entry control path blocked or inaccessible | HIGH | 18 |
| MINE-004 | Automation-run instability/timeouts (tooling-layer failures) | MEDIUM | 16 |
| MINE-003 | Mining progress often remains zero despite active inputs | HIGH | 15 |
| STUDY-001 | Study UI counters/summaries drift from processed-state reality | MEDIUM | 8 |
| STUDY-002 | Study queue ordering/requeue anomalies under edge cadence | LOW | 5 |
| MINE-005 | O2 HUD/store divergence and consistency-penalty observability defects | HIGH | 4 |
| MINE-002 | Injected custom save state not retained after boot | HIGH | 3 |
| STUDY-003 | Recurrent runtime/network error noise during study runs | LOW | 3 |

## Detailed canonical issues

### MINE-006 - Recurrent runtime/network error noise during mine runs
- Severity: **MEDIUM**
- Frequency: **19** reports
- Evidence report paths (representative):
  - `docs/playthroughs/codex-2026-03-07/mine/20260307-1309-mine-run-01-post_tutorial.md`
  - `docs/playthroughs/codex-2026-03-07/mine/20260307-mine-run-14-many_reviews_due-long.md`
  - `docs/playthroughs/codex-2026-03-07/mine/20260307-mine-run-16-custom-mature-b.md`
  - `docs/playthroughs/codex-2026-03-07/mine/20260307-114154-many-reviews-due.md`
- Suspected source files/areas (best-effort):
  - `src/main.ts` (dev boot path, URL/preset interaction)
  - `src/services/apiClient.ts` and local API availability/CORS contract
  - Vite dev-server/HMR websocket environment (external infra, not strictly app code)
- Repro reliability: **high** (same error classes recur across many presets and runs)

### MINE-001 - Mine entry control path blocked or inaccessible
- Severity: **HIGH**
- Frequency: **18** reports
- Evidence report paths (representative):
  - `docs/playthroughs/codex-2026-03-07/mine/20260307-mine-run-18-control-path.md`
  - `docs/playthroughs/codex-2026-03-07/mine/20260307-114154-many-reviews-due.md`
  - `docs/playthroughs/codex-2026-03-07/mine/20260307-1330-mine-run-02-many_reviews_due.md`
  - `docs/playthroughs/codex-2026-03-07/mine/20260307-mine-run-20-custom-high-o2.md`
- Suspected source files/areas (best-effort):
  - `src/ui/components/rooms/CommandRoom.svelte` (`btn-dive` visibility/action)
  - `src/ui/components/DivePrepScreen.svelte` (`btn-enter-mine` path)
  - `src/App.svelte` and `src/game/managers/StudyManager.ts` (screen routing between `cutscene`/`studySession`/`base`/`divePrepScreen`)
- Repro reliability: **high** (observed repeatedly under multiple presets and long/short runs)

### MINE-004 - Automation-run instability/timeouts (tooling-layer failures)
- Severity: **MEDIUM**
- Frequency: **16** reports
- Evidence report paths (representative):
  - `docs/playthroughs/codex-2026-03-07/mine/20260307-1325-mine-run-03-quiz_due.md`
  - `docs/playthroughs/codex-2026-03-07/mine/20260307-1325-mine-run-08-custom_mature_overdue_gamma.md`
  - `docs/playthroughs/codex-2026-03-07/mine/20260307-1309-mine-run-01-post_tutorial.md`
  - `docs/playthroughs/codex-2026-03-07/mine/20260307-1333-mine-run-04-mid_dive_active.md`
- Suspected source files/areas (best-effort):
  - Playwright harness/runtime lifecycle management (browser/context closure handling)
  - Runner sequencing around navigation/evaluate calls for long-form scripts
  - Secondary interaction with screen-routing states in `src/App.svelte`
- Repro reliability: **high** for specific batches (especially `1325` run cluster), **medium** globally

### MINE-003 - Mining progress often remains zero despite active inputs
- Severity: **HIGH**
- Frequency: **15** reports
- Evidence report paths (representative):
  - `docs/playthroughs/codex-2026-03-07/mine/20260307-1339-mine-run-09-post_tutorial_long.md`
  - `docs/playthroughs/codex-2026-03-07/mine/20260307-1342-mine-run-11-many_reviews_due_short.md`
  - `docs/playthroughs/codex-2026-03-07/mine/20260307-1312-mine-run-02-many_reviews_due.md`
  - `docs/playthroughs/codex-2026-03-07/mine/2026-03-07-1230-3tanks-20cards-consistency.md`
- Suspected source files/areas (best-effort):
  - `src/game/scenes/MineScene.ts` (input-to-mining state progression)
  - `src/game/GameManager.ts` (dive lifecycle and stats updates)
  - `src/ui/stores/playerData.ts` (persistence of `totalBlocksMined` deltas)
- Repro reliability: **medium-high** (frequent, but sometimes co-occurs with route/tooling failures)

### STUDY-001 - Study UI counters/summaries drift from processed-state reality
- Severity: **MEDIUM**
- Frequency: **8** reports
- Evidence report paths (representative):
  - `docs/playthroughs/codex-2026-03-07/study/20260307-1301-study-run-01-many_reviews_due-heavy-again.md`
  - `docs/playthroughs/codex-2026-03-07/study/20260307-1305-study-run-02-many_reviews_due-mixed-cadence.md`
  - `docs/playthroughs/codex-2026-03-07/study/20260307-1325-study-run-07-post_tutorial-new-player-first-pass.md`
  - `docs/playthroughs/codex-2026-03-07/study/20260307-1345-study-run-12-injected-recovery-session.md`
- Suspected source files/areas (best-effort):
  - `src/ui/components/StudySession.svelte` (session counters, completion summary, remaining text)
  - `src/ui/components/StudyStation.svelte` (due-count badge rendering)
  - `src/game/managers/StudyManager.ts` (queue sizing vs what UI labels as "studied")
- Repro reliability: **high** for specific UI labels across varied study scenarios

### STUDY-002 - Study queue ordering/requeue anomalies under edge cadence
- Severity: **LOW**
- Frequency: **5** reports
- Evidence report paths (representative):
  - `docs/playthroughs/codex-2026-03-07/study/20260307-1317-study-run-05-quiz_due-relearning-focus.md`
  - `docs/playthroughs/codex-2026-03-07/study/20260307-1329-study-run-08-post_tutorial-new-plus-learning.md`
  - `docs/playthroughs/codex-2026-03-07/study/20260307-1341-study-run-11-injected-mixed-state-chaos.md`
  - `docs/playthroughs/codex-2026-03-07/study/20260307-1301-study-run-01-many_reviews_due-heavy-again.md`
- Suspected source files/areas (best-effort):
  - `src/game/managers/StudyManager.ts` (tie-break ordering among equal timestamps/states)
  - `src/ui/components/StudySession.svelte` (Again requeue placement and repeat behavior)
  - `src/ui/stores/playerData.ts` (due-card selection helpers and ordering)
- Repro reliability: **medium** (edge-cadence and tie conditions appear necessary)

### MINE-005 - O2 HUD/store divergence and consistency-penalty observability defects
- Severity: **HIGH**
- Frequency: **4** reports
- Evidence report paths (representative):
  - `docs/playthroughs/codex-2026-03-07/mine/2026-03-07-1015-full-dive-20-cards.md`
  - `docs/playthroughs/codex-2026-03-07/mine/2026-03-07-1230-3tanks-20cards-consistency.md`
  - `docs/playthroughs/codex-2026-03-07/mine/20260307-mine-run-15-custom-mature-a.md`
  - `docs/playthroughs/codex-2026-03-07/mine/20260307-mine-run-16-custom-mature-b.md`
- Suspected source files/areas (best-effort):
  - `src/game/scenes/MineScene.ts` (oxygen state init/use across layers)
  - `src/game/managers/QuizManager.ts` (mature wrong-answer consistency penalty path)
  - `src/game/systems/OxygenSystem.ts` and O2 display wiring in HUD components
- Repro reliability: **medium** (strong in dedicated consistency runs; partially blocked in telemetry-limited runs)

### MINE-002 - Injected custom save state not retained after boot
- Severity: **HIGH**
- Frequency: **3** reports
- Evidence report paths (representative):
  - `docs/playthroughs/codex-2026-03-07/mine/20260307-mine-run-15-custom-mature-a.md`
  - `docs/playthroughs/codex-2026-03-07/mine/20260307-mine-run-16-custom-mature-b.md`
  - `docs/playthroughs/codex-2026-03-07/mine/20260307-mine-run-20-custom-high-o2.md`
- Suspected source files/areas (best-effort):
  - `src/services/saveService.ts` (active profile keying/load semantics)
  - `src/ui/stores/playerData.ts` (hydration and default/fallback write timing)
  - `src/App.svelte` and `src/main.ts` (devpreset/skipOnboarding boot flow replacing injected state)
- Repro reliability: **high** in custom injection scenarios

### STUDY-003 - Recurrent runtime/network error noise during study runs
- Severity: **LOW**
- Frequency: **3** reports
- Evidence report paths (representative):
  - `docs/playthroughs/codex-2026-03-07/study/2026-03-07-1131-study-session-15-mixed.md`
  - `docs/playthroughs/codex-2026-03-07/study/20260307-study-run-15-injected-mixed-states.md`
  - `docs/playthroughs/codex-2026-03-07/study/20260307-study-run-16-relearning-focus.md`
- Suspected source files/areas (best-effort):
  - `src/services/apiClient.ts` / local API endpoints (CORS + availability)
  - `src/main.ts` and dev server bootstrap timing
  - Vite HMR websocket endpoint/environment
- Repro reliability: **high** in headless local runs; low evidence of direct gameplay corruption

## Coverage gaps and confidence notes

- Low-frequency but important finding not promoted to canonical list: `study` run 18 reports **injection not persisting for high-lapse cards** (single-report evidence, high impact if confirmed).
- Several mine reports are explicitly marked partial/blocked; this increases confidence in infra/control-path findings but lowers confidence in deeper gameplay-balance conclusions.
- The `20260307-1325-mine-run-*` cluster is heavily affected by runner lifecycle exceptions; gameplay metrics from that batch should be treated as low-confidence.
- Network/HMR errors recur broadly in both categories; likely environment-level noise, but they can mask app-level regressions and should be isolated in future runs.
- Overall confidence: **medium-high** for high-frequency issues (MINE-001/003/004/006, STUDY-001), **medium** for nuanced state-sync issues (MINE-005, STUDY-002), **low** for single-report findings.
