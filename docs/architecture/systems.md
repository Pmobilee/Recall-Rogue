# Game Systems

> **Purpose:** Phaser game systems — visual effects, enemy rendering, atmosphere, and game tick management
> **Last verified:** 2026-04-03
> **Source files:** `src/game/systems/TickSystem.ts`, `src/game/systems/ImpactSystem.ts`, `src/game/systems/StatusEffectVisualSystem.ts`, `src/game/systems/CombatParticleSystem.ts`, `src/game/systems/EnemySpriteSystem.ts`, `src/game/systems/WeaponAnimationSystem.ts`, `src/game/systems/DepthLightingSystem.ts`, `src/game/systems/CombatAtmosphereSystem.ts`, `src/game/systems/ScreenShakeSystem.ts`, `src/game/systems/ChallengeTracker.ts`, `src/game/systems/ForegroundParallaxSystem.ts`, `src/game/systems/DungeonMoodSystem.ts`

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

Key public surface: `setTexture(key, size, x, y, category)`, `getContainer()`, `updateBasePosition(x, y)`, `playAttack(cb)`, `playHit()`, `playDeath(cb)`, `setEnraged(bool)`, `applyAtmosphere(config)`, `playEntranceReveal(isBoss, onComplete?)` (cinematic shadow-to-light reveal, replaces legacy `playEntry`).

**Scene-alive guard:** All `screenShake?.trigger()` calls inside tween `onComplete` callbacks are wrapped with `if (this.scene?.scene?.isActive())` to prevent errors when `CombatScene.onShutdown()` calls `tweens.killAll()` (which fires `onComplete` on in-flight tweens after the scene is destroyed).

### WeaponAnimationSystem

**File:** `src/game/systems/WeaponAnimationSystem.ts`

Manages sword, arm+tome, and shield player-side animations. Sprites start alpha=0 and fade in/out per play. Depth: `WEAPON_DEPTH = 996`.

**Assets:** `assets/sprites/weapons/sword.png`, `arm.png`, `tome.png`, `shield.png` (loaded via `preloadAssets()`, called from CombatScene preload).

**Setup lifecycle:** `createSprites(displayH)` must be called in both `CombatScene.create()` AND `CombatScene.onWake()`. `onShutdown()` calls `destroy()` which nulls all sprites and removes canvas textures; `onWake()` must recreate them. The base PNG textures (`weapon-sword` etc.) are NOT removed by `destroy()` — they survive in the texture cache from the initial preload, so `createSprites()` on wake is safe and cheap.

**Scene-alive guard:** `screenShake?.trigger()` calls inside tween `onComplete` callbacks are wrapped with `if (scene?.scene?.isActive())` to prevent crashes when `tweens.killAll()` fires callbacks on in-flight tweens during shutdown.

**Impact sync ( callback, 2026-04-03):**

`playSwordSlash(enemyX, enemyY, onImpact?)` and `playTomeCast(glowColor, onImpact?)` accept an optional `onImpact?: () => void` callback that fires at the weapon's visual contact frame:

- Sword: T+250ms (slash tween `onComplete` — blade at maximum foreshortening, furthest forward point)
- Tome: T+330ms (glow burst tween `onComplete` — 250ms arm rise + 80ms glow peak)

`CombatScene.playPlayerAttackAnimation(onImpact?)` and `playPlayerCastAnimation(cardType?, onImpact?)` wire these callbacks. `encounterBridge` passes `() => scene.playEnemyHitAnimation()` as the callback for attack/cast cards with damage, deferring the enemy recoil to the contact frame instead of T+0. Shield cards and wrong-answer paths fire enemy hit immediately (no weapon animation plays). Impact sparks (5 particles via `burstParticles()`) are also spawned at the enemy position inside the weapon's `onImpact` closure — warm yellow (`0xFFFF88`) for sword, chain-colored for tome.

### DepthLightingSystem

**File:** `src/game/systems/DepthLightingSystem.ts`

Attaches `DepthLightingFX` PostFX pipeline to the combat background image for depth-based dynamic lighting. Disabled entirely on low-end devices (`getDeviceTier() === 'low-end'`).

