# CR-14: NB1 Art Pipeline Setup

> Phase: P2 — Art Pipeline + First Asset Pass
> Priority: BLOCKER
> Depends on: None
> Estimated scope: M

Set up the Recall Rogue asset generation pipeline using NB1 (`google/gemini-2.5-flash-image`) via OpenRouter API. This creates a new prompt-manifest-driven generation script and post-processing pipeline tailored to Recall Rogue's art needs (fantasy pixel art sprites and backgrounds). This is the foundation for all subsequent asset generation CRs.

Note: The project already has `sprite-gen/scripts/generate-sprites.mjs` (registry-driven, Terra Miner dome/mining assets) and `sharp` is installed. This CR creates a **new, parallel script** specifically for Recall Rogue assets, using a JSON prompt manifest instead of the existing sprite registry.

## Design Reference

From `sprite-gen/GENERAL_INSTRUCTIONS.md`:
> Virtual resolution: 270x600px (portrait, 9:20 aspect ratio)
> Scale factor: 4x nearest-neighbor to 1080x2400 device pixels
> File format: PNG with transparency (RGBA)
> Palette: Constrained 32-64 color palette recommended

From `.env.example`:
```
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_MODEL=google/gemini-3.1-flash-image-preview
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
```

Note: The `.env` already has `OPENROUTER_API_KEY` configured. The model to use is `google/gemini-2.5-flash-image` (NB1). The `.env.example` should be updated to reflect this model.

From existing `sprite-gen/scripts/generate-sprites.mjs` — API call format (proven working):
```json
{
  "model": "google/gemini-2.5-flash-image",
  "modalities": ["image", "text"],
  "stream": false,
  "messages": [{ "role": "user", "content": "prompt here" }]
}
```

Response parsing (from existing script):
- Primary: `data.choices[0].message.images[0].image_url.url` (base64 data URI)
- Fallback: `data.choices[0].message.content[0].inline_data.data` or `data.choices[0].message.images[0].b64_json`

## Implementation

### Data Model

#### Prompt Manifest: `sprite-gen/arcane-prompts.json`

A JSON file that drives all Recall Rogue asset generation. Separate arrays for sprites (green-screen) and backgrounds (no green-screen).

```json
{
  "meta": {
    "version": 1,
    "description": "Recall Rogue asset generation prompts",
    "model": "google/gemini-2.5-flash-image",
    "updatedAt": null
  },
  "sprites": [
    {
      "id": "cave_bat_idle",
      "category": "enemies",
      "prompt": "A large golden pale bat, flying ominously with wings spread wide, fantasy creature, cel-shaded 2D pixel art, bold black outlines, flat color shading with 2-3 tones per color, no gradients, no anti-aliasing, high contrast, vibrant saturated colors, clean crisp edges, top-left lighting, retro 16-bit game style, visible chunky pixels, solid bright green (#00FF00) background, game asset, centered in frame",
      "targetWidth": 96,
      "targetHeight": 128,
      "useGreenScreen": true
    }
  ],
  "backgrounds": []
}
```

**Field definitions:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | YES | Unique identifier, used for filename and registry key |
| `category` | string | YES | Subdirectory under output/sprites — one of: `enemies`, `player`, `cards`, `icons`, `doors`, `backgrounds` |
| `prompt` | string | YES | Full generation prompt including style suffix |
| `targetWidth` | number | YES | Final output width in virtual pixels |
| `targetHeight` | number | YES | Final output height in virtual pixels |
| `useGreenScreen` | boolean | YES | If true, run green-screen removal; if false, skip (for backgrounds) |

#### Sprite Registry Updates: `sprite-gen/sprite-registry.json`

After successful generation, add entries to the existing sprite registry under a new `"recallRogue"` array (separate from the existing `"sprites"` array used by Terra Miner assets):

```json
{
  "recallRogue": [
    {
      "key": "cave_bat_idle",
      "category": "enemies",
      "prompt": "...",
      "model": "google/gemini-2.5-flash-image",
      "targetSizes": { "full": [96, 128] },
      "outputPaths": {
        "original": "sprite-gen/output/enemies/cave_bat_idle_original.png",
        "final": "public/assets/sprites/enemies/cave_bat_idle.png"
      },
      "generatedAt": "2026-03-09T12:00:00Z"
    }
  ]
}
```

### Logic

#### Main Generation Script: `sprite-gen/generate-arcane-sprites.mjs`

This is a standalone Node.js ESM script. It reads `arcane-prompts.json`, calls the OpenRouter API, runs post-processing, and saves output.

