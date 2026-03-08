# Companion Run 10 - Five Rooms Farm Collect

- Timestamp: 2026-03-07 13:14
- URL: `http://127.0.0.1:5173/?skipOnboarding=true&devpreset=five_rooms`
- Evidence: `/tmp/codex-batch-playthrough-raw.json`, `/tmp/playthrough-companion-10.png`

## Deterministic Before/After

| Metric | Before | After | Delta |
| --- | ---: | ---: | ---: |
| currentScreen | cutscene | farm | n/a |
| currentStreak | 12 | 12 | 0 |
| bestStreak | 15 | 15 | 0 |
| farm collect action | 0 | 1 | +1 |

## Action Trace

- Forced farm screen (`forced_farm`) and executed `clicked:Collect All`.
- Farm surface confirmed (`uiHits.farm=true`).

## Issues and Severity

- Medium: Resource deltas from collect action were not available in this capture schema.
- Low: Required screen forcing from cutscene to farm.

## Verdict

- PASS (farm interaction executed; state consistency surface present).
