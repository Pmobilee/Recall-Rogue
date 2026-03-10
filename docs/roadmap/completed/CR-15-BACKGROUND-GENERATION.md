# CR-15: Background Generation

> Phase: P2 — Art Pipeline + First Asset Pass
> Priority: HIGH
> Depends on: CR-14 (NB1 Art Pipeline Setup)
> Estimated scope: M

Generate 6 priority backgrounds for all major game screens using the NB1 pipeline established in CR-14. Backgrounds do NOT use green screen — they are generated directly as full-frame images, then cropped to 9:20 portrait aspect ratio and downscaled to 270x600 virtual pixels. All backgrounds must read as cohesive fantasy dungeon/cavern environments with consistent pixel art style.

## Design Reference

From `sprite-gen/GENERAL_INSTRUCTIONS.md`:

> **Virtual resolution:** 270x600px (portrait, 9:20 aspect ratio)
> **Scale factor:** 4x nearest-neighbor to 1080x2400 device pixels

> | Type | Virtual Size | Device Size | Quantity Needed |
> | Combat background | 270x600 | 1080x2400 | 4-5 themed variants (1 for prototype) |
> | Title screen | 270x600 | 1080x2400 | 1 |
> | Room/path selection screen | 270x600 | 1080x2400 | 1 |
> | Shop screen | 270x600 | 1080x2400 | 1 |
> | Rest area screen | 270x600 | 1080x2400 | 1 |

> **Design note:** Top ~55% of combat backgrounds is visible during gameplay. Bottom 45% is covered by card hand and UI. Place focal point in upper-center where enemies stand.

From `docs/GAME_DESIGN.md` (Split-Stage Portrait Layout):
> Top 55% = display zone (Phaser canvas — combat, enemies, effects)
> Bottom 45% = interaction zone (Svelte DOM — card hand, quiz, buttons)

## Implementation

### Data Model

#### Prompt Manifest Entries

Add 6 background entries to `sprite-gen/arcane-prompts.json` (created in CR-14) under the `"backgrounds"` array:

