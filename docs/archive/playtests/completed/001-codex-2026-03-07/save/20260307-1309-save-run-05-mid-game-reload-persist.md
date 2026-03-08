# Save Run 05 - Mid Game Reload Persist

- Timestamp: 2026-03-07 13:09
- URL: `http://127.0.0.1:5173/?skipOnboarding=true&devpreset=mid_game_3_rooms`
- Evidence: `/tmp/codex-batch-playthrough-raw.json`, `/tmp/playthrough-save-05.png`

## Deterministic Before/After

| Metric | Before | After | Delta |
| --- | ---: | ---: | ---: |
| currentScreen | cutscene | base | n/a |
| currentStreak | 7 | 7 | 0 |
| bestStreak | 10 | 10 | 0 |
| purchasedDeals | 0 | 0 | 0 |

## Action Trace

- Performed `state_touched_base` then `reloaded_once`.
- Core streak/save counters remained stable after reload.

## Issues and Severity

- Low: Entry screen mismatch (`cutscene` before action) adds nondeterminism to direct UI routing.
- Medium: Dev runtime API/CORS and websocket errors repeatedly logged.

## Verdict

- PASS (captured save fields persisted across reload).
