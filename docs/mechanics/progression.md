# Progression & Run Structure

> **Purpose:** Documents the run lifecycle, floor/room generation, map layout, room types, ascension system, and shop mechanics.
> **Last verified:** 2026-03-31
> **Source files:** `src/services/runManager.ts`, `src/services/floorManager.ts`, `src/services/mapGenerator.ts`, `src/services/ascension.ts`, `src/data/balance.ts`, `src/services/shopService.ts`

---

## Run Structure

A run is created via `createRunState(primary, secondary, options?)` in `runManager.ts`. Key starting values:
- `playerHp = playerMaxHp = PLAYER_MAX_HP (100)` — overridden by ascension
- `startingAp = 3`, `starterDeckSize = 15` (overridden by ascension at levels 5/18)
- `currency = 0`, `ascensionLevel`, `runSeed` (crypto random uint32)
- `floor: FloorState` initialized via `createFloorState()`

Run ends via `endRun(state, 'victory' | 'defeat' | 'retreat')`. Final `rewardMultiplier` = `deathPenalty × difficultyBonus × masteryRewardScale × poolRewardScale`. Death penalty is segment-based (`DEATH_PENALTY[segment]`). Practice runs (deck > 75% mastered) suppress rewards.

### Run Flow
```
Hub → Domain Selection → Floor 1 → [rooms] → Boss → Retreat or Delve → Floor 2 → ... → Run End
```

## Floor Generation (`floorManager.ts`)

### Segments and Boss Floors
`getSegment(floor)` maps floors to difficulty tiers:
| Segment | Floors      | Region          |
|---------|-------------|-----------------|
| 1       | 1–6         | Shallow Depths  |
| 2       | 7–12        | Deep Caverns    |
| 3       | 13–18       | The Abyss       |
| 4       | 19–24       | The Archive     |

`SEGMENT_BOSS_FLOORS = [3, 6, 9, 12, 15, 18, 21, 24]`. Endless mode: boss every `ENDLESS_BOSS_INTERVAL = 3` floors. `MAX_FLOORS = 24`.

### Encounters Per Floor
Always 3 (`getEncountersForFloor`). Encounter 3 is always a mini-boss on non-boss floors (`isMiniBossEncounter`), or the floor boss on boss floors.

### Non-Combat Events Per Floor
`getEventsForFloor`: Segment 1 = 1 event; Segment 2 = 1–2 (50/50); Segment 3+ = 2 events.

Event chance after combat by segment (`EVENT_CHANCE_BY_SEGMENT`): 80% / 75% / 65% / 60%.

### Room Type Weights by Segment
`ROOM_WEIGHTS_BY_SEGMENT` (combat / mystery / rest / treasure / shop):
| Segment | Combat | Mystery | Rest | Treasure | Shop |
|---------|--------|---------|------|----------|------|
| 1       | 50     | 20      | 15   | 10       | 5    |
| 2       | 40     | 25      | 15   | 10       | 10   |
| 3–4     | 35     | 25      | 20   | 10       | 10   |

`generateRoomOptions` always ensures at least 1 combat room in each 3-room selection.

### Mystery Events
`generateMysteryEvent(floor)` uses act-aware distribution via `MYSTERY_DISTRIBUTION_BY_ACT`:
| Act | Narrative | Card Reward | Combat |
|-----|-----------|-------------|--------|
| 1 (floors 1–4) | 80% | 5% | 15% |
| 2 (floors 5–8) | 65% | 10% | 25% |
| 3 (floors 9–12) | 55% | 15% | 30% |

Act 3 combat ambushes are always elite-tier. Act 2 ambushes are 50/50 regular/elite.

