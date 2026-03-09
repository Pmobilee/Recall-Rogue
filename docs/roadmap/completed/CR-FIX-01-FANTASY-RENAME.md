# CR-FIX-01: Fantasy Theme Rename
> Phase: P0.5 — Critical Fixes
> Priority: BLOCKER
> Depends on: None
> Estimated scope: L

The codebase retains extensive mining-themed language from the original "Terra Miner" concept. The game has been rebranded to **Arcane Recall** — a dungeon-delving card roguelite. This CR systematically replaces all mining references with fantasy/dungeon equivalents in active code, and archives all dead mining-specific files that aren't part of the active card roguelite app.

## Design Reference

From GAME_DESIGN.md — the game's current identity:

> **Setting:** Dungeon descent. Players explore floors, face encounters, choose rooms, retreat or delve deeper.
> **Player:** An adventurer/delver exploring procedurally generated dungeon depths.
> **Resources:** Gold/currency earned from encounters (not minerals/ores).
> **Progression:** Floors (1-9+) and segments (Shallow/Deep/Abyss/Endless) — not "mine layers."
> **Runs:** Called "expeditions" or "runs" — not "dives."
> **Combat:** Card-based encounters — not "mining blocks."

From ARCHITECTURE.md:

> **Active entry point:** `main.ts` → `CardApp.svelte` → card roguelite UI + `CardGameManager.ts`
> **Dead code on disk:** `App.svelte`, `GameManager.ts`, and 100+ mining-specific files that are NOT imported by the active app. These are tree-shaken out of the build but clutter the codebase.

## Implementation

### Step 1: Trace Active Import Tree

Before touching any files, trace the import graph starting from `src/main.ts`:

```
main.ts → CardApp.svelte → {gameFlowController, encounterBridge, card-types, floorManager, runManager, ...}
main.ts → CardGameManager.ts → {CombatScene, BootScene, ...}
main.ts → playerData store, gameState store, factsDB
```

Build the complete list of files that are transitively imported. Everything NOT in this list is dead code.

**Tool:** Run `npx vite build` and examine the module graph, OR manually trace imports. The import tree should be ~40-60 files for the card roguelite.

### Step 2: Archive Dead Mining Files

Move all files that are NOT in the active import tree to `src/_archived-mining/`. This directory is already excluded from TypeScript compilation per `tsconfig.json`.

**Known dead files to archive** (confirm each is NOT imported before moving):

