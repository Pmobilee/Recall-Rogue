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
| Active run checkpoint | `RunSaveState.version` | `CURRENT_RUN_SAVE_VERSION = 1` (`runSaveService.ts`) — exact-match guard rejects mismatches |

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

V3 additions: `totalVictories`, `totalDefeats`, `totalRetreats`, `totalAbandons` (per-result run counters); `cumulativePlaytimeMs` (sum of all `runDurationMs`); `totalEnemiesDefeated`, `totalElitesDefeated`, `totalBossesDefeated` (enemy kill totals); `lifetimeFactsMastered` (facts that first reached tier 3 across all runs). All default to `0`. `totalAbandons` tracks runs where the player deliberately quit via the abandon flow — logged in journal with distinct `abandon` result type.

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

- `save(data)` writes JSON via `getBackend().write()`. Before writing, it calls `snapshotUserSettings()` to capture all user-facing localStorage keys into `userSettingsSnapshot`, ensuring the save file carries the full user experience for Steam Cloud sync.
- `load()` reads via `getBackend().readSync()`; returns `null` if key missing or JSON parse fails. On a save that already has a `userSettingsSnapshot`, it calls `restoreUserSettings()` to write the snapshot back to localStorage (useful after a Steam Cloud restore). On a save without one (old save), it calls `snapshotUserSettings()` to capture the current state into the field.
- `createNewPlayer(ageRating)` constructs a full default `PlayerSave`.
- `deleteSave()` removes the active full-save key via `getBackend().remove()` AND calls `clearUserSettings()` to remove all known user-facing localStorage keys, so a save reset leaves no orphaned settings.

All reads/writes route through `storageBackend` — `LocalStorageBackend` on web/mobile,
`FileStorageBackend` on desktop (Tauri). The file backend uses a write-through in-memory
cache populated by `initStorageBackend()` at startup, so `load()` / `save()` remain
synchronous on all platforms.

### In-run checkpoint (`runSaveService`)

- Checkpoint written after every combat encounter.
- Stores current run state: deck, hand, enemy, floor, relic IDs, act map position.
- On resume, `runManager.ts` loads this checkpoint and restores the run.
- On resume, `CardApp.handleResumeActiveRun` calls `restoreRunRngState(saved.rngState)` (from `seededRng.ts`) before setting `activeRunState`, ensuring all deterministic RNG forks (enemyPool, enemyVariance, facts, quiz, etc.) are restored to their saved positions. Added 2026-04-10.

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

## Chess Tactics Elo (2026-04-10)

Two optional fields added to `PlayerSave`:

| Field | Type | Purpose |
|-------|------|---------|
| `chessEloRating` | `number?` | Current tactical Elo (defaults to `CHESS_ELO_START = 1000` at runtime) |
| `chessEloHistory` | `Array<{rating,puzzleRating,correct,timestamp}>?` | Last 100 rating changes for chart display |

No save migration required — both are optional with runtime defaults. See `src/services/chessEloService.ts`.

## CardRunState Set fields in encounterSnapshot (CRITICAL-3, 2026-04-12)

`encounterSnapshot.activeDeck` is a `CardRunState` object that is serialized as a plain
JSON spread in `saveActiveRun`. Unlike `RunState`, it does NOT go through `serializeRunState`
(which has the safe destructure-then-rest pattern). This means any `Set` or `Map` field
on `CardRunState` requires explicit manual serialization.

**Currently affected field:**

| Field | Type | Serialization | Rehydration |
|-------|------|---------------|-------------|
| `currentEncounterSeenFacts` | `Set<string>` | `serializeActiveDeckSets()` → `string[]` | `rehydrateActiveDeckSets()` → `new Set(array)` |

**How it works:**

- `serializeActiveDeckSets(deck: CardRunState)` — called in `saveActiveRun` before the
  snapshot hits `JSON.stringify`. Converts the Set to an array via `Array.from()`.
- `rehydrateActiveDeckSets(deck: Record<string, unknown>)` — called in `loadActiveRun`
  after `migrateExhaustPileToForgetPile`. Re-wraps the field:
  - `string[]` (new saves) → `new Set(array)`
  - `{}` (legacy saves before the fix) → `new Set()`
  - `undefined` (encounter not yet started) → left as-is

**Adding new Set/Map fields to CardRunState:** extend both `serializeActiveDeckSets` and
`rehydrateActiveDeckSets` in `src/services/runSaveService.ts`. The lint script
`scripts/lint/check-set-map-rehydration.mjs` (checks 4a–4d) will fail if either helper
is removed or no longer references `currentEncounterSeenFacts`.

**Why the defensive wrap in deckManager.ts is still needed:** `deckManager.ts:311-313`
re-initializes `currentEncounterSeenFacts` to a new Set if it is not already a Set instance.
This guard covers draws on fresh encounters where the field is undefined. It does NOT
replace the save-layer fix because `chargePlayCard` can be called before `drawHand`
on a resumed encounter (the encounter bridge may restore the deck without triggering a draw).
Both layers must remain in place.

## Confusion Matrix Size Cap (2026-04-12)

`ConfusionMatrix` in `src/services/confusionMatrix.ts` tracks which facts the player
confuses with each other across all runs. Without a size cap this map can grow to
thousands of entries over months of play, bloating the serialized `PlayerSave`.

**Cap:** `ConfusionMatrix.MAX_ENTRIES = 5000`. After each new entry is inserted, if the
map exceeds this cap a single entry is pruned using this preference order:

1. The entry with the lowest `count` that has `lastOccurred` older than 90 days
   (`STALE_AGE_MS = 90 * 24 * 60 * 60 * 1000`). These are ancient, rarely-confused
   pairs that carry little signal.
2. If no stale entries exist, the entry with the oldest `lastOccurred` timestamp
   regardless of count.

Pruning happens synchronously on insert, not via a scheduled job. Existing entries
that are updated (not newly inserted) never trigger pruning — only net-new pairs do.

`fromJSON` does not apply the cap; the cap only enforces on live writes. This avoids
truncating historical data on load for saves that predate the cap.

## User Settings Snapshot (2026-04-15)

`PlayerSave.userSettingsSnapshot?: Record<string, string>` mirrors the subset of
localStorage that represents user-facing settings. The complete key list is
`USER_FACING_LOCALSTORAGE_KEYS` exported from `saveService.ts`.

**On write (`save()`):** `snapshotUserSettings()` reads every known user-facing key
from localStorage and writes them into `userSettingsSnapshot`. The mutation happens
on the spread copy, never the original `data` object.

**On load (`load()`):** If `userSettingsSnapshot` is present and non-empty,
`restoreUserSettings()` pushes each key back to localStorage. This is the critical
path for Steam Cloud restores — player imports a save from another machine and their
settings (volume, locale, accessibility flags, etc.) come along automatically.
If the snapshot is absent (old saves), `snapshotUserSettings()` captures the current
state so the field is populated from the next `save()` call onward.

**On delete (`deleteSave()`):** `clearUserSettings()` iterates `USER_FACING_LOCALSTORAGE_KEYS`
and removes each one. This ensures a full save wipe leaves no orphaned settings.

Helper functions: `snapshotUserSettings()`, `restoreUserSettings(snapshot)`,
`clearUserSettings()` — all exported from `src/services/saveService.ts`.

Keys intentionally NOT included: analytics queues, auth tokens, migration flags, caches,
dev tools, offline retry queues — ephemeral/internal state that should not survive
a restore.