| Method | Description |
|---|---|
| `queueDepthMapLoad(enemyId, bgKey)` | Queue depth map PNG in current Phaser load batch |
| `setEnemyContext(enemyId, floor)` | Store context for point light resolution |
| `attachToBackground(bgImage)` | Attach PostFX pipeline to the background image |
| `applyAtmosphere(config)` | Configure pipeline with atmosphere color/intensity; also applies depth shader micro-animations |
| `setMicroAnimConfig(config)` | Apply `MicroAnimConfig` with device tier gating (mid: torch+fog; flagship: all three) |
| `disableMicroAnim()` | Set all three micro-animation uniforms to 0 (for reduce-motion) |
| `animateLightsIn(durationMs)` | Fade all point light intensities from 0 to base over duration; called during enemy entrance reveal; no-op on low-end or when no pipeline active |
| `pulseLight(color, intensity, durationMs, x, y)` | One-shot radial glow at screen position (ADD blend Graphics circle, depth 997); tweens alpha 0→peak→0 with quadratic ease; fire-and-forget; no-op on low-end |
| `flickerOnePointLight(durationMs)` | Dims first registered point light to 0 and restores over durationMs (3 equal phases: dim/hold/restore); silent no-op if no point lights active |
| `stop()` | Remove pipeline, destroy resources |

Depth map key format: `depth-{bgKey}`. Depth map path resolved by `getCombatDepthMap(enemyId)`.

**Ambient level resolution** (inside `applyAtmosphere`): uses `lightSourceManifest` `ambientOverride` when present, otherwise `0.15` for rooms with point lights or `0.40` for rooms without. A hard floor clamp of `Math.max(ambientLevel, 0.30)` is applied after all logic so no enemy background ever goes below 30% brightness — prevents the near-black overlay that low `ambientOverride` values (e.g. `0.06` on `ink_slug`) caused.

**Depth shader micro-animations (Spec 08):** Three GLSL effects added to `DepthLightingFX` driven by the depth map and `uTime`. All read from `AtmosphereConfig.depthShaderAnim` (`MicroAnimConfig` interface in `src/data/roomAtmosphere.ts`):

| Effect | GLSL uniform | Depth mask | Tier |
|---|---|---|---|
| Torch flicker | `uTorchFlickerIntensity` | bright/near (depth > 0.6) | mid + flagship |
| Water ripple | `uWaterRippleStrength` | dark/far (depth < 0.35) | flagship only |
| Fog drift | `uFogDriftOpacity` | far regions (additive fog) | mid + flagship |

Per-biome intensities: `dust` (0.08/0.000/0.04), `embers` (0.12/0.000/0.06), `ice` (0.04/0.002/0.03), `arcane` (0.06/0.001/0.08), `void` (0.03/0.003/0.10). All disabled when `card:reduceMotionMode` is true.

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
| `spikeParticleRate(durationMs)` | Temporarily double front emitter rate for a visual spike (e.g. turn transitions). No-op if reduceMotion or no emitter active. |
| `applyChainModifiers(frequencyMultiplier)` | Scale both emitter intervals by multiplier (e.g. 0.5 = double rate). No-op on low-end or reduceMotion. |
| `clearChainModifiers()` | Restore emitter intervals to base frequencies. |
| `pulseWarm(durationMs)` | Brief upward particle boost (gravityY −30) for 300ms; no-op on low-end or reduce-motion. Correct-answer atmosphere pulse. |
| `pulseCold(durationMs)` | Fog alpha +0.05 and particle scatter velocity impulse (300ms); particle changes skipped on low-end/reduce-motion. Wrong-answer atmosphere pulse. |
| `setStreakWarm(active, onSaturationChange?))` | Enable/disable persistent warm saturation shift (+5%, capped at +10%); mutually exclusive with cold. |
| `setStreakCold(active, onSaturationChange?))` | Enable/disable persistent cold saturation shift (−5%, capped at −10%); mutually exclusive with warm. |
| `resetStreak(onSaturationChange?)` | Clear all streak state and saturation modifier. Call at encounter start. |
| `getStreakSaturationModifier()` | Returns current saturation offset (−0.10 to +0.10). |

**Chain modifier state:** `baseBackFrequency` and `baseFrontFrequency` are stored at `start()` for restoration by `clearChainModifiers()`. Low-end devices are excluded via `getDeviceTier() === 'low-end'` guard.

**Knowledge-reactive streak state (Spec 05):** `_streakSaturationModifier` (−0.10 to +0.10) persists for the encounter duration. `setStreakWarm`/`setStreakCold` are mutually exclusive. `resetStreak()` clears all state at encounter start.

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

---

### ForegroundParallaxSystem

**File:** `src/game/systems/ForegroundParallaxSystem.ts`
**Data:** `src/data/foregroundElements.ts`
**Spec:** `docs/immersion/07-foreground-parallax.md`

