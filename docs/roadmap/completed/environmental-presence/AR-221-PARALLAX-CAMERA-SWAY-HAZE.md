# AR-221: Parallax, Camera Sway & Elemental Effects

**Status:** Pending
**Priority:** Medium (polish — final layer of environmental depth)
**Complexity:** Medium
**Estimated Files:** 3 modified, possibly 1 new (haze shader)
**Depends on:** AR-215 (Atmosphere Config for parallax/haze/micro-animation values)

## Overview

Add the final three environmental presence techniques:

1. **Idle camera sway** — A gentle 3-5 pixel oscillation that creates parallax depth even in static combat screens. Combined with scroll-factor layering, this makes the background, enemy, and foreground elements move at different speeds, transforming flat scenes into spatial environments.

2. **Heat haze / elemental displacement** — UV displacement shader for fire rooms (embers theme) and void rooms. A barely-perceptible shimmer that sells the elemental fantasy. Uses Phaser's built-in Displacement FX or a custom masked shader.

3. **Micro-animation synced to room** — Enemy idle reactions that sync with the room's oscillator: torch flicker glow in fire rooms, ice shiver in cold rooms, arcane pulse in magic rooms, void phase-shift in abyss rooms.

These three techniques complete the environmental presence stack. Together with AR-215 through AR-220, they transform combat from "sprite pasted on background" to "creature inhabiting a space."

## Dependencies

- **Blocked by:** AR-215 (parallax amplitudes, haze config, micro-animation config)
- **Blocks:** Nothing
- **Related:** `src/game/scenes/CombatScene.ts` (camera), `src/game/systems/EnemySpriteSystem.ts` (micro-animation), `src/data/roomAtmosphere.ts` (config source)

## Sub-Steps

### 1. Idle Camera Sway

**File:** `src/game/scenes/CombatScene.ts`

Add a gentle camera oscillation that creates parallax movement:

```typescript
private setupCameraSway(config: AtmosphereConfig): void {
  if (getDeviceTier() === 'low-end') return; // Skip on low-end

  const { swayAmplitudeX, swayAmplitudeY, swayDuration } = config.parallax;

  // Gentle oscillation — sine wave on both axes
  this._swayTween = this.tweens.add({
    targets: this.cameras.main,
    scrollX: { from: -swayAmplitudeX, to: swayAmplitudeX },
    scrollY: { from: -swayAmplitudeY, to: swayAmplitudeY },
    duration: swayDuration,
    ease: 'Sine.easeInOut',
    yoyo: true,
    repeat: -1,
  });
}
```

**Critical pixel art rule:** Camera positions must snap to whole pixels. Add a post-update hook:

```typescript
// In update() or as a camera post-process
private snapCameraToPixels(): void {
  const cam = this.cameras.main;
  cam.scrollX = Math.round(cam.scrollX);
  cam.scrollY = Math.round(cam.scrollY);
}
```

**Also ensure `roundPixels: true` in game config** (`CardGameManager.ts`):
```typescript
render: {
  pixelArt: true,
  antialias: false,
  roundPixels: true,  // <-- ADD THIS (currently missing!)
  preserveDrawingBuffer: true,
},
```

### 2. Scroll-Factor Parallax on Background Layers

**File:** `src/game/scenes/CombatScene.ts`

The background image should have a lower scroll factor so it moves slower than the camera, creating depth:

```typescript
private setupParallax(): void {
  // Background moves at 30% of camera speed — appears farther away
  if (this.combatBackground) {
    this.combatBackground.setScrollFactor(0.3);
  }

  // Fog overlay moves at 50% — between background and gameplay
  if (this.atmosphereSystem?.fogGraphics) {
    this.atmosphereSystem.fogGraphics.setScrollFactor(0.5);
  }

  // Enemy sprite container stays at 1.0 (default — moves with camera)
  // This is already the case by default

  // Front atmosphere particles move at 1.2 — appear closer to camera
  if (this.atmosphereSystem?.frontEmitter) {
    this.atmosphereSystem.frontEmitter.setScrollFactor(1.2);
  }

  // Vignette stays fixed at 0.0 — screen-space overlay
  if (this.vignetteGfx) {
    this.vignetteGfx.setScrollFactor(0);
  }
}
```

**Scroll factor depth mapping:**

