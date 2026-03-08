# Terra Miner Architecture (V6 — Card Roguelite)

Every card is a fact. Learning IS gameplay.

## 1. System Overview

```
Tech Stack: Vite 7 + Svelte 5 + TypeScript 5.9 + Phaser 3 + Capacitor (Android/iOS)
Three game systems: Card Combat, Deck Building, Run Progression
Data: sql.js fact database (522 facts, expandable to 20,000+)
Persistence: localStorage (profile-namespaced), optional cloud sync
```

Primary boot path:

1. `src/main.ts` mounts Svelte app, initializes player save.
2. `GameManager.boot()` creates Phaser game with `BootScene` and `CombatScene`.
3. `GameEventBridge` wires Phaser events into Svelte stores.
4. `factsDB.init()` loads `public/facts.db` in parallel for quiz/card content.

## 2. Layer Architecture

```
┌─────────────────────────────────────────────────┐
│  Svelte UI Layer                                │
│  Card hand, answer buttons, room selection,     │
│  post-run summary, domain picker, menus         │
├─────────────────────────────────────────────────┤
│  Phaser Layer                                   │
│  CombatScene: enemy sprites, card sprite pool,  │
│  hit/fizzle animations, particles, tweens       │
├─────────────────────────────────────────────────┤
│  Service Layer                                  │
│  Quiz engine, SM-2 scheduler, facts DB,         │
│  save/load, API client, audio, analytics        │
├─────────────────────────────────────────────────┤
│  Data Layer                                     │
│  Types, balance constants, fact schemas,         │
│  enemy definitions, card type mappings           │
└─────────────────────────────────────────────────┘
```

### Phaser Layer

- `CombatScene` — **TO BUILD** — renders enemy sprite, card play animations, damage numbers, particle effects, screen shake
- Sprite pool of 5 pre-created card sprites, repositioned per turn (no create/destroy)
- Particle cap: 50 concurrent max on mobile; correct answer burst = 30 particles, 300ms lifespan
- GPU-accelerated tweens for all card animations (not CSS)
- Pixel-art config: `pixelArt`, `roundPixels`, `antialias: false`

### Svelte UI Layer

- **Bottom 45% of screen** (interaction zone): card hand (fanned arc), answer buttons, skip/hint, end turn
- **Top 55% of screen** (display zone): enemy, HP bars, intent telegraph, floor counter, passive relics
- All interactive elements below the screen midpoint (thumb-reachable)
- Touch targets: 48x48dp minimum, cards 60x80dp, answer buttons full-width 56dp height
- Screen routing via `currentScreen` store in `App.svelte`

### Service Layer

Located in `src/services/`:

| Service | File | Status |
|---------|------|--------|
| Quiz engine | `quizService.ts` | EXISTS — reuse |
| SM-2 scheduler | `sm2.ts` | EXISTS — reuse, add tier derivation |
| Facts database | `factsDB.ts` | EXISTS — reuse, extend schema |
| Save/load | `saveService.ts` | EXISTS — reuse |
| Audio | `audioService.ts` | EXISTS — reuse |
| Analytics | `analyticsService.ts` | EXISTS — reuse |
| API client | `apiClient.ts` | EXISTS — reuse |
| Profile mgmt | `profileService.ts` | EXISTS — reuse |
| Haptics | `hapticService.ts` | EXISTS — reuse |

### Data Layer

Located in `src/data/`:

- `types.ts` — PlayerSave, fact types (extend with card types)
- `balance.ts` — tuning constants (retune for card effect values)
- `saveState.ts` — run state shape (replace DiveSaveState with RunSaveState)
- Enemy definitions — **TO BUILD**
- Card type mappings — **TO BUILD**

## 3. Retained Systems

These systems transfer from the mining codebase with minimal changes:

| System | Key Files | Reuse % |
|--------|-----------|---------|
| Quiz engine (3-pool) | `QuizManager.ts`, `quizService.ts` | 100% |
| SM-2 algorithm | `sm2.ts`, `StudyManager.ts` | 100% |
| Facts database | `factsDB.ts`, `public/facts.db` | 100% |
| Artifact/loot system | `RelicManager.ts`, `CelebrationManager.ts` | 90% — artifacts become run rewards |
| Audio manager | `AudioManager.ts`, `audioService.ts` | 100% |
| Save/load | `SaveManager.ts`, `saveService.ts` | 100% |
| Event bus | `src/events/EventBus.ts`, `src/events/types.ts` | 100% |
| Achievement tracking | `AchievementManager.ts` | 100% |
| GAIA NPC | `GaiaManager.ts` | 100% |
| Session tracking | `SessionTracker.ts`, `sessionTimer.ts` | 100% |
| Particle system | `ParticleSystem.ts` | 80% — adapt for card effects |
| Screen shake | `ScreenShakeSystem.ts` | 100% |