Tier pools (added per act):
- `TIER_1_EVENTS` (Act 1+): 7 events — reading nook, inscription (quiz), tutor (quiz), whispering shelf, lost notebook, flashcard merchant, lost and found
- `TIER_2_EVENTS` (Act 2+): 7 events — strict librarian, wrong answer museum, copyist's workshop, strange mushrooms (hidden 50/50), ambush, donation box, rival student (lose = 15 damage)
- `TIER_3_EVENTS` (Act 2+): 6 events — burning library (quiz, wrong = 8 damage), mirror scholar, merchant of memories, cache of contraband, wishing well, study group (quiz-gated)
- `TIER_4_EVENTS` (Act 3+): 7 events — knowledge gamble (3 hard Qs), the purge, meditation chamber, the purification (eraser_storm id, remove 2 + heal 15%), elite ambush, desperate bargain, the breakthrough (upgrade + heal 10%)

**Phase 2 redesign changes (2026-04-01):**
- All "nothing/Ignore/Decline" outcomes replaced with minimum 3–5g consolation
- `dust_and_silence` → "The Inscription" (quiz-gated: correct = heal 15% + 10g; wrong = 10 damage)
- `strange_mushrooms` "Eat one" → hidden 50/50 random (heal 25% OR 15 damage); "Ignore" = 5g
- `donation_box` → "Donate 25g" = +5 max HP; "Shake it" = 50/50 +15g or 10 damage; "Leave" = 3g
- `rival_student` loseEffect → 15 damage (was nothing)
- `merchant_of_memories` → second option is -15 max HP for upgrade + free card; Decline = 3g
- `study_group` → quiz-gated (2 easy Qs, upgrade per correct); replaces duplicate upgradeRandomCard
- `the_breakthrough` → compound (upgrade + heal 10%); replaces duplicate upgradeRandomCard
- `eraser_storm` (id kept) → "The Purification": remove 2 random cards + heal 15%
- `knowledge_gamble` → 3 hard questions (heal 15% / upgrade / heal 15% per correct; 10 damage per wrong)
- `wishing_well` bad outcome now also deals 8 damage; "Save" = 3g consolation
- `desperate_bargain` "Keep your strength" → 3g consolation
- `burning_library` perWrongPenalty → 8 damage (was nothing)

## Map Layout (`mapGenerator.ts`)

Slay the Spire-style act map generated by `generateActMap(segment, seed)` using mulberry32 PRNG.

`MAP_CONFIG` defaults (mobile):
- `ROWS_PER_ACT = 8` (desktop: 14 via `getMapConfig(isDesktop)`)
- `START_PATHS = 3`, `MIN_NODES_PER_ROW = 2`, `MAX_NODES_PER_ROW = 4`
- `BRANCH_CHANCE = 0.3`, `MERGE_CHANCE = 0.2`
- `PRE_BOSS_ROW = 6` (always rest), `BOSS_ROW = 7` (always 1 boss node)
- `ELITE_MIN_COUNT = 1`, `ELITE_MAX_COUNT = 2`
- `SHOP_MIN_COUNT = 1`, `SHOP_MAX_COUNT = 2`, `SHOP_MIN_SPACING = 2`
- `MYSTERY_MIN_COUNT = 2`, `MYSTERY_MAX_COUNT = 4`

### Room Distribution per Segment (`ROOM_DISTRIBUTION`)

Aligned with Slay the Spire: mystery rooms raised to 22% across all acts (was 16%), combat reduced, treasure reduced, elite/shop scale with segment depth.

| Segment | Combat | Elite | Mystery | Rest | Treasure | Shop |
|---------|--------|-------|---------|------|----------|------|
| 1       | 45%    | 8%    | 22%     | 12%  | 5%       | 8%   |
| 2       | 42%    | 10%   | 22%     | 12%  | 4%       | 10%  |
| 3       | 40%    | 12%   | 22%     | 12%  | 4%       | 10%  |
| 4       | 38%    | 14%   | 22%     | 12%  | 4%       | 10%  |

### Node Types
`MapNodeType`: `'combat' | 'elite' | 'boss' | 'mystery' | 'rest' | 'treasure' | 'shop'`