| Category | Files |
|----------|-------|
| Old entry point | `src/App.svelte` |
| Old game manager | `src/game/GameManager.ts`, `src/game/GameEventBridge.ts`, `src/game/gameManagerRef.ts` |
| Old scenes | `src/game/scenes/MineScene.ts`, `src/game/scenes/DomeScene.ts`, `src/game/scenes/MineBlockInteractor.ts` |
| Old systems | `src/game/systems/MineGenerator.ts`, `src/game/systems/OxygenSystem.ts`, `src/game/systems/ImpactSystem.ts`, `src/game/systems/BlockAnimSystem.ts`, `src/game/systems/SeedVerifier.ts`, `src/game/systems/HazardSystem.ts`, `src/game/systems/InstabilitySystem.ts`, `src/game/systems/LootPopSystem.ts`, `src/game/systems/CreatureSpawner.ts`, `src/game/systems/BiomeGlowSystem.ts`, `src/game/systems/ScreenShakeSystem.ts`, `src/game/systems/QuizStreakSystem.ts`, `src/game/systems/ChallengeTracker.ts`, `src/game/systems/SessionTracker.ts`, `src/game/systems/CameraSequencer.ts`, `src/game/systems/CameraSystem.ts`, `src/game/systems/TextureAtlasLRU.ts`, `src/game/systems/AnimationSystem.ts`, `src/game/systems/TickSystem.ts` |
| Old managers | `src/game/managers/QuizManager.ts`, `src/game/managers/StudyManager.ts`, `src/game/managers/EncounterManager.ts`, `src/game/managers/CombatManager.ts`, `src/game/managers/SaveManager.ts`, `src/game/managers/GaiaManager.ts`, `src/game/managers/BiomeParticleManager.ts`, `src/game/managers/CompanionManager.ts`, `src/game/managers/InventoryManager.ts`, `src/game/managers/CelebrationManager.ts`, `src/game/managers/AchievementManager.ts` |
| Old entities | `src/game/entities/Player.ts`, `src/game/entities/Boss.ts`, `src/game/entities/Creature.ts` |
| Old UI components | `src/ui/components/MineralConverter.svelte`, `src/ui/components/MineEventOverlay.svelte`, `src/ui/components/MiniMap.svelte`, `src/ui/components/OxygenTankDisplay.svelte`, `src/ui/components/SendUpOverlay.svelte`, `src/ui/components/DivePrepScreen.svelte`, `src/ui/components/DiveResults.svelte`, `src/ui/components/HubView.svelte`, `src/ui/components/DomeView.svelte`, `src/ui/components/BaseView.svelte`, `src/ui/components/FloorCanvas.svelte`, `src/ui/components/DomeCanvas.svelte`, `src/ui/components/HUD.svelte`, `src/ui/components/BackpackOverlay.svelte`, `src/ui/components/DescentOverlay.svelte`, `src/ui/components/ArtifactGrid.svelte`, `src/ui/components/ArtifactAnalyzer.svelte`, `src/ui/components/StudyStation.svelte`, `src/ui/components/StudySession.svelte`, `src/ui/components/QuizOverlay.svelte`, `src/ui/components/GaiaToast.svelte`, `src/ui/components/GaiaThoughtBubble.svelte`, `src/ui/components/GaiaIntro.svelte`, `src/ui/components/GaiaReport.svelte`, `src/ui/components/GaiaAvatar.svelte`, plus any others NOT imported by CardApp.svelte |
| Old data files | `src/data/mineEvents.ts`, `src/data/biomeStructures.ts`, `src/data/biomes.ts`, `src/data/biomeTileSpec.ts`, `src/data/biomeAudio.ts`, `src/data/biomeParticles.ts`, `src/data/hubLayout.ts`, `src/data/hubFloors.ts`, `src/data/hubUpgrades.ts`, `src/data/domeLayout.ts`, `src/data/cavernTexts.ts`, `src/data/ambientStories.ts`, `src/data/floorBackgrounds.ts`, `src/data/paintings.ts`, `src/data/cosmetics.ts`, `src/data/consumables.ts`, `src/data/recipes.ts`, `src/data/recipeFragments.ts`, `src/data/premiumRecipes.ts`, `src/data/combatRewards.ts`, `src/data/creatures.ts`, `src/data/theDeep.ts`, `src/data/saveState.ts`, `src/data/companions.ts`, `src/data/petPersonalities.ts`, `src/data/petTraits.ts`, `src/data/petAnimations.ts`, `src/data/dustCat.ts`, `src/data/dustCatCosmetics.ts`, `src/data/farm.ts`, `src/data/fossils.ts`, `src/data/quoteStones.ts`, `src/data/branchBonuses.ts`, `src/data/knowledgeTreeStages.ts`, `src/data/dataDiscs.ts`, `src/data/artifactLootTable.ts` |
| Old services | Any service in `src/services/` NOT imported by the active app (e.g., `oxygenRegenService.ts`, `biomeCompletionService.ts`, `hubService.ts`, `mentorService.ts`, `prestigeService.ts`, `interestSpawner.ts`, `journeyMemory.ts`, etc.) |
| Old stores | `src/ui/stores/factSprites.ts`, `src/ui/stores/omniscient.ts`, `src/ui/stores/welcomeBack.ts`, `src/ui/stores/coopState.ts`, `src/ui/stores/classroomStore.ts`, `src/ui/stores/reviewForecast.ts`, `src/ui/stores/parentalStore.ts`, `src/ui/stores/authStore.ts`, `src/ui/stores/syncStore.ts`, `src/ui/stores/profileStore.ts`, `src/ui/stores/achievements.ts`, `src/ui/stores/parentalControls.ts` |
| Old tests | Any test file that tests archived systems |

**CRITICAL**: Before moving each file, verify it is NOT imported (directly or transitively) by `main.ts` or `CardApp.svelte`. If you're unsure, leave it in place — false archival breaks the build.

**Preserve directory structure**: `src/game/systems/Foo.ts` → `src/_archived-mining/systems/Foo.ts`. If a file already exists at the archive destination (duplicate), skip or overwrite with the newer version.

### Step 3: Clean Shared Infrastructure

These files ARE in the active import tree but contain mining holdovers. Clean them.

#### A. `src/ui/stores/gameState.ts`

**Remove mining-specific items from the `GameScreen` union type:**
- `'mining'`, `'tutorialMine'`, `'cavern_text'`
- Keep all card roguelite screens: `'mainMenu'`, `'domainSelect'`, `'combat'`, `'roomSelect'`, `'mysteryEvent'`, `'restStop'`, `'runEnd'`, `'onboarding'`, `'ageSelection'`, `'settings'` (and any others used by CardApp.svelte)
- For any screen type you're unsure about, grep for its usage in active files before removing