## 4. New Systems to Build

### P0 — Core (Prototype)

| System | Description | Planned Location |
|--------|-------------|------------------|
| Card entity | Card type, effect value, tier, fact binding | `src/game/card/Card.ts` |
| DeckManager | Draw pile, discard pile, shuffle, hand draw (5 cards) | `src/game/card/DeckManager.ts` |
| Hand manager | Hand of 5, tap-to-select, answer-to-play flow | `src/game/card/Hand.ts` |
| CardRenderer | Svelte component for card visuals | `src/ui/components/CardRenderer.svelte` |
| Encounter engine | Turn loop: player plays cards → enemy attacks → repeat | `src/game/combat/Encounter.ts` |
| Enemy system | Types, HP, attack patterns, telegraphed intents | `src/game/combat/Enemy.ts` |
| CombatScene | Phaser scene for encounter rendering | `src/game/scenes/CombatScene.ts` |
| RunManager | Floor progression, room selection, run lifecycle | `src/game/run/RunManager.ts` |
| RunPoolBuilder | Build 120-fact pool from domain selection (40/30/30 split) | `src/game/run/RunPoolBuilder.ts` |
| DomainSelector | Run-start domain pick UI | `src/ui/components/DomainSelector.svelte` |
| FloorMap | 3-choice room selection between encounters | `src/ui/components/FloorMap.svelte` |
| Card reward screen | Pick 1 of 3 cards after encounters | `src/ui/components/CardReward.svelte` |

### P1 — First Update

| System | Description | Planned Location |
|--------|-------------|------------------|
| MasteryManager | Tier 1→2→3 evolution, passive tracking | `src/game/meta/MasteryManager.ts` |
| Cash-out screen | Surface-or-continue risk/reward at segment checkpoints | `src/ui/components/CashOut.svelte` |
| Knowledge Library | Fact collection/mastery view | `src/ui/components/KnowledgeLibrary.svelte` |
| StreakTracker | Daily streak logic | `src/game/meta/StreakTracker.ts` |
| Knowledge Combo | Consecutive correct answers → multiplier | `src/game/combat/ComboTracker.ts` |
| Canary system | Adaptive difficulty (per-player, per-domain) | `src/game/meta/CanarySystem.ts` |

### P2+ — Post-Launch

- Endless mode, cosmetic store, language pack support, leaderboards

## 5. Archived Systems

Mining-specific code moved to `src/_archived-mining/`. Stub files remain at original paths for import compatibility.

Archived systems include: mining grid, block breaking, fog of war, O2 system, mine generation, biome rendering, hazard system, mine block interactor, dome scene (hub world), creature spawner, instability system.

## 6. Data Flow

### Run Lifecycle

```
Domain Selection (pick primary + secondary domain)
  → RunPoolBuilder builds 120-fact pool (40% primary, 30% secondary, 30% SM-2 review)
  → DeckManager shuffles pool into draw pile
  → Floor 1 begins

Combat Loop (per encounter):
  1. Draw 5 cards from draw pile
  2. Player taps card → question appears (3 answer options)
  3. Correct → card effect activates (damage/heal/shield), SM-2 quality update
     Wrong → card fizzles (gentle dissolve), correct answer shown 2s, SM-2 update
  4. Enemy turn → telegraphed attack executes
  5. Repeat until enemy HP = 0 or player HP = 0

Between Encounters:
  → Room selection (3 choices: enemy, mystery, rest, shop, elite)
  → Card reward (pick 1 of 3 new cards)

Segment Checkpoint (every 3 floors):
  → Cash-out-or-continue decision
  → Boss encounter if continuing

Run End:
  → Post-run summary (facts learned, cards earned, floor reached)
  → SM-2 states persisted, meta-progression applied
  → Return to hub
```

### Store Architecture

- `src/ui/stores/gameState.ts` — current screen, run state, combat state
- `src/ui/stores/playerData.ts` — save data, SM-2 states, achievements
- Phaser `CombatScene` owns transient combat state (enemy HP, animations)
- `saveService` persists `PlayerSave` to localStorage (profile-namespaced)

## 7. State Management

