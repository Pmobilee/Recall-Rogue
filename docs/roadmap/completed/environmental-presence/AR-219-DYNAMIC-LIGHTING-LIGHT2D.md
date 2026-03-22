# AR-219: Dynamic Lighting via Light2D Pipeline

**Status:** Pending
**Priority:** High (single most transformative visual technique)
**Complexity:** High
**Estimated Files:** 3 modified, 1 new (custom quantized lighting shader)
**Depends on:** AR-215 (Atmosphere Config), AR-218 (Normal Maps)

## Overview

Enable Phaser's built-in Light2D pipeline for enemy sprites with normal maps, creating per-pixel directional lighting that makes every room feel distinct. A torchlit cave casts warm side-light on crevices; an ice cavern bathes the enemy in cold overhead blue; an arcane library pulses with ethereal purple. This is the **Dead Cells technique** — the single biggest visual upgrade in the entire environmental presence series.

### The Dead Cells Reference

Motion Twin's developers stated: *"Thanks to the normal maps, a torch on the left of a statue will light up the statue from the correct direction while respecting its base colors."* Phaser 3.60+ ships with the Light2D pipeline that replicates this exact approach. Our sprites are 64-128px — the fragment count is tiny, making this comfortable even on integrated GPUs.

### The Critical Problem: Quantized Lighting

Standard Light2D produces **smooth diffuse gradients** that clash violently with pixel art's discrete color steps. The research doc identifies this as the #1 failure mode. The fix is a **stepped/posterized lighting shader** that quantizes the diffuse calculation to 4-6 bands, producing a "toon shading" look that blends dynamic lighting with pixel art. This requires a custom shader to override Phaser's default Light2D fragment shader.

## Dependencies

- **Blocked by:** AR-215 (lighting config: ambient color, light positions, intensities), AR-218 (normal maps)
- **Blocks:** Nothing (AR-220 rim lighting is independent, though benefits from this)
- **Related:** `src/game/systems/EnemySpriteSystem.ts` (sprite rendering), `src/data/roomAtmosphere.ts` (light presets)

## Sub-Steps

### 1. Create Custom Quantized Light2D Shader

**File:** `src/game/shaders/QuantizedLight2D.ts`

Override the default Light2D fragment shader to add stepped lighting:

```typescript
/**
 * Custom Light2D pipeline that quantizes lighting to discrete steps.
 * Preserves pixel art aesthetic while enabling per-pixel normal-mapped lighting.
 *
 * Based on Phaser's built-in Light2D but adds:
 * - Stepped/posterized diffuse calculation (configurable 4-6 bands)
 * - Per-light flicker support via uniform
 * - Compatible with Phaser's light management system
 */
export class QuantizedLight2DPipeline extends Phaser.Renderer.WebGL.Pipelines.LightPipeline {
  constructor(game: Phaser.Game) {
    super({
      game,
      name: 'QuantizedLight2D',
      fragShader: QUANTIZED_LIGHT_FRAG,
      // Inherit all Light2D pipeline configuration
    });
  }

  onRender(scene: Phaser.Scene, camera: Phaser.Cameras.Scene2D.Camera): void {
    // Set quantization uniforms
    this.set1f('uSteps', 5.0); // 5 discrete lighting bands
    this.set1f('uMinBrightness', 0.15); // Minimum brightness floor (never fully black)
    super.onRender(scene, camera);
  }
}
```

**Fragment shader (GLSL):**