**CLI interface:**
```bash
node sprite-gen/generate-arcane-sprites.mjs --all              # Generate all entries
node sprite-gen/generate-arcane-sprites.mjs --id cave_bat_idle # Generate one by ID
node sprite-gen/generate-arcane-sprites.mjs --category enemies # Generate all in category
node sprite-gen/generate-arcane-sprites.mjs --dry-run --all    # Preview without API calls
node sprite-gen/generate-arcane-sprites.mjs --force --all      # Regenerate existing
```

Also add an npm script:
```json
"generate:arcane-sprites": "node sprite-gen/generate-arcane-sprites.mjs"
```

**Script structure (pseudocode):**

```javascript
// 1. Parse CLI args (--all, --id, --category, --dry-run, --force)
// 2. Load .env, validate OPENROUTER_API_KEY exists
// 3. Load arcane-prompts.json
// 4. Load sprite-registry.json
// 5. Filter entries based on CLI args
// 6. For --force=false, skip entries that already have generatedAt in registry
// 7. For each entry:
//    a. Log progress: "[1/N] Generating cave_bat_idle (enemies)..."
//    b. Call OpenRouter API with retry (3 attempts, exponential backoff)
//    c. Save raw output to sprite-gen/output/{category}/{id}_original.png
//    d. If useGreenScreen: run green-screen removal
//    e. Auto-crop transparent padding
//    f. Nearest-neighbor downscale to targetWidth x targetHeight
//    g. Save final PNG to public/assets/sprites/{category}/{id}.png
//       (or public/assets/backgrounds/{subcategory}/{id}.png for backgrounds)
//    h. Update sprite-registry.json with new entry
//    i. Rate-limit: wait MIN_REQUEST_INTERVAL_MS between API calls
// 8. Print summary: N generated, M skipped, K failed
```

**API call function** — reuse the proven pattern from existing `generate-sprites.mjs`:
- Endpoint: `https://openrouter.ai/api/v1/chat/completions`
- Headers: `Authorization: Bearer ${API_KEY}`, `Content-Type: application/json`
- Body: `{ model, messages: [{role: "user", content: prompt}], modalities: ["image", "text"], stream: false }`
- Response parsing: check `images[0].image_url.url` first, then `content[0].inline_data.data`, then `images[0].b64_json`
- Retry: 3 attempts, exponential backoff starting at 2s (2s, 4s, 8s)
- Rate limit: max 10 requests/minute (6s minimum between calls)

#### Green Screen Removal: `sprite-gen/lib/green-screen.mjs`

Extract the green-screen removal logic into a reusable module (the existing `generate-sprites.mjs` has this inline, but the Arcane pipeline should have it as a separate importable module for testability).

```javascript
import sharp from 'sharp';

/**
 * Remove green-screen background from a PNG buffer.
 *
 * Algorithm:
 *   1. Decode to raw RGBA pixels via sharp
 *   2. Sample 4 corner pixels to detect actual green-screen color
 *   3. If no green detected in corners, fallback to #00FF00
 *   4. For each pixel, compute Euclidean color distance to detected green
 *   5. dist < HARD_TOLERANCE (80): fully transparent (alpha = 0)
 *   6. HARD_TOLERANCE < dist < EDGE_TOLERANCE (130): blend alpha proportionally
 *   7. Edge despill: for semi-transparent pixels, reduce green channel toward
 *      the average of R and B channels (prevents green fringing on edges)
 *
 * @param {Buffer} pngBuffer - Raw PNG image data
 * @param {object} [options] - Optional overrides
 * @param {number} [options.hardTolerance=80] - Distance below which pixels become fully transparent
 * @param {number} [options.edgeTolerance=130] - Distance below which pixels get blended alpha
 * @returns {Promise<Buffer>} - PNG buffer with transparent background
 */
export async function removeGreenScreen(pngBuffer, options = {}) {
  const { hardTolerance = 80, edgeTolerance = 130 } = options;
  // ... implementation as in existing generate-sprites.mjs lines 299-380,
  // with added edge despill step:
  //
  // After setting alpha, for pixels where 0 < alpha < 255:
  //   const avgRB = (r + b) / 2;
  //   if (g > avgRB * 1.2) {
  //     data[i + 1] = Math.round(avgRB); // pull green toward neutral
  //   }
}
```

**Edge despill** is the key addition over the existing script. It prevents the green halo artifacts that are common with AI-generated green-screen sprites. The algorithm: for any pixel with partial alpha (edge pixel), if the green channel exceeds the average of red and blue by more than 20%, clamp green down to the R/B average. This neutralizes green fringing without affecting non-green pixels.

#### Post-Processing: `sprite-gen/lib/post-process.mjs`

