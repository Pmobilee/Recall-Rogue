# Recall Rogue Architecture (V6 — Card Roguelite)

Every card is a fact. Learning IS gameplay.

## 1. System Overview

```
Tech Stack: Vite 7 + Svelte 5 + TypeScript 5.9 + Phaser 3 + Capacitor (Android/iOS)
Three game systems: Card Combat, Deck Building, Run Progression
Data: sql.js fact database (4,537 facts, expandable to 20,000+)
Persistence: localStorage (profile-namespaced), optional cloud sync
```

Primary boot path:

1. `src/main.ts` mounts Svelte app, initializes player save.
2. `CardGameManager.boot()` creates Phaser game with `BootScene` and `CombatScene`.
3. `encounterBridge.ts` wires game flow controller into deck/enemy/turn systems and CombatScene display. `startEncounterForRoom()` is async and calls `await factsDB.init()` if the DB is not yet ready (guards against race conditions).
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
│  Quiz engine, FSRS scheduler, facts DB,         │
│  save/load, relic system, audio, analytics      │
├─────────────────────────────────────────────────┤
│  Data Layer                                     │
│  Types, balance constants, fact schemas,         │
│  enemy definitions, relic catalogue, card types  │
└─────────────────────────────────────────────────┘
```

### Phaser Layer

- `CombatScene` — renders enemy HP bars (with block overlay), damage particles, screen flash. Enemy sprites are rendered and animated via EnemySpriteSystem (3D paper cutout effect with procedural idle/attack/hit/death states). Intent, floor info, enemy name, and bounty strip have moved to the Svelte overlay.
- `CombatScene` uses a `sceneReady` guard: a private boolean flag set `true` at end of `create()`. All public methods (`setEnemy`, `updateEnemyBlock`, `setEnemyIntent`, `updatePlayerHP`, `setFloorInfo`, `setRelics`) early-return if the scene is not yet ready, preventing race conditions when callers invoke display updates before Phaser objects exist.
- **Enemy Sprite Pipeline** (`scripts/process-enemy-sprites.mjs`): Sharp-based script processes source PNGs from `data/generated/enemies/{zone}/{tier}/` into mobile-ready sprites with 4 output files per enemy: `{name}_idle.png`, `{name}_idle.webp`, `{name}_idle_1x.png`, `{name}_idle_1x.webp` in `public/assets/sprites/enemies/`. Resolution tiers: Standard (common=256px, elite/miniboss=320px, boss=384px longest edge) and 1x low-end (half size). Sprite keys auto-generated via `scripts/gen-sprite-keys.mjs` following `enemy-{id}-idle` pattern. All 88 enemy sprites preloaded at CombatScene startup via loop over ENEMY_TEMPLATES. Only idle textures used; hit/death animations are fully procedural (tweens + particles).
- **Sprite Display**: EnemySpriteSystem preserves texture aspect ratio, constraining longest edge to displaySize. Standard devices get `.webp`, low-end devices get `_1x.webp`. Layered 3D paper-cutout effect (shadow + outlines + main sprite) applied to both real sprites and placeholder colored rectangles.
- Sprite pool of 5 pre-created card sprites, repositioned per turn (no create/destroy)
- Particle cap: 50 concurrent max on mobile; correct answer burst = 30 particles, 300ms lifespan
- Scale mode: `Scale.ENVELOP` (fills viewport without gaps)
- Pixel-art config: `pixelArt`, `roundPixels`, `antialias: false`

### Svelte UI Layer

- **Bottom 45% of screen** (interaction zone): card hand (fanned arc), answer buttons, end turn
- **Top 55% of screen** (display zone): enemy, HP bars, intent telegraph, floor counter, relic tray
- All interactive elements below the screen midpoint (thumb-reachable)
- Touch targets: 48x48dp minimum, cards `min(18vw, 85px)` width with 1.5:1 aspect ratio, answer buttons full-width 56dp height
- Card hand fans in a natural arc (low-high-low, center card highest) with 30° total spread and 20px max arc offset
- Two-step commit flow: tap to select (card rises 80px with info overlay) → tap again or swipe up (>60px) to cast → quiz panel appears above hand
- Question panel positioned via `position: fixed; bottom: calc(45vh - 20px)` — no overlap with card hand
- Enemy intent panel, floor info, enemy name header (color-coded by category), and bounty strip (bottom-right, above End Turn) rendered in Svelte overlay — not Phaser
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

#### Asset Preloading Gate

Every screen preloads its background images behind the transition overlay before revealing content, ensuring zero visible pop-in.

**Core utilities:**
- `src/ui/utils/assetPreloader.ts` — `preloadImages(urls: string[]): Promise<void>` loads images via browser Image API
- `src/ui/stores/gameState.ts` — `holdScreenTransition()` / `releaseScreenTransition()` control the transition overlay

**Flow:**
1. Screen transition overlay activates (opaque with loading dots)
2. Target screen component calls `holdScreenTransition()` at initialization
3. Component preloads background images via `preloadImages([bgUrl])`
4. On completion, `releaseScreenTransition()` fades out the overlay
5. Safety timeouts prevent permanent blocking (8s per hold, 5s initial boot)

**Combat scene:** `gameFlowController.ts` holds the transition before `currentScreen.set('combat')`. `CombatScene.setBackground()` returns a `Promise<void>` that resolves when the per-encounter background loads. `encounterBridge.ts` chains `releaseScreenTransition()` on that promise.

**Screens with preloading:** HubScreen (12 camp images), RoomSelection, RestRoomOverlay, ShopRoomOverlay, MysteryEventOverlay, CardRewardScreen, RetreatOrDelve, RunEndScreen, CombatScene.

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
| Funness boost | `funnessBoost.ts` | Built — new player bias toward higher-funScore facts (runs 0–99, linear decay) |

### Data Layer

Located in `src/data/`:

- `types.ts` — PlayerSave, fact types (extend with card types)
- `vocabulary.ts` — Language deck types: `LanguageConfig` (extended with `subdecks` and `options`), `LanguageDeckOption` interface, VocabularyFact schema extensions for targetLanguage, jlptLevel, reading, audioUrl
- `balance.ts` — tuning constants (retune for card effect values). Includes `BASE_EFFECT` (per-type base effect values: attack, shield, buff, debuff, utility, wild), `POST_ENCOUNTER_HEAL_PCT` (8%), `RELAXED_POST_ENCOUNTER_HEAL_BONUS` (additional healing in Relaxed Mode), `POST_BOSS_ENCOUNTER_HEAL_BONUS` (boss encounter bonus), `EARLY_MINI_BOSS_HP_MULTIPLIER` (0.60x for floors 1-3), `FLOOR_DAMAGE_SCALING_PER_FLOOR` (0.03), `ENEMY_TURN_DAMAGE_CAP` (per-segment damage caps). In-combat healing only from lifetap (attack card) and relic effects
- `saveState.ts` — run state shape (replace DiveSaveState with RunSaveState)
- Enemy definitions — `src/data/enemies.ts`. `EnemyInstance` interface includes `floor: number` field for floor-based damage scaling; `difficultyVariance` field (0.8–1.2x multiplier on HP and damage for common enemies). `EnemyTemplate` includes `rarity` (standard/uncommon/rare), `spawnWeight` (for weighted random selection), and `animArchetype` (one of 8 animation types: swooper, slammer, crawler, caster, floater, lurcher, striker, trembler).
- Enemy animations — `src/data/enemyAnimations.ts` — Animation archetype configs (8 types). Defines `AnimConfig` interface with tween parameters and `getAnimConfig(archetype)` resolver. Pure data, no Phaser/Svelte imports.
- Card type mappings — `src/data/card-types.ts`

## 3. Retained Systems

These systems transfer from the mining codebase with minimal changes:

| System | Key Files | Reuse % |
|--------|-----------|---------|
| Quiz engine (3-pool) | `QuizManager.ts`, `quizService.ts` | 100% |
| SM-2 algorithm | `sm2.ts`, `StudyManager.ts` | 100% |
| Facts database | `factsDB.ts`, `public/facts.db` | 100% |
| Relic system | `relicEffectResolver.ts`, `relicAcquisitionService.ts`, `src/data/relics/` | Complete — 50 relics, mastery coins, in-run collection |
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
| Funness boost | `src/services/funnessBoost.ts` | Built — new player bias toward higher-funScore facts (runs 0–99) |
| Turn manager | `src/services/turnManager.ts` | Built |
| Enemy manager | `src/services/enemyManager.ts` | Built — includes `getFloorDamageScaling(floor)` (+3%/floor above 6), `getSegmentForFloor(floor)`, and per-turn damage caps via `ENEMY_TURN_DAMAGE_CAP` |
| Floor manager | `src/services/floorManager.ts` | Built |
| Game flow controller | `src/services/gameFlowController.ts` | Built |
| Encounter bridge | `src/services/encounterBridge.ts` | Built — applies post-encounter healing (`POST_ENCOUNTER_HEAL_PCT`, `POST_BOSS_ENCOUNTER_HEAL_BONUS` for boss/mini-boss) and early mini-boss HP reduction (`EARLY_MINI_BOSS_HP_MULTIPLIER`) |
| Run manager | `src/services/runManager.ts` | Built |
| Juice manager | `src/services/juiceManager.ts` | Built |
| Cardback manifest | `src/ui/utils/cardbackManifest.ts` | Built |
| Flag manifest | `src/data/flagManifest.ts` | Built — maps 218 country names to flag SVG URLs in `/public/assets/flags/` |
| Mechanic animations | `src/ui/utils/mechanicAnimations.ts` | Built |
| CombatScene | `src/game/scenes/CombatScene.ts` | Built — Delegates enemy sprite rendering and animation to EnemySpriteSystem |
| Enemy sprite system | `src/game/systems/EnemySpriteSystem.ts` | Built — Encapsulates all 88 enemy rendering with sharp-processed PNG assets. 3D paper cutout effect (shadow + outline layers), config-driven idle/attack/hit/death animations via `setAnimConfig(archetype)` method (8 animation archetypes from `src/data/enemyAnimations.ts`). Aspect-ratio-preserving scaling, device-tier texture selection (.webp vs _1x.webp), placeholder display for missing sprites. |
| CardGameManager | `src/game/CardGameManager.ts` | Built |
| CardApp (root) | `src/CardApp.svelte` | Built |
| Card hand UI | `src/ui/components/CardHand.svelte` | Built — added `.card-upgraded` CSS class (blue glow) |
| Card expanded UI | `src/ui/components/CardExpanded.svelte` | Built |
| Card combat overlay | `src/ui/components/CardCombatOverlay.svelte` | Built — added synergy flash UI element |
| Combo counter | `src/ui/components/ComboCounter.svelte` | Built |
| Damage numbers | `src/ui/components/DamageNumber.svelte` | Built |
| Domain selection | `src/ui/components/DomainSelection.svelte` | Deprecated — no longer used in run flow; removed from gameFlowController.playAgain() |
| Deck builder | `src/ui/components/DeckBuilder.svelte` | Built — study preset creation/editing within Library screen |
| Study mode selector | `src/ui/components/StudyModeSelector.svelte` | Built — hub dropdown for selecting study mode before runs |
| Room selection overlay | `src/ui/components/RoomSelectionOverlay.svelte` | Built |
| Rest room overlay | `src/ui/components/RestRoomOverlay.svelte` | Built — wired upgrade button (removed "Coming soon" stub) |
| Shop room overlay | `src/ui/components/ShopRoomOverlay.svelte` | Complete redesign — buy relics + buy cards + sell sections |
| Mystery event overlay | `src/ui/components/MysteryEventOverlay.svelte` | Built |
| Run end overlay | `src/ui/components/RunEndOverlay.svelte` | Built |
| Enemy templates | `src/data/enemies.ts` | Built |
| Balance constants | `src/data/balance.ts` (extended) | Built |
| Run save/resume | `src/services/runSaveService.ts` | Built |
| Special events data | `src/data/specialEvents.ts` | Built |
| Campfire pause screen | `src/ui/components/CampfirePause.svelte` | Built |
| Special event overlay | `src/ui/components/SpecialEventOverlay.svelte` | Built |
| Push notifications | `src/services/notificationService.ts` | Built |
| Study preset CRUD | `src/services/studyPresetService.ts` | Built |
| Preset pool builder | `src/services/presetPoolBuilder.ts` | Built — resolves study mode into domain + subcategory filters for run pool |
| Mastery scaling | `src/services/masteryScalingService.ts` | Built — anti-cheat reward/timer scaling based on deck mastery % |
| Study preset types | `src/data/studyPreset.ts` | Built — StudyPreset + DeckMode types |
| Deck options service | `src/services/deckOptionsService.ts` | Built — Persisted store for language-specific display options (furigana, romaji) |
| Furigana display | `src/ui/FuriganaText.svelte` | Built — Ruby annotation component for Japanese text |
| Deck options panel | `src/ui/DeckOptionsPanel.svelte` | Built — Toggle UI for language-specific display options |
| Combat atmosphere system | `src/game/systems/CombatAtmosphereSystem.ts` | Built (D2) — Fog overlays + themed ambient particles, floor-based tint progression (dust/embers/ice/arcane/void), device-tier aware budgets, respects reduce-motion |
| Status effect visual system | `src/game/systems/StatusEffectVisualSystem.ts` | Built (D3) — Persistent particle streams for poison/burn/freeze/bleed, aura rings for buff/debuff, effect type mapping, depth layering |
| Combat particle system | `src/game/systems/CombatParticleSystem.ts` | Built (A2) — Multi-emitter particle manager with 4 procedural textures (square, circle, diamond, streak), burst/directional/combo/death methods, device-tier budgets |
| Campfire living fire | `src/ui/components/CampfireCanvas.svelte`, `src/ui/effects/CampfireEffect.ts` | Built (C1) — Canvas2D fire overlay with streak-based intensity (3 levels), 30-particle pool, warm palette, 30fps throttled |
| Hub ambient effects | `src/ui/effects/HubAmbientEffects.ts` | Built (C2) — CSS micro-animations for camp sprites (breathe, sway, spark), `getAmbientClass()` mapping |

### Implemented (Camp Hub Visual Overhaul)

| System | File(s) | Status |
|--------|---------|--------|
| Camp sprite button | `src/ui/components/CampSpriteButton.svelte` | Built |
| Camp speech bubble | `src/ui/components/CampSpeechBubble.svelte` | Built |
| Camp HUD overlay | `src/ui/components/CampHudOverlay.svelte` | Built |
| Camp upgrade modal | `src/ui/components/CampUpgradeModal.svelte` | Built |
| Hub screen (camp scene) | `src/ui/components/HubScreen.svelte` | Rewritten |
| Camp art manifest | `src/ui/utils/campArtManifest.ts` | Extended |
| Camp sprites | `public/assets/camp/sprites/{name}/{name}-base.png` | 11 sprites + background |
| Firefly background | `src/ui/components/FireflyBackground.svelte` | Built |
| Game frame (responsive) | `src/CardApp.svelte` (`.card-app` CSS) | Built |

**Global CSS variable `--gw`** (`src/app.css`): `min(100vw, 430px)` — represents the game viewport width. Used by HubScreen sprites instead of `vw` units to ensure proper sizing within the phone frame on desktop.

### Implemented (P0.5 — Mastery Tiers)

| System | File(s) | Status |
|--------|---------|--------|
| PassiveEffect type | `src/data/card-types.ts` | Built |
| Tier 3 passive constants | `src/data/balance.ts` (`TIER3_PASSIVE_VALUE`) | Built |
| Passive tracking in TurnState | `src/services/turnManager.ts` (`activePassives`) | Built |
| Passive bonus injection | `src/services/cardEffectResolver.ts` (`passiveBonuses` param) | Built — wild card branch now copies target type's `BASE_EFFECT` value |
| Tier 3 extraction & SM-2 wiring | `src/services/encounterBridge.ts` | Built |

### Implemented (P0.6 — Card Upgrades & Shop Enhancement)

| System | File(s) | Status |
|--------|---------|--------|
| Card upgrade definitions | `src/services/cardUpgradeService.ts` | Built — UPGRADE_DEFS mapping mechanics → bonus values |
| Card upgrade logic | `src/services/cardUpgradeService.ts` (upgradeCard, canUpgradeCard, getUpgradeCandidates, getUpgradePreview) | Built |
| Shop inventory generation | `src/services/shopService.ts` | Built — generateShopRelics, calculateShopPrice, priceShopCards |
| Hidden relic synergies | `src/services/relicSynergyResolver.ts` | Built — RELIC_SYNERGIES definitions, detectActiveSynergies, hasSynergy, Tier 3 bonus calculation |
| Upgrade picker UI | `src/ui/components/UpgradeSelectionOverlay.svelte` | Built — 3 candidates with before/after preview, sorted by tier |
| Post-mini-boss rest screen | `src/ui/components/PostMiniBossRestOverlay.svelte` | Built — auto-heal 15% + upgrade selection |

#### Modified Files (P0.6)

**Data Layer:**
- `src/data/card-types.ts` — Added `isUpgraded?: boolean` and `secondaryValue?: number` to Card interface
- `src/data/balance.ts` — Added upgrade, shop, and synergy constants (UPGRADE_DEFS, SHOP_PRICES, RELIC_SYNERGIES, SYNERGY_BONUSES)

**Service Layer:**
- `src/services/encounterBridge.ts` — Wired `generateCurrencyReward()` for gold after encounters; added `upgradeCardInActiveDeck()` handler
- `src/services/gameFlowController.ts` — Added upgrade flow states, shop buy handlers, post-mini-boss rest routing
- `src/services/relicEffectResolver.ts` — Integrated Tier 2 synergy bonus checks via `hasSynergy()` during effect resolution
- `src/services/turnManager.ts` — Added Tier 3 synergy tracking: `consecutiveCorrectThisEncounter`, `tier3CardCount`, `phoenixRageTurnsRemaining`, `glassPenaltyRemovedTurnsRemaining`
- `src/services/runManager.ts` — Added `cardsUpgraded: number` to RunState tracking
- `src/services/cardEffectResolver.ts` — Updated multi_hit/reckless/execute to use per-card `secondaryValue`; quicken+ draws 1 extra card

**UI Layer:**
- `src/ui/stores/gameState.ts` — Added `upgradeSelection`, `postMiniBossRest` screens; added `synergyFlash` store for visual feedback
- `src/ui/components/CardHand.svelte` — Added `.card-upgraded` CSS class (blue glow border)
- `src/ui/components/RestRoomOverlay.svelte` — Wired upgrade button (removed "Coming soon" stub)
- `src/ui/components/ShopRoomOverlay.svelte` — Complete redesign with buy relics, buy cards, and sell sections
- `src/ui/components/CardCombatOverlay.svelte` — Added synergy flash UI element for visual feedback

**Data Flow Additions:**
- **Upgrade flow**: Rest Room → `openUpgradeSelection()` → UpgradeSelectionOverlay → `onUpgradeSelected(cardId)` → mutates card in deck → proceeds
- **Shop buy flow**: Shop Room → `onShopBuyRelic(relicId)` / `onShopBuyCard(index)` → deducts gold, adds item → updates display
- **Synergy detection**: `relicSynergyResolver.detectActiveSynergies()` called at encounter start → bonuses applied in `relicEffectResolver` (Tier 2) and `turnManager` (Tier 3)

### Relic System

The relic system uses an STS-inspired economy replacing the old FSRS-tied passive relics.

**Data layer** (`src/data/relics/`):
- `types.ts` — `RelicDefinition`, `RunRelic`, `RelicRarity`, `RelicCategory`, `RelicTrigger`
- `starters.ts` — 25 free starter relic definitions
- `unlockable.ts` — 25 unlockable relic definitions
- `index.ts` — barrel exports, `FULL_RELIC_CATALOGUE`, `RELIC_BY_ID`, `STARTER_RELIC_IDS`

**Services**:
- `relicEffectResolver.ts` — Pure functions resolving relic effects from `Set<string>` of held IDs. Hooks: encounter start, attack, shield, heal, damage taken, lethal, turn end, perfect turn, correct answer, card skip, draw count, combo start, speed bonus, echo, timer.
- `relicAcquisitionService.ts` — In-run pool filtering, weighted random selection, boss/mini-boss choice generation, random drop logic.

**UI components**:
- `RelicCollectionScreen.svelte` — Hub screen (via Anvil) for browsing, unlocking, and excluding relics
- `RelicRewardScreen.svelte` — Full-screen 1-of-3 relic choice (boss/first mini-boss)
- `RelicPickupToast.svelte` — Brief toast for random relic drops
- `RelicTray.svelte` — Combat HUD horizontal relic display (no dormancy)

**Integration points** (all combat-loop relic checks now delegate to `relicEffectResolver.ts` as the centralized source of truth):
- `encounterBridge.ts` — Builds `activeRelicIds` from `runRelics` at encounter start; delegates encounter-start effects (herbal_pouch, quicksilver), draw count (swift_boots, blood_price), and combo start (combo_ring) to resolver
- `turnManager.ts` — Delegates turn-start effects (iron_buckler: +3 block/turn), damage-taken effects (steel_skin, thorned_vest, glass_cannon, iron_resolve), lethal saves (last_breath, phoenix_feather), turn-end effects (fortress_wall, afterimage, blood_pact, blood_price), and perfect-turn bonuses (momentum_gem) to resolver
- `cardEffectResolver.ts` — Per-card relic modifiers (attack bonus, strike bonus, echo power, chain lightning)
- `gameFlowController.ts` — Relic acquisition flow after encounters, relic reward routing
- `playerData.ts` — `awardMasteryCoin()`, `spendMasteryCoins()`, `unlockRelic()`, `toggleRelicExclusion()`
- `saveService.ts` — Backward-compatible migration: retroactive mastery coins from Tier 3 facts

### Planned (P1)

| System | Description | Planned Location |
|--------|-------------|------------------|
| MasteryManager | Tier 1→2→3 evolution, tier-up ceremony UI | `src/services/masteryManager.ts` |
| Cash-out screen | Surface-or-continue risk/reward at segment checkpoints | `src/ui/components/CashOut.svelte` |
| Knowledge Library | Fact collection/mastery view | `src/ui/components/KnowledgeLibrary.svelte` |
| StreakTracker | Daily streak logic | `src/services/streakTracker.ts` |
| Canary system | Adaptive difficulty (per-player, per-domain) | `src/services/canarySystem.ts` |

### P2+ — Post-Launch

- Endless mode, cosmetic store (Treasure Chest sprite → dedicated shop), language pack support

## 5. Archived Systems

Mining-specific code moved to `src/_archived-mining/`. Stub files remain at original paths for import compatibility.

Archived systems include: mining grid, block breaking, fog of war, O2 system, mine generation, biome rendering, hazard system, mine block interactor, dome scene (hub world), creature spawner, instability system.

## 6. Data Flow

### Run Lifecycle

```
Study Mode Selection (hub dropdown: All Topics, saved preset, language, or Build New Deck)
  → PresetPoolBuilder resolves selected mode into domain + subcategory filters
  → MasteryScalingService calculates deck mastery % and applies reward/timer scaling
  → RunPoolBuilder builds 120-fact pool from resolved domains (30/25/45 split, subcategory-balanced) or preset-weighted
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
| Study presets | studyPresetService | localStorage (up to 10 named presets) |
| Selected study mode | gameFlowController | Saved per-run, previous mode remembered |
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
- **Encounter bridge**: `encounterBridge.ts` wires game flow controller into deck/enemy/turn systems and CombatScene display. `startEncounterForRoom()` is async; callers in `CardApp.svelte` and `gameFlowController.ts` await it.

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
      CombatScene.ts       — Phaser combat display zone (enemy sprite, HP bars, animations; sceneReady guard pattern)
    managers/              QuizManager, StudyManager, SaveManager, AudioManager,
                           relicEffectResolver, CelebrationManager, GaiaManager,
                           AchievementManager, InventoryManager, CombatManager,
                           CompanionManager, EncounterManager
    systems/               ParticleSystem, ScreenShakeSystem, SessionTracker,
                           CameraSystem, AnimationSystem, TextureAtlasLRU,
                           CombatParticleSystem.ts, CombatAtmosphereSystem.ts, StatusEffectVisualSystem.ts, ...
    entities/              Player, Boss, Creature
  services/
    encounterBridge.ts     — Wires flow → deck → enemy → turns → display (async startEncounterForRoom with factsDB init guard). Applies post-encounter healing (with boss/mini-boss bonus) and early mini-boss HP reduction.
    gameFlowController.ts  — Screen routing + run lifecycle
    turnManager.ts         — Turn-based encounter logic
    deckManager.ts         — Draw/discard/shuffle/exhaust
    cardFactory.ts         — Creates Card from Fact + ReviewState
    runPoolBuilder.ts      — Builds 120-fact run pool (30/25/45 split) with subcategory balancing (max 35% per subcategory within a domain)
    enemyManager.ts        — Creates enemies, floor scaling, intent rolling, block/damage resolution. Exports `getFloorDamageScaling(floor)` (+3%/floor above 6). Applies per-turn damage caps via `ENEMY_TURN_DAMAGE_CAP` and `getSegmentForFloor()`. Implements charge mechanic: `isCharging` flag, `chargedDamage` storage, `bypassDamageCap` intent flag for automatic deferred attacks.
    floorManager.ts        — Floor/room/boss/mini-boss generation
    runManager.ts          — Run stats recording
    runSaveService.ts      — Save/resume active run to localStorage
    juiceManager.ts        — Game juice effects (haptics, sounds, particles)
    domainResolver.ts      — Maps fact categories to card domains/types
    studyPresetService.ts  — Study preset CRUD (up to 10 named presets)
    presetPoolBuilder.ts   — Resolves study mode into domain + subcategory filters
    masteryScalingService.ts — Anti-cheat mastery scaling (reward multiplier + timer boost)
    factsDB.ts, saveService.ts, sm2.ts, quizService.ts, audioService.ts, ...
  ui/
    components/
      CardCombatOverlay.svelte  — Bottom 45% interaction zone, enemy intent panel, enemy name header (color-coded by category), floor info, bounty strip (bottom-right above End Turn), end turn button with gold pulse, 3-phase card animation orchestration (reveal→mechanic→launch) via setTimeout chains and animatingCards buffer pattern
      CardHand.svelte           — Fanned arc hand (30° spread, 20px arc offset), green glow on playable cards, AP cost badges, tap-to-select + tap/swipe-to-cast, touch drag with opacity fade, dual-face card DOM (front/back with backface-visibility), 31 @keyframes mechanic animations, animatingCards buffer rendering, cardback preloading, reduced-motion support
      CardExpanded.svelte       — Quiz panel positioned above card hand (fixed, bottom: calc(45vh - 20px)), no overlap with hand
      ComboCounter.svelte       — Knowledge combo display
      DamageNumber.svelte       — Floating damage numbers
      DomainSelection.svelte    — Run-start domain picker (legacy, replaced by StudyModeSelector for run setup)
      DeckBuilder.svelte        — Study preset creation/editing (tab within Library screen)
      StudyModeSelector.svelte  — Hub dropdown: All Topics, saved presets, languages, Build New Deck
      RoomSelectionOverlay.svelte — 3-door room chooser
      RestRoomOverlay.svelte    — Rest site (heal/upgrade)
      MysteryEventOverlay.svelte — Random event resolution
      RunEndOverlay.svelte      — Post-run summary
      CampfireCanvas.svelte    — Canvas2D campfire overlay with streak-based intensity
      + 150 other Svelte components (HUD, QuizOverlay, Settings, ...)
    effects/
      CampfireEffect.ts      — Streak-linked fire particle simulation (3 intensity levels)
      HubAmbientEffects.ts   — Camp sprite CSS micro-animations (breathe, sway, spark)
    utils/
      cardbackManifest.ts    — Build-time manifest (import.meta.glob) for cardback WebP images; exports hasCardback(factId), getCardbackUrl(factId)
      mechanicAnimations.ts  — Maps 31 mechanic IDs to CSS animation classes; exports timing constants (REVEAL_DURATION=400, MECHANIC_DURATION=500, LAUNCH_DURATION=300), CardAnimPhase type, getMechanicAnimClass(), getTypeFallbackAnimClass()
    stores/                gameState, playerData, settings
  data/
    card-types.ts          — Card, CardRunState, CardType, FactDomain types
    flagManifest.ts        — Maps 218 country names to flag SVG URLs; exports getFlagUrl(countryName), getFlagUrlBySlug(slug)
    studyPreset.ts         — StudyPreset, DeckMode types (preset selection + mastery scaling)
    enemies.ts             — Enemy template definitions
    balance.ts             — (extended with card combat constants)
    types.ts, biomes.ts, relics/ (types, starters, unlockable, index), saveState.ts, ...
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