```glsl
// Based on Phaser's Light2D fragment shader with quantization added
precision mediump float;

uniform sampler2D uMainSampler;    // Diffuse texture
uniform sampler2D uNormSampler;    // Normal map
uniform vec2 uResolution;
uniform vec3 uAmbientLightColor;
uniform float uSteps;              // Number of quantization bands (4-6)
uniform float uMinBrightness;      // Floor brightness (0.1-0.2)

// Phaser provides up to 10 lights via uniforms
// (Using Phaser's built-in light uniform structure)

struct Light {
  vec3 position;
  vec3 color;
  float intensity;
  float radius;
};

// Phaser sets these automatically
uniform int uLightCount;
uniform Light uLights[MAX_LIGHTS]; // MAX_LIGHTS = 10 (compile-time)

varying vec2 outTexCoord;
varying vec4 outTint;

void main() {
  vec4 diffuse = texture2D(uMainSampler, outTexCoord);
  if (diffuse.a < 0.01) {
    gl_FragColor = diffuse;
    return;
  }

  // Sample and decode normal map
  vec3 normal = normalize(texture2D(uNormSampler, outTexCoord).rgb * 2.0 - 1.0);

  // Start with ambient light
  vec3 totalLight = uAmbientLightColor;

  // Accumulate contribution from each light
  for (int i = 0; i < MAX_LIGHTS; i++) {
    if (i >= uLightCount) break;

    vec3 lightPos = uLights[i].position;
    vec3 lightColor = uLights[i].color;
    float intensity = uLights[i].intensity;
    float radius = uLights[i].radius;

    // Calculate light direction and distance
    vec3 fragPos = vec3(outTexCoord * uResolution, 0.0);
    vec3 lightDir = normalize(lightPos - fragPos);
    float dist = length(lightPos.xy - fragPos.xy);

    // Attenuation (quadratic falloff with radius)
    float atten = clamp(1.0 - (dist / radius), 0.0, 1.0);
    atten *= atten; // Quadratic falloff

    // Diffuse calculation
    float NdotL = max(dot(normal, lightDir), 0.0);

    // === QUANTIZATION: The pixel-art-safe step ===
    // Floor the diffuse to discrete bands
    NdotL = floor(NdotL * uSteps + 0.5) / uSteps;

    totalLight += lightColor * intensity * NdotL * atten;
  }

  // Apply minimum brightness floor
  totalLight = max(totalLight, vec3(uMinBrightness));

  // Apply lighting to diffuse color, respecting vertex tint
  vec4 tintedDiffuse = diffuse * outTint;
  gl_FragColor = vec4(tintedDiffuse.rgb * totalLight, diffuse.a);
}
```

**Important notes on the shader:**
- The `floor(NdotL * uSteps + 0.5) / uSteps` line is the core quantization — without it, lighting looks smooth and wrong on pixel art
- `uMinBrightness` prevents sprites from going fully black in dark corners
- The shader respects Phaser's `outTint` (vertex tint from `setTint()`) so AR-216's color grading still works
- `MAX_LIGHTS` is a compile-time constant (default 10 in Phaser)

### 2. Register Pipeline in Game Config

**File:** `src/game/CardGameManager.ts`

```typescript
import { QuantizedLight2DPipeline } from './shaders/QuantizedLight2D';

// In Phaser.Game config:
{
  render: {
    pixelArt: true,
    antialias: false,
    preserveDrawingBuffer: true,
  },
  pipeline: [QuantizedLight2DPipeline],  // <-- Register custom pipeline
}
```

### 3. Enable Lighting System in CombatScene

**File:** `src/game/scenes/CombatScene.ts`

```typescript
private setupLighting(config: AtmosphereConfig): void {
  // Enable the lights system
  this.lights.enable();
  this.lights.setAmbientColor(config.lighting.ambientColor);

  // Create point lights from config
  this._activeLights = [];
  for (const lightDef of config.lighting.lights) {
    const x = lightDef.xPct * this.scale.width;
    const y = lightDef.yPct * this.scale.height;

    const light = this.lights.addLight(x, y, lightDef.radius);
    light.setColor(lightDef.color);
    light.setIntensity(lightDef.intensity);

    this._activeLights.push({ light, def: lightDef });

    // Optional flicker animation
    if (lightDef.flicker && lightDef.flicker > 0) {
      this.tweens.add({
        targets: { intensity: lightDef.intensity },
        intensity: {
          from: lightDef.intensity * (1 - lightDef.flicker),
          to: lightDef.intensity * (1 + lightDef.flicker),
        },
        duration: 200 + Math.random() * 300, // Random-ish flicker speed
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        onUpdate: (tween, target) => {
          light.setIntensity(target.intensity);
        },
      });
    }
  }
}
```

