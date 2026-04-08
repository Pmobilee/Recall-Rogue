# Progression & Run Structure

> **Purpose:** Documents the run lifecycle, floor/room generation, map layout, room types, ascension system, and shop mechanics.
> **Last verified:** 2026-04-08
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
- `TIER_2_EVENTS` (Act 2+): 8 events — strict librarian, wrong answer museum, copyist's workshop, strange mushrooms (hidden 50/50), ambush, donation box, rival student (lose = 15 damage), **the knowing skull** (knowledgeShop: pay HP for gold/upgrade/card, leave costs 5 HP)
- `TIER_3_EVENTS` (Act 2+): 7 events — burning library (quiz, wrong = 8 damage), mirror scholar, merchant of memories, cache of contraband, wishing well, study group (quiz-gated), **the forbidden section** (3 hard Qs; upgrade per correct, curseRandomCards(1) per wrong)
- `TIER_4_EVENTS` (Act 3+): 8 events — knowledge gamble (3 hard Qs), the purge, meditation chamber, the purification (eraser_storm id, remove 2 + heal 15%), elite ambush, desperate bargain, the breakthrough (upgrade + heal 10%), **the epiphany** (4-option choice: upgradeAllCards+3 curses / remove 3+lose 20% maxHP / quiz 5 hard for 15g+heal5% each / turn away 5g)

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
- `SHOP_MIN_COUNT = 1`, `SHOP_MAX_COUNT = 3`, `SHOP_MIN_SPACING = 1`
- `MYSTERY_MIN_COUNT = 2`, `MYSTERY_MAX_COUNT = 4`
- `TREASURE_MIN_COUNT = 1` (guarantee at least 1 treasure per act)


### Edge Generation — Symmetrized Branching (2026-04-08)

`createEdges()` wires parent nodes in row `r` to children in row `r+1` using a
`maxChildColUsed` tracker that ensures primary connections are monotonically
non-decreasing (left-to-right ordering is preserved across parents).

**Algorithm per parent node:**
1. Compute `baseCol` — proportional mapping of parent column to next-row range.
2. Collect primary candidates: `[baseCol-1, baseCol, baseCol+1]` (filtered to valid range).
3. Fisher-Yates shuffle candidates with the seeded RNG.
4. Primary connection: first shuffled candidate `>= maxChildColUsed`; update `maxChildColUsed`.
5. Secondary connection: collect `[primaryChild+1, primaryChild-1]` and shuffle them.
   Try each in shuffled order — right secondary advances `maxChildColUsed`, left secondary does not.
6. Orphan fix pass: any next-row node with 0 parents is connected to the nearest parent.

**Prior behavior (pre-2026-04-08):** primary was always `Math.max(maxChildColUsed, baseCol)`,
and secondary tried right-only before falling back to left. This created a strong rightward
bias (virtually all secondary branches went right; left branching was a last resort only).

**Post-fix statistics (150 maps, varied seeds):**
- Left edges: ~26% | Right edges: ~32% | Straight: ~42% | Gap: ~6pp (was ~40pp gap)
- `leftPct > 0.15`, `rightPct > 0.15`, `|leftPct - rightPct| < 0.10` enforced by unit test.

**Crossing note:** both old and new implementations produce ~10–12 minor adjacent-column
crossings per map (secondary-right from parent C then secondary-left from parent C+1).
These are visually subtle and are not treated as a defect. The `maxChildColUsed` tracker
prevents extreme long-range crossings (e.g., parent col 0 to child col 3 while parent col 2 to child col 0).

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
- Shops clamped to `SHOP_MIN_COUNT`–`SHOP_MAX_COUNT` (1–3); any pair within `SHOP_MIN_SPACING` rows is trimmed to one (spacing = 1, so adjacent rows are allowed)
- Mystery rooms clamped to `MYSTERY_MIN_COUNT`–`MYSTERY_MAX_COUNT` (2–4); extras avoided in the same row as shops
- Treasures: at least `TREASURE_MIN_COUNT` (1) guaranteed; a combat node is converted if weighted random falls short
- Elites clamped to `ELITE_MIN_COUNT`–`ELITE_MAX_COUNT`

