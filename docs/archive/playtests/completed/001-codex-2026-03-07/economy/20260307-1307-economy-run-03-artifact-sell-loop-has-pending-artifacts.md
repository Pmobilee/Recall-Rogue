# Economy Run 03 - Artifact Sell Loop (has_pending_artifacts)

- Timestamp: 2026-03-07 13:07
- URL: `http://127.0.0.1:5173/?skipOnboarding=true&devpreset=has_pending_artifacts`
- Evidence: `/tmp/codex-batch-playthrough-raw.json`, `/tmp/playthrough-economy-03.png`

## Deterministic Before/After

| Metric | Before | After | Delta |
| --- | ---: | ---: | ---: |
| currentScreen | base | artifact | n/a |
| purchasedDeals | 0 | 0 | 0 |
| dust | n/a | n/a | n/a |
| pending sell action count | 0 clicks | 0 clicks | 0 |
| currentStreak | 5 | 5 | 0 |

## Action Trace

- Attempted sell action: `not_found`.
- Sell button/hint (`Sell for ...`) not found in reachable DOM state.

## Issues and Severity

- Medium: Sell flow blocked by missing/undiscoverable sell control.
- Medium: Dev runtime API/CORS and websocket errors repeatedly logged.

## Verdict

- FAIL (partial report; sell loop blocked, evidence captured).
