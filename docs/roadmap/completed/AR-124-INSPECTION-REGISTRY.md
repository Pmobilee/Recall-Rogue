# AR-124 — Game Element Inspection Registry

**Date:** 2026-03-21
**Goal:** Create a comprehensive, machine-readable database of every game element — cards, relics, enemies, rooms, screens, systems, mystery events, status effects, reward types, chain types, and domains — with per-element tracking of last-changed date, visual inspection, mechanic verification, and UX review status.

---

## Overview

The inspection registry is a single JSON file at `data/inspection-registry.json` that serves as the source of truth for what exists in the game and when each element was last verified. Every time code touches a game element, the registry must be updated with the current date in `lastChangedDate`. Periodic inspection passes update the other date fields.

## Tables

| Table | Count | Description |
|---|---|---|
| `cards` | 31 | All card mechanics (strike, block, heavy_strike, etc.) |
| `relics` | 44 | All relics (25 starters + 19 unlockable) |
| `enemies` | 87 | All enemy templates across 4 acts |
| `rooms` | 7 | Room types (combat, shop, rest, mystery, treasure, elite, boss) |
| `screens` | 28 | All navigable screens/overlays |
| `systems` | 25+ | Major game systems (combat, quiz, SM-2, combos, chains, etc.) |
| `mysteryEvents` | 27 | All mystery event definitions |
| `specialEvents` | 5 | Post-boss special events |
| `statusEffects` | 6 | All status effects |
| `rewardTypes` | 4 | Reward item types |
| `chainTypes` | 6 | Knowledge chain colors |
| `domains` | 12 | Knowledge domains |

## Per-Element Fields

```json
{
  "id": "strike",
  "name": "Strike",
  "category": "attack",
  "description": "Deal 8 damage",
  "status": "working",
  "lastChangedDate": "not_checked",
  "visualInspectionDate": "not_checked",
  "mechanicInspectionDate": "not_checked",
  "uxReviewDate": "not_checked",
  "notes": ""
}
```

### Status Values
- `working` — Implemented and believed functional
- `partial` — Partially implemented (e.g., relic effect code exists but not all paths wired)
- `unimplemented` — Defined in data but no effect code
- `broken` — Known to be broken
- `deprecated` — Kept for backwards compat only
- `phase2` — Gated behind phase 2 flag, not active

### Date Fields
- `lastChangedDate` — When element's code was last modified
- `visualInspectionDate` — Last visual check via Playwright/manual play
- `mechanicInspectionDate` — Last verification that the element does what its description says
- `uxReviewDate` — Last UX review based on research/heuristics

All dates start as `"not_checked"` and are updated to ISO date strings (e.g., `"2026-03-21"`) when inspected.

## Enforcement Rules

1. **On any code change** touching a game element: update `lastChangedDate` in the registry
2. **On visual inspection**: update `visualInspectionDate`
3. **On mechanic verification**: update `mechanicInspectionDate`
4. **On UX review**: update `uxReviewDate`
5. The feature-pipeline skill must check the registry after implementation
6. Memory files must reference this registry

## Known Issues Found During Research

### Relics — Partial/Missing Implementations
- `toxic_bloom` — NO implementation (Phase 2 only)
- `bastions_will` — Quick Play +25% block path missing
- `double_down` — Full 3-outcome flow (5x/1.5x/0.3x) is TODO
- `domain_mastery_sigil` — Resolver uses streak logic, not deck-composition check as described
- `phoenix_feather` — Resurrect works; auto-Charge-free post-resurrect not wired
- `mirror_of_knowledge` — Flag returned but actual replay execution not confirmed

### Enemies — Issues
- `knowledge_siphon` — Missing sprite (no folder in combat/enemies/)
- `ore_wyrm` — Deprecated but still in ACT_ENEMY_POOLS Act 1 elites
- `fossil_guardian` — Deprecated, not in pools (dead code)

### Cards — Phase 2 Gated
- `parry`, `transmute`, `immunity`, `overclock` — Behind ENABLE_PHASE2_MECHANICS flag

## Acceptance Criteria

- [ ] `data/inspection-registry.json` created with all tables populated
- [ ] Every card mechanic listed with correct status
- [ ] Every relic listed with implementation status
- [ ] Every enemy listed with sprite status
- [ ] All rooms, screens, systems, events, effects listed
- [ ] Memory file created referencing the registry
- [ ] Feature-pipeline skill updated to enforce registry updates
