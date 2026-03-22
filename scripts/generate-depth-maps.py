#!/usr/bin/env python3
"""
Generate depth maps for enemy sprites using silhouette-inflation.

Produces grayscale depth maps where:
- White (255) = closest to viewer (center of sprite mass)
- Black (0) = furthest / transparent areas

Uses distance transform from sprite edges — simple, deterministic,
and produces excellent results for pixel art without AI models.

Usage:
  python3 scripts/generate-depth-maps.py                    # All enemies
  python3 scripts/generate-depth-maps.py --enemy cave_bat   # Single enemy
  python3 scripts/generate-depth-maps.py --sigma 3          # Custom blur
"""

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy.ndimage import distance_transform_edt

SPRITE_DIR = Path("public/assets/sprites/enemies")


def generate_depth_map(input_path: Path, output_path: Path, sigma: float = 2.0) -> bool:
    """Generate a depth map from a sprite's alpha channel via distance transform."""
    img = Image.open(input_path).convert("RGBA")
    w, h = img.size
    data = np.array(img)

    # Extract alpha as binary mask
    alpha = data[:, :, 3]
    mask = (alpha > 10).astype(np.float64)

    if mask.sum() < 4:
        print(f"  SKIP {input_path.name} — too few opaque pixels")
        return False

    # Distance transform: each opaque pixel = distance to nearest edge/transparent pixel
    dist = distance_transform_edt(mask)

    # Normalize to 0-1
    max_dist = dist.max()
    if max_dist > 0:
        dist = dist / max_dist

    # Gaussian blur for smoothness (convert to PIL, blur, convert back)
    dist_img = Image.fromarray((dist * 255).astype(np.uint8), mode='L')
    if sigma > 0:
        dist_img = dist_img.filter(ImageFilter.GaussianBlur(radius=sigma))

    # Re-normalize after blur
    dist_arr = np.array(dist_img, dtype=np.float64)
    d_max = dist_arr.max()
    if d_max > 0:
        dist_arr = (dist_arr / d_max * 255).astype(np.uint8)
    else:
        dist_arr = dist_arr.astype(np.uint8)

    # Zero out transparent regions
    dist_arr[alpha <= 10] = 0

    # Save as grayscale PNG
    out = Image.fromarray(dist_arr, mode='L')
    out.save(output_path, optimize=True)
    return True


def main():
    parser = argparse.ArgumentParser(description="Generate depth maps for enemy sprites")
    parser.add_argument("--enemy", type=str, help="Process single enemy by ID")
    parser.add_argument("--sigma", type=float, default=2.0, help="Gaussian blur sigma (default: 2.0)")
    args = parser.parse_args()

    if not SPRITE_DIR.exists():
        print(f"ERROR: Sprite directory not found: {SPRITE_DIR}")
        sys.exit(1)

    # Find sprites to process
    if args.enemy:
        sprites = list(SPRITE_DIR.glob(f"{args.enemy}_idle.png"))
        if not sprites:
            print(f"ERROR: No sprite found for enemy '{args.enemy}'")
            sys.exit(1)
    else:
        sprites = sorted(SPRITE_DIR.glob("*_idle.png"))
        # Exclude existing depth maps and 1x variants from the source list
        sprites = [s for s in sprites if "_depth" not in s.name and "_1x" not in s.name]

    print(f"Generating depth maps for {len(sprites)} sprites (sigma={args.sigma})...")

    success = 0
    failed = 0

    for sprite_path in sprites:
        enemy_id = sprite_path.stem.replace("_idle", "")
        depth_path = SPRITE_DIR / f"{enemy_id}_idle_depth.png"

        try:
            if generate_depth_map(sprite_path, depth_path, sigma=args.sigma):
                success += 1
                print(f"  OK  {enemy_id}")

                # Also generate 1x depth map if 1x sprite exists
                sprite_1x = SPRITE_DIR / f"{enemy_id}_idle_1x.png"
                if sprite_1x.exists():
                    depth_1x = SPRITE_DIR / f"{enemy_id}_idle_1x_depth.png"
                    generate_depth_map(sprite_1x, depth_1x, sigma=max(1.0, args.sigma * 0.7))
            else:
                failed += 1
        except Exception as e:
            print(f"  FAIL {enemy_id}: {e}")
            failed += 1

    print(f"\nDone: {success} generated, {failed} failed/skipped")


if __name__ == "__main__":
    main()
