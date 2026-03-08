# Phase 29: Character Animation System

## Overview

**Goal**: Replace the current single-frame miner sprite with a fully animated character system — directional walk cycles, pickaxe swing animations, idle breathing, hurt flashing, and a gear overlay pipeline (pickaxe tier icon, relic glow aura, companion badge). All animations are driven by the existing tick-based input loop; no new timing primitives are introduced.

**Why this phase matters**: The miner sprite is the player's visual avatar for every second of gameplay. Currently it is a static image that teleports between tiles. Animating it converts the mechanical feel of mining into a kinetic, satisfying rhythm and makes the pickaxe tier and companion systems visually legible at a glance.

**Dependencies (must be complete before starting)**:
- Phase 7 Visual Engine (autotiling, `AnimationSystem.ts`, `MinerAnimController` class) — already scaffolded but the sprite sheet it expects does not yet exist
- Phase 8 Mine Gameplay Overhaul (tick system, `handleMoveOrMine`, `handleMineAction`) — drives animation state transitions
- Phase 9 Biome Expansion (biome particle manager) — particles hook into the `mineSwing` animation event added in 29.3
- Phase 10 Dome Hub Redesign (DivePrepScreen character preview uses 256px hi-res frames from 29.5)

**Estimated complexity**: High. Involves ComfyUI sprite generation (48 frames across 9 animation strips), extending the existing `MinerAnimController` and `AnimationSystem`, adding a `GearOverlaySystem`, and updating `MineScene` player rendering. The hardest part is producing a pixel-art character that looks consistent across all poses at 32×48 px — the ComfyUI prompts must be anchored to a strict reference.

**Design decisions governing this phase**:
- **DD-V2-011**: Full character animation — 8 sprite sheets: idle, walk 4 directions, mine 3 directions
- **DD-V2-248**: Gear overlay icons on miner sprite — pickaxe tier, active relic glow, companion badge
- **DD-V2-249**: Compressed swing model — damage registers on input immediately; animation is pure visual feedback
- **DD-V2-250**: 6 walk frames per direction, 5–6 mining frames per direction (~48 total)

---

## Sub-Phases

---

### 29.1 — Miner Sprite Sheet Design & Generation

**Goal**: Produce all animation frames as a single sprite sheet (`miner_sheet.png`) at 32×48 px per frame, plus a 256×384 px hi-res version. Use ComfyUI with the project's SDXL + pixel-art LoRA workflow.

#### 29.1.1 — Frame Layout Specification

The sprite sheet is a **horizontal strip** where every frame is exactly **32 px wide × 48 px tall** (2:3 ratio — wider than a tile to accommodate the pickaxe and allow head room above the feet anchor). The file dimensions are:

```
Total frames : 52
Sheet width  : 52 × 32 = 1664 px
Sheet height : 48 px
```

Frame index table (0-based, left to right):

| Frames   | Animation   | Count | Notes |
|----------|-------------|-------|-------|
| 0–3      | idle        | 4     | Breathing cycle, front-facing (facing down) |
| 4–9      | walk_down   | 6     | Toward camera |
| 10–15    | walk_up     | 6     | Away from camera |
| 16–21    | walk_left   | 6     | Left-facing profile |
| 22–27    | walk_right  | 6     | Mirror of walk_left (can be generated or flipped) |
| 28–33    | mine_down   | 6     | Overhead swing, block below |
| 34–39    | mine_left   | 6     | Side swing, block to the left |
| 40–45    | mine_right  | 6     | Mirror of mine_left (can be flipped) |
| 46–51    | (reserved)  | 6     | Hurt + layer-fall; generated in 29.2 extensions |

> NOTE: The existing `AnimationSystem.ts` (line 27-32) uses a slightly different layout with 8-frame mine strips and 52 total frames. Phase 29 **replaces** that layout with the 6-frame-per-strip design (DD-V2-250). `AnimationSystem.ts` will be updated in 29.2 to match this new layout. The frame indices above are the authoritative source of truth after this phase.

#### 29.1.2 — Color Palette Constraint

The base miner uses a **maximum of 16 colors** (excluding full transparency). This is a hard constraint for the pixel-art aesthetic and ensures the character reads cleanly at 32 px.

Palette reference (to remain consistent across ALL frames — deviation causes a noticeable color shift between animations):

```
TRANSPARENT : #00000000  (alpha = 0)
SKIN_DARK   : #8B5E3C    (shadow side of face/hands)
SKIN_MID    : #C68642    (main skin tone)
SKIN_LIGHT  : #E8A87C    (highlight)
SUIT_DARK   : #1A2E4A    (shadow side of suit)
SUIT_MID    : #2D5382    (main suit color — deep blue)
SUIT_LIGHT  : #4A7EC7    (highlight on suit)
SUIT_ACCENT : #00CCFF    (visor glow, trim)
BOOT_DARK   : #1C1C1C    (boot shadow)
BOOT_MID    : #3D3D3D    (boot main)
HELMET_DARK : #1A2E4A    (helmet shadow, matches suit)
HELMET_MID  : #2D5382    (helmet main, matches suit)
VISOR       : #00CCFF    (visor glass — same as accent)
PICK_DARK   : #5C4033    (wooden handle shadow)
PICK_MID    : #8B6142    (wooden handle main)
PICK_HEAD   : #9A9A9A    (metal pickaxe head)
```

#### 29.1.3 — Per-Animation Frame Breakdown

**Idle (frames 0–3)**: Character faces the camera (walk_down pose). Subtle breathing — the torso and helmet shift up 1 px on frames 1 and 3; arms hang at sides. Pickaxe rests against the right shoulder. Eyes (visor) blink on frame 3 (visor goes 50% opacity).

```
Frame 0: neutral stand, visor full
Frame 1: inhale — body up 1 px
Frame 2: exhale — body back to baseline
Frame 3: exhale-blink — body at baseline, visor 50% opacity
```

**Walk Down (frames 4–9)**: Camera-facing walk cycle. Left leg forward → right leg forward. Arms swing opposite to legs. Pickaxe bounces slightly on the right shoulder.

```
Frame 4: right foot forward, left arm forward, body at baseline
Frame 5: mid-stride right, body up 1 px (bounce)
Frame 6: feet together, body down 1 px (ground contact)
Frame 7: left foot forward, right arm forward, body at baseline
Frame 8: mid-stride left, body up 1 px
Frame 9: feet together, body down 1 px
```

**Walk Up (frames 10–15)**: Back of character faces camera. Helmet and backpack visible. Same leg rhythm as walk_down but only back of suit visible. Pickaxe visible on right shoulder from behind.

**Walk Left (frames 16–21)**: Left-profile view. Full side silhouette. Left arm/leg lead. The pickaxe rests at the right hip and is barely visible. Hair/helmet edge visible. This is the **reference strip** — walk_right is a horizontal mirror.

```
Frame 16: right foot back, left leg forward (landing)
Frame 17: left leg mid-stride, slight body dip
Frame 18: stride completion, feet together
Frame 19: right leg begins forward (crossing)
Frame 20: right leg mid-stride, body up 1 px
Frame 21: right foot landing
```

