---
name: depth-transitions
description: Generate depth maps and manage the parallax room transition system. Regenerate depth maps after new/updated room backgrounds, preview transitions, tune shader parameters. PROACTIVELY SUGGEST when new room backgrounds are added or room art is regenerated.
user_invocable: true
---

# Depth Transitions — Parallax Room Transition Manager

## What This Skill Does

Manages the 2.5D parallax room transition system:
1. **Generate depth maps** from room background images using DepthAnythingV2
2. **Preview transitions** via the campsite hub buttons (Enter/Exit)
3. **Tune shader parameters** in `ParallaxTransition.svelte`
4. **Add new room types** to the transition system

## When to Use

- After generating or updating room background art
- When adding new room types that need transitions
- When tuning transition feel (speed, dolly intensity, vignette, walking bob)
- When wiring transitions into actual game flow (not just preview)

## System Architecture

```
Room Background (webp) ──→ DepthAnythingV2 ──→ Depth Map (webp, 5-12KB)
                                                       ↓
                                              ParallaxTransition.svelte
                                              (WebGL fragment shader)
                                                       ↓
                                              Real-time parallax animation
                                              (dolly, zoom, vignette, bob)
```

### Key Files

| File | Purpose |
|------|---------|
| `scripts/generate_depth_maps.py` | Generates depth maps from room backgrounds |
| `src/ui/components/ParallaxTransition.svelte` | WebGL parallax shader component |
| `src/ui/components/HubScreen.svelte` | Preview buttons (Enter/Exit) |
| `public/assets/backgrounds/rooms/*/` | Room backgrounds + depth maps |

### Depth Map Naming Convention

```
public/assets/backgrounds/rooms/{room_type}/
  landscape.webp          ← room background (16:9)
  landscape_depth.webp    ← depth map (grayscale, bright=near)
  portrait.webp           ← room background (9:16)
  portrait_depth.webp     ← depth map (grayscale, bright=near)
```

## Commands

```bash
# Generate depth maps for ALL rooms (descent, mystery, rest, shop, treasure)
python3 scripts/generate_depth_maps.py

# Single room only
python3 scripts/generate_depth_maps.py --room shop

# Single orientation
python3 scripts/generate_depth_maps.py --room shop --orientation landscape

# Force regenerate (overwrite existing)
python3 scripts/generate_depth_maps.py --force

# Dry run (list what would be generated)
python3 scripts/generate_depth_maps.py --dry-run
```

## Three Transition Types

| Type | `uDolly` | `uZoom` | `uBrightness` | Used For |
|------|----------|---------|----------------|----------|
| `enter` | 0.25→0 (pull back to rest) | 1.1→1.0 | 0→1 (fade from black) | Entering any room |
| `exit-forward` | 0→0.5 (push deep forward) | 1.0→1.4 | 1→0 (fade to black) | Leaving combat rooms |
| `exit-backward` | 0→-0.2 (pull backward) | 1.0→0.95 | 1→0 (fade to black) | Leaving non-combat rooms |

## Shader Uniform Reference

| Uniform | Range | Effect |
|---------|-------|--------|
| `uDolly` | -1 to 1 | Parallax intensity. Positive=forward (near objects spread), negative=backward |
| `uHeight` | -0.05 to 0.05 | Vertical offset (walking bob). Animated as sine wave, 4 cycles |
| `uZoom` | 0.5 to 2.0 | Camera zoom. 1.0=normal, >1=zoomed in, <1=zoomed out |
| `uVignette` | 0 to 1 | Edge darkening. 0=none, 1=heavy black edges |
| `uBrightness` | 0 to 1 | Overall brightness. 0=black, 1=normal |

## Key Gotchas

1. **New depth maps need dev server restart** — Vite doesn't pick up new files in `public/` after startup. Restart with `npm run dev`.
2. **Don't set `crossOrigin` on same-origin Image loads** — causes load failures in WebGL texture loading.
3. **Zoom default is 1.0, not 0** — setting zoom to 0 makes the image invisible.
4. **Depth map quality** — DepthAnythingV2 `small` model is sufficient for parallax. Output must be resized to match source image dimensions.

## Workflow: Adding a New Room Type

1. Place `landscape.webp` and `portrait.webp` in `public/assets/backgrounds/rooms/{new_room}/`
2. Run `python3 scripts/generate_depth_maps.py --room {new_room}`
3. Restart dev server (`npm run dev`)
4. Add room ID to the preview button's room list in `HubScreen.svelte` → `randomRoom()`
5. Test with the Enter/Exit buttons on the campsite

## Workflow: Wiring Into Game Flow

The `ParallaxTransition` component is self-contained. To use it in actual game transitions:

```svelte
{#if showTransition}
  <ParallaxTransition
    imageUrl="/assets/backgrounds/rooms/shop/landscape.webp"
    depthUrl="/assets/backgrounds/rooms/shop/landscape_depth.webp"
    type="enter"
    onComplete={() => { showTransition = false }}
    duration={2000}
  />
{/if}
```

Future: overlay a doorway sprite on top of the transition canvas for the "walking through archway" effect.

## Rendering GIFs for Sharing

Script: `scripts/render_transition_gif.py` — renders transition GIFs using the **exact same shader math** as the in-game WebGL component. Uses ffmpeg palette-optimized encoding for quality.

```bash
# Default: 1280px wide, 16fps, shop room, landscape
python3 scripts/render_transition_gif.py --room shop --type enter
python3 scripts/render_transition_gif.py --room shop --type exit-forward

# All options
python3 scripts/render_transition_gif.py \
  --room mystery \
  --type exit-backward \
  --orientation portrait \
  --width 960 \
  --fps 20 \
  --output my_transition.gif
```

| Flag | Default | Notes |
|------|---------|-------|
| `--room` | shop | Any room with depth maps |
| `--type` | enter | `enter`, `exit-forward`, `exit-backward` |
| `--orientation` | landscape | `landscape` or `portrait` |
| `--width` | 1280 | Output width in px (height auto from aspect ratio) |
| `--fps` | 20 | Lower = smaller file, 16-20 looks smooth |
| `--output` | `transition_{type}.gif` | Output path |

**File sizes at 1280px:** ~10-14 MB (GIF limitation). For smaller files, use `--width 960` (~6-8 MB) or `--width 640` (~3-4 MB).
