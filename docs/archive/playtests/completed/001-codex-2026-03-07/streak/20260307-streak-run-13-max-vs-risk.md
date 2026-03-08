# Streak/Milestone Surface Run 13 - max_streak vs streak_about_to_break

- Timestamp (UTC): 2026-03-07T14:36:47Z to 2026-03-07T14:36:57Z
- Run count: 1 playthrough run (single browser session)
- Scenario order: `max_streak` then `streak_about_to_break`
- URLs:
  - `http://127.0.0.1:5173/?skipOnboarding=true&devpreset=max_streak`
  - `http://127.0.0.1:5173/?skipOnboarding=true&devpreset=streak_about_to_break`
- Evidence:
  - `/tmp/streak-run-13-max-vs-risk.json`
  - `/tmp/playthrough-streak-run-13-max.png`
  - `/tmp/playthrough-streak-run-13-risk.png`

## Validation Results

| Preset | Screen | UI streak signal | Store `stats.currentStreak` | Display/Store parity | Milestone/Protection UI available |
|---|---|---|---:|---|---|
| `max_streak` | `base` | `A 100-day streak!` (G.A.I.A. text) | 100 | PASS (numeric parity inferred from visible text) | FAIL (no reachable matching UI route/label) |
| `streak_about_to_break` | `base` | No explicit numeric streak label detected in reachable DOM text | 14 | FAIL (cannot verify parity due missing reachable numeric display) | FAIL (no reachable matching UI route/label) |

## Coverage Gaps (Explicit)

1. No reachable DOM controls/labels for `Streak`, `Season`, `Social`, `Leaderboard`, `Milestone`, `Protection`, `Freeze`, or `Shield` in either preset (`routeHits: []`).
2. Milestone/protection surfaces appear inaccessible via deterministic DOM-only route in this session (likely Phaser-canvas navigation path).
3. `streak_about_to_break` did not expose a numeric streak display in reachable DOM text, so strict display/store parity could not be fully completed for that preset.

## Runtime Notes

- Repeated non-blocking dev runtime errors: CORS failures to `:3001` facts/analytics endpoints and 404s on API paths.
- No uncaught page exceptions captured (`pageErrors: []`).

## Verdict

- **FAIL (partial)**: comparison run executed in requested order and store state was captured, but required milestone/protection UI was not reachable and parity validation could not be completed for `streak_about_to_break` due missing explicit numeric streak display in reachable DOM.
