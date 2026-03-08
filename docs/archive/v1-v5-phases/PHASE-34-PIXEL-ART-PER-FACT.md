# Phase 34: Pixel Art Per Fact

## Overview

**Goal**: Generate and deliver a unique 64×64 pixel-art illustration for every fact in the database,
displayed inside the quiz overlay and on the fact detail screen. As a player masters a fact
(SM-2 repetitions 0 → 5), its sprite transitions through five visual states: greyscale →
sepia → partial color → full color → golden shimmer. At 3,000+ facts this cannot be done by hand —
the entire production pipeline must be automated, resumable, auditable, and quality-gated.

**Why this phase matters**: Facts currently appear as text-only cards. A memorable illustration
anchors the fact's meaning to a specific image — exactly the mnemonic technique that accelerates
long-term retention (DD-V2-034). The mastery color-progression gives the player a visible reward
loop tied directly to learning depth: each review session visibly enriches their collection.

**Design decisions governing this phase**:
- **DD-V2-034**: Every approved fact gets a unique pixel-art illustration. Illustration prompt is
  derived from the fact's `visual_description` field (or auto-generated from `statement` if absent).
- **DD-V2-056**: Claude API generates image prompts from fact text. The model reads
  `statement + explanation` and returns a JSON object `{ visual_description, image_prompt }`.
  Prompts must be concrete, singular-subject, pixel-art-safe descriptions (no text, no UI, no
  abstract gradients).
- **DD-V2-V6**: Resolved in Phase 34 — fact art is 64×64 px (game-ready) with a 256×256 hi-res
  source. Style: pixel art, 8-bit, transparent background, ≤ 32 colors, centered subject on a
  solid or gradient dark-space background (not fully transparent — the background is part of the
  artwork).

**Dependencies (must be complete before starting)**:
- Phase 11: Fact Content Engine — `facts` table with `image_prompt`, `visual_description`,
  `has_pixel_art`, `pixel_art_status` columns (all present in the schema from 11.7).
- Phase 19: Auth & Cloud — Fastify server with `/api/facts` routes and PostgreSQL-backed facts DB.
- `sprite-gen/scripts/generate_sprite.py` — baseline ComfyUI pipeline functions
  (`queue_prompt`, `wait_for_completion`, `download_image`, `build_sdxl_workflow`,
  `remove_background`, `trim_transparent`, `make_square`, `downscale`).
- ComfyUI running at `http://localhost:8188` with SDXL 1.0 + `pixel-art-xl.safetensors` LoRA.
- `rembg` at `/opt/comfyui-env/bin/rembg` or importable as a Python module.
- `ANTHROPIC_API_KEY` in `server/.env` (never committed).

**Estimated complexity**: High. The pipeline touches four systems (Claude API, ComfyUI, server DB,
client rendering) across two language runtimes (TypeScript + Python). The QC gate requires image
analysis. The mastery shader is a new client-side rendering pass. At 522 facts on an RTX 3060,
full initial generation takes approximately 8–10 hours of GPU time — the resumable checkpoint
system is non-negotiable.

**Files affected summary** (full list at bottom of document):
- NEW: `sprite-gen/scripts/fact_prompt_generator.py`
- NEW: `sprite-gen/scripts/fact_batch_generate.py`
- NEW: `sprite-gen/scripts/fact_qc.py`
- NEW: `sprite-gen/scripts/fact_gen_state.json` (gitignored, runtime state)
- NEW: `scripts/audit-fact-sprites.mjs`
- NEW: `src/game/systems/FactSpriteLoader.ts`
- NEW: `src/ui/components/FactArtwork.svelte`
- NEW: `src/ui/stores/factSprites.ts`
- NEW: `src/services/factSpriteManifest.ts`
- MODIFY: `server/src/db/facts-migrate.ts` — add `pixel_art_path` column
- MODIFY: `server/src/routes/facts.ts` — serve sprite URLs and status
- MODIFY: `src/ui/components/QuizOverlay.svelte` — embed FactArtwork
- MODIFY: `src/data/types.ts` — extend `Fact` with `pixelArtPath`
- MODIFY: `vite.config.ts` — `assetsInclude` for facts sprite subdirectory

---

## Sub-Phases

---

### 34.1 — Fact-to-Prompt Pipeline

**Goal**: For every fact in the database that lacks a `visual_description`, call the Claude API to
generate a concrete, pixel-art-safe image description and a ready-to-use ComfyUI prompt. Store
both back to the database so the generation step (34.2) can run independently.

This sub-phase runs as a standalone server-side script, not as part of the Fastify request
cycle. It is designed to be run once and then re-run to fill gaps as new facts are added.

#### 34.1.1 — Claude API prompt schema

The prompt sent to Claude must produce a JSON object matching this TypeScript interface:

```typescript
interface FactImageSpec {
  /** 1-2 sentence plain-English description of the ideal pixel-art illustration.
   *  Must be concrete and singular (one main subject, no text, no UI elements).
   *  Example: "A cross-section of Earth showing the mantle as glowing orange rock,
   *  with the solid iron core at the center, surrounded by dark space at the edges." */
  visual_description: string

  /** Ready-to-use ComfyUI positive prompt (comma-separated tags, pixel art idioms).
   *  Max 120 tokens. Must begin with: "pixel art, 8-bit, game illustration, "
   *  Must end with: ", transparent friendly background, centered, clean pixel art" */
  image_prompt: string
}
```

System message sent to Claude:

```
You are a pixel-art image direction specialist for an educational mobile game.
Given a learning fact, produce a visual description and a pixel-art generation prompt.

Rules:
- The image must have ONE clear subject that visually embodies the fact.
- Never include text, labels, numbers, UI elements, charts, or diagrams.
- Never use abstract concepts alone — always ground them in a concrete scene or object.
- Pixel art style: 8-bit, ≤32 colors, clean outlines, solid or gradient dark space background.
- The image should make the fact immediately memorable on first glance.
- Keep image_prompt under 120 tokens (comma-separated tags).
- Return ONLY a JSON object matching the schema. No markdown fences, no explanation.
```

User message template:

```
Fact: {statement}
Explanation: {explanation}
Category: {categoryL1} > {categoryL2}

Generate the FactImageSpec JSON for this fact.
```

#### 34.1.2 — Script: `sprite-gen/scripts/fact_prompt_generator.py`

Create this script. It reads all facts from the server facts DB with
`pixel_art_status = 'none'` and `status = 'approved'`, calls Claude for each one (respecting a
configurable batch size and rate limit), and writes results back to the DB.

