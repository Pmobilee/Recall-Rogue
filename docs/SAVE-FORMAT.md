# Save Format

This project persists two save domains:

1. full player profile save (`PlayerSave`)
2. mid-dive checkpoint save (`DiveSaveState`)

Source files:

- `src/data/types.ts`
- `src/services/saveService.ts`
- `src/services/profileService.ts`
- `src/data/saveState.ts`
- `src/game/managers/SaveManager.ts`

## Storage keys

### Full player save key

Resolved by `profileService.getSaveKey()` in `src/services/profileService.ts`:

- active profile: `terra_save_<profileId>`
- no profile fallback: `terra_save`

Note: `src/services/saveService.ts` still exports `SAVE_KEY = 'recall-rogue-save'` as a legacy constant, but active save/read path uses `getActiveSaveKey()` -> `profileService.getSaveKey()`.

### Mid-dive save key

Defined in `src/data/saveState.ts`:

- `DIVE_SAVE_KEY = 'terra_miner_dive_save'`

## Version fields

| Domain | Version field | Current constant |
| --- | --- | --- |
| Full player save | `PlayerSave.version` | `SAVE_VERSION = 1` (`saveService.ts`) |
| Mid-dive save | `DiveSaveState.version` | `DIVE_SAVE_VERSION = 1` (`saveState.ts`) |

`SaveManager.load()` rejects mid-dive saves with mismatched `DIVE_SAVE_VERSION` and clears them.

## Full save schema (`PlayerSave`)

Type source: `src/data/types.ts`.

Core required fields:

| Field | Type | Purpose |
| --- | --- | --- |
| `version` | `number` | Save format version |
| `factDbVersion` | `number` | Facts DB sync marker |
| `playerId` | `string` | Stable player identifier |
| `ageRating` | `'kid' | 'teen' | 'adult'` | Content filter gate |
| `createdAt`, `lastPlayedAt` | `number` | Timestamps (ms) |

Gameplay economy and learning core:

| Field group | Type | Purpose |
| --- | --- | --- |
| `oxygen` | `number` | Stored oxygen tanks |
| `minerals` | `Record<MineralTier, number>` | Dust -> essence currencies |
| `learnedFacts` | `string[]` | Learned fact IDs |
| `reviewStates` | `ReviewState[]` | SM-2 schedule state |
| `soldFacts` | `string[]` | Removed/sold fact IDs |
| `stats` | `PlayerStats` | Lifetime gameplay counters |

Progression/feature state (persisted by default path):

| Area | Key fields |
| --- | --- |
| Crafting | `craftedItems`, `craftCounts`, `activeConsumables`, `insuredDive` |
| Cosmetics/deals | `ownedCosmetics`, `equippedCosmetic`, `purchasedDeals`, `lastDealDate` |
| Fossils/farm/hub | `fossils`, `activeCompanion`, `farm`, `unlockedRooms`, `hubState` |
| Knowledge economy | `knowledgePoints`, `purchasedKnowledgeItems` |
| Streak system | `lastDiveDate`, `streakFreezes`, `claimedMilestones`, `activeTitle` |
| Personalization | `interestConfig`, `behavioralSignals`, `archetypeData`, `engagementData` |
| Onboarding | `tutorialComplete`, `selectedInterests`, `interestWeights`, `diveCount`, `tutorialStep` |
| Artifact Analyzer | `pendingArtifacts`, `lastStudySessionTimestamps`, `upgradeTokens`, `hasSeenStudyNudge` |

Optional/late-phase extension fields are also part of `PlayerSave` (social, monetization, prestige, companion advanced systems, referral, sparks, etc.) and are represented as optional (`?`) keys in `src/data/types.ts`.

## Mid-dive schema (`DiveSaveState`)

Type source: `src/data/saveState.ts`.

| Field | Type | Purpose |
| --- | --- | --- |
| `version`, `savedAt` | `number`, `string` | Checkpoint schema/version and timestamp |
| `mineGrid` | `string[][]` | Serialized mine grid snapshot |
| `playerPos` | `{ x, y }` | Grid position |
| `inventorySnapshot` | `Array<{ type, count }>` | In-run inventory compact view |
| `ticks`, `layer`, `biomeId` | scalar | Run progression cursor |
| `o2`, `diveSeed` | scalar | Oxygen and deterministic seed |
| `relicIds`, `consumables` | arrays | Active run modifiers |
| `bankedMinerals` | `Record<string, number>` | Send-up secured minerals |
| `sameLayerDeathCount`, `lastDeathLayer` | `number` | Auto-balance state |
| `layerChecksums?` | `number[]` | Determinism verification per layer |

## Save and load behavior

### Full save path (`saveService`)

- `save(data)` writes JSON to active full-save key.
- `load()` returns `null` if key missing or JSON parse fails.
- `createNewPlayer(ageRating)` constructs a full default `PlayerSave`.
- `deleteSave()` removes only active full-save key.

### Mid-dive path (`SaveManager`)

- `SaveManager.save(state)` writes checkpoint JSON (injects `version` and `savedAt`).
- `SaveManager.load()` validates version and parses.
- `SaveManager.clear()` removes mid-dive key.
- `SaveManager.hasSave()` checks checkpoint existence.

## Migration behavior in `saveService.load()`

`load()` applies additive, in-place compatibility fixes before returning `PlayerSave`.

Current migrations/defaulting include:

| Area | Behavior |
| --- | --- |
| Mineral rename | Migrates legacy `coreFragment` -> `geode`, `primordialEssence` -> `essence` |
| Missing core collections | Initializes arrays/maps like `craftedItems`, `activeConsumables`, `unlockedDiscs`, `premiumMaterials` |
| Missing daily/streak fields | Initializes `purchasedDeals`, `lastDealDate`, `streak*`, `titles`, `activeTitle` |
| Date rollovers | Clears stale `purchasedDeals` if `lastDealDate` is not today |
| Hub state bootstrap | Adds `hubState` via `defaultHubSaveState()` when absent |
| Room/floor migration | Converts legacy room unlocks to `hubState.unlockedFloorIds`; renames floor IDs (`museum`->`collection`, `archive`->`research`) |
| Personalization fields | Adds `interestConfig`, `behavioralSignals`, `archetypeData`, `engagementData` defaults |
| Tutorial/addictiveness fields | Adds onboarding counters, login calendar, grace/streak support fields |
| Owned pickaxes | Defaults `ownedPickaxes` to `['standard_pick']` |
| Monetization/prestige/gallery/analyzer | Adds newly introduced optional arrays/numbers (`unlockedPaintings`, `prestigeLevel`, `pendingArtifacts`, etc.) |

There is no external migration framework; compatibility is code-based inside `load()`.

## Related split-doc helpers

`src/services/saveSubDocs.ts` can split/merge a `PlayerSave` into five logical docs (`core`, `knowledge`, `inventory`, `dome`, `analytics`) for sync optimization. The primary local persistence path remains single-key JSON in `saveService`.
