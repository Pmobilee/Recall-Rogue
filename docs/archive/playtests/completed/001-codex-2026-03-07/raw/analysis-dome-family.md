# Dome-Family Playthrough Analysis (dome / companion / streak / onboarding)

## Executive summary

- Scope read: all markdown reports under `dome/`, `companion/`, `streak/`, `onboarding/` for `codex-2026-03-07` (33 run reports + 4 combined summaries).
- Dominant product-risk cluster: progression/navigation in DOM-driven playthroughs is frequently blocked or only reachable via forced `currentScreen` transitions.
- Most severe functional blocker: onboarding cannot complete in either adult or teen path because `Start Exploring` remains disabled.
- Cross-cutting environment noise (API 404/500, CORS/HMR websocket failures) appears in most runs and can confound deterministic UI automation signals.
- Confidence is high for repeatability on onboarding/streak/companion access gaps; medium for dome visual clipping/z-order conclusions because several checks are DOM-only while target surfaces are canvas-driven.

## Frequency-ranked issue table

Frequency counts are based on run reports only (n=33), not counting `codex-combined.md` rollups.

| Rank | Issue ID | Title | Severity | Frequency |
|---:|---|---|---|---:|
| 1 | DOME-004 | Recurrent runtime/network errors during dome runs (404/500/ws) | Medium | 18 |
| 2 | DOME-001 | No reliable UI-triggered room/floor transitions in dome exploration | High | 16 |
| 3 | DOME-002 | Off-viewport/hidden dev navigation controls at test viewport | Medium | 15 |
| 4 | DOME-003 | `skipOnboarding` presets often boot into cutscene/onboarding | High | 14 |
| 5 | COMP-001 | Companion/farm/zoo route not discoverable via normal DOM path | High | 5 |
| 6 | ONB-001 | Onboarding progression blocked: `Start Exploring` stays disabled | Critical | 5 |
| 7 | ONB-003 | Onboarding runs include recurring API/HMR websocket failures | Medium | 5 |
| 8 | ONB-002 | Onboarding state mismatch prevents clean transition to base | High | 4 |
| 9 | STRK-001 | Streak milestone/season/social/protection surfaces unreachable | High | 4 |
| 10 | COMP-002 | `first_pet` interaction path incomplete (`not_found` click target) | Medium | 2 |
| 11 | DOME-005 | Playwright launch blocked by Chromium sandbox restriction | Critical | 1 |
| 12 | STRK-002 | Streak run aborted by browser/context closure instability | High | 1 |

## Detailed issues

### DOME-004 - Recurrent runtime/network errors during dome runs (404/500/ws)

- Severity: Medium
- Frequency: 18/19 dome run reports
- Representative evidence:
  - `docs/playthroughs/codex-2026-03-07/dome/20260307-1304-dome-run-01-post_tutorial.md`
  - `docs/playthroughs/codex-2026-03-07/dome/20260307-dome-run-14-full-collection-gallery.md`
  - `docs/playthroughs/codex-2026-03-07/dome/20260307-dome-run-16-five-rooms-nav.md`
- Suspected code areas:
  - API/facts/analytics integration path (`src/services/` client + dev API routing)
  - Dev runtime wiring (Vite HMR websocket host/origin assumptions)
- Repro reliability: High (persistent across presets and timeslots)

### DOME-001 - No reliable UI-triggered room/floor transitions in dome exploration

- Severity: High
- Frequency: 16/19 dome run reports
- Representative evidence:
  - `docs/playthroughs/codex-2026-03-07/dome/20260307-1304-dome-run-01-post_tutorial.md`
  - `docs/playthroughs/codex-2026-03-07/dome/20260307-1306-dome-run-09-full_collection.md`
  - `docs/playthroughs/codex-2026-03-07/dome/20260307-dome-run-15-rich-player-interactables.md`
- Suspected code areas:
  - Room/floor navigation triggers between Svelte overlay and Phaser screen store sync (`src/ui/`, `src/game/`)
  - Discoverability of actionable controls in base/dome shells