### Map Navigation
`selectMapNode(map, nodeId)` — locks siblings in the same row, unlocks children. Records each decision in `map.decisionHistory`. `isActMapComplete` returns true when the boss node is visited.

### Fog of War

The dungeon map uses a **visual depth-cueing system** that combines node blur and atmospheric fog wisps. There is no opaque overlay or mask blocking information — instead, progressively blurred nodes create the visual sense of distance, while scattered fog wisps add atmosphere.

**Node visibility:**
- Nodes in the current row and next row are fully clear (0px blur, opacity 1.0)
- Nodes 2 rows away show 8px blur and 0.4 opacity
- Nodes 3 rows away show 16px blur and 0.2 opacity
- Nodes 4+ rows away show 24px blur and 0.08 opacity (nearly imperceptible)

Edge connection lines (SVG `.edge-layer`) follow the same opacity progression: 1.0 → 0.4 → 0.15 → 0.05 as you move away from the current row.

**Atmospheric fog wisps:**
- 17 scattered fog wisps across 3 size tiers create a billowy mist effect
- Medium clouds (300–500px), large clouds (550–800px), backdrop clouds (900–1200px)
- Each wisp follows a 6-keyframe meandering path with 200–450px drift
- Uses Web Animations API with soft diffuse radial-gradients
- Covers full screen width via `left: -50vw; right: -50vw`

**Respects accessibility:**
- All blur transitions and wisp animations disabled under `prefers-reduced-motion: reduce`

## Enemy Pools

`getRegionForFloor` → `getEnemiesForFloorNode(floor, nodeType)` resolves enemies from `ACT_ENEMY_POOLS`:
- Encounter 1–2: common enemies weighted by `spawnWeight` (default 10) via `pickCombatEnemy`
- Encounter 3 (non-boss floor): mini-boss from `MINI_BOSS_POOL_BY_REGION`
- Boss floors: `pickBossForFloor(floor, rngValue)` from `BOSS_POOL_BY_REGION`

Named bosses: floor 3 = `final_exam`, floor 6 = `burning_deadline`, floor 9 = `algorithm`, floor 12 = `curriculum`, floors 15–24 continue the series.

## Ascension System (`ascension.ts`)

`MAX_ASCENSION_LEVEL = 20`. Each level adds one challenge, most with a compensating buff (cumulative). `getAscensionModifiers(level)` returns `AscensionModifiers`.

**2026-04-05 redesign** — reverted progressive multipliers to stepped values, strengthened challenge bites, fixed broken field wiring, removed overcompensating buffs (STS philosophy: challenges stand alone).

Selected level effects:
| Level | Challenge | Buff |
|-------|-----------|------|
| 2  | Enemies +15% damage | *(none — challenge stands alone)* |
| 4  | Timer -1s all questions | Start with random uncommon |
| 5  | 12 starter cards | Free card removal per shop |
| 6  | Cannot flee encounters | Heal 5 HP on 3+ combo |
| 7  | Close distractors more common | Charged correct +10% damage |
| 8  | Mini-bosses use boss-tier attacks | Mini-boss victories always drop a relic |
| 9  | Enemies regen 3 HP/turn | Start encounters with 3 shield |
| 10 | Start with a Curse card | +1 free relic reroll per boss |
| 11 | Boss relics reduced to 2 choices | Relics trigger +15% more |
| 13 | Player max HP → 75 | Start with Vitality Ring |
| 14 | Combo resets each turn | *(none — challenge stands alone)* |
| 15 | Bosses +50% HP | *(none — challenge stands alone)* |
| 17 | Wrong answers deal 5 self-damage | Correct answers heal 1 HP |
| 19 | All questions use hard formats | (Reserved for future surcharge mechanic) |
| 20 | Final boss second phase | Start with 2 relics (choose from 5) |