Row 0 = always combat, `PRE_BOSS_ROW` = always rest, `BOSS_ROW` = always boss. Post-assignment guarantees (range-based, not exact — weighted random results stand when in range):
- Exactly 1 rest in rows 1–`PRE_BOSS_ROW-1`
- Shops clamped to `SHOP_MIN_COUNT`–`SHOP_MAX_COUNT` (1–2); any pair within `SHOP_MIN_SPACING` rows is trimmed to one
- Mystery rooms clamped to `MYSTERY_MIN_COUNT`–`MYSTERY_MAX_COUNT` (2–4); extras avoided in the same row as shops
- Elites clamped to `ELITE_MIN_COUNT`–`ELITE_MAX_COUNT`

### Map Navigation
`selectMapNode(map, nodeId)` — locks siblings in the same row, unlocks children. Records each decision in `map.decisionHistory`. `isActMapComplete` returns true when the boss node is visited.

## Enemy Pools

`getRegionForFloor` → `getEnemiesForFloorNode(floor, nodeType)` resolves enemies from `ACT_ENEMY_POOLS`:
- Encounter 1–2: common enemies weighted by `spawnWeight` (default 10) via `pickCombatEnemy`
- Encounter 3 (non-boss floor): mini-boss from `MINI_BOSS_POOL_BY_REGION`
- Boss floors: `pickBossForFloor(floor, rngValue)` from `BOSS_POOL_BY_REGION`

Named bosses: floor 3 = `final_exam`, floor 6 = `burning_deadline`, floor 9 = `algorithm`, floor 12 = `curriculum`, floors 15–24 continue the series.

## Ascension System (`ascension.ts`)

`MAX_ASCENSION_LEVEL = 20`. Each level adds one challenge + one buff (cumulative). `getAscensionModifiers(level)` returns `AscensionModifiers`.

Selected level effects:
| Level | Challenge | Buff |
|-------|-----------|------|
| 2  | Enemies +10% damage | +1 AP on first turn |
| 4  | Timer -1s all questions | Start with random uncommon |
| 5  | 12 starter cards | Free card removal per shop |
| 7  | Close distractors more common | Charged correct +15% damage |
| 9  | Enemies regen 2 HP/turn | Start encounters with 3 shield |
| 13 | Player max HP → 80 | Start with Vitality Ring |
| 17 | Wrong answers deal 3 self-damage | Correct answers heal 1 HP |
| 19 | All questions use hard formats | Charge plays cost 0 extra AP |
| 20 | Final boss second phase | Start with 3 relics (choose from 7) |

`applyAscensionEnemyTemplateAdjustments` scales mini-boss attacks to boss-tier at level 8 and adds a second phase to `final_lesson` (floor 24) at level 20.

## Shop (`shopService.ts`)

`ShopInventory` contains relics, cards, optional removal/transform service prices, and a sale card index.

### Inventory
- `SHOP_RELIC_COUNT = 3` relics, `SHOP_CARD_COUNT = 3` cards per visit
- Relic rarity weights: common 40%, uncommon 35%, rare 20%, legendary 5%

### Pricing
`calculateShopPrice(basePrice, floor)`: `discount = min(floor × 0.03, 0.40)` — up to 40% off at deep floors.

Card base prices (`SHOP_CARD_PRICE_V2`): common 50g, uncommon 80g, rare 140g.
Relic base prices (`SHOP_RELIC_PRICE`): common 100g, uncommon 160g, rare 250g, legendary 400g.

One card per visit is on sale: `getSalePrice` = 50% off (applied after floor discount).

### Services
- **Card removal**: `removalPrice(count) = SHOP_REMOVAL_BASE_PRICE (50) + count × 25` — escalates each removal
- **Card transform**: `transformPrice(count) = 35 + count × 25` — escalates each transform
- **Ascension level 5 buff**: one free card removal per shop visit