### 4. Apply Pipeline to Enemy Sprite

**File:** `src/game/systems/EnemySpriteSystem.ts`

```typescript
/** Enable Light2D-compatible rendering on the enemy sprite */
enableLighting(): void {
  // Only apply to main sprite — shadow and outlines should NOT be lit
  this.mainSprite.setPipeline('QuantizedLight2D');
}
```

**Critical:** Only the MAIN sprite gets the Light2D pipeline. The shadow sprite, outline sprites, and any overlay effects must NOT be on Light2D — they should remain on the default pipeline.

### 5. Handle the Light2D Rotation Bug (Phaser #3870)

Phaser's Light2D has a known bug where normal vectors don't rotate with sprites. Since our enemy sprites don't rotate during normal gameplay (attacks use translation, not rotation), this is acceptable. But document the constraint:

```typescript
// WARNING: Do not use sprite.setRotation() with Light2D pipeline.
// Normal vectors will not rotate, causing incorrect lighting.
// Use translation-based animations only (tween x, y, scale — NOT angle).
```

If future animations need rotation (e.g., death spiral), temporarily switch the sprite off Light2D during the rotation animation:

```typescript
playDeathRotation(): void {
  this.mainSprite.resetPipeline(); // Back to default during rotation
  this.scene.tweens.add({
    targets: this.mainSprite,
    angle: 360,
    // ...
  });
}
```

### 6. Device Tier Gating

```typescript
private setupLighting(config: AtmosphereConfig): void {
  const tier = getDeviceTier();

  if (tier === 'low-end') {
    // Skip Light2D entirely — too expensive for integrated mobile GPUs
    // Sprites still get tinting from AR-216
    return;
  }

  // Mid tier: reduce to max 3 lights
  const maxLights = tier === 'mid' ? 3 : config.lighting.lights.length;
  const lightsToUse = config.lighting.lights.slice(0, maxLights);

  this.lights.enable();
  this.lights.setAmbientColor(config.lighting.ambientColor);
  // ... create lights from lightsToUse
}
```

### 7. Transition Between Lighting Configs

When floor theme changes (e.g., floor 3 dust -> floor 4 embers):

```typescript
private transitionLighting(
  oldConfig: AtmosphereConfig,
  newConfig: AtmosphereConfig,
  duration: number = 1000
): void {
  // Tween ambient color
  const oldAmbient = Phaser.Display.Color.ValueToColor(oldConfig.lighting.ambientColor);
  const newAmbient = Phaser.Display.Color.ValueToColor(newConfig.lighting.ambientColor);

  this.tweens.addCounter({
    from: 0, to: 100, duration, ease: 'Sine.easeInOut',
    onUpdate: (tween) => {
      const t = tween.getValue() / 100;
      const color = Phaser.Display.Color.Interpolate.ColorWithColor(
        oldAmbient, newAmbient, 100, t * 100
      );
      this.lights.setAmbientColor(
        Phaser.Display.Color.GetColor(color.r, color.g, color.b)
      );
    },
  });

  // Tween individual light intensities to 0, then reposition, then tween back up
  for (const { light } of this._activeLights) {
    this.tweens.add({
      targets: light,
      intensity: 0,
      duration: duration / 2,
      ease: 'Sine.easeIn',
      onComplete: () => {
        // Reposition and recolor for new theme
        // Then tween back up
      },
    });
  }
}
```

### 8. Integrate with Existing Systems