**Walk Right (frames 22–27)**: Horizontal mirror of walk_left frames 16–21. Generated by `--flipX` flag in ComfyUI or a post-process PIL script. The sprite sheet stores all frames explicitly (do not rely on Phaser's `flipX` at runtime to avoid z-order issues with overlays).

**Mine Down (frames 28–33)**: Overhead chop swing into the block below (south). Pickaxe is raised high above the head on frame 0–2 (wind-up) and slams down through frames 3–5 (impact + recovery). The character faces the camera.

```
Frame 28: neutral stance, pickaxe at hip (pre-swing)
Frame 29: pickaxe raised to chest level
Frame 30: pickaxe fully extended overhead (peak wind-up)
Frame 31: pickaxe swinging down, body leans forward   ← IMPACT FRAME (frame 3 of strip)
Frame 32: pickaxe at impact point, dust particle cue
Frame 33: pickaxe returns to neutral, character stands
```

> CRITICAL (DD-V2-249): Damage to the block is registered on the **input event** (immediately when the player taps), not when the animation reaches the impact frame. The animation is pure visual feedback. Frame 31 (index 3 within the strip) emits the `mineSwing` Phaser event for particle and screen-shake triggering, but the block's hardness was already decremented.

**Mine Left (frames 34–39)**: Side swing into a block to the left. Character in left profile. Pickaxe comes from a high-right → swings left and down.

```
Frame 34: neutral left profile, pickaxe at right hip
Frame 35: weight shifts right, pickaxe raises to shoulder
Frame 36: full wind-up — pickaxe above and behind head
Frame 37: swing initiation — pickaxe arcing left         ← IMPACT FRAME (frame 3 of strip)
Frame 38: pickaxe at impact point, arm fully extended left
Frame 39: recovery — pickaxe returns, weight settles
```

**Mine Right (frames 40–45)**: Horizontal mirror of mine_left. Generated in post-process.

**Reserved (frames 46–51)**: Hurt flash and layer-fall. Generated in sub-step 29.2 extensions.

```
Frame 46: hurt — character flashes bright white (alpha preserved), stumbles back 2 px
Frame 47: hurt recovery — body back to center, red tint
Frame 48–51: layer-fall — character in free-fall pose, arms and legs spread (4 frames, looping)
```

#### 29.1.4 — ComfyUI Generation Workflow

The ComfyUI server runs locally at `http://localhost:8188`. Use the project's SDXL + pixel-art LoRA. Reference the pipeline in `docs/SPRITE_PIPELINE.md`.

**Step 1 — Generate reference character (1024×1024 SDXL)**

Use this prompt for the base reference character that ALL animation strips will be anchored to:

```
Positive prompt:
pixel art character, space miner, retro video game sprite, deep blue space suit with cyan visor glow,
helmet with integrated flashlight, brown leather work boots, stocky proportions, holding wooden handled
pickaxe, front facing, idle pose, flat 2d sprite, black outline, 16 color palette,
clean pixel art, 8-bit, detailed shading, neutral background, white background, transparent background

Negative prompt:
3d, realistic, photorealistic, gradient, anti-aliasing, blurry, soft edges, too many colors,
watermark, text, complex background, low quality, ugly, deformed, extra limbs

Model       : SDXL 1.0 + pixel-art LoRA (weight 0.85)
Resolution  : 1024×1024
Steps       : 30
CFG scale   : 7.0
Sampler     : DPM++ 2M Karras
Seed        : 42 (fix this seed — all animation strips must use the same base seed to ensure character consistency)
```

**Step 2 — Remove background with rembg**

```python
# Run in ComfyUI's rembg node or via CLI:
# rembg i reference_miner.png reference_miner_transparent.png
# Verify: the 16 colors are preserved, no color fringing
```

**Step 3 — Generate each animation strip as 1024×1536 px (32 frames at 1024×48 each, stacked)**

For each animation, use img2img with the reference character at strength 0.45 to preserve proportions while allowing pose variation. The workflow generates 6 candidate frames, which are manually selected and refined.

**Walk Down strip prompt** (img2img from reference, strength 0.45):
```
Positive: pixel art character sprite, space miner walk cycle, facing camera, walking forward,
legs alternating, arm swing, 6 frames, sequential animation, deep blue space suit, pixel art,
8-bit, flat sprite, consistent character, front view, walking animation frames

Negative: static, idle, background, 3d, realistic, blurry
```

**Walk Up strip prompt** (img2img, strength 0.50):
```
Positive: pixel art character sprite, space miner walk cycle, walking away from camera, back view,
helmet visible from behind, backpack, deep blue space suit, 6 frames, rear walking animation,
pixel art, 8-bit, flat sprite

Negative: front view, idle, background, 3d, realistic
```

**Walk Left strip prompt** (img2img, strength 0.50):
```
Positive: pixel art character sprite, space miner walk cycle, walking left, side profile view,
left facing, full side silhouette, deep blue space suit, helmet side view, 6 frames,
side-scrolling walk animation, pixel art, 8-bit, flat sprite

Negative: front view, rear view, idle, background, 3d, realistic
```

**Mine Down strip prompt** (img2img, strength 0.40 — needs more pose deviation):
```
Positive: pixel art character sprite, space miner swing animation, swinging pickaxe downward,
overhead chop, wind-up to impact sequence, deep blue space suit, 6 frames, mining animation,
pickaxe raised overhead then swings down, pixel art, 8-bit, flat sprite, front view

Negative: idle, walking, side view, background, 3d, realistic
```

**Mine Left strip prompt** (img2img, strength 0.40):
```
Positive: pixel art character sprite, space miner swing animation, swinging pickaxe to the left,
side profile, pickaxe arc from right shoulder to left impact, 6 frames, side mining animation,
deep blue space suit, pixel art, 8-bit

Negative: idle, walking, front view, rear view, background, 3d, realistic
```

**Hurt + Fall strip prompt** (img2img, strength 0.55):
```
Positive: pixel art character sprite, space miner hurt animation, stumbling back, white flash frame,
then free-fall pose arms spread, 6 frames, pixel art, 8-bit, deep blue space suit,
damage reaction animation, falling animation

Negative: idle, walking, mining, background, 3d, realistic
```

**Step 4 — Post-process all strips**

Use the Python script at `sprite-gen/stitch_miner_sheet.py` (created in step 29.1.5):

```
1. Load all 9 strips (idle + 4 walks + 3 mines + hurt_fall)
2. Crop each strip to exactly N×6 frames at 32×48 each
3. Flip walk_left → walk_right (horizontal mirror)
4. Flip mine_left → mine_right (horizontal mirror)
5. Stitch horizontally into a single 1664×48 sheet
6. Quantize to 16 colors (pillow ImageDraw.quantize, palette from §29.1.2)
7. Save as PNG with full alpha transparency
8. Output: src/assets/sprites/miner_sheet.png
```

For the hi-res 256px variant (step 29.5), scale each frame up 8× with nearest-neighbor sampling before stitching:

```
Output: src/assets/sprites-hires/miner_sheet.png  (13312×384 px)
```

#### 29.1.5 — Sprite Sheet Stitch Script

Create `sprite-gen/stitch_miner_sheet.py`:

```python
"""
stitch_miner_sheet.py
---------------------
Stitches individual animation strip PNGs into a single horizontal
miner_sheet.png compatible with Phaser's spritesheet loader.

Usage:
  python stitch_miner_sheet.py --strips_dir /tmp/miner_strips --out src/assets/sprites/miner_sheet.png
  python stitch_miner_sheet.py --strips_dir /tmp/miner_strips --out src/assets/sprites-hires/miner_sheet.png --hires

Frame layout (see PHASE-29-CHARACTER-ANIMATION.md §29.1.1):
  idle (4) | walk_down (6) | walk_up (6) | walk_left (6) | walk_right (6) |
  mine_down (6) | mine_left (6) | mine_right (6) | hurt_fall (6) = 52 total
"""

import argparse
from pathlib import Path
from PIL import Image

FRAME_W = 32
FRAME_H = 48
HIRES_SCALE = 8  # 32→256, 48→384

# Strip names in stitching order, with their expected frame count
STRIPS = [
    ('idle',       4),
    ('walk_down',  6),
    ('walk_up',    6),
    ('walk_left',  6),
    ('walk_right', 6),   # will be generated by mirroring walk_left
    ('mine_down',  6),
    ('mine_left',  6),
    ('mine_right', 6),   # will be generated by mirroring mine_left
    ('hurt_fall',  6),
]

TOTAL_FRAMES = sum(count for _, count in STRIPS)


def load_strip(path: Path, frame_count: int, w: int, h: int) -> list[Image.Image]:
    """Load a horizontal strip image and return a list of frame Images."""
    strip = Image.open(path).convert('RGBA')
    frames = []
    for i in range(frame_count):
        frame = strip.crop((i * w, 0, (i + 1) * w, h))
        frames.append(frame)
    return frames


def mirror_frames(frames: list[Image.Image]) -> list[Image.Image]:
    """Horizontally flip a list of frames (for walk_right and mine_right)."""
    return [f.transpose(Image.FLIP_LEFT_RIGHT) for f in frames]


def stitch(strips_dir: Path, out_path: Path, hires: bool = False) -> None:
    w = FRAME_W * (HIRES_SCALE if hires else 1)
    h = FRAME_H * (HIRES_SCALE if hires else 1)

    all_frames: list[Image.Image] = []

    for name, count in STRIPS:
        if name == 'walk_right':
            # Mirror walk_left instead of loading a separate file
            left_path = strips_dir / ('walk_left_hires.png' if hires else 'walk_left.png')
            left_frames = load_strip(left_path, 6, w, h)
            all_frames.extend(mirror_frames(left_frames))
            continue

        if name == 'mine_right':
            # Mirror mine_left instead of loading a separate file
            left_path = strips_dir / ('mine_left_hires.png' if hires else 'mine_left.png')
            left_frames = load_strip(left_path, 6, w, h)
            all_frames.extend(mirror_frames(left_frames))
            continue

        suffix = '_hires' if hires else ''
        strip_path = strips_dir / f'{name}{suffix}.png'
        if not strip_path.exists():
            raise FileNotFoundError(f'Missing strip: {strip_path}')

        frames = load_strip(strip_path, count, w, h)
        all_frames.extend(frames)

    assert len(all_frames) == TOTAL_FRAMES, \
        f'Expected {TOTAL_FRAMES} frames, got {len(all_frames)}'

    # Stitch horizontally
    sheet = Image.new('RGBA', (w * TOTAL_FRAMES, h), (0, 0, 0, 0))
    for i, frame in enumerate(all_frames):
        sheet.paste(frame, (i * w, 0))

    # Quantize to 16 colors (preserves alpha)
    # Note: PIL quantize drops alpha; workaround: quantize RGB then restore alpha
    rgb = sheet.convert('RGB')
    quantized_rgb = rgb.quantize(colors=16, method=Image.Quantize.MEDIANCUT)
    quantized_rgb = quantized_rgb.convert('RGB')
    alpha = sheet.split()[3]
    quantized_rgba = Image.merge('RGBA', (*quantized_rgb.split(), alpha))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    quantized_rgba.save(out_path, 'PNG')
    print(f'Saved: {out_path}  ({sheet.width}×{sheet.height} px, {TOTAL_FRAMES} frames)')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--strips_dir', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--hires', action='store_true', help='Build 256px hi-res sheet')
    args = parser.parse_args()
    stitch(args.strips_dir, args.out, args.hires)


if __name__ == '__main__':
    main()
```

#### 29.1.6 — Acceptance Criteria for 29.1

- [ ] `src/assets/sprites/miner_sheet.png` exists: 1664×48 px, 52 frames, PNG with alpha
- [ ] `src/assets/sprites-hires/miner_sheet.png` exists: 13312×384 px, 52 frames
- [ ] Palette quantized to ≤16 colors per frame (verify with `python -c "from PIL import Image; img = Image.open('src/assets/sprites/miner_sheet.png').convert('RGB'); print(len(set(img.getdata())))"`)
- [ ] No color fringing around transparent edges (rembg pass verified)
- [ ] `sprite-gen/stitch_miner_sheet.py` is committed and documented
- [ ] Walk_right and mine_right frames are visually correct mirrors of their left counterparts
- [ ] All 9 animation strips are visually consistent (same character proportions, same color palette)

---

### 29.2 — Animation State Machine

**Goal**: Extend `src/game/systems/AnimationSystem.ts` to match the new 52-frame layout from 29.1, add the `hurt` and `fall` states, introduce a priority queue for state transitions, and make the state machine the single source of truth for what the miner sprite is currently displaying.

#### 29.2.1 — Updated Frame Layout Constants

Replace the contents of `src/game/systems/AnimationSystem.ts` with the following complete implementation. This file is the authoritative source — do not split constants between files.

```typescript
// src/game/systems/AnimationSystem.ts
// Phase 29: Character Animation System
// Implements DD-V2-011, DD-V2-249, DD-V2-250

import Phaser from 'phaser'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * All possible animation states for the miner character.
 * Priority order (highest first): hurt > fall > mine_* > walk_* > idle
 */
export type MinerAnimState =
  | 'idle'
  | 'walk_down' | 'walk_up' | 'walk_left' | 'walk_right'
  | 'mine_down' | 'mine_left' | 'mine_right'
  | 'hurt'
  | 'fall'

export type FacingDir = 'left' | 'right' | 'up' | 'down'

/** Priority values — higher number wins when two states compete. */
const STATE_PRIORITY: Record<MinerAnimState, number> = {
  idle:       0,
  walk_down:  1,
  walk_up:    1,
  walk_left:  1,
  walk_right: 1,
  mine_down:  2,
  mine_left:  2,
  mine_right: 2,
  fall:       3,
  hurt:       4,
}

export interface AnimFrameConfig {
  /** Phaser animation key (also used as texture atlas key in Phaser's AnimationManager). */
  key: MinerAnimState
  /** Start frame index in the horizontal sprite sheet (0-based). */
  startFrame: number
  /** Number of frames in this animation strip. */
  frameCount: number
  /** Frames per second. */
  frameRate: number
  /** -1 = loop indefinitely, 0 = play once then stop. */
  repeat: number
}

// ---------------------------------------------------------------------------
// Frame Layout (matches PHASE-29-CHARACTER-ANIMATION.md §29.1.1)
// ---------------------------------------------------------------------------

/**
 * Sprite sheet: horizontal strip, each frame 32×48 px.
 * Total: 52 frames → sheet is 1664×48 px at 32px resolution, 13312×384 px at 256px.
 *
 * Frame index map:
 *   0–3   idle       (4 frames)
 *   4–9   walk_down  (6 frames)
 *   10–15 walk_up    (6 frames)
 *   16–21 walk_left  (6 frames)
 *   22–27 walk_right (6 frames — mirrored from walk_left in stitch script)
 *   28–33 mine_down  (6 frames)
 *   34–39 mine_left  (6 frames)
 *   40–45 mine_right (6 frames — mirrored from mine_left in stitch script)
 *   46–47 hurt       (2 frames — stumble back + recovery)
 *   48–51 fall       (4 frames — freefall loop)
 */
export const ANIM_CONFIGS: AnimFrameConfig[] = [
  // Idle: gentle breathing loop at 5 fps
  { key: 'idle',       startFrame: 0,  frameCount: 4, frameRate: 5,  repeat: -1 },

  // Walk cycles: 6 frames at 10 fps (one full stride every 0.6 s)
  { key: 'walk_down',  startFrame: 4,  frameCount: 6, frameRate: 10, repeat: -1 },
  { key: 'walk_up',    startFrame: 10, frameCount: 6, frameRate: 10, repeat: -1 },
  { key: 'walk_left',  startFrame: 16, frameCount: 6, frameRate: 10, repeat: -1 },
  { key: 'walk_right', startFrame: 22, frameCount: 6, frameRate: 10, repeat: -1 },

  // Mine swings: 6 frames at 14 fps (one swing every ~0.43 s)
  // repeat: 0 = play once then stop (triggers onComplete for buffered input)
  { key: 'mine_down',  startFrame: 28, frameCount: 6, frameRate: 14, repeat: 0 },
  { key: 'mine_left',  startFrame: 34, frameCount: 6, frameRate: 14, repeat: 0 },
  { key: 'mine_right', startFrame: 40, frameCount: 6, frameRate: 14, repeat: 0 },

  // Hurt: 2 frames at 12 fps, play once
  { key: 'hurt',       startFrame: 46, frameCount: 2, frameRate: 12, repeat: 0 },

  // Fall: 4 frames at 8 fps, loop while falling
  { key: 'fall',       startFrame: 48, frameCount: 4, frameRate: 8,  repeat: -1 },
]

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Map a movement delta to the appropriate walk animation state.
 *
 * @param dx - Horizontal movement delta (negative = left, positive = right)
 * @param dy - Vertical movement delta (negative = up, positive = down)
 * @returns The walk animation state that matches the direction of movement
 */
export function getWalkState(dx: number, dy: number): MinerAnimState {
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx < 0 ? 'walk_left' : 'walk_right'
  }
  return dy < 0 ? 'walk_up' : 'walk_down'
}

/**
 * Map the delta from player to target block to the appropriate mine animation state.
 * Mining upward is not possible in the current game design (DD-V2-011), so only
 * mine_down, mine_left, mine_right are produced.
 *
 * @param dx - Horizontal delta from player to target block
 * @param dy - Vertical delta (positive = block is below; negative = block is above)
 * @returns The mine animation state that matches the swing direction
 */
export function getMineState(dx: number, dy: number): MinerAnimState {
  if (dx < 0) return 'mine_left'
  if (dx > 0) return 'mine_right'
  return 'mine_down'   // dy > 0 (block below) or dy < 0 (mining upward falls back to mine_down)
}

// ---------------------------------------------------------------------------
// MinerAnimController
// ---------------------------------------------------------------------------

/**
 * State machine controller for the miner character sprite.
 *
 * Wraps a Phaser.GameObjects.Sprite and enforces animation priority rules:
 *   hurt > fall > mine_* > walk_* > idle
 *
 * The compressed swing model (DD-V2-249):
 *   - Mining damage is applied on input, before any animation plays
 *   - setMine() starts the visual-only animation AFTER damage is registered
 *   - The `mineSwingFrame` event is emitted at frame 3 of each mine strip for
 *     particle and screen-shake triggers (see 29.3)
 *
 * Usage in MineScene.create():
 *   this.animController = new MinerAnimController(this.playerSprite)
 *   this.animController.registerAnims(this)
 *   this.animController.setIdle()
 *
 * Usage in handleMoveOrMine():
 *   // After moving:
 *   this.animController.setWalk(dx, dy)
 *   // After mining (damage already applied):
 *   this.animController.setMine(dx, dy, () => this.onMineAnimComplete())
 */
export class MinerAnimController {
  private currentState: MinerAnimState = 'idle'
  private isMiningAnim = false
  private isFalling = false
  private isHurt = false

  constructor(private sprite: Phaser.GameObjects.Sprite) {}

  // -------------------------------------------------------------------------
  // Registration
  // -------------------------------------------------------------------------

  /**
   * Registers all animation configs on the Phaser scene's AnimationManager.
   * Safe to call multiple times — skips existing keys.
   * Must be called after `miner_sheet` spritesheet is loaded (in MineScene.create()).
   *
   * @param scene - The Phaser scene whose AnimationManager will store the configs
   */
  registerAnims(scene: Phaser.Scene): void {
    for (const cfg of ANIM_CONFIGS) {
      if (scene.anims.exists(cfg.key)) continue

      const frames = scene.anims.generateFrameNumbers('miner_sheet', {
        start: cfg.startFrame,
        end: cfg.startFrame + cfg.frameCount - 1,
      })

      scene.anims.create({
        key: cfg.key,
        frames,
        frameRate: cfg.frameRate,
        repeat: cfg.repeat,
      })
    }
  }

  // -------------------------------------------------------------------------
  // State transitions
  // -------------------------------------------------------------------------

  /**
   * Transition to idle state.
   * No-ops if already idle or if a higher-priority animation is playing.
   */
  setIdle(): void {
    if (!this.canTransitionTo('idle')) return
    this.currentState = 'idle'
    this.isMiningAnim = false
    this.sprite.play('idle', true)
  }

  /**
   * Trigger walk animation for the given movement delta.
   * No-ops if the sprite is already playing the matching walk animation,
   * or if a higher-priority animation is playing.
   *
   * @param dx - Horizontal movement delta
   * @param dy - Vertical movement delta
   */
  setWalk(dx: number, dy: number): void {
    const state = getWalkState(dx, dy)
    if (!this.canTransitionTo(state)) return
    if (this.currentState === state) return  // already playing this direction
    this.currentState = state
    this.isMiningAnim = false
    this.sprite.play(state, true)
  }

  /**
   * Trigger a mine animation for a mining action (DD-V2-249).
   * Always restarts the animation even if the same direction is already playing,
   * because each tap should produce a fresh swing from frame 0.
   * The `mineSwingFrame` event is emitted at animation frame 3 (see 29.3).
   *
   * Calling code MUST apply block damage BEFORE calling setMine().
   *
   * @param dx - Delta X from player to target block
   * @param dy - Delta Y from player to target block
   * @param onComplete - Called when the full mine animation finishes; use this to
   *                     flush buffered input or re-enable input gating
   */
  setMine(dx: number, dy: number, onComplete?: () => void): void {
    const state = getMineState(dx, dy)
    // Mine always overrides walk; only hurt and fall can override mine
    if (this.isHurt || this.isFalling) return

    this.currentState = state
    this.isMiningAnim = true
    this.sprite.play(state, true)

    if (onComplete) {
      this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        this.isMiningAnim = false
        onComplete()
      })
    }
  }

  /**
   * Trigger the hurt flash animation.
   * Overrides all states except another in-progress hurt.
   * Automatically reverts to idle when the animation completes.
   */
  setHurt(): void {
    if (this.isHurt) return  // already hurting — don't restart
    this.isHurt = true
    this.isMiningAnim = false
    this.currentState = 'hurt'
    this.sprite.play('hurt', true)
    this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.isHurt = false
      this.setIdle()
    })
  }

  /**
   * Start the fall loop animation (used during layer descent shaft transitions).
   * Loop runs until stopFall() is called.
   */
  startFall(): void {
    if (this.isFalling) return
    this.isFalling = true
    this.isHurt = false
    this.isMiningAnim = false
    this.currentState = 'fall'
    this.sprite.play('fall', true)
  }

  /**
   * Stop the fall animation and return to idle.
   */
  stopFall(): void {
    if (!this.isFalling) return
    this.isFalling = false
    this.setIdle()
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  /** True while a mine animation is playing (use to gate input). */
  get isPlayingMineAnim(): boolean {
    return this.isMiningAnim
  }

  /** True while the hurt animation is playing. */
  get isPlayingHurt(): boolean {
    return this.isHurt
  }

  /** True while the fall loop is playing. */
  get isPlayingFall(): boolean {
    return this.isFalling
  }

  /** The current animation state key. */
  get state(): MinerAnimState {
    return this.currentState
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Returns true if a transition to `targetState` is allowed given the
   * priority of the currently playing state.
   */
  private canTransitionTo(targetState: MinerAnimState): boolean {
    return STATE_PRIORITY[targetState] >= STATE_PRIORITY[this.currentState]
      || !this.isMiningAnim && !this.isHurt && !this.isFalling
  }
}
```

#### 29.2.2 — Hurt State Integration with HazardSystem

The `setHurt()` method must be called from `MineScene` whenever the player takes hazard damage. Locate the methods `handleLavaContact()` and `handleGasContact()` in `MineScene.ts` and add the animation trigger:

```typescript
// In MineScene.ts — handleLavaContact()
private handleLavaContact(): void {
  // existing damage logic ...
  this.animController?.setHurt()    // ← ADD THIS LINE
  // existing ...
}

// In MineScene.ts — handleGasContact()
private handleGasContact(): void {
  // existing damage logic ...
  this.animController?.setHurt()    // ← ADD THIS LINE
  // existing ...
}
```

#### 29.2.3 — Fall State Integration with Layer Transition

When the player steps onto a `DescentShaft` block, there is a brief transition animation before the new layer loads. Find the descent-shaft interaction in `MineScene.handleMoveOrMine()` and wrap it:

```typescript
// Pseudocode — locate the actual descent-shaft branch in handleMoveOrMine
if (targetCell.type === BlockType.DescentShaft) {
  this.animController?.startFall()
  // existing: await layer transition / scene restart
  // The stopFall() call happens in MineScene.create() → animController.setIdle()
  // because create() constructs a new MinerAnimController for the new layer
}
```

#### 29.2.4 — Acceptance Criteria for 29.2

- [ ] `src/game/systems/AnimationSystem.ts` updated: new 52-frame layout, `hurt` and `fall` states defined
- [ ] `MinerAnimController.setHurt()` called on lava and gas contact events
- [ ] `MinerAnimController.startFall()` called on DescentShaft interaction
- [ ] Priority system prevents walk from interrupting a mine swing; hurt always wins
- [ ] `npm run typecheck` passes with zero new errors

---

### 29.3 — Phaser Animation Integration & `mineSwing` Event

**Goal**: Wire the updated `AnimationSystem.ts` into Phaser's `AnimationManager`, configure the sprite's display size and anchor for the 32×48 frame, and emit the `mineSwingFrame` event at frame 3 of each mine strip (used by `ParticleSystem` and `ImpactSystem` for particle bursts and screen-shake timing).

#### 29.3.1 — Spritesheet Loader Update

In `MineScene.preload()`, the existing loader at line 260–265 already loads `miner_sheet` as a spritesheet. Update it to use the new 32×48 frame dimensions:

```typescript
// In MineScene.preload() — REPLACE the existing miner_sheet loader block:
const minerSheetKey = 'miner_sheet'
if (spriteUrls[minerSheetKey]) {
  this.load.spritesheet(minerSheetKey, spriteUrls[minerSheetKey], {
    frameWidth:  resolution === 'high' ? 256 : 32,
    frameHeight: resolution === 'high' ? 384 : 48,   // ← was 32/256; now 48/384
  })
}
```

#### 29.3.2 — Sprite Anchor and Display Size

The player sprite anchor must be set to the **bottom-center** of the frame so that the character's feet align with the tile grid. The extra 16 px of height above the tile is the helmet/head space.

In `MineScene.create()`, after the sprite is created:

```typescript
// In MineScene.create() — REPLACE the existing playerSprite setup block (lines 350-367):
const startPx = startX * TILE_SIZE + TILE_SIZE * 0.5
const startPy = startY * TILE_SIZE + TILE_SIZE          // bottom of the tile, not center

if (this.textures.exists('miner_sheet')) {
  this.playerSprite = this.add.sprite(startPx, startPy, 'miner_sheet', 0)
} else {
  this.playerSprite = this.add.sprite(startPx, startPy, 'miner_idle')
}

// Anchor at feet (bottom-center)
this.playerSprite.setOrigin(0.5, 1.0)

// Display at 1:1 with the tile width; height is 1.5× to accommodate the 32×48 frame
this.playerSprite.setDisplaySize(TILE_SIZE, TILE_SIZE * 1.5)  // 32×48 at 32px tile size
this.playerSprite.setDepth(10)

// Visual tracking variables use the BOTTOM of the tile as the Y reference
this.playerVisualX = startPx
this.playerVisualY = startY * TILE_SIZE + TILE_SIZE   // bottom of tile
```

#### 29.3.3 — drawPlayer() Update

The `drawPlayer()` method lerps the visual position toward the logical grid position. Update it to match the new bottom-anchor reference:

```typescript
// In MineScene.ts — REPLACE drawPlayer():
private drawPlayer(): void {
  const targetX = this.player.gridX * TILE_SIZE + TILE_SIZE * 0.5
  const targetY = this.player.gridY * TILE_SIZE + TILE_SIZE   // bottom of target tile

  this.playerVisualX += (targetX - this.playerVisualX) * this.MOVE_LERP
  this.playerVisualY += (targetY - this.playerVisualY) * this.MOVE_LERP

  // Snap if within 1px to avoid floating-point drift
  if (Math.abs(this.playerVisualX - targetX) < 1) this.playerVisualX = targetX
  if (Math.abs(this.playerVisualY - targetY) < 1) this.playerVisualY = targetY

  this.playerSprite.setPosition(this.playerVisualX, this.playerVisualY)
}
```

#### 29.3.4 — `mineSwingFrame` Event Emission

Phaser's `AnimationManager` emits `Phaser.Animations.Events.ANIMATION_UPDATE` on every frame. Listen for frame index 3 of each mine animation and re-emit a custom `mineSwingFrame` event on the scene's event bus. This decouples the particle system from knowing about animation timing.

Add this method to `MineScene` and call it from `create()`:

```typescript
// In MineScene.ts — add new method:
/**
 * Registers per-frame animation listeners that emit 'mineSwingFrame' at peak impact.
 * Called once from create() after animController.registerAnims().
 * The 'mineSwingFrame' event signals particle emitters and screen shake to trigger.
 *
 * Design (DD-V2-249): damage is applied on input; this event is for visual feedback only.
 */
private setupMineSwingFrameEvent(): void {
  // Frame 3 of the mine strip is the "impact moment" (pickaxe fully extended)
  const SWING_FRAME_INDEX_IN_STRIP = 3

  this.playerSprite.on(
    Phaser.Animations.Events.ANIMATION_UPDATE,
    (
      _anim: Phaser.Animations.Animation,
      frame: Phaser.Animations.AnimationFrame,
      _sprite: Phaser.GameObjects.Sprite
    ) => {
      // Check if this is a mine animation (starts at frame 28, 34, or 40)
      const globalFrame = frame.index  // 0-based global index in the sheet
      const mineDownSwingFrame  = 28 + SWING_FRAME_INDEX_IN_STRIP   // = 31
      const mineLeftSwingFrame  = 34 + SWING_FRAME_INDEX_IN_STRIP   // = 37
      const mineRightSwingFrame = 40 + SWING_FRAME_INDEX_IN_STRIP   // = 43

      if (
        globalFrame === mineDownSwingFrame ||
        globalFrame === mineLeftSwingFrame ||
        globalFrame === mineRightSwingFrame
      ) {
        this.game.events.emit('mineSwingFrame', {
          playerX: this.player.gridX,
          playerY: this.player.gridY,
          facing: this.player.facing,
          state: this.animController?.state,
        })
      }
    }
  )
}

// In MineScene.create() — add call after animController setup:
if (this.textures.exists('miner_sheet')) {
  this.animController.registerAnims(this)
  this.animController.setIdle()
  this.setupMineSwingFrameEvent()   // ← ADD THIS LINE
}
```

#### 29.3.5 — Camera Follow Anchor Adjustment

The existing `this.cameras.main.startFollow(this.playerSprite, true, 0.12, 0.12)` follows the sprite's origin. Since the origin is now `(0.5, 1.0)` (bottom-center), the camera will follow the miner's feet rather than their center. Add a camera follow offset to center the view on the character's torso instead:

```typescript
// In MineScene.create() — REPLACE the existing startFollow call:
this.cameras.main.startFollow(
  this.playerSprite,
  true,    // roundPixels
  0.12,    // lerpX
  0.12,    // lerpY
  0,       // offsetX
  -(TILE_SIZE * 0.75)   // offsetY: shift camera up by 0.75 tiles to center on torso
)
```

#### 29.3.6 — Z-Ordering

The miner sprite must always render above tiles (depth 10) and below all UI overlays (depth 50+). The gear overlay sprites added in 29.4 must use depth 11 to render on top of the miner but below UI. Confirm existing depth assignments are consistent with this:

```typescript
// Confirmed depth assignments (verify these in MineScene.ts):
// this.tileGraphics.setDepth(0)        — background tiles
// this.overlayGraphics.setDepth(7)     — crack overlays, fog tints
// item sprite pool: setDepth(5)        — block sprites
// this.playerSprite.setDepth(10)       — miner base sprite
// gear overlays: setDepth(11)          — overlay sprites (added in 29.4)
// HUD (Svelte): always above Phaser canvas
```

#### 29.3.7 — Animation State Change in handleMoveOrMine

In `MineScene.handleMoveOrMine()`, the existing animation calls (`animController.setWalk`, `animController.setMine`) must be updated to match the new method signatures. After confirming damage is applied first (DD-V2-249), ensure `setMine()` is called afterward:

```typescript
// In MineScene.handleMoveOrMine() — existing mine branch:
// 1. Apply damage (already done by mineBlock() call)
// 2. THEN start the visual animation:
const dx = targetX - this.player.gridX   // (computed before the block is mined)
const dy = targetY - this.player.gridY
this.animController?.setMine(dx, dy, () => {
  // onComplete: flush buffered input
  if (this.bufferedInput) {
    const buf = this.bufferedInput
    this.bufferedInput = null
    this.handleMoveOrMine(buf.x, buf.y)
  }
})

// Move branch:
const moved = this.player.moveToEmpty(targetX, targetY, this.grid)
if (moved) {
  const moveDx = this.player.lastMoveDx
  const moveDy = this.player.lastMoveDy
  this.animController?.setWalk(moveDx, moveDy)
  // ... rest of move handling
}
```

#### 29.3.8 — Idle State After Movement

The miner should return to `idle` a short time after the last movement. This is already handled implicitly by the walk animation — when no new `setWalk()` call comes in on the next tick, the animation continues looping. To return to idle after the player stops moving, call `setIdle()` one tick after the last movement. The cleanest place is at the end of `drawPlayer()`:

```typescript
// In drawPlayer() — ADD after position lerp snap:
// If visual position has snapped to logical position (movement is done), return to idle
const targetX = this.player.gridX * TILE_SIZE + TILE_SIZE * 0.5
const targetY = this.player.gridY * TILE_SIZE + TILE_SIZE
const atTarget = this.playerVisualX === targetX && this.playerVisualY === targetY
if (atTarget && !this.animController?.isPlayingMineAnim) {
  this.animController?.setIdle()
}
```

#### 29.3.9 — Acceptance Criteria for 29.3

- [ ] Sprite loads at 32×48 (lo-res) and 256×384 (hi-res) with no distortion
- [ ] Sprite origin is at bottom-center — character feet align with tile grid
- [ ] Camera follows torso center, not feet (0.75 tile upward offset)
- [ ] `mineSwingFrame` event fires exactly once per mining action, at the correct frame
- [ ] Walk animation plays during movement, idles when player stops
- [ ] Mine animation plays after block damage is applied (not before)
- [ ] `npm run typecheck` passes

---

### 29.4 — Gear Overlay System

**Goal**: Render up to three visual overlays on top of the miner sprite: a pickaxe tier icon (5 tiers, each with its own small sprite), an active relic glow (colored aura), and a companion badge (small companion portrait icon floating near the character). All overlays follow the character's pixel position exactly and are rendered as separate Phaser sprites at depth 11.

#### 29.4.1 — Overlay Sprite Assets

Five pickaxe tier overlay sprites are needed, each 16×16 px (at 32px resolution), centered on the miner's right shoulder area. These are simple pixel-art icons:

| File                                      | Description |
|-------------------------------------------|-------------|
| `src/assets/sprites/overlay_pick_t0.png` | Stone pick (grey, rough) |
| `src/assets/sprites/overlay_pick_t1.png` | Iron pick (silver) |
| `src/assets/sprites/overlay_pick_t2.png` | Gold pick (yellow) |
| `src/assets/sprites/overlay_pick_t3.png` | Diamond pick (cyan) |
| `src/assets/sprites/overlay_pick_t4.png` | Quantum pick (magenta, glowing) |

The relic glow is a 32×48 px semi-transparent colored ring sprite, one per relic rarity:

| File                                         | Description |
|----------------------------------------------|-------------|
| `src/assets/sprites/overlay_relic_common.png`    | White/grey ring glow |
| `src/assets/sprites/overlay_relic_uncommon.png`  | Green ring glow |
| `src/assets/sprites/overlay_relic_rare.png`      | Blue ring glow |
| `src/assets/sprites/overlay_relic_epic.png`      | Purple ring glow |
| `src/assets/sprites/overlay_relic_legendary.png` | Gold animated ring |

The companion badge is a 16×16 px icon per companion species. Reuse the existing companion portrait icons if they exist in `src/assets/sprites/`, otherwise generate placeholder circles with species-colored fill.

ComfyUI prompts for overlay sprites (generate at 512×512, scale to 16×16 or 32×48 with nearest-neighbor):

**Pickaxe tier overlays**:
```
Positive: pixel art pickaxe icon, [stone/iron/gold/diamond/quantum] pickaxe,
top-down side view, pixel art icon, 8-bit, 16x16 sprite, single item,
flat design, transparent background, white outline

Negative: 3d, realistic, complex background, low quality
```

**Relic glow overlays**:
```
Positive: pixel art circular glow aura, [color] colored magical ring,
surrounding a character outline, transparent center, semi-transparent edges,
fantasy RPG glow effect, pixel art, 8-bit style, 32x48 sprite, transparent background

Negative: 3d, realistic, complex background, filled center
```

#### 29.4.2 — GearOverlaySystem Class

Create `src/game/systems/GearOverlaySystem.ts`:

```typescript
// src/game/systems/GearOverlaySystem.ts
// Phase 29: Character Animation System — DD-V2-248

import Phaser from 'phaser'

/** Maximum pickaxe tier index (0–4). */
const MAX_PICKAXE_TIER = 4

/** Pixel offset of the pickaxe icon relative to the miner's feet anchor. */
const PICK_OFFSET_X =  10   // px right of center (right shoulder)
const PICK_OFFSET_Y = -28   // px above feet anchor (shoulder height)

/** Pixel offset of the companion badge (bottom-left corner of character). */
const BADGE_OFFSET_X = -12  // px left of center
const BADGE_OFFSET_Y = -10  // px above feet anchor (knee height)

/** Display size of the pickaxe tier icon in game pixels. */
const PICK_DISPLAY = 16

/** Display size of the companion badge in game pixels. */
const BADGE_DISPLAY = 12

/** Relic glow pulse cycle duration in ms. */
const GLOW_PULSE_PERIOD_MS = 1200

/**
 * Renders gear overlays on top of the miner sprite:
 *   1. Pickaxe tier icon (right shoulder)
 *   2. Relic glow aura (full-body colored ring)
 *   3. Companion badge (lower-left corner)
 *
 * All overlays are parented to the character's world position and must be
 * updated every frame via update().
 *
 * Performance: overlays share draw calls with the character when possible.
 * The glow aura uses alpha tweening via Phaser's update loop (no separate
 * tween objects — just Math.sin() on this.time.now).
 */
export class GearOverlaySystem {
  private scene: Phaser.Scene
  private pickSprite: Phaser.GameObjects.Image | null = null
  private glowSprite: Phaser.GameObjects.Image | null = null
  private badgeSprite: Phaser.GameObjects.Image | null = null

  /** Current pickaxe tier (0–4). */
  private pickTier = 0

  /** Currently active relic rarity, or null if no relic is equipped. */
  private relicRarity: string | null = null

  /** Currently active companion ID, or null if no companion is equipped. */
  private companionId: string | null = null

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  /**
   * Creates the overlay sprites. Call once after MineScene.create() finishes.
   * The sprites are initially invisible.
   */
  init(): void {
    // Pickaxe tier icon
    this.pickSprite = this.scene.add.image(0, 0, 'overlay_pick_t0')
    this.pickSprite.setDisplaySize(PICK_DISPLAY, PICK_DISPLAY)
    this.pickSprite.setDepth(11)
    this.pickSprite.setVisible(false)

    // Relic glow aura — starts hidden until a relic is equipped
    this.glowSprite = this.scene.add.image(0, 0, 'overlay_relic_common')
    this.glowSprite.setDepth(9)    // BELOW player sprite so glow bleeds outward
    this.glowSprite.setVisible(false)
    this.glowSprite.setAlpha(0)

    // Companion badge
    this.badgeSprite = this.scene.add.image(0, 0, 'overlay_companion_badge')
    this.badgeSprite.setDisplaySize(BADGE_DISPLAY, BADGE_DISPLAY)
    this.badgeSprite.setDepth(11)
    this.badgeSprite.setVisible(false)
  }

  /**
   * Update overlay positions and alpha each frame.
   * Call from MineScene.update() after drawPlayer() has moved the sprite.
   *
   * @param worldX - The miner sprite's world X (feet anchor)
   * @param worldY - The miner sprite's world Y (feet anchor)
   * @param nowMs  - Current game time in ms (from scene.time.now)
   */
  update(worldX: number, worldY: number, nowMs: number): void {
    if (this.pickSprite?.visible) {
      this.pickSprite.setPosition(worldX + PICK_OFFSET_X, worldY + PICK_OFFSET_Y)
    }

    if (this.glowSprite?.visible) {
      // Pulse glow alpha between 0.25 and 0.55
      const pulse = 0.4 + 0.15 * Math.sin((nowMs / GLOW_PULSE_PERIOD_MS) * Math.PI * 2)
      this.glowSprite.setAlpha(pulse)
      // Glow is centered on the character torso (not feet)
      this.glowSprite.setPosition(worldX, worldY - 24)
    }

    if (this.badgeSprite?.visible) {
      this.badgeSprite.setPosition(worldX + BADGE_OFFSET_X, worldY + BADGE_OFFSET_Y)
    }
  }

  // -------------------------------------------------------------------------
  // State setters — call from MineScene when game state changes
  // -------------------------------------------------------------------------

  /**
   * Update the pickaxe tier overlay. Tier 0 hides the overlay (basic pick has no icon).
   *
   * @param tier - Pickaxe tier index 0–4
   */
  setPickaxeTier(tier: number): void {
    this.pickTier = Math.min(Math.max(tier, 0), MAX_PICKAXE_TIER)
    if (!this.pickSprite) return

    if (this.pickTier === 0) {
      this.pickSprite.setVisible(false)
      return
    }

    const key = `overlay_pick_t${this.pickTier}`
    if (this.scene.textures.exists(key)) {
      this.pickSprite.setTexture(key)
      this.pickSprite.setVisible(true)
    }
  }

  /**
   * Update the relic glow overlay.
   * Pass null to hide the glow (no relics equipped).
   *
   * @param rarity - The rarity of the highest-tier equipped relic, or null
   */
  setRelicGlow(rarity: string | null): void {
    this.relicRarity = rarity
    if (!this.glowSprite) return

    if (!rarity) {
      this.glowSprite.setVisible(false)
      return
    }

    const key = `overlay_relic_${rarity}`
    if (this.scene.textures.exists(key)) {
      this.glowSprite.setTexture(key)
      this.glowSprite.setVisible(true)
      this.glowSprite.setDisplaySize(36, 52)  // slightly wider than character for glow bleed
    }
  }

  /**
   * Update the companion badge overlay.
   * Pass null to hide the badge.
   *
   * @param companionId - The companion's ID string, or null
   */
  setCompanionBadge(companionId: string | null): void {
    this.companionId = companionId
    if (!this.badgeSprite) return

    if (!companionId) {
      this.badgeSprite.setVisible(false)
      return
    }

    // Use companion-specific badge sprite if available, else generic
    const key = `companion_badge_${companionId}`
    const fallbackKey = 'overlay_companion_badge'
    const useKey = this.scene.textures.exists(key) ? key : fallbackKey

    if (this.scene.textures.exists(useKey)) {
      this.badgeSprite.setTexture(useKey)
      this.badgeSprite.setVisible(true)
    }
  }

  /**
   * Flash the companion badge (used by MineScene.companionFlash indicator).
   * Briefly scales the badge up and returns to normal.
   */
  flashCompanionBadge(): void {
    if (!this.badgeSprite?.visible) return
    this.scene.tweens.add({
      targets: this.badgeSprite,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 120,
      ease: 'Back.Out',
      yoyo: true,
    })
  }

  /**
   * Destroy all overlay sprites. Call from MineScene.handleShutdown().
   */
  destroy(): void {
    this.pickSprite?.destroy()
    this.glowSprite?.destroy()
    this.badgeSprite?.destroy()
    this.pickSprite = null
    this.glowSprite = null
    this.badgeSprite = null
  }
}
```

#### 29.4.3 — Preloading Overlay Sprites

In `MineScene.preload()`, overlay sprites are discovered via the existing `getSpriteUrls()` call because they live in `src/assets/sprites/` and match the glob pattern. However, we must ensure the relic glow overlay sprites have the correct texture keys. Add explicit loading for any overlays not covered by the existing glob:

```typescript
// In MineScene.preload() — ADD after the existing sprite loading loop:
// Gear overlays — loaded as individual images (not part of spritesheet)
const overlayKeys = [
  'overlay_pick_t0', 'overlay_pick_t1', 'overlay_pick_t2', 'overlay_pick_t3', 'overlay_pick_t4',
  'overlay_relic_common', 'overlay_relic_uncommon', 'overlay_relic_rare',
  'overlay_relic_epic', 'overlay_relic_legendary',
  'overlay_companion_badge',
]
for (const key of overlayKeys) {
  if (!this.textures.exists(key) && spriteUrls[key]) {
    this.load.image(key, spriteUrls[key])
  }
}
```

#### 29.4.4 — MineScene Integration

Add `GearOverlaySystem` to `MineScene`:

```typescript
// In MineScene.ts — add to class fields:
private gearOverlay: GearOverlaySystem | null = null

// In MineScene.create() — add after animController setup:
this.gearOverlay = new GearOverlaySystem(this)
this.gearOverlay.init()

// Apply initial state from run data:
this.gearOverlay.setPickaxeTier(this.pickaxeTierIndex)
this.gearOverlay.setCompanionBadge(this.companionEffect?.companionId ?? null)
// Set relic glow from highest-rarity equipped relic:
const highestRarity = this.collectedRelics.reduce((best, relic) => {
  const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary']
  const current = rarityOrder.indexOf(relic.tier ?? 'common')
  const bestIndex = rarityOrder.indexOf(best)
  return current > bestIndex ? (relic.tier ?? 'common') : best
}, 'common' as string)
if (this.collectedRelics.length > 0) {
  this.gearOverlay.setRelicGlow(highestRarity)
}

// In MineScene.update() — add overlay update:
update(_time: number, delta: number): void {
  // existing ...
  this.gearOverlay?.update(this.playerVisualX, this.playerVisualY, this.time.now)
  // existing ...
}

// In MineScene — wherever pickaxe tier is updated:
// this.pickaxeTierIndex = newTier
// this.gearOverlay?.setPickaxeTier(this.pickaxeTierIndex)

// When new relic is collected:
// this.gearOverlay?.setRelicGlow(highestRelicRarity)

// On companionFlash event:
// this.gearOverlay?.flashCompanionBadge()

// In handleShutdown():
this.gearOverlay?.destroy()
this.gearOverlay = null
```

#### 29.4.5 — Acceptance Criteria for 29.4

- [ ] `src/game/systems/GearOverlaySystem.ts` created with full JSDoc
- [ ] Pickaxe tier 0 shows no icon; tiers 1–4 show the appropriate icon
- [ ] Relic glow pulses at correct alpha range (0.25–0.55) on the glow_pulse sine cycle
- [ ] Companion badge appears when a companion is equipped; flashes on `companionFlash` events
- [ ] All overlays follow the player sprite pixel-perfectly during lerp movement
- [ ] Overlays hidden during hurt/fall animations (no visual clutter during special states)
- [ ] `npm run typecheck` passes

---

### 29.5 — Hi-Res Variant Generation

**Goal**: Produce the 256×384 px hi-res variant of every frame for use in close-up views (DivePrepScreen character preview, profile avatar, gacha reveal). The hi-res sheet uses nearest-neighbor upscaling of the 32×48 originals — no new art generation.

#### 29.5.1 — Generation Process

```bash
# In the project root — run after 29.1 sprites are finalized:
python sprite-gen/stitch_miner_sheet.py \
  --strips_dir /tmp/miner_strips_hires \
  --out src/assets/sprites-hires/miner_sheet.png \
  --hires
```

The `--hires` flag in `stitch_miner_sheet.py` scales each 32×48 frame to 256×384 using PIL's `Image.NEAREST` filter before stitching.

Output: `src/assets/sprites-hires/miner_sheet.png` — 13312×384 px (52 frames × 256 px wide × 384 px tall).

#### 29.5.2 — DivePrepScreen Character Preview

The DivePrepScreen (if it shows a character portrait) should load the hi-res sheet and display frame 0 (idle neutral pose) as the character preview. This is a static image — no animation needed in the prep screen.

```typescript
// In any Svelte component showing a character preview:
// <canvas> or <img> approach — use the hi-res sheet, crop frame 0:
// Frame 0 is at x=0, y=0, w=256, h=384 in the hi-res sheet

// Example Phaser approach for a character preview scene:
scene.load.spritesheet('miner_sheet_hires', hiresUrl, {
  frameWidth: 256,
  frameHeight: 384,
})
// After load, create image showing frame 0:
const preview = scene.add.image(cx, cy, 'miner_sheet_hires', 0)
preview.setDisplaySize(64, 96)  // 2x display in prep screen UI
```

#### 29.5.3 — Acceptance Criteria for 29.5

- [ ] `src/assets/sprites-hires/miner_sheet.png` exists at 13312×384 px
- [ ] All 52 hi-res frames are pixel-perfect 8× upscales of the lo-res originals (no blurring)
- [ ] DivePrepScreen (if character preview is implemented) shows hi-res idle frame correctly
- [ ] File size is under 2 MB (PNG compression acceptable)

---

### 29.6 — Integration with MineScene

**Goal**: Replace every place in `MineScene.ts` that references the old animation layout or static player sprite with the new system. Ensure the full animation pipeline works end-to-end: move → walk anim → arrive → idle; tap block → mine anim (AFTER damage applied) → `mineSwingFrame` event → particles → buffered input flush → idle.

#### 29.6.1 — Complete handleMoveOrMine Rewrite Guidance

The existing `handleMoveOrMine()` method at line 1311 of MineScene.ts must be updated to guarantee DD-V2-249 (damage before animation). The pseudocode structure is:

```typescript
private handleMoveOrMine(targetX: number, targetY: number): void {
  const playerX = this.player.gridX
  const playerY = this.player.gridY
  const targetCell = this.grid[targetY][targetX]

  const dx = targetX - playerX
  const dy = targetY - playerY

  // === BRANCH 1: Movement ===
  if (targetCell.type === BlockType.Empty || targetCell.type === BlockType.ExitLadder) {
    const moved = this.player.moveToEmpty(targetX, targetY, this.grid)
    if (moved) {
      // 1. Update animation — walk in movement direction
      this.animController?.setWalk(this.player.lastMoveDx, this.player.lastMoveDy)

      // 2. Game state updates (reveal fog, oxygen, etc.)
      revealAround(this.grid, this.player.gridX, this.player.gridY, BALANCE.FOG_REVEAL_RADIUS)
      this.game.events.emit('oxygen-changed', this.oxygenState)
      this.game.events.emit('depth-changed', this.player.gridY)
      this.checkPointOfNoReturn()

      // 3. Advance tick
      TickSystem.getInstance().advance()
      this.redrawAll()
    }
    return
  }

  // === BRANCH 2: Mining ===
  if (canMine(targetCell, this.pickaxeTierIndex)) {
    // DD-V2-249: Apply damage FIRST, animation SECOND
    const hitCount = this.player.recordHit(targetX, targetY)
    const isFinalHit = mineBlock(targetCell, this.pickaxeTierIndex, this.companionEffect)
    const blockPx = targetX * TILE_SIZE
    const blockPy = targetY * TILE_SIZE

    // Impact feedback (shake, flash) — DD-V2-249: this is post-damage visual only
    this.impactSystem.triggerHit(
      targetCell.type, hitCount, isFinalHit,
      blockPx + TILE_SIZE * 0.5, blockPy + TILE_SIZE * 0.5,
      targetX, targetY, this.pickaxeTierIndex, this.flashTiles
    )

    if (isFinalHit) {
      // Block destroyed — spawn particles, handle loot, update grid
      this.spawnBreakParticles(blockPx, blockPy, targetCell.type)
      this.player.clearHitCount(targetX, targetY)
      this.grid[targetY][targetX] = { type: BlockType.Empty, hardness: 0, maxHardness: 0, revealed: true }
      revealAround(this.grid, playerX, playerY, BALANCE.FOG_REVEAL_RADIUS)
      this.handleBlockLoot(targetCell, targetX, targetY)
    }

    // NOW play the swing animation (after all damage is done)
    this.animController?.setMine(dx, dy, () => {
      // onComplete: flush buffered input
      if (this.bufferedInput) {
        const buf = this.bufferedInput
        this.bufferedInput = null
        this.handleMoveOrMine(buf.x, buf.y)
      }
    })

    // Advance tick
    TickSystem.getInstance().advance()
    this.redrawAll()
  }
}
```

#### 29.6.2 — Handling the `mineSwingFrame` Event in ParticleSystem

The `ParticleSystem` should listen for the `mineSwingFrame` event emitted in 29.3.4 and trigger a small directional dust burst at the block face. This is a "visual confirmation" particle — separate from the `emitBreak()` call on block destruction.

Add to `MineScene.create()` after particle system init:

```typescript
// In MineScene.create():
this.game.events.on('mineSwingFrame', (data: {
  playerX: number, playerY: number, facing: string, state: string
}) => {
  // Emit a small dust burst at the face of the block being swung at
  const blockX = data.playerX + (data.facing === 'left' ? -1 : data.facing === 'right' ? 1 : 0)
  const blockY = data.playerY + (data.facing === 'down' ? 1 : data.facing === 'up' ? -1 : 0)
  const worldPx = blockX * TILE_SIZE + TILE_SIZE * 0.5
  const worldPy = blockY * TILE_SIZE + TILE_SIZE * 0.5
  this.particles?.emitSwingDust(worldPx, worldPy, data.facing as 'left' | 'right' | 'up' | 'down')
})
```

Add `emitSwingDust()` to `ParticleSystem`:

```typescript
// In src/game/systems/ParticleSystem.ts — ADD method:
/**
 * Emit a small directional dust burst at the point of pickaxe contact.
 * Called on the mineSwingFrame animation event (frame 3 of mine strips).
 *
 * @param wx      - World X of the block face center
 * @param wy      - World Y of the block face center
 * @param facing  - Direction the miner is swinging
 */
emitSwingDust(wx: number, wy: number, facing: 'left' | 'right' | 'up' | 'down'): void {
  const angle = facing === 'left' ? 180 : facing === 'right' ? 0 : facing === 'up' ? 270 : 90

  // Small grey-brown dust puff, 5 particles
  if (!this.scene.textures.exists('__DEFAULT')) return
  this.scene.add.particles(wx, wy, '__DEFAULT', {
    speed: { min: 15, max: 35 },
    angle: { min: angle - 30, max: angle + 30 },
    scale: { start: 0.6, end: 0 },
    lifespan: 220,
    quantity: 5,
    tint: 0xbbaa88,
    stopAfter: 5,
  })
}
```

#### 29.6.3 — Cleanup in handleShutdown

Ensure all new systems are torn down on scene shutdown:

```typescript
// In MineScene.handleShutdown():
private handleShutdown(): void {
  // existing cleanup ...
  this.gearOverlay?.destroy()
  this.gearOverlay = null
  this.game.events.off('mineSwingFrame')
  // existing cleanup ...
}
```

#### 29.6.4 — End-to-End Animation Flow

The complete frame-by-frame flow for a single mining action:

```
t=0ms   Player taps adjacent dirt block
        → handlePointerDown fires
        → handleMoveOrMine called
        → canMine() returns true
        → player.recordHit(targetX, targetY) → hitCount = 1
        → mineBlock() applies damage (hardness: 1→0 for dirt)
        → isFinalHit = true (dirt has hardness 1)
        → spawnBreakParticles() → 8 brown dust particles explode from block
        → grid cell set to Empty
        → revealAround() updates fog
        → handleBlockLoot() adds mineral to inventory
        → impactSystem.triggerHit() → camera shake 1px / 80ms, block flash 150ms
        → animController.setMine(dx=0, dy=1) → Phaser plays 'mine_down' from frame 0
        → TickSystem.advance() → all tick callbacks fire
        → redrawAll()

t=71ms  Phaser animation: mine_down frame 3 fires
        → ANIMATION_UPDATE event catches globalFrame === 31
        → 'mineSwingFrame' event emitted
        → particles.emitSwingDust() → 5 grey dust particles at block face
        → ImpactSystem has already shaken camera; no second shake needed here

t=214ms Phaser animation: mine_down frame 5 (last) fires
        → ANIMATION_COMPLETE event
        → isMiningAnim = false
        → onComplete() callback runs
        → if bufferedInput exists → handleMoveOrMine(buf.x, buf.y)
        → else → next input is unblocked

t=215ms (next frame) drawPlayer() detects playerVisualX === targetX, calls setIdle()
        → idle breathing loop begins
```

#### 29.6.5 — Acceptance Criteria for 29.6

- [ ] Movement plays directional walk animation; character idles when player stops
- [ ] Mining plays directional mine swing AFTER block damage is already applied (DD-V2-249)
- [ ] `mineSwingFrame` event fires at the correct visual frame; swing dust particles appear
- [ ] Buffered input flushes correctly after mine animation completes
- [ ] Hurt flash plays when lava or gas damages the player
- [ ] Fall animation plays during DescentShaft transition; stops when new layer loads
- [ ] Gear overlays (pick tier, relic glow, companion badge) visible and correctly positioned
- [ ] No z-fighting between player sprite and tile graphics
- [ ] `npm run typecheck` passes with zero errors
- [ ] `npm run build` completes successfully

---

## Acceptance Criteria (Full Phase)

### Visual

- [ ] Miner sprite animates in all 9 states: idle, walk ×4, mine ×3, hurt, fall
- [ ] All animations run at correct frame rates: idle 5fps, walk 10fps, mine 14fps, hurt 12fps, fall 8fps
- [ ] Character feet align with tile grid at all times (no floating, no clipping)
- [ ] Camera follows miner's torso center (not feet or head)
- [ ] Gear overlays follow miner pixel-perfectly during lerp movement
- [ ] Relic glow pulses smoothly at 0.4±0.15 alpha
- [ ] No frame tears or flicker between animation state transitions
- [ ] Hi-res 256px sprites are pixel-perfect 8× upscales (no bilinear blur)

### Behavioral (DD-V2-249 verification)

- [ ] Block hardness is decremented BEFORE the mine animation starts on every hit
- [ ] Block particles spawn BEFORE the mine animation starts on final hit
- [ ] `mineSwingFrame` event fires during animation (visual-only confirmation)
- [ ] Buffered input is correctly replayed after each mine animation completes
- [ ] Input is gated during mine animation; tapping during swing queues the next action

### Code Quality

- [ ] `AnimationSystem.ts` fully updated; old 8-frame mine configs removed
- [ ] `GearOverlaySystem.ts` created with full JSDoc
- [ ] `stitch_miner_sheet.py` committed in `sprite-gen/`
- [ ] `npm run typecheck` produces zero new errors
- [ ] `npm run build` succeeds (no chunk size regressions)
- [ ] All new public functions have JSDoc comments

---

## Playwright Test Scripts

All Playwright tests use the Node.js script approach documented in CLAUDE.md. Write to `/tmp/` and run with `node`.

### Test Script 1 — Basic Animation State Transitions

```javascript
// /tmp/ss-phase29-animations.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')

;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')

  // Navigate into the mine
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)

  // Screenshot 1: Idle state — miner should be in idle animation
  await page.screenshot({ path: '/tmp/ss29-idle.png' })
  console.log('Screenshot 1: Idle state saved')

  // Simulate a tap to an adjacent empty tile (to trigger walk animation)
  // Find the Phaser canvas and click to the right of center
  const canvas = await page.$('canvas')
  const box = await canvas.boundingBox()
  await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.5)
  await page.waitForTimeout(200)

  // Screenshot 2: Should catch walking animation if canvas renders fast enough
  await page.screenshot({ path: '/tmp/ss29-walk.png' })
  console.log('Screenshot 2: Walk state (may show idle if already arrived)')

  await page.waitForTimeout(800)

  // Screenshot 3: After settling — should be idle again
  await page.screenshot({ path: '/tmp/ss29-settled.png' })
  console.log('Screenshot 3: Settled idle state saved')

  // Tap an adjacent solid block to trigger mine animation
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.3)
  await page.waitForTimeout(100)
  await page.screenshot({ path: '/tmp/ss29-mining.png' })
  console.log('Screenshot 4: Mining state saved')

  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/ss29-post-mine.png' })
  console.log('Screenshot 5: Post-mine idle saved')

  await browser.close()
  console.log('Test complete. Check /tmp/ss29-*.png')
})()
```

### Test Script 2 — Gear Overlay Visibility

```javascript
// /tmp/ss-phase29-overlays.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')

;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })

  // Navigate directly into the mine with URL parameter to set pickaxe tier 3
  await page.goto('http://localhost:5173?pickaxeTier=3')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)

  await page.screenshot({ path: '/tmp/ss29-overlay-tier3.png' })
  console.log('Screenshot: Tier 3 pickaxe overlay saved')

  // Zoom in using Playwright evaluate to enlarge the Phaser camera
  await page.evaluate(() => {
    const game = window.__phaserGame  // if exposed via window
    if (game) {
      const scene = game.scene.getScene('MineScene')
      if (scene) scene.cameras.main.setZoom(4)
    }
  })
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/ss29-overlay-zoomed.png' })
  console.log('Screenshot: Zoomed gear overlay saved')

  await browser.close()
})()
```

### Test Script 3 — DD-V2-249 Verification (Damage Before Animation)

```javascript
// /tmp/ss-phase29-dd249.js
// Verifies that block damage is applied before the mine animation starts
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')

;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)

  // Intercept console logs to check for 'damage applied before animation' messages
  const damageLog = []
  const animLog = []
  page.on('console', msg => {
    const text = msg.text()
    if (text.includes('[ANIM] mine_')) animLog.push({ time: Date.now(), text })
    if (text.includes('[MINE] damage')) damageLog.push({ time: Date.now(), text })
  })

  // Trigger a mine action via keyboard (right arrow into a block)
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(600)

  // Verify ordering: damage should appear BEFORE animation in the log
  if (damageLog.length > 0 && animLog.length > 0) {
    const damageFirst = damageLog[0].time <= animLog[0].time
    console.log(`DD-V2-249 check: damage before animation = ${damageFirst}`)
    if (!damageFirst) {
      console.error('FAIL: Animation started before damage was applied!')
      process.exit(1)
    }
  } else {
    console.log('No console logs intercepted — verify manually via screenshot')
  }

  await page.screenshot({ path: '/tmp/ss29-dd249.png' })
  await browser.close()
  console.log('DD-V2-249 test complete')
})()
```

### Test Script 4 — Full Animation Cycle Screenshot Montage

```javascript
// /tmp/ss-phase29-montage.js
// Captures screenshots at multiple points to create a visual record of all states
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
const fs = require('fs')

;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)

  const canvas = await page.$('canvas')
  const box = await canvas.boundingBox()
  const cx = box.x + box.width * 0.5
  const cy = box.y + box.height * 0.5

  const shots = []

  // Idle
  await page.screenshot({ path: '/tmp/ss29-m-idle.png', clip: box })
  shots.push('idle')

  // Walk right
  await page.mouse.click(cx + 64, cy)
  await page.waitForTimeout(80)
  await page.screenshot({ path: '/tmp/ss29-m-walk_right.png', clip: box })
  shots.push('walk_right')
  await page.waitForTimeout(400)

  // Walk down
  await page.mouse.click(cx, cy + 64)
  await page.waitForTimeout(80)
  await page.screenshot({ path: '/tmp/ss29-m-walk_down.png', clip: box })
  shots.push('walk_down')
  await page.waitForTimeout(400)

  // Mine down (tap block below)
  await page.mouse.click(cx, cy + 96)
  await page.waitForTimeout(80)
  await page.screenshot({ path: '/tmp/ss29-m-mine_down.png', clip: box })
  shots.push('mine_down')
  await page.waitForTimeout(400)

  // Mine left
  await page.mouse.click(cx - 96, cy)
  await page.waitForTimeout(80)
  await page.screenshot({ path: '/tmp/ss29-m-mine_left.png', clip: box })
  shots.push('mine_left')
  await page.waitForTimeout(400)

  console.log(`Montage complete. Screenshots: ${shots.map(s => `ss29-m-${s}.png`).join(', ')}`)
  await browser.close()
})()
```

---

## Verification Gate

All items in this gate MUST pass before the phase is marked complete in PROGRESS.md.

### Sprite Assets

- [ ] `src/assets/sprites/miner_sheet.png` exists (1664×48 px, 52 frames)
- [ ] `src/assets/sprites-hires/miner_sheet.png` exists (13312×384 px, 52 frames)
- [ ] All 10 gear overlay sprites exist in `src/assets/sprites/`
- [ ] `sprite-gen/stitch_miner_sheet.py` committed and executable

### TypeScript Compilation

```bash
npm run typecheck
# Expected: 0 errors
```

- [ ] Zero TypeScript errors after all changes

### Build

```bash
npm run build
# Expected: success, no new chunk size warnings beyond existing baseline
```

- [ ] Build succeeds

### Functional Tests (manual + Playwright)

- [ ] Run `/tmp/ss-phase29-animations.js` — all 5 screenshots show correct states
- [ ] Run `/tmp/ss-phase29-overlays.js` — gear overlay visible in zoomed screenshot
- [ ] Run `/tmp/ss-phase29-dd249.js` — DD-V2-249 ordering confirmed
- [ ] Run `/tmp/ss-phase29-montage.js` — all 5 animation states captured visually

### Behavioral Checklist (verify manually in browser at localhost:5173)

- [ ] Idle breathing animation loops cleanly (no snap/jitter)
- [ ] Walk animations transition instantly on direction change (no lag frame)
- [ ] Mine swing never interrupts itself mid-animation (only restarts on new input)
- [ ] Hurt animation plays after lava/gas damage; character returns to idle afterward
- [ ] Fall animation plays during DescentShaft descent; stops cleanly on new layer
- [ ] Buffered input during mine swing executes immediately on animation complete
- [ ] Pickaxe tier overlay updates when player acquires a new pickaxe upgrade
- [ ] Relic glow appears/disappears when relics are collected/removed
- [ ] Companion badge appears when companion is equipped in PreDiveScreen
- [ ] All overlays hidden at hi-res zoom levels (no scaling artifacts)

### Frame-Accurate Verification

Use browser devtools or a screenshot at exactly 80ms after a mine tap to confirm:

- [ ] At t=0ms (tap): block hardness is already decremented (verify via console.log in handleMoveOrMine)
- [ ] At t=0ms: particles for final-hit blocks are already spawned
- [ ] At t=71ms (~frame 3 of mine_down at 14fps): `mineSwingFrame` event fires
- [ ] At t=214ms (~frame 5 complete): ANIMATION_COMPLETE fires; buffered input is flushed

---

## Files Affected

### New Files Created

| File | Description |
|------|-------------|
| `src/game/systems/GearOverlaySystem.ts` | Pickaxe tier icon, relic glow, companion badge overlays |
| `sprite-gen/stitch_miner_sheet.py` | Script to stitch animation strips into final sprite sheet |
| `src/assets/sprites/miner_sheet.png` | 32px miner sprite sheet (1664×48, 52 frames) |
| `src/assets/sprites-hires/miner_sheet.png` | 256px miner sprite sheet (13312×384, 52 frames) |
| `src/assets/sprites/overlay_pick_t0.png` | Tier 0 (stone) pickaxe icon overlay |
| `src/assets/sprites/overlay_pick_t1.png` | Tier 1 (iron) pickaxe icon overlay |
| `src/assets/sprites/overlay_pick_t2.png` | Tier 2 (gold) pickaxe icon overlay |
| `src/assets/sprites/overlay_pick_t3.png` | Tier 3 (diamond) pickaxe icon overlay |
| `src/assets/sprites/overlay_pick_t4.png` | Tier 4 (quantum) pickaxe icon overlay |
| `src/assets/sprites/overlay_relic_common.png` | Common relic glow aura |
| `src/assets/sprites/overlay_relic_uncommon.png` | Uncommon relic glow aura |
| `src/assets/sprites/overlay_relic_rare.png` | Rare relic glow aura |
| `src/assets/sprites/overlay_relic_epic.png` | Epic relic glow aura |
| `src/assets/sprites/overlay_relic_legendary.png` | Legendary relic glow aura |
| `src/assets/sprites/overlay_companion_badge.png` | Generic companion badge fallback |

### Files Modified

| File | Change Summary |
|------|----------------|
| `src/game/systems/AnimationSystem.ts` | Full rewrite: new 52-frame layout, hurt/fall states, priority system, updated MinerAnimController |
| `src/game/scenes/MineScene.ts` | Spritesheet loader (48px height), origin change to (0.5,1.0), camera follow offset, setupMineSwingFrameEvent(), handleMoveOrMine() damage-before-animation ordering, GearOverlaySystem init/update/destroy, mineSwingFrame listener, lava/gas hurt callback |
| `src/game/systems/ParticleSystem.ts` | Add emitSwingDust() method |

### Files Unchanged (but verified compatible)

| File | Reason |
|------|--------|
| `src/game/entities/Player.ts` | No changes needed; facing/lastMoveDx/lastMoveDy already tracked |
| `src/game/systems/TickSystem.ts` | No changes needed; tick-based loop unchanged |
| `src/game/systems/ImpactSystem.ts` | No changes needed; already fires on input event (DD-V2-249 compatible) |
| `src/game/systems/BlockAnimSystem.ts` | No changes needed; handles block animation independently of miner |
| `src/game/managers/CompanionManager.ts` | No changes needed; companionId passed through MineSceneData |
| `src/game/managers/RelicManager.ts` | No changes needed; relic rarity queried from getEquipped() |
| `src/game/spriteManifest.ts` | No changes needed; glob picks up new sprite files automatically |

---

## Implementation Notes for Coding Workers

These notes are for the Sonnet sub-agent executing this phase. Read before starting.

### Priority Order for Sub-Steps

1. Start with 29.2 (AnimationSystem.ts rewrite) — this is pure TypeScript with no asset dependency. Run typecheck to verify it compiles.
2. Then 29.4 (GearOverlaySystem.ts creation) — pure TypeScript, no asset dependency.
3. Then 29.3 (MineScene integration) — depends on 29.2 being done.
4. Then 29.6 (full integration + ParticleSystem update) — depends on 29.3.
5. Sprite generation (29.1) and hi-res variant (29.5) can be done in parallel with the code changes, but the game will fall back gracefully to the static 'miner_idle' sprite if `miner_sheet` is not found in the texture manager (this fallback is already in MineScene.create() at line 355).

### Critical: Do Not Break Existing Behavior

- `AnimationSystem.ts` is already imported by `MineScene.ts`. The rewrite must preserve all exported names: `MinerAnimState`, `FacingDir`, `AnimFrameConfig`, `ANIM_CONFIGS`, `getWalkState`, `getMineState`, `MinerAnimController`.
- The `MinerAnimController` constructor signature `(sprite: Phaser.GameObjects.Sprite)` must not change.
- The `isPlayingMineAnim` getter must remain (`MineScene.ts` uses it at lines 1225 and 1295).

### Frame Height Change is a Breaking Visual Change

Changing `frameHeight` from 32 to 48 in the spritesheet loader will display incorrectly until `miner_sheet.png` is replaced with the new 32×48 frame sheet. Until the sprite is generated, leave `frameHeight` at 32 and the sprite will look stretched. This is acceptable during development — do not gate other changes on sprite generation completion.

### The Existing `ANIM_CONFIGS` Conflict

The current `AnimationSystem.ts` (lines 34–43) defines mine frames as 8 frames starting at offsets 28, 36, 44. The new design uses 6 frames starting at 28, 34, 40. When you replace this file, any test that uses the old frame indices will produce wrong animations. This is expected — the new sprite sheet resolves this.

### Relic Rarity Query Pattern

To determine the highest relic rarity in `MineScene`, use this pattern (the RelicManager already tracks equipped relics):

```typescript
// Helper to get highest relic rarity string
private getHighestRelicRarity(): string | null {
  if (this.collectedRelics.length === 0) return null
  const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary']
  let highest = 0
  for (const relic of this.collectedRelics) {
    const idx = rarityOrder.indexOf(relic.tier ?? 'common')
    if (idx > highest) highest = idx
  }
  return rarityOrder[highest]
}
```

Call this after each `collectedRelics` update and pass to `this.gearOverlay?.setRelicGlow(...)`.

### Companion ID Extraction

The companion ID for the badge is available via `this.companionEffect?.companionId`. The `CompanionEffect` type already carries this field. No changes to the companion system are needed.

### Performance Consideration

Adding 3 overlay sprites per Phaser frame is minimal (3 Image objects, updated positions only). The relic glow is depth 9 (below the player) so it does not add a draw call on top — it blends into the background tiles pass. The total additional draw calls per frame is 2 (pickaxe icon + companion badge). This is within the 50 draw call budget (DD-V2-rendering constraints).

### ComfyUI Workflow Execution

If ComfyUI is available at `http://localhost:8188`, use the project's existing workflow scripts in `sprite-gen/`. If ComfyUI is not available during code implementation, create placeholder sprites as colored 32×48 PNG rectangles using PIL:

```python
from PIL import Image, ImageDraw
import os

# Create placeholder miner_sheet (52 frames, 32×48 each, colored solid blocks)
w, h = 52 * 32, 48
img = Image.new('RGBA', (w, h), (45, 83, 130, 255))  # Deep blue placeholder
draw = ImageDraw.Draw(img)
# Draw frame separators for debugging
for i in range(1, 52):
  draw.line([(i * 32, 0), (i * 32, 47)], fill=(255, 255, 255, 30), width=1)
os.makedirs('src/assets/sprites', exist_ok=True)
img.save('src/assets/sprites/miner_sheet.png')
print('Placeholder miner_sheet.png created (52×32×48)')
```

This placeholder will allow all TypeScript code to compile and run while the real sprites are being generated.