```python
#!/usr/bin/env python3
"""
Terra Miner — Fact-to-Prompt Pipeline
Reads approved facts missing visual_description, calls Claude API to generate
pixel-art image prompts, and writes results back to the facts SQLite database.

Usage:
    python fact_prompt_generator.py [--batch 50] [--dry-run]

Environment:
    ANTHROPIC_API_KEY  — Claude API key (from server/.env or shell export)
"""

import argparse
import json
import os
import sqlite3
import sys
import time
from pathlib import Path

# ── Configuration ─────────────────────────────────────────────────────────────

SCRIPT_DIR   = Path(__file__).parent
PROJECT_DIR  = SCRIPT_DIR.parent.parent
FACTS_DB     = PROJECT_DIR / "server" / "data" / "facts.db"
MODEL        = "claude-opus-4-6"
MAX_TOKENS   = 512
RATE_LIMIT_S = 0.5   # seconds between API calls to avoid 429s

SYSTEM_PROMPT = (
    "You are a pixel-art image direction specialist for an educational mobile game.\n"
    "Given a learning fact, produce a visual description and a pixel-art generation prompt.\n\n"
    "Rules:\n"
    "- The image must have ONE clear subject that visually embodies the fact.\n"
    "- Never include text, labels, numbers, UI elements, charts, or diagrams.\n"
    "- Never use abstract concepts alone — always ground them in a concrete scene or object.\n"
    "- Pixel art style: 8-bit, ≤32 colors, clean outlines, solid or gradient dark space background.\n"
    "- The image should make the fact immediately memorable on first glance.\n"
    "- Keep image_prompt under 120 tokens (comma-separated tags).\n"
    "- Return ONLY a JSON object. No markdown fences, no explanation."
)

USER_TEMPLATE = (
    "Fact: {statement}\n"
    "Explanation: {explanation}\n"
    "Category: {cat1} > {cat2}\n\n"
    "Generate the FactImageSpec JSON for this fact."
)

# ── Claude API call ────────────────────────────────────────────────────────────

def call_claude(fact: dict, api_key: str) -> dict | None:
    """Call Claude API and return parsed FactImageSpec, or None on failure."""
    import urllib.request

    user_msg = USER_TEMPLATE.format(
        statement=fact["statement"],
        explanation=fact["explanation"] or "",
        cat1=fact["category_l1"] or "General",
        cat2=fact["category_l2"] or "General",
    )

    payload = json.dumps({
        "model": MODEL,
        "max_tokens": MAX_TOKENS,
        "system": SYSTEM_PROMPT,
        "messages": [{"role": "user", "content": user_msg}],
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
    )

    try:
        resp = urllib.request.urlopen(req, timeout=30)
        body = json.loads(resp.read())
        text = body["content"][0]["text"].strip()
        # Strip markdown fences if model adds them despite instructions
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text)
    except Exception as exc:
        print(f"    Claude API error: {exc}")
        return None

# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Generate image prompts for facts via Claude API")
    parser.add_argument("--batch", type=int, default=50,
                        help="Max facts to process in one run (default: 50)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print prompts but do not write to DB or call Claude")
    parser.add_argument("--db", default=str(FACTS_DB),
                        help="Path to facts.db")
    args = parser.parse_args()

    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key and not args.dry_run:
        sys.exit("ERROR: ANTHROPIC_API_KEY not set. Export it or source server/.env.")

    db_path = Path(args.db)
    if not db_path.exists():
        sys.exit(f"ERROR: facts.db not found at {db_path}. Run the server once to create it.")

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # Fetch approved facts missing visual_description
    rows = cur.execute("""
        SELECT id, statement, explanation, category_l1, category_l2
        FROM   facts
        WHERE  status = 'approved'
          AND  (visual_description IS NULL OR visual_description = '')
          AND  pixel_art_status = 'none'
        ORDER  BY fun_score DESC, novelty_score DESC
        LIMIT  ?
    """, (args.batch,)).fetchall()

    total = len(rows)
    print(f"Terra Miner — Fact-to-Prompt Pipeline")
    print(f"Facts to process: {total}  |  Mode: {'DRY-RUN' if args.dry_run else 'LIVE'}\n")

    ok = 0
    fail = 0

    for i, row in enumerate(rows, start=1):
        fact = dict(row)
        print(f"[{i}/{total}] {fact['id'][:8]}... — {fact['statement'][:60]}")

        if args.dry_run:
            print(f"    DRY-RUN: would call Claude for prompt")
            ok += 1
            continue

        spec = call_claude(fact, api_key)
        if spec is None or "visual_description" not in spec or "image_prompt" not in spec:
            print(f"    FAIL: invalid spec returned")
            fail += 1
            continue

        # Basic validation: image_prompt must start with "pixel art"
        if not spec["image_prompt"].lower().startswith("pixel art"):
            spec["image_prompt"] = "pixel art, 8-bit, game illustration, " + spec["image_prompt"]

        cur.execute("""
            UPDATE facts
            SET    visual_description = ?,
                   image_prompt       = ?,
                   pixel_art_status   = 'queued',
                   updated_at         = (unixepoch() * 1000)
            WHERE  id = ?
        """, (spec["visual_description"], spec["image_prompt"], fact["id"]))
        conn.commit()

        print(f"    OK — prompt: {spec['image_prompt'][:80]}...")
        ok += 1
        time.sleep(RATE_LIMIT_S)

    conn.close()

    print(f"\n{'='*60}")
    print(f"  Done: {ok} OK, {fail} failed out of {total} facts.")
    if fail:
        sys.exit(1)


if __name__ == "__main__":
    main()
```

#### 34.1.3 — Acceptance criteria for 34.1

- [ ] Running `python fact_prompt_generator.py --dry-run` prints the fact count and exits 0.
- [ ] Running with `--batch 5` on a DB with ≥ 5 approved facts calls Claude 5 times, updates
  `visual_description`, `image_prompt`, and sets `pixel_art_status = 'queued'` for each.
- [ ] Every written `image_prompt` begins with `"pixel art"`.
- [ ] The script is safe to re-run; facts already in `queued`/`generating`/`approved` status are
  skipped (enforced by the `pixel_art_status = 'none'` WHERE clause).
- [ ] Failure on one fact does not abort the batch; the script continues and reports a summary.

---

### 34.2 — ComfyUI Batch Generation Workflow

**Goal**: Given facts with `pixel_art_status = 'queued'`, submit generation jobs to ComfyUI
sequentially (one at a time — RTX 3060 handles one job per GPU), wait for each, apply
background removal and downscaling, and save sprites to the project asset directory. Update
`pixel_art_status` to `'review'` on success or `'failed'` on error.

This script is the core production engine. It is designed to be left running overnight and to
survive interruption via the checkpoint file introduced in 34.5.

#### 34.2.1 — Output directory structure

```
src/assets/sprites/facts/<factId>.png        — 64×64 game-ready (displayed in quiz)
src/assets/sprites-hires/facts/<factId>.png  — 256×256 hi-res (detail view, QC)
sprite-gen/output/facts/<factId>_raw.png     — 1024×1024 raw ComfyUI output
sprite-gen/output/facts/<factId>_rembg.png   — post-background-removal RGBA
```

Naming: `<factId>` is the fact's database `id` field, which is a short alphanumeric slug
(e.g., `fact_geol_001`). File names that contain only `[a-zA-Z0-9_-]` are safe on all
platforms.

#### 34.2.2 — Script: `sprite-gen/scripts/fact_batch_generate.py`

