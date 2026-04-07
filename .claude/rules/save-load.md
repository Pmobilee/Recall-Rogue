# Save/Load System — Rules

## Schema Versioning

- `PlayerSave` has a `version` field (currently v1)
- Every structural change to the save schema MUST bump the version
- Migration functions in `saveMigration.ts` handle upgrades: v1→v2, v2→v3, etc.
- Migrations MUST be additive — never remove fields, only add or transform
- Old saves MUST always load in new game versions (backward compatible)

## Before Adding New State

When adding any new persistent field to PlayerSave:

1. Add the field with a sensible default value
2. Add migration logic in `saveMigration.ts` that sets the default for old saves
3. Test: load a v(N-1) save in v(N) code — verify no crash, field populated correctly
4. Document the field in the save format docs

## Crash-Safe Writes

- Desktop (Tauri): Write to `.tmp` file, then atomic rename
- Web (localStorage): Single `setItem` call (atomic by spec)
- Never write partial state — serialize fully, then persist in one operation
- On load failure: fall back to last known good save, not empty state

## What Gets Saved

- Run state: floor, HP, deck, relics, gold, encountered enemies
- Knowledge state: FSRS data, confusion matrix, mastery levels
- Meta state: settings, profile, achievements, statistics, unlocks
- DO NOT save: UI state, animation state, transient combat state mid-turn

## Steam Cloud

- Steamworks Auto-Cloud enabled for save directory
- If conflict detected (played on two machines): prefer the save with more total playtime
- Document save file location per platform in player-facing settings
