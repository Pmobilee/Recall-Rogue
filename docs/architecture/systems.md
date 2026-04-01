# Game Systems

> **Purpose:** Phaser game systems — visual effects, enemy rendering, atmosphere, and game tick management
> **Last verified:** 2026-03-31
> **Source files:** `src/game/systems/TickSystem.ts`, `src/game/systems/ImpactSystem.ts`, `src/game/systems/StatusEffectVisualSystem.ts`, `src/game/systems/CombatParticleSystem.ts`, `src/game/systems/EnemySpriteSystem.ts`, `src/game/systems/WeaponAnimationSystem.ts`, `src/game/systems/DepthLightingSystem.ts`, `src/game/systems/CombatAtmosphereSystem.ts`, `src/game/systems/ScreenShakeSystem.ts`, `src/game/systems/ChallengeTracker.ts`

> See also: [scenes.md](scenes.md) for CardGameManager, BootScene, CombatScene, RewardRoomScene, and scene transitions

---

All systems are instantiated by `CombatScene` in its `create()`.

### TickSystem

**File:** `src/game/systems/TickSystem.ts` — singleton (`TickSystem.getInstance()`)

Central registry for tick-driven game logic. Stores named `TickCallback` functions (`(tick, layerTick) => void`). Designed to replace `setInterval`/`setTimeout` for all game logic.

| Method | Description |
|---|---|
| `register(key, cb)` | Add/replace a tick listener |
| `unregister(key)` | Remove by key |
| `advance()` | Fire all callbacks; increment `tickCount` and `layerTickCount` |
| `resetLayerTick()` | Zero `layerTickCount` on layer change |
| `resetAll()` | Full reset, clears all callbacks |
| `getTick()` / `getLayerTick()` | Current tick counters |

### ImpactSystem

**File:** `src/game/systems/ImpactSystem.ts` — stub only (mining code removed).

Exports type `HitState = 'graze' | 'normal' | 'heavy' | 'critical'`. No runtime logic remains.

### StatusEffectVisualSystem

**File:** `src/game/systems/StatusEffectVisualSystem.ts`

Manages persistent particle overlays on the enemy showing active status effects.

**Effect types:** `'poison'` (green drips), `'burn'` (orange embers), `'freeze'` (blue crystals), `'bleed'` (red drips), `'buff'` (gold aura ring), `'debuff'` (purple aura ring).

**Effect mapping:** `strength_up`, `empower`, `quicken` → `buff`; `weaken`, `expose`, `slow` → `debuff`.

| Method | Description |
|---|---|
| `setEnemyPosition(x, y)` | Update spawn origin for particles |
| `updateEffects(effects)` | Diff active effects, add/remove visuals |
| `clearAll()` | Remove all visuals |
| `destroy()` | Alias for `clearAll()` |

Respects `card:reduceMotionMode` localStorage flag and device tier (low-end: 0.65x scale).

### CombatParticleSystem

**File:** `src/game/systems/CombatParticleSystem.ts`

Multi-emitter particle manager. Respects `reduceMotion` and device-tier particle budgets.

**Procedural textures created:** `vfx_square_4`, `vfx_circle_6`, `vfx_diamond_4`, `vfx_streak_2x8`.

| Method | Description |
|---|---|
| `burstImpact(x, y, count, tint)` | Radial explosion from reused impact emitter |
| `burstDirectional(x, y, angle, spread, count, tint)` | Streak particles toward angle |
| `comboMilestone(level, x, y)` | 8–30 particles; colors escalate with combo (gold → magenta at 6+) |
| `tierUpCascade(x, y, color)` | 15 upward diamond sparkles |
| `enemyDeathAsh(x, y, spriteSize)` | Two-phase: fast upward burst + slower lingering fall |
| `goldCoinShower(x, y, count)` | Gold circle particles with gravity |
| `startAmbient(theme)` | Continuous low-rate emitter; themes: `'dust'`, `'embers'`, `'ice'`, `'arcane'`, `'void'` |
| `stopAmbient()` | Stop emitter; destroy after 3.1s lifespan drain |
| `destroy()` | Clean up all emitters |

### EnemySpriteSystem

**File:** `src/game/systems/EnemySpriteSystem.ts`

Renders enemy sprite in a `Phaser.GameObjects.Container` (depth 5) with layered "3D paper-cutout" shadow and outline effect. Provides procedural animations: idle bob, breathe, wobble, custom patterns, attack lunge, hit knockback, and death ash-disintegration.

Falls back to colored placeholder rectangle + emoji icon when no texture exists.

Key public surface: `setTexture(key, size, x, y, category)`, `getContainer()`, `updateBasePosition(x, y)`, `playAttack(cb)`, `playHit()`, `playDeath(cb)`, `setEnraged(bool)`, `applyAtmosphere(config)`.

