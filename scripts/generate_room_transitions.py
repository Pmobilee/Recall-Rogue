#!/usr/bin/env python3
"""Generate room transition animations using DepthFlow 2.5D parallax."""

import argparse
import subprocess
import sys
from pathlib import Path
from PIL import Image

# Default paths
ROOMS_DIR = Path(__file__).parent.parent / "public/assets/backgrounds/rooms"
OUTPUT_BASE = ROOMS_DIR  # Output alongside source images

FPS = 30
DURATION = 2.0  # seconds


def get_image_dimensions(image_path: Path) -> tuple[int, int]:
    """Get width and height of an image."""
    with Image.open(image_path) as img:
        return img.size


def build_enter_command(image_path: Path, output_path: Path, width: int, height: int) -> list[str]:
    """Build DepthFlow CLI command for ENTER animation.

    ENTER: Camera dollies forward INTO the room (player arriving).
    - Dolly: ease-out (fast approach, gentle settle) — exponent 0.4
    - Walking bob: 4 vertical sine cycles, small amplitude (~0.03)
    - Vignette: heavy at start -> subtle at end (0.8 -> 0.15)
    - DOF blur: blurry at start -> clear at end
    - One-way, not looping
    """
    cmd = [
        "depthflow",
        # Input image
        "input", "-i", str(image_path),
        # Depth estimation
        "da2",
        # IMPORTANT: Filter commands must come FIRST — they replace the entire
        # state object each frame. Linear animations after them override specific fields.
        # Enable vignette post-processing (base values, overridden by linear below)
        "vignette", "-i", "0.5", "-d", "12",
        # Enable blur post-processing (DOF on mid-to-far range)
        "blur", "-i", "0.5", "-a", "0.3", "-b", "0.8",
        # Dolly forward with ease-out (exponent < 1)
        "linear", "-t", "dolly",
            "--start", "0.0", "--end", "1.0",
            "--low", "0.0", "--high", "0.35",
            "--exponent", "0.4",
        # Walking bob: 4 vertical sine oscillations (subtle)
        "sine", "-t", "height",
            "--amplitude", "0.025",
            "--cycles", "4",
            "--phase", "0.0",
            "--bias", "0.0",
        # Vignette animation: heavy -> subtle (entering room = opening up)
        "linear", "-t", "vignette.intensity",
            "--start", "0.0", "--end", "1.0",
            "--low", "0.8", "--high", "0.15",
            "--exponent", "0.5",
        # Vignette decay (shape) - moderate
        "set", "-t", "vignette.decay", "-v", "12",
        # DOF blur: blurry at start, clear at end
        "linear", "-t", "blur.intensity",
            "--start", "0.0", "--end", "0.7",
            "--low", "0.6", "--high", "0.0",
            "--exponent", "0.5",
        # H264 encoder
        "h264",
        # Render settings
        "main", "-r",
            "-o", str(output_path),
            "-t", str(DURATION),
            "-f", str(FPS),
            "-w", str(width),
            "-h", str(height),
    ]
    return cmd