Ensure the lighting system works alongside:
- **setTint (AR-216):** The shader's `outTint` varying preserves vertex tint. Lighting is multiplicative ON TOP of tint.
- **AO gradient (AR-216):** `preFX.addGradient` runs AFTER the Light2D pipeline. AO darkens the already-lit result. This is correct behavior.
- **Atmosphere particles (AR-217):** Particles are NOT on Light2D — they use default pipeline with their own tints. This is intentional; atmospheric particles shouldn't cast/receive directional light.

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `src/game/shaders/QuantizedLight2D.ts` | **CREATE** | Custom quantized Light2D pipeline + GLSL shader |
| `src/game/CardGameManager.ts` | **MODIFY** | Register QuantizedLight2D pipeline in game config |
| `src/game/scenes/CombatScene.ts` | **MODIFY** | Add `setupLighting()`, light creation, flicker tweens, transitions |
| `src/game/systems/EnemySpriteSystem.ts` | **MODIFY** | Add `enableLighting()` to apply pipeline to main sprite |

## Acceptance Criteria

- [x] QuantizedLight2D pipeline registered and functional
- [x] Enemy sprites on Light2D show directional lighting from normal maps
- [x] Lighting is visibly **stepped/quantized** (4-6 bands, not smooth gradients)
- [x] Each floor theme has distinct lighting character:
  - Dust (1-3): Warm orange side-lights, flickering
  - Embers (4-6): Hot red/orange from below, strong flicker
  - Ice (7-9): Cool blue overhead light, minimal flicker
  - Arcane (10-12): Purple glow from above + two side fills
  - Void (13+): Deep purple, single intense center light
- [x] Light flicker animation works (torch rooms have visible intensity variation)
- [x] Shadow and outline sprites are NOT affected by lighting (default pipeline)
- [x] setTint from AR-216 still works (composites correctly with lighting)
- [x] AO gradient from AR-216 still works (applied after lighting)
- [x] Lighting transitions smoothly when floor theme changes
- [x] Low-end devices skip Light2D entirely (no visual artifacts)
- [x] Mid-tier devices limited to 3 lights
- [x] No sprite disappearance (flat fallback normal map catches missing normals)
- [x] `npm run typecheck` passes
- [x] `npm run build` succeeds

## Verification Gate

1. `npm run typecheck` + `npm run build` — clean
2. Playwright screenshots at all 5 themes — verify distinct lighting character
3. Close-up screenshot of enemy sprite — confirm stepped lighting bands visible
4. Compare with/without Light2D — dramatic improvement visible
5. Verify flicker: take 2 screenshots 200ms apart in dust/embers theme — intensity varies
6. Verify no sprite disappearance: test with enemy that has normal map AND one using flat fallback
7. Console: no WebGL errors, no shader compilation failures
8. FPS: `window.__terraDebug()` should show < 1ms added GPU time

## Performance Budget

| Component | GPU Cost | Notes |
|-----------|----------|-------|
| Light2D with 2 lights | ~0.5ms | Fragment shader on 128x128 sprite |
| Light2D with 5 lights | ~1.0ms | More light calculations per fragment |
| Flicker tweens (CPU) | ~0.01ms | Negligible tween math |
| **Total (typical)** | **~0.7ms** | 2-3 lights most common |

## Pixel Art Safety Checklist

- [x] Lighting is quantized to 4-6 discrete bands (no smooth gradients)
- [x] Minimum brightness floor prevents full blackout
- [x] Normal maps use bilinear filtering (set in AR-218)
- [x] Diffuse textures remain nearest-neighbor
- [x] No sprite rotation while on Light2D pipeline (avoids #3870 bug)
- [x] Vertex tint (from setTint) composites correctly

## Known Limitations

1. **Point lights only** — Phaser Light2D has no directional light support. Room lighting is faked with positioned point lights.
2. **Rotation bug (#3870)** — Normal vectors don't rotate. Death animations must temporarily drop to default pipeline.
3. **Max 10 lights** — Compile-time limit in Phaser's shader. Our configs use 2-3, well within limit.
4. **No specular** — Light2D is diffuse-only. Specular highlights would require a fully custom pipeline. Not needed for pixel art.
