# Scenes

> **Purpose:** Phaser scenes, lifecycle, and scene transitions
> **Last verified:** 2026-04-01
> **Source files:** `src/game/scenes/BootScene.ts`, `src/game/scenes/BootAnimScene.ts`, `src/game/scenes/CombatScene.ts`, `src/game/scenes/RewardRoomScene.ts`, `src/game/CardGameManager.ts`

> See also: [systems.md](systems.md) for the 10 game systems

---

## CardGameManager

**File:** `src/game/CardGameManager.ts` — singleton (`CardGameManager.getInstance()`)

Owns the `Phaser.Game` instance. Boots Phaser, manages all scene start/stop, and propagates layout changes.

**Boot:** `boot(startAnimation = false)` creates `Phaser.Game` with `type: Phaser.AUTO` (or `HEADLESS` when `Symbol.for('rr:botMode')` is set). Registers scenes in order: `[BootAnimScene?, BootScene, CombatScene, RewardRoomScene]`. Registers itself on `globalThis[Symbol.for('rr:cardGameManager')]`.

**Layout changes:** Subscribes to the `layoutMode` Svelte store. On change, calls `game.scale.setGameSize()` then iterates active scenes calling `scene.handleLayoutChange(mode)` on any scene that implements it.

**Key methods:**

| Method | Description |
|---|---|
| `boot(startAnimation?)` | Creates Phaser.Game, subscribes to layoutMode |
| `startCombat()` | Starts `CombatScene` if not already active |
| `stopCombat()` | Stops `CombatScene` |
| `startRewardRoom(data)` | Stops then starts `RewardRoom` with `RewardRoomData` |
| `stopRewardRoom()` | Stops `RewardRoom`, brings `CombatScene` to top |
| `stopBootAnim()` | Stops `BootAnimScene` regardless of sleep/active state |
| `getCombatScene()` | Returns typed `CombatScene` instance |
| `getRewardRoomScene()` | Returns typed `RewardRoomScene` instance |
| `destroy()` | Unsubscribes layoutMode, destroys Phaser.Game, resets singleton |

---

## Scenes

### BootScene

**Key:** `'BootScene'`

Minimal first scene. On `create()`: emits `'boot-complete'` on `this.game.events`, then calls `this.scene.sleep()`. Asset preloading is deliberately handled by `CombatScene` to avoid race conditions.

### BootAnimScene

**Key:** `'BootAnimScene'`

~12s cinematic splash. Canvas `transparent: true` composites over Svelte `HubScreen`. Tap-to-skip: `this.tweens.timeScale = 3`.

- **Part 1 (0–4.8s):** Starfield + logo deblur + glow + title sweep + studio tag + fireflies
- **Transition (4.8–5.6s):** Elements disintegrate upward; emits `'boot-anim-show-blurred'`
- **Part 2 (5.6–~12s):** 8 cave-ring PNGs zoom toward viewer (yStretch 3.5→1.12); ring 6 emits `'boot-anim-deblur'`; completion emits `'boot-anim-complete'` then sleeps

**Events:** `'boot-anim-show-blurred'` (4.8s) · `'boot-anim-deblur'` (ring 7) · `'boot-anim-complete'` (done)

**Assets:** `/assets/boot/`: `logo.png`, blur variants, `recallrogue.png`, `bramblegategames.png`, `cave_ring_0-7.png` (1024×1024, ADD blend). `shutdown()` kills all tweens/timers/emitters.

### CombatScene

**Key:** `'CombatScene'`

Renders the combat display zone (top ~58% of viewport in portrait, full canvas in landscape). Owns enemy sprite, HP bars, block indicators, intent text, floor counter, and relic tray. The bottom 45% (card hand, quiz overlay) is handled by Svelte.

**Systems instantiated in `create()`:**
- `EnemySpriteSystem` — enemy sprite with 3D paper-cutout layers
- `CombatAtmosphereSystem` — ambient particles, fog, light shafts
- `DepthLightingSystem` — depth-map PostFX pipeline on background
- `StatusEffectVisualSystem` — persistent particle overlays for poison/burn/freeze/bleed/buff/debuff
- `WeaponAnimationSystem` — sword/tome/shield animations
- `ScreenShakeSystem` — perlin-noise camera shake (public: `scene.screenShake`)

