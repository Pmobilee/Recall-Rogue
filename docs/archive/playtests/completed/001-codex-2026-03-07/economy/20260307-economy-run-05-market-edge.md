# Economy Run 05 - Market/Deals Edge Check (mid_game_3_rooms)

- Timestamp: 2026-03-07 14:19 UTC
- URL: `http://127.0.0.1:5173/?skipOnboarding=true&devpreset=mid_game_3_rooms`
- Runtime: Playwright Chromium (headless, mobile viewport 390x844)
- Evidence: `/tmp/economy-run-05-market-edge.json`, `/tmp/playthrough-economy-05-market-edge.png`

## Scenario

- Run type: economy market/deals edge check
- Goal: attempt market/deals interactions and unavailable-feature handling in `mid_game_3_rooms`

## Action Trace

1. Loaded preset; `window.__terraDebug()` screen = `base`.
2. Attempted to route via Market/Deals/Shop controls (test ids + button/text probes).
3. No reachable Market/Deals/Shop control found from current DOM state.
4. Captured deal/buy controls in reachable DOM state: none.
5. Attempted buy interaction: no `Buy` button found.

## Edge-State Validation

- Disabled/sold-out transition: **not reachable in this run** (no market/deals route, no buy control).
- Unavailable-feature indicators: none surfaced in reachable DOM text.

## Routing/Access Blockers

- Blocker 1: No reachable Market/Deals/Shop entry control from `base` screen under this preset/route.
- Blocker 2: No `Buy` button present in reachable DOM state, so deal interaction path is blocked.

## Runtime Notes

- Repeated API/runtime failures during run:
  - CORS block on `http://127.0.0.1:3001/api/facts/packs/all`
  - `net::ERR_FAILED` for facts pack request
  - `404` for a frontend resource
  - aborted request on `/api/facts/delta?since=0&limit=500`

## Verdict

- **FAIL** (partial: market/deals flow blocked before interaction-level edge assertions).
