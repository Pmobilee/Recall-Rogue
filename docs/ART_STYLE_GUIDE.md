# Terra Miner — Art Style Guide: Cel-Shaded 2D Pixel Art

This document defines the visual art style for ALL sprites in Terra Miner. Every generated sprite must conform to these rules.

---

## Table of Contents

1. [Core Visual Principles](#core-visual-principles)
2. [Color Rules](#color-rules)
3. [Texture Rules](#texture-rules)
4. [Character Rules](#character-rules)
5. [Prompt Template](#prompt-template)
6. [Category-Specific Prompts](#category-specific-prompts)
7. [Biome Color Palettes](#biome-color-palettes)
8. [DO and DON'T Guide](#do-and-dont-guide)

---

## Core Visual Principles

1. **Bold black outlines** (1-2px) around ALL elements — every object, character, and tile has a clear dark outline that defines its silhouette
2. **Flat color fills** with limited shading — 2-3 tones per color (base, shadow, highlight). NO smooth gradients
3. **High contrast** between adjacent colors — shadows are distinctly darker, highlights distinctly brighter
4. **Clean, crisp edges** — no anti-aliasing, no blur, no soft transitions
5. **Saturated, vibrant palette** — bold colors, not washed out or overly realistic
6. **Consistent top-left lighting** — highlights on upper-left edges, shadows on lower-right
7. **Chunky, readable pixels** — detail comes from color placement, not resolution

---

## Color Rules

- Each material uses exactly **3 tones**: highlight, base, shadow
- Outlines are **pure black** (`#000000`) or **near-black** (`#1a1a2e` for softer look)
- Highlights can be white-tinted but **never pure white** (use `#e8e8f0` max)
- Shadows are the base color **darkened 30-40%**, shifted toward blue/purple
- Background elements use **slightly desaturated** versions of foreground palette
- Adjacent color zones must have **high contrast** — no two neighboring tones should be close in value

---

## Texture Rules

| Material | Cel-Shaded Treatment |
|---|---|
| **Rock** | Angular shapes with sharp color transitions, 2-3 grey/brown tones, strong outline on each chunk |
| **Metal** | Horizontal highlight bands, rivet dots, cool grey base with warm highlight |
| **Organic** | Rounded shapes, warm tones, visible leaf/petal patterns, 2 greens + 1 highlight |
| **Crystal/Glass** | Sharp diagonal highlights, cool blue tints, bright specular dot on facets |
| **Dirt/Earth** | Warm brown base, darker brown shadow clusters, tiny lighter speck highlights |
| **Lava/Fire** | Orange-red base, yellow highlight, deep red shadow, no glow gradients |

All textures use flat color bands — NO dithering, NO smooth gradients, NO noise.

---

## Character Rules

- **Chibi/compact proportions** — head approximately 40% of body height
- **Strong silhouette** — must be recognizable at 32px
- **1-2px black outline** on ALL body parts (head, torso, limbs, equipment)
- **Simple face features**: dot eyes, minimal mouth (1-2px)
- **Equipment/accessories** have their own distinct outline separate from the body
- **3 tones per skin/clothing area** — no more, no less

---

## Prompt Template

Every AI sprite generation prompt MUST include these exact phrases:

```
cel-shaded 2D pixel art, bold black outlines, flat color shading with 2-3 tones per color,
no gradients, no anti-aliasing, high contrast, vibrant saturated colors, clean crisp edges,
top-left lighting, retro 16-bit game style, visible chunky pixels
```

These keywords are **mandatory** in every prompt, in addition to:
- `solid bright green (#00FF00) background` (for transparency pipeline)
- `centered in frame` (for auto-cropping)
- Subject-specific description (what the sprite actually depicts)

### Old Style Keywords (REMOVED — do not use)

The following phrases from the previous style are **replaced**:
- ~~"Pixel art game asset, retro 16-bit style, visible blocky pixels"~~ — replaced by the cel-shaded template above
- ~~"Pixel art, retro 16-bit, visible blocky pixels"~~ — replaced by the cel-shaded template above
- ~~"Pixel art style, retro 16-bit era, visible blocky pixels"~~ — replaced by the cel-shaded template above

---

## Category-Specific Prompts

### Dome Objects (furniture, machines, terminals)

```
Cel-shaded 2D pixel art game asset, bold black outlines, flat color shading with 2-3 tones
per color, no gradients, no anti-aliasing, high contrast, vibrant saturated colors, clean
crisp edges, top-left lighting, retro 16-bit game style, visible chunky pixels.
[OBJECT DESCRIPTION — e.g., "A compact hydroponic planter with glowing blue nutrient tubes
and small green leafy plants, brushed titanium frame."]
Front-facing 3/4 angle, centered in frame. Far-future Earth sci-fi dome habitat style.
Solid bright green (#00FF00) background.
```

### Mining Blocks (ores, hazards, structural)

```
Cel-shaded 2D pixel art game asset, bold black outlines, flat color shading with 2-3 tones
per color, no gradients, no anti-aliasing, high contrast, vibrant saturated colors, clean
crisp edges, top-left lighting, retro 16-bit game style, visible chunky pixels.
[BLOCK DESCRIPTION — e.g., "A rough iron ore block with reddish-brown oxidized patches and
exposed metallic veins, embedded in dark grey stone."]
2D side view, centered in frame, 32x32 pixel grid. Underground mining context.
Solid bright green (#00FF00) background.
```

### Characters (miner, NPCs)

```
Cel-shaded 2D pixel art game asset, bold black outlines, flat color shading with 2-3 tones
per color, no gradients, no anti-aliasing, high contrast, vibrant saturated colors, clean
crisp edges, top-left lighting, retro 16-bit game style, visible chunky pixels.
[CHARACTER DESCRIPTION — e.g., "Chibi miner character in orange spacesuit, pickaxe in hand,
helmet with headlamp."]
Front-facing 3/4 angle, compact chibi proportions, strong silhouette at 32px.
Solid bright green (#00FF00) background.
```

### Companions and Pets

```
Cel-shaded 2D pixel art game asset, bold black outlines, flat color shading with 2-3 tones
per color, no gradients, no anti-aliasing, high contrast, vibrant saturated colors, clean
crisp edges, top-left lighting, retro 16-bit game style, visible chunky pixels.
[PET DESCRIPTION — e.g., "Grey-brown fluffy cave cat sitting idle, glowing amber eyes,
mining dust on fur."]
Cute, front-facing, compact proportions. Solid bright green (#00FF00) background.
```

### Icons (resources, UI elements)

```
Cel-shaded 2D pixel art game asset, bold black outlines, flat color shading with 2-3 tones
per color, no gradients, no anti-aliasing, high contrast, vibrant saturated colors, clean
crisp edges, top-left lighting, retro 16-bit game style, visible chunky pixels.
[ICON DESCRIPTION — e.g., "Glowing blue crystal shard icon, faceted gem shape."]
Flat front-facing view, centered in frame, simple iconic shape.
Solid bright green (#00FF00) background.
```

### Tiles (floors, walls, backgrounds)

```
Cel-shaded 2D pixel art game asset, bold black outlines, flat color shading with 2-3 tones
per color, no gradients, no anti-aliasing, high contrast, vibrant saturated colors, clean
crisp edges, top-left lighting, retro 16-bit game style, visible chunky pixels.
[TILE DESCRIPTION — e.g., "Natural stone floor tile, grey-brown cobblestone pattern with
subtle cracks, underground cavern floor."]
Seamless tileable, 32x32 pixel grid. Solid bright green (#00FF00) background.
```

---

## Biome Color Palettes

Each biome has a 3-tone palette for its primary materials. All tones follow the cel-shaded rule: highlight, base, shadow.

### Tier 1 — Shallow (Layers 1-5)

| Biome | Soil Tones | Rock Tones |
|---|---|---|
| **Topsoil** | `#c4a56e` / `#8b7040` / `#5c4a2a` | `#a0998c` / `#706b60` / `#4a4640` |
| **Limestone** | `#e8dcc4` / `#c4b89a` / `#8a806e` | `#d4caba` / `#a89e8e` / `#706860` |
| **Clay** | `#d47040` / `#a84e2c` / `#6e3420` | `#b08060` / `#886044` / `#5c4030` |
| **Sandstone** | `#e8c880` / `#c4a050` / `#8a7038` | `#d4b470` / `#a88c48` / `#706030` |
| **Shale** | `#808890` / `#586068` / `#384048` | `#687078` / `#485058` / `#303840` |

### Tier 2 — Mid (Layers 6-10)

| Biome | Soil Tones | Rock Tones |
|---|---|---|
| **Granite** | `#b0a8a0` / `#888078` / `#585450` | `#a09890` / `#787068` / `#504840` |
| **Slate** | `#708088` / `#506068` / `#384048` | `#607078` / `#405058` / `#283840` |
| **Basalt** | `#505860` / `#383e48` / `#202830` | `#404850` / `#283038` / `#182028` |
| **Quartz** | `#e8e0f0` / `#c0b8d0` / `#8880a0` | `#d0c8e0` / `#a8a0c0` / `#787090` |
| **Iron Vein** | `#c06040` / `#904830` / `#603020` | `#a05838` / `#704028` / `#482818` |

### Tier 3 — Deep (Layers 11-15)

| Biome | Soil Tones | Rock Tones |
|---|---|---|
| **Obsidian** | `#302830` / `#201820` / `#100810` | `#282028` / `#181018` / `#080008` |
| **Crystal Geode** | `#b080d0` / `#8850a0` / `#583070` | `#a070c0` / `#784090` / `#482860` |
| **Magma Shelf** | `#e06030` / `#b04020` / `#702810` | `#c05028` / `#903818` / `#602010` |
| **Ancient Ruin** | `#a0a890` / `#708068` / `#485840` | `#889880` / `#607058` / `#404838` |
| **Fossil Layer** | `#d8d0b8` / `#b0a890` / `#787060` | `#c4bca4` / `#989080` / `#686058` |

### Tier 4 — Abyssal (Layers 16-20)

| Biome | Soil Tones | Rock Tones |
|---|---|---|
| **Diamond Vein** | `#c0d8e8` / `#88b0c8` / `#587890` | `#a8c8d8` / `#70a0b8` / `#486880` |
| **Void Stone** | `#282030` / `#181020` / `#080010` | `#201828` / `#100818` / `#000008` |
| **Plasma Core** | `#e8c040` / `#c09028` / `#886018` | `#d0a838` / `#987820` / `#685010` |
| **Mythril Seam** | `#80c0d0` / `#5090a8` / `#306078` | `#70b0c0` / `#408098` / `#205068` |
| **Echo Chamber** | `#7888a0` / `#506078` / `#304050` | `#687898` / `#405068` / `#283848` |

---

## DO and DON'T Guide

### DO

- **DO** use bold 1-2px black outlines around every distinct element
- **DO** limit each color area to exactly 3 tones (highlight, base, shadow)
- **DO** use flat, uniform color fills within each tone zone
- **DO** maintain high contrast between neighboring colors
- **DO** place highlights on the upper-left and shadows on the lower-right
- **DO** use vibrant, saturated base colors
- **DO** keep pixel edges crisp and clean with no sub-pixel blending
- **DO** make silhouettes recognizable at 32px scale

### DON'T

- **DON'T** use smooth gradients or color ramps with more than 3 steps
- **DON'T** use anti-aliasing or sub-pixel rendering
- **DON'T** use dithering patterns to simulate gradients
- **DON'T** use soft shadows or gaussian blur effects
- **DON'T** use more than 3 tones per material/color area
- **DON'T** use desaturated or muted palettes (keep colors bold)
- **DON'T** omit outlines on any element — even small details need definition
- **DON'T** use pure white (`#ffffff`) for highlights — cap at `#e8e8f0`
- **DON'T** use realistic lighting or ray-traced effects
- **DON'T** create sprites that lose readability at 32px — if detail vanishes at small scale, simplify

### Common Mistakes to Avoid

- **Gradient masquerading as flat shading**: If you see more than 3 distinct color values in a single material zone, the sprite has gradients. Regenerate.
- **Missing outlines**: Every object boundary, every clothing seam, every equipment piece needs a black outline. If elements blend into each other, outlines are missing.
- **Low contrast**: If you squint and two adjacent areas merge visually, the contrast is too low. Darken shadows or brighten highlights.
- **Over-detailed at source resolution**: A sprite that looks amazing at 1024px but becomes muddy at 32px has too much detail. Simplify shapes and use fewer, larger color zones.

---

## Reference

- **AI Model**: Nano Banana 1 (`google/gemini-2.5-flash-image`) via OpenRouter — the ONLY model used for all sprites
- **Generation Pipeline**: See [IMAGE_GENERATION.md](IMAGE_GENERATION.md)
- **Sprite Registry**: `sprite-gen/sprite-registry.json` — all 347 sprites with their prompts
- **Generation Script**: `sprite-gen/scripts/generate-sprites.mjs`
