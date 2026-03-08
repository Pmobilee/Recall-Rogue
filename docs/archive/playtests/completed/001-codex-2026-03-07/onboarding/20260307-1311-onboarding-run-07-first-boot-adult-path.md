# Onboarding Run 07 - First Boot Adult Path

- Timestamp: 2026-03-07 13:11
- URL: `http://127.0.0.1:5173/?devpreset=first_boot`
- Evidence: `/tmp/codex-batch-playthrough-raw.json`, `/tmp/playthrough-onboarding-07.png`

## Deterministic Before/After

| Metric | Before | After | Delta |
| --- | ---: | ---: | ---: |
| currentScreen | base | n/a | n/a |
| currentStreak | 0 | n/a | n/a |
| bestStreak | 0 | n/a | n/a |
| age bracket in save | n/a | n/a | n/a |

## Action Trace

- Adult selector was attempted; next step blocked on `Start Exploring` click timeout.
- Step trail: `not_found` then blocked timeout on progression button.

## Issues and Severity

- High: Onboarding progression blocked (`Start Exploring` not actionable).
- Medium: Dev runtime API/CORS and websocket errors repeatedly logged.

## Verdict

- FAIL (blocked; partial report with screenshot and raw log evidence).