- Repro reliability: High (mostly consistent; rare partial transition in runs 06/07)

### DOME-002 - Off-viewport/hidden dev navigation controls at test viewport

- Severity: Medium
- Frequency: 15/19 dome run reports
- Representative evidence:
  - `docs/playthroughs/codex-2026-03-07/dome/20260307-1304-dome-run-02-post_tutorial.md`
  - `docs/playthroughs/codex-2026-03-07/dome/20260307-dome-run-16-five-rooms-nav.md`
  - `docs/playthroughs/codex-2026-03-07/dome/20260307-dome-run-17-element-inventory-midgame.md`
- Suspected code areas:
  - DEV panel layout/responsiveness and stacking rules in UI overlay components (`src/ui/`)
  - Viewport breakpoints and scroll/reachability constraints for debug controls
- Repro reliability: High (same clipping/position signatures recur)

### DOME-003 - `skipOnboarding` presets often boot into cutscene/onboarding

- Severity: High
- Frequency: 14/19 dome run reports
- Representative evidence:
  - `docs/playthroughs/codex-2026-03-07/dome/20260307-1305-dome-run-05-five_rooms.md`
  - `docs/playthroughs/codex-2026-03-07/dome/20260307-dome-run-13-endgame-sweep-a.md`
  - `docs/playthroughs/codex-2026-03-07/dome/20260307-dome-run-14-full-collection-gallery.md`
- Suspected code areas:
  - Query-param bootstrap/preset application logic for onboarding bypass (`src/services/` + startup stores)
  - Initial screen selection state machine (`currentScreen` initialization)
- Repro reliability: High (appears across multiple presets)

### COMP-001 - Companion/farm/zoo route not discoverable via normal DOM path

- Severity: High
- Frequency: 5/5 companion run reports
- Representative evidence:
  - `docs/playthroughs/codex-2026-03-07/companion/20260307-113608-farm-companion.md`
  - `docs/playthroughs/codex-2026-03-07/companion/20260307-1313-companion-run-09-first-pet-zoo-consistency.md`
  - `docs/playthroughs/codex-2026-03-07/companion/20260307-companion-run-11-first-pet.md`
- Suspected code areas:
  - Room-entry controls for farm/zoo exposure in base UI (`src/ui/` + room unlock presentation)
  - Preset-to-screen routing when `skipOnboarding=true`
- Repro reliability: High (all companion reports relied on forced screens)

### ONB-001 - Onboarding progression blocked: `Start Exploring` stays disabled

- Severity: Critical
- Frequency: 5/5 onboarding run reports
- Representative evidence:
  - `docs/playthroughs/codex-2026-03-07/onboarding/20260307-123837-first-boot.md`
  - `docs/playthroughs/codex-2026-03-07/onboarding/20260307-onboarding-run-09-adult-path.md`
  - `docs/playthroughs/codex-2026-03-07/onboarding/20260307-onboarding-run-10-teen-path.md`
- Suspected code areas:
  - Onboarding step-completion gating (interest selection -> CTA enable) in onboarding UI logic (`src/ui/`)
  - Validation/state derivation that controls disabled/enabled CTA state
- Repro reliability: Very high (reproduced on adult and teen branches)

### ONB-003 - Onboarding runs include recurring API/HMR websocket failures

- Severity: Medium
- Frequency: 5/5 onboarding run reports
- Representative evidence:
  - `docs/playthroughs/codex-2026-03-07/onboarding/20260307-123837-first-boot.md`
  - `docs/playthroughs/codex-2026-03-07/onboarding/20260307-1311-onboarding-run-07-first-boot-adult-path.md`
  - `docs/playthroughs/codex-2026-03-07/onboarding/20260307-onboarding-run-10-teen-path.md`
- Suspected code areas:
  - Facts/analytics API endpoints and CORS configuration (`src/services/` and backend dev server)
  - Vite dev websocket endpoint configuration in test environment