| State Type | Owner | Persistence |
|------------|-------|-------------|
| UI navigation | Svelte stores (`currentScreen`) | Session only |
| Run progress | RunManager → Svelte store | Saved after every encounter |
| Combat state | CombatScene + encounter engine | Transient (rebuilt from run state) |
| Card/deck state | DeckManager | Saved as part of run state |
| SM-2 review data | playerData store | Persisted in PlayerSave |
| Meta-progression | playerData store | Persisted in PlayerSave |
| Settings | settings store | localStorage |

Run state serialization target: <50KB (SM-2 data for 500 facts ≈ 25KB).

## 8. Performance Budget

| Metric | Target |
|--------|--------|
| Active game objects in combat | ~12 (1 background, 1 enemy, 5 cards, 2 HP bars, 1 combo counter, 1 particle emitter, 1 intent icon) |
| Concurrent particles | 50 max |
| Frame rate | 60fps |
| Run state size | <50KB |
| Texture atlases in memory | 3 max (via TextureAtlasLRU) |
| Card animations | Phaser tweens only (GPU-accelerated) |

## 9. Typed Event Bus

Two buses:

- **Global**: `src/events/EventBus.ts` — typed payloads in `src/events/types.ts`. Supports `emit`, `emitAsync`, `on`, `off`, `clear`. Will extend with card combat events (`card-played`, `card-fizzled`, `encounter-won`, `floor-cleared`, `run-ended`).
- **Phaser bridge**: `GameEventBridge.ts` wires Phaser scene events into Svelte stores.

## 10. Save/Load Architecture

- Full save: `PlayerSave` in `src/data/types.ts`
- Save key: `terra_save_<profileId>` (fallback: `terra_save`)
- Mid-run checkpoint: saved after every encounter (replaces mid-dive snapshot)
- Save version migrations: in-code, field-by-field in `saveService.ts`
- Optional sub-document split: `saveSubDocs.ts` (core, knowledge, inventory, analytics)
- Optional cloud sync: `syncService`/`apiClient`

## 11. Directory Structure

### Current (exists)

```
src/
  game/
    scenes/          BootScene, MineScene (stub), DomeScene (stub)
    managers/        QuizManager, StudyManager, SaveManager, AudioManager,
                     RelicManager, CelebrationManager, GaiaManager,
                     AchievementManager, InventoryManager, CombatManager,
                     CompanionManager, EncounterManager
    systems/         ParticleSystem, ScreenShakeSystem, SessionTracker,
                     CameraSystem, AnimationSystem, TextureAtlasLRU, ...
    entities/        Player, Boss, Creature
  ui/
    components/      150+ Svelte components (HUD, QuizOverlay, Settings, ...)
    stores/          gameState, playerData, settings
  services/          factsDB, saveService, sm2, quizService, audioService, ...
  data/              types, balance, biomes, relics, saveState, ...
  events/            EventBus, types
  dev/               presets, debug bridge
  _archived-mining/  ~38 mining-specific files (stubs at original paths)
```

### Planned (to build)

```
src/
  game/
    card/            Card.ts, DeckManager.ts, Hand.ts
    combat/          Encounter.ts, Enemy.ts, ComboTracker.ts
    run/             RunManager.ts, RunPoolBuilder.ts
    meta/            MasteryManager.ts, StreakTracker.ts, CanarySystem.ts
    scenes/          CombatScene.ts (new)
  ui/
    components/      CardRenderer.svelte, DomainSelector.svelte,
                     FloorMap.svelte, CashOut.svelte, CardReward.svelte,
                     KnowledgeLibrary.svelte
  data/
    enemies/         Enemy stat definitions
```

## 12. Dependency Graph

```
App.svelte
  → ui/stores/* (currentScreen, playerData, settings)
  → game/gameManagerRef → GameManager

GameManager
  → scenes/CombatScene (TO BUILD)
  → managers/* (retained: Quiz, Study, Save, Audio, Relic, Gaia, Achievement)
  → services/factsDB, services/saveService
  → stores/gameState, stores/playerData

CombatScene (TO BUILD)
  → card/DeckManager → card/Hand
  → combat/Encounter → combat/Enemy
  → run/RunManager

RunManager (TO BUILD)
  → run/RunPoolBuilder → services/factsDB + services/sm2
  → emits floor/room events → GameEventBridge → stores

GameEventBridge
  → consumes Phaser events
  → updates stores, calls managers/services

playerData / saveService
  → data/types (PlayerSave)
  → localStorage (profile-namespaced keys)

factsDB
  → public/facts.db (built by scripts/build-facts-db.mjs)
```
