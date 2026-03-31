---
name: light-mapping
description: Map light sources to combat backgrounds for the depth-based lighting system. Analyze background images, identify light sources, and add entries to the light source manifest.
user-invocable: true
---

# Light Source Mapping Skill

Map point light sources to combat background images for the DepthLightingFX shader system.

## When to Use
- Adding lighting to a new enemy background
- Updating light positions for an existing background
- Batch-mapping multiple backgrounds

## Key Files
- `src/data/lightSourceManifest.ts` — manifest data (light positions, colors, types)
- `src/data/lightSourceResolver.ts` — resolves manifest entry or fallback
- `src/game/shaders/DepthLightingFX.ts` — the WebGL PostFX shader
- `src/game/systems/DepthLightingSystem.ts` — orchestrator that drives the shader

## How the System Works

### Architecture
1. Background Image is a Phaser GameObjects.Image at depth 0 with DepthLightingFX PostFX
2. Depth map (grayscale WebP) is loaded alongside and bound to texture unit 1
3. For rooms WITH manifest point lights: image passes through at 100% original brightness, point lights add colored glow on top (no dimming, no normals, no fog, no SSAO)
4. For rooms WITHOUT manifest lights: depth-based normals + directional light + fog + SSAO applied for subtle 3D effect, plus a synthetic overhead light

### Point Light Behavior
- Lights are **purely additive** — they brighten areas without darkening anything
- The additive strength multiplier is 0.25 (in the GLSL combine step)
- Light positions are in **image space** (0-1 across the original image), NOT viewport space
- The shader handles cover-crop UV remapping via `uCropScale`/`uCropOffset` uniforms
- Flicker animation runs in TypeScript (multi-frequency sin noise), pushed to uniforms per frame

### Critical Technical Details
- **Array uniforms**: Phaser's `set3f('name[i]')` silently fails for i > 0. Must use raw `gl.uniform3fv()` via `gl.getParameter(gl.CURRENT_PROGRAM)` in `onDraw()`
- **Cover-crop offset**: Background is cover-scaled (may be wider than viewport). Shader converts FBO UVs to image UVs for depth map sampling. Light positions stay in image space.
- **Depth attenuation**: Very gentle — `1.0 - smoothstep(0.0, 0.5, depthDiff) * 0.4`. Harsh depth cutoffs create ugly edges along depth map silhouettes.

## Step-by-Step: Mapping a New Background

### 1. View the background image
```
Read the background image file:
/public/assets/backgrounds/combat/enemies/{enemyId}/landscape.webp
```

### 2. Identify ALL light sources
Look for these types of emitters:
| Type | Visual Signature | Typical Color |
|------|-----------------|---------------|
| `torch` | Bright orange spot on wall with radial halo | 0xff8833 |
| `campfire` | Large warm glow at ground level | 0xffaa44 |
| `lantern` | Bright warm spot suspended from ceiling | 0xffcc66 |
| `crystal` | Colored emission with surrounding glow | 0xdd44ff / 0x44ccff |
| `bioluminescent` | Distinct colored glow (jellyfish, orbs) | varies |
| `magical` | High-contrast bright region | 0x44ff88 / 0xffffff |
| `lava` | Warm underglow from cracks/embers | 0xff4400 |
| `ambient` | Diffuse overhead light | 0xffddaa |
| `portal` | Intense magical doorway/rift | 0x4488ff |
| `candle` | Small flame, fast flicker | 0xff9944 |

### 3. Map positions as image-space fractions
- x: 0.0 = left edge, 1.0 = right edge of the ORIGINAL IMAGE (not viewport)
- y: 0.0 = top edge, 1.0 = bottom edge
- z: depth at the light's position (0.0 = far wall, 1.0 = near camera). Check the depth map if unsure.

