# Save Format

This project persists two save domains:

1. Full player profile save (`PlayerSave`)
2. In-run checkpoint save (`RunSaveState`) — saved after every encounter

Source files:

- `src/data/types.ts`
- `src/services/saveService.ts`
- `src/services/profileService.ts`
- `src/data/saveState.ts`
- `src/services/runSaveService.ts`

## Storage keys

### Full player save key

Resolved by `profileService.getSaveKey()` in `src/services/profileService.ts`:

- active profile: `terra_save_<profileId>`
- no profile fallback: `terra_save`

Note: `src/services/saveService.ts` still exports `SAVE_KEY = 'recall-rogue-save'` as a legacy constant, but active save/read path uses `getActiveSaveKey()` -> `profileService.getSaveKey()`.

## Version fields

| Domain | Version field | Current constant |
| --- | --- | --- |
| Full player save | `PlayerSave.version` | `SAVE_VERSION = 1` (`saveService.ts`) |

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
| `minerals` | `Record<MineralTier, number>` | In-game currency tiers (dust → essence) |
| `learnedFacts` | `string[]` | Learned fact IDs |
| `reviewStates` | `ReviewState[]` | SM-2 schedule state |
| `soldFacts` | `string[]` | Removed/sold fact IDs |
| `stats` | `PlayerStats` | Lifetime gameplay counters |

`PlayerStats` key fields: `totalDivesCompleted` (maps to run count), `bestFloor`, `totalFactsLearned`, `totalQuizCorrect`, `totalQuizWrong`, `currentStreak`, `bestStreak`.

Progression/feature state (persisted by default path):

| Area | Key fields |
| --- | --- |
| Cosmetics/deals | `ownedCosmetics`, `equippedCosmetic`, `purchasedDeals`, `lastDealDate` |
| Hub state | `hubState` (unlocked floor IDs, active wallpapers, floor tiers) |
| Knowledge economy | `knowledgePoints`, `purchasedKnowledgeItems` |
| Streak system | `lastPlayDate`, `streakFreezes`, `claimedMilestones`, `activeTitle` |
| Personalization | `interestConfig`, `behavioralSignals`, `archetypeData`, `engagementData` |
| Onboarding | `tutorialComplete`, `selectedInterests`, `interestWeights`, `runCount`, `tutorialStep` |
| Artifact Analyzer | `pendingArtifacts`, `lastStudySessionTimestamps`, `upgradeTokens`, `hasSeenStudyNudge` |

Optional/late-phase extension fields are also part of `PlayerSave` (social, monetization, prestige, referral, sparks, etc.) and are represented as optional (`?`) keys in `src/data/types.ts`.

## Save and load behavior

### Full save path (`saveService`)

- `save(data)` writes JSON to active full-save key.
- `load()` returns `null` if key missing or JSON parse fails.
- `createNewPlayer(ageRating)` constructs a full default `PlayerSave`.
- `deleteSave()` removes only active full-save key.

### In-run checkpoint (`runSaveService`)

- Checkpoint written after every combat encounter.
- Stores current run state: deck, hand, enemy, floor, relic IDs, act map position.
- On resume, `runManager.ts` loads this checkpoint and restores the run.

## Migration behavior in `saveService.load()`

`load()` applies additive, in-place compatibility fixes before returning `PlayerSave`.

Current migrations/defaulting include:

| Area | Behavior |
| --- | --- |
| Missing core collections | Initializes arrays/maps like `craftedItems`, `activeConsumables`, `unlockedDiscs`, `premiumMaterials` |
| Missing daily/streak fields | Initializes `purchasedDeals`, `lastDealDate`, `streak*`, `titles`, `activeTitle` |
| Date rollovers | Clears stale `purchasedDeals` if `lastDealDate` is not today |
| Hub state bootstrap | Adds `hubState` via `defaultHubSaveState()` when absent |
| Room/floor migration | Converts legacy room unlocks to `hubState.unlockedFloorIds`; renames floor IDs (`museum`->`collection`, `archive`->`research`) |
| Personalization fields | Adds `interestConfig`, `behavioralSignals`, `archetypeData`, `engagementData` defaults |
| Tutorial/addictiveness fields | Adds onboarding counters, login calendar, grace/streak support fields |
| Monetization/prestige/gallery/analyzer | Adds newly introduced optional arrays/numbers (`unlockedPaintings`, `prestigeLevel`, `pendingArtifacts`, etc.) |

There is no external migration framework; compatibility is code-based inside `load()`.

## Related split-doc helpers

`src/services/saveSubDocs.ts` can split/merge a `PlayerSave` into five logical docs (`core`, `knowledge`, `inventory`, `dome`, `analytics`) for sync optimization. The primary local persistence path remains single-key JSON in `saveService`.
