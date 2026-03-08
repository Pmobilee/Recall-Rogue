# TODO-01 Routing Entry Blockers

## Problem statement and impact

Routing and entry control paths are unstable across presets and first-boot states. Reports repeatedly show `currentScreen` landing on `cutscene`/`onboarding` when runs expect `base`, plus missing first-step interactables (`btn-dive`, `btn-enter-mine`, room-entry surfaces). This blocks end-to-end coverage for mine, dome, economy, save, companion, and streak playthroughs and creates false negatives for downstream systems.

## Frequency and occurrence in corpus

- Primary issue cluster frequency:
  - `MINE-001` mine entry blocked: 18 reports (`raw/analysis-mine-study.md`)
  - `DOME-003` skipOnboarding/devpreset misroute: 14/19 dome runs (`raw/analysis-dome-family.md`)
  - `ECON-SAVE-002` preset/reload route to `cutscene`: 7/15 economy+save reports (`raw/analysis-econ-save.md`)
  - `COMP-001` companion route undiscoverable: 5/5 companion runs (`raw/analysis-dome-family.md`)
  - `STRK-001` streak surfaces unreachable: 4/4 streak runs (`raw/analysis-dome-family.md`)

## Evidence references (spot-checked)

- `docs/playthroughs/codex-2026-03-07/raw/analysis-mine-study.md`
- `docs/playthroughs/codex-2026-03-07/raw/analysis-dome-family.md`
- `docs/playthroughs/codex-2026-03-07/raw/analysis-econ-save.md`
- `docs/playthroughs/codex-2026-03-07/mine/20260307-mine-run-18-control-path.md`
- `docs/playthroughs/codex-2026-03-07/mine/20260307-mine-run-20-custom-high-o2.md`
- `docs/playthroughs/codex-2026-03-07/dome/20260307-dome-run-16-five-rooms-nav.md`
- `docs/playthroughs/codex-2026-03-07/economy/2026-03-07-1128-rich-player-economy.md`
- `docs/playthroughs/codex-2026-03-07/save/20260307-1308-save-run-04-post-tutorial-reload-persist.md`
- `docs/playthroughs/codex-2026-03-07/companion/20260307-1313-companion-run-09-first-pet-zoo-consistency.md`
- `docs/playthroughs/codex-2026-03-07/streak/20260307-1315-streak-run-11-streak-risk-milestone-surface.md`

## Suspected root-cause areas (repo paths)

- `src/main.ts` (boot-time screen selection precedence)
- `src/App.svelte` (async dev preset import/apply ordering)
- `src/ui/stores/playerData.ts` (hydration timing and fallback save writes)
- `src/ui/components/rooms/CommandRoom.svelte` (`btn-dive` exposure)
- `src/ui/components/DivePrepScreen.svelte` (`btn-enter-mine` exposure)
- `src/ui/components/rooms/MarketRoom.svelte` / `src/ui/components/rooms/WorkshopRoom.svelte` (room-entry affordances)
- `tests/e2e/01-app-loads.cjs` and `tests/e2e/03-save-resume.cjs` (route assertions too late/too loose)

## Phased fix plan

### Phase A - Routing determinism hard gate

1. Define deterministic route-precedence contract for boot sources: persisted save, URL params, dev preset, onboarding requirement.
2. Centralize route decision into one helper consumed by `src/main.ts` and `src/App.svelte`.
3. Add explicit guard: when `devpreset` exists in DEV, defer initial screen assignment until preset hydration is complete.
4. Add boot telemetry event (`route_decision`) with chosen source and resulting screen.

### Phase B - Entry affordance contract

1. Define minimum actionable controls required per screen (`base`, `divePrepScreen`, `market`, `workshop`, `zoo`, `farm`, streak surfaces).
2. Ensure each critical path has one deterministic DOM/testid entry control for automation and accessibility.
3. Remove hidden/off-viewport dependency for dev-only controls used during validation.
4. Add runtime assertion logging when required controls are absent on an active screen.

### Phase C - Regression harness and lock-in

1. Add matrix-style Playwright route tests across presets (`post_tutorial`, `many_reviews_due`, `rich_player`, `mid_game_3_rooms`, `first_pet`, `max_streak`).
2. Validate both first boot and reload transitions (`with preset`, `without preset`).
3. Introduce a fail-fast check in E2E scripts: if expected screen differs after stabilization window, abort run as infra/regression blocker.

## Acceptance criteria

- For every supported `devpreset`, post-load screen stabilizes to expected route within 2 seconds and does not revert to `cutscene`/`onboarding` unexpectedly.
- On `base`, `btn-dive` is present and enabled when mine is unlocked.
- On dive prep, `btn-enter-mine` is present and enabled when O2 selection is valid.
- Economy and companion target surfaces are reachable by deterministic DOM route without `terra:currentScreen` forcing.
- Save reload retains expected route context for post-tutorial and progressed profiles.

## Verification protocol

- Playwright interactive checks:
  - Navigate with `?skipOnboarding=true&devpreset=<preset>` for each preset.
  - Capture `window.__terraDebug()` and `window.__terraLog` after 2-second settle.
  - Verify expected actionable testids exist and are visible.
- Automated checks:
  - `node tests/e2e/01-app-loads.cjs`
  - `node tests/e2e/03-save-resume.cjs`
  - Add/execute new route-matrix spec (planned in this TODO).
- Unit/integration checks:
  - Add unit tests for route-precedence helper and preset hydration sequencing.

## Risk and rollback notes

- Risk: changing boot order can regress true first-boot onboarding.
- Risk: making DOM entry controls explicit may duplicate Phaser-only controls if not coordinated.
- Rollback: keep route logic behind temporary feature flag (`route_boot_v2`) and preserve old path for fast revert.

## Priority and effort band

- Priority: `P0` (platform unblocker for most other TODOs)
- Estimated effort: `L` (4-6 engineering days including test harness updates)