def build_exit_command(image_path: Path, output_path: Path, width: int, height: int) -> list[str]:
    """Build DepthFlow CLI command for EXIT animation.

    EXIT: Camera dollies forward THROUGH the archway into darkness (leaving room).
    - Dolly: ease-in (slow start, accelerating rush) — exponent 2.5
    - Walking bob: 4 vertical sine cycles, slightly larger amplitude
    - Zoom: accelerating zoom in last third toward archway center
    - Vignette: subtle at start -> extremely heavy at end (closing to black)
    - DOF blur: clear at start -> foreground blurs as camera pushes past
    - Brightness fade to black in last 25%
    - One-way, not looping
    """
    cmd = [
        "depthflow",
        # Input image
        "input", "-i", str(image_path),
        # Depth estimation
        "da2",
        # IMPORTANT: Filter commands must come FIRST — they replace the entire
        # state object each frame. Linear animations after them override specific fields.
        # Enable vignette post-processing (base values, overridden by linear below)
        "vignette", "-i", "0.5", "-d", "20",
        # Enable blur post-processing (DOF on mid-far range)
        "blur", "-i", "0.5", "-a", "0.4", "-b", "0.8",
        # Dolly forward with ease-in (exponent > 1)
        "linear", "-t", "dolly",
            "--start", "0.0", "--end", "1.0",
            "--low", "0.0", "--high", "0.3",
            "--exponent", "2.5",
        # Zoom: accelerating in last half (pushing through archway)
        # zoom default is 1.0 (full frame), so we go from normal to zoomed in
        "linear", "-t", "zoom",
            "--start", "0.5", "--end", "1.0",
            "--low", "1.0", "--high", "1.4",
            "--exponent", "2.0",
        # Walking bob: 4 vertical sine cycles (slightly more pronounced)
        "sine", "-t", "height",
            "--amplitude", "0.03",
            "--cycles", "4",
            "--phase", "0.0",
            "--bias", "0.0",
        # Vignette animation: very subtle at start -> extremely heavy at end
        "linear", "-t", "vignette.intensity",
            "--start", "0.0", "--end", "1.0",
            "--low", "0.05", "--high", "1.0",
            "--exponent", "2.5",
        # Vignette decay gets tighter in last half (smaller circle of visibility)
        "linear", "-t", "vignette.decay",
            "--start", "0.5", "--end", "1.0",
            "--low", "20", "--high", "4",
            "--exponent", "1.5",
        # DOF blur: clear at start, gentle blur in second half as camera pushes past furniture
        "linear", "-t", "blur.intensity",
            "--start", "0.4", "--end", "0.9",
            "--low", "0.0", "--high", "0.6",
            "--exponent", "1.5",
        # Brightness fade to black in last 25%
        # colors.brightness: 100 = normal, 0 = black (scale is 0-200)
        # Linear clamps to --low before --start time, so 100 keeps normal brightness until t=0.75
        "linear", "-t", "colors.brightness",
            "--start", "0.75", "--end", "1.0",
            "--low", "100", "--high", "0",
            "--exponent", "2.0",
        # H264 encoder
        "h264",
        # Render settings
        "main", "-r",
            "-o", str(output_path),
            "-t", str(DURATION),
            "-f", str(FPS),
            "-w", str(width),
            "-h", str(height),
    ]
    return cmd


def discover_rooms(rooms_dir: Path) -> list[dict]:
    """Discover room directories containing landscape.webp and/or portrait.webp."""
    rooms = []
    if not rooms_dir.exists():
        print(f"Error: Rooms directory not found: {rooms_dir}")
        sys.exit(1)

    for room_dir in sorted(rooms_dir.iterdir()):
        if not room_dir.is_dir():
            continue
        # Skip 'transitions' subdirectories
        if room_dir.name == "transitions":
            continue

        room = {"id": room_dir.name, "path": room_dir, "images": []}

        for orientation in ("landscape", "portrait"):
            img_path = room_dir / f"{orientation}.webp"
            if not img_path.exists():
                # Also check .png
                img_path = room_dir / f"{orientation}.png"
            if img_path.exists():
                room["images"].append({
                    "orientation": orientation,
                    "path": img_path,
                })

        if room["images"]:
            rooms.append(room)

    return rooms


def process_image(
    room_id: str,
    orientation: str,
    image_path: Path,
    output_dir: Path,
    force: bool = False,
    dry_run: bool = False,
    anim_type_filter: str | None = None,
) -> bool:
    """Process a single image: generate enter and/or exit transition videos.

    Args:
        room_id: Room identifier string.
        orientation: 'landscape' or 'portrait'.
        image_path: Path to the source image file.
        output_dir: Directory where output MP4s will be written.
        force: If True, regenerate existing outputs.
        dry_run: If True, print what would be done without running commands.
        anim_type_filter: If 'enter' or 'exit', generate only that type.
                          If None, generate both.
    """
    width, height = get_image_dimensions(image_path)

    # Slightly oversized render for walking bob headroom (5% padding)
    render_width = int(width * 1.05)
    render_height = int(height * 1.05)
    # Round to even numbers (required by H264)
    render_width = render_width + (render_width % 2)
    render_height = render_height + (render_height % 2)

    output_dir.mkdir(parents=True, exist_ok=True)

    # Determine which animation types to generate
    anim_types = ["enter", "exit"]
    if anim_type_filter is not None:
        anim_types = [anim_type_filter]

    success = True
    for anim_type in anim_types:
        output_path = output_dir / f"{orientation}_{anim_type}.mp4"

        if output_path.exists() and not force:
            print(f"  [skip] {output_path.name} already exists (use --force to regenerate)")
            continue

        if dry_run:
            print(f"  [dry-run] Would generate: {output_path.name} ({render_width}x{render_height})")
            continue

        print(f"  [render] Generating {output_path.name} ({render_width}x{render_height})...")

        if anim_type == "enter":
            cmd = build_enter_command(image_path, output_path, render_width, render_height)
        else:
            cmd = build_exit_command(image_path, output_path, render_width, render_height)

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300,  # 5 minute timeout per render
            )
            if result.returncode != 0:
                print(f"  [error] Failed to generate {output_path.name}:")
                if result.stderr:
                    print(f"          {result.stderr[-500:]}")
                else:
                    print("          (no stderr)")
                success = False
            else:
                if output_path.exists():
                    # Re-encode for browser compatibility (DepthFlow's raw H264 can fail in Chrome)
                    tmp_path = output_path.with_suffix(".tmp.mp4")
                    reencode = subprocess.run(
                        [
                            "ffmpeg", "-y", "-i", str(output_path),
                            "-c:v", "libx264", "-profile:v", "main", "-level", "3.1",
                            "-preset", "slow", "-crf", "20",
                            "-pix_fmt", "yuv420p", "-movflags", "+faststart",
                            "-an", str(tmp_path),
                        ],
                        capture_output=True, text=True, timeout=60,
                    )
                    if reencode.returncode == 0 and tmp_path.exists():
                        tmp_path.replace(output_path)
                    else:
                        print(f"  [warn]  Re-encode failed, keeping original")
                        if tmp_path.exists():
                            tmp_path.unlink()

                    size_mb = output_path.stat().st_size / (1024 * 1024)
                    print(f"  [done]  {output_path.name} ({size_mb:.1f} MB)")
                else:
                    print(f"  [warn]  Command succeeded but output not found at {output_path}")
                    success = False
        except subprocess.TimeoutExpired:
            print(f"  [timeout] Render timed out for {output_path.name}")
            success = False
        except FileNotFoundError:
            print("  [error] depthflow command not found. Install with: pip install depthflow")
            sys.exit(1)

    return success