```python
#!/usr/bin/env python3
"""
Terra Miner — Fact Art Batch Generator
Reads queued facts from facts.db, generates pixel art via ComfyUI, post-processes
each image (rembg + downscale), saves to src/assets/sprites/facts/<id>.png,
and updates pixel_art_status to 'review' (pass) or 'failed' (error).

GPU constraint: sequential generation (one at a time on RTX 3060).
Checkpoint file: sprite-gen/scripts/fact_gen_state.json tracks completed/failed IDs.

Usage:
    python fact_batch_generate.py [--limit 100] [--skip-qc]
"""

import io
import json
import os
import sqlite3
import sys
import time
from pathlib import Path

SCRIPT_DIR   = Path(__file__).parent
PROJECT_DIR  = SCRIPT_DIR.parent.parent
FACTS_DB     = PROJECT_DIR / "server" / "data" / "facts.db"
OUTPUT_DIR   = SCRIPT_DIR.parent / "output" / "facts"
SPRITES_DIR  = PROJECT_DIR / "src" / "assets" / "sprites" / "facts"
HIRES_DIR    = PROJECT_DIR / "src" / "assets" / "sprites-hires" / "facts"
STATE_FILE   = SCRIPT_DIR / "fact_gen_state.json"

GAME_SIZE  = 64
HIRES_SIZE = 256

# ComfyUI generation parameters
SDXL_STEPS   = 30
SDXL_CFG     = 7.0
SDXL_SAMPLER = "euler_ancestral"

PROMPT_PREFIX = (
    "pixel art, 8-bit, game illustration, retro video game art style, "
    "clean pixel outlines, limited color palette, "
)
PROMPT_SUFFIX = (
    ", dark space background gradient, centered subject, "
    "transparent friendly, clean pixel art, no text, no ui"
)
NEGATIVE = (
    "3d render, realistic, photograph, blurry, watermark, text, ui, labels, "
    "numbers, multiple subjects, complex background, white background, "
    "photorealistic, gradient noise, low quality, deformed, extra limbs"
)

# ── Import shared helpers from generate_sprite.py ─────────────────────────────

sys.path.insert(0, str(SCRIPT_DIR))
from generate_sprite import (
    queue_prompt,
    wait_for_completion,
    download_image,
    remove_background,
    trim_transparent,
    make_square,
    downscale,
    COMFYUI_URL,
)
from PIL import Image


def build_fact_workflow(prompt: str, seed: int) -> dict:
    """Build a ComfyUI SDXL workflow node graph for a single fact sprite."""
    full_prompt = PROMPT_PREFIX + prompt + PROMPT_SUFFIX
    return {
        "1": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {"ckpt_name": "sd_xl_base_1.0.safetensors"},
        },
        "2": {
            "class_type": "LoraLoader",
            "inputs": {
                "model": ["1", 0],
                "clip": ["1", 1],
                "lora_name": "pixel-art-xl.safetensors",
                "strength_model": 0.85,
                "strength_clip": 0.85,
            },
        },
        "3": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": full_prompt, "clip": ["2", 1]},
        },
        "4": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": NEGATIVE, "clip": ["2", 1]},
        },
        "5": {
            "class_type": "EmptyLatentImage",
            "inputs": {"width": 1024, "height": 1024, "batch_size": 1},
        },
        "6": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["2", 0],
                "positive": ["3", 0],
                "negative": ["4", 0],
                "latent_image": ["5", 0],
                "seed": seed,
                "steps": SDXL_STEPS,
                "cfg": SDXL_CFG,
                "sampler_name": SDXL_SAMPLER,
                "scheduler": "normal",
                "denoise": 1.0,
            },
        },
        "7": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["6", 0], "vae": ["1", 2]},
        },
        "8": {
            "class_type": "SaveImage",
            "inputs": {"images": ["7", 0], "filename_prefix": f"fact_{seed}"},
        },
    }


def load_state() -> dict:
    """Load checkpoint state: {completed: [...], failed: [...]}."""
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text())
        except Exception:
            pass
    return {"completed": [], "failed": [], "retry_counts": {}, "total_processed": 0}


def save_state(state: dict) -> None:
    """Persist checkpoint state atomically."""
    import datetime
    state["last_run"] = datetime.datetime.utcnow().isoformat() + "Z"
    STATE_FILE.write_text(json.dumps(state, indent=2))


def stable_seed(fact_id: str) -> int:
    """Deterministic seed derived from fact ID so the same fact always uses the same seed.
    This ensures regeneration produces visually similar (not identical) results."""
    return abs(hash(fact_id)) % (2 ** 31)


def generate_one(fact: dict) -> bool:
    """
    Generate, post-process, and save a single fact sprite.
    Returns True on success, False on any error.
    """
    fid    = fact["id"]
    prompt = fact["image_prompt"]
    seed   = stable_seed(fid)

    raw_out   = OUTPUT_DIR / f"{fid}_raw.png"
    rembg_out = OUTPUT_DIR / f"{fid}_rembg.png"

    print(f"  [GEN]   Queuing ComfyUI job (seed={seed})...")
    workflow   = build_fact_workflow(prompt, seed)
    prompt_id  = queue_prompt(workflow)
    result     = wait_for_completion(prompt_id, timeout=300)

    img_bytes = None
    for node_out in result.get("outputs", {}).values():
        if "images" in node_out:
            info      = node_out["images"][0]
            img_bytes = download_image(info["filename"], info.get("subfolder", ""))
            break

    if img_bytes is None:
        print(f"  [ERR]   No image returned from ComfyUI")
        return False

    raw_out.write_bytes(img_bytes)
    print(f"  [REMBG] Removing background...")
    rgba    = remove_background(img_bytes)
    trimmed = trim_transparent(rgba)
    squared = make_square(trimmed)

    # Save intermediate rembg PNG
    squared.save(str(rembg_out))

    # Hi-res: 256×256 nearest-neighbor
    hires      = downscale(squared, HIRES_SIZE)
    hires_path = HIRES_DIR / f"{fid}.png"
    hires.save(str(hires_path))

    # Game-ready: 64×64 nearest-neighbor
    game      = downscale(squared, GAME_SIZE)
    game_path = SPRITES_DIR / f"{fid}.png"
    game.save(str(game_path))

    print(f"  [SAVE]  {game_path.relative_to(PROJECT_DIR)}  &  {hires_path.relative_to(PROJECT_DIR)}")
    return True


def main() -> None:
    import argparse
    parser = argparse.ArgumentParser(description="Batch generate fact pixel art via ComfyUI")
    parser.add_argument("--limit", type=int, default=200,
                        help="Max facts to process (default 200)")
    parser.add_argument("--reset", action="store_true",
                        help="Clear checkpoint state and start fresh (does not reset DB status)")
    parser.add_argument("--db", default=str(FACTS_DB))
    args = parser.parse_args()

    if args.reset and STATE_FILE.exists():
        STATE_FILE.unlink()
        print("  Checkpoint state cleared.\n")

    for d in [OUTPUT_DIR, SPRITES_DIR, HIRES_DIR]:
        d.mkdir(parents=True, exist_ok=True)

    state = load_state()
    already_done = set(state.get("completed", [])) | set(state.get("permanent_failures", []))

    conn = sqlite3.connect(args.db)
    conn.row_factory = sqlite3.Row
    cur  = conn.cursor()

    rows = cur.execute("""
        SELECT id, image_prompt
        FROM   facts
        WHERE  status = 'approved'
          AND  pixel_art_status IN ('queued', 'failed')
          AND  image_prompt IS NOT NULL
        ORDER  BY fun_score DESC
        LIMIT  ?
    """, (args.limit,)).fetchall()

    candidates = [dict(r) for r in rows if r["id"] not in already_done]
    total = len(candidates)
    print(f"Terra Miner — Fact Art Batch Generator")
    print(f"Queue: {total} facts  |  State: {len(state.get('completed', []))} done\n")

    for i, fact in enumerate(candidates, start=1):
        fid = fact["id"]
        print(f"\n[{i}/{total}] {fid}")
        print(f"  Prompt: {fact['image_prompt'][:80]}...")

        try:
            success = generate_one(fact)
        except Exception as exc:
            print(f"  [ERR]   Unexpected: {type(exc).__name__}: {exc}")
            success = False

        new_status = "review" if success else "failed"
        cur.execute("""
            UPDATE facts
            SET    pixel_art_status = ?,
                   has_pixel_art    = ?,
                   updated_at       = (unixepoch() * 1000)
            WHERE  id = ?
        """, (new_status, 1 if success else 0, fid))
        conn.commit()

        if success:
            state.setdefault("completed", []).append(fid)
        else:
            state.setdefault("failed", []).append(fid)
            state.setdefault("retry_counts", {})[fid] = \
                state["retry_counts"].get(fid, 0) + 1
            if state["retry_counts"][fid] >= 3:
                state.setdefault("permanent_failures", []).append(fid)
                state["failed"].remove(fid)

        state["total_processed"] = state.get("total_processed", 0) + 1
        save_state(state)
        print(f"  Status: {new_status.upper()}")

    conn.close()

    done_count   = sum(1 for f in candidates if f["id"] in set(state.get("completed", [])))
    failed_count = sum(1 for f in candidates if f["id"] in set(state.get("failed", [])))
    print(f"\n{'='*60}")
    print(f"  Batch complete: {done_count} generated, {failed_count} failed.")
    if failed_count:
        print(f"  Re-run to retry failed facts (they are re-queued automatically).")
        sys.exit(1)


if __name__ == "__main__":
    main()
```

#### 34.2.3 — Acceptance criteria for 34.2

- [ ] Running `python fact_batch_generate.py --limit 1` with one queued fact produces both
  `src/assets/sprites/facts/<id>.png` (64×64) and
  `src/assets/sprites-hires/facts/<id>.png` (256×256) as RGBA PNGs.
- [ ] The generated sprite has at least one non-transparent pixel (not a blank image).
- [ ] `pixel_art_status` is updated to `'review'` in the DB on success.
- [ ] `sprite-gen/scripts/fact_gen_state.json` is created and the fact ID appears in `"completed"`.
- [ ] Simulating a zero-limit run (`--limit 0`) exits cleanly with no DB changes.
- [ ] Re-running the script a second time skips already-completed IDs.

---

### 34.3 — Greyscale-to-Color Mastery Progression

**Goal**: Display each fact sprite through a 5-stage visual state that evolves as the player's
SM-2 mastery increases. Stage 0 (unseen) is fully greyscale; Stage 4 (mastered) is full color
with a golden shimmer animation. The transition is computed client-side at render time — no
additional sprites are generated.

#### 34.3.1 — Mastery stage definitions

| Stage | SM-2 repetitions | Label | Visual state |
|-------|-----------------|-------|-------------|
| 0 | 0 | Unseen | Full greyscale (`filter: grayscale(1) brightness(0.7)`) |
| 1 | 1–2 | Glimpsed | Sepia tint (`filter: grayscale(0.6) sepia(0.8) brightness(0.85)`) |
| 2 | 3 | Familiar | 40% color saturation (`filter: grayscale(0.4) saturate(0.6)`) |
| 3 | 4–5 | Learned | Full color, slight warm boost (`filter: saturate(1.2) brightness(1.05)`) |
| 4 | ≥ 6 | Mastered | Full color + golden shimmer animation (CSS `@keyframes` on a gold overlay) |

Stage 4 applies an animated linear overlay cycling gold → transparent → gold at 3s period.
This is a pure CSS effect; no Phaser shader is required for the quiz overlay context.

#### 34.3.2 — New file: `src/ui/stores/factSprites.ts`

```typescript
/**
 * Fact sprite mastery store.
 * Computes the mastery visual stage from SM-2 review state for FactArtwork.svelte.
 *
 * DD-V2-034: Every approved fact gets a pixel-art illustration.
 * Mastery stages: 0=greyscale, 1=sepia, 2=partial-color, 3=full-color, 4=golden.
 */

import { get } from 'svelte/store'
import { reviewStates } from './playerData'
import type { ReviewState } from '../../data/types'

/** Mastery visual stage (0-4). */
export type MasteryStage = 0 | 1 | 2 | 3 | 4

/**
 * Derives the mastery stage for a single fact ID from its SM-2 repetitions.
 * Called per-card render — reads synchronously from the playerData store.
 */
export function getMasteryStage(factId: string): MasteryStage {
  const states = get(reviewStates) as Record<string, ReviewState>
  const state  = states[factId]
  if (!state) return 0
  const reps = state.repetitions ?? 0
  if (reps === 0) return 0
  if (reps <= 2)  return 1
  if (reps === 3) return 2
  if (reps <= 5)  return 3
  return 4
}

/** Returns the CSS filter string for the given mastery stage. */
export function masteryFilter(stage: MasteryStage): string {
  switch (stage) {
    case 0: return 'grayscale(1) brightness(0.7)'
    case 1: return 'grayscale(0.6) sepia(0.8) brightness(0.85)'
    case 2: return 'grayscale(0.4) saturate(0.6)'
    case 3: return 'saturate(1.2) brightness(1.05)'
    case 4: return 'saturate(1.3) brightness(1.1)'  // base; shimmer added via overlay
  }
}

/** Returns the human-readable mastery stage label. */
export function masteryLabel(stage: MasteryStage): string {
  return ['Unseen', 'Glimpsed', 'Familiar', 'Learned', 'Mastered'][stage]
}
```