```javascript
import sharp from 'sharp';

/**
 * Auto-crop transparent padding from a PNG buffer.
 * Finds the bounding box of non-transparent pixels and extracts that region,
 * plus a small padding (4px or 2% of largest dimension).
 *
 * @param {Buffer} pngBuffer
 * @param {number} [padding=4] - Minimum padding in pixels
 * @returns {Promise<Buffer>}
 */
export async function autoCrop(pngBuffer, padding = 4) { ... }

/**
 * Nearest-neighbor downscale to exact target dimensions.
 * Preserves pixel art crispness — no interpolation.
 *
 * @param {Buffer} pngBuffer
 * @param {number} targetW - Target width in pixels
 * @param {number} targetH - Target height in pixels
 * @returns {Promise<Buffer>}
 */
export async function downscale(pngBuffer, targetW, targetH) {
  return sharp(pngBuffer)
    .resize(targetW, targetH, {
      kernel: sharp.kernel.nearest,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

/**
 * Quantize a PNG to a limited color palette.
 * Optional step — reduces file size and enforces pixel art aesthetic.
 *
 * @param {Buffer} pngBuffer
 * @param {number} [colors=32] - Max number of colors
 * @returns {Promise<Buffer>}
 */
export async function paletteQuantize(pngBuffer, colors = 32) {
  return sharp(pngBuffer)
    .png({ palette: true, colours: colors })
    .toBuffer();
}

/**
 * Full post-processing pipeline for a sprite.
 * Chains: green screen removal → auto-crop → downscale → optional palette quantize.
 *
 * @param {Buffer} rawPngBuffer - Raw AI output
 * @param {object} opts
 * @param {boolean} opts.useGreenScreen - Whether to run green screen removal
 * @param {number} opts.targetWidth - Final width
 * @param {number} opts.targetHeight - Final height
 * @param {boolean} [opts.quantize=false] - Whether to palette-quantize
 * @param {number} [opts.quantizeColors=32] - Number of palette colors
 * @returns {Promise<Buffer>} - Final processed PNG
 */
export async function processSprite(rawPngBuffer, opts) {
  let buf = rawPngBuffer;
  if (opts.useGreenScreen) {
    const { removeGreenScreen } = await import('./green-screen.mjs');
    buf = await removeGreenScreen(buf);
  }
  buf = await autoCrop(buf);
  buf = await downscale(buf, opts.targetWidth, opts.targetHeight);
  if (opts.quantize) {
    buf = await paletteQuantize(buf, opts.quantizeColors);
  }
  return buf;
}
```

### UI

No UI changes in this CR. This is a tooling/pipeline setup.

### System Interactions

- **Reads**: `.env` (for `OPENROUTER_API_KEY`), `sprite-gen/arcane-prompts.json`, `sprite-gen/sprite-registry.json`
- **Writes**: `sprite-gen/output/{category}/*.png` (raw), `public/assets/sprites/{category}/*.png` (processed), `sprite-gen/sprite-registry.json` (updated)
- **External**: OpenRouter API (`https://openrouter.ai/api/v1/chat/completions`)
- **Dependencies**: `sharp` (already installed), `dotenv` (already installed)

### Directory Structure

