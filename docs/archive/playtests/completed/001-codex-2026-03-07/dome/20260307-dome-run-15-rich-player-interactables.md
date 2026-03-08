# Dome Sweep Playthrough Report

- Run ID: 20260307-dome-run-15-rich-player-interactables
- Run type: dome sweep
- Scenario preset: rich_player
- URL: http://localhost:5173?skipOnboarding=true&devpreset=rich_player
- Timestamp: 2026-03-07T14:00:11.781Z
- Result: PARTIAL
- Blocker: Snapshot exposed only 2 visible interactables, so the required 10 interactable cross-checks could not be completed.

## Flow

- Initial screen: `cutscene`
- Forced transition: `currentScreen` set to `base` for dome coverage
- Final screen: `base`

## Command/Lab/Workshop/Market Interaction Checks

- `command`: action-style control detected and clicked once (`Settings` path reached `screen=settings`, then returned to `base`)
- `lab`: no room-tab/button with `Lab` label detected in this run
- `workshop`: no room-tab/button with `Workshop` label detected in this run
- `market`: no room-tab/button with `Market` label detected in this run

## Interactable Snapshot Cross-Check

- Snapshot interactables found: 2
- Cross-checked interactables: 2
  1. `button` text `⚙` -> click failed (`not_visible` at click time)
  2. `button` text `DEV` -> click succeeded
- Requirement status: **not met** (`2/10`)

## Runtime Diagnostics

- Console errors:
  - `Failed to load resource: the server responded with a status of 500 (Internal Server Error)`
  - `Failed to load resource: the server responded with a status of 404 (Not Found)`
- Failed requests:
  - `500` `http://localhost:3001/api/facts/packs/all`
  - `404` `http://localhost:5173/api/facts/delta?since=0&limit=500`

## Final State

- `href=http://localhost:5173/?skipOnboarding=true&devpreset=rich_player`
- `title=Terra Gacha`
- `screen=base`
- One browser session used for this playthrough run.