**Stepped multipliers (2026-04-05 — reverted from progressive formula):**
- `enemyHpMultiplier`: `l >= 15 ? 1.15 : l >= 9 ? 1.10 : 1.00` (A9 durability wall, A15 tougher regulars)
- `enemyDamageMultiplier`: `l >= 17 ? 1.30 : l >= 8 ? 1.20 : l >= 2 ? 1.15 : 1.00` (A2 raw damage, A8 all enemies, A17 pressure)

**Key modifier values:**
- `enemyRegenPerTurn`: `l >= 9 ? 3 : 0` (was 2 — forces faster kills)
- `playerMaxHpOverride`: `l >= 13 ? 75 : null` (was 80)
- `bossHpMultiplier`: `l >= 15 ? 1.50 : 1.00` (was 1.25)
- `wrongAnswerSelfDamage`: `l >= 17 ? 5 : 0` (was 3)
- `chargeCorrectDamageBonus`: `l >= 7 ? 0.10 : 0` (was 0.15)
- `relicTriggerBonus`: `l >= 11 ? 0.15 : 0` (was 0.25)
- `firstTurnBonusAp`: always `0` (removed — A2 challenge stands alone)
- `perfectTurnBonusAp`: always `0` (removed — A14 challenge stands alone)
- `bossDefeatFullHeal`: always `false` (removed — A15 challenge stands alone)
- `comboHealThreshold`: `l >= 6 ? 3 : 0` (NEW — wired A6 buff)
- `comboHealAmount`: `l >= 6 ? 5 : 0` (NEW — wired A6 buff)
- `comboResetsOnTurnEnd`: `l >= 14` (NEW — wired A14 challenge)
- `startingRelicCount`: `l >= 20 ? 2 : l >= 10 ? 1 : l >= 1 ? 1 : 0`
- `freeCharging`: always `false` — `CHARGE_AP_SURCHARGE` is 0, making this a no-op; preserved for future surcharge restoration

**Sim results (2026-04-05, 500 runs each):**
| Profile | A0 win% | A20 win% | Direction |
|---------|---------|----------|-----------|
| new_player | 0% | 0% | flat (expected) |
| developing | 63% | 5% | correct drop |
| competent | 64% | 3% | correct drop |
| experienced | 90% | 10% | correct drop |
| master | 100% | 82% | still too high — further tuning needed |

Master at A20 is still 82% (target: 5-15%). The sim cannot test quiz-pressure penalties (A4/A7/A12/A19), so the real number will be lower. Further combat-side tuning may be needed.

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

---

## Rest Sites (`src/ui/components/RestRoomOverlay.svelte`, `src/CardApp.svelte`)

Players choose one option at each rest room:
- **Rest (Heal)**: Restores `REST_SITE_HEAL_PCT` (20%) of max HP. Reduced from 30% on 2026-04-04 to create HP pressure across the run. Ascension level 3+ applies `restHealMultiplier` (0.83×), giving ~16.6% effective healing.
- **Study**: Presents 3 quiz questions. When ≥1 question is answered correctly and the deck has upgradeable cards, `onStudyComplete()` sets the `pendingStudyUpgrade` store and transitions `gameFlowState` to `studyUpgradeSelection` — the UI subscribes and shows `CardPickerOverlay` in `multi` mode so the player chooses which N cards to upgrade. `onStudyUpgradeConfirmed(selectedCards)` applies the upgrades, clears the store, and calls `onRestResolved()`. If no upgradeable cards exist, `onStudyComplete()` falls through directly to `onRestResolved()`.
  - Key store: `pendingStudyUpgrade: { count: number; candidates: Card[] } | null` (exported from `gameFlowController.ts`)
- **Meditate**: Removes 1 card from the deck (disabled if deck < 5 cards).

The heal amount displayed and applied is always computed from `REST_SITE_HEAL_PCT * restHealMultiplier * playerMaxHp` (rounded). The constant is exported from `src/data/balance.ts` to keep the UI, `CardApp.svelte::handleRestHeal`, and `tests/playtest/headless/full-run-simulator.ts` in sync.

