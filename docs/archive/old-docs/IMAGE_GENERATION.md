# Terra Miner — AI Image Generation Pipeline

## Art Style: Cel-Shaded 2D Pixel Art

All sprites use the **cel-shaded 2D pixel art** style. See [ART_STYLE_GUIDE.md](ART_STYLE_GUIDE.md) for the full specification, biome palettes, and category-specific prompt templates.

Best practices and configuration for generating pixel art game assets using AI image generation via OpenRouter.

---

## Table of Contents

1. [API Configuration](#api-configuration)
2. [Green Screen Transparency Pipeline](#green-screen-transparency-pipeline)
3. [Prompt Engineering Best Practices](#prompt-engineering-best-practices)
4. [Resolution Pipeline](#resolution-pipeline)
5. [File Organization](#file-organization)
6. [Sprite Categories and Counts](#sprite-categories-and-counts)
7. [Quality Control](#quality-control)
8. [Cost Estimates](#cost-estimates)

---

## API Configuration

### Endpoint

```
POST https://openrouter.ai/api/v1/chat/completions
```

### Authentication

API key stored in `.env` as `OPENROUTER_API_KEY`. Never commit this file.

### Request Format

```json
{
  "model": "google/gemini-2.5-flash-image",
  "modalities": ["image", "text"],
  "stream": false,
  "messages": [
    {
      "role": "user",
      "content": "Your prompt here"
    }
  ]
}
```

### Response Format

The response includes an `images` array containing base64-encoded PNG data URLs. Extract the base64 data after the `data:image/png;base64,` prefix.

### Available Models

| Model ID | Codename | Cost/Image | Latency | Notes |
|---|---|---|---|---|
| `google/gemini-2.5-flash-image` | Nano Banana 1 (NB1) | $0.04 | ~5s | **Standard model for ALL sprites.** Cheapest option, produces good cel-shaded pixel art with the correct prompt template. |

### Model Selection Guidelines

- **Use NB1 (`google/gemini-2.5-flash-image`) for everything.** We have standardized on a single model to keep costs low ($0.04/image) and maintain visual consistency across all sprites.
- The green screen output from NB1 requires tolerance-based chroma keying (not exact match). This is handled by the generation script automatically.
- There is no "premium model" tier. All sprites — including hero assets, characters, and key story items — use NB1.

---

## Green Screen Transparency Pipeline

AI models cannot generate true alpha transparency. Instead, we use a green screen workflow:

### Step 1: Request Green Background in Prompt

Always include in every prompt:

> "solid bright green (#00FF00) background"

### Step 2: Understand AI Green Screen Behavior

The AI will generate a near-green background, but it is rarely exact `#00FF00`. Typical output values include `#05F904`, `#02FA03`, and similar near-greens. Do not assume an exact hex match.

### Step 3: Detect Actual Green from Corner Pixels

Sample the corner pixels of the generated image to determine the actual green value used. This measured value becomes the key color for chroma removal.

### Step 4: Apply Chroma Key Removal with Tolerance

Use color-distance-based keying (not exact match) with a configurable tolerance to handle:

- Slight variations in the green background
- Anti-aliasing artifacts at sprite edges
- Green spill onto adjacent pixels

### Step 5: Edge Despill

After keying, apply edge despill to remove green contamination from semi-transparent edge pixels. This prevents green fringing around sprites when composited onto non-green backgrounds.

### Step 6: Auto-Crop

Remove transparent padding around the sprite to minimize file size and simplify alignment.

### Step 7: Save as PNG with Alpha

Export the final asset as PNG with a proper alpha channel. Never use JPEG for sprites.

---

## Prompt Engineering Best Practices

### Required Prompt Elements (Cel-Shaded Style)

Every sprite generation prompt must include ALL of the following cel-shaded style keywords:

```
cel-shaded 2D pixel art, bold black outlines, flat color shading with 2-3 tones per color,
no gradients, no anti-aliasing, high contrast, vibrant saturated colors, clean crisp edges,
top-left lighting, retro 16-bit game style, visible chunky pixels
```

Plus these production requirements:
```
- "solid bright green (#00FF00) background"
- "game asset"
- "centered in frame"
```

See [ART_STYLE_GUIDE.md](ART_STYLE_GUIDE.md) for the full style specification and category-specific prompt templates.

### View Angle

- **Objects and items**: "front-facing 3/4 angle"
- **Characters**: "front-facing 3/4 angle" or "2D side view" depending on use
- **Tiles**: "top-down view" or "2D side view" as appropriate
- **Icons**: "flat front-facing view"

### Tile-Specific Prompts

For tileable textures, add:

```
- "seamless tileable pattern"
- "32x32 pixel grid"
- "edges wrap seamlessly"
```

### Sprite Sheet Prompts

For character animation sheets:

```
- "sprite sheet format"
- "idle pose"
- "evenly spaced grid"
- Specify exact frame count and arrangement
```

### Color and Material Specificity

Be extremely specific about visual properties:

- Name exact colors: "deep cobalt blue (#1a3c6e)" not just "blue"
- Name materials: "brushed titanium with oxide patina" not just "metal"
- Name shapes: "hexagonal crystalline structure" not just "crystal"

### Game Context

Include world-building context to maintain consistency:

```
"far-future Earth, underground mining, sci-fi dome habitat"
```

### Style Consistency

For related sprites (e.g., all dome furniture, all biome soil tiles), include a style anchor:

```
"matching the style of the Terra Miner dome furniture set"
"consistent with the volcanic biome rock palette"
```

### Example Prompt (Dome Object)

```
Cel-shaded 2D pixel art game asset, bold black outlines, flat color shading with 2-3
tones per color, no gradients, no anti-aliasing, high contrast, vibrant saturated colors,
clean crisp edges, top-left lighting, retro 16-bit game style, visible chunky pixels.
A compact hydroponic planter with glowing blue nutrient tubes and small green leafy plants,
brushed titanium frame. Front-facing 3/4 angle, centered in frame. Far-future Earth sci-fi
dome habitat style. Solid bright green (#00FF00) background.
```

### Example Prompt (Mining Block)

```
Cel-shaded 2D pixel art game asset, bold black outlines, flat color shading with 2-3
tones per color, no gradients, no anti-aliasing, high contrast, vibrant saturated colors,
clean crisp edges, top-left lighting, retro 16-bit game style, visible chunky pixels.
A rough iron ore block with reddish-brown oxidized patches and exposed metallic veins,
embedded in dark grey stone. 2D side view, centered in frame, 32x32 pixel grid.
Underground mining context. Solid bright green (#00FF00) background.
```

---

## Resolution Pipeline

### Generation

AI generates at its native resolution, typically **1024x1024** or **1408x768** depending on the model and prompt.

### High-Resolution Assets (256px)

- Crop the subject from the generated image
- Resize to **256x256** (or larger for dome objects that need more detail)
- Use for hi-res display mode

### Low-Resolution Assets (32px)

- Downscale from high-res using **nearest-neighbor interpolation**
- This preserves pixel art crispness — never use bilinear or bicubic scaling
- Target size: **32x32** for standard tiles and blocks

### Biome Tiles

- Generate both **soil** and **rock** variants per biome
- **32px** tiles for the standard game view
- **256px** tiles for hi-res mode
- Both variants must share a consistent color palette per biome

### Originals

Store the unprocessed AI output in `sprite-gen/output/` for reference and potential re-processing.

---

## File Organization

### Directory Structure

```
sprite-gen/
  output/                          # Raw AI-generated originals
    {category}/
      {sprite_name}_original.png

public/assets/
  sprites/                         # Low-res (32px) game assets
    {category}/
      {sprite_name}.png
  sprites-hires/                   # High-res (256px) game assets
    {category}/
      {sprite_name}.png

sprite-gen/
  sprite-registry.json             # Tracks all sprites, prompts, dates, models
```

### Sprite Registry

`sprite-gen/sprite-registry.json` tracks metadata for every generated sprite:

```json
{
  "sprite_name": {
    "category": "dome_objects",
    "prompt": "...",
    "model": "google/gemini-2.5-flash-image",
    "generated_date": "2026-03-06",
    "original_path": "sprite-gen/output/dome_objects/planter_original.png",
    "hires_path": "public/assets/sprites-hires/dome_objects/planter.png",
    "lores_path": "public/assets/sprites/dome_objects/planter.png"
  }
}
```

---

## Sprite Categories and Counts

| Category | Count | Description |
|---|---|---|
| Characters | 2 | `miner_idle`, `miner_sheet` |
| Companions | 5 | `comp_archivist_3`, `comp_borebot_3`, `comp_carapace_3`, `comp_lumis_3`, `comp_medi_3` |
| Pets | 17 | Dust cat variants, hats, and accessories |
| Items | 5 | Minerals and relics |
| Icons | 7 | `crystal`, `dust`, `essence`, `flame`, `geode`, `oxygen`, `shard` |
| Dome Objects | 76 | Tiles, furniture, GAIA expressions, paintings, decorations, backgrounds |
| Dome Tiles | 11 | `dome_glass`, `dome_frame`, `stone_floor`, `metal_platform`, `interior_wall`, etc. |
| Mining Blocks | 111 | Minerals, hazards, structures, cracks, overlays |
| Biome Tiles | 1,130 | 25 biomes x soil/rock variants x bitmask tiles |
| Autotiles | 32 | 2 tilesets x 16 bitmask variants |
| **Total** | **1,396** | |

---

## Quality Control

### Post-Generation Checklist

1. **Visual inspection**: Check for rendering artifacts, style consistency, and proper green screen coverage.
2. **Transparency verification**: Confirm clean alpha edges after chroma keying — no green fringing.
3. **Size validation**: Verify output dimensions match expected 256px (hi-res) and 32px (lo-res).
4. **Style consistency**: Compare against existing sprites in the same category for palette and detail level.

### Automated Pipeline Steps

After generating or updating sprites, run:

```bash
# Regenerate sprite key TypeScript types
node scripts/gen-sprite-keys.mjs

# Rebuild biome tile atlases
node sprite-gen/pack-biome-atlases.mjs
```

### In-Game Verification

Use Playwright to capture screenshots and verify sprites render correctly:

```bash
# Start dev server
npm run dev

# Take screenshot of relevant screen
# Use MCP Playwright tools or E2E scripts in tests/e2e/
```

---

## Cost Estimates

All estimates use NB1 at $0.04/image.

| Category | Count | Model | Cost |
|---|---|---|---|
| Dome Sprites | 76 | NB1 | ~$3.04 |
| Characters/Companions/Pets | 24 | NB1 | ~$0.96 |
| Mining Blocks | 111 | NB1 | ~$4.44 |
| Items/Icons | 12 | NB1 | ~$0.48 |
| Biome Tiles | 1,130 | NB1 | ~$45.20 |
| **Total** | **1,353** | | **~$54.12** |

### Cost Optimization Tips

- **Batch related sprites** in a single session to maintain style consistency.
- **Re-use prompts** with minor modifications for variant sprites (e.g., biome soil tiles across different biomes).
- **Cache originals** in `sprite-gen/output/` so you can re-process without re-generating.
- **Use 5x5 sprite sheets** for overlay variants — 25 sprites for the cost of 1 API call ($0.04).

---

## Card Frame V2 Pipeline

### Overview

Card frames use a **PSD-based layered system** (AR-107). A single master PSD (`data/generated/camp-art/NEW_CARD.psd`, 886×1142px) contains all frame elements as separate layers. A Python extraction script generates all color variants automatically.

### Art Iteration Tool

The **Art Studio** tool at `http://localhost:5175/artstudio.html` (served from the cardback-tool dev server) provides an interactive interface for iterating on card art, enemy sprites, and card frames. Use it to preview frame compositing and tune hue-shift values before running full extraction.

### NanoBanana / OpenRouter Workflow

Card art and sprite generation uses the `google/gemini-2.5-flash-image` model via OpenRouter (referred to internally as NanoBanana / NB1). This is the same model used for all game sprite generation. API key stored in `.env` as `OPENROUTER_API_KEY` — never commit this file.

Use the green screen pipeline (see above) when generating card art to be composited into the pentagon art window.

### PSD Layer Structure

The master PSD contains three layer groups:

| Layer | Purpose | Variation |
|---|---|---|
| `border` | Outer frame ring | Hue-shifted per card type (6 variants) |
| `base` | Structural frame: book icon, pentagon art window, text area | Static — identical for all cards |
| `banner` | Banner across mechanic name area | Hue-shifted per chain type (6 variants) |
| `upgrade_icon` | Green cross badge for upgraded cards | Static |

### Extraction Pipeline

Run the Python script to re-extract layers and regenerate all WebP color variants:

```bash
python3 scripts/extract-card-frame.py
```

This script:
1. Opens `data/generated/camp-art/NEW_CARD.psd`
2. Crops each layer group to its bounding box
3. Applies a **black-preserving hue-shift** to generate the 6 border and 6 banner color variants
4. Exports all 14 WebP files to `public/assets/cardframes/v2/` (hires + lowres variants)

### Color Mapping

**Card type → border color:**

| Card Type | Color | Hue Shift |
|---|---|---|
| Attack | Red | 0° |
| Shield | Blue | 240° |
| Buff | Purple | 270° |
| Debuff | Green | 120° |
| Utility | Teal | 180° |
| Wild | Gold | 45° |

**Chain type → banner color:**

| Chain Type | Color | Description |
|---|---|---|
| 0 | Obsidian | Gray — no chain affinity |
| 1 | Crimson | Red chain |
| 2 | Azure | Blue chain |
| 3 | Amber | Orange/gold chain |
| 4 | Violet | Purple chain |
| 5 | Jade | Green chain |

### Output Assets

All V2 card frame assets live in `public/assets/cardframes/v2/`:

```
base.webp, base_lowres.webp
border_attack.webp, border_shield.webp, border_buff.webp,
border_debuff.webp, border_utility.webp, border_wild.webp
banner_0.webp ... banner_5.webp
upgrade_icon.webp
(+ _lowres variants for each)
```

### Guide Positions

`src/ui/utils/cardFrameV2.ts` exports guide positions derived from PSD layer coordinates. These positions are used to place CSS text overlays (AP cost, mechanic name, card type label, effect text) at exact PSD-specified coordinates, ensuring consistent alignment across all card types.