Create these directories (if they don't exist):

```
sprite-gen/
  lib/                         # NEW — reusable processing modules
    green-screen.mjs           # NEW — green screen chroma key removal
    post-process.mjs           # NEW — auto-crop, resize, quantize, pipeline
  output/                      # EXISTS — raw AI output (gitignored)
    enemies/                   # NEW subdirectory
    player/                    # NEW subdirectory
    backgrounds/               # NEW subdirectory
    cards/                     # NEW subdirectory
    icons/                     # NEW subdirectory
    doors/                     # NEW subdirectory
  arcane-prompts.json          # NEW — prompt manifest
  generate-arcane-sprites.mjs  # NEW — main generation script

public/assets/
  sprites/
    enemies/                   # NEW — 48x64 (common), larger for bosses
    player/                    # NEW — 32x48
    cards/                     # NEW — 75x100 frames
    icons/                     # NEW — 32x32 domain icons
    doors/                     # NEW — 40x50 room doors
  backgrounds/
    combat/                    # NEW — 270x600
    menu/                      # NEW — 270x600
    rooms/                     # NEW — 270x600
```

### Test Sprite: Cave Bat Idle

As part of pipeline validation, generate 1 test sprite end-to-end:

- **ID**: `cave_bat_idle`
- **Category**: `enemies`
- **Prompt**: "A large golden pale bat, flying ominously with wings spread wide, fantasy creature, cel-shaded 2D pixel art, bold black outlines, flat color shading with 2-3 tones per color, no gradients, no anti-aliasing, high contrast, vibrant saturated colors, clean crisp edges, top-left lighting, retro 16-bit game style, visible chunky pixels, solid bright green (#00FF00) background, game asset, centered in frame"
- **Target**: 96x128 (2x virtual), downscaled from raw AI output
- **Green screen**: YES

**Verification steps:**
1. API call succeeds (HTTP 200, image data in response)
2. Raw output saved to `sprite-gen/output/enemies/cave_bat_idle_original.png`
3. Green screen removal produces clean alpha (no green fringing)
4. Auto-crop removes excess transparent padding
5. Nearest-neighbor downscale to 96x128 produces crisp pixel edges
6. Final output saved to `public/assets/sprites/enemies/cave_bat_idle.png`
7. `sprite-registry.json` updated with new `recallRogue` entry

### Visual Inspection (Playwright)

After generating the test sprite, create a temporary HTML page and verify visually:

```javascript
// In the generation script, after successful test sprite generation:
// 1. Create a temporary HTML file that shows the sprite on 4 colored backgrounds
//    (white, black, red, blue) to verify no green fringing
// 2. Use Playwright MCP to navigate to the HTML file
// 3. Take screenshot
// 4. Verify dimensions via browser_evaluate:
//    const img = document.querySelector('img');
//    return { width: img.naturalWidth, height: img.naturalHeight };
// 5. Delete the temporary HTML file
```

Alternatively, the orchestrator can do this manually after running the script.

## Edge Cases

| Scenario | Expected Behavior |
|----------|------------------|
| API rate limit (429) | Exponential backoff: 2s → 4s → 8s, max 3 retries |
| API returns error (4xx/5xx) | Log error with full response body, skip sprite, continue to next |
| API returns no image data | Throw error "No image found in API response", log response keys for debugging |
| Green screen detection fails (no green corners) | Fallback to pure #00FF00 as key color, log warning |
| Output image too small to auto-crop | Save as-is with warning "Image too small to crop meaningfully" |
| Output image is already correct size | Skip downscale step |
| Existing sprite in output dir (no --force) | Skip with "[SKIP] cave_bat_idle (already exists)" message |
| Existing sprite in output dir (--force) | Overwrite and regenerate |
| OPENROUTER_API_KEY not set | Exit with error message, non-zero exit code |
| arcane-prompts.json missing or malformed | Exit with clear error message and expected format |
| sprite-registry.json missing | Exit with error; do not create from scratch |
| Network timeout | Caught by retry logic; 30s fetch timeout per request |
| Output directory doesn't exist | Create recursively with `mkdir -p` equivalent |
| sharp not installed | Exit with error message: "Run npm install sharp" |

## Files

| Action | File | What Changes |
|--------|------|--------------|
| Create | `sprite-gen/generate-arcane-sprites.mjs` | Main generation script — CLI, API calls, orchestration |
| Create | `sprite-gen/arcane-prompts.json` | Prompt manifest (initially just cave_bat_idle test sprite) |
| Create | `sprite-gen/lib/green-screen.mjs` | Green screen chroma key removal with edge despill |
| Create | `sprite-gen/lib/post-process.mjs` | Auto-crop, nearest-neighbor resize, palette quantize, pipeline |
| Modify | `sprite-gen/sprite-registry.json` | Add `recallRogue` array with test sprite entry after generation |
| Modify | `.env.example` | Update `OPENROUTER_MODEL` to `google/gemini-2.5-flash-image` |
| Modify | `package.json` | Add `"generate:arcane-sprites"` npm script (sharp already installed) |

## Done When

- [ ] `npm run generate:arcane-sprites -- --all` runs the pipeline end-to-end without errors
- [ ] Test sprite (cave_bat_idle) generates successfully via NB1 API call
- [ ] Raw output saved to `sprite-gen/output/enemies/cave_bat_idle_original.png`
- [ ] Green screen removal produces clean alpha channel with no green fringing
- [ ] Edge despill removes green halo artifacts on sprite edges
- [ ] Auto-crop removes excess transparent padding around the sprite
- [ ] Nearest-neighbor downscale to 96x128 produces crisp pixel art (no blurring)
- [ ] Final output saved to `public/assets/sprites/enemies/cave_bat_idle.png`
- [ ] `sprite-registry.json` updated with `recallRogue` entry including `generatedAt` timestamp
- [ ] `--force` flag allows regenerating existing sprites (overwrites output)
- [ ] `--dry-run` flag previews what would be generated without calling API
- [ ] `--id` flag generates a single sprite by ID
- [ ] `--category` flag generates all sprites in a category
- [ ] API errors handled gracefully: exponential backoff (3 retries), skip on failure, continue
- [ ] Rate limiting enforced: minimum 6s between API calls
- [ ] Missing directories created automatically
- [ ] Playwright visual inspection confirms clean sprite on colored backgrounds (no fringing)
- [ ] Script exits cleanly with summary: N generated, M skipped, K failed
