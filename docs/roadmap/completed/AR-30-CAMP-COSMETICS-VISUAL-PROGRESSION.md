# AR-30: Camp Cosmetics & Visual Progression
> Phase: Post-Content UX
> Priority: Large
> Status: Core Implementation Completed (March 10, 2026)

## Summary

Upgraded the between-run hub into an interactive camp scene with cosmetic progression systems. Players can now navigate via camp objects, spend dust as camp gold for visual upgrades, switch outfits, unlock/select pets, and view boss trophies.

## Design Reference

From `docs/GAME_DESIGN.md`:

> "Between-runs hub becomes a visual camp scene near the dungeon entrance."

> "Menu integration: tap camp objects to navigate (tent=inventory, campfire=start run, signpost=settings)"

> "Upgrade tier system: 4-5 visual tiers per camp element (tent, seating, fire, decorations)"

> "Pet companion system: unlock and display pets at camp (cat, owl, fox, dragon whelp)"

## Implementation

### Data Model
- Added persistent client-side `campState` store:
  - Upgrade tiers by element (`tent`, `seating`, `campfire`, `decor`)
  - Active outfit selection
  - Unlocked pet list + active pet
- Added upgrade and pet cost tables and persistence sanitization logic.

### Logic
- Added object-to-navigation mapping for camp interactions.
- Added cosmetic upgrade purchase flow using dust spending gates.
- Added outfit equip flow (cosmetic-only).
- Added pet unlock/select flow with unlock costs.
- Added trophy rack source from `playerSave.defeatedBosses`.

### UI
- Replaced flat hub home presentation with a camp scene composition:
  - Sky/ridge/gate backdrop layers
  - Interactive camp objects with tier badges
  - Player avatar with outfit variant indicator
  - Active pet slot
  - Boss trophy rack
- Added Camp Upgrade Shop:
  - Tiered element upgrades
  - Outfit selector
  - Companion selector/unlock controls
- Kept streak and last-run summary widgets visible in the updated layout.

### System Interactions
- Integrates with existing hub navigation callbacks.
- Integrates with existing player dust resource via `deductMinerals`.
- Uses existing save data for boss trophy surfacing.

## Edge Cases

- Affordability checks prevent negative dust spending.
- Tier ceilings enforced (`CAMP_MAX_TIER`).
- Persisted camp data is sanitized on load for unknown or malformed values.
- Pet selection only allowed for unlocked pets.

## Files Modified

- `src/ui/components/HubScreen.svelte`
- `src/ui/stores/campState.ts`
- `docs/roadmap/PROGRESS.md`

## Done-When Checklist

- [x] Camp scene layout implemented.
- [x] Camp object navigation mapping implemented.
- [x] Tiered cosmetic progression implemented.
- [x] Outfit variants implemented.
- [x] Pet unlock/select flow implemented.
- [x] Boss trophy display implemented.
- [x] Camp state persistence implemented.
- [ ] AI sprite-generation pipeline for location-aware camp element variants.
