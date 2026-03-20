#!/usr/bin/env python3
"""
extract-camp-upgrades.py

Extracts all camp upgrade layers from NEW_CAMP_WITH_UPGRADES.psd into
individual full-canvas WebP sprites. Each sprite is 1536x2784 with the
element composited at its correct position on a transparent background.

Output: public/assets/camp/upgrades/<element>/tier-N.webp
"""

import os
import sys
from pathlib import Path
from PIL import Image
from psd_tools import PSDImage

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

PSD_PATH = Path(__file__).parent.parent / "data/generated/camp-art/NEW_CAMP_WITH_UPGRADES.psd"
OUTPUT_DIR = Path(__file__).parent.parent / "public/assets/camp/upgrades"

CANVAS_W = 1536
CANVAS_H = 2784

# Layer name -> canonical element key (case-insensitive matching applied below)
ELEMENT_MAP = {
    "cave background":    "background",
    "tent":               "tent",
    "character":          "character",
    "pet":                "pet",
    "campfire":           "campfire",
    "fireplace":          "campfire",
    "library":            "library",
    "questboard":         "questboard",
    "quest board":        "questboard",
    "quest":              "questboard",
    "shop":               "shop",
    "journal":            "journal",
    "doorway":            "doorway",
    "dungeon entrance":   "doorway",
    "dungeon entry":      "doorway",
    "settings":           "settings",
}

def resolve_element(layer_name: str) -> str | None:
    """Return canonical element key for a layer name, or None if unknown."""
    name_lower = layer_name.strip().lower()
    # Exact match first
    if name_lower in ELEMENT_MAP:
        return ELEMENT_MAP[name_lower]
    # Prefix/substring match
    for key, value in ELEMENT_MAP.items():
        if name_lower.startswith(key) or key.startswith(name_lower):
            return value
    return None


def composite_layer_onto_canvas(layer) -> Image.Image:
    """
    Composite a pixel layer onto a full-canvas RGBA transparent image.
    The layer is placed at (layer.left, layer.top).
    """
    canvas = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))

    try:
        # Use topil() to read raw pixel data directly from the layer record.
        # composite() / composite(force=True) both return fully transparent results
        # when the parent group is marked not-visible in the PSD.
        layer_img = layer.topil()
        if layer_img is None:
            print(f"    WARNING: layer.topil() returned None for '{layer.name}'")
            return canvas

        # Ensure RGBA
        if layer_img.mode != "RGBA":
            layer_img = layer_img.convert("RGBA")

        x, y = layer.left, layer.top

        # Clip to canvas bounds just in case
        if x < 0 or y < 0:
            # Crop the portion that extends off the left/top
            crop_x = max(0, -x)
            crop_y = max(0, -y)
            layer_img = layer_img.crop((crop_x, crop_y, layer_img.width, layer_img.height))
            x = max(0, x)
            y = max(0, y)

        canvas.paste(layer_img, (x, y), layer_img)

    except Exception as e:
        print(f"    ERROR compositing layer '{layer.name}': {e}")

    return canvas


def save_webp(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(str(path), "WEBP", lossless=True)
    size_kb = path.stat().st_size // 1024
    print(f"    Saved: {path.relative_to(OUTPUT_DIR.parent.parent)} ({size_kb} KB)")


def main():
    if not PSD_PATH.exists():
        print(f"ERROR: PSD not found at {PSD_PATH}")
        sys.exit(1)

    print(f"Opening PSD: {PSD_PATH}")
    psd = PSDImage.open(str(PSD_PATH))
    print(f"Canvas size: {psd.width}x{psd.height}")
    print(f"Top-level layers: {len(psd)}")
    print()

    extracted = {}   # element -> list of (tier, path)
    skipped = []

    for layer in psd:
        name = layer.name
        kind = layer.kind

        # ----------------------------------------------------------------
        # Background (top-level pixel layer)
        # ----------------------------------------------------------------
        if kind == "pixel":
            element = resolve_element(name)
            if element == "background":
                print(f"[background] Extracting '{name}' ...")
                img = composite_layer_onto_canvas(layer)
                out_path = OUTPUT_DIR / "background" / "base.webp"
                save_webp(img, out_path)
                extracted.setdefault("background", []).append(("base", out_path))
            else:
                print(f"  SKIP top-level pixel layer '{name}' (unrecognised)")
                skipped.append(name)
            continue

        # ----------------------------------------------------------------
        # Groups → tier-N sprites
        # ----------------------------------------------------------------
        if kind == "group":
            # Parse tier number from group name "Group N"
            group_name = name.strip()
            try:
                tier = int(group_name.split()[-1])
            except (ValueError, IndexError):
                print(f"  SKIP group '{name}' — cannot parse tier number")
                skipped.append(name)
                continue

            print(f"[Group {tier}] Processing {len(layer)} child layers ...")

            for child in layer:
                element = resolve_element(child.name)
                if element is None:
                    print(f"  SKIP unknown layer '{child.name}' in Group {tier}")
                    skipped.append(f"Group {tier}/{child.name}")
                    continue

                print(f"  [{element}] tier-{tier} ← '{child.name}' bbox=({child.left},{child.top},{child.right},{child.bottom})")
                img = composite_layer_onto_canvas(child)
                out_path = OUTPUT_DIR / element / f"tier-{tier}.webp"
                save_webp(img, out_path)
                extracted.setdefault(element, []).append((f"tier-{tier}", out_path))

    # ----------------------------------------------------------------
    # Summary
    # ----------------------------------------------------------------
    print()
    print("=" * 60)
    print("EXTRACTION COMPLETE")
    print("=" * 60)
    total = 0
    for element in sorted(extracted.keys()):
        tiers = extracted[element]
        tier_labels = [t[0] for t in tiers]
        print(f"  {element:<15} {len(tiers)} file(s): {', '.join(tier_labels)}")
        total += len(tiers)

    print(f"\nTotal sprites extracted: {total}")
    print(f"Output directory: {OUTPUT_DIR}")

    if skipped:
        print(f"\nSkipped layers ({len(skipped)}):")
        for s in skipped:
            print(f"  - {s}")


if __name__ == "__main__":
    main()
