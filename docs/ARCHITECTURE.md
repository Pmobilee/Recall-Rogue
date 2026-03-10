# Recall Rogue Architecture (V6 — Card Roguelite)

Every card is a fact. Learning IS gameplay.

## 1. System Overview

```
Tech Stack: Vite 7 + Svelte 5 + TypeScript 5.9 + Phaser 3 + Capacitor (Android/iOS)
Three game systems: Card Combat, Deck Building, Run Progression
Data: sql.js fact database (723 facts, expandable to 20,000+)
Persistence: localStorage (profile-namespaced), optional cloud sync
```

Primary boot path:

1. `src/main.ts` mounts Svelte app, initializes player save.
2. `CardGameManager.boot()` creates Phaser game with `BootScene` and `CombatScene`.
3. `encounterBridge.ts` wires game flow controller into deck/enemy/turn systems and CombatScene display.
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

- `CombatScene` — renders enemy sprite, HP bars, intent telegraph, hit/death animations, damage particles, screen flash, floor info
- Sprite pool of 5 pre-created card sprites, repositioned per turn (no create/destroy)
- Particle cap: 50 concurrent max on mobile; correct answer burst = 30 particles, 300ms lifespan
- Scale mode: `Scale.ENVELOP` (fills viewport without gaps)
- Pixel-art config: `pixelArt`, `roundPixels`, `antialias: false`

### Svelte UI Layer

- **Bottom 45% of screen** (interaction zone): card hand (fanned arc), answer buttons, end turn
- **Top 55% of screen** (display zone): enemy, HP bars, intent telegraph, floor counter, passive relics
- All interactive elements below the screen midpoint (thumb-reachable)
- Touch targets: 48x48dp minimum, cards `min(18vw, 85px)` width with 1.5:1 aspect ratio, answer buttons full-width 56dp height
- Card hand fans in a natural arc (low-high-low, center card highest) with 30° total spread and 20px max arc offset
- Two-step commit flow: tap to select (card rises 80px with info overlay) → tap again or swipe up (>60px) to cast → quiz panel appears above hand
- Question panel positioned via `position: fixed; bottom: calc(45vh - 20px)` — no overlap with card hand
- Enemy intent badge (STS-style) displayed between AP and bounty strips; hidden during quiz
- End Turn button: gold pulsing glow when no actions remain; confirmation popup if AP and playable cards available
- Screen routing via `currentScreen` store in `CardApp.svelte`

#### Card Animation State Machine

After answering a quiz, cards go through a multi-phase CSS animation sequence. State: `CardAnimPhase = 'reveal' | 'mechanic' | 'launch' | 'fizzle' | null`.

- **Reveal** (400ms): Card enlarges to ~1.8x, centers, CSS 3D `rotateY(180deg)` flip to show cardback art. Skipped if no cardback art available.
- **Mechanic** (500ms): One of 31 mechanic-specific `@keyframes` animations plays (slash, glow, ripple, etc.). Juice effects fire here.
- **Launch** (300ms): Card flies upward, removed from DOM.
- **Fizzle** (400ms, wrong answers only): Shake + fade out.

**Animation buffer pattern**: Cards are copied to an `animatingCards` array before logical removal from the hand. A separate `{#each animatingCards}` loop renders non-interactive copies with animation CSS classes. Cards are cleaned from the buffer after animation completes via `setTimeout`. This prevents cards from disappearing mid-animation when the hand state updates.

**Cardback discovery**: `cardbackManifest.ts` uses `import.meta.glob` at build time to discover which facts have cardback WebP images in `/public/assets/cardbacks/lowres/`. Images are preloaded via Svelte `$effect` when cards enter the hand.

**Reduced motion**: `@media (prefers-reduced-motion: reduce)` replaces flip + mechanic animations with a simple fade + color flash.

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
| Push notifications | `notificationService.ts` | Built — 4 types, local scheduling via Capacitor |

### Data Layer

Located in `src/data/`:

- `types.ts` — PlayerSave, fact types (extend with card types)
- `balance.ts` — tuning constants (retune for card effect values)
- `saveState.ts` — run state shape (replace DiveSaveState with RunSaveState)
- Enemy definitions — `src/data/enemies.ts`
- Card type mappings — `src/data/card-types.ts`

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
| Keeper NPC | `GaiaManager.ts` | 100% |
| Session tracking | `SessionTracker.ts`, `sessionTimer.ts` | 100% |
| Particle system | `ParticleSystem.ts` | 80% — adapt for card effects |
| Screen shake | `ScreenShakeSystem.ts` | 100% |

## 4. Systems Architecture

### Implemented (P0)