---

## Floor Descent Ceremony (Spec 04)

When advancing floors, a 2–3s descent ceremony distinguishes floor transitions from lateral room transitions.

### Trigger Points

Two call sites in `src/services/gameFlowController.ts` fire the ceremony immediately after `advanceFloor()`:
1. **Encounter flow** — after the final encounter on a floor, before routing to the dungeon map.
2. **Delve flow** — when the player confirms "Delve Deeper" from the retreat/delve screen.

Both sites call `getCombatScene()?.playDescentEffects(floor, isBoss)`.

### Game-Logic Side (`CombatScene.playDescentEffects`)

**File:** `src/game/scenes/CombatScene.ts`

| Effect | Timing | Reduce-motion | Turbo-mode |
|--------|---------|---------------|------------|
| DOM event `rr:floor-descent` | T+0ms | fired (no skip) | skipped entirely |
| Debris particle cascade | T+0ms | skipped | skipped entirely |
| Landing rumble (`'heavy'` shake) | T+2800ms (boss: T+3800ms) | skipped | skipped entirely |

**Debris cascade:** 25 small gray/brown particles (10 on low-end devices) spawned via `burstParticles()` scattered across the top 30% of the viewport. Tints: `0x888888`, `0x776655`, `0x999988`, `0x665544`.

**Landing rumble:** `screenShake.trigger('heavy')` — 8px amplitude, 400ms, 18Hz. Scheduled via `scene.time.delayedCall`. A scene-alive guard prevents firing after scene teardown.

**DOM event `rr:floor-descent`:** Dispatched with `{ floor, theme, isBoss, glowColor }`. Svelte components listen to this event to activate ParallaxTransition vertical emphasis, color grading interpolation, and the floor title card overlay (implemented by ui-agent).

### Data Exports (`src/data/roomAtmosphere.ts`)

Two new exports support the ceremony:

```typescript
FLOOR_THEME_COLORS: Record<FloorTheme, number>
// dust: 0xCC9944, embers: 0xFF6622, ice: 0x88CCFF, arcane: 0xAA44FF, void: 0x220033

FLOOR_SUBTITLES: Record<FloorTheme, string>
// dust: 'the shallow depths', embers: 'the ember reaches', ...
```

These are consumed by `ParallaxTransition.svelte` (ui-agent) for color interpolation and the title card glow/subtitle.

### UI Side (pending ui-agent)

The following Svelte/WebGL changes are flagged for ui-agent:
- `ParallaxTransition.svelte` — `isFloorDescent` prop, vertical bob 2×, color temp interpolation
- Floor title card — "Floor N" overlay with theme subtitle, fade-in at T+1200ms
- Listen for `rr:floor-descent` event to activate descent mode

### Boss Floor Variant

Boss floors (floors 3, 6, 9, 12, 15, 18, 21, 24 — from `SEGMENT_BOSS_FLOORS`) use a 4000ms transition duration on the Svelte side and a T+3800ms rumble on the Phaser side. `run.floor.isBossFloor` is read after `advanceFloor()` to detect boss floors.


## Character Level & Steam Achievements

Character level is derived from cumulative XP earned across runs. XP is awarded at run end via `awardRunXP()` in `src/ui/stores/playerData.ts`.

Steam achievements fire at the following level milestones:

| Level | Achievement ID | Name |
|-------|---------------|------|
| 5 | `LEVEL_5` | Novice |
| 15 | `LEVEL_15` | Adept |
| 25 | `LEVEL_25` | Grand Scholar |

Level achievements trigger only when `xpResult.levelsGained > 0` (i.e., when a level-up actually occurs in that run), so they fire at the moment the milestone is first crossed. Steam ignores re-unlock attempts.

New players start at `characterLevel: 1` (set in `createNewPlayer()` in `saveService.ts`). The migration fallback for saves that pre-date character progression sets level to 25 to avoid penalising existing players.

See `docs/deployment/steam.md` for the full achievement list and wiring details.
