# Companion Run 09 - First Pet Zoo Consistency

- Timestamp: 2026-03-07 13:13
- URL: `http://127.0.0.1:5173/?skipOnboarding=true&devpreset=first_pet`
- Evidence: `/tmp/codex-batch-playthrough-raw.json`, `/tmp/playthrough-companion-09.png`

## Deterministic Before/After

| Metric | Before | After | Delta |
| --- | ---: | ---: | ---: |
| currentScreen | cutscene | zoo | n/a |
| currentStreak | 3 | 3 | 0 |
| bestStreak | 3 | 3 | 0 |
| activeCompanion | n/a | n/a | n/a |

## Action Trace

- Forced screen to zoo (`forced_zoo`) for deterministic access.
- Companion interaction click target not found (`not_found`), but zoo surface rendered (`uiHits.zoo=true`).

## Issues and Severity

- Medium: Direct companion interaction controls not discoverable in this run.
- Low: Required screen forcing from cutscene to zoo.

## Verdict

- FAIL (partial; state consistency surface observed, interaction path incomplete).