| System | File(s) | Status |
|--------|---------|--------|
| Card entity & types | `src/data/card-types.ts` | Built |
| Card factory | `src/services/cardFactory.ts` | Built |
| Domain resolver | `src/services/domainResolver.ts` | Built |
| Deck manager | `src/services/deckManager.ts` | Built |
| Run pool builder | `src/services/runPoolBuilder.ts` | Built |
| Turn manager | `src/services/turnManager.ts` | Built |
| Enemy manager | `src/services/enemyManager.ts` | Built |
| Floor manager | `src/services/floorManager.ts` | Built |
| Game flow controller | `src/services/gameFlowController.ts` | Built |
| Encounter bridge | `src/services/encounterBridge.ts` | Built |
| Run manager | `src/services/runManager.ts` | Built |
| Juice manager | `src/services/juiceManager.ts` | Built |
| Cardback manifest | `src/ui/utils/cardbackManifest.ts` | Built |
| Mechanic animations | `src/ui/utils/mechanicAnimations.ts` | Built |
| CombatScene | `src/game/scenes/CombatScene.ts` | Built |
| CardGameManager | `src/game/CardGameManager.ts` | Built |
| CardApp (root) | `src/CardApp.svelte` | Built |
| Card hand UI | `src/ui/components/CardHand.svelte` | Built |
| Card expanded UI | `src/ui/components/CardExpanded.svelte` | Built |
| Card combat overlay | `src/ui/components/CardCombatOverlay.svelte` | Built |
| Combo counter | `src/ui/components/ComboCounter.svelte` | Built |
| Damage numbers | `src/ui/components/DamageNumber.svelte` | Built |
| Domain selection | `src/ui/components/DomainSelection.svelte` | Built |
| Room selection overlay | `src/ui/components/RoomSelectionOverlay.svelte` | Built |
| Rest room overlay | `src/ui/components/RestRoomOverlay.svelte` | Built |
| Mystery event overlay | `src/ui/components/MysteryEventOverlay.svelte` | Built |
| Run end overlay | `src/ui/components/RunEndOverlay.svelte` | Built |
| Enemy templates | `src/data/enemies.ts` | Built |
| Balance constants | `src/data/balance.ts` (extended) | Built |
| Run save/resume | `src/services/runSaveService.ts` | Built |
| Special events data | `src/data/specialEvents.ts` | Built |
| Campfire pause screen | `src/ui/components/CampfirePause.svelte` | Built |
| Special event overlay | `src/ui/components/SpecialEventOverlay.svelte` | Built |
| Push notifications | `src/services/notificationService.ts` | Built |

### Implemented (P0.5 — Mastery Tiers)

| System | File(s) | Status |
|--------|---------|--------|
| PassiveEffect type | `src/data/card-types.ts` | Built |
| Tier 3 passive constants | `src/data/balance.ts` (`TIER3_PASSIVE_VALUE`) | Built |
| Passive tracking in TurnState | `src/services/turnManager.ts` (`activePassives`) | Built |
| Passive bonus injection | `src/services/cardEffectResolver.ts` (`passiveBonuses` param) | Built |
| Tier 3 extraction & SM-2 wiring | `src/services/encounterBridge.ts` | Built |

### Planned (P1)

| System | Description | Planned Location |
|--------|-------------|------------------|
| MasteryManager | Tier 1→2→3 evolution, tier-up ceremony UI | `src/services/masteryManager.ts` |
| Cash-out screen | Surface-or-continue risk/reward at segment checkpoints | `src/ui/components/CashOut.svelte` |
| Knowledge Library | Fact collection/mastery view | `src/ui/components/KnowledgeLibrary.svelte` |
| StreakTracker | Daily streak logic | `src/services/streakTracker.ts` |
| Canary system | Adaptive difficulty (per-player, per-domain) | `src/services/canarySystem.ts` |

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
  1. Draw 5 cards from draw pile (Tier 3 extracted as passives)
  2. Player taps card → question appears (3 answer options)
  3. Correct → card effect activates (damage/heal/shield + passive bonuses), SM-2 update via encounterBridge
     Wrong → card fizzles (gentle dissolve), correct answer shown 2s, SM-2 update
  4. Enemy turn → telegraphed attack executes, passive heal/regen applied at turn boundary
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
| Card animations | CSS 3D transforms + @keyframes (31 mechanic animations, GPU-accelerated via `will-change: transform`) |

## 9. Typed Event Bus

Two buses:

- **Global**: `src/events/EventBus.ts` — typed payloads in `src/events/types.ts`. Supports `emit`, `emitAsync`, `on`, `off`, `clear`. Will extend with card combat events (`card-played`, `card-fizzled`, `encounter-won`, `floor-cleared`, `run-ended`).
- **Encounter bridge**: `encounterBridge.ts` wires game flow controller into deck/enemy/turn systems and CombatScene display.

## 10. Save/Load Architecture

- Full save: `PlayerSave` in `src/data/types.ts`
- Save key: `terra_save_<profileId>` (fallback: `terra_save`)
- Mid-run checkpoint: saved after every encounter (replaces mid-dive snapshot)
- Save version migrations: in-code, field-by-field in `saveService.ts`
- Optional sub-document split: `saveSubDocs.ts` (core, knowledge, inventory, analytics)
- Optional cloud sync: `syncService`/`apiClient`

## 11. Directory Structure

### Current

