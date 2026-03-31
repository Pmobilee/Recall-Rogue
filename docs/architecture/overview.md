# Architecture Overview

> **Purpose:** Documents the 3-layer architecture stack, boot sequence, and Svelte–Phaser communication pattern.
> **Last verified:** 2026-03-31
> **Source files:** `src/main.ts`, `src/CardApp.svelte`, `src/game/CardGameManager.ts`, `src/services/encounterBridge.ts`, `src/services/gameFlowController.ts`

---

## Layer Architecture

```
┌─────────────────────────────────────────────┐
│  Svelte UI Layer                            │
│  CardApp.svelte + 30+ overlay components   │
│  Driven by stores: gameState.ts,           │
│  gameFlowController.ts, encounterBridge.ts  │
├─────────────────────────────────────────────┤
│  Phaser Canvas Layer                        │
│  CardGameManager (singleton)               │
│  Scenes: BootScene, CombatScene,           │
│  RewardRoomScene, BootAnimScene            │
├─────────────────────────────────────────────┤
│  Service Layer                              │
│  turnManager, encounterBridge,             │
│  gameFlowController, rewardGenerator,      │
│  quizService, factsDB, SM-2 scheduler      │
├─────────────────────────────────────────────┤
│  Data Layer                                 │
│  src/data/: balance.ts, card-types.ts,     │
│  enemies.ts, mechanics.ts, relics/,        │
│  statusEffects.ts, factsDB (IndexedDB)      │
└─────────────────────────────────────────────┘
```

The Svelte UI layer renders above the Phaser canvas using CSS `position: absolute`. Phaser occupies `#phaser-container` (a `<div>` inside `CardApp.svelte`). Svelte components render as DOM overlays on top.

---

## Boot Sequence

### Phase 1 — Pre-mount (synchronous, `src/main.ts`)

1. `runStorageMigrations()` — migrates legacy `terra_` localStorage keys to `rr_` prefix.
2. CSS code-splitting: conditionally imports `desktop.css` (≥768px) and `rtl.css` (RTL locales).
3. `isWebGLSupported()` check — mounts `WebGLFallback` and halts if WebGL unavailable.
4. `mount(CardApp, { target: document.getElementById('app') })` — Svelte app mounted.
5. `initAccessibilityManager()`, `initCardAudio()`, `initSyncDurabilityListener()`, `initScoreSubmissionQueue()` — global singletons initialized synchronously.
6. `initCardbackManifest()`, `initCardFrameManifest()` — asset manifests loaded in background.
7. `initPlayer('teen')` — player save loaded from localStorage.

### Phase 2 — Async boot (`bootGame()` in `src/main.ts`)

1. `await initI18n()` — locale JSON loaded, `dir` attribute set on `<html>`.
2. `factsDB.init()` — IndexedDB initialization starts in background (non-blocking).
3. `currentScreen.set('hub')` — navigates to hub unless a `?devpreset` URL param is active.
4. `syncService.pullFromCloud()` — cloud save pulled and merged with local save.
5. `await dbPromise` — waits for factsDB to finish.
6. `setupCapacitor()` → `splashScreen.hide()` — native splash dismissed on mobile.
7. `analyticsService.track({ name: 'app_open', ... })` — cold launch tracked.
8. `rescheduleNotificationsFromPlayerState()` — push notifications rescheduled.

### Phase 3 — Phaser boot (deferred, triggered by `CardApp.svelte` `onMount`)

`CardGameManager.getInstance().boot()` is called from `CardApp.svelte`'s `onMount`. This:

1. Registers `CardGameManager` on `globalThis[Symbol.for('rr:cardGameManager')]` — enables `encounterBridge` to reach it without circular imports.
2. Reads `layoutMode` store to determine correct canvas dimensions at construction time.
3. Creates `new Phaser.Game(...)` with scenes: `BootScene`, `CombatScene`, `RewardRoomScene` (plus `BootAnimScene` when `startAnimation=true`).
4. Registers `DepthLightingFX` custom pipeline.
5. Subscribes to `layoutMode` store for future orientation-change handling via `handleLayoutChange()`.

---

## Svelte ↔ Phaser Communication

