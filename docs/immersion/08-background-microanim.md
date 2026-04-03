---
status: pending
delete-after-implementation: true
priority: ambitious
effort: L
impact: medium-high
owner-agent: game-logic
depends-on: none
---

# Procedural Background Micro-Animation

## What It Is

Three depth-map-driven animated effects added to the existing GLSL shader that make static AI-generated backgrounds feel alive: (1) torch flicker in bright/near regions, (2) subtle water ripple UV distortion in dark/far regions, and (3) slow fog drift across the scene. All three effects are gated by quality tier and toggled off for reduce-motion.

## Why It Matters

The existing `DepthLightingFX` shader already does impressive work — normals, SSAO, point lights, fog. But the background reads as definitively static. Players quickly habituate to static backgrounds; after the first few encounters, the environment disappears from conscious attention. These micro-animations are designed to stay below the threshold of active noticing while continuously feeding the peripheral nervous system with "something is alive here." The implementation is almost free in terms of engineering: the depth map is already loaded, `uTime` is already driven, and the shader infrastructure is already rendering per-pixel. Adding three effects is ~15 lines of GLSL and three new uniforms.

## Current State

- `src/game/shaders/DepthLightingFX.ts` — GLSL shader (lines 3-260). Already reads depth map texture, applies Sobel normals, directional and point lighting, SSAO, fog (depth-based smoothstep), and parallax breathing (sinusoidal UV displacement of entire image). Point lights already flicker via multi-frequency noise.
- `src/game/systems/DepthLightingSystem.ts` — Manages uniforms including `uTime` (driven by `scene.time.now`, line ~229). Exposes `setPointLight()`, `setAmbientLight()`, `setFogParams()`.
- `src/data/roomAtmosphere.ts` — `AtmosphereConfig` type configures per-biome parameters. The system reads this at encounter start.
- **Gap:** All background animation is global (parallax breathing displaces entire UV uniformly). No region-specific effects exist based on depth map value. No `uTorchFlickerIntensity`, `uWaterRippleStrength`, or `uFogDriftOpacity` uniforms exist.

## Implementation Spec

### Files to Modify

**`src/game/shaders/DepthLightingFX.ts`**

Add three uniform declarations and three effect blocks in the fragment shader. All additions occur after the existing depth-based fog calculation and before final `gl_FragColor` output.

**`src/game/systems/DepthLightingSystem.ts`**

- Declare and initialize the three new uniforms.
- Add `setMicroAnimConfig(config: MicroAnimConfig, qualityTier: QualityTier): void` — sets uniforms based on tier gating.
- Add `disableMicroAnim(): void` — sets all three uniforms to 0.0 (for reduce-motion).

**`src/data/roomAtmosphere.ts`**

- Add `MicroAnimConfig` interface.
- Add `microAnimation: MicroAnimConfig` field to `AtmosphereConfig`.
- Add per-biome values to the existing atmosphere config map.

### Files to Create

None. All changes are additions to existing files.

### Technical Details

**New uniform declarations (add to GLSL uniform block):**
```glsl
uniform float uTorchFlickerIntensity;  // 0.0 = off
uniform float uWaterRippleStrength;    // 0.0 = off
uniform float uFogDriftOpacity;        // 0.0 = off
```

**Effect 1 — Torch flicker (fragment shader, after depth sample, before lighting accumulation):**
```glsl
// Torch flicker: animate brightness in near/bright depth regions
if (uTorchFlickerIntensity > 0.0) {
  float nearMask = smoothstep(0.6, 0.8, depthValue);  // fade in above depth 0.7
  float flicker = sin(uTime * 3.0 + sin(uv.x * 4.0) * sin(uv.y * 3.7)) * uTorchFlickerIntensity;
  albedo.rgb *= 1.0 + flicker * nearMask;
}
```
- `depthValue` is the already-sampled depth map R channel.
- `smoothstep(0.6, 0.8, depthValue)` produces a soft mask — full effect at depth > 0.8, none below 0.6, blended between.
- The nested `sin(sin())` pattern is a cheap noise approximation with no texture read — spatially varies the flicker phase across the surface so it's not a uniform brightness pulse.
- At `uTorchFlickerIntensity = 0.08`, the brightness oscillates ±8% in the brightest background regions only.

