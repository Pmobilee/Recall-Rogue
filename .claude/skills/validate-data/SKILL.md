---
name: validate-data
description: Cross-reference game data files for referential integrity — enemies, relics, mechanics, status effects, rooms, and the inspection registry. Use after adding or modifying game elements to catch missing wiring.
---

# Data Integrity Validator

Performs a cross-referencing audit of all interconnected game data files. Use after adding new enemies, relics, cards, mechanics, status effects, or any game element.

## Files to Cross-Reference

| Data File | Contains | Referenced By |
|-----------|----------|---------------|
| `src/data/enemies.ts` | Enemy definitions (IDs, traits, stats) | Room weight tables, encounter configs |
| `src/data/relics/starters.ts` | Starter relic definitions | Balance configs, relic pool |
| `src/data/relics/unlockable.ts` | Unlockable relic definitions | Level rewards, relic pool |
| `src/data/statusEffects.ts` | Status effect definitions | Enemy abilities, card effects, relic triggers |
| `src/data/mechanics.ts` | Card mechanic definitions | Card types, reward pools, unlock gating |
| `src/data/balance.ts` | Balance constants | Referenced throughout combat, rewards, economy |
| `src/data/domainMetadata.ts` | Knowledge domain definitions | Fact DB, quiz system, entitlements |
| `data/inspection-registry.json` | 449 tracked game elements | Verification tracking |

## Checks to Perform

### 1. Enemy Integrity
- Every enemy ID in room weight tables exists in `enemies.ts`
- Every status effect an enemy applies exists in `statusEffects.ts`
- Every trait referenced (`chargeResistant`, `quickPlayPunish`, etc.) is a valid trait type
- HP tier values are within expected ranges (4-9 base)

### 2. Relic Integrity
- Every relic ID in level rewards exists in starters or unlockable
- Every status effect a relic grants/triggers exists in `statusEffects.ts`
- Every mechanic a relic references exists in `mechanics.ts`
- Relic rarity values are valid (common/uncommon/rare/legendary)
- No duplicate relic IDs across starters and unlockable

### 3. Card Mechanic Integrity
- Every mechanic in the unlock gating table exists in `mechanics.ts`
- Every status effect applied by a mechanic exists in `statusEffects.ts`
- AP costs are within valid range (0-3)
- All card types (attack/shield/buff/debuff/utility/wild) are valid

### 4. Inspection Registry Sync
- Every enemy in `enemies.ts` has an entry in `inspection-registry.json`
- Every relic in starters/unlockable has an entry
- Every mechanic in `mechanics.ts` has an entry
- No registry entries reference IDs that no longer exist in code (would be `deprecated`)

### 5. GDD Coverage
- Spot-check: every enemy in `enemies.ts` is mentioned in `docs/GAME_DESIGN.md` §8
- Spot-check: every relic is documented in §16
- Spot-check: every status effect is documented in §4.5

## How to Run

Use Explore agents to read the data files, then programmatically cross-reference. For large files, use `grep` to extract IDs rather than reading entire files.

Report findings as:
- **MISSING**: Element X referenced but not defined
- **ORPHAN**: Element X defined but never referenced
- **DRIFT**: Registry/GDD out of sync with code
- **RANGE**: Value outside expected bounds

### 6. Curated Deck Pool-Template Compatibility
- For every deck with `questionTemplates`, check that each template's `answerPoolId` references a pool where ALL facts have the fields the template's `questionFormat` placeholders require
- Example: template `"Who created the {language} programming language?"` uses `{language}` → every fact in that pool must have a non-empty `language` field (or equivalent fact property)
- Extract placeholders from `questionFormat` via `/\{(\w+)\}/g`, then check each fact in the referenced pool has that field non-empty
- Flag: **TEMPLATE_POOL_MISMATCH**: Template X references pool Y, but fact Z in pool Y has no value for placeholder `{field}`
- This prevents nonsensical questions like "Who created the  programming language?" (answer: Elon Musk) from 2026-04-02 incident

### 7. Answer Format Consistency Within Pools
- Every fact in a pool must have a `correctAnswer` in the same format (single name vs list, number vs text, with-unit vs without-unit)
- Flag: **FORMAT_MISMATCH**: Pool X has mixed answer formats (e.g., single names and comma-separated lists)

## When to Use
- After adding any new enemy, relic, card mechanic, or status effect
- After removing or renaming game elements
- After adding or modifying curated decks (especially answer type pools and question templates)
- Periodically as a health check (suggest monthly or before major releases)
