---
name: deck-art
description: Generate and deploy deck front cover art with parallax hover effect for the Study Temple library. Uses OpenRouter Gemini Flash 2.5 for generation, DepthAnythingV2 for depth maps (stored for future use). PROACTIVELY SUGGEST when new curated decks are added.
user_invocable: true
---

# Deck Art — Curated Deck Cover Generation

Generate pixel art RPG scene cover art for curated decks, with a hover parallax effect in the Study Temple library.

## Architecture

```
scripts/generate-deckfronts.mjs (diff decks vs deployed)
        ↓
OpenRouter google/gemini-2.5-flash-image → 768×1024 portrait
        ↓
sharp → public/assets/sprites/deckfronts/{id}.webp (quality 90, nearest)
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

## Workflow — One-Shot Direct Generation (Canonical, 2026-04-10)

**Per user feedback: skip the artstudio UI review loop. Generate one variant directly via OpenRouter and deploy immediately.** The "queue 3, review, accept, copy" flow was replaced because it was high-friction for bulk generation. When the user says "generate deck fronts", use this script — no questions asked.

### Standard flow
```bash
# Generate all missing deckfronts (diffs data/decks/ vs public/assets/sprites/deckfronts/)
node scripts/generate-deckfronts.mjs

# Specific decks
node scripts/generate-deckfronts.mjs --id anime_manga,chess_tactics

# Regenerate existing
node scripts/generate-deckfronts.mjs --id philosophy --force
```

### How it works
1. Enumerates `data/decks/*.json`, collapses language families via `PARENT_PREFIXES` (japanese/chinese/korean/spanish/french/german/dutch/czech)
2. Diffs against `public/assets/sprites/deckfronts/*.webp` to find missing
3. For each missing deck, builds a prompt from `DECK_PROMPTS` (hand-authored subjects for known decks) or a themed fallback derived from the deck name
4. Calls OpenRouter `google/gemini-2.5-flash-image` (Nano Banana) at 768×1024 portrait
5. Writes directly to `public/assets/sprites/deckfronts/{id}.webp` via sharp (quality 90, nearest-neighbor resize to preserve pixel edges)
6. No review, no accept step, no artstudio entry required

### Adding a new themed deck prompt
Edit `DECK_PROMPTS` in `scripts/generate-deckfronts.mjs`:
```js
my_new_deck: {
  palette: '2-3 color description (e.g. "deep teal and warm amber")',
  subject: 'underground/dungeon scene with thematic props...',
},
```
The script assembles: `STYLE_LEAD + subject + STYLE_SUFFIX(palette)`. If you omit the entry, the fallback produces a generic dungeon themed by deck name — fine for quick coverage, better to hand-author for hero decks.

### Studying existing style before authoring prompts
Before adding to `DECK_PROMPTS`, browse existing entries in both:
- `scripts/generate-deckfronts.mjs` → `DECK_PROMPTS` (current source of truth)
- `sprite-gen/cardback-tool/artstudio-items.json` → `deckfronts` (historical reference for the 65 previously-generated decks)

Match the existing vocabulary: "underground", "dungeon", "mossy stone", "dithered shadows", "torchlight", "cavern", "cracked flagstones". Every scene is interior/subterranean — never open sky.

### Legacy artstudio-items.json
Entries for decks generated before 2026-04-10 remain in `sprite-gen/cardback-tool/artstudio-items.json`. New decks no longer need an entry there — the standalone script is authoritative.

### Optional: depth maps (stored for future use only)
```bash
python3 scripts/generate_depth_maps.py --deckfronts
```
Current parallax CSS does not use depth maps — skip unless the two-layer approach is being revisited.

### Verify
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
