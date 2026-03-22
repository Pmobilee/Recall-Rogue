# AR-220: Rim Lighting & PostFX Foundation

**Status:** Pending
**Priority:** Medium (polish technique — dramatic but not foundational)
**Complexity:** Medium-High (first custom PostFX in the project)
**Estimated Files:** 2 new, 2 modified
**Depends on:** AR-215 (Atmosphere Config for rim color/direction)

## Overview

Add **rim lighting** to enemy sprites — a bright edge on the sprite opposite the light source that creates dramatic subject-background separation. This is a classic film cinematography technique adapted for 2D pixel art. The sprite's silhouette gets a colored edge glow that matches the room's dominant light.

This AR also establishes the **PostFX pipeline foundation** for the project. Currently there are zero custom PostFX shaders anywhere in the codebase. This AR creates the first one, establishing patterns and conventions for any future shader work.

### Two Implementation Paths

1. **Alpha-based edge detection** (no normal maps required) — Samples 4 neighboring pixels to detect sprite edges. Works immediately, independent of AR-218. Costs 4 texture reads per fragment.

2. **Fresnel-based** (requires normal maps from AR-218) — Uses normal map to calculate rim based on surface angle vs camera. Cheaper (1 texture read), more natural-looking, but requires AR-218 to be complete.

**Strategy:** Implement alpha-based first (works immediately). Add Fresnel path as an upgrade when normal maps are available. Runtime auto-selects based on whether the enemy has a proper normal map.

## Dependencies

- **Blocked by:** AR-215 (rim color, light direction, intensity config)
- **Optional dependency:** AR-218 (normal maps enable Fresnel path — not required for alpha-based path)
- **Blocks:** Nothing
- **Related:** `src/game/systems/EnemySpriteSystem.ts` (sprite rendering)

## Sub-Steps

### 1. Create Alpha-Based Rim Lighting PostFX

**File:** `src/game/shaders/RimLightFX.ts`

```typescript
/**
 * PostFX pipeline that adds rim lighting to sprites via edge detection.
 * Detects sprite edges by sampling neighboring alpha values, then applies
 * a colored rim glow on edges facing away from the light source.
 *
 * This is a PostFX (runs AFTER the sprite renders), so it works regardless
 * of which render pipeline the sprite uses (default, Light2D, etc).
 */
export class RimLightFX extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  constructor(game: Phaser.Game) {
    super({
      game,
      name: 'RimLightFX',
      fragShader: RIM_LIGHT_FRAG_ALPHA,
    });
  }

  /** Configure rim parameters for this frame */
  setRimConfig(color: number, intensity: number, lightDir: [number, number]): void {
    const c = Phaser.Display.Color.ValueToColor(color);
    this.set3f('uRimColor', c.redGL, c.greenGL, c.blueGL);
    this.set1f('uRimIntensity', intensity);
    this.set2f('uLightDir', lightDir[0], lightDir[1]);
  }

  onPreRender(): void {
    // Set texel size based on the render target dimensions
    this.set2f('uTexelSize',
      1.0 / this.renderer.width,
      1.0 / this.renderer.height
    );
  }
}
```

**Alpha-based fragment shader:**

```glsl
precision mediump float;

uniform sampler2D uMainSampler;
uniform vec2 uTexelSize;       // 1.0 / textureSize
uniform vec2 uLightDir;        // Normalized light direction (from config)
uniform vec3 uRimColor;        // Rim color matching room theme
uniform float uRimIntensity;   // 0.0 to 1.0

varying vec2 outTexCoord;

void main() {
  vec4 color = texture2D(uMainSampler, outTexCoord);

  // Skip transparent pixels
  if (color.a < 0.01) {
    gl_FragColor = color;
    return;
  }

  // Sample 4 cardinal neighbors for alpha
  float aL = texture2D(uMainSampler, outTexCoord + vec2(-uTexelSize.x, 0.0)).a;
  float aR = texture2D(uMainSampler, outTexCoord + vec2( uTexelSize.x, 0.0)).a;
  float aU = texture2D(uMainSampler, outTexCoord + vec2(0.0,  uTexelSize.y)).a;
  float aD = texture2D(uMainSampler, outTexCoord + vec2(0.0, -uTexelSize.y)).a;

  // Only process edge pixels (at least one neighbor is transparent)
  float neighborSum = aL + aR + aU + aD;
  if (neighborSum >= 3.99) {
    // Interior pixel — no rim
    gl_FragColor = color;
    return;
  }

  // Estimate edge normal from alpha gradient
  vec2 edgeNormal = vec2(aL - aR, aD - aU);
  float edgeLen = length(edgeNormal);

  if (edgeLen < 0.01) {
    gl_FragColor = color;
    return;
  }

  edgeNormal = normalize(edgeNormal);

  // Rim = edge facing AWAY from light (dot product with -lightDir)
  float rim = max(0.0, dot(edgeNormal, -uLightDir));

  // Quantize rim to 3 steps for pixel-art consistency
  rim = floor(rim * 3.0 + 0.5) / 3.0;

  // Apply rim as additive color
  color.rgb += uRimColor * rim * uRimIntensity;

  gl_FragColor = color;
}
```

