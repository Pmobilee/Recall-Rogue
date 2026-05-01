# Run Lifecycle Services

> **Purpose:** Run creation/management, floor/map generation, enemy spawning, reward generation, shop, ascension, and run-scoped utilities.
> **Last verified:** 2026-04-12
> **Source files:** runManager.ts, floorManager.ts, mapGenerator.ts, enemyManager.ts (see also combat.md), shopService.ts, ascension.ts, relicAcquisitionService.ts, rewardGenerator.ts, encounterRewards.ts, rewardRoomBridge.ts, rewardSpawnService.ts, gameFlowController.ts, screenController.ts, runStateStore.ts, hubState.ts, runSaveService.ts (see persistence.md), runEarlyBoostController.ts, deterministicRandom.ts, seededRng.ts, randomUtils.ts

> See also: [run-competitive.md](run-competitive.md) for bountyManager, canaryService, masteryChallengeService, dailyExpeditionService, endlessDepthsService, scholarChallengeService, characterLevel, loreService, cardPreferences, funnessBoost

## Overview

Run lifecycle starts in `gameFlowController` (screen state machine) and `runManager` (RunState creation). `floorManager` generates room options and boss scheduling; `mapGenerator` produces the Slay the Spire-style act map. `seededRng` provides forked deterministic streams so every subsystem (deck, rewards, enemies, shop) is reproducible from a single seed.

---

## runManager

| | |
|---|---|
| **File** | src/services/runManager.ts |
| **Purpose** | Run lifecycle — creates RunState, tracks HP, floor progression, bounties, canary state, and run-end data. Also computes FSRS tier deltas for Journal/Profile stats at run end. |
| **Key exports** | `createRunState`, `endRun`, `healPlayer`, `recordCardPlay`, `RunState` (interface), `RunEndData` (interface) |
| **Key dependencies** | floorManager, ascension, masteryScalingService, bountyManager, canaryService, cardPreferences, tierDerivation |

### RunState — Journal/Profile tracking fields (v3)

Added in v3 to enable per-run knowledge delta tracking. All in-memory only — not persisted to `runSaveService`.

| Field | Type | Notes |
|---|---|---|
| `reviewStateSnapshot` | `Map<factId, {cardState, stability, tier}>` | Snapshot of FSRS state at run start. Built by `gameFlowController.onArchetypeSelected()`. |
| `firstTimeFactIds` | `Set<string>` | Fact IDs with no snapshot entry (never seen before). Populated by `recordCardPlay()`. |
| `tierAdvancedFactIds` | `Set<string>` | Fact IDs that advanced at least one tier during the run. Populated by `endRun()`. |
| `masteredThisRunFactIds` | `Set<string>` | Fact IDs that reached tier 3 for the first time this run. Populated by `endRun()`. |
| `runDeckId` | `string?` | Curated deck ID (for Journal history display). Set in `gameFlowController`. |
| `runDeckLabel` | `string?` | Human-readable deck label. Set in `gameFlowController`. |

### RunEndData — new fields (v3)

`endRun()` now computes real knowledge deltas instead of returning hardcoded zeros.

| Field | Notes |
|---|---|
| `newFactsSeen` | `firstTimeFactIds.size` — facts never encountered before this run. |
| `factsReviewed` | Facts answered that had a snapshot entry (known facts). |
| `factsMasteredThisRun` | Facts that went from non-tier-3 to tier-3 during this run. |
| `factsTierAdvanced` | Any tier-up during the run (superset of `factsMasteredThisRun`). |
| `enemiesDefeatedList` | `defeatedEnemyIds` passed through (previously hardcoded empty). |
| `domainAccuracy` | Per-domain answer accuracy breakdown from `state.domainAccuracy`. |
| `deckId`, `deckLabel` | Curated deck context for Journal history. |

## floorManager

| | |
|---|---|
| **File** | src/services/floorManager.ts |
| **Purpose** | Floor/encounter progression, room option generation, boss scheduling, and mystery event selection |
| **Key exports** | `createFloorState`, `generateRoomOptions`, `generateMysteryEvent`, `advanceEncounter`, `advanceFloor`, `isBossFloor`, `isMiniBossEncounter`, `getBossForFloor`, `getMiniBossForFloor`, `pickCombatEnemy`, `getRegionForFloor`, `getActForFloor`, `FloorState` (interface), `RoomOption` (interface) |
| **Key dependencies** | seededRng, enemies.ts, balance.ts |