StudyModeSelector.svelte (hub)
  → services/studyPresetService (preset CRUD, up to 10 presets)
  → data/studyPreset (StudyPreset, DeckMode types)

presetPoolBuilder
  → services/studyPresetService (resolve selected DeckMode)
  → services/runPoolBuilder (feed resolved domain/subcategory filters)
  → services/factsDB (query available facts for pool size warnings)

masteryScalingService
  → ui/stores/playerData (FSRS review states for mastery % calculation)
  → data/balance (scaling tier thresholds, reward multipliers)
```

## 13. Content Pipeline Architecture

```
Raw Data Sources (Wikidata, APIs, manual)
    ↓
Haiku Agent Transform (Claude Code Agent tool, model: "haiku")
  - Assesses fact worth (rejects boring/trivial)
  - Writes quiz question, answer, distractors, explanation
  - Scores funScore (1-10), difficulty (1-5)
  - Generates 2+ variants
  - Marks _haikuProcessed: true
    ↓
QA Validation (automated scripts)
  - Distractor blocklist enforcement
  - Format validation (question length, answer completeness)
  - _haikuProcessed flag check
  - Taxonomy validation (categoryL2)
    ↓
Promotion to Database
  - promote-approved-to-db.mjs (enforce-qa-gate: true)
  - build-facts-db.mjs → public/facts.db + seed-pack.json