```json
{
  "backgrounds": [
    {
      "id": "bg_combat_dungeon",
      "category": "backgrounds",
      "subcategory": "combat",
      "prompt": "A dark stone dungeon corridor with torches on the walls, wide establishing view, no characters, no creatures, portrait orientation tall narrow scene, pixel art game background, 32-bit era JRPG battle backdrop style, layered depth with darker foreground edges and lighter center, focal point in upper third of image, flat ground plane at vertical center for enemy to stand on, atmospheric but not busy, muted saturation so foreground sprites pop, limited color palette per material, clean pixel clusters, hand-pixeled, no blur, no depth of field, no photorealism, game asset, parallax-ready layered composition",
      "targetWidth": 270,
      "targetHeight": 600,
      "useGreenScreen": false
    },
    {
      "id": "bg_menu_title",
      "category": "backgrounds",
      "subcategory": "menu",
      "prompt": "A vast cavern entrance with light streaming in from above, expansive vista of an underground world, wide establishing view, no characters, no creatures, portrait orientation tall narrow scene, pixel art game background, 32-bit era JRPG style, large open negative space in center for text overlay, dark lower half for UI readability, visual interest concentrated in upper third with light rays and stalactites, atmospheric depth with fog layers, muted earth tones with one accent color from light source, limited color palette per material, clean pixel clusters, hand-pixeled, no blur, no depth of field, no photorealism, game asset",
      "targetWidth": 270,
      "targetHeight": 600,
      "useGreenScreen": false
    },
    {
      "id": "bg_room_selection",
      "category": "backgrounds",
      "subcategory": "rooms",
      "prompt": "An underground crossroads with three branching tunnels carved into stone, roughly symmetrical composition with three distinct archways or doorways, open floor area in lower half of image, each tunnel has slightly different ambient light color to suggest different paths, torch-lit stone walls, wide establishing view, no characters, no creatures, portrait orientation tall narrow scene, pixel art game background, 32-bit era JRPG style, atmospheric but readable, muted saturation, limited color palette per material, clean pixel clusters, hand-pixeled, no blur, no depth of field, no photorealism, game asset",
      "targetWidth": 270,
      "targetHeight": 600,
      "useGreenScreen": false
    },
    {
      "id": "bg_rest_area",
      "category": "backgrounds",
      "subcategory": "rooms",
      "prompt": "A quiet alcove in a stone cavern with a small campfire in the center, warm amber and orange light radiating from the fire, safe cozy atmosphere, bedroll and supplies nearby, smooth worn stone floor, natural rock ceiling above, wide establishing view, no characters, no creatures, portrait orientation tall narrow scene, pixel art game background, 32-bit era JRPG style, warm central light source casting soft shadows, calm peaceful mood, amber and earth tones, limited color palette per material, clean pixel clusters, hand-pixeled, no blur, no depth of field, no photorealism, game asset",
      "targetWidth": 270,
      "targetHeight": 600,
      "useGreenScreen": false
    },
    {
      "id": "bg_shop",
      "category": "backgrounds",
      "subcategory": "rooms",
      "prompt": "A cozy underground merchant den with shelves of potions and crystals lining the walls, warm lantern lighting from hanging oil lamps, wooden counter or table at center, various magical goods displayed on shelves, carved stone walls with wooden supports, wide establishing view, no characters, no creatures, portrait orientation tall narrow scene, pixel art game background, 32-bit era JRPG style, warm inviting commercial atmosphere, golden lantern light, wooden and stone textures, limited color palette per material, clean pixel clusters, hand-pixeled, no blur, no depth of field, no photorealism, game asset",
      "targetWidth": 270,
      "targetHeight": 600,
      "useGreenScreen": false
    },
    {
      "id": "bg_treasure",
      "category": "backgrounds",
      "subcategory": "rooms",
      "prompt": "A small hidden chamber with golden light reflecting off the walls, treasure chest or pile of gems in the center, sparkling particles in the air, warm golden glow permeating the scene, ancient carved stone walls with runes, narrow intimate space, wide establishing view, no characters, no creatures, portrait orientation tall narrow scene, pixel art game background, 32-bit era JRPG style, golden warm atmosphere with sparkle effects, magical reverent mood, gold and amber color scheme against dark stone, limited color palette per material, clean pixel clusters, hand-pixeled, no blur, no depth of field, no photorealism, game asset",
      "targetWidth": 270,
      "targetHeight": 600,
      "useGreenScreen": false
    }
  ]
}
```

### Logic

#### Background Post-Processing

Backgrounds follow a different pipeline from sprites (no green screen, aspect ratio crop instead of auto-crop).

**Processing steps for each background:**

