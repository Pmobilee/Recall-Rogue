---
name: sprite-animate
description: |
  Generate idle animations for game sprites using LTX-2.3 video generation via ComfyUI,
  with automatic background removal to produce transparent WebM and spritesheet PNG files.
  Use when creating or updating enemy animations, generating idle loops, or batch-processing
  sprite animations. PROACTIVELY SUGGEST when new enemy sprites are added or sprite art is updated.
user_invocable: true
---

# Sprite Animate — Idle Animation Generator

## When to Use

- New enemy sprite needs an idle animation
- Updating/regenerating an existing enemy animation
- Batch processing all enemies for animation
- User mentions "animate", "idle animation", "sprite animation", "enemy animation"
- PROACTIVELY suggest when new enemy art is generated via /artstudio

## Quick Commands

```
/sprite-animate rock_hermit.png                    # Generate with auto-prompt
/sprite-animate rock_hermit.png --prompt "..."     # Custom prompt
/sprite-animate --batch deep-caverns               # All enemies in a biome
```

The actual CLI command:
```bash
node sprite-gen/scripts/animate-sprite.mjs \
  --sprite data/generated/enemies/deep-caverns/common/rock_hermit.png \
  --prompt "A hermit crab creature with stone shell and purple crystals..." \
  --duration 3 --seed 42
```

## Prerequisites

- ComfyUI running at localhost:8188 (start from `/Users/damion/CODE/Terry-pron/runtime/comfyui/`)
- Models loaded: LTX-2.3 Q4_K_S GGUF, Gemma 3 fpmixed, all VAEs
- Start ComfyUI: `cd /Users/damion/CODE/Terry-pron/runtime/comfyui && .venv/bin/python main.py --listen 0.0.0.0 --port 8188`

## Pipeline Overview

1. Upload sprite to ComfyUI input
2. Submit LTX-2.3 I2V workflow (512x512, 3s @ 24fps = 73 frames)
3. Poll until generation complete (~3-5 min on M4 Max MPS)
4. Download individual PNG frames
5. Remove background per-frame with rembg (CPU, doesn't compete with MPS)
6. Crop workflow padding (~42px per side)
7. Encode transparent WebM (VP9 + yuva420p)
8. Generate horizontal spritesheet PNG (all frames, with alpha)

## Prompt Engineering Guide

**Template:**
```
A [detailed creature description matching the sprite] facing forward on a solid black background. Idle breathing animation loop.

0-1 seconds: [Primary idle motion — breathing, body rise/fall, energy pulse]. [Creature-specific detail].

1-2 seconds: [Secondary motion — appendage twitch, eye movement, weight shift]. [Brief heightened activity].

2-3 seconds: Returns smoothly to starting pose for seamless loop. Breathing rhythm matches frame 0.

Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background.
```

**Tips:**
- Describe the sprite visually first — LTX-2.3 uses both the image AND text to generate
- Keep motions subtle — large movements will distort the sprite
- Always end with "returns to starting pose for seamless loop"
- The "solid black background" is critical for clean background removal
- Mention specific visual features (crystals glowing, flames flickering, eyes scanning)

**Negative prompt (hardcoded):**
Camera movement, zoom, pan, tilt, background scenery, realistic, 3D render, smooth animation, environment, floor texture, shadows on background, morphing shape, extra limbs, deformation, melting

## Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| --sprite | required | Path to input sprite PNG |
| --prompt | auto-gen | Animation description |
| --duration | 3 | Seconds (2-5 recommended) |
| --width | 512 | Generation width |
| --height | 512 | Generation height |
| --seed | random | Reproducibility seed |
| --name | from filename | Output naming |
| --output-dir | sprite-gen/output/animations | Output location |
| --skip-generate | false | Skip ComfyUI, just post-process |
| --skip-postprocess | false | Skip bg removal + encoding |

## Output Files

```
sprite-gen/output/animations/{name}/
├── raw-frames/          # Original ComfyUI output PNGs
├── rgba-frames/         # Background-removed + cropped PNGs
├── {name}_idle.webm     # Transparent WebM (VP9 + alpha)
├── {name}_idle_sheet.png # Horizontal spritesheet with alpha
└── {name}_idle_preview.mp4 # Preview MP4 (no alpha)
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| OOM during generation | Lower resolution: `--width 384 --height 384`, or reduce duration to 2s |
| Models fail to load | Ensure ComfyUI loaded without errors. Check `/tmp/comfyui-startup.log` |
| Black output frames | Sprite wasn't uploaded — check ComfyUI input/ directory |
| Background removal artifacts | Try different rembg model: edit script to use `isnet-general-use` or `birefnet-general` |
| Edge halos after removal | The script applies 1px alpha erosion; increase if needed |
| "Address already in use" | Kill existing: `lsof -ti:8188 | xargs kill -9` then restart |
| NAG node error | NAG is bypassed in our workflow (GGUF incompatibility). This is expected. |

## Batch Processing

```bash
# Animate all enemies in a biome
for sprite in data/generated/enemies/deep-caverns/**/*.png; do
  node sprite-gen/scripts/animate-sprite.mjs --sprite "$sprite"
done
```

## Technical Details

- **Models**: LTX-2.3 22B distilled Q4_K_S GGUF (~16GB) + Gemma 3 12B fpmixed (~13.7GB)
- **ComfyUI path**: /Users/damion/CODE/Terry-pron/runtime/comfyui/
- **Workflow**: sprite-gen/workflows/ltx-sprite-animate-api.json
- **Script**: sprite-gen/scripts/animate-sprite.mjs
- **VRAM usage**: ~30GB peak (tight on 36GB unified memory)
- **Generation time**: ~3-5 min per sprite on M4 Max MPS
- **Frame count formula**: `1 + 8 * round(duration * fps / 8)` → 73 frames for 3s@24fps

## Integration with Phaser

The spritesheet PNG can be loaded directly:
```typescript
this.load.spritesheet('enemy_idle', 'assets/sprites/enemies/rock_hermit_idle_sheet.png', {
  frameWidth: 428, // 512 - 2*42 padding
  frameHeight: 428
});
```
WebM video textures are also possible via `this.load.video()` but spritesheet is more reliable cross-platform.
