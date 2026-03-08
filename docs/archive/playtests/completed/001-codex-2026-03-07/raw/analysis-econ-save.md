# Economy + Save Analysis (Codex 2026-03-07)

## Executive summary

- Scope analyzed: all markdown reports under `economy/` and `save/`, plus root `codex-combined.md`.
- Total reports read: **15**.
- Canonical issues deduplicated: **5**.
- Highest-impact pattern: dev preset/screen routing mismatch (`cutscene` vs expected `base`) repeatedly destabilizes economy/save verification paths.
- Most frequent noise pattern: API/CORS/websocket/HTTP runtime errors are pervasive in logs but are often environment-related rather than direct game-logic regressions.

## Frequency-ranked issue table

| Rank | Issue ID | Title | Severity | Frequency (reports) | Repro reliability |
|---|---|---|---|---:|---|
| 1 | ECON-SAVE-001 | Repeated runtime API/CORS/websocket/HTTP errors in test runs | Low | 12/15 | High (observed across most runs) |
| 2 | ECON-SAVE-002 | Preset/reload screen routing lands on `cutscene` unexpectedly | High | 7/15 | High (cross-context, repeatable) |
| 3 | ECON-001 | Economy transaction controls not discoverable/reachable in run DOM state | High | 5/15 | Medium-High (repeats in multiple economy scenarios) |
| 4 | SAVE-001 | Save integrity flow cannot execute required mine interaction segment | High | 3/15 | Medium (confirmed in dedicated integrity run) |
| 5 | ECON-002 | Economy delta-integrity proof incomplete due missing mineral fields | Medium | 2/15 | Medium (capture-dependent) |

## Detailed issues

### ECON-SAVE-001 - Repeated runtime API/CORS/websocket/HTTP errors in test runs

- Severity: **Low**
- Frequency count: **12** reports
- Representative evidence paths:
  - `docs/playthroughs/codex-2026-03-07/economy/2026-03-07-1128-rich-player-economy.md`
  - `docs/playthroughs/codex-2026-03-07/economy/20260307-1305-economy-run-01-craft-loop-rich-player.md`
  - `docs/playthroughs/codex-2026-03-07/economy/20260307-1306-economy-run-02-market-buy-loop-rich-player.md`
  - `docs/playthroughs/codex-2026-03-07/economy/20260307-1307-economy-run-03-artifact-sell-loop-has-pending-artifacts.md`
  - `docs/playthroughs/codex-2026-03-07/economy/20260307-economy-run-05-market-edge.md`
  - `docs/playthroughs/codex-2026-03-07/save/20260307-122338-save-resume-integrity.md`
  - `docs/playthroughs/codex-2026-03-07/save/20260307-1308-save-run-04-post-tutorial-reload-persist.md`
  - `docs/playthroughs/codex-2026-03-07/save/20260307-1309-save-run-05-mid-game-reload-persist.md`
  - `docs/playthroughs/codex-2026-03-07/save/20260307-1310-save-run-06-rich-player-reload-persist.md`
  - `docs/playthroughs/codex-2026-03-07/codex-combined.md`
- Suspected code areas:
  - `src/services/` API client and fetch/retry/error handling
  - Dev/runtime integration points for offline mode and backend availability handling
- Repro reliability: **High** (errors recur across independent economy/save runs)
- Dedup note: Root combined report flags many of these as environment/infrastructure noise; retain as operational issue because it degrades signal quality in playthrough validation.

### ECON-SAVE-002 - Preset/reload screen routing lands on `cutscene` unexpectedly

- Severity: **High**
- Frequency count: **7** reports
- Representative evidence paths:
  - `docs/playthroughs/codex-2026-03-07/economy/2026-03-07-1128-rich-player-economy.md`
  - `docs/playthroughs/codex-2026-03-07/economy/codex-combined.md`
  - `docs/playthroughs/codex-2026-03-07/save/20260307-1308-save-run-04-post-tutorial-reload-persist.md`
  - `docs/playthroughs/codex-2026-03-07/save/20260307-1309-save-run-05-mid-game-reload-persist.md`
  - `docs/playthroughs/codex-2026-03-07/save/20260307-1310-save-run-06-rich-player-reload-persist.md`
  - `docs/playthroughs/codex-2026-03-07/save/codex-combined.md`
  - `docs/playthroughs/codex-2026-03-07/codex-combined.md`