**Remove mining-specific state and stores:**
- `pickaxeId` from loadout interface and initial state
- `isLoadoutReady` derived store (or update to not reference pickaxeId)
- `blocksMined` field from MineRunState
- `blocksMinedLive` writable store
- `pickaxeTier` writable store
- `activeMineEvent` writable store
- `cavernTextModalEntry` writable store
- `biomeDisplay`, `biomeId`, `biomeCompletionStore` — check if used by card roguelite first
- Mining-related comments about "in-mine state"

**Keep all card roguelite stores and state** that were added in CR-01 through CR-08.

#### B. `src/data/balance.ts`

This file is ~820 lines of which ~700 are mining-specific constants.

**Strategy:**
1. Check which constants are actually imported by active code (grep for each constant name in the active file set)
2. Remove ALL mining-specific constants that are NOT imported by active code:
   - `OXYGEN_*` constants
   - `MINE_*` constants
   - `MINERAL_*` constants
   - `PICKAXE_*` constants
   - `CAVERN_*` / `TUNNEL_*` / `SHAFT_*` constants
   - `EMPTY_CAVERN_*` constants
   - Mining-specific event configs
   - Old streak rewards with mining names
3. Rename any remaining user-facing strings:
   - `title: 'Miner'` → `title: 'Delver'`
   - `"minerals"` → `"treasure"` / `"rewards"`
   - `"dive"` / `"dives"` → `"expedition"` / `"runs"`
   - `"mine"` → `"dungeon"`
   - `skin_miner_envoy` → `skin_delver_envoy`
4. Keep card roguelite balance constants (added in CR-01 through CR-08)

#### C. `src/data/types.ts`

- Remove `MineralTier` type if no active code uses it
- Remove mining-specific fields from interfaces (e.g., `mineralType`, `mineralAmount`, `mineralTier` in InventorySlot)
- Remove any mining-specific interfaces entirely if unused
- Keep card roguelite types (RunCard, CardType, etc.)

#### D. `src/main.ts`

Line 51: `if (screen === 'mining')` — Replace with the card roguelite equivalent screen check, or remove the mining-specific back button handler entirely. The card roguelite likely uses `'combat'` as its screen during gameplay.

#### E. `src/data/relics.ts`

- Change `RelicArchetype` type: `'miner'` → `'delver'`
- Update mining-themed relics:
  - `rc_tungsten_pick` / "Tungsten Pick Fragment" → fantasy weapon name (e.g., "Arcane Shard", "Runed Fragment")
  - `rc_miners_rhythm` / "Miner's Rhythm" → "Delver's Rhythm" or "Dungeon Cadence"
  - `rr_seismic_gauntlet` → can keep if it fits fantasy theme (gauntlets are fantasy-appropriate)
- Update any descriptions referencing mining

#### F. `src/data/milestoneCosmetics.ts`

- Change cosmetic type: `'pickaxe'` → `'staff'` or `'tome'` or `'wand'`
- Update descriptions: "seasoned miners" → "seasoned adventurers" / "veteran delvers"

#### G. `src/data/gaiaAvatar.ts`

- Rename `mine_entry` / `mineEntry` animation → `dungeon_entry` / `dungeonEntry`
- Update any mining-themed dialogue or state descriptions

#### H. `src/events/types.ts`

- Remove mining event types if unused by active code: `'mineral-collected'`, `'blocks-mined-update'`, `'mine-event'`
- Keep card roguelite event types

#### I. `src/data/card-types.ts`

- Line ~54: Update comment "Named CardRunState to avoid collision with the existing RunState (mine/dive)" → remove the "(mine/dive)" parenthetical since old RunState will be archived

#### J. Active UI Components — User-Facing Strings

Check each active component (imported by CardApp.svelte) for mining language:

- `src/ui/components/ComebackBonus.svelte`: "miner" → "adventurer", "mine waits" → "dungeon awaits"
- `src/ui/components/AgeSelection.svelte`: check for mining refs
- `src/ui/components/Settings.svelte`: check for mining refs
- Any other component rendered by CardApp.svelte

### Step 4: Comment Cleanup

In all active (non-archived) files, update comments that reference mining:
- "mine layer" → "dungeon floor"
- "mining" → "combat" / "exploring" / "delving"
- "minerals" → "treasure" / "rewards"
- "dive" → "expedition" / "run"
- "blocks mined" → "encounters cleared"

### Step 5: Dev Tools

