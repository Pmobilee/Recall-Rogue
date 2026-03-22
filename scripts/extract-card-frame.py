#!/usr/bin/env python3
"""
Extract card frame layers from NEW_CARD.psd and generate all color variants as WebP files.
Output: public/assets/cardframes/v2/
"""

import colorsys
import json
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from psd_tools import PSDImage

# ── Paths ──────────────────────────────────────────────────────────────────────
REPO_ROOT = Path(__file__).parent.parent
PSD_PATH = REPO_ROOT / "data/generated/CARDFRAMES/NEW_CARD.psd"
OUT_DIR = REPO_ROOT / "public/assets/cardframes/v2"
LOWRES_DIR = OUT_DIR / "lowres"

CANVAS_W, CANVAS_H = 886, 1142
LOWRES_W, LOWRES_H = 443, 571

# ── Color specs ────────────────────────────────────────────────────────────────
BORDER_COLORS = {
    "attack":  (None, None),          # red — keep as-is (source is already red)
    "shield":  (0.58, 0.75),          # blue
    "buff":    (0.08, 0.80),          # amber/orange
    "debuff":  (0.78, 0.70),          # purple
    "utility": (0.48, 0.65),          # teal
    "wild":    (0.12, 0.85),          # gold
}

BANNER_COLORS = {
    "0": (0.53, 0.15),  # obsidian gray
    "1": (0.00, 0.75),  # crimson
    "2": (0.58, 0.75),  # azure blue
    "3": (0.08, 0.80),  # amber orange
    "4": (0.78, 0.70),  # violet purple
    "5": (0.46, 0.65),  # jade teal
}

WEBP_QUALITY_HIRES  = 90
WEBP_QUALITY_LOWRES = 80
BLACK_THRESHOLD     = 50


# ── Helpers ────────────────────────────────────────────────────────────────────

def layer_to_full_canvas(layer, canvas_w=CANVAS_W, canvas_h=CANVAS_H) -> Image.Image:
    """Composite a single PSD layer onto a transparent canvas of full size."""
    canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    img = layer.composite()
    if img is None:
        return canvas
    img = img.convert("RGBA")
    x, y = layer.left, layer.top
    canvas.paste(img, (x, y), img)
    return canvas


def colorize_preserving_black(
    img: Image.Image,
    target_hue: float,
    target_sat: float = 0.70,
    black_threshold: int = BLACK_THRESHOLD,
) -> Image.Image:
    """
    Recolour every non-black, non-transparent pixel to the target hue,
    preserving luminosity so shadows/highlights remain intact.
    Black pixels (r,g,b all < threshold) are left untouched.
    """
    arr = np.array(img).astype(np.float32)
    r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]

    brightness = 0.299 * r + 0.587 * g + 0.114 * b  # perceptual luminance

    is_black       = (r < black_threshold) & (g < black_threshold) & (b < black_threshold)
    is_transparent = a < 10
    mask           = ~is_black & ~is_transparent

    lum = brightness[mask] / 255.0
    sat = target_sat * np.minimum(lum * 2.0, 1.0)

    # vectorised HLS → RGB
    results = np.array(
        [colorsys.hls_to_rgb(target_hue, float(l), float(s)) for l, s in zip(lum, sat)],
        dtype=np.float32,
    )

    arr[mask, 0] = results[:, 0] * 255
    arr[mask, 1] = results[:, 1] * 255
    arr[mask, 2] = results[:, 2] * 255

    return Image.fromarray(arr.astype(np.uint8))


