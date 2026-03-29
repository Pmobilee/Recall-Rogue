# Recall Rogue Architecture (V8 — Card Roguelite, v3 Curated Deck System)

Every card is a fact. Learning IS gameplay.

## 1. System Overview

```
Tech Stack: Vite 7 + Svelte 5 + TypeScript 5.9 + Phaser 3 + Capacitor (Android/iOS) + Tauri v2 (Desktop/Steam)
Three game systems: Card Combat, Curated Deck Selection, Run Progression
Data: sql.js fact database (4,537 facts, expandable to 20,000+)
Persistence: localStorage (profile-namespaced), optional cloud sync
```

Primary boot path:

1. `src/main.ts` mounts Svelte app, initializes player save.
2. `CardApp.svelte` `onMount` checks localStorage for `recall-rogue-boot-anim-seen`. On first-ever launch (and when `skipOnboarding`/`devpreset` query params are absent), sets `showBootAnimation = true` and calls `ensurePhaserBooted(true)`.
3. `CardGameManager.boot(startAnimation)` creates the Phaser game. When `startAnimation = true`, `BootAnimScene` is prepended to the scene list and runs automatically as the first scene.
4. `BootAnimScene` plays the 8-second cinematic intro. On completion, it emits `boot-anim-complete` on `game.events`.
5. `CardApp` listens for `boot-anim-complete`, waits 100 ms (so the Svelte hub renders behind), then sets `showBootAnimation = false` and calls `mgr.stopBootAnim()`. The `recall-rogue-boot-anim-seen` flag is written to localStorage so the animation never plays again.
6. Normal path (returning players): `CardGameManager.boot()` is called on-demand (first combat entry) without `BootAnimScene`.
7. `encounterBridge.ts` wires game flow controller into deck/enemy/turn systems and CombatScene display. `startEncounterForRoom()` is async and calls `await factsDB.init()` if the DB is not yet ready (guards against race conditions).
8. `factsDB.init()` loads `public/facts.db` in parallel for quiz/card content.

## 2. Layer Architecture

