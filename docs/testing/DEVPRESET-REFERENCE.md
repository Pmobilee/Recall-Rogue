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
| `post_tutorial` | Post Tutorial | `base` | 5 facts learned, 180 dust, 2 shards, 1 run completed, 2 rooms unlocked. |
| `first_pet` | Early Game | `base` | 10 facts learned, 600 dust, 15 shards, workshop unlocked. 5 runs, best floor 6. |
| `mid_game_3_rooms` | Mid Game (3 Rooms) | `base` | 25 facts, 2400 dust, 80 shards, 15 crystals, 3 rooms, 240 KP. 18 runs, best floor 10. |
| `endgame_all_rooms` | Endgame (All Rooms) | `base` | 80 facts, 18 000 dust, all hub floors unlocked, 2800 KP, titles, premium materials. 95 runs. |
| `full_collection` | Full Collection | `base` | 120 facts, all discs collected, max resources, cosmetics. 300 runs. |
| `empty_inventory` | Empty Inventory | `base` | 40 facts learned but 0 gold, 0 minerals — tests scarcity UI states. |
| `max_streak` | Max Streak | `base` | 100-day streak, all milestones claimed, all hub floors unlocked. |
| `first_fossil_found` | Early Run | `base` | 4 runs completed, 8 facts, 350 dust. |
| `mid_dive` | Mid Run | `base` | Mid-game player, 15 facts, 800 dust, 8 runs completed. Workshop unlocked. |
| `quiz_due` | Quiz Due | `base` | 30 facts with overdue reviews — tests quiz prompts and study screen. |
| `rich_player` | Rich Player | `base` | Max resources for testing purchases and store UI. 50 runs, all hub floors. |
| `first_boot` | First Boot | `base` | Absolute first boot — tests onboarding, age gate, tutorial. |
| `workshop_unlocked` | Workshop Just Unlocked | `base` | 3 runs, 3 rooms unlocked, 450 dust, 12 shards, 8 facts. Workshop just accessible. |
| `mid_dive_active` | Mid Run Active (Run Prep) | `divePrepScreen` | Mid-game player ready to start a run. Targets DivePrepScreen. |
| `five_rooms` | 5 Rooms | `base` | 20 runs, 40 facts, 5 hub rooms unlocked, streak 12. |
| `streak_about_to_break` | Streak at Risk | `base` | 14-day streak, last play 2 days ago, 0 freezes — streak about to break. |
| `dive_results` | Run Results Screen | `diveResults` | 3 runs done, just finished a run. Targets diveResults screen. |
| `many_reviews_due` | Many Reviews Due | `base` | 50 facts, ALL overdue by 2 days. Tests heavy review load. |
| `just_crafted` | Just Crafted | `base` | 15 runs, crafted items active. |
| `has_pending_artifacts` | Has Pending Artifacts | `base` | Mid-game player with 3 pending artifacts (common, uncommon, rare). |
| `all_floors_unlocked` | All Floors Unlocked | `base` | Endgame player with all hub floors unlocked. |
| `streak_just_claimed` | Streak Just Claimed | `base` | 14-day streak with 3-Day and 7-Day milestones already claimed. |
| `heavy_review_overdue` | Heavy Review Overdue | `base` | 100 learned facts, ALL overdue by 7+ days. |
| `first_dive_returning` | First Run Returning | `base` | First-time player returning from run with 1 pending artifact. |

## Notes

- Presets intentionally cover onboarding, scarcity, progression, review load, artifacts, streak states, and screen routing.
- `buildSave(now)` writes full `PlayerSave` payloads aligned with `SAVE_VERSION` from `src/services/saveService.ts`.
- The `minerals` field in `PlayerSave` represents the in-game currency system (dust → shard → crystal → geode → essence). These are earned through runs, not mining.