```

### Key Files

- `scripts/content-pipeline/qa/promote-approved-to-db.mjs` — QA gate + promotion engine
- `scripts/content-pipeline/qa/audit-fact-quality.mjs` — Quality audit with blocklist validation
- `scripts/build-facts-db.mjs` — SQLite DB builder + seed-pack generator
- `src/data/seed/*.json` — Seed fact files (source of truth)
- `.claude/skills/manual-fact-ingest-dedup/SKILL.md` — Full pipeline skill documentation

### Processing Requirements

All facts MUST pass through Haiku agent processing:
- **Input validation**: Schema compliance, required fields present
- **Haiku transform**: Question/answers/variants/scoring via Agent tool
- **QA enforcement**: Blocklist check, format validation, `_haikuProcessed: true` flag required
- **No external APIs**: All processing uses Claude Code Agent tool, never `@anthropic-ai/sdk`

### CRITICAL: Distractor Generation Rules

**CRITICAL: NEVER generate distractors from database pools**

Distractors must NEVER be pulled from `correct_answer` values of other facts in the same domain/subcategory. This produces semantically nonsensical garbage (e.g., bird species names as distractors for behavior questions). On March 12, 2026, 58,359 garbage distractors had to be stripped from the database.

**REQUIREMENT:** ALL distractors MUST be generated by an LLM (GPT-5.2+ or Haiku agent) that:
- Reads the specific question and understands what's being asked
- Produces plausible wrong answers semantically coherent with the question
- Matches format and length of the correct answer
- Ensures answers are factually wrong but plausible to a student
- Draws from LLM world knowledge, NEVER from database queries

**ONLY permitted DB use:** POST-GENERATION VALIDATION — checking that a generated distractor doesn't accidentally match another fact's correct answer.

**PERMANENTLY BANNED:** Scripts like `mine-distractors.mjs` or any `SELECT correct_answer FROM facts WHERE category = ...` approach for distractor generation.

## 13.5. Japanese Language Content Pipeline

Parallel pipeline for extracting and merging JLPT-structured Japanese facts (vocabulary, kanji, grammar, kana).

### Source Files

- `data/references/full-japanese-study-deck/` — Cloned FJSD repo with:
  - Vocab IDs mapped to JLPT levels (N5–N1)
  - `kanji-info.json` — radical mappings, stroke count, JLPT assignment
  - `grammar.json` — grammar patterns, JLPT levels, example sentences
  - `kana.json` — hiragana, katakana, extended kana (dakuten, handakuten)
- `data/references/jmdict/jmdict-eng.json` — JMdict English dictionary (215,611 entries, CC-BY-SA 4.0)
- `data/raw/japanese/` — Extracted per-subdeck JSON files:
  - `vocabulary.json` — 10,013 vocab facts with JLPT level, part-of-speech, example sentence
  - `kanji.json` — 2,096 kanji facts with radical, stroke count, JLPT assignment
  - `grammar.json` — 644 grammar pattern facts with JLPT level
  - `kana.json` — 372 kana facts (hiragana, katakana, extended)

### Extraction Script

**File:** `scripts/content-pipeline/vocab/extract-fjsd-japanese.mjs`

**Input:** FJSD repo + JMdict dictionary
**Output:** `data/raw/japanese/*.json` per subdeck

**Process:**
1. Read FJSD vocab list → parse JLPT level assignments
2. Cross-reference JMdict for English meanings and example sentences
3. Normalize schema to Quiz fact structure: question, answers (3 options), explanation, fun score, difficulty
4. Separate into 4 subdecks (vocabulary, kanji, grammar, kana) per JLPT level
5. Write to `data/raw/japanese/*.json`

### Merge Script

**File:** `scripts/content-pipeline/vocab/merge-japanese-facts.mjs`

**Input:** `data/raw/japanese/*.json` per subdeck
**Output:** Facts appended to `src/data/seed/facts-generated.json`

**Process:**
1. Read all `data/raw/japanese/*.json` files
2. For each fact:
   - Add `targetLanguage: 'ja'`, `subdeck: 'vocabulary'|'kanji'|'grammar'|'kana'`
   - Include `jlptLevel` (N5–N1)
   - Generate `visualDescription` using Japanese cultural theming (see GAME_DESIGN.md § 21.5)
   - Create Tier 1 and reverse Tier 2 variants (if applicable)
3. Append to `src/data/seed/facts-generated.json`

### Database Build

**File:** `scripts/build-facts-db.mjs` (unchanged)

**Input:** `src/data/seed/facts-generated.json` (now includes 13,125 Japanese facts)
**Output:** `public/facts.db` + `seed-pack.json`

**Indexing:** Facts indexed by:
- `id` (unique)
- `targetLanguage` = 'ja'
- `subdeck` ∈ {vocabulary, kanji, grammar, kana}
- `jlptLevel` ∈ {N5, N4, N3, N2, N1}

Enables filtered queries: `SELECT * FROM facts WHERE targetLanguage='ja' AND jlptLevel='N5'`

### Data Flow Diagram

```
FJSD repo (vocab.json, kanji-info.json, grammar.json, kana.json)
+ JMdict (jmdict-eng.json, 215K entries)
  ↓
extract-fjsd-japanese.mjs
  ├→ Parse vocab IDs + JLPT mapping
  ├→ Cross-reference JMdict meanings
  ├→ Normalize to Quiz schema
  └→ data/raw/japanese/
     ├→ vocabulary.json (10,013)
     ├→ kanji.json (2,096)
     ├→ grammar.json (644)
     └→ kana.json (372)
  ↓
merge-japanese-facts.mjs
  ├→ Add targetLanguage='ja', subdeck, jlptLevel
  ├→ Generate cultural visualDescriptions
  ├→ Create Tier 1/2 variants
  └→ src/data/seed/facts-generated.json (13,125 appended)
  ↓
build-facts-db.mjs
  ├→ Normalize schemas (correctAnswer, distractors)
  ├→ Index by language, subdeck, JLPT level
  └→ public/facts.db (13,125 Japanese facts searchable)
```

### Versioning & Updates

- FJSD repo pinned to specific commit for reproducibility
- JMdict updated quarterly; version stored in `seed-pack.json` metadata
- Re-run extraction scripts to refresh; `merge-japanese-facts.mjs` deduplicates by ID
- Build cache: clear `public/facts.db` before rebuild if sources changed
