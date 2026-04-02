# Sprite Generation Pipeline — Terra Miner

How pixel art sprites are generated using ComfyUI with Stable Diffusion, running on a local RTX 3060 12GB.

## Setup
- **ComfyUI**: Installed at `/opt/ComfyUI`
- **Python venv**: `/opt/comfyui-env`
- **Models**:
  - Base: `sd_xl_base_1.0.safetensors` (SDXL, 6.5GB) at `/opt/ComfyUI/models/checkpoints/`
  - Fallback: `v1-5-pruned-emaonly.safetensors` (SD 1.5, 4GB) at `/opt/ComfyUI/models/checkpoints/`
  - LoRA: `pixel-art-xl.safetensors` (163MB) at `/opt/ComfyUI/models/loras/`

## Starting ComfyUI
```bash
cd /opt/ComfyUI
/opt/comfyui-env/bin/python main.py --listen 0.0.0.0 --port 8188
```
API available at `http://localhost:8188`

## Workflow Overview
1. **Input**: Text prompt describing the sprite needed
2. **Generation**: SDXL + pixel-art-xl LoRA generates the image
3. **Background Removal**: Alpha channel extraction for transparent backgrounds
4. **Post-processing**: Resize to target resolution, palette normalization
5. **Output**: PNG with transparency, saved to `sprite-gen/output/`
6. **Integration**: Approved sprites copied to `src/assets/sprites/`

## Prompt Templates
- **Character**: `pixel art, game sprite, [character description], transparent background, no background, centered, 2D side view`
- **Mineral/Item**: `pixel art, game item icon, [item description], transparent background, no background, centered, simple`
- **Tileset**: `pixel art, game tileset, [terrain type], seamless, top-down view`
- **UI Element**: `pixel art, game UI, [element description], clean edges, flat design`

## Negative Prompts
`3d render, realistic, photograph, blurry, watermark, text, signature, low quality, deformed`

## Resolution Strategy
- Generation resolution: 1024x1024 (SDXL + pixel-art-xl LoRA)
- Hi-res source of truth: 256x256 (stored in `src/assets/sprites-hires/`)
- Game-ready sizes: 32x32 (items/tiles), 64x64 (characters) — downscaled per platform
- Use nearest-neighbor scaling to preserve pixel art crispness
- 256x256 hi-res allows clean downscale to any target: 128, 64, 32, 16

## Automation
Workflows stored in `sprite-gen/workflows/` as JSON files.
Scripts in `sprite-gen/scripts/` call the ComfyUI API programmatically.
Generated outputs land in `sprite-gen/output/`.

## Camp Cosmetics Pipeline (AR-30)
Camp hub sprite variants are worker-first so generation can run outside local paid APIs.

1. Build prompt/task bundles:
```bash
npm run camp:art:prepare
```
2. External workers generate images named by task id (for example `camp-tent-tier-1.png`) into:
`data/generated/camp-art/worker-output/`
3. Ingest and normalize outputs (PNG + WebP) into game assets:
```bash
npm run camp:art:ingest
```
4. Rebuild manifest only:
```bash
npm run camp:art:manifest
```

Outputs:
- `public/assets/camp/elements/*.webp`
- `public/assets/camp/outfits/*.webp`
- `public/assets/camp/pets/*.webp`
- `public/assets/camp/manifest.json`

## Quality Control
- All generated sprites must be reviewed before adding to `src/assets/`
- Check for: transparent background, consistent palette, correct dimensions
- Rejected sprites are deleted, not committed

---

## Pet Spritesheet Pipeline (Gemini via OpenRouter)

Pet animation spritesheets are generated via `sprite-gen/scripts/generate-pet-spritesheet.mjs`
using the OpenRouter Gemini image API, not ComfyUI.

### Usage
```bash
node sprite-gen/scripts/generate-pet-spritesheet.mjs --species cat --behavior walk
node sprite-gen/scripts/generate-pet-spritesheet.mjs --species owl --behavior idle --frames 6
node sprite-gen/scripts/generate-pet-spritesheet.mjs --species cat --behavior walk --skip-generate
```

