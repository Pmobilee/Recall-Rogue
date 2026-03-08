# Save Run 06 - Rich Player Reload Persist

- Timestamp: 2026-03-07 13:10
- URL: `http://127.0.0.1:5173/?skipOnboarding=true&devpreset=rich_player`
- Evidence: `/tmp/codex-batch-playthrough-raw.json`, `/tmp/playthrough-save-06.png`

## Deterministic Before/After

| Metric | Before | After | Delta |
| --- | ---: | ---: | ---: |
| currentScreen | cutscene | base | n/a |
| currentStreak | 20 | 20 | 0 |
| bestStreak | 30 | 30 | 0 |
| purchasedDeals | 0 | 0 | 0 |

## Action Trace

- Performed `state_touched_base` then `reloaded_once`.
- Captured save fields remained stable through reload.

## Issues and Severity

- Low: Preset starts in `cutscene` unexpectedly for save verification path.
- Medium: Dev runtime API/CORS and websocket errors repeatedly logged.

## Verdict

- PASS (persistence check passed for captured fields).