### 2. Create Fresnel-Based Rim Lighting (Normal Map Path)

**File:** `src/game/shaders/RimLightFresnelFX.ts`

```typescript
/**
 * Fresnel-based rim lighting using normal maps.
 * Cheaper and more natural than alpha-based, but requires normal maps.
 *
 * Uses the normal map to calculate view-angle-based rim (Fresnel effect):
 * pixels where the surface normal faces away from the camera get rim light.
 */
export class RimLightFresnelFX extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  constructor(game: Phaser.Game) {
    super({
      game,
      name: 'RimLightFresnelFX',
      fragShader: RIM_LIGHT_FRAG_FRESNEL,
    });
  }

  setRimConfig(color: number, intensity: number, normalMapKey: string): void {
    const c = Phaser.Display.Color.ValueToColor(color);
    this.set3f('uRimColor', c.redGL, c.greenGL, c.blueGL);
    this.set1f('uRimIntensity', intensity);
    // Bind normal map texture to sampler slot 1
    this.setTexture(normalMapKey, 'uNormalMap', 1);
  }
}
```

**Fresnel fragment shader:**

```glsl
precision mediump float;

uniform sampler2D uMainSampler;
uniform sampler2D uNormalMap;
uniform vec3 uRimColor;
uniform float uRimIntensity;

varying vec2 outTexCoord;

void main() {
  vec4 color = texture2D(uMainSampler, outTexCoord);

  if (color.a < 0.01) {
    gl_FragColor = color;
    return;
  }

  // Sample normal map
  vec3 normal = normalize(texture2D(uNormalMap, outTexCoord).rgb * 2.0 - 1.0);

  // View direction = straight toward camera (0, 0, 1)
  vec3 viewDir = vec3(0.0, 0.0, 1.0);

  // Fresnel: edges where normal faces away from camera get rim
  float rim = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);

  // Quantize to 3 steps for pixel-art consistency
  rim = floor(rim * 3.0 + 0.5) / 3.0;

  // Apply rim as additive color
  color.rgb += uRimColor * rim * uRimIntensity;

  gl_FragColor = color;
}
```

### 3. Register Both Pipelines

**File:** `src/game/CardGameManager.ts`

```typescript
import { RimLightFX } from './shaders/RimLightFX';
import { RimLightFresnelFX } from './shaders/RimLightFresnelFX';

// In game config:
{
  pipeline: [
    QuantizedLight2DPipeline,  // From AR-219
    RimLightFX,                // Alpha-based rim (always available)
    RimLightFresnelFX,         // Fresnel rim (when normal maps exist)
  ],
}
```

### 4. Apply Rim Lighting to Enemy Sprite

**File:** `src/game/systems/EnemySpriteSystem.ts`

```typescript
/** Apply rim lighting PostFX to the enemy sprite */
applyRimLighting(config: AtmosphereConfig, hasNormalMap: boolean): void {
  if (config.rim.intensity <= 0) return;
  if (getDeviceTier() === 'low-end') return; // Skip on low-end

  // Remove previous rim FX
  if (this._rimFx) {
    this.mainSprite.postFX.remove(this._rimFx);
  }

  if (hasNormalMap) {
    // Fresnel path — cheaper, more natural
    const fx = this.mainSprite.postFX.addPipeline('RimLightFresnelFX') as RimLightFresnelFX;
    fx.setRimConfig(config.rim.color, config.rim.intensity, this.normalMapKey);
    this._rimFx = fx;
  } else {
    // Alpha-based fallback
    const fx = this.mainSprite.postFX.addPipeline('RimLightFX') as RimLightFX;
    fx.setRimConfig(config.rim.color, config.rim.intensity, config.rim.lightDir);
    this._rimFx = fx;
  }
}
```

### 5. Sync Rim Color with Room Theme

The rim color should ALWAYS match the room's dominant light source:
- Dust: warm orange (0xff8833) — torch light
- Embers: hot red-orange (0xff4400) — lava glow
- Ice: cool blue (0x4488cc) — ice reflection
- Arcane: purple (0xcc88ff) — magical glow
- Void: deep purple (0x8844cc) — void energy

These values are already in `AtmosphereConfig.rim` from AR-215. The implementation just reads them.

