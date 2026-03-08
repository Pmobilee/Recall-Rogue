# Save Run 04 - Post Tutorial Reload Persist

- Timestamp: 2026-03-07 13:08
- URL: `http://127.0.0.1:5173/?skipOnboarding=true&devpreset=post_tutorial`
- Evidence: `/tmp/codex-batch-playthrough-raw.json`, `/tmp/playthrough-save-04.png`

## Deterministic Before/After

| Metric | Before | After | Delta |
| --- | ---: | ---: | ---: |
| currentScreen | base | cutscene | n/a |
| currentStreak | 1 | 1 | 0 |
| bestStreak | 1 | 1 | 0 |
| purchasedDeals | 0 | 0 | 0 |

## Action Trace

- Performed `state_touched_base` then `reloaded_once`.
- Core streak fields remained stable after reload.

## Issues and Severity

- Medium: Reload landed on `cutscene` instead of staying on expected base flow.
- Medium: Dev runtime API/CORS and websocket errors repeatedly logged.

## Verdict

- PASS (persistence check passed for captured fields).