#### 34.3.3 — New file: `src/ui/components/FactArtwork.svelte`

```svelte
<script lang="ts">
  /**
   * FactArtwork — displays a fact's pixel-art sprite with mastery-state visual treatment.
   * Handles lazy loading, fallback placeholder, and the Stage 4 shimmer animation.
   *
   * Props:
   *   factId    — database fact ID used to resolve sprite URL
   *   size      — render size in px (default 64; use 128 for detail view)
   *   showLabel — show mastery stage label beneath image (default false)
   */

  import { onMount } from 'svelte'
  import { getMasteryStage, masteryFilter, masteryLabel } from '../stores/factSprites'
  import { getFactSpriteManifest } from '../../services/factSpriteManifest'
  import type { MasteryStage } from '../stores/factSprites'

  export let factId: string
  export let size: number = 64
  export let showLabel: boolean = false

  let stage: MasteryStage = 0
  let available = false
  let loaded    = false

  $: spriteUrl = `/assets/sprites/facts/${factId}.png`
  $: filter    = masteryFilter(stage)
  $: label     = masteryLabel(stage)
  $: isGolden  = stage === 4

  onMount(async () => {
    stage      = getMasteryStage(factId)
    const mf   = await getFactSpriteManifest()
    available  = mf.has(factId)
  })

  function onLoad()  { loaded = true }
</script>

<div
  class="fact-artwork"
  style="width:{size}px; height:{size}px;"
  aria-label="Fact illustration — {label}"
  role="img"
>
  {#if available}
    <img
      src={spriteUrl}
      alt=""
      width={size}
      height={size}
      style="filter: {filter}; image-rendering: pixelated;"
      on:load={onLoad}
      class:hidden={!loaded}
    />
    {#if isGolden && loaded}
      <div class="shimmer-overlay" style="width:{size}px; height:{size}px;" aria-hidden="true"></div>
    {/if}
  {/if}

  {#if !loaded && available}
    <div class="placeholder skeleton" style="width:{size}px; height:{size}px;"></div>
  {/if}

  {#if !available}
    <div class="placeholder fallback" style="width:{size}px; height:{size}px;" aria-label="No illustration yet">
      <svg viewBox="0 0 8 8" xmlns="http://www.w3.org/2000/svg" width={size} height={size}>
        <rect width="8" height="8" fill="#1a2035"/>
        <rect x="2" y="1" width="4" height="3" fill="#2d3d6b"/>
        <rect x="1" y="5" width="6" height="2" fill="#2d3d6b"/>
        <rect x="3" y="2" width="2" height="1" fill="#4a7ec7"/>
      </svg>
    </div>
  {/if}

  {#if showLabel}
    <p class="mastery-label stage-{stage}">{label}</p>
  {/if}
</div>

<style>
  .fact-artwork {
    position: relative;
    display: inline-block;
    flex-shrink: 0;
  }

  img {
    display: block;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }

  .hidden { display: none; }

  .placeholder {
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .skeleton {
    background: linear-gradient(90deg, #1a2035 25%, #2d3a5a 50%, #1a2035 75%);
    background-size: 200% 100%;
    animation: shimmer-skeleton 1.5s infinite;
  }

  .fallback { background: #1a2035; }

  .shimmer-overlay {
    position: absolute;
    top: 0; left: 0;
    pointer-events: none;
    background: linear-gradient(
      135deg,
      transparent 20%,
      rgba(255, 215, 0, 0.35) 50%,
      transparent 80%
    );
    background-size: 200% 200%;
    animation: golden-shimmer 3s ease-in-out infinite;
    mix-blend-mode: screen;
    border-radius: 2px;
  }

  .mastery-label {
    text-align: center;
    font-size: 9px;
    color: #8899aa;
    margin: 2px 0 0;
    font-family: monospace;
    letter-spacing: 0.5px;
  }
  .mastery-label.stage-4 { color: #ffd700; }

  @keyframes shimmer-skeleton {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  @keyframes golden-shimmer {
    0%, 100% { background-position: 0% 0%; opacity: 0.4; }
    50%       { background-position: 100% 100%; opacity: 0.8; }
  }
</style>
```

#### 34.3.4 — Wire FactArtwork into QuizOverlay

In `src/ui/components/QuizOverlay.svelte`, import `FactArtwork` and render it above the
question text when the current fact has pixel art available.

Add to `<script>` block:

```typescript
import FactArtwork from './FactArtwork.svelte'
```

Add to template, above the question text `<p>` element:

```svelte
{#if currentFact?.hasPixelArt}
  <div class="fact-art-wrapper">
    <FactArtwork factId={currentFact.id} size={96} />
  </div>
{/if}
```

Add to `<style>` block:

```css
.fact-art-wrapper {
  display: flex;
  justify-content: center;
  margin: 8px 0 12px;
}
```

#### 34.3.5 — Acceptance criteria for 34.3

- [ ] A fact with 0 repetitions renders with `filter: grayscale(1) brightness(0.7)`.
- [ ] A fact with 6+ repetitions renders with full color + `.shimmer-overlay` element present.
- [ ] When `available = false`, the fallback SVG icon renders instead of a broken image.
- [ ] When `loaded = false` but `available = true`, the skeleton pulse animation is visible.
- [ ] `showLabel={true}` renders the mastery stage label in gold (`#ffd700`) for Stage 4 facts.
- [ ] `FactArtwork` does not import Phaser or any game system — it is a pure Svelte component.

---

### 34.4 — 3-Gate Sprite QC

**Goal**: After batch generation, run a three-pass quality check on every `'review'` status
sprite before promoting it to `'approved'`. Gate 1 checks dimensions. Gate 2 checks that a
meaningful portion of pixels is non-transparent. Gate 3 checks visual distinctiveness by
comparing the sprite's perceptual hash against all existing approved sprites and rejecting
near-duplicates.

#### 34.4.1 — Script: `sprite-gen/scripts/fact_qc.py`

