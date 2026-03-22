# AR-218: Normal Map Generation Pipeline

**Status:** Pending
**Priority:** Medium (prerequisite for AR-219 and AR-220 Fresnel variant)
**Complexity:** High (pipeline work + batch processing 89 enemies)
**Estimated Files:** 2 new scripts, 1 modified, ~89 new asset files
**Depends on:** Nothing (independent pipeline work)

## Overview

Establish an automated pipeline to generate normal maps for all 89 enemy sprites. Normal maps encode surface direction per pixel (RGB = XYZ normal vector), enabling per-pixel lighting response on flat 2D sprites. Without normal maps, dynamic lighting (AR-219) is just flat distance-based dimming. With them, a bat wing catches light differently than its body, and a stone golem's crevices create real shadow depth.

This AR covers: tool selection, batch generation, quality validation, deployment pipeline integration, flat fallback for missing sprites, and Phaser texture loading changes.

### Why This Matters

Normal maps are the **prerequisite** for:
- AR-219 (Dynamic Lighting via Light2D) — Light2D with normal maps = per-pixel directional lighting. Without = flat, unconvincing.
- AR-220 (Rim Lighting) — Fresnel-based rim lighting (1 texture read) is cheaper and more natural than alpha-based (4 reads), but requires normal maps.

Without this AR, AR-219 and AR-220 still work but are significantly less impressive.

## Dependencies

- **Blocked by:** Nothing
- **Blocks:** AR-219 (Light2D needs normal maps), AR-220 (Fresnel rim variant needs normal maps)
- **Related:** `scripts/deploy-enemy-sprites.mjs` (existing sprite deploy pipeline)

## Tool Selection Analysis

### Option A: Laigter (Recommended)

- **Cost:** Free, open-source (itch.io)
- **Platform:** Windows, Linux (no macOS — but we can run via Wine or Docker, or use the CLI batch mode)
- **Capabilities:** Auto-generates normal, specular, parallax, and AO maps from 2D sprites
- **Quality:** Good for simple enemy silhouettes (our 64-128px sprites). Tends toward "pillow shading" on complex sprites.
- **Batch mode:** CLI: `laigter --normal -i input.png -o output_n.png`
- **Verdict:** Best for our needs. Free, batch-capable, good enough quality for 64-128px pixel art.

### Option B: SpriteIlluminator ($40, CodeAndWeb)

- **Cost:** $40 one-time
- **Platform:** macOS, Windows, Linux
- **Capabilities:** Best auto-generation with painting tools for manual refinement
- **Quality:** Higher than Laigter, with manual touch-up option
- **Batch mode:** Limited — GUI-focused
- **Verdict:** Better quality, but cost + manual workflow makes it secondary choice

### Option C: Custom Python Script (Sobel-based)

- **Cost:** Free
- **Capabilities:** Generates basic normal maps from luminance gradients using Sobel filter
- **Quality:** Lowest — works for simple shapes, poor for complex sprites
- **Batch mode:** Fully scriptable
- **Verdict:** Fallback if Laigter unavailable. Good enough for 64px sprites.

### Recommendation

**Primary:** Laigter CLI batch mode
**Fallback:** Custom Python Sobel script (included in this AR as backup)
**Manual touch-up:** Only for boss sprites (13 enemies) — highest visual impact

## Sub-Steps

### 1. Create Python Fallback Normal Map Generator

**File:** `scripts/generate-normal-maps.py`

A Sobel-filter-based normal map generator that works on any machine without external tools:

