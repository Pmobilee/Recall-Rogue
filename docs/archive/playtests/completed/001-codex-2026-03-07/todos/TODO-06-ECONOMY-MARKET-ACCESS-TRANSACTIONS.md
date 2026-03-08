# TODO-06 Economy Market Access Transactions

## Problem statement and impact

Economy loops show mixed evidence: one full-loop run validates transaction integrity, while multiple runs cannot reach craft/sell controls or complete full delta proof due to route/access constraints and incomplete capture fields. This prevents reliable validation of workshop, market, and artifact sell flows under deterministic automation.

## Frequency and occurrence in corpus

- `ECON-001` transaction controls unreachable/discoverability gap: 5/15 economy+save reports (`raw/analysis-econ-save.md`)
- `ECON-002` delta-integrity proof incomplete from missing mineral fields: 2/15 reports
- `ECON-SAVE-002` preset route mismatch contributes to blocked economy access: 7/15 reports

## Evidence references (spot-checked)

- `docs/playthroughs/codex-2026-03-07/raw/analysis-econ-save.md`
- `docs/playthroughs/codex-2026-03-07/economy/2026-03-07-1128-rich-player-economy.md`
- `docs/playthroughs/codex-2026-03-07/economy/20260307-1305-economy-run-01-craft-loop-rich-player.md`
- `docs/playthroughs/codex-2026-03-07/economy/20260307-1306-economy-run-02-market-buy-loop-rich-player.md`
- `docs/playthroughs/codex-2026-03-07/economy/20260307-1307-economy-run-03-artifact-sell-loop-has-pending-artifacts.md`
- `docs/playthroughs/codex-2026-03-07/economy/20260307-economy-run-04-multi-transaction.md`
- `docs/playthroughs/codex-2026-03-07/economy/20260307-economy-run-05-market-edge.md`
- `docs/playthroughs/codex-2026-03-07/economy/codex-combined.md`
- `docs/playthroughs/codex-2026-03-07/codex-combined.md`

## Suspected root-cause areas (repo paths)

- `src/ui/components/rooms/WorkshopRoom.svelte` (craft action discoverability/testids)
- `src/ui/components/rooms/MarketRoom.svelte` (buy controls, sold-out transitions)
- `src/ui/components/rooms/MuseumRoom.svelte` / artifact sell surface bindings
- `src/App.svelte` and `src/main.ts` (preset route prerequisites)
- `src/ui/stores/playerData.ts` (resource deltas and purchasedDeals updates)
- `tests/e2e/` economy scripts (capture schema missing mineral snapshots in some flows)

## Phased fix plan

### Phase A - Access path closure

1. Ensure economy surfaces are reachable from base via deterministic controls (no forced screen mutation).
2. Add/normalize stable testids for craft row, buy row, and artifact sell action.
3. Confirm unlock state messaging when controls are intentionally gated.

### Phase B - Transaction integrity instrumentation

1. Capture before/after mineral snapshots for every economy action in one shared helper.
2. Assert non-negative resources and exact deltas against displayed costs/rewards.
3. Validate `purchasedDeals`, crafted inventory, and pending artifact counters remain in sync.

### Phase C - Edge-case coverage

1. Add market-edge scenario: sold-out state, insufficient funds, repeat click protection.
2. Add artifact sell scenario with pendingArtifacts transitions and dust deltas.
3. Add multi-transaction script with sequential craft+buy+sell in one session.

## Acceptance criteria

- Craft, buy, and sell loops are reachable via normal flow in rich-player and pending-artifact presets.
- Every transaction records complete before/after minerals (no `n/a` in core fields).
- Cost/reward deltas match UI labels exactly; no negative or `NaN` resources.
- Sold-out and no-funds states block repeat purchase correctly.

## Verification protocol

- Playwright interactive:
  - Run `rich_player`, `has_pending_artifacts`, and edge presets; perform each economy action.
  - Inspect live store values after each click via `window.__terraDebug()`.
- Automated:
  - Add/refresh economy scripts in `tests/e2e/` for craft/buy/sell/multi-transaction.
- Unit/integration:
  - Unit tests for transaction reducers/helpers in store layer.
  - Integration test ensuring UI cost text matches applied state deltas.

## Risk and rollback notes

- Risk: introducing deterministic DOM hooks may diverge from canvas-first UX if duplicated carelessly.
- Risk: transaction validation strictness may expose pre-existing rounding assumptions.
- Rollback: keep previous UI action handlers and run dual-logging until parity is confirmed.

## Priority and effort band

- Priority: `P2` (important progression/economy confidence, but dependent on route unblocking)
- Estimated effort: `M` (2-4 engineering days)