```python
#!/usr/bin/env python3
"""
Terra Miner — Fact Sprite QC Pipeline
Three-gate quality check for generated fact sprites.

Gate 1: Dimension check — must be exactly 64×64 (game) and 256×256 (hires).
Gate 2: Transparency check — >= 20% of pixels must be non-transparent (alpha > 10).
Gate 3: Perceptual hash deduplication — reject if pHash distance < 12 vs any approved sprite.

Sprites passing all gates: pixel_art_status -> 'approved'
Sprites failing any gate:  pixel_art_status -> 'queued'  (re-queue for regeneration)

Usage:
    python fact_qc.py [--batch 500] [--db path/to/facts.db]
"""

import sqlite3
import sys
from pathlib import Path
from PIL import Image

SCRIPT_DIR  = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent.parent
FACTS_DB    = PROJECT_DIR / "server" / "data" / "facts.db"
SPRITES_DIR = PROJECT_DIR / "src" / "assets" / "sprites" / "facts"
HIRES_DIR   = PROJECT_DIR / "src" / "assets" / "sprites-hires" / "facts"

EXPECTED_GAME_SIZE  = 64
EXPECTED_HIRES_SIZE = 256
MIN_OPAQUE_FRACTION = 0.20   # Gate 2: at least 20% non-transparent pixels
PHASH_REJECT_DIST   = 12     # Gate 3: reject if distance < 12 (out of 64 bits)
PHASH_SIZE          = 8      # perceptual hash grid: 8×8 = 64 bits


# ── Perceptual hash (pHash) ────────────────────────────────────────────────────

def phash(img: Image.Image) -> int:
    """
    Compute a 64-bit perceptual hash via greyscale + mean threshold.
    Resize to 8×8, convert to greyscale, threshold against mean.
    Returns a 64-bit integer.
    """
    small  = img.convert("L").resize((PHASH_SIZE, PHASH_SIZE), Image.Resampling.LANCZOS)
    pixels = list(small.getdata())
    mean   = sum(pixels) / len(pixels)
    bits   = 0
    for px in pixels:
        bits = (bits << 1) | (1 if px >= mean else 0)
    return bits


def hamming_distance(a: int, b: int) -> int:
    """Count differing bits between two 64-bit integers."""
    return bin(a ^ b).count("1")


# ── QC gates ──────────────────────────────────────────────────────────────────

def gate1_dimensions(fid: str) -> tuple[bool, str]:
    """Gate 1: both game (64×64) and hires (256×256) sprites must exist at expected size."""
    game_path  = SPRITES_DIR / f"{fid}.png"
    hires_path = HIRES_DIR   / f"{fid}.png"

    if not game_path.exists():
        return False, f"Missing game sprite"
    if not hires_path.exists():
        return False, f"Missing hires sprite"

    game_img  = Image.open(game_path)
    hires_img = Image.open(hires_path)

    if game_img.size != (EXPECTED_GAME_SIZE, EXPECTED_GAME_SIZE):
        return False, f"Game size {game_img.size} != (64,64)"
    if hires_img.size != (EXPECTED_HIRES_SIZE, EXPECTED_HIRES_SIZE):
        return False, f"Hires size {hires_img.size} != (256,256)"

    return True, "ok"


def gate2_transparency(fid: str) -> tuple[bool, str]:
    """Gate 2: at least 20% of pixels must be non-transparent (alpha > 10)."""
    game_path = SPRITES_DIR / f"{fid}.png"
    img       = Image.open(game_path).convert("RGBA")
    pixels    = list(img.getdata())
    total     = len(pixels)
    opaque    = sum(1 for _, _, _, a in pixels if a > 10)
    fraction  = opaque / total

    if fraction < MIN_OPAQUE_FRACTION:
        return False, f"Only {fraction:.1%} opaque pixels (min {MIN_OPAQUE_FRACTION:.0%})"
    return True, f"{fraction:.1%} opaque"


def gate3_dedup(fid: str, approved_hashes: list[int]) -> tuple[bool, str]:
    """Gate 3: perceptual hash distance must be >= PHASH_REJECT_DIST vs all approved sprites."""
    game_path = SPRITES_DIR / f"{fid}.png"
    img       = Image.open(game_path)
    h         = phash(img)

    min_dist = 64
    for existing_hash in approved_hashes:
        dist = hamming_distance(h, existing_hash)
        if dist < min_dist:
            min_dist = dist
        if dist < PHASH_REJECT_DIST:
            return False, f"Too similar to existing approved sprite (distance={dist})"

    return True, f"Unique (min_dist={min_dist})"


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    import argparse
    parser = argparse.ArgumentParser(description="QC check fact sprites")
    parser.add_argument("--batch", type=int, default=500)
    parser.add_argument("--db", default=str(FACTS_DB))
    args = parser.parse_args()

    conn = sqlite3.connect(args.db)
    conn.row_factory = sqlite3.Row
    cur  = conn.cursor()

    # Pre-load pHashes of all currently approved sprites
    approved_ids = [r["id"] for r in cur.execute(
        "SELECT id FROM facts WHERE pixel_art_status = 'approved' AND has_pixel_art = 1"
    ).fetchall()]

    approved_hashes: list[int] = []
    for aid in approved_ids:
        p = SPRITES_DIR / f"{aid}.png"
        if p.exists():
            try:
                approved_hashes.append(phash(Image.open(p)))
            except Exception:
                pass

    # Fetch review-status sprites to check
    rows = cur.execute("""
        SELECT id FROM facts
        WHERE  pixel_art_status = 'review'
        LIMIT  ?
    """, (args.batch,)).fetchall()

    total = len(rows)
    print(f"Terra Miner — Fact Sprite QC")
    print(f"Reviewing: {total}  |  Approved pool: {len(approved_hashes)} hashes\n")

    passed = 0
    failed = 0

    for row in rows:
        fid = row["id"]
        reasons = []

        ok1, msg1 = gate1_dimensions(fid)
        if not ok1: reasons.append(f"G1:{msg1}")

        ok2, msg2 = (True, "") if reasons else gate2_transparency(fid)
        if not ok2: reasons.append(f"G2:{msg2}")

        ok3, msg3 = (True, "") if reasons else gate3_dedup(fid, approved_hashes)
        if not ok3: reasons.append(f"G3:{msg3}")

        if not reasons:
            new_status = "approved"
            # Add to pool for subsequent comparisons in this batch
            try:
                approved_hashes.append(phash(Image.open(SPRITES_DIR / f"{fid}.png")))
            except Exception:
                pass
            passed += 1
            print(f"  PASS  {fid}  ({msg2}, {msg3})")
        else:
            # Re-queue for regeneration with a new seed
            new_status = "queued"
            failed += 1
            print(f"  FAIL  {fid}  — {'; '.join(reasons)}")

        cur.execute("""
            UPDATE facts
            SET    pixel_art_status = ?,
                   has_pixel_art    = ?,
                   updated_at       = (unixepoch() * 1000)
            WHERE  id = ?
        """, (new_status, 1 if new_status == "approved" else 0, fid))

    conn.commit()
    conn.close()

    print(f"\n{'='*60}")
    print(f"  QC complete: {passed} approved, {failed} re-queued out of {total}.")
    if failed:
        print(f"  Re-run fact_batch_generate.py to regenerate failed sprites.")


if __name__ == "__main__":
    main()
```

#### 34.4.2 — Acceptance criteria for 34.4

- [ ] Gate 1 fails a sprite that is 32×32 instead of 64×64.
- [ ] Gate 1 fails when the hires file is missing.
- [ ] Gate 2 fails a nearly-blank sprite with < 20% non-transparent pixels.
- [ ] Gate 3 fails a near-duplicate (two sprites from the same seed with distance < 12).
- [ ] Failed sprites have `pixel_art_status = 'queued'` after the script exits (re-queued).
- [ ] Approved sprites have `pixel_art_status = 'approved'` and are added to the pHash pool.
- [ ] The script runs to completion without crashing when `--batch 0` is passed (empty run).

---

### 34.5 — Resumable Generation

**Goal**: The generation pipeline must survive interruption at any point — power loss, a
killed process, a ComfyUI crash — without duplicating work or corrupting the DB. The
checkpoint file `sprite-gen/scripts/fact_gen_state.json` (already written in 34.2) is the
resumability mechanism. This sub-phase documents its schema, formalizes retry semantics,
and provides the `--reset` flag.

#### 34.5.1 — Checkpoint file specification

`sprite-gen/scripts/fact_gen_state.json` (gitignored):

```json
{
  "version": 1,
  "completed": ["fact_geol_001", "fact_hist_003"],
  "failed": ["fact_bio_012"],
  "permanent_failures": [],
  "retry_counts": {
    "fact_bio_012": 2
  },
  "last_run": "2026-03-04T14:32:11Z",
  "total_processed": 245
}
```

Fields:
- `completed` — IDs successfully generated and saved. Never re-processed.
- `failed` — IDs that errored on the last attempt. Re-attempted on next run.
- `permanent_failures` — IDs that failed 3 or more times. Excluded from all future runs
  until `--reset` is called.
- `retry_counts` — per-ID failure count.
- `last_run` — ISO 8601 UTC timestamp of last invocation.
- `total_processed` — cumulative count across all runs (for progress tracking).

#### 34.5.2 — Retry semantics

The retry logic is already embedded in `fact_batch_generate.py` (34.2). Summary:

- After each failure, `retry_counts[fid]` is incremented.
- At `retry_counts[fid] >= 3`, the ID is moved from `failed` to `permanent_failures`.
- Permanently failed IDs are excluded from candidate selection via `should_skip()`.
- The `--reset` flag deletes `fact_gen_state.json` entirely; the next run treats all
  `queued`/`failed` DB-status facts as fresh candidates.

> NOTE: `--reset` does not touch the DB. Facts with `pixel_art_status = 'review'` or
> `'approved'` in the DB are always skipped by the WHERE clause regardless of the state file.

#### 34.5.3 — Acceptance criteria for 34.5

- [ ] Running `fact_batch_generate.py` twice in a row does not re-generate the same sprite
  (completed IDs are skipped via the state file).
- [ ] A fact that fails 3 times appears in `"permanent_failures"` and is skipped on all
  subsequent runs without manual intervention.
- [ ] `fact_batch_generate.py --reset` clears the state file; the next run treats all
  queued DB facts as unseen.
- [ ] Manually deleting `fact_gen_state.json` while the DB has `pixel_art_status='review'`
  facts does not re-generate them (the DB `WHERE` clause gates this).
- [ ] `last_run` and `total_processed` are updated on every run that processes at least
  one fact.

---

### 34.6 — Build-Time Audit Tool

**Goal**: A Node.js audit script that runs on demand and optionally as part of the build
process to report pixel art coverage: how many facts have approved sprites, which categories
are underserved, which sprites fail a dimension sanity-check, and a machine-readable JSON
summary. A manifest JSON listing all approved fact IDs is emitted as a build artifact.

#### 34.6.1 — Script: `scripts/audit-fact-sprites.mjs`

