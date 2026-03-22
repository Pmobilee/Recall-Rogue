#!/usr/bin/env python3
"""Generate depth maps for room backgrounds using DepthAnythingV2."""

import argparse
import sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOMS_DIR = Path(__file__).parent.parent / "public/assets/backgrounds/rooms"


def generate_depth_map(image_path: Path, output_path: Path) -> bool:
    """Generate a depth map for a single image."""
    from broken.externals.depthmap import DepthAnythingV2

    img = Image.open(image_path)
    estimator = DepthAnythingV2()
    depth = estimator.estimate(img)

    # Normalize to 0-255 grayscale
    d_norm = ((depth - depth.min()) / (depth.max() - depth.min()) * 255).astype(np.uint8)
    # Resize to match source image dimensions
    depth_img = Image.fromarray(d_norm).resize(img.size, Image.LANCZOS)
    # Save as WebP (grayscale, good compression)
    depth_img.save(str(output_path), quality=90)
    return True


def discover_rooms(rooms_dir: Path):
    """Find room directories with landscape.webp and/or portrait.webp."""
    rooms = []
    for room_dir in sorted(rooms_dir.iterdir()):
        if not room_dir.is_dir() or room_dir.name == "transitions":
            continue
        room = {"id": room_dir.name, "path": room_dir, "images": []}
        for orientation in ("landscape", "portrait"):
            img_path = room_dir / f"{orientation}.webp"
            if not img_path.exists():
                img_path = room_dir / f"{orientation}.png"
            if img_path.exists():
                room["images"].append({"orientation": orientation, "path": img_path})
        if room["images"]:
            rooms.append(room)
    return rooms


def main():
    parser = argparse.ArgumentParser(description="Generate depth maps for room backgrounds")
    parser.add_argument("--rooms-dir", type=Path, default=ROOMS_DIR)
    parser.add_argument("--room", type=str, default=None, help="Single room ID")
    parser.add_argument("--orientation", choices=["landscape", "portrait"], default=None)
    parser.add_argument("--force", action="store_true", help="Regenerate existing depth maps")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    rooms = discover_rooms(args.rooms_dir)
    if args.room:
        rooms = [r for r in rooms if r["id"] == args.room]
    if args.orientation:
        for room in rooms:
            room["images"] = [i for i in room["images"] if i["orientation"] == args.orientation]

    # Lazy-load the estimator (slow import)
    estimator = None

    total = sum(len(r["images"]) for r in rooms)
    print(f"\nDepth Map Generator")
    print(f"  Rooms: {len(rooms)} | Images: {total}")
    if args.dry_run:
        print(f"  Mode: DRY RUN")
    print()

    succeeded = 0
    failed = 0

    for room in rooms:
        print(f"Room: {room['id']}")
        for img_info in room["images"]:
            # Output depth map alongside the source image
            output_path = img_info["path"].parent / f"{img_info['orientation']}_depth.webp"

            if output_path.exists() and not args.force:
                print(f"  [skip] {output_path.name} already exists")
                continue

            if args.dry_run:
                print(f"  [dry-run] Would generate: {output_path.name}")
                succeeded += 1
                continue

            print(f"  [gen] Generating {output_path.name}...")
            try:
                # Lazy-load estimator on first use
                if estimator is None:
                    from broken.externals.depthmap import DepthAnythingV2
                    estimator = DepthAnythingV2()

                img = Image.open(img_info["path"])
                depth = estimator.estimate(img)
                d_norm = ((depth - depth.min()) / (depth.max() - depth.min()) * 255).astype(np.uint8)
                depth_img = Image.fromarray(d_norm).resize(img.size, Image.LANCZOS)
                depth_img.save(str(output_path), quality=90)

                size_kb = output_path.stat().st_size / 1024
                print(f"  [done] {output_path.name} ({size_kb:.0f} KB)")
                succeeded += 1
            except Exception as e:
                print(f"  [error] {e}")
                failed += 1
        print()

    label = "Dry run complete" if args.dry_run else "Complete"
    print(f"{label}: {succeeded} succeeded, {failed} failed")


if __name__ == "__main__":
    main()