## mapGenerator

| | |
|---|---|
| **File** | src/services/mapGenerator.ts |
| **Purpose** | Slay the Spire-style dungeon map generator — 15-row branching act maps with non-crossing edges. Deterministic via standalone mulberry32 PRNG. |
| **Key exports** | `generateActMap`, `getMapConfig`, `ActMap` (interface), `MapNode` (interface) |
| **Key dependencies** | floorManager (for enemy type hints), balance.ts (MAP_CONFIG) |

## gameFlowController

| | |
|---|---|
| **File** | src/services/gameFlowController.ts |
| **Purpose** | Screen routing state machine — drives all transitions between hub, combat, reward, shop, rest, mystery, and run-end screens |
| **Key exports** | `startNewRun`, `handleCombatVictory`, `handlePlayerDeath`, `handleRoomChoice`, `handleCardRewardChoice`, `handleRelicChoice`, `handleShopAction`, `handleMysteryChoice`, `handleRestAction`, `forceProceedAfterReward` (softlock escape — see bug 2026-05-01) |
| **Key dependencies** | runManager, floorManager, encounterBridge, rewardGenerator, relicAcquisitionService, shopService, deckManager, gameState store |

### Run termination contract (MEDIUM-10, 2026-04-10)

`finishRunAndReturnToHub()` is the single convergence point for all run-ending events. It MUST:
1. Call `endRun(run, reason)` to build `RunEndData`
2. Set `activeRunEndData` so `RunEndScreen` has data to display
3. Set `currentScreen` to `'runEnd'` — **never directly to `'hub'`**

The `returnToMenu()` and `playAgain()` exports handle the `runEnd → hub` transition when the player clicks a button in `RunEndScreen`.

Functions that legitimately bypass `finishRunAndReturnToHub` (and jump direct to hub):
- `abandonActiveRun(returnScreen?: Screen)` — emergency dev abandon, no run summary; navigates to `returnScreen` (defaults to `hub`)
- `returnToHubFromCampfire()` — campfire exit preserves the run state for resume

See `docs/mechanics/combat.md` §"Run Termination State Machine" for the full flow diagram.

## shopService

| | |
|---|---|
| **File** | src/services/shopService.ts |
| **Purpose** | Shop inventory generation — card buy/sell, relic stock, food items, removal/transform pricing |
| **Key exports** | `generateShopInventory`, `getRemovalPrice`, `getTransformPrice`, `ShopRelicItem` (interface), `ShopCardItem` (interface), `ShopFoodItem` (interface) |
| **Key dependencies** | relicAcquisitionService, randomUtils, balance.ts |

## ascension

| | |
|---|---|
| **File** | src/services/ascension.ts |
| **Purpose** | 20-level ascension system — rule definitions, modifier derivation, enemy HP/damage scaling per level |
| **Key exports** | `ASCENSION_LEVEL_RULES`, `getAscensionModifiers`, `applyAscensionToEnemy`, `MAX_ASCENSION_LEVEL`, `AscensionModifiers` (interface) |
| **Key dependencies** | None (pure data + balance constants) |

## relicAcquisitionService

| | |
|---|---|
| **File** | src/services/relicAcquisitionService.ts |
| **Purpose** | Filters eligible relic pool by player level and exclusions; selects boss/regular relic drops with rarity weighting |
| **Key exports** | `getEligibleRelicPool`, `selectRelicDrop`, `selectBossRelicChoices` |
| **Key dependencies** | relics/index.ts, balance.ts |

## rewardGenerator

| | |
|---|---|
| **File** | src/services/rewardGenerator.ts |
| **Purpose** | Generates archetype-weighted card reward choices from the run pool; handles upgrade chance by floor |
| **Key exports** | `generateCardRewardOptionsByType`, `rerollRewardCardInType` |
| **Key dependencies** | cardUpgradeService, seededRng, balance.ts |

## encounterRewards

| | |
|---|---|
| **File** | src/services/encounterRewards.ts |
| **Purpose** | Legacy card reward generation from raw Fact pool (pre-curated deck system); also generates currency rewards |
| **Key exports** | `generateCardRewards`, `generateCurrencyReward`, `EncounterRewardOptions` (interface) |
| **Key dependencies** | cardFactory |

## rewardRoomBridge