**Effect 2 — Water/dark ripple (flagship only, applied to UV before texture sample):**
```glsl
// Water ripple: UV distortion in far/dark depth regions
if (uWaterRippleStrength > 0.0) {
  // Sample depth at unmodified UV first to compute mask
  float rawDepth = texture2D(uDepthMap, uv).r;
  float farMask = smoothstep(0.35, 0.15, rawDepth);  // fade in below depth 0.3
  uv += vec2(sin(uv.y * 20.0 + uTime * 1.5) * uWaterRippleStrength * farMask, 0.0);
  // albedo re-sampled below at modified UV
}
```
- This must be placed BEFORE `albedo = texture2D(uBackground, uv)` so the distorted UV is used for the final sample. Move the albedo sample to after this block.
- The Y-axis sine wave with temporal scroll creates a horizontal ripple wave moving upward.
- `uv.y * 20.0` — high frequency means small ripple waves, not exaggerated distortion.
- `farMask` confines effect to deep/far regions (pools, shadow areas, background recesses).
- At `uWaterRippleStrength = 0.002`, distortion is ~2 pixels at 1080p — subliminal.

**Effect 3 — Fog drift (after existing fog blend, additive):**
```glsl
// Fog drift: slow-scrolling noise overlay
if (uFogDriftOpacity > 0.0) {
  vec2 driftUV = uv * 3.0 + vec2(uTime * 0.05, uTime * 0.01);  // mostly horizontal drift
  float driftNoise = sin(driftUV.x) * sin(driftUV.y * 1.4) * 0.5 + 0.5;  // 0-1 range
  // Blend additively into existing fog color (uFogColor already defined)
  color.rgb = mix(color.rgb, uFogColor.rgb, driftNoise * uFogDriftOpacity);
}
```
- `uTime * 0.05` scrolls one full UV tile in `2π / 0.05 = ~125 seconds` — imperceptibly slow drift.
- The product of two sine waves at different frequencies produces a cellular-like noise pattern without texture reads.
- Additive blend into the already-rendered fog color means it can only push toward the fog color, never brighten beyond it — prevents bright flickering.
- At `uFogDriftOpacity = 0.06`, the fog density variation is ±6% — visible in peripheral vision, not distracting to focal attention.

**New TypeScript interface in `roomAtmosphere.ts`:**
```typescript
export interface MicroAnimConfig {
  torchFlickerIntensity: number;  // 0.0 = off, 0.08 = subtle
  waterRippleStrength: number;    // 0.0 = off, 0.002 = subliminal
  fogDriftOpacity: number;        // 0.0 = off, 0.06 = subtle
}
```

**Per-theme MicroAnimConfig values:**

| Theme | torchFlicker | waterRipple | fogDrift |
|---|---|---|---|
| dust (floors 1-3) | 0.08 | 0.000 | 0.04 |
| embers (floors 4-6) | 0.12 | 0.000 | 0.06 |
| ice (floors 7-9) | 0.04 | 0.002 | 0.03 |
| arcane (floors 10-12) | 0.06 | 0.001 | 0.08 |
| void (floors 13+) | 0.03 | 0.003 | 0.10 |

Rationale: embers gets highest torch flicker (fire caves); void gets highest fog + ripple (reality instability); ice gets visible water ripple (meltwater); arcane gets highest fog drift (magical atmosphere).