```
┌─────────────────────────────────────────────────┐
│  Svelte UI Layer                                │
│  Card hand, answer buttons, dungeon map,         │
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
- **Card Frame Asset Pipeline** (`scripts/process-cardframes.mjs`): Sharp-based script processes source card frame PNGs from `data/generated/CARDFRAMES/Unedited/` (organized by mechanic category: Attack, Defence, Buff, Debuff, Utility, Wild) into mobile-ready frames with dual-resolution variants (hires `.webp` + lowres `_1x.webp`) in `public/assets/cardframes/`. Output structure: `{mechanic}-{frameIndex}.webp` and `{mechanic}-{frameIndex}_1x.webp`. Device-tier selection: Standard devices load hires, low-end devices load lowres. Frame preloading handled by `cardFrameManifest.ts` at hand initialization.
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

After answering a quiz (Charge play) or resolving at base power (Quick Play), cards go through an animation sequence using the layered V2 card frame system. State: `CardAnimPhase = 'reveal' | 'swoosh' | 'impact' | 'discard' | 'fizzle' | null`.

**Quick Play (no quiz):**
- Card resolves immediately at base power, no reveal phase.
- **Swoosh → Impact → Discard** at reduced intensity.

**Charge — Correct answers:**
- **Reveal** (250ms): Card flips to cardback using CSS 3D `rotateY(180deg)` transformation.
- **Swoosh** (250ms): Type-specific animation plays (attack=golden slash+lunge, shield=blue pulse+rise, buff=golden radiate+expand, debuff=purple tendrils+dissolve, utility=prismatic shimmer+morph, wild=multi-color flash). Archetype-matched synthesized sound triggers.
- **Impact** (300ms): 3D directional movement toward target (enemy or center); particles and screen shake effects fire.
- **Discard** (200ms): Card minimizes and flies to discard pile indicator in **bottom-left**; discard pile count increments.

**Charge — Wrong answers (v2: partial effect, no full fizzle):**
- Card resolves at 0.7× base power (partial effect). No violent fizzle animation.
- **Fizzle** (400ms): Shake + sparks + fade out, card exits to discard pile. No combo reset (combo system removed in v2).

**Draw/discard swoosh (Web Animations API):** CSS keyframe animations were permanently replaced with WAAPI (`el.animate()`) to avoid conflicts with Svelte's inline `transform`-based fan positioning (`!important` in keyframes is ignored per spec; pile CSS vars aren't set when the `0%` frame resolves).

- **Draw swoosh**: `initCardAnimOffsets` Svelte action (in `CardHand.svelte`) fires after a double `requestAnimationFrame` to ensure `--draw-pile-x/y` CSS vars are set by `CardCombatOverlay`. Animates from the draw pile position at scale 0.05 to the card's inline fan `transform` as end state. `composite: 'replace'` mode. Staggered 80ms per card.
- **Ghost card discard**: `ghostCardAnim` Svelte action uses a `MutationObserver` to detect `card-discard` class on ghost cards. Fires WAAPI from current `getBoundingClientRect()` to discard pile viewport coords (`--discard-pile-x/y` CSS vars). 200ms duration.
- **Fizzle**: Same `ghostCardAnim` action detects `card-fizzle` class. Identical trajectory but with `filter: grayscale(1)` at the end keyframe and 400ms duration.
- **End-of-turn**: `handleEndTurn()` queries `.card-in-hand:not(.card-animating)`, triggers staggered WAAPI (250ms + 40ms stagger), calls `onendturn()` after `Promise.all` on animation finish events.
- **Reshuffle hold**: `reshuffleHoldingHand` state in `CardCombatOverlay` keeps `handCards` empty during the reshuffle animation. When shuffle completes, cards mount and `initCardAnimOffsets` swooshes them from the refilled draw pile.

**Card frame system (V2 — AR-107):**
- 3 composited layers extracted from master PSD (`data/generated/camp-art/NEW_CARD.psd`, 886×1142px): border (hue-shifted by card type), base frame (constant), banner (hue-shifted by chain type)
- 14 WebP files in `public/assets/cardframes/v2/`: 1 base + 6 borders (one per card type) + 6 banners (one per chain type) + 1 upgrade icon; plus lowres variants
- `cardFrameV2.ts` utility module provides URL getters and PSD-derived guide positions for CSS text overlays
- Text overlays rendered via CSS at guide positions: AP cost (yellow Cinzel bold in book icon area, red/green for cost changes), mechanic name (Cinzel on banner), card type label, and effect description
- Upgrade icon bobs gently on L1+ mastery cards; gold glow aura at L5
- `cardFrameV2.ts` exports `getMasteryIconFilter(level)` (CSS filter for color-coded icon tint) and `hasMasteryGlow(level)` (true at L5)
- Python extraction script `scripts/extract-card-frame.py` — crops PSD layers and applies black-preserving hue-shift to generate all color variants

**Ghost card (animation buffer) pattern**: Cards are copied to an `animatingCards` array before logical removal from the hand. A separate `{#each animatingCards}` loop renders non-interactive ghost copies. The `ghostCardAnim` Svelte action on each ghost uses a `MutationObserver` to detect CSS class changes (`card-discard`, `card-fizzle`) and triggers the appropriate WAAPI exit animation. Ghosts are cleaned from the buffer after animation completes. This prevents cards from disappearing mid-animation when hand state updates.

**Cardback discovery**: `cardbackManifest.ts` uses `import.meta.glob` at build time to discover which facts have cardback WebP images in `/public/assets/cardbacks/lowres/`. Images are preloaded via Svelte `$effect` when cards enter the hand.

**Card frame manifest**: `cardFrameManifest.ts` provides runtime URLs for card frame images, managing hires/lowres variants based on device capabilities.

**Reduced motion**: `@media (prefers-reduced-motion: reduce)` replaces flip + multi-phase animations with a simple fade + color flash.

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

**Screens with preloading:** HubScreen (12 camp images), DungeonMap, RestRoomOverlay, ShopRoomOverlay, MysteryEventOverlay, CardRewardScreen, RunEndScreen, CombatScene. (RetreatOrDelve removed in v2 — no retreat flow.)

### Service Layer

Located in `src/services/`:

| Service | File | Status |
|---------|------|--------|
| Quiz engine | `quizService.ts` | EXISTS — reuse |
| FSRS scheduler | `sm2.ts` | EXISTS — file still named sm2.ts but uses ts-fsrs internally. v3: decoupled from combat power; used for scheduling + knowledge tracking only. |
| Facts database | `factsDB.ts` | EXISTS — reuse, extend schema |
| Save/load | `saveService.ts` | EXISTS — reuse |
| Audio | `audioService.ts` | Built — 6 new synthesized sounds for card animation archetypes (golden slash, blue pulse, golden radiate, purple tendrils, prismatic shimmer, fizzle); impact and discard SFX |
| Analytics | `analyticsService.ts` | EXISTS — reuse |
| API client | `apiClient.ts` | EXISTS — reuse |
| Profile mgmt | `profileService.ts` | EXISTS — reuse |
| Platform detection | `platformService.ts` | Built (AR-72) — `platform: 'mobile' | 'desktop' | 'web'`; `isDesktop`, `isMobile`, `isWeb`, `hasSteam` exports |
| Haptics | `hapticService.ts` | EXISTS — mobile-only; guarded by `isMobile` (no-op on desktop/web) |
| Push notifications | `notificationService.ts` | Built — 4 types, local scheduling via Capacitor; guarded by `isMobile` |
| Funness boost | `funnessBoost.ts` | Built — new player bias toward higher-funScore facts (runs 0–99, linear decay) |
| Surge system | `surgeSystem.ts` | Built (v2) — Surge turn timing (turns 2, 5, 8, …), state flags, Surge multiplier application |
| Chain system | `chainSystem.ts` | Built (AR-70) — Knowledge Chain tracking, chainType (0-5) sequence, chain multiplier calculation |
| Chain visuals | `chainVisuals.ts` | Built (AR-70) — chainType (0-5) → 6-color palette mapping via `chainTypes.ts`; chain counter display state |
| Boss quiz phase | `bossQuizPhase.ts` | Built (v2) — Boss quiz phase logic, sequential question flow, pass/fail thresholds |
| Discovery system | `discoverySystem.ts` | **REMOVED (v3)** — Free First Charge system eliminated. File deprecated. |
| In-Run FSRS | *(integrated into encounterBridge / runManager)* | v3 — Lightweight per-run knowledge tracker. Tracks `correctCount`, `wrongCount`, `confusedWith` per fact within a run. Seeded from global FSRS at run start. |
| Confusion Matrix | *(integrated into saveService / runManager)* | v3 — Persistent cross-run tracker of which facts players confuse with each other. Used to select adaptive distractors. |
| Curated Deck Loader | *(integrated into encounterBridge / runPoolBuilder)* | v3 — Loads selected curated deck at run start; provides deck fact pool, answer type pools, chain themes, synonym groups. |
| Save migration | `saveMigration.ts` | Built (v2) — V1→V2 relic migration via `migrateRelicsV1toV2(save)`; `V1_TO_V2_RELIC_MAP` authoritative table |

### Data Layer

Located in `src/data/`:

- `types.ts` — PlayerSave, fact types (extend with card types)
- `vocabulary.ts` — Language deck types: `LanguageConfig` (extended with `subdecks` and `options`), `LanguageDeckOption` interface, VocabularyFact schema extensions for targetLanguage, jlptLevel, reading, audioUrl
- `balance.ts` — tuning constants. Includes `BASE_EFFECT`, `POST_ENCOUNTER_HEAL_PCT` (8%), `RELAXED_POST_ENCOUNTER_HEAL_BONUS`, `POST_BOSS_ENCOUNTER_HEAL_BONUS`, `EARLY_MINI_BOSS_HP_MULTIPLIER` (0.60x for floors 1-3), `FLOOR_DAMAGE_SCALING_PER_FLOOR` (0.03), `ENEMY_TURN_DAMAGE_CAP`. `BURN_HALVE_ON_HIT = true`, `BLEED_BONUS_PER_STACK = 1`, `BLEED_DECAY_PER_TURN = 1`, `INSCRIPTION_EXHAUST_ON_PLAY = true`, `SIPHON_STRIKE_MAX_HEAL = 10`. **Removed:** `COMBO_MULTIPLIERS`, `COMBO_HEAL_*`, `COMBO_DECAY_*` (combo system removed). **Removed relics:** `echo_lens`, `phantom_limb`, `echo_chamber` data entries. **Removed (v3):** `CURSED_QP_MULTIPLIER`, `CURSED_CHARGE_CORRECT_MULTIPLIER`, `CURSED_CHARGE_WRONG_MULTIPLIER`, `CURSED_FSRS_CURE_BONUS`, `CURSED_AUTO_CURE_THRESHOLD`, `FREE_FIRST_CHARGE_EXEMPT_FROM_CURSE` (cursed card system removed).
- `saveState.ts` — run state shape (RunSaveState); includes ActMap in run save state. **v3 fields:** `deckId: string` (selected curated deck for this run), `inRunFSRS: Map<string, InRunFactState>` (per-run fact performance tracker), `confusionEntries: ConfusionEntry[]` (confusion pairs recorded this run). **Removed (v3):** `cursedFactIds: string[]` (cursed card system removed), `firstChargeFreeFactIds` (Free First Charge removed).
- `curatedDeck.ts` — **NEW (v3):** `CuratedDeck`, `DeckFact`, `AnswerTypePool`, `SynonymGroup`, `ChainTheme`, `QuestionTemplate` interfaces.
- `confusionMatrix.ts` — **NEW (v3):** `ConfusionEntry` interface, persistent cross-run confusion tracking.
- `curatedDeckTypes.ts` — **NEW (v3):** `CuratedDeck`, `DeckFact`, `AnswerTypePool`, `SynonymGroup`, `QuestionTemplate` runtime types (mirrors `curatedDeck.ts` with service-facing additions).
- `deckRegistry.ts` — **NEW (v3):** Deck metadata registry mapping deck IDs to manifest entries (name, domain, subdeck list, file path).
- `deckFactIndex.ts` — **NEW (v3):** Deck/sub-deck to fact ID mapping index; enables fast `getFactsForDeck(deckId)` without full JSON parse.
- `vocabularyTemplates.ts` — **NEW (v3):** Standard vocabulary deck question templates (forward, reading, reverse, synonym_pick, definition_match); gated by mastery level.
- `card-types.ts` — Expansion: `isInscription?: boolean` and `isRemovedFromGame?: boolean` added to Card interface for Inscription keyword support.
- Map types (`src/services/mapGenerator.ts`) — `ActMap` (rows, edges, completed nodes, current node), `MapNode` (id, row, col, type: combat|elite|boss|mystery|rest|treasure|shop, connections)
- Enemy definitions — `src/data/enemies.ts`. `EnemyInstance` interface includes `floor: number`, `difficultyVariance` (0.8–1.2x HP/damage variance), `enrageBonusDamage` (cumulative bonus added to attack damage), and `playerChargedThisTurn` (reset each enemy turn for `onPlayerNoCharge` detection). `EnemyTemplate` includes `rarity`, `spawnWeight`, `animArchetype` (8 animation types), and v2 quiz-reactive callbacks: `onPlayerChargeWrong`, `onPlayerChargeCorrect`, `onPlayerNoCharge`, `onEnemyTurnStart`. Passive flags: `quickPlayImmune` (Quick Play deals 0 damage), `chainMultiplierOverride` (caps chain multiplier). Boss templates include `quizPhases: QuizPhaseConfig[]` (hpThreshold, questionCount, timerSeconds, rapidFire). Exports `ACT_ENEMY_POOLS` (3-act pool structure) and `getEnemiesForNode(act, nodeType)` for map node enemy selection.
- Enemy animations — `src/data/enemyAnimations.ts` — Animation archetype configs (8 types). Defines `AnimConfig` interface with tween parameters and `getAnimConfig(archetype)` resolver. Pure data, no Phaser/Svelte imports.
- Card type mappings — `src/data/card-types.ts`
- Chain type definitions — `src/data/chainTypes.ts` — AR-70: `CHAIN_TYPES` array with 6 entries (Obsidian, Crimson, Azure, Amber, Violet, Jade), each with `index`, `name`, `hexColor`, `glowColor`. Exports `getChainTypeName(index)`, `getChainTypeColor(index)`, `getChainTypeGlowColor(index)`.

## 3. Active Systems

Core systems powering the card roguelite:

| System | Key Files | Notes |
|--------|-----------|-------|
| Quiz engine (3-pool) | `QuizManager.ts`, `quizService.ts` | Fully integrated |
| FSRS algorithm | `sm2.ts`, `StudyManager.ts` | Spaced repetition scheduler (ts-fsrs); v3: decoupled from combat power, used for scheduling + knowledge tracking only |
| Facts database | `factsDB.ts`, `public/facts.db` | Domain fact store |
| Relic system | `relicEffectResolver.ts`, `relicAcquisitionService.ts`, `src/data/relics/`, `saveMigration.ts` | Complete — 77 relics total (41 existing + 36 expansion), 5-slot system (6 with Scholar's Gambit), level-gated unlock, in-run collection, V1→V2 migration. Echo Chamber removed. V2 hooks: `resolveChargeCorrectEffects`, `resolveChargeWrongEffects`, `resolveChainCompleteEffects`, `resolveSurgeStartEffects`. Expansion hooks: Burn/Bleed resolution, Inscription persistence, Dragon's Heart elite/boss kills, Soul Jar guaranteed-charge accumulation. AR-116 wired: `vitality_ring`, `merchants_favor`, `blood_price`, `crit_lens`, `scholars_crown`, `aegis_stone`, `domain_mastery_sigil`, `herbal_pouch`. **v3 note:** `scholars_crown` no longer grants Tier 3 auto-charge (removed). `akashic_record` Tier 3 auto-charge 1.5× bonus removed. `scar_tissue` cursed card reference removed (cursed system removed). `dark_knowledge` "per cursed fact" scaling removed. `deja_vu` "previously-correct fact" mechanic removed (facts now assigned at charge time). |
| Audio manager | `AudioManager.ts`, `audioService.ts` | |
| Save/load | `saveService.ts` | Full player save via `runManager.ts` for in-run state |
| Event bus | `src/events/EventBus.ts`, `src/events/types.ts` | |
| Achievement tracking | `AchievementManager.ts` | Stub — not fully implemented |
| Session tracking | `SessionTracker.ts`, `sessionTimer.ts` | |
| Particle system | `ParticleSystem.ts` | Card effect visuals |
| Screen shake | `ScreenShakeSystem.ts` | |

## 4. Systems Architecture

### Implemented (P0)

| System | File(s) | Status |
|--------|---------|--------|
| Card entity & types | `src/data/card-types.ts` | Built |
| Card factory | `src/services/cardFactory.ts` | Built |
| Domain resolver | `src/services/domainResolver.ts` | Built |
| Deck manager | `src/services/deckManager.ts` | Built |
| Run pool builder | `src/services/runPoolBuilder.ts` | Built — v3: loads single curated deck instead of multi-domain mix; no archetype-based pool building |
| Funness boost | `src/services/funnessBoost.ts` | Built — new player bias toward higher-funScore facts (runs 0–99) |
| Turn manager | `src/services/turnManager.ts` | Built (v2) — Quick Play / Charge branching; Surge integration (surgeSystem); chain tracking per turn (chainSystem); combo system fully removed (no comboCount, no COMBO_MULTIPLIERS). AR-113: upgrades card mastery on correct Charge, downgrades on wrong Charge (once per card per encounter via `masteryChangedThisEncounter` flag). Inscription persistence (`activeInscriptions: ActiveInscription[]` on TurnState, `resolveInscription()` helper); Iron inscription block on `endPlayerTurn` turn-start; Stagger enrage-tick handling; Soul Jar guaranteed-charge button state. **v3:** fact assignment happens at charge-commit time, not draw time; Free First Charge and cursed card detection removed. |
| Enemy manager | `src/services/enemyManager.ts` | Built — includes `getFloorDamageScaling(floor)` (+3%/floor above 6), `getSegmentForFloor(floor)`, and per-turn damage caps via `ENEMY_TURN_DAMAGE_CAP` |
| Floor manager | `src/services/floorManager.ts` | Built |
| Game flow controller | `src/services/gameFlowController.ts` | Built (v2) — 3-act run flow; no retreat-or-delve branch; no archetype selection; no starter relic selection; routes directly to dungeonMap at run start |
| Encounter bridge | `src/services/encounterBridge.ts` | Built (v2) — Fixed 10-card starter deck; removed archetype-based pool building; Echo system fully removed; post-encounter healing. Inscription detection on card play (moves card from discard to exhaust, marks `isRemovedFromGame`; Wisdom CW skips registration), Fury bonus passed into `AdvancedResolveOptions`, Wisdom CC trigger (draw 1 + optional heal 1 HP), `activeInscriptions` preserved in `freshTurnState`. **v3:** loads single curated deck at run start; cards drawn without facts — fact selected at charge-commit time; cursed card detection removed. |
| Surge system | `src/services/surgeSystem.ts` | Built (v2) — Surge turn timing (turns 2, 5, 8, …); `isSurgeTurn(turnNumber)`, `getSurgeMultiplier()`. Surge doubles all Charge multipliers; visually signaled one turn in advance |
| Chain system | `src/services/chainSystem.ts` | Built (AR-70) — Per-turn chainType tracking; `extendOrResetChain(chainType, override?)`, `getChainMultiplier(length)`, `getChainState()`. Chain resets on chainType change. **v3:** knowledge decks use deck-specific chain themes (thematic sub-groups, 3 active per run); vocabulary decks use generic 6-type system. |
| Chain visuals | `src/services/chainVisuals.ts` | Built (AR-70) — `getChainColor(chainType)` and `getChainGlowColor(chainType)` map chainType 0-5 to 6-color palette from `chainTypes.ts`; `getChainColorGroups(cards)` groups cards by shared chainType |
| Boss quiz phase | `src/services/bossQuizPhase.ts` | Built (v2) — Sequential boss quiz questions; `startBossQuizPhase(config)`, pass/fail threshold tracking; integrates with bossQuizPhase QuizPhaseConfig on enemy templates |
| Discovery system | `src/services/discoverySystem.ts` | **REMOVED (v3)** — Free First Charge eliminated. File deprecated. |
| Save migration | `src/services/saveMigration.ts` | Built (v2) — `migrateRelicsV1toV2(save)` walks all 50 v1 relic IDs and applies preserve/rename/auto_unlock/refund/drop actions per `V1_TO_V2_RELIC_MAP` |
| Run manager | `src/services/runManager.ts` | Built |
| Juice manager | `src/services/juiceManager.ts` | Built |
| Cardback manifest | `src/ui/utils/cardbackManifest.ts` | Built |
| Card frame V2 utility | `src/ui/utils/cardFrameV2.ts` | Built — URL getters for V2 layered card frame WebP assets and PSD-derived guide positions for CSS text overlays; `getMasteryIconFilter(level)`, `hasMasteryGlow(level)` for AR-113 mastery visuals |
| Card description service | `src/services/cardDescriptionService.ts` | Built — `getShortCardDescription()` for parchment text rendering; AR-113: supports `mastery-bonus` CardDescPart type — renders base+bonus format ("Deal 8+2 damage") with bonus in green |
| Card frame extractor | `scripts/extract-card-frame.py` | Built — PSD extraction + black-preserving hue-shift pipeline; crops layers from master PSD and regenerates all 14 color variant WebP files for V2 card frames |
| Flag manifest | `src/data/flagManifest.ts` | Built — maps 218 country names to flag SVG URLs in `/public/assets/flags/` |
| Mechanic animations | `src/ui/utils/mechanicAnimations.ts` | Built — 5-phase animation system with archetype-specific effects and synthesized audio |
| CombatScene | `src/game/scenes/CombatScene.ts` | Built — Delegates enemy sprite rendering and animation to EnemySpriteSystem |
| Enemy sprite system | `src/game/systems/EnemySpriteSystem.ts` | Built — Encapsulates all 88 enemy rendering with sharp-processed PNG assets. 3D paper cutout effect (shadow + outline layers), config-driven idle/attack/hit/death animations via `setAnimConfig(archetype)` method (8 animation archetypes from `src/data/enemyAnimations.ts`). Aspect-ratio-preserving scaling, device-tier texture selection (.webp vs _1x.webp), placeholder display for missing sprites. |
| CardGameManager | `src/game/CardGameManager.ts` | Built |
| CardApp (root) | `src/CardApp.svelte` | Built |
| Card hand UI | `src/ui/components/CardHand.svelte` | Built — card rendering uses V2 layered card frame system (composited border + base + banner WebP layers with CSS text overlays); supports hires/lowres variants based on device capabilities. AR-116: charge preview uses 1.5× + mastery bonus; old upgrade border removed; AP cost font uses thicker 2px stroke + stronger shadows. **v3:** cards no longer display fact text / question on face — show mechanic + chain theme + mastery only. |
| Card expanded UI | `src/ui/components/CardExpanded.svelte` | Built — AR-76: landscape branch centers quiz in left-70% center stage (above 26vh card hand), 2×2 answer grid, `kbd-hint` badges, inputService QUIZ_ANSWER wiring with 150ms highlight flash, card hand dimming via `quizVisible` prop on CardHand. **v3:** no visible quiz timer — invisible internal timer only (used for relic triggers and leaderboard scoring). |
| Card combat overlay | `src/ui/components/CardCombatOverlay.svelte` | Built — synergy flash UI element; v2: boss quiz phase overlay rendered inline; AR-116: relic sell removed during combat (info-only tooltip), AP orb lowered to `bottom: 35vh`, enemy intent padding increased, damage popup uses mastery + charge values. Expansion: exhaust pile count tap target (purple ✕ indicator) + ExhaustPileViewer overlay integration. |
| Card browser | `src/ui/components/CardBrowser.svelte` | NEW (AR-204) — shared mid-combat card list overlay used by Tutor, Mimic CC, Scavenge, and Siphon Knowledge. Portrait: full-screen. Landscape: right-panel. Supports select/view modes, showAnswers, timer, data-testid. |
| Multi-choice popup | `src/ui/components/MultiChoicePopup.svelte` | NEW (AR-204) — generic 2–4 option choice modal. Used by Unstable Flux CC and Phase Shift QP. Min 48px tap targets, forcePick, keyboard Escape support. |
| Card picker overlay | `src/ui/components/CardPickerOverlay.svelte` | Reusable mid-combat card selection overlay. Shows 3 cards on a dark backdrop with floating/bobbing animations. Supports single-pick and multi-pick (`pickCount` prop). Always includes a Skip button. Integrated via `pendingCardPick` field in `CardEffectResult` → `CardCombatOverlay` state management. Follows the same deferred-choice pattern as Phase Shift's `pendingChoice`. Used by: Transmute (self-transform), Adapt (form selection), Scavenge (discard retrieval), Mimic (copy target), Conjure (summon), Forge (mastery boost target). |
| Exhaust pile viewer | `src/ui/components/ExhaustPileViewer.svelte` | NEW (AR-204) — thin CardBrowser wrapper showing all exhausted cards including Inscriptions (which are "remove from game" on exhaust). |
| Chain counter | `src/ui/components/ChainCounter.svelte` | Chain-only display (AR-116 / expansion) — combo counter fully removed. Renders chain length + multiplier at bottom-left in chain type color, format "Chain: X.x". `ComboCounter.svelte` has been removed; `comboDisplay.ts` has been deleted. |
| Damage numbers | `src/ui/components/DamageNumber.svelte` | Built |
| Domain selection | `src/ui/components/DomainSelection.svelte` | **ARCHIVED** — Deprecated; replaced by curated deck selection (domain → deck → optional sub-deck) |
| Deck builder | `src/ui/components/DeckBuilder.svelte` | Built — study preset creation/editing within Library screen; **v3:** replaced for run setup by curated deck selection system |
| Study mode selector | `src/ui/components/StudyModeSelector.svelte` | Built — hub dropdown; **v3:** replaced by curated deck selection flow |
| Room selection overlay | `src/ui/components/RoomSelectionOverlay.svelte` | Built — preserved as fallback for pre-map saves |
| **Deck Selection Screens (3-Screen System, AR-244)** | | |
| Deck Selection Hub | `src/ui/components/DeckSelectionHub.svelte` | Hero split-screen mode selector (Trivia Dungeon vs Study Temple) |
| Trivia Dungeon Screen | `src/ui/components/TriviaDungeonScreen.svelte` | Trivia mode: DomainStrip + LoadoutCards + SubcategoryChips |
| Study Temple Screen | `src/ui/components/StudyTempleScreen.svelte` | Study mode: CategoryTabs + DeckTileV2 grid + DeckDetailModal |
| Domain Strip Card | `src/ui/components/DomainStripCard.svelte` | Individual domain card in horizontal trivia mode strip |
| Loadout Card | `src/ui/components/LoadoutCard.svelte` | Loadout card showing selected domain + subcategory filter state |
| Subcategory Chip | `src/ui/components/SubcategoryChip.svelte` | Toggleable subcategory filter chips |
| Category Tabs | `src/ui/components/CategoryTabs.svelte` | Tab switcher for study mode (All, Languages, History, Science, etc.) |
| Deck Tile V2 | `src/ui/components/DeckTileV2.svelte` | Study mode individual deck tile with gradient art, progress bar, status badge |
| Deck Detail Modal | `src/ui/components/DeckDetailModal.svelte` | Centered 640px modal for deck inspection + sub-deck selection |
| Deck Search Bar | `src/ui/components/DeckSearchBar.svelte` | Study mode search filter for decks and subcategories |
| Deck Sort Dropdown | `src/ui/components/DeckSortDropdown.svelte` | Study mode sort control (A-Z, progress, fact count) |
| Deck Filter Chips | `src/ui/components/DeckFilterChips.svelte` | Study mode filter toggles (in-progress, not-started, mastered) |
| Language Group Header | `src/ui/components/LanguageGroupHeader.svelte` | Language section header in study mode vocabulary tab |
| Playlist Bar | `src/ui/components/PlaylistBar.svelte` | Bottom toolbar for custom playlist selection/management |
| Deck Registry | `src/services/deckRegistry.ts` | Curated deck metadata registry (deck IDs → manifest entries) |
| Deck Fact Index | `src/services/deckFactIndex.ts` | Fast deck/sub-deck → fact ID mapping lookup |
| Deck Progress Service | `src/services/deckProgressService.ts` | FSRS-based progress aggregation per deck |
| Language Settings | `src/services/languageSettingsService.ts` | Per-language display option persistence (furigana, romaji, etc.) |
| Per-Language Settings UI | `src/ui/components/LanguageSettingsPanel.svelte` | Settings cog panel for language-specific options |
| Dungeon map | `src/ui/components/DungeonMap.svelte` | Built — scrollable vertical act map with SVG paths and HTML nodes |
| Map node | `src/ui/components/MapNode.svelte` | Built — 44px circle node button, type-coded by icon/color |
| Map generator | `src/services/mapGenerator.ts` | Built — ActMap/MapNode types, generateActMap(), selectMapNode(), navigation helpers. Boss selection uses seeded RNG to pick randomly from a 2-boss pool per region (Shallow Depths, Deep Caverns, The Abyss, The Archive). AR-116: post-processing step enforces exact room counts per floor: row 0 = combat, 1 rest in rows 1–5, 2 shops (2+ rows apart), 2 mystery rooms (not on shop rows), row 6 = rest (pre-boss), row 7 = boss. |
| Map cinematic | `src/ui/components/DungeonMap.svelte` | Built — Floor-entry cinematic: 1.5× zoom on boss node (~1s), zoom-out to full map, camera sweep to starting nodes. Boss node renders actual boss sprite (3D float animation). Elite nodes show purple menacing pulse. Tracked by map seed — plays once per floor. |
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
| Study preset CRUD | `src/services/studyPresetService.ts` | Built — **v3:** superseded by curated deck selection for run setup |
| Preset pool builder | `src/services/presetPoolBuilder.ts` | Built — resolves study mode into domain + subcategory filters; **v3:** superseded by curated deck loader |
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
| Room backgrounds | `public/assets/backgrounds/rooms/{type}/landscape.webp` | Per-room-type (treasure, shop, rest, mystery, descent) with depth maps |
| Reward room BG | `public/assets/reward_room/reward_room_bg.webp` | Post-combat altar scene — stone with cloth spawn zone for floating reward icons |
| Reward spawn zone | `public/assets/reward_room/cloth_spawn_zone.json` | Defines the cloth region on the altar where cards/vials/gold float |
| Firefly background | `src/ui/components/FireflyBackground.svelte` | Built |
| Game frame (responsive) | `src/CardApp.svelte` (`.card-app` CSS) | Built |
| Layout mode store | `src/stores/layoutStore.ts` | AR-71 — NEW |
| Layout constants (landscape) | `src/data/layout.ts` | AR-71 — extended |
| Input service (pub/sub) | `src/services/inputService.ts` | AR-74 — NEW |
| Keyboard input module | `src/services/keyboardInput.ts` | AR-74 — NEW |
| Keyboard shortcut help overlay | `src/ui/components/KeyboardShortcutHelp.svelte` | AR-74 — UPDATED |

**Global CSS variable `--gw`** (`src/app.css`): `min(100vw, 430px)` — represents the game viewport width. Used by HubScreen sprites instead of `vw` units to ensure proper sizing within the phone frame on desktop.

**AR-71 CSS variables** (set on `:root` by `CardApp.svelte`):
- `--layout-scale` — uniform scale factor (portrait: `viewportWidth/390`, landscape: `min(vw/1280, vh/720)`)
- `--layout-scale-x` — horizontal scale (same as `--layout-scale` in portrait)
- `--layout-scale-y` — vertical scale (same as `--layout-scale` in portrait)
- `--layout-mode` — `"portrait"` or `"landscape"` string value

**AR-71 HTML attribute**: `.card-app[data-layout="portrait|landscape"]` — set on root container for CSS selector branching.

**AR-71 Phaser integration**: `CardGameManager` subscribes to `layoutMode` store and calls `game.scale.resize()` + notifies scenes via `handleLayoutChange(mode)` on change. `CombatScene` has a full landscape implementation (AR-73). `BootAnimScene` and `RewardRoomScene` still have stub handlers. `RewardRoomScene` has a double-init guard (AR-116) to prevent duplicate initialization on scene restart.

**AR-73 CombatScene landscape layout**: `handleLayoutChange(mode)` calls `repositionAll()` which branches on `currentLayoutMode`. All positioning uses helper methods `getEnemyX()`, `getEnemyY()`, `getEnemyHpBarCenter()` that return portrait or landscape coordinates respectively. The `LANDSCAPE` const object defines all landscape position percentages. Portrait code paths are never touched when in portrait mode — pure additive branching. The `CardHand` component renders a separate `.card-hand-landscape` container (fixed bottom strip, flex-row, no arc/rotation) when `$isLandscape` is true, and the original `.card-hand-container` (portrait fan) when false. `CardCombatOverlay` applies `.layout-landscape` class which repositions HUD elements via CSS.

**AR-74 Input system**: `inputService` (singleton pub/sub) decouples input sources from UI. `keyboardInput` module auto-subscribes to `layoutMode` and only binds `keydown` listeners in landscape. Components register `inputService.on(actionType, handler)` in `onMount` and call the returned unsubscribe in `onDestroy`. `CardCombatOverlay` calls `setQuizVisible()` on `cardPlayStage` change to enable context-aware key routing (1-4 = quiz answers when quiz visible, card select otherwise). `CardHand` subscribes to `SELECT_CARD` and `DESELECT`. Mouse hover tooltip in `CardHand` is gated by `$isLandscape`.

### Implemented (Deck Selection System — 3-Screen Architecture, AR-244)

**Screens:**
- `DeckSelectionHub.svelte` — Hero split-screen mode selector landing page; routes to Trivia Dungeon or Study Temple on selection
- `TriviaDungeonScreen.svelte` — Trivia Dungeon "The Armory": horizontal domain strip, loadout cards, subcategory chip filters, footer status bar with Start Run button
- `StudyTempleScreen.svelte` — Study Temple "The Library": category tabs, 4-column responsive DeckTileV2 grid, center-modal DeckDetailModal, search/sort/filter controls, playlist bar

**Trivia Dungeon Components:**
- `DomainStripCard.svelte` — toggleable domain card in horizontal strip
- `LoadoutCard.svelte` — shows selected domain + loadout state
- `SubcategoryChip.svelte` — toggleable subcategory filter chip

**Study Temple Components:**
- `CategoryTabs.svelte` — tab switcher (All, Languages, History, Science, Geography, etc.)
- `DeckTileV2.svelte` — responsive deck tile with gradient art, progress bar, status badge
- `DeckDetailModal.svelte` — centered 640px modal for deck details + sub-deck selection + Start Study Run button
- `DeckSearchBar.svelte` — study mode search filter
- `DeckSortDropdown.svelte` — sort options (A-Z, progress, fact count)
- `DeckFilterChips.svelte` — filter toggles (in-progress, not-started, mastered)
- `LanguageGroupHeader.svelte` — section header in vocabulary tab grouping decks by language
- `PlaylistBar.svelte` — bottom toolbar for saved custom playlists

**Services:**
- `deckRegistry.ts` — curated deck metadata index (deck IDs → manifest entries with name, domain, file paths)
- `deckFactIndex.ts` — fast deck/sub-deck → fact ID mapping; enables `getFactsForDeck(deckId)` lookup
- `deckProgressService.ts` — FSRS-based progress aggregation per deck (tracks mastery % across all runs)
- `languageSettingsService.ts` — persistent per-language display option store

**Data Flow:**
1. User clicks "Start Run" → `DeckSelectionHub` mounts (hero mode selector)
2. User selects Trivia Dungeon or Study Temple
3. Appropriate screen mounts (`TriviaDungeonScreen` or `StudyTempleScreen`)
4. User makes selections (domain/deck filters) and clicks "Start Run"
5. Calls `gameFlowController.startNewRun(selections)` with run config (mode, deckId, domain filters, etc.)
6. `gameFlowController` → sets up appropriate fact pool via:
   - Trivia mode: `buildTriviaRunPool(domains, subdomains)`
   - Study mode: `buildStudyRunPool(deckId)` + loads curated deck facts
   - All-language mode: `buildLanguageRunPool(languageCode)` → combines all language decks
7. Routes to `dungeonMap` screen

**State Persistence:**
- Last selected mode, domain selections, and deck choice stored in `playerSave.deckSelectionState`
- Custom playlists stored in `playerSave.customPlaylists`
- Language settings (furigana toggle, romaji toggle, etc.) stored per language in `playerSave.languageSettings`
- Screens remember previous selections on next visit

### Implemented (P0.5 — Mastery Tiers)

| System | File(s) | Status |
|--------|---------|--------|
| PassiveEffect type | `src/data/card-types.ts` | Built |
| Tier 3 passive constants | `src/data/balance.ts` (`TIER3_PASSIVE_VALUE`) | Built |
| Passive tracking in TurnState | `src/services/turnManager.ts` (`activePassives`) | Built |
| Passive bonus injection | `src/services/cardEffectResolver.ts` (`passiveBonuses` param) | Built — wild card branch now copies target type's `BASE_EFFECT` value. Expansion: Burn damage hook (step 11 of damage pipeline — add stacks then halve), Bleed damage hook (step 12 — add stacks per card-play hit, no decay on hit), Inscription of Fury flat bonus at damage pipeline step 3 (attack cards only). **v3:** Cursed multiplier removed. |
| Tier 3 extraction & FSRS wiring | `src/services/encounterBridge.ts` | Built |

### Implemented (P0.6 — Card Upgrades & Shop Enhancement)

| System | File(s) | Status |
|--------|---------|--------|
| Card upgrade definitions | `src/services/cardUpgradeService.ts` | Built — UPGRADE_DEFS mapping mechanics → bonus values (legacy static upgrades, now supplemented by AR-113 mastery system) |
| Card upgrade logic | `src/services/cardUpgradeService.ts` (upgradeCard, canUpgradeCard, getUpgradeCandidates, getUpgradePreview) | Built — legacy functions now deprecated for in-run use; AR-113 adds `masteryUpgrade(card)`, `masteryDowngrade(card)`, `getMasteryBaseBonus(card)` for continuous mastery scaling |
| Shop inventory generation | `src/services/shopService.ts` | Built — `generateShopRelics(count?)` (optional count param for `merchants_favor`), `calculateShopPrice`, `priceShopCards` (v2 rarity-based), `removalPrice()` (AR-59.15) |
| Hidden relic synergies | `src/services/relicSynergyResolver.ts` | Built — RELIC_SYNERGIES definitions, detectActiveSynergies, hasSynergy, Tier 3 bonus calculation |
| Upgrade picker UI | `src/ui/components/UpgradeSelectionOverlay.svelte` | Built — 3 candidates with before/after preview, sorted by tier |
| Post-mini-boss rest screen | `src/ui/components/PostMiniBossRestOverlay.svelte` | Built — auto-heal 15% + upgrade selection |

#### Variable AP Costs (P0.6.5)

Cards now cost 0, 1, 2, or 3 AP instead of all costing 1 AP. This creates meaningful resource allocation decisions.

**Data Layer Changes:**
- `src/data/card-types.ts` — Card interface extended with `apCost: number` and `MechanicUpgrade` interface extended with `apCostDelta?: number` for AP reduction upgrades
- `src/data/balance.ts` — UPGRADE_DEFS extended with `apCostDelta` field for Heavy Strike and other 2-3 AP cards

**Service Layer:**
- `src/services/cardUpgradeService.ts` — `upgradeCard()` applies AP cost reduction via `Math.max(0, card.apCost + apCostDelta)`; `getUpgradePreview()` includes `currentApCost` and `newApCost` fields
- `src/services/turnManager.ts` — `hasPlayableCards` no longer guarded by `apCurrent > 0` check; 0-AP cards (like Quicken) are always playable
- `src/services/turnManager.ts` — `playCard()` now subtracts variable AP: `apCurrent -= Math.max(0, card.apCost)`

**UI Layer:**
- `src/ui/components/CardHand.svelte` — AP cost badges now show green for 0 AP, blue for 1 AP, orange for 2 AP, red for 3 AP; applied per-card via `getApBadgeColor()` utility
- `src/ui/components/CardCombatOverlay.svelte` — AP cost preview updated in card info overlay, shows cost in addition to effect description
- `src/ui/components/UpgradeSelectionOverlay.svelte` — Upgrade preview cards show current and new AP cost side-by-side

#### Modified Files (P0.6)

**Data Layer:**
- `src/data/card-types.ts` — Added `isUpgraded?: boolean` and `secondaryValue?: number` to Card interface
- `src/data/balance.ts` — Added upgrade, shop, and synergy constants; v2 shop pricing: `SHOP_CARD_PRICE_V2`, `SHOP_RELIC_PRICE` (updated), `SHOP_REMOVAL_BASE_PRICE`, `SHOP_REMOVAL_PRICE_INCREMENT`, `SHOP_HAGGLE_DISCOUNT` (AR-59.15)

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

### Implemented (AR-113 — In-Run Mastery Upgrade System)

| System | File(s) | Status |
|--------|---------|--------|
| Mastery fields on Card | `src/data/card-types.ts` | `masteryLevel: number` (0–5), `masteryChangedThisEncounter: boolean` |
| Mastery upgrade/downgrade logic | `src/services/cardUpgradeService.ts` | `masteryUpgrade(card)`, `masteryDowngrade(card)`, `getMasteryBaseBonus(card)` — bonus scales with level |
| Mastery wiring in turn loop | `src/services/turnManager.ts` | Calls upgrade/downgrade on Charge resolution; enforces once-per-encounter cap; clears flag at encounter start; flat 1.5× Charge multiplier (replaces old 2.5/3.0/3.5× tier system). **v3:** Tier 3 auto-charge at L5 REMOVED — every charge always presents a quiz. Mastery level controls distractor count and question template selection. |
| Mastery bonus application | `src/services/cardEffectResolver.ts` | `getMasteryBaseBonus(card)` added to base effect value before chain/surge multipliers |
| Mastery-aware description | `src/services/cardDescriptionService.ts` | `mastery-bonus` CardDescPart type renders "8+2" format with green bonus text |
| Mastery visual — frame | `src/ui/utils/cardFrameV2.ts` | `getMasteryIconFilter(level)` CSS filter per level (L1=green, L2=blue, L3=purple, L4=orange, L5=gold); `hasMasteryGlow(level)` true at L5 |
| Mastery visual — card UI | `src/ui/components/CardHand.svelte` | Icon bobs at L1+; stat values flash green/red on mastery change; "Upgraded!"/"Downgraded!" popup |
| Distractor count scaling | `src/services/quizService.ts` | 2 distractors shown at mastery 0; 3 distractors at mastery 1+ |
| Level 5 quiz | `src/services/turnManager.ts` | **v3:** L5 mastery no longer auto-plays — every charge always presents a quiz. L5 controls distractor count + question template difficulty only. |
| Rest site Study | `src/services/masteryChallengeService.ts` | Study session upgrades specific cards via mastery (max 3, no downgrades) |

**Mastery bonus values (per level above 0):** Defined in `src/data/balance.ts` (`MASTERY_BONUS_PER_LEVEL`). Bonus is flat additive to base effect before multipliers.

**Mastery reset:** `masteryLevel` resets to 0 at run start (not persisted across runs). FSRS tiers remain the long-term retention axis (decoupled from combat power in v3); mastery is the in-run power axis. Card slot mastery (0–5) drives question difficulty AND power — mastery also controls distractor count and question template selection.

### Relic System

The relic system uses an STS-inspired economy replacing the old FSRS-tied passive relics.

**Data layer** (`src/data/relics/`):
- `types.ts` — `RelicDefinition`, `RunRelic`, `RelicRarity`, `RelicCategory`, `RelicTrigger`
  - **V2 triggers added** (AR-59.11): `on_charge_correct`, `on_charge_wrong`, `on_chain_complete`, `on_surge_start`
  - **V2 categories added**: `chain`, `speed`, `burst`, `poison`, `glass_cannon`
- `starters.ts` — **25 free v2 relics** (11 Commons + 14 Uncommons) — replaces v1 25 starters (AR-59.11)
- `unlockable.ts` — **17 unlockable v2 relics** (15 Rares + 2 Legendaries) + `toxic_bloom` Phase 2 placeholder — replaces v1 25 unlockables (AR-59.11)
- `index.ts` — barrel exports, `FULL_RELIC_CATALOGUE`, `RELIC_BY_ID`, `STARTER_RELIC_IDS`

**Services**:
- `relicEffectResolver.ts` — Pure functions resolving relic effects from `Set<string>` of held IDs. Hooks (v1): encounter start, attack, shield, heal, damage taken, lethal, turn end, perfect turn, correct answer, card skip, draw count, speed bonus, timer. **V2 hooks added (AR-59.11)**: `resolveChargeCorrectEffects`, `resolveChargeWrongEffects`, `resolveChainCompleteEffects`, `resolveSurgeStartEffects`, `resolveTurnEndEffectsV2`, `resolveEncounterEndEffects`, `resolveCurrencyBonusV2`, `resolveCardRewardOptionCountV2`, `resolveMaxHpBonusV2`. **Expansion hooks**: cursed-card multiplier application, Burn/Bleed damage resolution, Dragon's Heart elite/boss kill trigger, Soul Jar charge accumulation, Mind Palace streak tracking. Also exports `getMaxRelicSlots(runRelics)` (returns 5, or 6 with Scholar's Gambit) and `isRelicSlotsFull(runRelics)` (true at cap). Echo hooks (`echo`, `combo start`) removed.
- `relicAcquisitionService.ts` — In-run pool filtering (respects `excludeFromPool` and `excludeFromPhase1` flags), weighted random selection, boss/mini-boss choice generation, random drop logic.
- `saveMigration.ts` — **NEW (AR-59.11)**: V1→V2 relic migration. `migrateRelicsV1toV2(save)` walks all 50 v1 relic IDs and applies: preserve / rename / auto_unlock / refund / drop actions. `V1_TO_V2_RELIC_MAP` is the authoritative migration table.

**Data fields on `RelicDefinition`** (updated AR-59.11):
- `startsUnlocked?: boolean` — True for the 25 free relics (all starters). These appear in the pool without Mastery Coin purchases.
- `excludeFromPool?: boolean` — True for relics requiring unbuilt mechanics. Excluded from run drops; still visible in Hub Relic Archive.
- `excludeFromPhase1?: boolean` — **NEW**: True for relics depending on Phase 2 mechanics (e.g. `toxic_bloom`). Drop system must filter these out.
- `curseDescription?: string` — Describes downside for cursed relics (`volatile_core`, `blood_price`, `scholars_gambit`).

**Key exported functions from `gameFlowController.ts`** (updated through AR-59.12):
- `sellEquippedRelic(definitionId)` — Removes relic from run, adds 40% of shop price as currency refund.
- `acquirePendingSwapRelic()` — Adds the pending swap relic to the run after a sell decision.
- `getPendingSwapRelicId() / clearPendingSwapRelicId()` — Module-level state for the relic pending swap.
- `canRerollRelicSelection() / rerollRelicSelection(currentOfferedIds)` — Relic reroll: 50g, once per boss/mini-boss/elite selection.
- `resetRelicSelectionRerolls()` — Called when a new relic selection screen opens; also clears `rerollSeenIds`.
- `isRelicPityActive()` — Returns true when `run.relicPityCounter >= RELIC_PITY_THRESHOLD (4)`.

**Module-level state in `gameFlowController.ts`** (AR-59.12):
- `rerollSeenIds: Set<string>` — Scoped to the active selection event. Prevents reroll-seen options reappearing within the same session. Cleared by `resetRelicSelectionRerolls()`.
- `offeredRelicIds` scope change: now tracks ONLY acquired relics (not all offered). Declined relics from choose-1-of-3 screens can reappear in later events.

**`RunState` additions** (v3 — Curated Deck System):
- `deckId: string` — Selected curated deck for this run.
- `inRunFSRS: Map<string, InRunFactState>` — Per-run fact performance tracker (correctCount, wrongCount, confusedWith). Seeded from global FSRS at run start.
- `confusionEntries: ConfusionEntry[]` — Confusion pairs recorded this run; merged into persistent confusion matrix on run end.

**Removed from `RunState` (v3):**
- `firstChargeFreeFactIds` — Free First Charge system removed.
- `cursedFactIds` — Cursed card system removed.

**`TurnState` additions** (AR-204 — Inscription System):
- `activeInscriptions: ActiveInscription[]` — persists for entire encounter; initialized to `[]` in `startEncounter`. `ActiveInscription` has `mechanicId: string` and `power: number`. Iron hook fires in `endPlayerTurn` turn-start block.

**`EncounterState` additions** (Expansion):
- `encounterChargesTotal: number` — total correct Charges made this encounter (used by Knowledge Bomb CC scaling and Archive Codex relic).

**`RunState` additions** (AR-59.12):
- `relicPityCounter: number` — Consecutive Common-only acquisitions since last Uncommon+. Initialized 0. Resets to 0 on Uncommon+ acquisition. Pity activates at `>= RELIC_PITY_THRESHOLD (4)` in `balance.ts`.

**`generateRandomRelicDrop` signature change** (AR-59.12): now accepts `rarityWeights` and `pityActive` params; uses full rarity weights (was common/uncommon-only). When `pityActive=true`, forces Uncommon+ selection.

**`RELIC_BOSS_RARITY_WEIGHTS`** (AR-59.12): common 0.20 (was 0.25), rare 0.30 (was 0.25).

**Elite node wiring** (AR-59.12): `onEncounterComplete` captures `actMap.nodes[currentNodeId].type` BEFORE calling `advanceEncounter()`. Elite nodes trigger `RelicRewardScreen` with 3 choices (regular rarity weights). Trigger priority: boss > elite > first-mini-boss > subsequent-mini-boss > regular.

**AR-204 — Inscription System + Card Browser UI**:
- `src/data/card-types.ts` — Added `isInscription?: boolean` and `isRemovedFromGame?: boolean` to `Card` interface
- `src/services/turnManager.ts` — Added `ActiveInscription` interface, `activeInscriptions: ActiveInscription[]` field to `TurnState` (initializes to `[]` in `startEncounter`), `resolveInscription()` helper (registers inscription, enforces Pool=1), `getActiveInscription()` helper (used by hooks), Iron hook in `endPlayerTurn` turn-start block
- `src/services/cardEffectResolver.ts` — Added `inscriptionFuryBonus?: number` to `AdvancedResolveOptions`; applied at damage pipeline step 3 (after mastery, before relic flat bonuses; attack cards only)
- `src/services/encounterBridge.ts` — Inscription detection on card play (moves card from discard to exhaust, marks `isRemovedFromGame`; Wisdom CW skips registration), Fury bonus passed into `AdvancedResolveOptions`, Wisdom CC trigger (draw 1 + optional heal 1 HP), `activeInscriptions` preserved in `freshTurnState`
- `src/ui/components/CardBrowser.svelte` — NEW: shared mid-combat card list overlay (portrait full-screen / landscape right-panel, select/view modes, showAnswers, timer, data-testid)
- `src/ui/components/MultiChoicePopup.svelte` — NEW: generic 2–4 option choice modal (min 48px tap targets, forcePick, keyboard Escape support)
- `src/ui/components/ExhaustPileViewer.svelte` — NEW: thin CardBrowser wrapper showing all exhausted cards including Inscriptions
- `src/ui/components/CardCombatOverlay.svelte` — Added exhaust pile count tap target (purple ✕ indicator, hidden when empty) + ExhaustPileViewer overlay integration

**TurnState fields added (AR-204)**:
```typescript
activeInscriptions: ActiveInscription[]  // persists for entire encounter; initialized []
```

**UI components**:
- `RelicCollectionScreen.svelte` — Hub screen (via Anvil) for browsing, unlocking, and excluding relics
- `RelicRewardScreen.svelte` — Full-screen 1-of-3 relic choice (boss/first mini-boss)
- `RelicSwapOverlay.svelte` — NEW: shown when player is at slot cap (5/5 or 6/6) and a new relic is offered; presents sell-or-pass decision with inline confirmation
- `RelicPickupToast.svelte` — Brief toast for random relic drops
- `RelicTray.svelte` — Combat HUD vertical strip on the right edge; 28px icons with gold borders; shows filled slots plus dim empty-slot placeholders; slot count label (e.g. "3/5") turns amber at max capacity; accepts `maxSlots` prop derived from `getMaxRelicSlots`

**Screen states** (updated through AR-59.12):
- `relicSwapOverlay` — Added to `GameFlowState` and `Screen` unions. Active when player is at slot cap and has a pending relic.
- `starterRelicSelection` — **Removed** from `GameFlowState` and `Screen` unions in AR-59.12. `StarterRelicSelection.svelte` remains as unreachable dead code pending deletion approval. Run starts navigate directly to `dungeonMap`.

**Integration points** (all combat-loop relic checks now delegate to `relicEffectResolver.ts` as the centralized source of truth):
- `encounterBridge.ts` — Builds `activeRelicIds` from `runRelics` at encounter start; delegates encounter-start effects (herbal_pouch, quicksilver), draw count (swift_boots, blood_price) to resolver (combo_ring relic removed in v2)
- `turnManager.ts` — Delegates turn-start effects (iron_buckler: +3 block/turn), damage-taken effects (steel_skin, thorned_vest, glass_cannon, iron_resolve), lethal saves (last_breath, phoenix_feather), turn-end effects (fortress_wall, afterimage, blood_pact, blood_price), and perfect-turn bonuses (momentum_gem) to resolver
- `cardEffectResolver.ts` — Per-card relic modifiers (attack bonus, strike bonus, chain lightning). Echo resolution functions removed. `AdvancedResolveOptions` accepts `correct?: boolean`, `playMode?: PlayMode`, and `inscriptionFuryBonus?: number` (Inscription of Fury flat damage at step 3 of damage pipeline). **v3:** cursed multipliers removed (cursed card system removed).
- `gameFlowController.ts` — Relic acquisition flow after encounters, relic reward routing, slot cap enforcement, swap flow trigger
- `playerData.ts` — `awardMasteryCoin()`, `spendMasteryCoins()`, `unlockRelic()`, `toggleRelicExclusion()`
- `saveService.ts` — Backward-compatible migration: retroactive mastery coins from Tier 3 facts

### Curated Deck System — New Files (v3, AR-245–AR-251)

| File | Purpose |
|------|---------|
| `src/data/curatedDeckTypes.ts` | `CuratedDeck`, `DeckFact`, `AnswerTypePool`, `SynonymGroup`, `QuestionTemplate` types |
| `src/data/curatedDeckStore.ts` | Runtime store + JSON loader for curated decks |
| `src/data/deckRegistry.ts` | Deck metadata registry (deck ID → name, domain, subdeck list, file path) |
| `src/data/deckFactIndex.ts` | Deck/sub-deck to fact ID mapping index |
| `src/data/vocabularyTemplates.ts` | Standard vocabulary deck templates (forward, reading, reverse, synonym_pick, definition_match) |
| `src/services/inRunFactTracker.ts` | Per-run fact performance + cooldown tracker |
| `src/services/curatedFactSelector.ts` | Weighted fact selection at charge-commit time (`selectFactForCharge()`) |
| `src/services/confusionMatrix.ts` | Cross-run confusion tracking + priority scoring |
| `src/services/confusionMatrixStore.ts` | Global confusion matrix singleton + localStorage persistence |
| `src/services/curatedDistractorSelector.ts` | Pool-based distractor selection (synonym exclusion → confusions → struggles → fill) |
| `src/services/questionTemplateSelector.ts` | Template selection + `QuizData` rendering |
| `src/services/nonCombatQuizSelector.ts` | Study Temple quiz selector for shop/rest/boss/mystery contexts |
| `src/services/deckProgressService.ts` | Per-deck FSRS progress computation (powers mastery % display) |
| `data/decks/manifest.json` | Deck file manifest (lists all available deck JSON paths) |
| `data/decks/*.json` | Curated deck data files (facts, answer pools, chain themes, synonym groups) |

**Data Flow (Study Temple):**
```
App Start
  → initializeCuratedDecks()
  → loads data/decks/manifest.json
  → loads each deck JSON
  → populates curatedDeckStore, deckRegistry, deckFactIndex

Run Start (Study Temple)
  → InRunFactTracker created
  → seeded from global FSRS (stability < 2d → wrongCount:1; > 30d → correctCount:1)

Card Charge (Study Temple)
  → selectFactForCharge(card, deck, inRunTracker)
  → selectQuestionTemplate(deck, fact, masteryLevel)
  → selectDistractors(correctFact, deck, inRunTracker, confusionMatrix, masteryLevel)
  → QuizData returned to CardExpanded.svelte

Answer Result
  → inRunFactTracker.recordResult(factId, correct, responseTimeMs)
  → confusionMatrix.recordConfusion(correctFactId, chosenFactId) [if wrong]
  → global FSRS update via saveService
  → confusionMatrixStore.flush() at run end
```

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

### v2-Archived UI Components

These components exist in the codebase as dead code, removed from all active screen flows in v2:

| Component | File | Reason Archived |
|-----------|------|----------------|
| Combo Counter | `src/ui/components/ComboCounter.svelte` | Removed in expansion. Replaced by `ChainCounter.svelte`. Combo multiplier, combo counter, combo heal all deleted. |
| Archetype Selection | `src/ui/components/ArchetypeSelection.svelte` | Archetype selection removed from run start flow; all players start equal |
| Starter Relic Selection | `src/ui/components/StarterRelicSelection.svelte` | Starter relic selection removed; no `starterRelicSelection` screen state in v2 |
| Retreat Or Delve | `src/ui/components/RetreatOrDelve.svelte` | Retreat-or-delve decision node removed; 3-act linear run with no exit ramps |

### Expansion-Archived Systems (Removed in Expansion)

| System | What Was Removed | Reason |
|--------|-----------------|--------|
| Echo system | `ECHO.*` constants, echo card spawning, echo visual state (`echo-shimmer`), Charge-only restriction on echo cards, `echo_lens` relic, `phantom_limb` relic | Exploitable as free deck thinning; anti-learning (removed cards needing practice). |
| Combo system | `COMBO_MULTIPLIERS`, `COMBO_HEAL_*`, `COMBO_DECAY_*`, `comboCount` tracking in `cardEffectResolver.ts`, `turnManager.ts`, `deckManager.ts`, `balance.ts`, `ComboCounter.svelte`, `comboDisplay.ts` | Chains are the only streak mechanic. Combo system added complexity without meaningful player expression. |
| `echo-mechanic-v2.test.ts` | Test file for old Echo system | Echo system removed |
| `Combo Ring` relic | `combo_ring` relic | Combo system removed |

### v3-Archived Systems (Removed in v3 Curated Deck Redesign)

| System | What Was Removed | Reason |
|--------|-----------------|--------|
| Free First Charge | `discoverySystem.ts`, `firstChargeFreeFactIds` in RunState, `FREE_FIRST_CHARGE_EXEMPT_FROM_CURSE` balance const, `usedFreeCharge` in PlayCardResult, "FREE" button label in CardHand | Curated deck model makes fact familiarity uniform; free charge mechanic created inconsistent pacing. |
| Cursed Card system | `cursedFactIds` in RunState, `CURSED_*` balance constants, cursed-card detection in `turnManager.ts` + `encounterBridge.ts`, cursed multipliers in `cardEffectResolver.ts`, `scar_tissue` relic cursed hook, `dark_knowledge` "per cursed fact" scaling | Replaced by confusion-matrix-weighted distractor selection in v3 — confusing facts become harder distractors, not cursed. |
| Draw-time fact binding | `deckManager.ts` fact-to-slot binding at run start (AR-70) | v3 assigns facts at charge-commit time from curated pool, enabling deck-specific question templates and adaptive distractor selection. |

### v2-Archived Services

| Service | File | Reason Archived |
|---------|------|----------------|
| Relic Synergy Resolver | `src/services/relicSynergyResolver.ts` | Relic synergy system simplified; synergies handled inline in relicEffectResolver |

## 6. Data Flow

### Run Lifecycle (v3)

```
Curated Deck Selection (hub: domain → deck → optional sub-deck)
  → CuratedDeckLoader loads selected deck's fact pool, chain themes, synonym groups
  → In-Run FSRS seeded from global FSRS state at run start
  → Fixed 10-card starter deck built from curated deck fact pool
  → encounterBridge builds run pool via runPoolBuilder (single curated deck)
  → DeckManager shuffles pool into draw pile
  → Act 1 begins (no archetype selection, no starter relic selection)

Run Structure (v3 — 3-act linear):
  Act 1 (7–8 nodes) → Act 1 Boss
  Act 2 (7–8 nodes) → Act 2 Boss
  Act 3 (7–8 nodes) → Final Boss → Victory
  At any point: defeat → run ends, stats recorded. No retreat-or-delve.

Combat Loop (per encounter, v3):
  1. Draw 5 cards from draw pile (no facts assigned at draw time)
  2. Player taps card → chooses Quick Play OR Charge:
     Quick Play: card resolves at base power immediately (no quiz, no AP surcharge)
                 Chain resets if chainType changes
     Charge:     +1 AP surcharge (no free first charge in v3)
                 Fact selected from curated deck pool at charge-commit time
                 Quiz panel slides in; distractors from deck pool (confusion-matrix weighted)
                 Correct → card resolves at Charge multiplier × chain multiplier × (Surge ×2 if Surge turn)
                           Chain advances if chainType matches (0-5 or deck-specific theme)
                 Wrong   → card resolves at 0.7× base (partial effect); chain resets; no fizzle
  3. In-Run FSRS + global FSRS updated via encounterBridge (both Charge outcomes; Quick Play does not update FSRS)
  4. Enemy turn → telegraphed attack executes
  5. Repeat until enemy HP = 0 or player HP = 0
  6. Confusion pairs recorded to confusionEntries for this run

Turn Rhythm (v2 — Surge cycle):
  Turn 1: Normal
  Turn 2: SURGE (first Surge — doubles all Charge multipliers)
  Turn 3: Normal
  Turn 4: Normal
  Turn 5: SURGE
  Turn 6: Normal
  Turn 7: Normal
  Turn 8: SURGE  …  (every 3rd turn starting from turn 2)
  Surge turns are visually signaled one turn in advance.

Relic Data Flow (v2 — 5-slot system):
  Relic pickup event
    └─ 5-slot capacity check (6 with Scholar's Gambit):
         ├─ Slot available → add relic, trigger passive effect registration
         └─ All slots full → open RelicSwapOverlay
              ├─ Sell existing relic → gold refund + slot freed → add new relic
              ├─ Swap existing relic → old relic removed → new relic added
              └─ Decline → new relic discarded
  Relic reroll: at relic offer node, spend gold to reroll offered relics (once per node)

Between Encounters:
  → Return to Dungeon Map → player selects next node (combat, elite, mystery, rest, shop, treasure)
  → Card reward (pick 1 of 3 new cards)

Run End:
  → Post-run summary (facts learned, cards earned, floor reached)
  → FSRS states persisted, confusion matrix updated, meta-progression applied
  → Return to hub
```

### Store Architecture

- `src/ui/stores/gameState.ts` — current screen, run state, combat state
- `src/ui/stores/playerData.ts` — save data, FSRS states, achievements
- Phaser `CombatScene` owns transient combat state (enemy HP, animations)
- `saveService` persists `PlayerSave` to localStorage (profile-namespaced)

## 7. State Management

| State Type | Owner | Persistence |
|------------|-------|-------------|
| UI navigation | Svelte stores (`currentScreen`) | Session only |
| Run progress | RunManager → Svelte store | Saved after every encounter |
| Combat state | CombatScene + encounter engine | Transient (rebuilt from run state) |
| Card/deck state | DeckManager | Saved as part of run state |
| FSRS review data | playerData store | Persisted in PlayerSave |
| In-run FSRS | runManager → run state | Seeded from global FSRS at run start; merged back on run end |
| Confusion matrix | playerData store | Persisted in PlayerSave (cross-run confusion tracking) |
| Meta-progression | playerData store | Persisted in PlayerSave |
| Study presets | studyPresetService | localStorage (up to 10 named presets) — v3: superseded by curated deck selection |
| Selected curated deck | gameFlowController | Saved per-run, previous deck remembered |
| Settings | settings store | localStorage |

Run state serialization target: <50KB (FSRS data for 500 facts ≈ 25KB).

## 8. Performance Budget

| Metric | Target |
|--------|--------|
| Active game objects in combat | ~12 (1 background, 1 enemy, 5 cards, 2 HP bars, 1 chain counter HUD, 1 particle emitter, 1 intent icon) |
| Concurrent particles | 50 max |
| Frame rate | 60fps |
| Run state size | <50KB |
| Texture atlases in memory | 3 max (via TextureAtlasLRU) |
| Card animations | Web Animations API (WAAPI) for draw swoosh, ghost card discard, and end-of-turn discard; CSS 3D transforms + @keyframes for 31 mechanic animations (reveal/swoosh/impact phases), GPU-accelerated via `will-change: transform` |

## 9. Typed Event Bus

Two buses:

- **Global**: `src/events/EventBus.ts` — typed payloads in `src/events/types.ts`. Supports `emit`, `emitAsync`, `on`, `off`, `clear`. Will extend with card combat events (`card-played`, `card-fizzled`, `encounter-won`, `floor-cleared`, `run-ended`).
- **Encounter bridge**: `encounterBridge.ts` wires game flow controller into deck/enemy/turn systems and CombatScene display. `startEncounterForRoom()` is async; callers in `CardApp.svelte` and `gameFlowController.ts` await it.

## 10. Save/Load Architecture

- Full save: `PlayerSave` in `src/data/types.ts`
- Save key: `rr_save_<profileId>` (fallback: `rr_save`)
- Mid-run checkpoint: saved after every encounter via `runSaveService.ts`
- Save version migrations: in-code, field-by-field in `saveService.ts`
- Optional sub-document split: `saveSubDocs.ts` (core, knowledge, inventory, analytics)
- Optional cloud sync: `syncService`/`apiClient`

## 11. Directory Structure

### Current

```
src/
  CardApp.svelte           — Root component (replaces App.svelte)
  game/
    CardGameManager.ts     — Phaser singleton manager; `boot(startAnimation?)` creates game with optional BootAnimScene; `getGame()` returns Phaser.Game for event listening; `stopBootAnim()` stops BootAnimScene after completion
    scenes/
      BootAnimScene.ts     — 8s cinematic intro (logo deblur, glow burst, text sweep, studio tag, cave fly-through, campsite reveal). Tap-to-skip accelerates via tweens.timeScale=3. Emits `boot-anim-complete` on game.events when done. First-launch only (localStorage flag).
      BootScene.ts         — Asset loading
      CombatScene.ts       — Phaser combat display zone (enemy sprite, HP bars, animations; sceneReady guard pattern)
    managers/              QuizManager, StudyManager, AudioManager,
                           relicEffectResolver, CelebrationManager, GaiaManager,
                           AchievementManager, InventoryManager, CombatManager,
                           CompanionManager, EncounterManager
    systems/               ParticleSystem, ScreenShakeSystem, SessionTracker,
                           CameraSystem, AnimationSystem, TextureAtlasLRU,
                           CombatParticleSystem.ts, CombatAtmosphereSystem.ts, StatusEffectVisualSystem.ts, ...
    entities/              Player, Boss, Creature
  services/
    encounterBridge.ts     — Wires flow → deck → enemy → turns → display (async startEncounterForRoom with factsDB init guard). Fixed 10-card starter deck; removed archetype-based pool building. Applies post-encounter healing (with boss/mini-boss bonus) and early mini-boss HP reduction. Echo system fully removed. Inscription detection on card play (moves card from discard to exhaust, marks `isRemovedFromGame`; Wisdom CW skips registration); Fury bonus passed into `AdvancedResolveOptions`; Wisdom CC trigger (draw 1 + optional heal 1 HP); `activeInscriptions` preserved in `freshTurnState`. **v3:** loads curated deck at run start; fact selection at charge-commit time; in-run FSRS tracking; confusion pairs recorded; cursed-card detection removed.
    discoverySystem.ts     — **DEPRECATED (v3)**: V2 Free First Charge. Removed in v3 — file retained as dead code pending deletion approval.
    gameFlowController.ts  — Screen routing + run lifecycle. V2: 3-act flow; no retreat-or-delve; no archetype selection; no starter relic selection; routes directly to 'dungeonMap' at run start.
    surgeSystem.ts         — V2 Surge turn timing: turns 2, 5, 8, … (every 3rd starting from turn 2). `isSurgeTurn(n)`, `getSurgeMultiplier()`. Surge doubles all Charge multipliers. Visually signaled one turn in advance.
    chainSystem.ts         — AR-70 Knowledge Chain tracking: per-turn chainType (0-5) sequence. `extendOrResetChain(chainType, override?)`, `getChainMultiplier(length)`, `getChainState()`. Chain resets on chainType change; multiplier caps at configured max.
    chainVisuals.ts        — AR-70 chain color mapping: `getChainColor(chainType)` / `getChainGlowColor(chainType)` → 6-color palette from `chainTypes.ts`. `getChainColorGroups(cards)` → Map<chainType, cardId[]> for in-hand pulse grouping.
    bossQuizPhase.ts       — V2 boss quiz phase: sequential questions during boss HP threshold events. `startBossQuizPhase(config, callbacks)`. Configures question count, timer, pass/fail thresholds from `QuizPhaseConfig` on enemy template.
    saveMigration.ts       — V2 relic migration: `migrateRelicsV1toV2(save)` maps all 50 v1 relic IDs via `V1_TO_V2_RELIC_MAP` (preserve/rename/auto_unlock/refund/drop actions).
    turnManager.ts         — V2/v3 turn-based encounter logic. Quick Play / Charge branching; Surge integration via surgeSystem; per-turn chain tracking via chainSystem. Removed combo accumulator, speed bonus, full fizzle paths, Free First Charge. AR-113: on correct Charge → calls `masteryUpgrade(card)` if `!masteryChangedThisEncounter`; on wrong Charge → calls `masteryDowngrade(card)` if `!masteryChangedThisEncounter`; clears `masteryChangedThisEncounter` at encounter start. Charge multiplier: flat 1.5× + mastery bonus (no longer tier-based 2.5/3.0/3.5×). **v3:** fact assigned at charge-commit time (not draw time); no cursed card detection; L5 mastery no longer auto-plays (every charge presents a quiz).
    deckManager.ts         — Draw/discard/shuffle/exhaust. **v3:** facts are NOT bound to card slots at draw time — fact selection happens at charge-commit time from the curated deck pool. Cards carry mechanic + chain theme + mastery; the specific fact is chosen when the player commits to a Charge.
    cardFactory.ts         — Creates Card from Fact + ReviewState
    runPoolBuilder.ts      — Builds 120-fact run pool with subcategory balancing. **v3:** draws pool exclusively from selected curated deck's fact set; no multi-domain mix. Fact-to-slot binding no longer at draw time — facts assigned at charge-commit instead.
    enemyManager.ts        — Creates enemies, floor scaling, intent rolling, block/damage resolution. Exports `getFloorDamageScaling(floor)` (+3%/floor above 6). Applies per-turn damage caps via `ENEMY_TURN_DAMAGE_CAP` and `getSegmentForFloor()`. Implements charge mechanic: `isCharging` flag, `chargedDamage` storage, `bypassDamageCap` intent flag for automatic deferred attacks. `dispatchEnemyTurnStart(enemy, turnNumber)` fires `onEnemyTurnStart` callbacks (Venomfang enrage). `executeEnemyIntent` applies `enrageBonusDamage` to attack/multi_attack intents.
    floorManager.ts        — Floor/room/boss/mini-boss generation
    mapGenerator.ts        — Act map generation: ActMap/MapNode types, generateActMap() (seed-deterministic, 15 rows, 3-5 nodes/row, non-crossing edges), selectMapNode(), reachability helpers
    runManager.ts          — Run stats recording
    runSaveService.ts      — Save/resume active run to localStorage
    juiceManager.ts        — Game juice effects (haptics, sounds, particles)
    domainResolver.ts      — Maps fact categories to card domains/types
    studyPresetService.ts  — Study preset CRUD (up to 10 named presets)
    presetPoolBuilder.ts   — Resolves study mode into domain + subcategory filters
    masteryScalingService.ts — Anti-cheat mastery scaling (reward multiplier + timer boost)
    platformService.ts     — AR-72 platform detection: `platform: 'mobile'|'desktop'|'web'`; detects Tauri (`__TAURI__`), Capacitor, or bare browser at module load time.
    hapticService.ts       — Capacitor haptic feedback; guarded by `isMobile` — no-op on desktop/web.
    notificationService.ts — Capacitor push notifications; `requestNotificationPermission()` returns false immediately on non-mobile platforms.
    inRunFactTracker.ts    — NEW (v3): Per-run fact performance tracker. Tracks correctCount, wrongCount, lastSeenEncounter, confusedWith[], streak per fact. Seeded from global FSRS at run start. Enforces 3-encounter cooldown.
    curatedFactSelector.ts — NEW (v3): Weighted fact selection at charge-commit time. Applies in-run FSRS weights, chain theme filtering, same-hand dedup, and cooldown exclusion. Entry point: selectFactForCharge().
    curatedDeckStore.ts    — NEW (v3): Runtime store for loaded curated decks. Populated by initializeCuratedDecks() at app start (loads manifest → loads deck JSONs). Provides getDeck(id), getAllDecks().
    confusionMatrix.ts     — NEW (v3): Cross-run confusion tracking service. recordConfusion(correctFactId, chosenFactId), getConfusionsFor(factId). Implements priority weighting for distractor selection.
    confusionMatrixStore.ts — NEW (v3): Global confusion matrix singleton + localStorage persistence. Loaded at app start; flushed after each run.
    curatedDistractorSelector.ts — NEW (v3): Pool-based distractor selector. selectDistractors(correctFact, deck, inRunTracker, confusionMatrix, masteryLevel) → string[]. Implements synonym exclusion → known confusions → in-run struggles → pool fill priority chain.
    questionTemplateSelector.ts — NEW (v3): Template selection + rendering. selectTemplate(deck, fact, masteryLevel, recentTemplates) → QuizData. Weights by difficulty match, variety, and mastery gate.
    nonCombatQuizSelector.ts — NEW (v3): Quiz selector for shop/rest/boss/mystery contexts in Study Temple. Uses full deck pool (no chain theme filter); still FSRS-weighted + cooldown-filtered. Updates both in-run and global FSRS.
    deckProgressService.ts — NEW (v3): Per-deck FSRS progress computation. getProgressStats(deckId, playerSave) → { known, struggling, unseen, masteryPct }. Powers "You know 73% of US Presidents" display.
    factsDB.ts, saveService.ts, sm2.ts, quizService.ts, audioService.ts, ...
src-tauri/               — Tauri v2 desktop wrapper scaffold (Rust not yet compiled — requires Rust toolchain)
  tauri.conf.json        — Window config: 1920×1080 default, 1280×720 min, resizable
  Cargo.toml             — Rust deps: tauri v2, tauri-plugin-shell, serde
  build.rs               — tauri-build entry point
  src/main.rs            — Minimal Tauri app entry (Builder::default + shell plugin)
  icons/                 — App icon placeholder directory
  ui/
    components/
      CardCombatOverlay.svelte  — Bottom 45% interaction zone, enemy intent panel, enemy name header (color-coded by category), floor info, bounty strip (bottom-right above End Turn), end turn button with gold pulse, discard pile counter, 5-phase card animation orchestration (reveal→swoosh→impact→discard) with per-archetype SFX via setTimeout chains and animatingCards buffer pattern. AR-113: card hand at bottom: 2vh; draw/discard piles repositioned alongside card tops (200px offset); Charge button matches selected card width with no lightning icon ("CHARGE +1 AP" text); camp background stretches to 100vw with translateX centering; reward room cards clickable via container.setSize fix; RewardCardDetail uses V2 frame rendering. AR-116: relic sell disabled during combat (info-only tooltip); AP orb at bottom: 35vh; enemy intent padding increased; damage popup uses mastery + charge values; discard pile dashed 3px border when empty.
      CardHand.svelte           — Fanned arc hand (30° spread, 20px arc offset), hand-crafted PNG card frame images (mechanic-themed), card description text overlay (grey=base, green=buffed, red=debuffed), AP cost gemstone badge, green glow on playable cards, tap-to-select + tap/swipe-to-cast, touch drag with scale transform, animatingCards buffer rendering for smooth animation decoupling, cardback preloading, reduced-motion support. AR-59.23: CHARGE button shows "FREE" for facts not yet Charged this run (checks `isFirstChargeFree()` per card); golden styling for the "FREE" state; "MASTERED" label in parchment area for Tier 3 cards. AR-113: mastery icon bobs at L1+; stat values flash green/red on mastery change; "Upgraded!"/"Downgraded!" popup; card descriptions render base+bonus format with green bonus text. AR-116: charge preview uses 1.5× + mastery bonus; old upgrade border removed; AP cost font uses 2px stroke + stronger shadows.
      CardExpanded.svelte       — Quiz panel positioned above card hand (fixed, bottom: calc(45vh - 20px)), no overlap with hand
      ChainCounter.svelte       — Chain-only display (expansion): replaced ComboCounter.svelte. Shows chain length + multiplier at bottom-left in chain type color, format "Chain: X.x". Combo multiplier, combo counter, and combo heal fully removed.
      CardBrowser.svelte        — NEW (AR-204): shared mid-combat card list overlay for Tutor, Mimic, Scavenge, Siphon Knowledge
      MultiChoicePopup.svelte   — NEW (AR-204): generic 2–4 option choice modal for Unstable Flux CC and Phase Shift QP
      ExhaustPileViewer.svelte  — NEW (AR-204): thin CardBrowser wrapper showing exhausted cards including Inscriptions
      DamageNumber.svelte       — Floating damage numbers
      DomainSelection.svelte    — Run-start domain picker (legacy, replaced by StudyModeSelector for run setup)
      StarterRelicSelection.svelte — ARCHIVED (AR-59.12 removed starter relic selection; file retained as dead code)
      ArchetypeSelection.svelte    — ARCHIVED (archetype selection removed from run start flow in v2)
      RetreatOrDelve.svelte        — ARCHIVED (retreat-or-delve decision node removed from run structure in v2)
      DeckBuilder.svelte        — Study preset creation/editing (tab within Library screen)
      StudyModeSelector.svelte  — Hub dropdown: All Topics, saved presets, languages, Build New Deck
      DungeonMap.svelte         — Scrollable vertical act map (SVG paths + HTML node buttons)
      MapNode.svelte            — Individual map node (44px circle, type-coded by icon/color)
      RoomSelectionOverlay.svelte — 3-door room chooser (legacy fallback for pre-map saves)
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
      cardFrameV2.ts         — V2 layered card frame utility; exports URL getters for border/base/banner/upgrade-icon WebP assets and PSD-derived guide positions for CSS text overlays; device-tier variant selection (hires vs lowres)
      mechanicAnimations.ts  — 5-phase animation system: reveal (250ms) → swoosh (250ms with archetype SFX) → impact (300ms) → discard (200ms). Archetype mappings (attack=slash, shield=pulse, buff=radiate, debuff=tendrils, utility=shimmer, wild=morph); exports PHASE_DURATIONS, CardAnimPhase type, getMechanicAnimClass(), getTypeFallbackAnimClass()
    stores/                gameState, playerData, settings
  data/
    card-types.ts          — Card, CardRunState, CardType, FactDomain types; AR-113 adds `masteryLevel: number` (0–5) and `masteryChangedThisEncounter: boolean` fields to Card
    curatedDeck.ts         — NEW (v3): CuratedDeck, DeckFact, AnswerTypePool, SynonymGroup, ChainTheme, QuestionTemplate interfaces
    curatedDeckTypes.ts    — NEW (v3): Runtime-facing curated deck types (service additions on top of curatedDeck.ts)
    confusionMatrix.ts     — NEW (v3): ConfusionEntry interface; persistent cross-run confusion tracking types
    deckRegistry.ts        — NEW (v3): Deck metadata registry (deck ID → name, domain, subdeck list, file path)
    deckFactIndex.ts       — NEW (v3): Deck/sub-deck → fact ID mapping index
    vocabularyTemplates.ts — NEW (v3): Standard vocabulary question templates gated by mastery level
    flagManifest.ts        — Maps 218 country names to flag SVG URLs; exports getFlagUrl(countryName), getFlagUrlBySlug(slug)
    studyPreset.ts         — StudyPreset, DeckMode types (preset selection + mastery scaling) — v3: superseded by curated deck selection
    enemies.ts             — Enemy template definitions
    balance.ts             — (extended with card combat constants; STARTER_RELIC_CHOICES removed in AR-59.12; RELIC_PITY_THRESHOLD = 4 added)
    types.ts, biomes.ts, relics/ (types, starters, unlockable, index), saveState.ts, ...
  events/                  EventBus, types
  dev/                     presets, debug bridge
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
  → scenes/BootAnimScene (first-launch only), scenes/BootScene, scenes/CombatScene

encounterBridge
  → CardGameManager (via globalThis[Symbol.for('rr:cardGameManager')])
  → services/turnManager
  → services/deckManager + runPoolBuilder + cardFactory
  → services/enemyManager
  → services/runManager
  → services/gameFlowController (activeRunState, onEncounterComplete)
  → ui/stores/playerData (updateReviewState — FSRS wiring)
  → data/balance (TIER3_PASSIVE_VALUE — passive extraction; curated deck chain theme config)

gameFlowController
  → services/floorManager (room generation)
  → services/mapGenerator (ActMap generation, node selection)
  → ui/stores/gameState (currentScreen — routes to 'dungeonMap' at run start; 'relicSwapOverlay' when player is at slot cap)
  → data/balance (run parameters, RELIC_PITY_THRESHOLD, RELIC_RARITY_WEIGHTS, RELIC_BOSS_RARITY_WEIGHTS)

turnManager (v2/v3)
  → services/surgeSystem (isSurgeTurn, getSurgeMultiplier)
  → services/chainSystem (advanceChain, getChainMultiplier)
  → services/relicEffectResolver (all combat-loop relic hooks)
  (discoverySystem dependency removed in v3)

cardEffectResolver (v2/v3)
  → playMode: PlayMode param ('quick' | 'charge') — determines base vs Charge multiplier
  → chain multiplier applied at resolution (from chainSystem)
  → AR-113: mastery bonus applied at resolution via `getMasteryBaseBonus(card)` — added to base effect before chain/surge multipliers
  → no combo accumulator, no speed bonus, no full fizzle path
  → v3: cursed card multipliers removed

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

### Distractor Generation Rules (v3)

**v3 knowledge decks:** Distractors come FROM the deck's own fact pool — pool-based adaptive selection weighted by the confusion matrix. This is intentional and correct for curated decks where all facts are semantically related. Bracket-number facts (`[N]` markers) still use runtime numeric generation.

**v3 vocabulary decks:** Distractors use the `vocabDistractorService.ts` runtime filter (length-matched candidates from same language/level pool).

**Content pipeline (fact ingestion):** When ingesting new facts outside of curated decks, distractors MUST still be LLM-generated (Haiku agent). NEVER pull `correct_answer` values from other facts as distractors for pipeline-ingested facts. On March 12, 2026, 58,359 garbage distractors had to be stripped from the database.

**PERMANENTLY BANNED for pipeline ingestion:** Scripts like `mine-distractors.mjs` or any `SELECT correct_answer FROM facts WHERE category = ...` approach for distractor generation.

## 13.5. Language Content Pipeline

Multi-language content pipeline producing vocabulary, kanji, grammar, and kana facts across 8 languages.

### Current Content (as of AR-52)

| Language | Vocab | Kanji | Grammar | Kana | Total |
|----------|-------|-------|---------|------|-------|
| Japanese | 7,726 | 2,230 | 2,701 | 416 | 13,073 |
| Chinese | 11,470 | — | 2,002 | — | 13,472 |
| Korean | 9,757 | — | 1,643 | — | 11,400 |
| Spanish | 11,434 | — | — | — | 11,434 |
| German | 18,610 | — | — | — | 18,610 |
| Czech | 15,393 | — | — | — | 15,393 |
| French | 12,728 | — | — | — | 12,728 |
| Dutch | 9,866 | — | — | — | 9,866 |

### Seed Files

- `src/data/seed/vocab-{lang}.json` — Vocabulary per language (8 files)
- `src/data/seed/kanji-ja.json` — 2,230 JLPT kanji (N5–N1) from KANJIDIC2 + davidluzgouveia/kanji-data
- `src/data/seed/grammar-ja.json` — 2,701 multi-type grammar facts (meaning + recall + sentence completion)
- `src/data/seed/grammar-ko.json` — 1,643 Korean grammar facts (TOPIK levels 1–6)
- `src/data/seed/grammar-zh.json` — 2,002 Chinese grammar facts (HSK 1–6)
- `src/data/seed/vocab-ja-hiragana.json` — 208 hiragana facts
- `src/data/seed/vocab-ja-katakana.json` — 208 katakana facts

### Grammar Fact Types (AR-51)

Each grammar point generates 2–3 quiz facts of different cognitive types:
1. **Meaning (L2→L1)**: "What does ～ている mean?" → "ongoing action"
2. **Recall (L1→L2)**: "Which pattern means 'ongoing action'?" → "～ている"
3. **Sentence completion**: "今、本を___います。" → "読んで" (with furigana readings for kana-only mode)

### Display Options (Japanese)

Three toggleable display settings accessible via ⚙️ in the deck builder:
- **Show Furigana** (default: ON): Hiragana readings above kanji via `<FuriganaText>` component
- **Show Romaji** (default: OFF): Romanized readings below text
- **Kana Only** (default: OFF): Replaces ALL kanji with hiragana for absolute beginners (AR-51)

### Vocabulary Answer Normalization (AR-45)

All vocabulary `correctAnswer` fields are normalized to concise quiz-appropriate length:
- Parenthetical clarifications stripped: "wing (of a bird)" → "wing"
- First meaning before semicolons: "he; him" → "he"
- Capped at 45 characters
- Korean NIKL definitions rewritten from sentences to 1–3 word translations via Haiku batch
- Runtime `vocabDistractorService.ts` filters distractors by answer length (±2.5x ratio) to prevent length-exploit guessing

### Per-Level Subcategories (AR-47)

All languages have per-level `categoryL2` values enabling level-specific deck selection:
- Japanese: `japanese_n5` through `japanese_n1`
- Chinese: `chinese_hsk1` through `chinese_hsk7`
- Korean: `korean_beginner`, `korean_intermediate`, `korean_advanced`
- European (ES/FR/DE/NL/CS): `{lang}_a1` through `{lang}_c2` (CEFR levels)

### Source Data

- `data/references/full-japanese-study-deck/` — FJSD repo (vocab, kanji, grammar, kana)
- `data/references/jmdict/` — JMdict English dictionary (CC-BY-SA 4.0)
- `data/references/kanji-data-davidluzgouveia.json` — 13,108 kanji with JLPT levels, meanings, readings (CC)
- `data/references/cefrlex/` — CEFR level data for European languages
- `data/references/kaikki/` — Wiktionary extracts for European vocab
- `/tmp/hanabira-grammar/` — Grammar data from hanabira.org (MIT license) for JA/KO/ZH

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

## Vocabulary Pipeline Architecture

### Overview
Vocabulary cards for 8 languages are built programmatically from open-source datasets — no LLM generation needed for the words themselves. The pipeline follows a 6-stage architecture (see `docs/RESEARCH/SOURCES/content-pipeline-spec.md` for the full spec).

### 6-Stage Pipeline
1. **Raw Data Ingestion** → `data/raw/{source}/` — Download dictionary files, level data
2. **Curated Input Generation** → `data/curated/vocab/{language}/` — Parse, join, deduplicate
3. **Fact Generation** → `data/generated/vocab/{language}/` — Convert words to quiz-ready facts (programmatic)
4. **Automated Validation** → 11 validation gates from the spec
5. **QA Review** → Spot-check 5-10% of output
6. **Production Build** → `src/data/seed/vocab-{lang}.json` → `public/facts.db`

### Runtime Distractor Selection (Spec Section 1.8)
Vocabulary facts do NOT ship with pre-generated distractors. The `distractors` field is `[]`. The game client selects wrong answers at runtime using:
- **POS match**: Nouns distract with nouns, verbs with verbs
- **Level proximity**: Within ±1 HSK/CEFR/JLPT/TOPIK level
- **Semantic bin distance**: Easy = different bins, Medium = same broad bin, Hard = same sub-bin
- **Performance**: <10ms for 120 candidates on mobile

Semantic bins (~50 broad, ~200 narrow sub-bins) are assigned at build time by Sonnet sub-agents and shipped as metadata (<300KB).

### Programmatic Question Types (Spec Section 1.9)
| Format | Tier | Template | Options |
|--------|------|----------|---------|
| L2→L1 meaning | 1 | "What does '{targetWord}' mean?" | 3 |
| L1→L2 reverse | 2a | "How do you say '{english}' in {language}?" | 4 |
| Reading (CJK) | 1 | "What is the reading of '{kanji}'?" | 3 |
| Fill-blank | 2b | "'{___}' means '{english}' in {language}" | 5 |

### Language Sources
| Language | Source | Level System | Expected Words |
|----------|--------|-------------|----------------|
| Chinese | complete-hsk-vocabulary | HSK 1-7 | 11,092 |
| Japanese | JMdict + JLPT lists | N5-N1 | ~10,000 |
| Spanish | CEFRLex + Kaikki.org | CEFR A1-C2 | ~12,000 |
| French | CEFRLex + Kaikki.org | CEFR A1-C2 | ~10,000 |
| German | CEFRLex + Kaikki.org | CEFR A1-C2 | ~10,000 |
| Dutch | CEFRLex + Kaikki.org | CEFR A1-C2 | ~8,000 |
| Korean | NIKL + TOPIK PDFs | TOPIK I-II | ~5,500 |
| Czech | Kaikki.org + wordfreq | Freq-inferred CEFR | ~5,000 |

### Key Scripts
- `scripts/content-pipeline/vocab/import-hsk-complete.mjs` — Chinese vocab import
- `scripts/content-pipeline/vocab/vocab-to-facts-v2.mjs` — Vocab→fact conversion (all languages)
- `scripts/build-facts-db.mjs` — Database builder

---

## Service Status

Audit conducted 2026-03-18. Covers 15 suspect services plus core FSRS service (file: sm2.ts). Status key: **IMPLEMENTED** = real logic present; **PARTIAL STUB** = partial implementation with some no-op/TODO functions; **NOT FOUND** = file does not exist.

| Service | File Path | Status | Consumers | Notes |
|---------|-----------|--------|-----------|-------|
| sm2.ts | `src/services/sm2.ts` | IMPLEMENTED | 9 files | Core spaced-repetition scheduler — active on every quiz answer |
| analyticsService.ts | `src/services/analyticsService.ts` | IMPLEMENTED | 10+ files | Batched event tracking, COPPA compliance, A/B experiment assignment |
| syncService.ts | `src/services/syncService.ts` | IMPLEMENTED | 4 files | Debounced cloud save with conflict resolution and field-level merge |
| masteryChallengeService.ts | `src/services/masteryChallengeService.ts` | IMPLEMENTED | 2 files | Mastery challenge roll logic, integrates with factsDB and tier derivation |
| dailyExpeditionService.ts | `src/services/dailyExpeditionService.ts` | IMPLEMENTED | 2 files | Daily run with localStorage persistence, bot leaderboard, API integration |
| endlessDepthsService.ts | `src/services/endlessDepthsService.ts` | IMPLEMENTED | 2 files | Endless mode personal records + bot baseline leaderboard + API |
| scholarChallengeService.ts | `src/services/scholarChallengeService.ts` | IMPLEMENTED | 2 files | Weekly domain-pair challenge with bot leaderboard and API integration |
| challengeService.ts | `src/services/challengeService.ts` | IMPLEMENTED | 1 file | Session-scoped streak tracker; awards prestige points at milestones |
| errorReporting.ts | `src/services/errorReporting.ts` | IMPLEMENTED | 1 file | Global uncaught exception + rejection handlers, fire-and-forget to backend |
| duelService.ts | `src/services/duelService.ts` | IMPLEMENTED | 1 file | REST API wrapper for async player duels (challenge/accept/submit/history) |
| guildService.ts | `src/services/guildService.ts` | IMPLEMENTED | 2 files | REST API wrapper for guild CRUD and member management |
| coopService.ts | `src/services/coopService.ts` | IMPLEMENTED | 2 files | REST + WebSocket facade for co-op dives; includes client-side prediction |
| steamService.ts | `src/services/steamService.ts` | PARTIAL STUB | 2 files | Achievements and rich presence wired to Tauri IPC; cloudSave/cloudLoad/DLC/leaderboards are commented-out TODOs pending Rust backend |
| leaderboardService.ts | `src/services/leaderboardService.ts` | NOT FOUND | — | File never created; leaderboard fetch logic lives in `leaderboardFetch.ts` |
| seasonService.ts | `src/services/seasonService.ts` | NOT FOUND | — | File never created; no season service logic exists |
| seasonPass.ts (service) | `src/services/seasonPass.ts` | NOT FOUND | — | File never created as a service; season pass data lives in `src/data/seasonPass.ts` (imported by SeasonPassView.svelte) |