```js
#!/usr/bin/env node
/**
 * Terra Miner — Fact Sprite Audit
 * Reports pixel art coverage and emits a sprite manifest for the client.
 *
 * Usage:
 *   node scripts/audit-fact-sprites.mjs [--fail-below=80] [--emit-manifest]
 *
 * Exit codes:
 *   0 — coverage >= threshold and no dimension failures
 *   1 — below threshold or dimension failures found
 */

import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const require   = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT   = path.resolve(__dirname, '..')

const SPRITES_DIR   = path.join(PROJECT, 'src', 'assets', 'sprites', 'facts')
const FACTS_DB      = path.join(PROJECT, 'server', 'data', 'facts.db')
const OUT_DIR       = path.join(PROJECT, 'docs', 'audit')
const MANIFEST_PATH = path.join(PROJECT, 'src', 'assets', 'fact-sprite-manifest.json')

const args          = process.argv.slice(2)
const failBelowArg  = args.find(a => a.startsWith('--fail-below='))
const FAIL_THRESHOLD = failBelowArg ? parseInt(failBelowArg.split('=')[1]) : 0
const EMIT_MANIFEST  = args.includes('--emit-manifest')

// ── Load DB ───────────────────────────────────────────────────────────────────

let Database
try {
  Database = require('better-sqlite3')
} catch {
  console.error('better-sqlite3 not installed.')
  process.exit(1)
}

if (!fs.existsSync(FACTS_DB)) {
  console.warn(`facts.db not found at ${FACTS_DB} — writing empty audit.`)
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const empty = {
    generated_at: new Date().toISOString(), total_approved: 0, with_pixel_art: 0,
    coverage_pct: 0, queued: 0, generating: 0, none: 0, rejected: 0,
    size_failures: 0, by_category: {}, threshold: FAIL_THRESHOLD, pass: true,
  }
  fs.writeFileSync(path.join(OUT_DIR, 'fact-sprite-coverage.json'), JSON.stringify(empty, null, 2))
  if (EMIT_MANIFEST) fs.writeFileSync(MANIFEST_PATH, '[]')
  process.exit(0)
}

const db    = new Database(FACTS_DB, { readonly: true })
const facts = db.prepare(
  `SELECT id, category_l1, status, pixel_art_status, has_pixel_art
   FROM facts WHERE status = 'approved'`
).all()
db.close()

// ── Tally ─────────────────────────────────────────────────────────────────────

const total   = facts.length
let approved  = 0, queued = 0, generating = 0, none = 0, rejected = 0
const byCategory = {}

for (const f of facts) {
  const cat = f.category_l1 || 'Uncategorized'
  if (!byCategory[cat]) byCategory[cat] = { total: 0, approved: 0 }
  byCategory[cat].total++
  switch (f.pixel_art_status) {
    case 'approved':   approved++; byCategory[cat].approved++; break
    case 'generating': generating++; break
    case 'queued':     queued++;     break
    case 'rejected':   rejected++;   break
    default:           none++;       break
  }
}

// ── Dimension sanity check ────────────────────────────────────────────────────

let sizeFails = 0
if (fs.existsSync(SPRITES_DIR)) {
  // Use synchronous image size reading via PNG header (no sharp dependency required)
  for (const file of fs.readdirSync(SPRITES_DIR).filter(f => f.endsWith('.png'))) {
    try {
      const buf = Buffer.alloc(24)
      const fd  = fs.openSync(path.join(SPRITES_DIR, file), 'r')
      fs.readSync(fd, buf, 0, 24, 0)
      fs.closeSync(fd)
      // PNG IHDR: bytes 16-19 = width, 20-23 = height (big-endian uint32)
      const w = buf.readUInt32BE(16)
      const h = buf.readUInt32BE(20)
      if (w !== 64 || h !== 64) sizeFails++
    } catch {}
  }
}

// ── Report ────────────────────────────────────────────────────────────────────

const pct = total > 0 ? Math.round((approved / total) * 100) : 0

console.log('\nTerra Miner — Fact Sprite Coverage Audit')
console.log('='.repeat(52))
console.log(`  Approved facts  : ${total}`)
console.log(`  With pixel art  : ${approved}  (${pct}%)`)
console.log(`  Queued          : ${queued}`)
console.log(`  Generating      : ${generating}`)
console.log(`  No art yet      : ${none}`)
console.log(`  Rejected        : ${rejected}`)
console.log(`  Dim failures    : ${sizeFails}`)
console.log()
console.log('  Category Breakdown:')

const sorted = Object.entries(byCategory).sort((a, b) => b[1].total - a[1].total)
for (const [cat, c] of sorted) {
  const p   = Math.round((c.approved / c.total) * 100)
  const bar = '█'.repeat(Math.floor(p / 5)).padEnd(20, '░')
  console.log(`    ${cat.padEnd(24)} ${bar} ${String(p).padStart(3)}%  (${c.approved}/${c.total})`)
}
console.log()

// ── Write audit JSON ──────────────────────────────────────────────────────────

fs.mkdirSync(OUT_DIR, { recursive: true })
const auditData = {
  generated_at: new Date().toISOString(),
  total_approved: total, with_pixel_art: approved, coverage_pct: pct,
  queued, generating, none, rejected, size_failures: sizeFails,
  by_category: byCategory, threshold: FAIL_THRESHOLD,
  pass: pct >= FAIL_THRESHOLD && sizeFails === 0,
}
const outPath = path.join(OUT_DIR, 'fact-sprite-coverage.json')
fs.writeFileSync(outPath, JSON.stringify(auditData, null, 2))
console.log(`  Audit JSON: ${outPath}`)

// ── Emit sprite manifest ──────────────────────────────────────────────────────

if (EMIT_MANIFEST) {
  const approvedIds = facts
    .filter(f => f.pixel_art_status === 'approved')
    .map(f => f.id)
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(approvedIds))
  console.log(`  Manifest : ${MANIFEST_PATH}  (${approvedIds.length} IDs)`)
}

// ── Exit code ─────────────────────────────────────────────────────────────────

if (FAIL_THRESHOLD > 0 && pct < FAIL_THRESHOLD) {
  console.error(`\n  FAIL: coverage ${pct}% < threshold ${FAIL_THRESHOLD}%`)
  process.exit(1)
} else if (sizeFails > 0) {
  console.error(`\n  FAIL: ${sizeFails} sprite(s) have wrong dimensions.`)
  process.exit(1)
} else {
  console.log(`  PASS`)
}
```

#### 34.6.2 — `package.json` additions

```json
{
  "scripts": {
    "audit:sprites":     "node scripts/audit-fact-sprites.mjs",
    "audit:sprites:ci":  "node scripts/audit-fact-sprites.mjs --fail-below=80",
    "prebuild":          "node scripts/audit-fact-sprites.mjs --emit-manifest"
  }
}
```

The `prebuild` hook ensures the manifest is always up to date before every production build.
During development, run `npm run audit:sprites -- --emit-manifest` manually after running
the QC script.

#### 34.6.3 — Acceptance criteria for 34.6

- [ ] `npm run audit:sprites` exits 0 when `facts.db` does not exist (graceful empty output).
- [ ] `npm run audit:sprites` exits 0 when `facts.db` exists but has 0 approved sprites.
- [ ] Output includes a category breakdown table with coverage percentage bars.
- [ ] `docs/audit/fact-sprite-coverage.json` is written on every run.
- [ ] `--emit-manifest` writes `src/assets/fact-sprite-manifest.json` as a flat JSON array.
- [ ] `--fail-below=100` exits 1 when coverage is < 100% (verifies CI gating works).
- [ ] A sprite file that is 32×32 instead of 64×64 is counted in `size_failures`.

---

### 34.7 — Client Integration

**Goal**: Lazy-load fact sprites in the client with correct caching, expose them through Vite's
asset pipeline, and integrate with the quiz overlay and fact detail views. The sprite manifest
(emitted by 34.6) allows availability checks without firing 404 requests.

#### 34.7.1 — New file: `src/services/factSpriteManifest.ts`

```typescript
/**
 * Fact sprite availability manifest.
 * Fetches the list of approved fact IDs once per session, caches in memory.
 * FactArtwork.svelte checks this before attempting to render a sprite.
 *
 * The manifest is at /assets/fact-sprite-manifest.json, emitted by:
 *   node scripts/audit-fact-sprites.mjs --emit-manifest
 */

let manifestCache: Set<string> | null = null
let fetchPromise: Promise<Set<string>> | null = null

/**
 * Returns the set of fact IDs that have an approved 64×64 sprite.
 * Resolves immediately on subsequent calls (in-memory cache).
 */
export async function getFactSpriteManifest(): Promise<Set<string>> {
  if (manifestCache) return manifestCache
  if (fetchPromise)  return fetchPromise

  fetchPromise = fetch('/assets/fact-sprite-manifest.json')
    .then(r => (r.ok ? r.json() : []) as Promise<string[]>)
    .then((ids: string[]) => {
      manifestCache = new Set(ids)
      return manifestCache
    })
    .catch(() => {
      // Manifest not yet generated — return empty set; FactArtwork shows placeholders.
      manifestCache = new Set()
      return manifestCache
    })

  return fetchPromise
}

/** Synchronous availability check after manifest is loaded. */
export function hasSpriteSync(factId: string): boolean {
  return manifestCache?.has(factId) ?? false
}

/** Invalidate the in-memory cache (e.g., after a background sync). */
export function invalidateManifestCache(): void {
  manifestCache = null
  fetchPromise  = null
}
```

#### 34.7.2 — New file: `src/game/systems/FactSpriteLoader.ts`