Update development-facing references:
- `src/dev/debugBridge.ts`: update any mining references
- `src/dev/presets.ts`: update any mining dev presets
- `src/dev/playtestAPI.ts`: update mining references
- `src/dev/playtestDescriber.ts`: update mining references

## Rename Mapping (Reference Table)

| Mining Term | Fantasy Replacement | Context |
|---|---|---|
| mine, mining | dungeon, delving | General |
| miner | adventurer, delver | Player reference |
| mineral, MineralTier | treasure, reward (or delete) | Currency/resource |
| pickaxe | staff, tome (or delete) | Equipment |
| ore | loot, treasure | Resource |
| cavern | chamber, sanctum | Room type |
| tunnel | corridor, passage | Room type |
| shaft, descent shaft | stairway, passage | Vertical movement |
| dig, excavate | explore, delve | Action verb |
| blocks mined | encounters cleared | Game metric |
| dive | expedition, run | Run reference |
| oxygen | stamina (or delete) | Resource |
| layer | floor | Depth unit |
| biome | realm, zone (or delete) | Area type |
| dust, shard, crystal, geode, essence | Delete if unused | Old mineral tiers |

## Edge Cases

| Scenario | Expected Behavior |
|---|---|
| File imported by BOTH old and new code | Archive the old importer first, then rename in shared file |
| Balance constant used by both mining + card systems | Grep active files; if only old code uses it, remove it |
| Type exported from types.ts used only in archived files | Safe to remove — archived files excluded from typecheck |
| npm package name "terra-miner" in package.json | Do NOT rename — too disruptive for git, npm, deploy pipeline |
| Directory name `src/_archived-mining/` | Keep as-is (already established convention) |
| File already exists in `_archived-mining/` (duplicate) | Keep the version with the more recent modification date |
| Tests importing archived modules | Move tests to `src/_archived-mining/tests/` |
| False positives: "determine", "examine", "undermine", "combined" | Do NOT rename — these contain "mine" as substring but aren't mining terms |
| `import` statements left dangling after archival | Remove unused imports; typecheck will catch these |
| Store subscriptions in archived components | Will be tree-shaken; removing stores is safe if no active code subscribes |

## Files

### Files to Modify (Active Code)

| Action | File | What Changes |
|---|---|---|
| Modify | `src/main.ts` | Remove 'mining' screen check (line 51) |
| Modify | `src/ui/stores/gameState.ts` | Remove mining stores, screen types, interfaces |
| Modify | `src/data/balance.ts` | Remove ~600 lines of mining constants, rename strings |
| Modify | `src/data/types.ts` | Remove MineralTier, mining interfaces |
| Modify | `src/data/relics.ts` | Rename 'miner' archetype, update relic names |
| Modify | `src/data/milestoneCosmetics.ts` | Remove 'pickaxe' type, update descriptions |
| Modify | `src/data/gaiaAvatar.ts` | Rename mine_entry animations |
| Modify | `src/events/types.ts` | Remove mining event types |
| Modify | `src/data/card-types.ts` | Update comment re: RunState collision |
| Modify | `src/ui/components/ComebackBonus.svelte` | Update user-facing mining strings |
| Modify | `src/dev/debugBridge.ts` | Update mining references |
| Modify | `src/dev/presets.ts` | Update mining dev presets |

### Files to Archive (Move to `src/_archived-mining/`)

Estimated 100-200 files. Worker must trace import tree to identify the complete list. See Step 2 for known candidates.

## Done When

- [ ] `npm run typecheck` passes with 0 errors
- [ ] `npm run build` succeeds
- [ ] `npx vitest run` — all active tests pass
- [ ] No active source file (outside `_archived-mining/`) contains mining terminology in variable names, type names, or user-facing strings (verified by grep; false positives like "determine" excluded)
- [ ] `gameState.ts` contains no mining-specific stores, screen types, or interfaces
- [ ] `balance.ts` contains no mining-specific constants (OXYGEN_*, MINE_*, MINERAL_*, PICKAXE_*, CAVERN_*)
- [ ] `types.ts` contains no `MineralTier` or mining-specific interfaces
- [ ] `relics.ts` uses `'delver'` (not `'miner'`) archetype; no mining-themed relic names
- [ ] All dead mining files (not in active import tree) moved to `src/_archived-mining/`
- [ ] App boots and runs: main menu → domain select → combat → room select → run end (verified via Playwright or manual test with `?skipOnboarding=true&devpreset=post_tutorial`)
- [ ] `docs/GAME_DESIGN.md` and `docs/ARCHITECTURE.md` updated if any documented file paths, types, or systems changed