1. **Generate** via NB1 API (same as sprites — `processSprite` from CR-14's `post-process.mjs` with `useGreenScreen: false`)
2. **Aspect ratio crop to 9:20 portrait** — NB1 may return a square or landscape image. Crop from center to the correct aspect ratio:

```javascript
/**
 * Crop an image to 9:20 portrait aspect ratio from center.
 * If image is already portrait (taller than wide), crop height from center.
 * If image is landscape (wider than tall), crop width from center.
 *
 * @param {Buffer} pngBuffer
 * @returns {Promise<Buffer>}
 */
async function cropToPortrait(pngBuffer) {
  const metadata = await sharp(pngBuffer).metadata();
  const { width, height } = metadata;

  // Target aspect ratio: 9:20
  const targetRatio = 9 / 20; // 0.45

  let cropW, cropH, left, top;

  if (width / height > targetRatio) {
    // Image is too wide — crop width
    cropH = height;
    cropW = Math.round(height * targetRatio);
    left = Math.round((width - cropW) / 2);
    top = 0;
  } else {
    // Image is too tall — crop height
    cropW = width;
    cropH = Math.round(width / targetRatio);
    top = Math.round((height - cropH) / 2);
    left = 0;
  }

  return sharp(pngBuffer)
    .extract({ left, top, width: cropW, height: cropH })
    .png()
    .toBuffer();
}
```

Add this function to `sprite-gen/lib/post-process.mjs` (created in CR-14).

3. **Nearest-neighbor downscale** to 270x600 virtual pixels
4. **Optional saturation reduction** for combat background only — reduce saturation by ~15% so foreground sprites pop against the background:

```javascript
// For combat background only:
buf = await sharp(buf)
  .modulate({ saturation: 0.85 })
  .png()
  .toBuffer();
```

5. **Save as PNG** (no alpha channel needed — backgrounds are opaque):

```javascript
buf = await sharp(buf)
  .flatten({ background: { r: 0, g: 0, b: 0 } }) // Remove alpha, fill with black
  .png()
  .toBuffer();
```

#### Generation Order

Generate backgrounds in this order (most important first, so if budget runs low, critical screens are covered):

1. `bg_combat_dungeon` — needed for combat scene
2. `bg_menu_title` — needed for main menu
3. `bg_room_selection` — needed for room selection
4. `bg_rest_area` — needed for rest room overlay
5. `bg_shop` — needed for future shop overlay
6. `bg_treasure` — needed for future treasure overlay

Run with: `npm run generate:arcane-sprites -- --category backgrounds`

Or individually: `npm run generate:arcane-sprites -- --id bg_combat_dungeon`

#### Sprite Registry Updates

After each background is generated, add to `sprite-registry.json` under the `recallRogue` array:

```json
{
  "key": "bg_combat_dungeon",
  "category": "backgrounds",
  "subcategory": "combat",
  "prompt": "A dark stone dungeon corridor...",
  "model": "google/gemini-2.5-flash-image",
  "targetSizes": { "full": [270, 600] },
  "outputPaths": {
    "original": "sprite-gen/output/backgrounds/bg_combat_dungeon_original.png",
    "final": "public/assets/backgrounds/combat/dungeon.png"
  },
  "generatedAt": "2026-03-09T12:00:00Z"
}
```

#### Output File Mapping

| Manifest ID | Output Path |
|-------------|-------------|
| `bg_combat_dungeon` | `public/assets/backgrounds/combat/dungeon.png` |
| `bg_menu_title` | `public/assets/backgrounds/menu/title.png` |
| `bg_room_selection` | `public/assets/backgrounds/rooms/selection.png` |
| `bg_rest_area` | `public/assets/backgrounds/rooms/rest.png` |
| `bg_shop` | `public/assets/backgrounds/rooms/shop.png` |
| `bg_treasure` | `public/assets/backgrounds/rooms/treasure.png` |

The filename for backgrounds is derived from the manifest ID by stripping the `bg_` prefix and the subcategory prefix. The generation script must map `id` to the correct output path based on `subcategory`. Add a `filename` override field to the manifest if the automatic mapping is ambiguous:

```json
{
  "id": "bg_combat_dungeon",
  "category": "backgrounds",
  "subcategory": "combat",
  "filename": "dungeon.png",
  ...
}
```

### UI

No UI changes in this CR. Backgrounds are generated and saved to disk. Wiring them into the actual game screens (CombatScene, CardApp, RoomSelection, etc.) is a separate CR.

### System Interactions

- **Reads**: `sprite-gen/arcane-prompts.json` (background entries), `.env` (API key)
- **Writes**: `sprite-gen/output/backgrounds/*.png` (raw), `public/assets/backgrounds/{subcategory}/*.png` (final), `sprite-gen/sprite-registry.json`
- **External**: OpenRouter API (6 API calls, ~$0.24 at $0.04/image)
- **Dependencies**: `sharp` (already installed via CR-14), `dotenv` (already installed)
- **Uses**: `sprite-gen/generate-arcane-sprites.mjs` (created in CR-14), `sprite-gen/lib/post-process.mjs` (created in CR-14)

## Edge Cases

| Scenario | Expected Behavior |
|----------|------------------|
| NB1 generates landscape instead of portrait | `cropToPortrait()` crops from center to 9:20 aspect ratio — verify important content is preserved |
| NB1 generates square image | `cropToPortrait()` crops width from center; results may need wider prompt (add "tall narrow scene" to prompt) |
| Background too dark (can't see anything) | Regenerate with `--force --id bg_xxx`, adjust prompt to add "dimly lit with visible details" or "torch-lit" |
| Background too bright/washed out | Regenerate with adjusted prompt: add "dark atmospheric" or "moody lighting" |
| Style inconsistency between backgrounds | Regenerate the outlier with `--force --id bg_xxx`; all prompts share the same style suffix for consistency |
| Combat bg has no clear ground plane | Regenerate with emphasis: "flat ground plane at vertical center for enemy to stand on" — this is critical for enemy placement |
| Title bg has no dark area for text | Regenerate with emphasis: "dark lower half for UI readability, large empty negative space" |
| Room selection bg doesn't show 3 paths | Regenerate with emphasis: "three distinct archways or doorways, roughly symmetrical" |
| Portrait crop loses important content (e.g., campfire cut off) | Adjust crop offset: shift `top` parameter to keep focal content; alternatively, regenerate with "centered composition" |
| API returns non-pixel-art style | All prompts include "pixel art, 32-bit era JRPG style, hand-pixeled, no blur, no photorealism" — if still wrong, add "retro game sprite" and regenerate |
| Generated image has watermark or text artifacts | Regenerate — NB1 occasionally adds text; the "no text, no watermark" suffix can help |
| Rate limiting during batch of 6 | Built-in 6s delay between calls (CR-14); 6 images = ~36s minimum |

## Files

| Action | File | What Changes |
|--------|------|--------------|
| Modify | `sprite-gen/arcane-prompts.json` | Add 6 background entries to the `backgrounds` array |
| Modify | `sprite-gen/lib/post-process.mjs` | Add `cropToPortrait()` function for 9:20 aspect ratio cropping |
| Modify | `sprite-gen/generate-arcane-sprites.mjs` | Handle `backgrounds` array from manifest (route to correct output dirs, apply portrait crop, optional saturation reduction for combat bg) |
| Create | `public/assets/backgrounds/combat/dungeon.png` | Combat background (270x600) |
| Create | `public/assets/backgrounds/menu/title.png` | Title screen background (270x600) |
| Create | `public/assets/backgrounds/rooms/selection.png` | Room selection background (270x600) |
| Create | `public/assets/backgrounds/rooms/rest.png` | Rest area background (270x600) |
| Create | `public/assets/backgrounds/rooms/shop.png` | Shop background (270x600) |
| Create | `public/assets/backgrounds/rooms/treasure.png` | Treasure room background (270x600) |
| Modify | `sprite-gen/sprite-registry.json` | Register all 6 backgrounds in `recallRogue` array |

## Done When

- [ ] 6 background prompts added to `sprite-gen/arcane-prompts.json` with full style suffixes
- [ ] `cropToPortrait()` function added to `sprite-gen/lib/post-process.mjs`
- [ ] Generation script handles `backgrounds` array entries correctly (no green screen, portrait crop, correct output paths)
- [ ] All 6 backgrounds generated via NB1 pipeline (`npm run generate:arcane-sprites -- --category backgrounds`)
- [ ] All backgrounds are portrait orientation, exactly 270x600 pixels
- [ ] **Combat background** (`dungeon.png`): has visible ground plane at vertical center for enemy placement, muted saturation, atmospheric stone dungeon
- [ ] **Title screen** (`title.png`): has dark lower half suitable for text/button overlay, visual interest in upper third
- [ ] **Room selection** (`selection.png`): shows 3 distinct paths/doorways/tunnels, roughly symmetrical
- [ ] **Rest area** (`rest.png`): feels warm and safe, amber/orange tones from campfire, calm atmosphere
- [ ] **Shop** (`shop.png`): feels cozy and merchant-like, shelves of goods visible, warm lantern lighting
- [ ] **Treasure room** (`treasure.png`): has golden glow atmosphere, sparkle/magical feeling
- [ ] All 6 backgrounds registered in `sprite-registry.json` under `recallRogue` array with `generatedAt` timestamps
- [ ] All raw outputs saved in `sprite-gen/output/backgrounds/` (not committed to git)
- [ ] Playwright screenshots taken at mobile viewport (390x844, Pixel 7) for each background — saved for human review
- [ ] No obvious style inconsistencies between the 6 backgrounds (all read as same game world)
- [ ] Combat background tested with a sprite overlay to verify sprites are visible against it
