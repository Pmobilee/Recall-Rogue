# Economy Run 01 - Craft Loop (rich_player)

- Timestamp: 2026-03-07 13:05
- URL: `http://127.0.0.1:5173/?skipOnboarding=true&devpreset=rich_player`
- Evidence: `/tmp/codex-batch-playthrough-raw.json`, `/tmp/playthrough-economy-01.png`

## Deterministic Before/After

| Metric | Before | After | Delta |
| --- | ---: | ---: | ---: |
| currentScreen | cutscene | workshop | n/a |
| dust | n/a | n/a | n/a |
| shard | n/a | n/a | n/a |
| crystal | n/a | n/a | n/a |
| purchasedDeals | 0 | 0 | 0 |
| currentStreak | 20 | 20 | 0 |

## Action Trace

- Attempted craft loop (2 craft actions): `not_found`, `not_found`.
- No craft button/row was clickable in this deterministic run.

## Issues and Severity

- Medium: Craft controls not reachable after forcing `workshop` screen.
- Medium: Dev runtime API/CORS and websocket errors repeatedly logged.

## Verdict

- FAIL (partial report; craft loop blocked, evidence captured).