```
src/
  CardApp.svelte           — Root component (replaces App.svelte)
  game/
    CardGameManager.ts     — Minimal Phaser boot (~80 lines)
    scenes/
      BootScene.ts         — Asset loading
      CombatScene.ts       — Phaser combat display zone (top 55%)
    managers/              QuizManager, StudyManager, SaveManager, AudioManager,
                           RelicManager, CelebrationManager, GaiaManager,
                           AchievementManager, InventoryManager, CombatManager,
                           CompanionManager, EncounterManager
    systems/               ParticleSystem, ScreenShakeSystem, SessionTracker,
                           CameraSystem, AnimationSystem, TextureAtlasLRU, ...
    entities/              Player, Boss, Creature
  services/
    encounterBridge.ts     — Wires flow → deck → enemy → turns → display
    gameFlowController.ts  — Screen routing + run lifecycle
    turnManager.ts         — Turn-based encounter logic
    deckManager.ts         — Draw/discard/shuffle/exhaust
    cardFactory.ts         — Creates Card from Fact + ReviewState
    runPoolBuilder.ts      — Builds 120-fact run pool (40/30/30 split)
    enemyManager.ts        — Creates enemies, floor scaling, intent rolling
    floorManager.ts        — Floor/room/boss/mini-boss generation
    runManager.ts          — Run stats recording
    runSaveService.ts      — Save/resume active run to localStorage
    juiceManager.ts        — Game juice effects (haptics, sounds, particles)
    domainResolver.ts      — Maps fact categories to card domains/types
    factsDB.ts, saveService.ts, sm2.ts, quizService.ts, audioService.ts, ...
  ui/
    components/
      CardCombatOverlay.svelte  — Bottom 45% interaction zone, enemy intent badge, end turn button with gold pulse, 3-phase card animation orchestration (reveal→mechanic→launch) via setTimeout chains and animatingCards buffer pattern
      CardHand.svelte           — Fanned arc hand (30° spread, 20px arc offset), green glow on playable cards, AP cost badges, tap-to-select + tap/swipe-to-cast, touch drag with opacity fade, dual-face card DOM (front/back with backface-visibility), 31 @keyframes mechanic animations, animatingCards buffer rendering, cardback preloading, reduced-motion support
      CardExpanded.svelte       — Quiz panel positioned above card hand (fixed, bottom: calc(45vh - 20px)), no overlap with hand
      ComboCounter.svelte       — Knowledge combo display
      DamageNumber.svelte       — Floating damage numbers
      DomainSelection.svelte    — Run-start domain picker
      RoomSelectionOverlay.svelte — 3-door room chooser
      RestRoomOverlay.svelte    — Rest site (heal/upgrade)
      MysteryEventOverlay.svelte — Random event resolution
      RunEndOverlay.svelte      — Post-run summary
      + 150 other Svelte components (HUD, QuizOverlay, Settings, ...)
    utils/
      cardbackManifest.ts    — Build-time manifest (import.meta.glob) for cardback WebP images; exports hasCardback(factId), getCardbackUrl(factId)
      mechanicAnimations.ts  — Maps 31 mechanic IDs to CSS animation classes; exports timing constants (REVEAL_DURATION=400, MECHANIC_DURATION=500, LAUNCH_DURATION=300), CardAnimPhase type, getMechanicAnimClass(), getTypeFallbackAnimClass()
    stores/                gameState, playerData, settings
  data/
    card-types.ts          — Card, CardRunState, CardType, FactDomain types
    enemies.ts             — Enemy template definitions
    balance.ts             — (extended with card combat constants)
    types.ts, biomes.ts, relics.ts, saveState.ts, ...
  events/                  EventBus, types
  dev/                     presets, debug bridge
  _archived-mining/        ~38 mining-specific files (stubs at original paths)
```

### Planned (P1+)

```
src/
  services/
    masteryManager.ts      — Tier 1→2→3 evolution, tier-up ceremony
    streakTracker.ts       — Daily streak logic
    canarySystem.ts        — Adaptive difficulty
  ui/
    components/
      CashOut.svelte       — Surface-or-continue risk/reward
      KnowledgeLibrary.svelte — Fact collection/mastery view
```

## 12. Dependency Graph

```
CardApp.svelte
  → ui/stores/* (currentScreen, playerData)
  → services/gameFlowController (screen transitions, run state)
  → services/encounterBridge (combat handlers)

CardGameManager (globalThis symbol registry)
  → scenes/BootScene, scenes/CombatScene

encounterBridge
  → CardGameManager (via globalThis[Symbol.for('terra:cardGameManager')])
  → services/turnManager
  → services/deckManager + runPoolBuilder + cardFactory
  → services/enemyManager
  → services/runManager
  → services/gameFlowController (activeRunState, onEncounterComplete)
  → ui/stores/playerData (updateReviewState — SM-2 wiring)
  → data/balance (TIER3_PASSIVE_VALUE — passive extraction)

gameFlowController
  → services/floorManager (room generation)
  → ui/stores/gameState (currentScreen)
  → data/balance (run parameters)

CardCombatOverlay.svelte
  → services/factsDB (real quiz questions)
  → services/juiceManager (damage numbers, effects)
  → encounterBridge stores (activeTurnState)

playerData / saveService
  → data/types (PlayerSave)
  → localStorage (profile-namespaced keys)

factsDB
  → public/facts.db (built by scripts/build-facts-db.mjs from src/data/seed/)
```
