# Dev Preset Reference

Source of truth: `src/dev/presets.ts` (`SCENARIO_PRESETS`).

- Total presets: `25`
- Type: `ScenarioPreset` (`id`, `label`, `description`, optional `targetScreen`, `buildSave(now)`)
- If `targetScreen` is omitted, app routing falls back to `base` (`src/App.svelte`).

## How presets are applied

Runtime entry points:

- URL-based dev boot in `src/App.svelte`:
  - `?skipOnboarding=true&devpreset=<preset-id>`
  - when matched, app builds save via preset and sets `currentScreen` to `preset.targetScreen ?? 'base'`
- Manual loading from `src/ui/components/DevPanel.svelte`:
  - imports `SCENARIO_PRESETS`
  - `loadPreset()` writes save and sets `currentScreen` to `base`

## Preset catalog

| ID | Label | targetScreen | Description |
| --- | --- | --- | --- |
| `new_player` | New Player | `base` | Completely fresh save. Zero progress, 50 dust, only command room unlocked. |
| `post_tutorial` | Post Tutorial | `base` | 5 facts learned, 180 dust, 2 shards, 1 dive completed, 2 rooms unlocked. |
| `first_pet` | First Pet | `base` | First fossil species (trilobite) revived. 10 facts, 600 dust, 15 shards, companion active. |
| `mid_game_3_rooms` | Mid Game (3 Rooms) | `base` | 25 facts, 2400 dust, 80 shards, 15 crystals, 3 rooms, 240 KP. |
| `endgame_all_rooms` | Endgame (All Rooms) | `base` | 80 facts, 18 000 dust, all rooms unlocked, 2800 KP, titles, premium materials. |
| `full_collection` | Full Collection | `base` | All fossils revived, 120 facts, all discs collected, max resources, cosmetics. |
| `empty_inventory` | Empty Inventory | `base` | 40 facts learned but 0 oxygen tanks, 0 minerals - tests scarcity UI states. |
| `max_streak` | Max Streak | `base` | 100-day streak, all milestones claimed, all rooms unlocked. |
| `first_fossil_found` | First Fossil Found | `base` | 1 trilobite fragment found (not yet revived), 8 facts, 350 dust. |
| `mid_dive` | Mid Dive | `base` | Mid-game player with active companion, 15 facts, good mineral reserves. |
| `quiz_due` | Quiz Due | `base` | 30 facts with overdue reviews - tests quiz prompts and study screen. |
| `rich_player` | Rich Player | `base` | Max resources for testing crafting, purchases, and store UI. |
| `first_boot` | First Boot | `base` | Absolute first boot - tests onboarding, age gate, tutorial. |
| `workshop_unlocked` | Workshop Just Unlocked | `base` | 3 dives, 3 rooms unlocked, 450 dust, 12 shards, 8 facts. Workshop just accessible. |
| `mid_dive_active` | Mid Dive Active (Dive Prep) | `divePrepScreen` | Mid-game player ready to start a dive. Targets DivePrepScreen. |
| `five_rooms` | 5 Rooms + Active Farm | `base` | 20 dives, 40 facts, 6 rooms, trilobite on farm, ammonite partial, streak 12. |
| `streak_about_to_break` | Streak at Risk | `base` | 14-day streak, last dive 2 days ago, 0 freezes - streak about to break. |
| `dive_results` | Dive Results Screen | `diveResults` | 3 dives done, just finished a dive. Targets diveResults screen. |
| `many_reviews_due` | Many Reviews Due | `base` | 50 facts, ALL overdue by 2 days. Tests heavy review load. |
| `just_crafted` | Just Crafted | `base` | 15 dives, reinforced_tank crafted, bomb_kit active consumable. |
| `has_pending_artifacts` | Has Pending Artifacts | `base` | Mid-game player with 3 pending artifacts (common, uncommon, rare). |
| `all_floors_unlocked` | All Floors Unlocked | `base` | Endgame player with all dome floors unlocked. |
| `streak_just_claimed` | Streak Just Claimed | `base` | 14-day streak with 3-Day and 7-Day milestones already claimed. |
| `heavy_review_overdue` | Heavy Review Overdue | `base` | 100 learned facts, ALL overdue by 7+ days. |
| `first_dive_returning` | First Dive Returning | `base` | First-time player returning from dive with 1 pending artifact. |

## Notes

- Presets intentionally cover onboarding, scarcity, progression, review load, artifacts, streak states, and screen routing.
- `buildSave(now)` writes full `PlayerSave` payloads aligned with `SAVE_VERSION` from `src/services/saveService.ts`.