**`setMicroAnimConfig` implementation in `DepthLightingSystem.ts`:**
```typescript
setMicroAnimConfig(config: MicroAnimConfig, tier: QualityTier): void {
  const pipeline = this.pipeline;  // reference to PostFXPipeline
  const isLow = tier === 'low';
  const isMid = tier === 'mid';
  const isFlagship = tier === 'flagship';

  pipeline.set1f('uTorchFlickerIntensity',
    (isMid || isFlagship) ? config.torchFlickerIntensity : 0.0);
  pipeline.set1f('uWaterRippleStrength',
    isFlagship ? config.waterRippleStrength : 0.0);
  pipeline.set1f('uFogDriftOpacity',
    (isMid || isFlagship) ? config.fogDriftOpacity : 0.0);
}

disableMicroAnim(): void {
  this.pipeline.set1f('uTorchFlickerIntensity', 0.0);
  this.pipeline.set1f('uWaterRippleStrength', 0.0);
  this.pipeline.set1f('uFogDriftOpacity', 0.0);
}
```

### Integration Points

- `CombatScene.create()` or wherever atmosphere is configured: after calling existing atmosphere setup, call `depthLightingSystem.setMicroAnimConfig(atmosphereConfig.microAnimation, deviceTier)`.
- Reduce-motion check (same location as other reduce-motion guards): call `depthLightingSystem.disableMicroAnim()` instead.
- No per-frame call needed — `uTime` is already updated every frame by existing `DepthLightingSystem.update()`. The shader reads `uTime` automatically.
- No new texture bindings — depth map is already bound as `uDepthMap`. All three effects read from already-bound textures or compute analytically.

### Reduce-Motion Handling

Call `depthLightingSystem.disableMicroAnim()` when `prefersReducedMotion()` is true. This sets all three uniforms to 0.0, which the shader checks before executing any effect block (`if (uX > 0.0)`). Zero overhead when disabled — the branch is trivially predicted by GPU.

The existing parallax breathing (sinusoidal UV displacement) is a separate uniform (`uParallaxStrength` or similar) already managed by the existing reduce-motion path — this spec does not change that behavior.

### Device Tier Handling

| Tier | Torch Flicker | Water Ripple | Fog Drift |
|---|---|---|---|
| Low | Off | Off | Off |
| Mid | On | Off | On |
| Flagship | On | On | On |

Performance estimate: The three effects add approximately 3-5 `sin()` calls per fragment. At 1920×1080, that is ~6M sin() calls per frame. Modern GPUs execute transcendental functions in 1-4 cycles via hardware approximation. At 60fps this adds <0.5ms GPU time — negligible on any hardware capable of running the existing PostFX pipeline (which already does Sobel, SSAO, and multi-octave noise).

## Verification

1. Load each of the 5 biome themes and observe for 30 seconds each:
   - Torch flicker: visibly animated brightness variation in light-source areas of background, not a uniform pulse.
   - Water ripple (flagship only): barely perceptible horizontal wave motion in darkest background regions.
   - Fog drift: slow lateral movement of fog density variation.
2. Verify effects respect depth map — torch flicker only in high-depth (bright/near) regions, ripple only in low-depth (dark/far) regions.
3. Measure framerate before and after — target: no measurable drop at mid or flagship tier (GPU-bound test).
4. Reduce-motion: all three effects off, existing parallax breathing also unaffected by this change.
5. Low-tier device: all three uniforms confirm 0.0 in WebGL debug.
6. Confirm biome-specific intensities match config table — embers should have noticeably more active flicker than void.

## Effort Estimate

**L (Large) — 3-5 days**
- Day 1: Add GLSL effect blocks to shader; add three uniforms to `DepthLightingSystem`; verify shader compiles.
- Day 2: Add `MicroAnimConfig` to `roomAtmosphere.ts`; add per-biome values; wire `setMicroAnimConfig` call in `CombatScene`.
- Day 3: Tune intensities per biome via visual inspection on actual backgrounds.
- Day 4: Validate water ripple UV math doesn't cause visible seam or artifact at UV edges.
- Day 5: Test reduce-motion, device tier gating, framerate measurement.