def save_webp(img: Image.Image, path: Path, quality: int, lossless: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if lossless:
        img.save(str(path), format="WEBP", lossless=True)
    else:
        img.save(str(path), format="WEBP", quality=quality, method=6)
    size_kb = path.stat().st_size // 1024
    print(f"  ✓ {path.relative_to(REPO_ROOT)}  ({size_kb} KB)")


def make_lowres(img: Image.Image) -> Image.Image:
    return img.resize((LOWRES_W, LOWRES_H), Image.LANCZOS)


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    if not PSD_PATH.exists():
        sys.exit(f"PSD not found: {PSD_PATH}")

    print(f"Opening {PSD_PATH} …")
    psd = PSDImage.open(str(PSD_PATH))

    layers = list(psd)
    print(f"Loaded {len(layers)} top-level layers")
    for i, l in enumerate(layers):
        print(f"  [{i}] '{l.name}'  visible={l.is_visible()}  "
              f"pos=({l.left},{l.top})  size={l.width}x{l.height}")

    # Layer references — mapped by name for safety
    layer_map = {l.name: l for l in layers}
    layer_base    = layer_map['Rest of the card that stays the same']
    layer_icon    = layer_map['Upgrade Icon']
    layer_border  = layer_map['Colored outside']
    layer_banner  = layer_map['banner']

    # ── 1. Base frame ──────────────────────────────────────────────────────────
    print("\n── Base frame ──")
    base_canvas = layer_to_full_canvas(layer_base)
    # The new PSD already has the art window transparent — no manual cutout needed.
    # Art goes BEHIND this layer and shows through the transparent window.
    out_path = OUT_DIR / "card-frame-base.webp"
    save_webp(base_canvas, out_path, quality=WEBP_QUALITY_HIRES, lossless=True)
    save_webp(make_lowres(base_canvas), LOWRES_DIR / "card-frame-base.webp",
              quality=WEBP_QUALITY_LOWRES)

    # ── 2. Upgrade icon ────────────────────────────────────────────────────────
    print("\n── Upgrade icon ──")
    icon_canvas = layer_to_full_canvas(layer_icon)
    out_path = OUT_DIR / "card-upgrade-icon.webp"
    save_webp(icon_canvas, out_path, quality=WEBP_QUALITY_HIRES)
    save_webp(make_lowres(icon_canvas), LOWRES_DIR / "card-upgrade-icon.webp",
              quality=WEBP_QUALITY_LOWRES)

    # ── 3. Border variants ─────────────────────────────────────────────────────
    print("\n── Border variants ──")
    border_raw = layer_to_full_canvas(layer_border)

    for name, (hue, sat) in BORDER_COLORS.items():
        if hue is None:
            # attack = source colour, no shift
            out_img = border_raw.copy()
        else:
            out_img = colorize_preserving_black(border_raw, hue, sat)

        fname = f"card-border-{name}.webp"
        save_webp(out_img, OUT_DIR / fname, quality=WEBP_QUALITY_HIRES)
        save_webp(make_lowres(out_img), LOWRES_DIR / fname, quality=WEBP_QUALITY_LOWRES)

    # ── 4. Banner variants ─────────────────────────────────────────────────────
    print("\n── Banner variants ──")
    banner_raw = layer_to_full_canvas(layer_banner)

    for chain_id, (hue, sat) in BANNER_COLORS.items():
        out_img = colorize_preserving_black(banner_raw, hue, sat)
        fname = f"card-banner-chain{chain_id}.webp"
        save_webp(out_img, OUT_DIR / fname, quality=WEBP_QUALITY_HIRES)
        save_webp(make_lowres(out_img), LOWRES_DIR / fname, quality=WEBP_QUALITY_LOWRES)

    # ── 5. Manifest JSON ───────────────────────────────────────────────────────
    print("\n── Manifest ──")
    manifest = {
        "canvas": {"width": CANVAS_W, "height": CANVAS_H},
        "layers": {
            "base": {"file": "card-frame-base.webp", "x": 0, "y": 0},
            "upgradeIcon": {
                "file": "card-upgrade-icon.webp",
                "x": 139, "y": 536, "width": 73, "height": 73,
            },
            "borders": {
                name: f"card-border-{name}.webp" for name in BORDER_COLORS
            },
            "banners": {
                chain_id: f"card-banner-chain{chain_id}.webp"
                for chain_id in BANNER_COLORS
            },
        },
        "guides": {
            "apCost":       {"x": 18,  "y": 7,   "width": 164, "height": 130},
            "mechanicName": {"x": 205, "y": 86,  "width": 478, "height": 86},
            "artWindow":    {"x": 194, "y": 186, "width": 498, "height": 412},
            "cardType":     {"x": 352, "y": 615, "width": 182, "height": 54},
            "effectText":   {"x": 134, "y": 667, "width": 640, "height": 376},
        },
    }

    manifest_path = OUT_DIR / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"  ✓ {manifest_path.relative_to(REPO_ROOT)}")

    # ── 6. Summary ─────────────────────────────────────────────────────────────
    print("\n── File listing ──")
    all_files = sorted(OUT_DIR.rglob("*"))
    for f in all_files:
        if f.is_file():
            size_kb = f.stat().st_size // 1024
            print(f"  {f.relative_to(REPO_ROOT)}  ({size_kb} KB)")

    print(f"\nDone! {sum(1 for f in all_files if f.is_file())} files generated.")


if __name__ == "__main__":
    main()