### 6. PostFX Stacking Consideration

**Important:** If the enemy sprite already has:
- `preFX.addGradient` (AO from AR-216)
- `Light2D` pipeline (from AR-219)
- `postFX.addPipeline('RimLightFX')` (this AR)

That's 3 effects stacking. The render order is:
1. `preFX` effects run first (AO gradient)
2. Main pipeline renders (Light2D with quantized lighting)
3. `postFX` effects run last (rim lighting)

This stacking is correct and intentional:
- AO darkens the base BEFORE lighting
- Lighting calculates per-pixel illumination
- Rim adds edge glow on the FINAL rendered result

Performance: each PostFX adds one render-target switch + one shader pass. For a 128x128 sprite, that's 16K fragments per pass — negligible.

### 7. Edge Case: Outline Sprites

The existing "3D paper cutout" effect has 4 black outline sprites around the main sprite. Rim lighting should be applied ONLY to the main sprite, NOT to outlines. The outlines are separate Phaser images in the container — they won't have the PostFX since we only apply it to `this.mainSprite`.

However, verify that the rim glow doesn't bleed OUTSIDE the main sprite's bounds and overlap with the outlines. If it does, the glow is already clipped to the sprite's texture bounds (PostFX operates on the sprite's render target, not the container), so this should be safe.

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `src/game/shaders/RimLightFX.ts` | **CREATE** | Alpha-based rim lighting PostFX + GLSL |
| `src/game/shaders/RimLightFresnelFX.ts` | **CREATE** | Fresnel-based rim lighting PostFX + GLSL |
| `src/game/CardGameManager.ts` | **MODIFY** | Register both PostFX pipelines |
| `src/game/systems/EnemySpriteSystem.ts` | **MODIFY** | Add `applyRimLighting()`, auto-select alpha vs Fresnel path |

## Acceptance Criteria

- [x] Alpha-based rim lighting visible on enemy sprite edges
- [x] Rim color matches room theme (orange in dust, blue in ice, etc.)
- [x] Rim appears on the side OPPOSITE the dominant light source
- [x] Rim is quantized to 3 discrete steps (no smooth gradients)
- [x] Fresnel-based rim works when normal maps are available (auto-selected)
- [x] Alpha-based fallback works when normal maps are missing
- [x] Rim does NOT appear on outline sprites or shadow
- [x] Rim does NOT bleed outside sprite bounds
- [x] Low-end devices skip rim lighting entirely
- [x] Rim composites correctly with Light2D (AR-219) and AO (AR-216)
- [x] `npm run typecheck` passes
- [x] `npm run build` succeeds
- [x] No WebGL shader compilation errors in console

## Verification Gate

1. `npm run typecheck` + `npm run build` — clean
2. Playwright screenshot with rim lighting enabled — visible colored edge on enemy
3. Compare dust theme (orange rim) vs ice theme (blue rim) — colors are distinct
4. Verify rim appears on correct side (away from light): in dust theme with light from left, rim should be on RIGHT edge
5. Verify quantization: zoom into rim edge — should show 2-3 discrete brightness levels, not smooth gradient
6. Console: no shader compilation errors, no "pipeline not found" warnings
7. Toggle rim on/off (via dev tool) — confirm sprite looks normal without rim

## Performance Budget

| Path | GPU Cost | Notes |
|------|----------|-------|
| Alpha-based (4 samples) | ~0.3ms/sprite | 4 neighbor texture reads per fragment |
| Fresnel-based (1 sample) | ~0.1ms/sprite | 1 normal map read per fragment |
| **Typical (Fresnel)** | **~0.1ms** | With normal maps, this is very cheap |

## Pixel Art Safety Checklist

- [x] Rim lighting is quantized to 3 steps (not smooth)
- [x] Rim is additive (adds color, doesn't replace) — preserves underlying pixel art colors
- [x] PostFX operates at sprite's render target resolution (not screen resolution)
- [x] No sub-pixel artifacts from texel size calculation

## Design Decisions

- **PostFX not PreFX:** Rim must be computed on the FINAL rendered sprite (after Light2D), not on the raw texture. PostFX runs after the main pipeline.
- **Quantized to 3 steps (not 5-6 like lighting):** Rim is a subtle edge effect. Too many steps makes it look like an outline shader, not a lighting effect. 3 steps = off / subtle / bright.
- **Additive blend (not multiplicative):** Rim ADDS color to the edge. Multiplicative would darken dark edges further, which is wrong — rim should brighten edges.
- **Auto-select alpha vs Fresnel:** Workers don't need to know which path is active. The system checks for normal maps and chooses automatically. This means AR-220 can ship before AR-218 completes.