There is no shared event bus. Communication uses three mechanisms:

### 1. Svelte → Phaser: direct method calls via `CardGameManager`

`encounterBridge.ts` retrieves the manager via symbol lookup:
```typescript
const mgr = globalThis[Symbol.for('rr:cardGameManager')]
mgr?.getCombatScene()  // returns live CombatScene instance
mgr?.startCombat()
```

`syncCombatScene(turnState)` in `encounterBridge.ts` calls imperative methods on `CombatScene`:
- `scene.setEnemy(name, category, hp, maxHp, id, animArchetype)`
- `scene.setEnemyIntent(type, telegraph, value)`
- `scene.updatePlayerHP(hp, maxHP, animated)`
- `scene.updatePlayerBlock(shield, animated)`
- `scene.setBackground(floor, isBoss, enemyId)`
- `scene.setRelics(relicList)`

### 2. Phaser → Svelte: Svelte writable stores

`encounterBridge.ts` exports `activeTurnState = writable<TurnState | null>(null)`. When game logic resolves a card play or ends a turn, `activeTurnState.set(freshTurnState(...))` pushes new state. Svelte components subscribe reactively.

`gameFlowController.ts` exports stores that `CardApp.svelte` binds directly:
- `gameFlowState` — current state machine node (`'combat'`, `'cardReward'`, `'dungeonMap'`, etc.)
- `activeCardRewardOptions`, `activeRelicRewardOptions`, `activeShopInventory`, `activeMysteryEvent`, and ~10 others

### 3. Combat exit handshake: `combatExitRequested` / `combatExitEnemyId`

When combat ends, `encounterBridge` sets `combatExitEnemyId` (defeated enemy's ID) and `combatExitRequested`. `CardApp.svelte` renders a `ParallaxTransition` component driven by these stores. When the transition completes, `CardApp` calls `onCombatExitComplete()` in `gameFlowController`, which fires `pendingPostCombatAction` (e.g. navigate to card reward screen).

---

## Key Singleton Services and Initialization Order

| Order | Service | Init Call | Notes |
|-------|---------|-----------|-------|
| 1 | `storageMigration` | `runStorageMigrations()` | Before any store reads |
| 2 | `accessibilityManager` | `initAccessibilityManager()` | Before user interaction |
| 3 | `cardAudioManager` | `initCardAudio()` | Before user interaction |
| 4 | `syncDurabilityService` | `initSyncDurabilityListener()` | Passive listener |
| 5 | `scoreSubmissionQueue` | `initScoreSubmissionQueue()` | Passive queue |
| 6 | `i18n` | `await initI18n()` | Blocks until locale loaded |
| 7 | `factsDB` | `factsDB.init()` | Background; awaited before Phaser boot |
| 8 | `playerData` | `initPlayer('teen')` | Sync localStorage read |
| 9 | `CardGameManager` | `boot()` in `onMount` | After Svelte mount |
| 10 | `encounterBridge` | Lazy, on first `startEncounterForRoom()` | Triggered by game flow |

`CardGameManager` is a static singleton (`CardGameManager.getInstance()`). It is also stored on `globalThis[Symbol.for('rr:cardGameManager')]` to avoid circular imports between `encounterBridge` and `CardGameManager`.

`factsDB` is a module-level singleton. `encounterBridge` calls `factsDB.init()` defensively if it isn't ready when `startEncounterForRoom()` is called.

---

## Phaser Scenes

| Scene Key | Class File | Purpose |
|-----------|-----------|---------|
| `BootAnimScene` | `src/game/scenes/BootAnimScene.ts` | Optional boot logo animation |
| `BootScene` | `src/game/scenes/BootScene.ts` | Preload; transitions to CombatScene |
| `CombatScene` | `src/game/scenes/CombatScene.ts` | Enemy sprites, HP bars, background, animations |
| `RewardRoom` | `src/game/scenes/RewardRoomScene.ts` | Animated reward reveal (key is `'RewardRoom'`) |

In `botMode` (`?botMode` URL param), Phaser runs as `Phaser.HEADLESS` — canvas is never rendered, saving CPU during automated simulation runs.