### Pipeline Phases
1. **Generate** — Call OpenRouter Gemini with a green-screen prompt (`#00FF00` background).
   Raw image saved to `sprite-gen/output/pets/{species}_{behavior}_raw.png`.
2. **Green-screen removal** — `sprite-gen/lib/green-screen.mjs` removes green pixels.
3. **Checkerboard removal** — `removeCheckerboard()` in the script clears the grey/white
   checker pattern Gemini sometimes outputs instead of true transparency (see below).
4. **Frame splitting** — Blob detection splits the horizontal strip into per-frame buffers.
5. **Bounds** — Content bounding box computed per frame.
6. **Cell centering** — Each frame placed bottom-aligned on a square cell canvas.
7. **Assemble** — Frames composited into a final horizontal spritesheet.
8. **Output** — Writes PNG and WebP to `public/assets/camp/pets/{species}/{behavior}.*`.

### Checkerboard Removal
Gemini outputs alternating ~#CCCCCC / ~#FFFFFF pixels ("checkerboard") as a pseudo-transparency
marker when it cannot produce a true alpha channel. The `removeCheckerboard()` function removes
these after green-screen removal with a pixel-by-pixel scan:

- A pixel is a candidate if: all RGB channels > 180 AND max(R,G,B) - min(R,G,B) < 30
- It is removed (alpha set to 0) if at least 2 of its 4-connected neighbours are either
  already transparent (alpha < 20) OR also grey/white candidates
- This propagates cleanly across the checker grid because adjacent checker pixels always
  qualify each other, and the pattern edge always borders real transparency

### Outputs
- `sprite-gen/output/pets/{species}_{behavior}_raw.png` — raw API response (for reprocessing)
- `public/assets/camp/pets/{species}/{behavior}.png` — final PNG spritesheet
- `public/assets/camp/pets/{species}/{behavior}.webp` — final WebP spritesheet

---

## Pet Spritesheet Recentering Tool

`sprite-gen/scripts/recenter-spritesheet.mjs` reprocesses existing pet spritesheets to fix
centering jitter (cat shifting position between frames) and normalize cat size across all
behaviors so every animation uses the same content height.

### Problem it solves
Spritesheets generated by `generate-pet-spritesheet.mjs` can have:
- Inconsistent frame centering — the cat drifts position frame-to-frame, causing jitter
- Different content heights across behaviors — idle cat looks bigger than sleeping cat

### Usage
```bash
# Reprocess all cat behaviors, normalizing to 50px content height
node sprite-gen/scripts/recenter-spritesheet.mjs --species cat --target-height 50

# Reprocess only the sit animation
node sprite-gen/scripts/recenter-spritesheet.mjs --species cat --behavior sit

# Auto-detect target height from the walk spritesheet average
node sprite-gen/scripts/recenter-spritesheet.mjs --species cat
```

### Options
| Option | Default | Description |
|--------|---------|-------------|
| `--species` | required | Pet species name (e.g. `cat`) |
| `--behavior` | all behaviors | Process only one behavior |
| `--target-height` | walk avg | Target content height in px |
| `--frame-size` | `64` | Output frame cell size in px |

### Algorithm per frame
1. Decode frame to raw RGBA pixels
2. Find tight content bounding box (alpha > 10 threshold)
3. Extract content region
4. Scale to `targetHeight` using nearest-neighbor (preserves pixel art)
5. If scaled width > frameSize, proportionally scale down to fit cell
6. Place on transparent `frameSize × frameSize` canvas:
   - Horizontal: centered (`x = (frameSize - w) / 2`)
   - Vertical: bottom-aligned (`y = frameSize - h - 2px`)

### Frame counts (hardcoded — mirrors `src/data/petAnimations.ts`)
| Behavior | Frames |
|----------|--------|
| idle     | 6      |
| walk     | 8      |
| sit      | 4      |
| lick     | 6      |
| sleep    | 4      |
| react    | 4      |

### Outputs
Overwrites in place:
- `public/assets/camp/pets/{species}/{behavior}.png`
- `public/assets/camp/pets/{species}/{behavior}.webp`