- Suspected code areas:
  - `src/main.ts` boot-time screen routing logic
  - `src/App.svelte` async dev preset loading/order of operations
- Repro reliability: **High** (reported across presets: `post_tutorial`, `mid_game_3_rooms`, `rich_player`)
- Dedup note: Root combined report identifies this as a race condition and marks it fixed in current working tree; still canonical for this report corpus.

### ECON-001 - Economy transaction controls not discoverable/reachable in run DOM state

- Severity: **High**
- Frequency count: **5** reports
- Representative evidence paths:
  - `docs/playthroughs/codex-2026-03-07/economy/20260307-1305-economy-run-01-craft-loop-rich-player.md`
  - `docs/playthroughs/codex-2026-03-07/economy/20260307-1307-economy-run-03-artifact-sell-loop-has-pending-artifacts.md`
  - `docs/playthroughs/codex-2026-03-07/economy/20260307-economy-run-05-market-edge.md`
  - `docs/playthroughs/codex-2026-03-07/economy/codex-combined.md`
  - `docs/playthroughs/codex-2026-03-07/codex-combined.md`
- Suspected code areas:
  - Economy UI interaction surface (workshop/market/artifact screens)
  - Testability boundary between Phaser canvas controls and DOM-targeted Playwright selectors
  - Screen-routing preconditions that gate access to economy actions
- Repro reliability: **Medium-High** (multiple independent failures, but likely mixed with tooling limitations)
- Dedup note: Root combined report labels part of this class as "not a code bug" when controls are canvas-rendered; keep as canonical validation blocker for economy playthrough automation.

### SAVE-001 - Save integrity flow cannot execute required mine interaction segment

- Severity: **High**
- Frequency count: **3** reports
- Representative evidence paths:
  - `docs/playthroughs/codex-2026-03-07/save/20260307-122338-save-resume-integrity.md`
  - `docs/playthroughs/codex-2026-03-07/save/codex-combined.md`
  - `docs/playthroughs/codex-2026-03-07/codex-combined.md`
- Suspected code areas:
  - Mine entry/surface interaction exposure (`btn-enter-mine`, `btn-dive`, `btn-surface`, quiz buttons)
  - Preset boot/routing state before save-resume verification steps
  - Automation harness assumptions for DOM-visible controls
- Repro reliability: **Medium** (hard-fail in primary integrity run; partially attributable to routing/tooling constraints)
- Dedup note: Persistence assertions themselves passed; failure is specific to interaction-segment coverage.

### ECON-002 - Economy delta-integrity proof incomplete due missing mineral fields

- Severity: **Medium**
- Frequency count: **2** reports
- Representative evidence paths:
  - `docs/playthroughs/codex-2026-03-07/economy/20260307-1306-economy-run-02-market-buy-loop-rich-player.md`
  - `docs/playthroughs/codex-2026-03-07/economy/codex-combined.md`
- Suspected code areas:
  - Save/state snapshot capture pipeline for economy test runs
  - Metric extraction from `playerSave` in playthrough scripts/reports
- Repro reliability: **Medium** (present in one dedicated run + combined synthesis)
- Dedup note: Transaction clicks succeeded, but audit completeness is reduced when before/after minerals are `n/a`.

## Coverage gaps and confidence notes

- DOM-vs-canvas limitation materially affects interpretation: several blocked interactions likely reflect Playwright DOM reachability limits rather than gameplay breakage.
- Save category demonstrates strong persistence correctness despite interaction-path failures: runs 04/05/06/07/08 report PASS on persistence/isolation checks.
- Economy category contains mixed evidence: one full-loop run with correct deltas (`2026-03-07-1128-rich-player-economy.md`) versus multiple blocked-loop runs.
- Root `codex-combined.md` indicates major routing issue was already fixed in working tree; this analysis preserves historical report findings rather than current code status.
- Confidence level: **Moderate-High** for issue clustering and ranking; **Moderate** for attributing control-discovery failures to product code vs automation constraints.