Renders sparse semi-transparent foreground overlay sprites at Phaser **depth 13** (above front particles at 12, below HUD/UI layers) to create a depth illusion. Per-biome element pools are defined in `FOREGROUND_ELEMENTS` (dust/embers/ice/arcane/void). Element count is gated by device tier (low=1, mid=2, flagship=3).

**Placeholder textures:** Generated procedurally via `Phaser.GameObjects.Graphics.generateTexture()` in `createPlaceholderTextures()`. Only creates a texture if it doesn't already exist in the cache — so real PNG assets placed at `src/assets/sprites/foreground/fg_[name].png` and loaded via `this.load.image()` take precedence.

**Element selection:** `selectForegroundElements(theme)` picks N without replacement from the biome pool. For N=2, prefers `top-left` + `bottom-right` for balanced visual weight. Anchor slots resolve to edge positions via `resolveAnchorPosition()` — always within 60px of screen edges so enemy sprites and card hand UI are never obscured.

| Method | Description |
|---|---|
| `createPlaceholderTextures()` | Generate procedural placeholder textures once in `CombatScene.create()` |
| `start(theme, w, h)` | Begin the layer for an encounter; stops any existing elements first |
| `update(delta)` | Idle breathing drift: 8s period X (±0.5px), 10s period Y (±0.3px), per-element phase offset prevents lockstep |
| `onDamage(shakeOffset)` | Shift elements 1.5× the shake offset via short yoyo tween; no-op on reduce-motion or low-end |
| `onTurnTransition()` | 1px rightward yoyo tween (150ms); no-op on reduce-motion |
| `resize(w, h)` | Recalculate all base positions for new viewport dimensions |
| `stop()` | Destroy sprites; safe to call when not active |
| `destroy()` | Full teardown including container; call on scene shutdown |

**Reduce-motion:** Sprites display statically at base positions; `update()`, `onDamage()`, and `onTurnTransition()` are all no-ops.

**Device tier gating:**
| Tier | Elements | Breathing | Reactive shift |
|---|---|---|---|
| low-end | 1 | Disabled | Disabled |
| mid | 2 | Enabled | Enabled |
| flagship | 3 | Enabled | Enabled |

**CombatScene wiring:**
- Instantiated and `createPlaceholderTextures()` called in `create()`
- `start(theme, w, h)` called in `setEnemy()` after `atmosphereSystem.start()`
- `update(delta)` called in scene `update()` loop
- `onTurnTransition()` called in `playTurnTransitionToPlayer()`
- `resize(w, h)` called in `onScaleResize()`
- `destroy()` called in `onShutdown()`



---

## DungeonMoodSystem (Spec 09)

**File:** `src/game/systems/DungeonMoodSystem.ts`
**Spec:** `docs/immersion/09-dungeon-mood.md`

A continuous mood state (0.0 calm → 1.0 desperate) driven by real-time game signals that modulates all visual atmosphere parameters. The value smooth-interpolates toward its target over ~2.5 seconds via exponential lerp so transitions are never jarring.

The mood system is the **baseline layer** — chain escalation (Spec 03) and knowledge-reactive (Spec 05) layer their transient spikes on top via `applyTransientModifier()`.

### Interfaces

```typescript
interface MoodInputs {
  playerHpRatio: number      // 0.0 dead → 1.0 full HP
  chainLength: number        // 0+, chains lower mood
  consecutiveCorrect: number // streaks lower mood
  enemyThreatLevel: number   // 0–1 from HP ratio + intent damage
  floorDepth: number         // 1–15+, deeper slightly raises mood
}

interface MoodModifiers {
  vignetteMultiplier: number       // 0.8 calm → 1.4 desperate
  colorTempShift: number           // -1.0 warm → +1.0 cold
  particleRateMultiplier: number   // 0.8 calm → 1.5 desperate
  particleChaosMultiplier: number  // 1.0 → 1.5 (flagship only)
  lightFlickerMultiplier: number   // 1.0 → 1.8
  fogDensityMultiplier: number     // 0.9 → 1.3
  desaturationAmount: number       // 0.0 → 0.15
}
```

### Mood computation weights

| Signal | Weight | Direction |
|---|---|---|
| Low HP (`1 - hpRatio`) | ×0.40 | ↑ mood |
| Chain length (`/ 8`) | ×0.20 | ↓ mood |
| Correct streak (`/ 5`) | ×0.15 | ↓ mood |
| Enemy threat level | ×0.15 | ↑ mood |
| Floor depth (`/ 14`) | ×0.10 | ↑ mood |

