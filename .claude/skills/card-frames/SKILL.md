---
name: card-frames
description: Card frame system — PSD layer extraction, card art positioning, frame layering, and visual debugging. Use when modifying card visuals, frame layers, card art sizing, or re-extracting from PSD.
user_invocable: false
---

# Card Frame System — Technical Reference

## PSD Source of Truth

**File:** `data/generated/CARDFRAMES/NEW_CARD.psd`
**Canvas:** 886x1142 pixels

### Layer Stack (bottom to top in PSD, top to bottom in render)

| PSD Index | Layer Name | Visible | Purpose |
|-----------|-----------|---------|---------|
| 0 | PLACE WHERE ARTWORK GOES | Yes | Guide layer — defines exact art position: bbox(176,186,719,609) |
| 1 | Rest of the card that stays the same | Yes | Base frame — has transparent pentagon window for art |
| 2 | Colored outside | Yes | Border tinted per card type (attack=red, shield=blue, etc.) |
| 3 | banner | Yes | Title banner ribbon |
| 4 | Banner Attack Title | No | Guide — title text area |
| 5 | Artwork Area Top center | No | Guide — older art area reference |
| 6 | text Area for card info | No | Guide — effect text area |
| 7 | Card type (attack defend) area | No | Guide — UNUSED, labels hidden |
| 8 | AP Cost Area top left | No | Guide — AP gem position |
| 9 | Upgraded | Yes | Mastery upgrade overlay |
| 10 | Upgrade Icon | Yes | Mastery level icon |

### Art Position (from PSD layer "PLACE WHERE ARTWORK GOES")

```
PSD bbox: (176, 186, 719, 609) on 886x1142
CSS:  left: 19.9%
      top:  16.3%
      width: 61.3%
      height: 37.0%
```

## Extraction Script

**Script:** `scripts/extract-card-frame.py`
**Output:** `public/assets/cardframes/v2/`

```bash
python3 scripts/extract-card-frame.py
```

Produces 29 files:
- `card-frame-base.webp` — base frame with transparent art window
- `card-border-{attack,shield,buff,debuff,utility,wild}.webp` — 6 colored borders
- `card-banner-chain{0-5}.webp` — 6 chain-colored banners
- `card-upgrade-icon.webp` — mastery icon
- `lowres/` variants of all above
- `manifest.json`

### How Extraction Works

1. Layers are mapped **by name** (not index) for safety
2. Base frame layer already has transparent pentagon window — no manual cutout
3. Border layer is hue-shifted to produce 6 color variants
4. Banner layer is hue-shifted to produce 6 chain color variants
5. All output is lossless WebP

### When to Re-Extract

- After editing the PSD (any layer change)
- After modifying `scripts/extract-card-frame.py`
- Run `python3 scripts/extract-card-frame.py` and commit the output

## Game Rendering (CardHand.svelte)

### DOM Structure

```html
<div class="card-v2-frame">
  <!-- Border (card type color) -->
  <img class="frame-layer" src="card-border-{type}.webp" />
  <!-- Card art (positioned in pentagon window) -->
  <img class="frame-card-art" src="{mechanicId}.png" />
  <!-- Base frame (opaque areas mask art edges, transparent window shows art) -->
  <img class="frame-layer" src="card-frame-base.webp" />
  <!-- Banner (chain color) -->
  <img class="frame-layer" src="card-banner-chain{n}.webp" />
  <!-- Upgrade icon (conditional) -->
  <img class="frame-layer upgrade-icon" src="card-upgrade-icon.webp" />
  <!-- Text overlays (AP cost, mechanic name, effect text) -->
  <div class="frame-text v2-ap-cost">...</div>
  <div class="frame-text v2-mechanic-name">...</div>
  <div class="frame-text v2-effect-text">...</div>
</div>
```

### Layering Order

Art is placed BETWEEN the border and base frame in DOM order. The base frame has a transparent pentagon window — the opaque cream/beige area around the window masks the art edges. **DOM paint order handles the stacking — no z-index needed.**

1. Border (back) — colored outer border
2. **Card art** — positioned at PSD art box coordinates
3. Base frame (front) — opaque except pentagon window
4. Banner — title ribbon
5. Upgrade icon — mastery indicator
6. Text overlays — AP cost, name, effect

### Critical CSS Rules

```css
.card-v2-frame {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden; /* clips art to frame boundaries */
}

.frame-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain; /* MUST be contain, not fill */
  pointer-events: none;
  image-rendering: pixelated;
}

.frame-card-art {
  position: absolute;
  left: 19.9%;
  top: 16.3%;
  width: 61.3%;
  height: 37.0%;
  object-fit: cover;
  image-rendering: auto;
  pointer-events: none;
  border-radius: 4px;
}
```

### Card Container (.card-in-hand)

The card button container MUST have:
- `background-color: transparent` — no container background
- `border: none` — no container border
- `box-shadow: none` — no container shadow
- `overflow: visible` — MUST be visible (not hidden) for card flip animations and raised state

The `.card-has-frame` class reinforces these for framed cards.

## HARD RULES — What NOT To Do

### Never use z-index for card art layering
The parent `.card-inner` has `transform-style: preserve-3d` for flip animations. This creates a 3D rendering context where CSS z-index behaves unpredictably. **DOM order is the only reliable stacking method.**

### Never use overflow:hidden on .card-in-hand
This collapses the card to microscopic size. The card button needs `overflow: visible` for animations. Only `.card-v2-frame` uses `overflow: hidden`.

### Never use sed for card CSS changes
Previous attempts using `sed -i` to change width/height values corrupted the entire file by replacing ALL occurrences, not just the target rule. **Always use targeted Edit tool on the specific CSS rule.**

### Never use background-image approach for card art
Attempted putting art as `background-image` on the base frame img element. While CSS backgrounds paint behind content, `<img>` elements with `object-fit: contain` don't composite background-image intuitively. **Use a separate `<img>` element with DOM order stacking.**

### Card type labels are hidden
`.v2-card-type` has `display: none`. The ATTACK/SHIELD/UTILITY labels were removed per user request.

## Artstudio Card Preview

The artstudio page (`sprite-gen/cardback-tool/public/artstudio.html`) has its own card preview for the Card Art tab. It should match the game's positioning:

- Frame assets served from `/card-frame-assets/` (copies in `sprite-gen/cardback-tool/public/card-frame-assets/`)
- Art positioning should match: `left:19.9% top:16.3% width:61.3% height:37.0%`
- After re-extracting frames, copy updated WebP files to the artstudio's `card-frame-assets/` directory

## Card Art Assets

- **Location:** `public/assets/cardart/`
- **Format:** PNG (1024x1024 source), WebP variants
- **Naming:** `{mechanicId}.png` (e.g., `strike.png`, `block.png`)
- **Manifest:** `src/ui/utils/cardArtManifest.ts` — `getCardArtUrl(mechanicId)` returns the URL
- **Generation:** Via artstudio (`sprite-gen/cardback-tool/artstudio-items.json`, category `cardart`)
