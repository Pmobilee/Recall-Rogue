#!/usr/bin/env python3
"""Render transition GIFs that match the in-game WebGL parallax shader exactly."""

import argparse
import math
import numpy as np
from PIL import Image
from pathlib import Path

def render_frame(image: np.ndarray, depth: np.ndarray, dolly: float, zoom: float,
                 vignette_val: float, brightness: float, bob_px: float) -> np.ndarray:
    """Render one frame using the same math as ParallaxTransition.svelte's fragment shader."""
    h, w = image.shape[:2]

    # Create UV coordinate grids (0 to 1)
    uy = np.linspace(0, 1, h)
    ux = np.linspace(0, 1, w)
    uv_x, uv_y = np.meshgrid(ux, uy)

    # Depth map (normalized 0-1, single channel)
    d = depth.astype(np.float32) / 255.0

    # Parallax displacement
    from_center_x = uv_x - 0.5
    from_center_y = uv_y - 0.5

    displaced_x = uv_x + from_center_x * d * dolly
    displaced_y = uv_y + from_center_y * d * dolly

    # Zoom from center
    displaced_x = 0.5 + (displaced_x - 0.5) / zoom
    displaced_y = 0.5 + (displaced_y - 0.5) / zoom

    # Walking bob: shift the entire image vertically (in pixel space, converted to UV)
    displaced_y += bob_px / h

    # Sample image at displaced coordinates using bilinear interpolation
    # Convert UV back to pixel coords
    src_x = (displaced_x * (w - 1)).astype(np.float32)
    src_y = (displaced_y * (h - 1)).astype(np.float32)

    # Clamp and create out-of-bounds mask
    oob = (src_x < 0) | (src_x >= w - 1) | (src_y < 0) | (src_y >= h - 1)
    src_x_clamped = np.clip(src_x, 0, w - 2).astype(np.int32)
    src_y_clamped = np.clip(src_y, 0, h - 2).astype(np.int32)

    # Simple nearest-neighbor sampling (good enough for GIF)
    result = image[src_y_clamped, src_x_clamped].astype(np.float32)

    # Black for out-of-bounds
    result[oob] = 0

    # Vignette
    uv_vig_x = uv_x * (1 - uv_x)
    uv_vig_y = uv_y * (1 - uv_y)
    vig = uv_vig_x * uv_vig_y * 15.0
    vig = np.clip(np.power(vig, vignette_val * 0.5 + 0.01), 0, 1)
    result *= vig[:, :, np.newaxis]

    # Brightness
    result *= brightness

    return np.clip(result, 0, 255).astype(np.uint8)


def render_transition(image_path: str, depth_path: str, transition_type: str,
                      output_path: str, fps: int = 20, duration: float = 2.0,
                      width: int = 480):
    """Render a complete transition animation as GIF."""
    img = Image.open(image_path).convert('RGB')
    depth_img = Image.open(depth_path).convert('L')

    # Resize to target width maintaining aspect ratio
    aspect = img.height / img.width
    target_h = int(width * aspect)
    img = img.resize((width, target_h), Image.LANCZOS)
    depth_img = depth_img.resize((width, target_h), Image.LANCZOS)

    image = np.array(img)
    depth = np.array(depth_img)

    total_frames = int(fps * duration)
    frames = []

    for i in range(total_frames):
        t = i / (total_frames - 1)

        if transition_type == 'enter':
            eased = 1 - (1 - t) ** 2.5
            dolly = 0.25 * (1 - eased)
            zoom = 1.1 - eased * 0.1
            vignette = 0.9 - eased * 0.8
            brightness = min(t / 0.2, 1.0)
            bob = math.sin(t * math.pi * 2 * 4) * 8 * (1 - eased)
        elif transition_type == 'exit-forward':
            eased = t ** 2.0
            dolly = eased * 0.5
            zoom = 1.0 + eased * 0.4
            vignette = 0.1 + eased * 0.9
            brightness = 1 - ((t - 0.7) / 0.3) ** 2 if t > 0.7 else 1.0
            bob = math.sin(t * math.pi * 2 * 4) * 10 * eased
        else:  # exit-backward
            eased = t ** 2.0
            dolly = eased * -0.2
            zoom = 1.0 - eased * 0.05
            vignette = 0.1 + eased * 0.9
            brightness = 1 - ((t - 0.7) / 0.3) ** 2 if t > 0.7 else 1.0
            bob = math.sin(t * math.pi * 2 * 4) * 6 * min(eased * 3, 1)

        frame = render_frame(image, depth, dolly, zoom, vignette, brightness, bob)
        frames.append(Image.fromarray(frame))

    # Write frames to temp directory, then use ffmpeg for high-quality GIF encoding
    import tempfile
    import subprocess
    import shutil

    tmpdir = Path(tempfile.mkdtemp(prefix="transition_"))
    try:
        for i, frame in enumerate(frames):
            frame.save(str(tmpdir / f"frame_{i:04d}.png"))

        # ffmpeg: frames → palette-optimized GIF (much better than PIL's encoder)
        palette_path = str(tmpdir / "palette.png")
        subprocess.run([
            "ffmpeg", "-y", "-framerate", str(fps),
            "-i", str(tmpdir / "frame_%04d.png"),
            "-vf", "split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=4",
            "-loop", "0", output_path,
        ], capture_output=True, check=True)
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)

    size_mb = Path(output_path).stat().st_size / (1024 * 1024)
    print(f"Saved: {output_path} ({size_mb:.1f} MB, {len(frames)} frames)")


def main():
    parser = argparse.ArgumentParser(description="Render transition GIFs matching the in-game shader")
    parser.add_argument("--room", default="shop", help="Room ID")
    parser.add_argument("--type", choices=["enter", "exit-forward", "exit-backward"], default="enter")
    parser.add_argument("--orientation", choices=["landscape", "portrait"], default="landscape")
    parser.add_argument("--output", default=None, help="Output path (default: transition_{type}.gif in project root)")
    parser.add_argument("--width", type=int, default=1280, help="Output width in pixels")
    parser.add_argument("--fps", type=int, default=20)
    parser.add_argument("--duration", type=float, default=2.0)
    args = parser.parse_args()

    base = Path(__file__).parent.parent / "public/assets/backgrounds/rooms" / args.room
    image_path = str(base / f"{args.orientation}.webp")
    depth_path = str(base / f"{args.orientation}_depth.webp")

    output = args.output or f"transition_{args.type.replace('-', '_')}.gif"

    print(f"Rendering {args.type} transition for {args.room}/{args.orientation}")
    render_transition(image_path, depth_path, args.type, output, args.fps, args.duration, args.width)


if __name__ == "__main__":
    main()
