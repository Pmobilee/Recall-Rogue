# Companion Run 11 - First Pet

- Timestamp (UTC): 2026-03-07 14:32
- Run type: `companion/zoo/farm`
- Scenario: `first_pet`
- URL: `http://127.0.0.1:5173/?skipOnboarding=true&devpreset=first_pet`
- Evidence: `/tmp/codex-companion-run-11-first-pet.json`, `/tmp/playthrough-companion-run-11-first-pet.png`

## UI Interaction Attempt

- Attempted companion-related UI interaction after opening `DEV` panel.
- Direct companion/farm/zoo action from base UI was inaccessible in this run (`companion_ui_action=inaccessible`).
- Fallback used per requirement: store + forced-screen evidence.

## Companion Field Consistency

| Field | Before | Forced Zoo | Forced Farm | Consistency |
| --- | --- | --- | --- | --- |
| `activeCompanion` | `trilobite` | `trilobite` | `trilobite` | PASS |
| `fossils.trilobite.revived` | `true` | `true` | `true` | PASS |
| `farm.slots` | `[null,null,null]` | `[null,null,null]` | `[null,null,null]` | PASS |
| `unlockedRooms` | `[command,lab,workshop]` | same | same | PASS |
| `currentScreen` | `base` | `zoo` | `farm` | PASS |

## Render Verification

- Forced `zoo` rendered correctly (`visibleZoo=true`) and showed companion text (`visibleTrilobite=true`).
- Forced `farm` rendered correctly (`visibleFarm=true`) with slot controls (`Place Companion`) and empty crop state (`No crops`).
- No companion field mismatches observed between before/after checks.

## Issues Observed

- Medium: Companion interaction path is not directly discoverable from initial base UI in this preset run.
- Low: Console included pre-existing network errors (`CORS` on `:3001` facts endpoint, one `404`), no blocking render failure observed for zoo/farm surfaces.

## Verdict

- PASS (partial UI-access path; requirement satisfied via attempted UI interaction plus store+screen evidence).