- Repro reliability: High (appears in every onboarding report)

### ONB-002 - Onboarding state mismatch prevents clean transition to base

- Severity: High
- Frequency: 4/5 onboarding run reports
- Representative evidence:
  - `docs/playthroughs/codex-2026-03-07/onboarding/20260307-123837-first-boot.md`
  - `docs/playthroughs/codex-2026-03-07/onboarding/20260307-onboarding-run-09-adult-path.md`
  - `docs/playthroughs/codex-2026-03-07/onboarding/20260307-onboarding-run-10-teen-path.md`
- Suspected code areas:
  - Sync between visible onboarding overlay state and `currentScreen` store
  - Cutscene/onboarding transition reducer/store wiring
- Repro reliability: High (repeats with slight variant in reported `currentScreen` values)

### STRK-001 - Streak milestone/season/social/protection surfaces unreachable

- Severity: High
- Frequency: 4/4 streak run reports
- Representative evidence:
  - `docs/playthroughs/codex-2026-03-07/streak/20260307-113834-edge-and-max.md`
  - `docs/playthroughs/codex-2026-03-07/streak/20260307-1315-streak-run-11-streak-risk-milestone-surface.md`
  - `docs/playthroughs/codex-2026-03-07/streak/20260307-streak-run-13-max-vs-risk.md`
- Suspected code areas:
  - Streak/milestone panel entry points and discoverability in base UI (`src/ui/`)
  - DOM automation hooks/testids for streak-related surfaces vs Phaser-only navigation
- Repro reliability: Very high (all streak reports failed this coverage target)

### COMP-002 - `first_pet` interaction path incomplete (`not_found` click target)

- Severity: Medium
- Frequency: 2/5 companion run reports
- Representative evidence:
  - `docs/playthroughs/codex-2026-03-07/companion/20260307-1313-companion-run-09-first-pet-zoo-consistency.md`
  - `docs/playthroughs/codex-2026-03-07/companion/20260307-companion-run-11-first-pet.md`
- Suspected code areas:
  - Companion interaction affordances/testids on zoo/farm surfaces
  - First-pet preset-specific surface composition
- Repro reliability: Medium (specific to `first_pet`-style runs)

### DOME-005 - Playwright launch blocked by Chromium sandbox restriction

- Severity: Critical
- Frequency: 1/19 dome run reports
- Representative evidence:
  - `docs/playthroughs/codex-2026-03-07/dome/20260307-dome-run-18-post-tutorial-visuals.md`
- Suspected code areas:
  - Test runner environment/container permissions and browser launch flags (not app runtime logic)
- Repro reliability: Low-to-medium (single captured occurrence)

### STRK-002 - Streak run aborted by browser/context closure instability

- Severity: High
- Frequency: 1/4 streak run reports
- Representative evidence:
  - `docs/playthroughs/codex-2026-03-07/streak/20260307-1316-streak-run-12-max-streak-season-social-panels.md`
- Suspected code areas:
  - Test harness/browser lifecycle stability under streak scenario
  - Potential interaction between runtime errors and Playwright session health
- Repro reliability: Low-to-medium (single captured occurrence)

## Coverage gaps and confidence notes

- Canvas vs DOM observability gap: multiple reports explicitly note Phaser/canvas surfaces without DOM hooks, so absence of DOM interactables is not always equivalent to absent product functionality.
- Combined files (`codex-combined.md`) corroborate trends but were not used as primary frequency units to avoid double counting underlying runs.
- Environment instability (API/CORS/HMR/websocket and one sandbox failure) likely amplifies failure rates for flow-dependent assertions, so causal attribution to gameplay logic alone is moderate confidence except ONB-001.
- Highest-confidence product bugs: `ONB-001`, `STRK-001`, `COMP-001`, `DOME-001` due multi-run, multi-preset repetition with consistent failure signatures.
- Lower-confidence items are runner/environment-specific (`DOME-005`, `STRK-002`) and should be validated in a stable browser harness before prioritizing app-level fixes.