| Layer | Scroll Factor | Perceived Depth |
|-------|---------------|-----------------|
| Background image | 0.3 | Far background |
| Back atmosphere particles | 0.5 | Mid-background |
| Fog overlay | 0.5 | Mid-background |
| Light shafts | 0.6 | Mid-ground |
| Enemy sprite | 1.0 (default) | Focal plane |
| Front atmosphere particles | 1.2 | Near foreground |
| HP bars, UI | 0.0 (fixed) | Screen-space |
| Vignette | 0.0 (fixed) | Screen-space |

### 3. Mouse-Position Parallax (Steam PC)

For the Steam PC build, add subtle mouse-tracking parallax that makes the scene feel responsive:

```typescript
private setupMouseParallax(): void {
  // Only on desktop/Steam — mobile doesn't have mouse hover
  if (this.sys.game.device.os.desktop === false) return;
  if (getDeviceTier() === 'low-end') return;

  this._mouseParallaxEnabled = true;
}

// In update():
private updateMouseParallax(): void {
  if (!this._mouseParallaxEnabled) return;

  const pointer = this.input.activePointer;
  const centerX = this.scale.width / 2;
  const centerY = this.scale.height / 2;

  // Normalized pointer offset from center (-1 to 1)
  const px = (pointer.x - centerX) / centerX;
  const py = (pointer.y - centerY) / centerY;

  // Lerp camera toward pointer offset (smooth, not instant)
  const maxOffset = 8; // Max pixels of mouse-driven parallax
  const targetX = px * maxOffset;
  const targetY = py * maxOffset;

  // Add to idle sway (don't replace it)
  this._mouseOffsetX = Phaser.Math.Linear(this._mouseOffsetX, targetX, 0.05);
  this._mouseOffsetY = Phaser.Math.Linear(this._mouseOffsetY, targetY, 0.05);

  // Apply mouse offset (idle sway is handled by its own tween on scrollX/Y)
  // We apply mouse offset via camera follow offset
  this.cameras.main.setFollowOffset(
    -Math.round(this._mouseOffsetX),
    -Math.round(this._mouseOffsetY)
  );
}
```

**Note:** `Math.round()` on the offset ensures pixel snapping even with mouse parallax.

### 4. Heat Haze Displacement (Embers + Void Themes)

**File:** `src/game/scenes/CombatScene.ts`

For rooms with `config.haze.enabled === true` (embers and void themes):

**Option A: Built-in Displacement FX (simplest)**

```typescript
private setupHeatHaze(config: AtmosphereConfig): void {
  if (!config.haze.enabled) return;
  if (getDeviceTier() === 'low-end') return;

  // Use Phaser's built-in displacement effect on the camera
  // Requires a noise texture
  if (!this.textures.exists('perlin_noise')) {
    this.createPerlinNoiseTexture();
  }

  this._hazeFx = this.cameras.main.postFX.addDisplacement('perlin_noise',
    config.haze.strength,
    config.haze.strength
  );
}

// In update():
private updateHeatHaze(time: number): void {
  if (!this._hazeFx) return;

  // Oscillate displacement strength for shimmer effect
  const s = this.atmosphereConfig.haze.strength;
  this._hazeFx.x = s * Math.sin(time * 0.001);
  this._hazeFx.y = s * Math.cos(time * 0.0013);
}
```

**Option B: Custom Masked Haze Shader (better — localized to bottom portion)**

If Option A applies haze to the entire screen (including UI), use a custom shader that masks the effect to the bottom portion only:

**File:** `src/game/shaders/HeatHazeFX.ts`

```typescript
export class HeatHazeFX extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  constructor(game: Phaser.Game) {
    super({
      game,
      name: 'HeatHazeFX',
      fragShader: HEAT_HAZE_FRAG,
    });
  }

  setHazeConfig(strength: number, yStart: number, time: number): void {
    this.set1f('uStrength', strength);
    this.set1f('uYStart', yStart);
    this.set1f('uTime', time);
  }
}
```

