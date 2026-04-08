# Save Format

This project persists two save domains:

1. Full player profile save (`PlayerSave`)
2. In-run checkpoint save (`RunSaveState`) — saved after every encounter

Source files:

- `src/data/types.ts`
- `src/services/storageBackend.ts` (storage abstraction layer)
- `src/services/saveService.ts`
- `src/services/saveMigration.ts` — versioned migration functions (V1→V2 relic catalogue)
- `src/services/profileService.ts`
- `src/data/saveState.ts`
- `src/services/runSaveService.ts`
- `src-tauri/src/filesave.rs` — Rust/Tauri file I/O layer (Steam Cloud compatible)

## Storage backends

### Current (localStorage)

`saveService.ts` and `runSaveService.ts` read/write via `localStorage`. Keys are
resolved through `profileService.getSaveKey()`.

### File I/O layer (Tauri — `src-tauri/src/filesave.rs`)

Four Tauri IPC commands provide atomic file-based persistence for the Steam build.
The TypeScript frontend calls these via `invoke()` from `@tauri-apps/api/core`.

| Command | Signature | Description |
| --- | --- | --- |
| `fs_get_save_dir` | `() -> Result<String>` | Returns (and creates) the platform save directory path |
| `fs_write_save` | `(filename, data) -> Result<()>` | Atomic write: writes `.tmp` then renames into place |
| `fs_read_save` | `(filename) -> Result<Option<String>>` | Reads file; returns `null`/`None` if not found |
| `fs_delete_save` | `(filename) -> Result<()>` | Deletes file; no-op if not found |

**Save directory paths** (resolved by Tauri's `app_data_dir()`):

| Platform | Path |
| --- | --- |
| macOS | `~/Library/Application Support/com.bramblegategames.recallrogue/saves/` |
| Windows | `%APPDATA%\com.bramblegategames.recallrogue\saves\` |
| Linux | `~/.local/share/com.bramblegategames.recallrogue/saves/` |

**Filename security**: all four commands reject filenames containing `..`, `/`, `\`,
or any character outside `[a-zA-Z0-9_\-.]`. This prevents path traversal attacks.

**Atomic write**: `fs_write_save` writes to `<filename>.tmp` then renames to
`<filename>`. If the process is killed mid-write the old file remains intact.

## Storage keys

### Full player save key

Resolved by `profileService.getSaveKey()` in `src/services/profileService.ts`:

- active profile: `rr_save_<profileId>`
- no profile fallback: `rr_save`

Note: `src/services/saveService.ts` still exports `SAVE_KEY = 'recall-rogue-save'` as a legacy constant, but active save/read path uses `getActiveSaveKey()` -> `profileService.getSaveKey()`.

## Version fields

| Domain | Version field | Current constant |
| --- | --- | --- |
| Full player save | `PlayerSave.version` | `SAVE_VERSION = 3` (`saveService.ts`) |

## Save version history

| Version | What changed |
| --- | --- |
| 1 | Original schema — 50-relic catalogue |
| 2 | Relic catalogue replacement: 50 relics → 42 relics. IDs renamed, merged, refunded, or dropped. Migration function: `migrateRelicsV1toV2()` in `saveMigration.ts`. |
| 3 | Journal/Profile overhaul: added `runHistory: RunSummary[]` (cap 50), `lifetimeEnemyKillCounts: Record<string,number>` to `PlayerSave`; added `totalVictories`, `totalDefeats`, `totalRetreats`, `cumulativePlaytimeMs`, `totalEnemiesDefeated`, `totalElitesDefeated`, `totalBossesDefeated`, `lifetimeFactsMastered` to `PlayerStats`. Migration function: `migrateV2toV3()` in `saveMigration.ts`. |

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

V3 additions: `totalVictories`, `totalDefeats`, `totalRetreats` (per-result run counters); `cumulativePlaytimeMs` (sum of all `runDurationMs`); `totalEnemiesDefeated`, `totalElitesDefeated`, `totalBossesDefeated` (enemy kill totals); `lifetimeFactsMastered` (facts that first reached tier 3 across all runs). All default to `0`.

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

| Field | Type | Purpose |
| --- | --- | --- |
| `personalDecks` | `PersonalDeck[]` | Player-imported Anki decks and manually created decks. Type defined in `src/data/curatedDeckTypes.ts`. Registered into the in-memory deck store at startup via `personalDeckStore.registerPersonalDecks()`. |
| `runHistory` | `RunSummary[]` | Ordered run history, newest first. Capped at 50 entries. Populated by `recordRunComplete()` in `playerData.ts`. `RunSummary` type defined in `src/data/types.ts`. |
| `lifetimeEnemyKillCounts` | `Record<string, number>` | Bestiary: enemy template ID → lifetime kill count. Merged from `RunSummary.enemiesDefeatedList` on each run end. |

## Save and load behavior

### Full save path (`saveService`)

- `save(data)` writes JSON via `getBackend().write()`.
- `load()` reads via `getBackend().readSync()`; returns `null` if key missing or JSON parse fails.
- `createNewPlayer(ageRating)` constructs a full default `PlayerSave`.
- `deleteSave()` removes only active full-save key via `getBackend().remove()`.

All reads/writes route through `storageBackend` — `LocalStorageBackend` on web/mobile,
`FileStorageBackend` on desktop (Tauri). The file backend uses a write-through in-memory
cache populated by `initStorageBackend()` at startup, so `load()` / `save()` remain
synchronous on all platforms.

### In-run checkpoint (`runSaveService`)

- Checkpoint written after every combat encounter.
- Stores current run state: deck, hand, enemy, floor, relic IDs, act map position.
- On resume, `runManager.ts` loads this checkpoint and restores the run.

## Migration behavior in `saveService.load()`

`load()` applies additive, in-place compatibility fixes before returning `PlayerSave`.
Versioned structural migrations use `needsRelicMigrationV1toV2()` / `migrateRelicsV1toV2()`
from `saveMigration.ts` and immediately re-persist the save after migration so it only
runs once.

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
| V1 → V2 relic catalogue | Renames/refunds/drops v1 relic IDs via `migrateRelicsV1toV2()`; saves are immediately re-persisted after migration so it only runs once. Triggered when `save.version < 2` or `version` is absent. |
| V2 → V3 Journal/Profile | Initializes `runHistory: []`, `lifetimeEnemyKillCounts: {}`, and all new `PlayerStats` counters to `0` via `migrateV2toV3()` in `saveMigration.ts`. Triggered when `save.version < 3`. Re-persists immediately after migration. |

There is no external migration framework; compatibility is code-based inside `load()`.

## Related split-doc helpers

`src/services/saveSubDocs.ts` can split/merge a `PlayerSave` into five logical docs (`core`, `knowledge`, `inventory`, `dome`, `analytics`) for sync optimization. The primary local persistence path remains single-key JSON in `saveService`.