```python
#!/usr/bin/env python3
"""
Generate normal maps from 2D sprite images using Sobel edge detection.
Produces OpenGL-format normal maps (R=X, G=Y, B=Z) suitable for Phaser Light2D.

Usage:
  python3 scripts/generate-normal-maps.py                    # All enemies
  python3 scripts/generate-normal-maps.py --enemy cave_bat   # Single enemy
  python3 scripts/generate-normal-maps.py --quality high      # Higher blur radius
"""

import argparse
import os
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

SPRITE_DIR = Path("public/assets/sprites/enemies")
OUTPUT_DIR = Path("public/assets/sprites/enemies")  # Normal maps live alongside sprites

QUALITY_PRESETS = {
    "low": {"blur_radius": 1, "strength": 1.0},     # Fast, basic
    "medium": {"blur_radius": 2, "strength": 1.5},   # Good balance
    "high": {"blur_radius": 3, "strength": 2.0},     # Best quality, slower
}


def generate_normal_map(
    input_path: Path,
    output_path: Path,
    blur_radius: int = 2,
    strength: float = 1.5,
) -> bool:
    """Generate a normal map from a sprite image using Sobel gradients."""
    img = Image.open(input_path).convert("RGBA")

    # Extract luminance from RGB (ignore alpha for gradient calculation)
    r, g, b, a = img.split()
    gray = img.convert("L")

    # Apply slight blur to reduce pixel-art noise before gradient calc
    if blur_radius > 0:
        gray = gray.filter(ImageFilter.GaussianBlur(radius=blur_radius))

    # Convert to numpy for Sobel
    gray_np = np.array(gray, dtype=np.float64) / 255.0

    # Sobel gradients (horizontal and vertical)
    # Using numpy roll for simplicity — equivalent to Sobel kernel
    dx = np.roll(gray_np, -1, axis=1) - np.roll(gray_np, 1, axis=1)
    dy = np.roll(gray_np, -1, axis=0) - np.roll(gray_np, 1, axis=0)

    # Scale gradients by strength
    dx *= strength
    dy *= strength

    # Compute normal vector components
    # OpenGL format: R = X (right), G = Y (up), B = Z (toward viewer)
    nx = -dx
    ny = dy  # Flip Y for OpenGL convention (up = positive)
    nz = np.ones_like(nx)

    # Normalize
    length = np.sqrt(nx**2 + ny**2 + nz**2)
    length = np.maximum(length, 1e-6)
    nx /= length
    ny /= length
    nz /= length

    # Map from [-1, 1] to [0, 255]
    r_out = ((nx + 1) * 0.5 * 255).astype(np.uint8)
    g_out = ((ny + 1) * 0.5 * 255).astype(np.uint8)
    b_out = ((nz + 1) * 0.5 * 255).astype(np.uint8)

    # Preserve alpha from original — transparent pixels get flat normal (128, 128, 255)
    a_np = np.array(a)
    flat_mask = a_np < 10  # Near-transparent pixels
    r_out[flat_mask] = 128
    g_out[flat_mask] = 128
    b_out[flat_mask] = 255

    # Compose output
    normal_img = Image.merge("RGBA", [
        Image.fromarray(r_out),
        Image.fromarray(g_out),
        Image.fromarray(b_out),
        a,  # Preserve original alpha channel
    ])

    normal_img.save(output_path)
    return True
```

### 2. Create Batch Processing Script

**File:** `scripts/generate-normal-maps.py` (continued, same file)

```python
def batch_generate(quality: str = "medium", enemy_filter: str = None) -> dict:
    """Generate normal maps for all enemy sprites."""
    preset = QUALITY_PRESETS[quality]
    results = {"success": [], "failed": [], "skipped": []}

    for sprite_file in sorted(SPRITE_DIR.glob("*_idle.png")):
        enemy_id = sprite_file.stem.replace("_idle", "")

        if enemy_filter and enemy_id != enemy_filter:
            continue

        normal_path = SPRITE_DIR / f"{enemy_id}_idle_n.png"

        # Also generate for 1x variant if it exists
        sprite_1x = SPRITE_DIR / f"{enemy_id}_idle_1x.png"
        normal_1x_path = SPRITE_DIR / f"{enemy_id}_idle_1x_n.png"

        try:
            generate_normal_map(sprite_file, normal_path, **preset)
            results["success"].append(enemy_id)

            if sprite_1x.exists():
                generate_normal_map(sprite_1x, normal_1x_path, **preset)

        except Exception as e:
            results["failed"].append(f"{enemy_id}: {e}")

    return results
```

### 3. Create Flat Fallback Normal Map

**File:** `public/assets/sprites/enemies/flat_normal.png`

A solid RGB(128, 128, 255) image — represents a perfectly flat surface facing the camera. Any enemy sprite without a proper normal map uses this as fallback, ensuring Light2D pipeline doesn't make them invisible (known Phaser bug: sprites on Light2D pipeline without normal maps disappear).

Generate programmatically:
```python
def create_flat_fallback():
    """Create a 64x64 flat normal map (facing camera) as fallback."""
    img = Image.new("RGBA", (64, 64), (128, 128, 255, 255))
    img.save(SPRITE_DIR / "flat_normal.png")
```

### 4. Integrate into Deploy Pipeline

**File:** `scripts/deploy-enemy-sprites.mjs` (modify)

Add normal map deployment step after sprite processing:

```javascript
// After processing standard sprites...

// Deploy normal maps alongside diffuse sprites
for (const enemy of enemies) {
  const normalSrc = path.join(NORMAL_MAP_DIR, `${enemy.id}_idle_n.png`);

  if (fs.existsSync(normalSrc)) {
    // Standard resolution normal map
    const normalDst = path.join(SPRITE_OUTPUT, `${enemy.id}_idle_n.png`);
    await sharp(normalSrc)
      .resize(targetSize, targetSize, { fit: 'inside', kernel: sharp.kernel.lanczos3 })
      .png()
      .toFile(normalDst);

    // WebP variant (normal maps can use lossy — slight quality loss is acceptable)
    const normalWebP = path.join(SPRITE_OUTPUT, `${enemy.id}_idle_n.webp`);
    await sharp(normalSrc)
      .resize(targetSize, targetSize, { fit: 'inside', kernel: sharp.kernel.lanczos3 })
      .webp({ quality: 90 })  // Slightly lossy OK for normal maps
      .toFile(normalWebP);

    // 1x variant for low-end devices
    const normal1xDst = path.join(SPRITE_OUTPUT, `${enemy.id}_idle_1x_n.png`);
    await sharp(normalSrc)
      .resize(halfSize, halfSize, { fit: 'inside', kernel: sharp.kernel.lanczos3 })
      .png()
      .toFile(normal1xDst);
  }
}
```

### 5. Update Sprite Loading in Phaser

**File:** `src/game/scenes/CombatScene.ts` (preload section, ~line 515)

Change sprite loading to use Phaser's array syntax for normal map pairing:

```typescript
// BEFORE (current):
this.load.image(key, `assets/sprites/enemies/${enemy.id}_idle${suffix}.png`);

// AFTER (with normal map):
const diffuseUrl = `assets/sprites/enemies/${enemy.id}_idle${suffix}.${ext}`;
const normalUrl = `assets/sprites/enemies/${enemy.id}_idle${suffix}_n.${ext}`;

// Check if normal map exists (pre-computed manifest), use flat fallback if not
const hasNormalMap = NORMAL_MAP_MANIFEST.has(enemy.id);
const normalPath = hasNormalMap ? normalUrl : 'assets/sprites/enemies/flat_normal.png';

this.load.image(key, [diffuseUrl, normalPath]);
```

**Important:** Normal map textures must use **bilinear filtering** for correct lighting math, even though diffuse sprites use nearest-neighbor (`pixelArt: true`). This requires manually setting filtering after load:

```typescript
this.load.on('filecomplete', (key: string) => {
  if (key.startsWith('enemy-')) {
    const texture = this.textures.get(key);
    // Normal map is stored as the second frame/source
    // Set LINEAR filtering on the normal map data texture
    if (texture.dataSource && texture.dataSource[0]) {
      const glTexture = texture.dataSource[0].glTexture;
      if (glTexture) {
        const gl = this.renderer.gl;
        gl.bindTexture(gl.TEXTURE_2D, glTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      }
    }
  }
});
```

### 6. Create Normal Map Manifest

**File:** `src/data/normalMapManifest.ts`

A simple set of enemy IDs that have proper normal maps (vs flat fallback):

```typescript
/** Enemy IDs that have proper normal maps generated. Updated by deploy pipeline. */
export const NORMAL_MAP_MANIFEST = new Set<string>([
  // Auto-populated by scripts/deploy-enemy-sprites.mjs
  // 'cave_bat',
  // 'magma_core',
  // ...
]);
```

This is auto-generated by the deploy script. It prevents runtime 404s when checking for normal maps.

### 7. Quality Validation

After batch generation, validate normal maps:

```python
def validate_normal_maps():
    """Check all generated normal maps for correctness."""
    issues = []

    for normal_file in SPRITE_DIR.glob("*_n.png"):
        img = Image.open(normal_file)
        data = np.array(img)

        # Check 1: Blue channel should be mostly > 128 (normals face camera)
        blue_avg = data[:, :, 2].mean()
        if blue_avg < 120:
            issues.append(f"{normal_file.name}: low blue avg ({blue_avg:.0f}) — normals may be inverted")

        # Check 2: Dimensions match diffuse sprite
        diffuse_name = normal_file.name.replace("_n.png", ".png")
        diffuse_path = SPRITE_DIR / diffuse_name
        if diffuse_path.exists():
            diffuse = Image.open(diffuse_path)
            if img.size != diffuse.size:
                issues.append(f"{normal_file.name}: size {img.size} != diffuse {diffuse.size}")

        # Check 3: Transparent regions have flat normal (128, 128, 255)
        alpha = data[:, :, 3]
        transparent = alpha < 10
        if transparent.any():
            flat_rgb = data[transparent, :3]
            non_flat = ((flat_rgb[:, 0] != 128) | (flat_rgb[:, 1] != 128) | (flat_rgb[:, 2] != 255)).sum()
            if non_flat > 0:
                issues.append(f"{normal_file.name}: {non_flat} transparent pixels without flat normal")

    return issues
```

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `scripts/generate-normal-maps.py` | **CREATE** | Sobel-based normal map generator with batch mode |
| `src/data/normalMapManifest.ts` | **CREATE** | Set of enemy IDs with normal maps |
| `scripts/deploy-enemy-sprites.mjs` | **MODIFY** | Add normal map processing step |
| `src/game/scenes/CombatScene.ts` | **MODIFY** | Load sprites with normal map array syntax |
| `public/assets/sprites/enemies/flat_normal.png` | **CREATE** | 64x64 flat fallback normal map |
| `public/assets/sprites/enemies/*_n.png` | **CREATE** | ~89 normal map files |
| `public/assets/sprites/enemies/*_n.webp` | **CREATE** | ~89 WebP normal map files |
| `public/assets/sprites/enemies/*_1x_n.png` | **CREATE** | ~89 low-res normal map files |