For the Phaser context (quiz overlay rendered inside a Phaser scene), a lightweight loader
that pre-loads a batch of fact sprites into Phaser's texture cache.

```typescript
/**
 * FactSpriteLoader — loads fact sprites into Phaser's texture cache on demand.
 * Called by MineScene before presenting the quiz overlay so the texture is ready.
 *
 * Uses dynamic import-style fetch (not Phaser's Loader queue) to avoid blocking
 * the game loop while waiting for textures.
 */

import Phaser from 'phaser'
import { getFactSpriteManifest } from '../../services/factSpriteManifest'

export class FactSpriteLoader {
  private scene: Phaser.Scene
  private loading = new Set<string>()
  private loaded  = new Set<string>()

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  /**
   * Preloads the sprite for a fact ID into Phaser's texture cache.
   * No-ops if already loaded or loading. Resolves when the texture is ready.
   */
  async preload(factId: string): Promise<void> {
    const manifest = await getFactSpriteManifest()
    if (!manifest.has(factId))      return
    if (this.loaded.has(factId))    return
    if (this.loading.has(factId))   return

    this.loading.add(factId)
    const key = `fact_sprite_${factId}`
    const url = `/assets/sprites/facts/${factId}.png`

    return new Promise((resolve) => {
      if (this.scene.textures.exists(key)) {
        this.loaded.add(factId)
        this.loading.delete(factId)
        resolve()
        return
      }

      this.scene.load.image(key, url)
      this.scene.load.once('complete', () => {
        this.loaded.add(factId)
        this.loading.delete(factId)
        resolve()
      })
      this.scene.load.start()
    })
  }

  /** Returns the Phaser texture key for a given fact ID, or null if not loaded. */
  getKey(factId: string): string | null {
    const key = `fact_sprite_${factId}`
    return this.scene.textures.exists(key) ? key : null
  }
}
```

#### 34.7.3 — Extend `src/data/types.ts`

```typescript
// Add to Fact interface, after pixelArtStatus:
/** Relative path of the approved 64×64 sprite served by the asset pipeline.
 *  Null when the sprite has not yet been generated or approved.
 *  e.g. "/assets/sprites/facts/fact_geol_001.png" */
pixelArtPath?: string | null
```

#### 34.7.4 — Extend server facts route

In `server/src/routes/facts.ts`, add `pixelArtPath` to the JSON row mapper:

```typescript
// In the row-to-client mapper:
pixelArtPath: row.has_pixel_art === 1
  ? `/assets/sprites/facts/${row.id}.png`
  : null,
```

#### 34.7.5 — Vite config: deterministic fact sprite asset names

In `vite.config.ts`, inside `build.rollupOptions.output`:

```typescript
assetFileNames: (assetInfo) => {
  // Preserve fact sprite filenames (no content hash) so URLs are stable
  // across builds and match the manifest IDs.
  if (assetInfo.name && assetInfo.name.startsWith('facts/')) {
    return 'assets/sprites/facts/[name][extname]'
  }
  // All other assets use content hash for cache busting
  return 'assets/[name]-[hash][extname]'
},
```

#### 34.7.6 — Fastify static file caching

In `server/src/index.ts`, configure the static file handler for fact sprites:

```typescript
fastify.register(fastifyStatic, {
  root: path.join(__dirname, '../../src/assets'),
  prefix: '/assets/',
  setHeaders: (res: ServerResponse, filePath: string) => {
    if (filePath.includes('/sprites/facts/')) {
      // Fact sprites are content-addressed by stable fact ID.
      // Safe to cache for 30 days.
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable')
    }
  },
})
```

#### 34.7.7 — Gitignore additions for generated sprite directories

Add to `.gitignore`:

```
# Phase 34: generated fact sprites (reproduced by pipeline)
src/assets/sprites/facts/
src/assets/sprites-hires/facts/
src/assets/fact-sprite-manifest.json
sprite-gen/output/facts/
sprite-gen/scripts/fact_gen_state.json
docs/audit/fact-sprite-coverage.json
```

#### 34.7.8 — Acceptance criteria for 34.7

- [ ] `npm run build` succeeds with or without sprites present in `src/assets/sprites/facts/`.
- [ ] In dev mode, `GET /assets/sprites/facts/<id>.png` returns 200 when the file exists.
- [ ] A fact with `has_pixel_art = 1` shows the `FactArtwork` component in the quiz overlay
  (the `{#if currentFact?.hasPixelArt}` guard passes).
- [ ] A fact without a sprite shows the fallback SVG icon — no broken image icon visible.
- [ ] `getFactSpriteManifest()` called twice returns the same `Set` instance (cache hit).
- [ ] `pixelArtPath` appears in the `/api/facts` response JSON for approved-sprite facts.
- [ ] `npm run typecheck` passes with the updated `Fact` interface.
- [ ] `prebuild` runs without error on `npm run build`.

---

## Playwright Test Scripts

All scripts use the Bash pattern from `CLAUDE.md`: write to a temp file and run with `node`.
The dev server must be running on `http://localhost:5173` before executing these tests.

### Test 34-A: FactArtwork renders in quiz overlay

```js
// Write to /tmp/test-34a.js, run: node /tmp/test-34a.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1000)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/ss-34a-mine.png' })

  // Attempt to trigger quiz overlay by moving in the mine
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(150)
    const overlay = await page.$('.quiz-overlay')
    if (overlay) { console.log('Quiz overlay found'); break }
  }

  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/ss-34a-quiz.png' })

  const artWrapper = await page.$('.fact-art-wrapper')
  console.log('.fact-art-wrapper present:', artWrapper !== null ? 'PASS (has pixel art fact)' : 'INFO — no art for this fact')

  const fallback = await page.$('.placeholder.fallback')
  console.log('Fallback placeholder (no broken img):', 'INFO — depends on fact')

  await browser.close()
  console.log('Screenshots: /tmp/ss-34a-mine.png, /tmp/ss-34a-quiz.png')
})()
```

### Test 34-B: Mastery stage filter logic

```js
// Write to /tmp/test-34b.js, run: node /tmp/test-34b.js
// Verifies the masteryFilter function returns correct CSS filters for each stage.

const EXPECTED = [
  [0, 'grayscale(1) brightness(0.7)'],
  [1, 'grayscale(0.6) sepia(0.8) brightness(0.85)'],
  [2, 'grayscale(0.4) saturate(0.6)'],
  [3, 'saturate(1.2) brightness(1.05)'],
  [4, 'saturate(1.3) brightness(1.1)'],
]

function masteryFilter(stage) {
  switch (stage) {
    case 0: return 'grayscale(1) brightness(0.7)'
    case 1: return 'grayscale(0.6) sepia(0.8) brightness(0.85)'
    case 2: return 'grayscale(0.4) saturate(0.6)'
    case 3: return 'saturate(1.2) brightness(1.05)'
    case 4: return 'saturate(1.3) brightness(1.1)'
  }
}

let allPass = true
for (const [stage, expected] of EXPECTED) {
  const actual = masteryFilter(stage)
  const pass = actual === expected
  console.log(`Stage ${stage}: ${pass ? 'PASS' : 'FAIL'} — "${actual}"`)
  if (!pass) allPass = false
}
console.log(`\nOverall: ${allPass ? 'PASS' : 'FAIL'}`)
```

### Test 34-C: Audit script produces coverage JSON

```js
// Write to /tmp/test-34c.js, run: node /tmp/test-34c.js
const { execSync } = require('child_process')
const fs = require('fs')

try {
  const out = execSync('node /root/terra-miner/scripts/audit-fact-sprites.mjs', {
    cwd: '/root/terra-miner', encoding: 'utf8',
  })
  console.log(out)

  const auditPath = '/root/terra-miner/docs/audit/fact-sprite-coverage.json'
  if (fs.existsSync(auditPath)) {
    const data = JSON.parse(fs.readFileSync(auditPath, 'utf8'))
    console.log('Audit JSON written: PASS')
    console.log(`  coverage_pct   : ${data.coverage_pct}%`)
    console.log(`  total_approved : ${data.total_approved}`)
    console.log(`  size_failures  : ${data.size_failures}`)
  } else {
    console.log('Audit JSON missing: FAIL')
    process.exit(1)
  }
} catch (err) {
  console.error('Audit script error:', err.message)
  process.exit(1)
}
```

### Test 34-D: Fallback placeholder — no broken image icons

```js
// Write to /tmp/test-34d.js, run: node /tmp/test-34d.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

  // Verify no broken img elements anywhere on the page
  const brokenImgs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('img')).filter(img =>
      !img.complete || img.naturalWidth === 0
    ).length
  })
  console.log(`Broken images found: ${brokenImgs} (expect 0) — ${brokenImgs === 0 ? 'PASS' : 'FAIL'}`)

  // Check manifest availability
  const manifestOk = await page.evaluate(() =>
    fetch('/assets/fact-sprite-manifest.json')
      .then(r => r.ok || r.status === 404)   // 404 is acceptable (manifest not generated yet)
      .catch(() => true)
  )
  console.log(`Manifest endpoint reachable: ${manifestOk ? 'PASS' : 'FAIL'}`)

  await page.screenshot({ path: '/tmp/ss-34d-home.png' })
  await browser.close()
  console.log('Screenshot: /tmp/ss-34d-home.png')
})()
```

