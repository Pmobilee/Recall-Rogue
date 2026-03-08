# Onboarding Run 08 - First Boot Teen Path

- Timestamp: 2026-03-07 13:12
- URL: `http://127.0.0.1:5173/?devpreset=first_boot`
- Evidence: `/tmp/codex-batch-playthrough-raw.json`, `/tmp/playthrough-onboarding-08.png`

## Deterministic Before/After

| Metric | Before | After | Delta |
| --- | ---: | ---: | ---: |
| currentScreen | cutscene | n/a | n/a |
| currentStreak | 0 | n/a | n/a |
| bestStreak | 0 | n/a | n/a |
| age bracket in save | n/a | n/a | n/a |

## Action Trace

- Teen selector was attempted; progression blocked on `Start Exploring` click timeout.
- Step trail: `not_found` then blocked timeout on progression button.

## Issues and Severity

- High: Onboarding progression blocked for teen path as well.
- Medium: Dev runtime API/CORS and websocket errors repeatedly logged.

## Verdict

- FAIL (blocked; partial report with screenshot and raw log evidence).