**Fragment shader:**
```glsl
precision mediump float;

uniform sampler2D uMainSampler;
uniform float uTime;
uniform float uStrength;   // 0.002 - 0.008
uniform float uYStart;     // 0.0 - 1.0 (where effect begins)

varying vec2 outTexCoord;

void main() {
  vec2 uv = outTexCoord;

  // Mask: only affect pixels below yStart
  float mask = smoothstep(uYStart, uYStart + 0.15, uv.y);

  // Sinusoidal displacement — subtle shimmer
  float distX = sin(uv.y * 40.0 + uTime * 2.0) * uStrength * mask;
  float distY = cos(uv.x * 28.0 + uTime * 1.6) * uStrength * 0.5 * mask;

  gl_FragColor = texture2D(uMainSampler, uv + vec2(distX, distY));
}
```

**Pixel art constraint:** `uStrength` MUST stay between 0.002 and 0.008. Larger values cause visible pixel-art edge shatter. The shimmer should be barely perceptible — felt more than seen.

**Recommendation:** Use Option B (custom masked shader) — it only distorts the bottom portion, keeping the enemy sprite and UI clean. Apply to camera postFX.

### 5. Procedural Perlin Noise Texture

Generate a simple noise texture for displacement if Option A is used:

```typescript
private createPerlinNoiseTexture(): void {
  const size = 256;
  const canvas = this.textures.createCanvas('perlin_noise', size, size);
  const ctx = canvas.getContext();
  const imgData = ctx.createImageData(size, size);

  // Simple value noise (adequate for displacement — doesn't need true Perlin)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const v = Math.floor(Math.random() * 256);
      imgData.data[i] = v;
      imgData.data[i + 1] = v;
      imgData.data[i + 2] = v;
      imgData.data[i + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  canvas.refresh();
}
```

### 6. Micro-Animation Synced to Room

**File:** `src/game/systems/EnemySpriteSystem.ts`

Add room-synced micro-animations beyond the standard idle bob:

```typescript
/** Shared room oscillator — drives synced effects */
private roomOscillator = { time: 0 };

/** Apply room-specific micro-animation to enemy sprite */
setupMicroAnimation(config: AtmosphereConfig): void {
  const { enemyReaction, reactionIntensity } = config.microAnimation;
  if (enemyReaction === 'none') return;

  switch (enemyReaction) {
    case 'torch_flicker':
      // Glow intensity pulses in sync with room oscillator
      this._microTween = this.scene.tweens.add({
        targets: this.mainSprite,
        alpha: { from: 0.92, to: 1.0 },
        duration: 200 + Math.random() * 200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      break;

    case 'ice_shiver':
      // Subtle horizontal vibration
      this._microTween = this.scene.tweens.add({
        targets: this.container,
        x: { from: this.container.x - 0.5, to: this.container.x + 0.5 },
        duration: 80,
        yoyo: true,
        repeat: -1,
      });
      break;

    case 'arcane_pulse':
      // Slow scale pulse
      this._microTween = this.scene.tweens.add({
        targets: this.mainSprite,
        scaleX: { from: this.mainSprite.scaleX, to: this.mainSprite.scaleX * 1.01 },
        scaleY: { from: this.mainSprite.scaleY, to: this.mainSprite.scaleY * 1.01 },
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      break;

    case 'void_phase':
      // Alpha flicker — occasionally becomes slightly transparent
      this._microTween = this.scene.tweens.add({
        targets: this.mainSprite,
        alpha: { from: 1.0, to: 0.85 },
        duration: 2000 + Math.random() * 1000,
        yoyo: true,
        repeat: -1,
        ease: 'Quad.easeInOut',
      });
      break;
  }
}
```

**Interaction with existing idle animation:** Micro-animations are ADDITIVE — they run alongside the existing idle bob tween. The idle bob moves the container's Y position; micro-animations affect sprite alpha/scale/x-offset. They don't conflict because they operate on different properties.

**Exception: ice_shiver** moves the container's X. This overlaps with any x-based idle animation. Ensure the shiver amplitude (0.5px) is small enough to not visually clash with the idle bob.

### 7. Cleanup on Scene Transition

```typescript
destroyEnvironmentalEffects(): void {
  // Camera sway
  this._swayTween?.destroy();

  // Mouse parallax
  this._mouseParallaxEnabled = false;

  // Heat haze
  if (this._hazeFx) {
    this.cameras.main.postFX.remove(this._hazeFx);
    this._hazeFx = null;
  }

  // Micro-animation
  this._microTween?.destroy();
}
```

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `src/game/scenes/CombatScene.ts` | **MODIFY** | Camera sway, parallax scroll factors, mouse parallax, heat haze, update loop |
| `src/game/systems/EnemySpriteSystem.ts` | **MODIFY** | Micro-animation setup per theme |
| `src/game/CardGameManager.ts` | **MODIFY** | Add `roundPixels: true` to render config, register HeatHazeFX pipeline |
| `src/game/shaders/HeatHazeFX.ts` | **CREATE** | Custom masked heat haze PostFX (if Option B) |