def main():
    parser = argparse.ArgumentParser(
        description="Generate room transition animations using DepthFlow 2.5D parallax"
    )
    parser.add_argument(
        "--rooms-dir", type=Path, default=ROOMS_DIR,
        help=f"Directory containing room backgrounds (default: {ROOMS_DIR})"
    )
    parser.add_argument(
        "--room", type=str, default=None,
        help="Process a single room by ID (e.g., 'shop')"
    )
    parser.add_argument(
        "--orientation", type=str, choices=["landscape", "portrait"], default=None,
        help="Process only one orientation (default: both)"
    )
    parser.add_argument(
        "--force", action="store_true",
        help="Regenerate existing transition videos"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="List what would be processed without generating"
    )
    parser.add_argument(
        "--type", type=str, choices=["enter", "exit"], default=None,
        dest="anim_type",
        help="Generate only enter or exit transitions (default: both)"
    )
    args = parser.parse_args()

    rooms = discover_rooms(args.rooms_dir)

    if not rooms:
        print(f"No rooms found in {args.rooms_dir}")
        sys.exit(1)

    # Filter to single room if specified
    if args.room:
        rooms = [r for r in rooms if r["id"] == args.room]
        if not rooms:
            print(f"Room '{args.room}' not found. Available rooms:")
            all_rooms = discover_rooms(args.rooms_dir)
            for r in all_rooms:
                print(f"  - {r['id']}")
            sys.exit(1)

    # Filter orientation if specified
    if args.orientation:
        for room in rooms:
            room["images"] = [img for img in room["images"] if img["orientation"] == args.orientation]

    # Count how many animations will be produced
    anim_types_count = 1 if args.anim_type else 2
    total = sum(len(r["images"]) * anim_types_count for r in rooms)
    image_count = sum(len(r["images"]) for r in rooms)

    print(f"\nRoom Transition Generator")
    print(f"  Rooms: {len(rooms)} | Images: {image_count} | Animations: {total}")
    print(f"  Duration: {DURATION}s @ {FPS}fps | Codec: H264")
    if args.anim_type:
        print(f"  Type filter: {args.anim_type} only")
    if args.dry_run:
        print(f"  Mode: DRY RUN")
    print()

    succeeded = 0
    failed = 0

    for room in rooms:
        print(f"Room: {room['id']}")
        output_dir = room["path"] / "transitions"

        for img_info in room["images"]:
            print(f"  Image: {img_info['orientation']} ({img_info['path'].name})")
            ok = process_image(
                room_id=room["id"],
                orientation=img_info["orientation"],
                image_path=img_info["path"],
                output_dir=output_dir,
                force=args.force,
                dry_run=args.dry_run,
                anim_type_filter=args.anim_type,
            )
            if ok:
                succeeded += 1
            else:
                failed += 1
        print()

    label = "Dry run complete" if args.dry_run else "Complete"
    print(f"{label}: {succeeded} succeeded, {failed} failed")


if __name__ == "__main__":
    main()