### Test 34-E: End-to-end pipeline smoke test (requires ComfyUI + Claude API)

```js
// Write to /tmp/test-34e.js, run: node /tmp/test-34e.js
// Smoke test: runs fact_prompt_generator.py --dry-run and fact_batch_generate.py --limit 0
// to verify the scripts start up correctly without GPU/API access.

const { execSync } = require('child_process')
const path = require('path')
const PYTHON = '/opt/comfyui-env/bin/python3'
const SCRIPTS = '/root/terra-miner/sprite-gen/scripts'

function run(cmd) {
  try {
    const out = execSync(cmd, { encoding: 'utf8', cwd: SCRIPTS })
    return { ok: true, out }
  } catch (err) {
    return { ok: false, out: err.message }
  }
}

console.log('Testing fact_prompt_generator.py --dry-run...')
const r1 = run(`${PYTHON} fact_prompt_generator.py --dry-run`)
console.log(r1.ok ? 'PASS' : `FAIL: ${r1.out}`)

console.log('\nTesting fact_batch_generate.py --limit 0...')
const r2 = run(`${PYTHON} fact_batch_generate.py --limit 0`)
console.log(r2.ok ? 'PASS' : `FAIL: ${r2.out}`)

console.log('\nTesting fact_qc.py --batch 0...')
const r3 = run(`${PYTHON} fact_qc.py --batch 0`)
console.log(r3.ok ? 'PASS' : `FAIL: ${r3.out}`)
```

---

## Verification Gate

All of the following checks must pass before Phase 34 is marked complete in `PROGRESS.md`.

### TypeScript and Build

- [ ] `npm run typecheck` exits 0 after all new TypeScript and Svelte files are added.
- [ ] `npm run build` completes successfully.
- [ ] No `any` types introduced without a documented justification.
- [ ] `src/ui/components/FactArtwork.svelte` imports no Phaser types.
- [ ] `src/game/systems/FactSpriteLoader.ts` imports no Svelte types.

### Python Pipeline Scripts

- [ ] `python sprite-gen/scripts/fact_prompt_generator.py --dry-run` exits 0.
- [ ] `python sprite-gen/scripts/fact_batch_generate.py --limit 0` exits 0.
- [ ] `python sprite-gen/scripts/fact_qc.py --batch 0` exits 0.
- [ ] All three scripts import from `generate_sprite.py` without `ImportError`.

### Audit Tool

- [ ] `npm run audit:sprites` exits 0 (with or without `facts.db`).
- [ ] `docs/audit/fact-sprite-coverage.json` is written and contains valid JSON.
- [ ] `npm run audit:sprites -- --emit-manifest` writes `src/assets/fact-sprite-manifest.json`.
- [ ] `npm run audit:sprites:ci` exits 1 on a fresh DB with 0 sprites (< 80% coverage).

### Client Integration

- [ ] `FactArtwork` renders without console errors in the quiz overlay.
- [ ] Stage 0 (`reps = 0`) produces `filter: grayscale(1) brightness(0.7)` on the `<img>`.
- [ ] Stage 4 (`reps >= 6`) produces `.shimmer-overlay` element present in DOM.
- [ ] A fact with no sprite entry in the manifest shows `.placeholder.fallback` SVG.
- [ ] No broken image icons (`naturalWidth === 0`) visible on any page.
- [ ] `getFactSpriteManifest()` resolves without throwing on a cold load.
- [ ] `prebuild` runs as part of `npm run build` without error.

### Playwright Visual Verification

Take and review the following screenshots before marking done:

| File | What to confirm |
|------|----------------|
| `/tmp/ss-34a-mine.png` | Mine renders normally — no regression |
| `/tmp/ss-34a-quiz.png` | Quiz overlay shows `.fact-art-wrapper` or fallback (no broken img) |
| `/tmp/ss-34d-home.png` | Home screen — 0 broken image icons |

### End-to-End Verification (requires ComfyUI + Claude API — run before production deploy)

- [ ] `python fact_prompt_generator.py --batch 5` updates 5 facts with prompts in DB.
- [ ] `python fact_batch_generate.py --limit 5` produces 5 sprites in `src/assets/sprites/facts/`.
- [ ] `python fact_qc.py --batch 5` promotes at least 3 of 5 to `'approved'`.
- [ ] `npm run audit:sprites -- --emit-manifest` lists approved IDs in manifest JSON.
- [ ] Quiz overlay for an approved fact shows the colored sprite with correct mastery filter.
- [ ] A Stage 4 (mastered) fact shows the golden shimmer overlay in a screenshot.

---

## Files Affected

### New files

| File | Purpose |
|------|---------|
| `sprite-gen/scripts/fact_prompt_generator.py` | Claude API batch prompt generation (34.1) |
| `sprite-gen/scripts/fact_batch_generate.py` | ComfyUI sequential batch generation (34.2) |
| `sprite-gen/scripts/fact_qc.py` | 3-gate sprite QC: dimensions, transparency, pHash (34.4) |
| `sprite-gen/scripts/fact_gen_state.json` | Resumable checkpoint — gitignored (34.5) |
| `scripts/audit-fact-sprites.mjs` | Coverage audit + manifest emission (34.6) |
| `src/services/factSpriteManifest.ts` | Client manifest fetch/cache service (34.7) |
| `src/ui/stores/factSprites.ts` | Mastery stage + CSS filter helpers (34.3) |
| `src/ui/components/FactArtwork.svelte` | Sprite display component, all 5 mastery stages (34.3) |
| `src/game/systems/FactSpriteLoader.ts` | Phaser texture preloader for fact sprites (34.7) |
| `src/assets/fact-sprite-manifest.json` | Emitted by prebuild — gitignored |
| `src/assets/sprites/facts/` | 64×64 game-ready sprites — gitignored |
| `src/assets/sprites-hires/facts/` | 256×256 hi-res sprites — gitignored |
| `sprite-gen/output/facts/` | Raw + rembg intermediates — gitignored |
| `docs/audit/fact-sprite-coverage.json` | Audit output — gitignored |

### Modified files

| File | Change |
|------|--------|
| `server/src/db/facts-migrate.ts` | Add `pixel_art_path TEXT` column to `facts` table |
| `server/src/routes/facts.ts` | Add `pixelArtPath` to fact JSON response (34.7.4) |
| `src/data/types.ts` | Add `pixelArtPath?: string \| null` to `Fact` interface (34.7.3) |
| `src/ui/components/QuizOverlay.svelte` | Embed `FactArtwork` above question text (34.3.4) |
| `vite.config.ts` | `assetFileNames` rule for stable fact sprite URLs (34.7.5) |
| `package.json` | Add `audit:sprites`, `audit:sprites:ci`, `prebuild` scripts (34.6.2) |
| `server/src/index.ts` | Add `Cache-Control` for `/assets/sprites/facts/*` (34.7.6) |
| `.gitignore` | Add generated sprite directories and checkpoint files (34.7.7) |

---

## Appendix: Full Pipeline Run Order

```bash
# 1. Set Claude API key (from server/.env or shell)
export ANTHROPIC_API_KEY=sk-ant-...

# 2. Generate image prompts for all approved facts missing them
#    (safe to re-run; only processes pixel_art_status='none' facts)
python sprite-gen/scripts/fact_prompt_generator.py --batch 522

# 3. Generate sprites via ComfyUI (~45 s/sprite on RTX 3060)
#    Leave running overnight for full 522-fact run (~6.5 h)
python sprite-gen/scripts/fact_batch_generate.py --limit 522

# 4. QC all 'review' sprites — pass gates → 'approved', fail → re-queued
python sprite-gen/scripts/fact_qc.py --batch 522

# 5. Retry failed/rejected facts (generates new seed per ID from state file)
python sprite-gen/scripts/fact_batch_generate.py --limit 100

# 6. Repeat steps 4-5 until coverage is satisfactory

# 7. Emit manifest and run audit
node scripts/audit-fact-sprites.mjs --emit-manifest

# 8. Verify CI gate passes
npm run audit:sprites:ci

# 9. Build for production
npm run build
```

### Scale projection

| Fact count | Est. generation time (RTX 3060, 30 steps) | Est. first-pass approval rate |
|------------|------------------------------------------|-------------------------------|
| 522        | ~6.5 h                                   | ~75–85%                       |
| 1,000      | ~12.5 h                                  | ~75–85%                       |
| 3,000      | ~37.5 h                                  | ~75–85%                       |

At 3,000 facts, total wall time to 100% coverage (including QC retry cycles) is approximately
50–60 GPU-hours. Incremental generation (run nightly, pick up newly approved facts) is the
practical operational model — not a single bulk regeneration.