## Acceptance Criteria

- [ ] `scripts/generate-normal-maps.py` runs successfully, generating normal maps for all 89 enemies
- [ ] Each normal map has correct dimensions matching its diffuse sprite
- [ ] Transparent regions in normal maps have flat normal (RGB 128, 128, 255)
- [ ] Blue channel average > 120 for all normal maps (normals face camera)
- [ ] `flat_normal.png` fallback exists and is 64x64 RGB(128, 128, 255)
- [ ] `normalMapManifest.ts` lists all enemies with proper normal maps
- [ ] Sprites load correctly with `[diffuse, normal]` array syntax in Phaser
- [ ] Normal map textures have bilinear filtering (not nearest-neighbor)
- [ ] Diffuse textures still have nearest-neighbor filtering (pixelArt preserved)
- [ ] No visual regression in current rendering (normal maps are loaded but not consumed until AR-219)
- [ ] `deploy-enemy-sprites.mjs` includes normal map processing
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds

## Verification Gate

1. Run `python3 scripts/generate-normal-maps.py` — all 89 succeed
2. Run validation: `python3 scripts/generate-normal-maps.py --validate` — no issues
3. `npm run typecheck` + `npm run build` — clean
4. Playwright: load a combat scene, verify enemy sprite still renders correctly
5. `browser_evaluate(() => { const tex = game.textures.get('enemy-cave_bat-idle'); return !!tex.dataSource; })` — confirm normal map data is loaded
6. Visual: enemy sprites should look IDENTICAL to before (normal maps loaded but unused until AR-219)

## Performance Notes

- Normal maps add ~10-15% VRAM per enemy sprite (one additional texture per sprite)
- For 89 enemies at 256px average: ~89 * 256 * 256 * 4 bytes * 2 (diffuse + normal) = ~46MB VRAM total. Manageable.
- Only the currently visible enemy's textures are in GPU memory (Phaser lazy-loads)
- Batch generation takes ~5-10 seconds for all 89 sprites (Python Sobel is fast)

## Asset Size Impact

| Asset Type | Per Enemy | Total (89) |
|------------|-----------|------------|
| Normal map PNG | ~15KB | ~1.3MB |
| Normal map WebP | ~10KB | ~0.9MB |
| Normal map 1x PNG | ~5KB | ~0.4MB |
| **Total new assets** | **~30KB** | **~2.6MB** |

## Design Decisions

- **Python Sobel over Laigter:** More portable (runs on any dev machine), scriptable, good enough for 64-128px sprites. Laigter produces better results but requires installation.
- **Normal maps stored alongside diffuse sprites** (not in separate directory): Keeps the Phaser array loading syntax simple and follows the CodeAndWeb/SpriteIlluminator convention.
- **Flat fallback** rather than conditional pipeline switching: Simpler code. A flat normal map with Light2D looks identical to no-normal-map rendering — the sprite is lit uniformly.
- **Lossy WebP for normal maps:** Normal map data is smooth gradients, not pixel-art edges. Lossy compression at quality 90 produces visually identical results with 30-40% smaller files.
- **Bilinear filtering override:** Counter-intuitive for a `pixelArt: true` project, but normal maps need smooth interpolation between texels for correct lighting math. The diffuse texture stays nearest-neighbor.

## Boss Sprite Touch-Up Plan

After initial batch generation, the 13 boss sprites should be visually reviewed under in-game lighting (once AR-219 is implemented). Bosses with poor auto-generated normals (pillow shading artifacts) can be manually touched up using:

1. Open normal map in Aseprite (with Normal Toolkit extension)
2. Paint corrected normals on problem areas (flat plates, sharp edges, deep crevices)
3. Re-deploy via `deploy-enemy-sprites.mjs`

This manual step is POST-AR-219 and not required for this AR to be complete.