**Scene-alive guard:** All `screenShake?.trigger()` calls inside tween `onComplete` callbacks are wrapped with `if (this.scene?.scene?.isActive())` to prevent errors when `CombatScene.onShutdown()` calls `tweens.killAll()` (which fires `onComplete` on in-flight tweens after the scene is destroyed).

### WeaponAnimationSystem

**File:** `src/game/systems/WeaponAnimationSystem.ts`

Manages sword, arm+tome, and shield player-side animations. Sprites start alpha=0 and fade in/out per play. Depth: `WEAPON_DEPTH = 996`.

**Assets:** `assets/sprites/weapons/sword.png`, `arm.png`, `tome.png`, `shield.png` (loaded via `preloadAssets()`, called from CombatScene preload).

**Setup lifecycle:** `createSprites(displayH)` must be called in both `CombatScene.create()` AND `CombatScene.onWake()`. `onShutdown()` calls `destroy()` which nulls all sprites and removes canvas textures; `onWake()` must recreate them. The base PNG textures (`weapon-sword` etc.) are NOT removed by `destroy()` — they survive in the texture cache from the initial preload, so `createSprites()` on wake is safe and cheap.

**Scene-alive guard:** `screenShake?.trigger()` calls inside tween `onComplete` callbacks are wrapped with `if (scene?.scene?.isActive())` to prevent crashes when `tweens.killAll()` fires callbacks on in-flight tweens during shutdown.

### DepthLightingSystem

**File:** `src/game/systems/DepthLightingSystem.ts`

Attaches `DepthLightingFX` PostFX pipeline to the combat background image for depth-based dynamic lighting. Disabled entirely on low-end devices (`getDeviceTier() === 'low-end'`).

| Method | Description |
|---|---|
| `queueDepthMapLoad(enemyId, bgKey)` | Queue depth map PNG in current Phaser load batch |
| `setEnemyContext(enemyId, floor)` | Store context for point light resolution |
| `attachToBackground(bgImage, atm)` | Attach PostFX pipeline to the background image |
| `applyAtmosphere(config)` | Configure pipeline with atmosphere color/intensity |
| `stop()` | Remove pipeline, destroy resources |

Depth map key format: `depth-{bgKey}`. Depth map path resolved by `getCombatDepthMap(enemyId)`.

### CombatAtmosphereSystem

**File:** `src/game/systems/CombatAtmosphereSystem.ts`

Manages ambient particles (dual-depth: back=3, front=12), fog overlay, and light shaft sprites driven by `AtmosphereConfig` presets from `src/data/roomAtmosphere.ts`.

**Particle textures:** `atm_dust`, `atm_ember`, `atm_ice`, `atm_arcane`, `atm_void` (procedural).

| Method | Description |
|---|---|
| `start(theme, floor?)` | Begin atmosphere for given `FloorTheme` |
| `startBossAtmosphere(enemyId)` | Override with boss-specific config |
| `setEnemyPosition(x)` | Reposition light shaft spotlight |
| `stop()` | Destroy emitters, fog, and shafts |
| `getConfig()` | Return current `AtmosphereConfig` or null |

### ScreenShakeSystem

**File:** `src/game/systems/ScreenShakeSystem.ts`

Perlin-noise camera shake with 3 intensity tiers. Uses camera scroll offset (not `Phaser.Cameras.Scene2D.Camera.shake()`).

**Tiers:**

| Tier | Amplitude | Duration | Frequency |
|---|---|---|---|
| `'micro'` | 2px | 100ms | 40Hz |
| `'medium'` | 4px | 200ms | 28Hz |
| `'heavy'` | 8px | 400ms | 18Hz |

Higher-priority tiers replace lower; equal/lower tier calls are ignored while a shake is active. Linear fade-out begins at 70% of duration. Respects `prefers-reduced-motion` media query.

| Method | Description |
|---|---|
| `trigger(tier)` | Start a shake (ignored if lower/equal priority active) |
| `update(deltaMs)` | Must be called every frame from scene `update()` |
| `setIntensity(0–1)` | Scale amplitude (0 = no shake) |
| `stop()` | Immediately cancel active shake |
| `isActive()` / `getActiveTier()` | Query shake state |

### ChallengeTracker

**File:** `src/game/systems/ChallengeTracker.ts`

Tracks weekly challenge progress stored in `PlayerSave.weeklyChallenge`. Auto-resets stats every Monday (compares `weekStartIso` to current Monday's ISO date).

**Stats tracked:** `blocksMinedThisWeek`, `factsLearnedThisWeek`, `fossilsFoundThisWeek`, `deepestLayerThisWeek`, `artifactsFoundThisWeek`, `studySessionsThisWeek`, `diveCompletionsThisWeek`, `quizCorrectThisWeek`, `mineralsCollectedThisWeek`, `dataDiscsFoundThisWeek`.

Constructor takes `getSave: () => PlayerSave` and `persistSave: () => void` callbacks. Key methods: `increment(key, by?)`, `updateMax(key, value)`, `getProgress(key)`, plus convenience methods like `recordFactLearned()`, `recordRunComplete()`, etc.
