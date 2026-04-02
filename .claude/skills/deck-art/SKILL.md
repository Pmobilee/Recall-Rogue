---
name: deck-art
description: Generate and deploy deck front cover art with parallax hover effect for the Study Temple library. Uses OpenRouter Gemini Flash 2.5 for generation, DepthAnythingV2 for depth maps (stored for future use). PROACTIVELY SUGGEST when new curated decks are added.
user_invocable: true
---

# Deck Art — Curated Deck Cover Generation

Generate pixel art RPG scene cover art for curated decks, with a hover parallax effect in the Study Temple library.

## Architecture

```
OpenRouter (google/gemini-2.5-flash-image) → deck front image (768×1024, 3:4)
        ↓
Deploy accepted variant as {id}.webp → public/assets/sprites/deckfronts/
        ↓
DepthAnythingV2 → depth map stored as {id}_depth.webp (future use only)
        ↓
DeckTileV2 renders single-image CSS parallax on hover
```

## Image Convention

- One image per **parent deck** (e.g., `japanese.webp` covers all `japanese_*` sub-decks)
- Knowledge decks use their exact ID (e.g., `ancient_greece.webp`)
- Depth maps: `{id}_depth.webp` alongside the color image (generated but not used in current CSS)
- Parent prefixes for language decks: `japanese`, `chinese`, `korean`, `spanish`, `french`, `german`, `dutch`, `czech`
- **33 unique images deployed** as of 2026-04-02, covering all 63 curated decks (language sub-decks share their parent image)

### `all:` Prefix Handling

The Study Temple ALL tab uses synthetic deck IDs like `all:japanese` to represent a language family. The path resolver strips the `all:` prefix before looking up the image — so `all:japanese` resolves to `deckfronts/japanese.webp`. No separate image is needed for these synthetic IDs.

## Prompt Template

### Style Suffix (append to ALL deck front prompts)
```
16-bit pixel art RPG scene, [SUBJECT DESCRIPTION], JRPG dungeon tileset aesthetic,
rich pixel detail, [PALETTE] palette, dithered shadows, clean pixel edges,
retro game screenshot composition, fills entire frame edge to edge, no border no frame,
absolutely no readable text no letters no numbers no words no symbols that resemble writing
```

### Subject Template
```
[Thematic scene description with specific visual elements], palette dominated by [2-3 colors]
```

### Example Prompts
- **Japanese**: "16-bit pixel art RPG scene, a stone torii gate on ancient dungeon steps wreathed in pixel-art mist, cherry blossom petals falling in dithered arcs, a katana resting against moss-covered stone, JRPG dungeon tileset aesthetic, rich pixel detail, deep indigo warm amber and rose palette, dithered shadows, clean pixel edges, retro game screenshot composition, fills entire frame edge to edge, no border no frame, absolutely no readable text no letters no numbers no words no symbols that resemble writing"
- **Ancient Greece**: "16-bit pixel art RPG scene, crumbling marble temple colonnade inside a vast underground cavern, moonlight filtering through a crack above in dithered rays, olive branches draping over broken fluted columns, an amphora and bronze shield on mossy stone in the foreground, JRPG dungeon tileset aesthetic, rich pixel detail, cool marble white warm gold and deep teal palette, dithered shadows, clean pixel edges, retro game screenshot composition, fills entire frame edge to edge, no border no frame, absolutely no readable text no letters no numbers no words no symbols that resemble writing"

### Prompt Rules
1. Always lead with "16-bit pixel art RPG scene" — this anchors the model to pixel art
2. Always include the full style suffix
3. Specify a 2-3 color palette for cohesion
4. NEVER request foreground/background depth separation — the fg/bg layer split approach was rejected (it produced a "bad cutout moving over the other" artifact); single image only
5. NEVER include readable text — mandatory anti-text suffix
6. Avoid painted, illustrated, or grimoire styles — the "painted grimoire cover" aesthetic was tested and rejected by the user as "cringe"

## Workflow

