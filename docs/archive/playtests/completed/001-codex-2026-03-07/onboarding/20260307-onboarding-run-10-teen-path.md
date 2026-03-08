# Onboarding Playthrough Run 10 - Teen Path (first_boot)

- Run date: 2026-03-07
- Environment: `http://localhost:5173/?devpreset=first_boot` (no `skipOnboarding`)
- Path: first boot onboarding, teen selection branch
- Result: **FAIL (blocked before onboarding completion)**

## Progression text/buttons and transition chain

1. Initial screen text: `How old are you?`
2. Initial visible buttons:
   - `Under 13 Kid-friendly content only`
   - `13-17 Teen and kid content`
   - `18+ All content unlocked` (`data-testid="btn-age-adult"`)
3. Action: selected teen option (`13-17 Teen and kid content`).
4. Transition observed: age gate -> `New Explorer` interest-selection step.
5. `New Explorer` step visible buttons:
   - `← Back`
   - interest emoji buttons: `⛏`, `🪨`, `💎`, `🦕`, `🌋`, `🔭`, `🧬`, `🌿`
   - `Start Exploring` (disabled)
6. Action: selected an interest emoji (`⛏`) once.
7. Result after selection: `Start Exploring` remained disabled; no actionable progression CTA appeared.
8. Expected transition to completed onboarding/base-ready state did not occur; run remained stuck on `New Explorer`.

## Runtime/state evidence

- `window.__terraDebug().currentScreen`: `base` throughout this run.
- `terra:currentScreen` store: `base` throughout this run.
- UI overlay still displayed onboarding (`How old are you?` then `New Explorer`), indicating screen-store value and visible progression state are inconsistent.
- `window.__terraDebug().recentErrors`: empty array in sampled states.

## Console/runtime errors

- Console error: `Failed to load resource: the server responded with a status of 500 (Internal Server Error)`
- Console error: `Failed to load resource: the server responded with a status of 404 (Not Found)`
- Network failure observed: `GET /api/facts/delta?since=0&limit=500` -> `net::ERR_ABORTED`
- Console warnings: repeated WebGL performance warning (`GPU stall due to ReadPixels`)

## Evidence artifacts

- `/tmp/onboarding-run-10-result.json`
- `/tmp/onboarding-run-10-01-initial.png`
- `/tmp/onboarding-run-10-02-after-teen-select.png`
- `/tmp/onboarding-run-10-03-final.png`