| | |
|---|---|
| **File** | src/services/rewardRoomBridge.ts |
| **Purpose** | Bridges gameFlowController to the Phaser RewardRoomScene — handles scene lifecycle, card detail overlay, and turbo-aware delays |
| **Key exports** | `openRewardRoom`, `openTestRewardRoom`, `rewardCardDetail` (store), `getCardDetailCallbacks`, `triggerRewardRoomContinue` |
| **Key dependencies** | rewardSpawnService, gameState store, turboMode |
| **Turbo awareness** | All internal delays use `turboDelay()` — poll interval (50ms→5ms), Phaser boot wait (500ms→5ms), container visibility wait (100ms→5ms). `maxWaitMs = 3000` is kept constant so Phaser still gets enough game loop ticks regardless of turbo mode. |
| **Softlock escape** | `triggerRewardRoomContinue()` falls back to `gameFlowController.forceProceedAfterReward()` (lazy import) when the scene is inactive. Listeners now attach to the scene instance as soon as it exists (~50ms after `startRewardRoom()`), before `create()` finishes, eliminating the listener-race path. See bug 2026-05-01. |

## rewardSpawnService

| | |
|---|---|
| **File** | src/services/rewardSpawnService.ts |
| **Purpose** | Loads pre-computed cloth spawn zone data for reward room item layout positions |
| **Key exports** | `initRewardSpawnService`, `getSpawnPoints`, `ClothSpawnData` (interface) |
| **Key dependencies** | None (fetch + in-memory cache) |

## runStateStore

| | |
|---|---|
| **File** | src/services/runStateStore.ts |
| **Purpose** | Shared Svelte store for the active RunState; separated to avoid circular dependencies between game-flow and encounter systems |
| **Key exports** | `activeRunState` (Svelte writable store) |
| **Key dependencies** | Svelte stores |

## hubState

| | |
|---|---|
| **File** | src/services/hubState.ts |
| **Purpose** | Persists last-run summary to localStorage and provides reactive stores for hub screen state |
| **Key exports** | `lastRunSummary` (store), `saveRunSummary`, `RunSummary` (interface) |
| **Key dependencies** | Svelte stores, localStorage |

**v3 change:** `RunSummary` type moved to `src/data/types.ts` (was defined inline in `hubState.ts`). `captureRunSummary()` now threads all knowledge delta fields from `RunEndData` instead of hardcoding zeros. `hubState.ts` re-exports `RunSummary` for backward compatibility.

## screenController

| | |
|---|---|
| **File** | src/services/screenController.ts |
| **Purpose** | Screen classification helpers — identifies run-locked vs hub screens; normalizes legacy screen names |
| **Key exports** | `normalizeHomeScreen`, `isRunLockedScreen`, `isHubScreen`, `HubScreenName` (type) |
| **Key dependencies** | gameState store types |

## runEarlyBoostController

| | |
|---|---|
| **File** | src/services/runEarlyBoostController.ts |
| **Purpose** | Early-run stability bonus for new domain exploration (runs 1–3 get a small FSRS stability boost) |
| **Key exports** | `isEarlyBoostActiveForDomain`, `getRunNumberForDomain`, `incrementDomainRunCount`, `applyStabilityBonusToFacts` |
| **Key dependencies** | None (pure logic on PlayerSave) |

## seededRng

| | |
|---|---|
| **File** | src/services/seededRng.ts |
| **Purpose** | Deterministic forked RNG streams — each subsystem (deck/rewards/enemies/shop) gets its own mulberry32 stream derived from the run seed |
| **Key exports** | `initRunRng`, `getRunRng`, `isRunRngActive`, `seededShuffled`, `serializeRunRngState`, `SeededRng` (interface) |
| **Key dependencies** | None |

## deterministicRandom

| | |
|---|---|
| **File** | src/services/deterministicRandom.ts |
| **Purpose** | Swaps `Math.random` globally for fixed-seed modes (Daily Expedition); restores original on deactivation |
| **Key exports** | `activateDeterministicRandom`, `deactivateDeterministicRandom`, `isDeterministicActive` |
| **Key dependencies** | None |

## randomUtils

| | |
|---|---|
| **File** | src/services/randomUtils.ts |
| **Purpose** | Fisher-Yates shuffle without sort-bias |
| **Key exports** | `shuffled` |
| **Key dependencies** | None |

---

### Updated 2026-04-12

Corrected `gameFlowController` key exports: `startRun` → `startNewRun` (the actual exported function name at line 392 of `gameFlowController.ts`). The old `startRun` name never existed in this service. Source: BATCH-2026-04-12-001 playtest finding H-032.