Base offset 0.5: full HP + no chain/threat → neutral. Must have chain + streak to reach calm (<0.4); must have low HP + high threat to reach desperate (>0.8).

| Method | Description |
|---|---|
| `start()` | Begin encounter; reset mood to 0.5 |
| `stop()` | End encounter; reset all state |
| `update(deltaMs, inputs)` | Per-frame lerp + modifier computation. Call from CombatScene.update() |
| `getModifiers()` | Return cached MoodModifiers (new object each frame) |
| `applyTransientModifier(mod, durationMs)` | Push a time-limited modifier spike (for specs 01/03/05) |
| `getMood()` | Current mood value (0.0–1.0) |
| `isActive()` | Whether system is running |

### Device-tier gating

| Modifier | Low-end | Mid | Flagship |
|---|---|---|---|
| vignetteMultiplier | On | On | On |
| colorTempShift | On | On | On |
| desaturationAmount | On | On | On |
| particleRateMultiplier | Off | On | On |
| fogDensityMultiplier | Off | On | On |
| lightFlickerMultiplier | Off | On | On |
| particleChaosMultiplier | Off | Off | On |

### Reduce-motion gating
Motion modifiers suppressed: `particleRateMultiplier`, `particleChaosMultiplier`, `lightFlickerMultiplier`. Non-motion kept: `vignetteMultiplier`, `colorTempShift`, `fogDensityMultiplier`, `desaturationAmount`.

### CombatScene wiring
- Instantiated in `create()`; `moodVignetteOverlay` (depth 2, black rect) also created
- `start()` called in `setEnemy()` (resets mood per encounter)
- `feedMoodInputs()` called from `update()` — reads `activeTurnState` store
- `calculateEnemyThreat(ts)` normalizes `(1 - enemyHpRatio) × 0.5 + (intentDamage/20) × 0.5`
- `applyMoodModifiers()` called per-frame: drives vignette overlay, atmosphere particle rate, lighting flicker, fog, and combined saturation
- Saturation: `applyMoodSaturation()` combines `knowledgeSaturationOffset` (streak) + `desaturationAmount` (mood) additively
- `stop()` called in `onShutdown()`

### New subsystem methods added for mood routing
- `CombatAtmosphereSystem.setMoodParticleRate(mult)` — scales raw base frequencies; chain modifiers apply on top
- `DepthLightingSystem.setMoodFlickerSpeed(mult)` — stacks with `chainFlickerSpeedMult` in `pushPointLightsToShader`
- `DepthLightingSystem.setMoodFogMultiplier(mult)` — scales stored `baseFogDensity` and re-applies to shader

### Transient modifier integration (for specs 01, 03, 05)
```typescript
// Spec 01 — turn transition vignette spike (300ms)
dungeonMood.applyTransientModifier({ vignetteMultiplier: 1.3 }, 300)

// Spec 03 — chain warm color pulse on each link
dungeonMood.applyTransientModifier({ colorTempShift: -0.5 }, 500)

// Spec 05 — correct answer particle burst
dungeonMood.applyTransientModifier({ particleRateMultiplier: 1.3 }, 600)
```
Multiplier transients (particleRateMultiplier, vignetteMultiplier, etc.) stack multiplicatively.
Additive transients (colorTempShift, desaturationAmount) stack additively.

---

## Floor Descent Ceremony Effects (Spec 04)

**Orchestrating method:** `CombatScene.playDescentEffects(floor, isBoss)` in `src/game/scenes/CombatScene.ts`

Not a standalone system — this method coordinates existing systems (ScreenShakeSystem, built-in particle emitter, DOM events) to produce the floor descent ceremony defined in `docs/immersion/04-floor-descent.md`.

| Action | System used | Notes |
|--------|-------------|-------|
| Debris cascade | `burstParticles()` (built-in emitter) | 10–25 gray/brown particles, top 30% of viewport |
| Landing rumble | `ScreenShakeSystem.trigger('heavy')` | Delayed by 2800ms (boss: 3800ms) |
| DOM event `rr:floor-descent` | `window.dispatchEvent` | Triggers Svelte overlays (ParallaxTransition, title card) |

Called from two sites in `gameFlowController.ts` via `getCombatScene()?.playDescentEffects(...)` immediately after `advanceFloor()`.