### 1. Add Artstudio Entry
Add entry to `sprite-gen/cardback-tool/artstudio-items.json` under `"deckfronts"`:
```json
{
  "id": "{deckId}",
  "name": "{Display Name}",
  "concept": "{Brief visual concept}",
  "prompt": "{Subject + style suffix}",
  "targetWidth": 768,
  "targetHeight": 1024,
  "variants": []
}
```

### 2. Generate via Artstudio
```bash
cd sprite-gen/cardback-tool && node server.mjs
# Then POST /api/artstudio/generate with { "id": "{deckId}", "category": "deckfronts", "count": 3 }
# Or use the artstudio UI at http://localhost:5175/artstudio.html
```
Deckfronts use OpenRouter (NOT ComfyUI). Portrait dimensions auto-select `google/gemini-2.5-flash-image`.

### 3. Accept Best Variant
Review variants in artstudio UI, click Accept on best one.

### 4. Deploy
Copy accepted variant and convert to webp:
```bash
mkdir -p public/assets/sprites/deckfronts
# Use sharp or imagemagick to convert PNG to WebP:
npx sharp-cli -i sprite-gen/cardback-tool/artstudio-output/deckfronts/{id}/variant-{n}.png -o public/assets/sprites/deckfronts/{id}.webp --format webp --quality 90
```

### 5. Generate Depth Map (stored for future use)
```bash
python3 scripts/generate_depth_maps.py --deckfronts
```
This generates `{id}_depth.webp` alongside each color image. The current parallax CSS does not use it — it is stored in case the two-layer depth parallax approach is revisited in the future.

### 6. Verify
Start dev server and navigate to Study Temple. Verify:
- Image appears on correct deck tiles (including ALL-tab synthetic IDs like `all:japanese`)
- Parallax shift works on hover (single image shifts against pointer direction)
- 3D card tilt combines with image shift for holographic effect
- Title is visible at bottom-center of art area, floating in 3D space above the image
- Gradient fallback works for decks without images

## Technical Details

### DeckTileV2 Parallax (current implementation)

The effect uses a **single background image** that shifts on pointer movement, combined with the existing ±24° 3D card tilt and a floating title:

- Background image shifts: `(pointer - center) * -0.08` % (shifts against pointer direction, scale 1.08 to hide edge clipping)
- 3D card tilt: ±24° rotation on X/Y axes (pre-existing, driven by pointer position)
- Title anchored: `position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%) translateZ(40px)` — centered at bottom of art area, floating in 3D space above the image

The fg/bg two-layer depth approach was tested but produced a visible cutout artifact and was abandoned. The single-image approach is simpler and visually cleaner.

### Title Positioning (has-image mode)

`.has-image .deck-title-3d` uses absolute positioning rather than flex layout:

```css
position: absolute;
bottom: calc(8px * var(--layout-scale, 1));
left: 50%;
transform: translateX(-50%) translateZ(calc(40px * var(--layout-scale, 1)));
```

This centers the title horizontally over the art and anchors it to the bottom edge, floating 40px forward in 3D space. The `translateX(-50%)` corrects for the `left: 50%` shift. Because `.deck-tile` has `transform-style: preserve-3d`, the Z translation creates real depth separation — the title visually lifts off the image during card tilt.

### Path Resolution

`PARENT_PREFIXES` list: `japanese`, `chinese`, `korean`, `spanish`, `french`, `german`, `dutch`, `czech`. A deck id of `japanese_n5_vocab` resolves to `deckfronts/japanese.webp`. The `all:` prefix (used by ALL-tab synthetic IDs) is stripped before resolution — `all:japanese` → `japanese` → `deckfronts/japanese.webp`.

### Files
| File | Purpose |
|------|---------|
| `sprite-gen/cardback-tool/artstudio-items.json` | Artstudio entries (prompts, variants) |
| `sprite-gen/cardback-tool/server.mjs` | Generation server (OpenRouter for deckfronts) |
| `public/assets/sprites/deckfronts/{id}.webp` | Deployed color images |
| `public/assets/sprites/deckfronts/{id}_depth.webp` | Deployed depth maps (stored, not currently used) |
| `src/ui/components/DeckTileV2.svelte` | Parallax rendering component |
| `scripts/generate_depth_maps.py` | Depth map generation (--deckfronts mode) |
