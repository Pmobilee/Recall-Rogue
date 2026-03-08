# TODO-04 Dome Nav Interactable Coverage

## Problem statement and impact

Dome-family flows are not reliably reachable through normal interactables in the test viewport. Most reports depend on forced `currentScreen` jumps, with room/floor transitions and companion/streak surfaces missing or non-discoverable in reachable DOM controls. This blocks functional validation of dome progression and social/companion loops.

## Frequency and occurrence in corpus

- `DOME-001` no reliable UI-triggered dome transitions: 16/19 dome runs (`raw/analysis-dome-family.md`)
- `DOME-002` controls off-viewport/hidden: 15/19 dome runs (`raw/analysis-dome-family.md`)
- `COMP-001` companion route undiscoverable: 5/5 runs
- `STRK-001` streak surfaces unreachable: 4/4 runs

## Evidence references (spot-checked)

- `docs/playthroughs/codex-2026-03-07/raw/analysis-dome-family.md`
- `docs/playthroughs/codex-2026-03-07/dome/20260307-1304-dome-run-01-post_tutorial.md`
- `docs/playthroughs/codex-2026-03-07/dome/20260307-1305-dome-run-06-five_rooms.md`
- `docs/playthroughs/codex-2026-03-07/dome/20260307-1306-dome-run-10-max_streak.md`
- `docs/playthroughs/codex-2026-03-07/dome/20260307-dome-run-15-rich-player-interactables.md`
- `docs/playthroughs/codex-2026-03-07/dome/20260307-dome-run-17-element-inventory-midgame.md`
- `docs/playthroughs/codex-2026-03-07/companion/20260307-113608-farm-companion.md`
- `docs/playthroughs/codex-2026-03-07/companion/20260307-1313-companion-run-09-first-pet-zoo-consistency.md`
- `docs/playthroughs/codex-2026-03-07/streak/20260307-113834-edge-and-max.md`
- `docs/playthroughs/codex-2026-03-07/streak/20260307-1316-streak-run-12-max-streak-season-social-panels.md`

## Suspected root-cause areas (repo paths)

- `src/game/scenes/DomeScene.ts` (room transitions, input layers, interactable hit areas)
- `src/ui/components/rooms/ArchiveRoom.svelte`
- `src/ui/components/rooms/GalleryRoom.svelte`
- `src/ui/components/rooms/MuseumRoom.svelte`
- `src/ui/components/rooms/LabRoom.svelte`
- `src/ui/components/rooms/MarketRoom.svelte`
- `src/ui/components/rooms/WorkshopRoom.svelte`
- `src/App.svelte` (screen/routing shell and overlays that may occlude)

## Phased fix plan

### Phase A - Reachability audit

1. Build a room-by-room map of intended interactables and required unlock state.
2. Check viewport clipping and z-index overlap for debug and production controls at mobile and desktop sizes.
3. Add diagnostics that report which interactables are active, visible, and clickable for current room.

### Phase B - Interactable contract implementation

1. Guarantee at least one deterministic entry route for each room/family surface (dome, companion, streak).
2. Add/normalize `data-testid` hooks for critical room navigation and panel openings.
3. Resolve overlay occlusion and pointer-event conflicts between Svelte DOM layers and canvas.

### Phase C - Coverage closure

1. Add Playwright coverage script that traverses all unlocked rooms using only intended controls.
2. Add companion and streak panel smoke checks in same traversal run.
3. Track per-run interactable coverage percentage and fail if below threshold.

## Acceptance criteria

- No forced `currentScreen` mutation required to traverse unlocked dome rooms.
- Companion and streak target surfaces reachable through discoverable controls from normal flow.
- Critical controls remain visible and clickable at 412x915 and desktop viewport.
- Coverage run records successful transitions for all expected rooms in the selected preset.

## Verification protocol

- Playwright interactive:
  - Navigate via `?skipOnboarding=true&devpreset=five_rooms`, `endgame_all_rooms`, `rich_player`, `max_streak`.
  - Capture snapshots and run clickability checks (`visibility`, `pointer-events`, `z-index`, occlusion).
- Automated:
  - New dome traversal script in `tests/e2e/` for room coverage and panel access.
- Unit/integration:
  - Add tests for room unlock -> control visibility mapping.

## Risk and rollback notes

- Risk: adding DOM hooks for canvas flows can drift from production interaction model.
- Risk: z-index fixes may unintentionally expose debug controls in production.
- Rollback: gate new navigation hooks behind DEV flag first, then promote once validated.

## Priority and effort band

- Priority: `P1` (large coverage and UX blocker)
- Estimated effort: `L` (4-6 engineering days)