## Acceptance Criteria

- [x] Idle camera sway visible (3-5px oscillation, smooth sine wave)
- [x] Camera positions snap to whole pixels (no sub-pixel shimmer)
- [x] `roundPixels: true` added to game config
- [x] Background moves slower than camera (scroll factor 0.3)
- [x] Front particles move faster than camera (scroll factor 1.2)
- [x] Vignette and UI stay fixed (scroll factor 0)
- [x] Mouse parallax works on desktop (8px max offset, smooth lerp)
- [x] Mouse parallax disabled on mobile
- [x] Heat haze visible in embers theme (bottom 50% of screen shimmers)
- [x] Heat haze visible in void theme (bottom 70% shimmers, weaker)
- [x] Heat haze does NOT distort enemy sprite significantly (strength 0.002-0.008)
- [x] Heat haze masked — top portion of screen is undistorted
- [x] Micro-animations active per theme:
  - Dust/Embers: torch flicker (alpha pulse)
  - Ice: subtle shiver (x vibration)
  - Arcane: slow scale pulse
  - Void: alpha phase flicker
- [x] Micro-animations don't conflict with idle bob
- [x] Low-end devices skip camera sway, mouse parallax, and heat haze
- [x] All effects cleaned up on scene transition
- [x] `npm run typecheck` passes
- [x] `npm run build` succeeds

## Verification Gate

1. `npm run typecheck` + `npm run build` — clean
2. Playwright: observe background parallax during camera sway (take 2 screenshots at sway extremes)
3. Playwright: verify heat haze in embers theme (floor 5) — visible shimmer in bottom half
4. Playwright: verify NO heat haze in dust theme (floor 1)
5. Playwright: verify micro-animation in ice theme — enemy has subtle horizontal vibration
6. Console: no shader errors, no "texture not found"
7. FPS: should stay at 60fps throughout all effects

## Performance Budget

| Component | GPU Cost | Notes |
|-----------|----------|-------|
| Camera sway tween | **~0.01ms** | CPU tween math only |
| Scroll factor parallax | **Free** | Vertex transform, no overhead |
| Mouse parallax (CPU lerp) | **~0.01ms** | Math only |
| Heat haze shader (full screen) | **~0.5ms** | Single-pass sin/cos + texture read |
| Micro-animation tweens | **~0.01ms** | CPU tween math |
| **Total** | **~0.5ms** | Almost entirely from heat haze |

## Pixel Art Safety Checklist

- [x] `roundPixels: true` in game config (currently missing — this AR adds it)
- [x] Camera scroll positions snapped to integers via `Math.round()`
- [x] Mouse parallax offset snapped to integers
- [x] Parallax sway amplitudes are small integers (3-5px)
- [x] Heat haze strength capped at 0.008 (prevents pixel-edge shattering)
- [x] Micro-animation amplitudes are tiny (0.5px shiver, 1% scale pulse)

## Design Decisions

- **Sway BEFORE scroll factors:** The camera sway tween drives the parallax automatically via scroll factors. No need to independently animate each layer.
- **Mouse parallax via follow offset:** Adding to `cam.followOffset` stacks cleanly with the sway tween which operates on `scrollX/Y`. They don't fight each other.
- **Custom haze shader over built-in Displacement:** The built-in applies uniformly. A custom shader with `smoothstep` mask localizes the effect to the bottom portion, keeping enemy and UI clean.
- **Micro-animations on separate properties:** Each reaction animates a property not used by the idle bob (alpha, scaleX, container.x), preventing tween conflicts. This is fragile — if future animations also use these properties, they'll need to be merged.
- **roundPixels: true as a project-wide fix:** This was missing from the game config. Adding it here is correct — it ensures ALL sprite positions are rounded to integers during rendering, not just our camera positions. This fixes potential pixel shimmer across the entire game, not just this feature.