### 4. Set radius and intensity
- **Radius**: fraction of image diagonal. 0.15-0.30 is typical for a wide glow. Err on the side of LARGER — small radii create harsh spotlights.
- **Intensity**: 1.0-1.5 is subtle, 2.0+ is strong. With the 0.25 additive multiplier, final contribution = intensity * 0.25 at the center.
- **Group nearby sources**: MAX_LIGHTS is 8. Combine clusters (e.g., 6 ceiling jellyfish → 2 grouped lights).

### 5. Add to manifest
Add entry to `LIGHT_SOURCE_MANIFEST.enemies` in `src/data/lightSourceManifest.ts`:
```typescript
enemy_id: {
  portrait: { lights: [] },  // Portrait can be empty initially
  landscape: {
    lights: [
      { x: 0.50, y: 0.20, z: 0.3, radius: 0.25, color: 0xffcc66, intensity: 1.3, type: 'lantern' },
      // ... more lights
    ],
    // ambientOverride is OPTIONAL. Omit it to use defaults.
    // Only set if you want to override the theme's ambient level.
  },
},
```

### 6. Test with dev button
The hub has dev buttons:
- **Lighting**: loads a random manifest enemy
- **BrightIdea**: loads bright_idea specifically

To test a specific enemy, use browser console:
```javascript
__rrScenario.loadCustom({ screen: 'combat', enemy: 'enemy_id' })
```

### 7. Add a dedicated test button (optional)
In `src/ui/components/HubScreen.svelte`, add a button like:
```typescript
async function testMyEnemy(): Promise<void> {
  const scenario = (globalThis as any).__rrScenario
  if (!scenario) return
  await scenario.loadCustom({ screen: 'combat', enemy: 'enemy_id' })
}
```

## Common Mistakes (from this session)

1. **DON'T dim the base image** for rooms with point lights. The user wants original brightness + additive glow, not "dark room with bright spots."

2. **DON'T use small radii** (< 0.15). They create harsh spotlights. Use 0.20-0.30 for soft, natural glow pools.

3. **DON'T set ambientOverride too low**. For rooms with point lights, either omit it (uses default which passes through at ~100%) or set it to 0.40+.

4. **DON'T forget cover-crop**: light positions at x > 0.85 or x < 0.15 may be partially off-screen at some viewport aspect ratios. The light's radius should be large enough to bleed into the visible area.

5. **DO group nearby light sources**: 6 individual jellyfish → 2 grouped light pools. MAX_LIGHTS is 8.

6. **DO use the depth map** to estimate z values: bright (white) = near camera, dark (black) = far wall.

## Example: Bright Idea (reference mapping)

The canonical example with 8 lights covering crystals, jellyfish, desk orbs:
```typescript
bright_idea: {
  portrait: { lights: [] },
  landscape: {
    lights: [
      { x: 0.07, y: 0.30, z: 0.7, radius: 0.28, color: 0xdd44ff, intensity: 1.4, type: 'crystal' },
      { x: 0.16, y: 0.42, z: 0.6, radius: 0.22, color: 0x44ccff, intensity: 1.2, type: 'crystal' },
      { x: 0.23, y: 0.60, z: 0.7, radius: 0.18, color: 0x44ffaa, intensity: 1.0, type: 'bioluminescent' },
      { x: 0.32, y: 0.06, z: 0.3, radius: 0.28, color: 0xff9944, intensity: 1.4, type: 'bioluminescent' },
      { x: 0.55, y: 0.06, z: 0.3, radius: 0.28, color: 0x44ddff, intensity: 1.3, type: 'bioluminescent' },
      { x: 0.36, y: 0.22, z: 0.4, radius: 0.16, color: 0xaa55ee, intensity: 1.0, type: 'crystal' },
      { x: 0.82, y: 0.16, z: 0.5, radius: 0.26, color: 0xff8844, intensity: 1.4, type: 'bioluminescent' },
      { x: 0.78, y: 0.48, z: 0.5, radius: 0.24, color: 0x44aacc, intensity: 1.3, type: 'bioluminescent' },
    ],
    ambientOverride: 0.45,
  },
},
```