**Key public methods:**

| Method | Purpose |
|---|---|
| `handleLayoutChange(mode)` | Portrait/landscape reposition via `repositionAll()` |
| `onScaleResize(gameSize)` | Fires on Phaser scale manager `resize` events (same-mode window resizes). Recomputes `scaleFactor` and `displayH`, then calls `repositionAll()`. Listener registered in `create()`, cleaned up in `onShutdown()`. |
| `slideEnemyForQuiz(active)` | Slides enemy right (79% x) when quiz opens in landscape |
| `setEnemy(id, category, hp, maxHp)` | Load enemy texture, reposition, start atmosphere |
| `updateHP(enemy, player)` | Refresh HP bar graphics and near-death vignette |
| `updateBlock(enemyBlock, playerBlock)` | Refresh block bar graphics |
| `playHitFlash(tint?)` | Screen flash tween |
| `playEnemyDeathAnim(cb)` | Ash disintegration then callback |

**Layout constants (portrait):** `DISPLAY_ZONE_HEIGHT_PCT = 0.58`, `ENEMY_X_PCT = 0.50`, enemy sizes 300/340/400px scaled by `scaleFactor (w/BASE_WIDTH)`.

**Layout constants (landscape, `LANDSCAPE` object):** enemy centered at `ENEMY_X_PCT: 0.50`, slides to `0.79` during quiz. Enemy sizes are absolute game units (300/360/420px). In `repositionAll()`, the enemy sprite container is scaled by `w / LANDSCAPE_BASE_WIDTH` (1280) so sprites maintain proportional size across viewport changes.

### RewardRoomScene

**Key:** `'RewardRoom'`

Displays collectible reward items on a background. Players tap items to collect gold, health vials, cards, and relics. Receives `RewardRoomData` (`{ rewards: RewardItem[] }`) via `scene.settings.data`.

**`create()`:** Parses gold tiers from `/assets/reward_room/gold_tiers.json`, creates background (cover-scaled), spawns 15 animated fireflies, spawns reward items from cloth spawn zone JSON, creates continue button.

**`update()`:** Drives `updateFireflies(time, delta)` with sinusoidal bobbing and lifespan-based fade.

**Events emitted on `this.events`:** `'goldCollected'`, `'vialCollected'`, `'cardAccepted'`, `'relicAccepted'`, `'sceneComplete'`.

**`checkAutoAdvance()`:** Called whenever an item is collected. If all items are collected, fires `'sceneComplete'`. In normal mode: 800ms `delayedCall` (lets disintegration animation finish). In turbo/bot mode (`isTurboMode()`): emits synchronously so the `handleComplete → stopRewardRoom → onComplete → proceedAfterReward → currentScreen.set('dungeonMap')` callback chain completes within the same Phaser event dispatch, preventing `currentScreen` from stalling on `'rewardRoom'`.

**Assets preloaded:** `reward_bg.webp`, `reward_bg_landscape.jpg`, `gold_tier_0-5.png`, `health_vial_small/large.png`, all 30+ mechanic card art PNGs, v2 card frame WebPs.

**`shutdown()`:** Kills all tweens/timers, clears overlay, then removes all scene-level event listeners (`this.events.removeAllListeners()`) and keyboard listeners (`this.input.keyboard?.removeAllListeners()`). Also calls `removeAllListeners()` on each item sprite before destroying it. This prevents listener accumulation when the scene is stopped and restarted between encounters (crashes with `Cannot read properties of undefined (reading 'trigger')` were caused by missing this cleanup).

**Note:** Stone slab art is placeholder (TODO AR-225).

---

## Scene Transitions

| From → To | Mechanism |
|---|---|
| Boot → Combat | `BootScene.create()` emits `'boot-complete'`; Svelte starts combat |
| Boot anim → Hub | `'boot-anim-complete'` event; `CardApp.svelte` hides Phaser canvas |
| Combat → Reward | `CardGameManager.startRewardRoom(data)` stops/starts `RewardRoom` |
| Reward → Combat | `CardGameManager.stopRewardRoom()` stops `RewardRoom`, brings `CombatScene` to top |
| Any → Any (Svelte) | `currentScreen` store in `gameState.ts`; Svelte conditional rendering |
