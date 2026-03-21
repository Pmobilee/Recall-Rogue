# Card Visual Inspection Report — V2 Frame Layout
**Date:** 2026-03-21
**Tested viewport:** 1280×720 (desktop browser)
**Card size at time of test:** 141×202px (frame), 145×206px (card-in-hand including border)
**Card CSS variable:** `--card-w = calc(calc(27vh * 0.80) / 1.42)` → resolves to ~141px
**Source files inspected:**
- `/src/ui/components/CardHand.svelte` (CSS lines 1466–1650)
- `/src/ui/utils/cardFrameV2.ts` (GUIDE_STYLES constants)

---

## Summary of All Issues Found

| # | Element | Severity | Issue |
|---|---------|----------|-------|
| 1 | `.v2-card-type` | CRITICAL | Container too narrow: 29px wide, content needs 38–47px. ALL card types overflow. |
| 2 | `.card-type-icon` (emoji) | CRITICAL | Icon renders OUTSIDE and to the LEFT of its parent container |
| 3 | `.v2-mechanic-name` | HIGH | Container height only 9px with font-size 15.9px — text heavily clipped vertically |
| 4 | `.frame-card-art` | MEDIUM | All art images report "occluded by card-v2-frame" (hitTest returns frame div) |
| 5 | `card-effect-2` (Adapt) | MEDIUM | Effect text overflows: scrollH 78 > containerH 66 for long text |
| 6 | `card-name-3` (Double Strike) | LOW | Name overflows: scrollW 95 > containerW 76 |
| 7 | `card-name-0` (Empower) | LOW | Name overflows: scrollW 78 > containerW 76 (marginal) |
| 8 | `card-name-3` (Overclock) | LOW | Name overflows: scrollW 79 > containerW 76 (marginal) |

---

## Issue 1 (CRITICAL): Card Type Label Container Too Narrow

### What was observed
Every card type label overflows its container. The `.v2-card-type` div is only **29px wide** but the content requires 38–47px depending on type.

| Card type text | Container W | Scroll W | Overflow |
|---------------|-------------|----------|----------|
| `⚔ ATTACK`   | 29px        | 45px     | +16px    |
| `🛡 SHIELD`   | 29px        | 46px     | +17px    |
| `✦ BUFF`      | 29px        | 38px     | +9px     |
| `✦ DEBUFF`    | 29px        | 46px     | +17px    |
| `✦ UTILITY`   | 29px        | 47px     | +18px    |
| `✦ WILD`      | 29px        | 38px     | +9px     |

The container clips with `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`, so the user sees a truncated string like `"TTA"` or `"UFF"` or similar — the beginning characters only, cut off after 29px.

### Root cause
`GUIDE_STYLES.cardType` in `cardFrameV2.ts` is defined as:
```ts
cardType: guideStyle(352, 615, 182, 54),
```
At a 141px-wide card, this computes to:
- `width = (182/886) × 141 = **29px**`
- `left = (352/886) × 141 = 56px`

The PSD guide zone (182px wide at 886px canvas scale) maps to only 29px at the in-hand card size. The font size `calc(var(--card-w) * 0.085)` produces ~12px, and "⚔ ATTACK" at 12px font with emoji icon needs ~45px of horizontal space.

### Fix options
**Option A (preferred):** Widen the guide zone in `GUIDE_STYLES.cardType`. Increase `w` from 182 to ~300 (maps to ~48px at 141px card width) and shift `x` left from 352 to ~243 to keep it centered.

```ts
// Before:  guideStyle(352, 615, 182, 54)
// After:   guideStyle(243, 615, 400, 54)   ← centered, 3× wider
cardType: guideStyle(243, 615, 400, 54),
```

**Option B:** Remove the icon from the type label to save space, and widen the zone less:
```ts
cardType: guideStyle(293, 615, 300, 54),
```

**Option C:** Drop the text label entirely on in-hand cards (too small), show only the colored border (already present) as the type indicator. The banner and border color are already type-coded.

---

## Issue 2 (CRITICAL): Type Icon Renders Outside Parent Container

### What was observed
The `.card-type-icon` span (the ⚔/🛡/✦ emoji) is positioned to the LEFT of the `.v2-card-type` container.

| Element | X position |
|---------|-----------|
| `.v2-card-type` container | x: 280 |
| `.card-type-icon` emoji | x: 263 |

The icon is **17px to the left** of where the container starts. It is rendered as a sibling in a flex row but because the container overflows (total content 45px in 29px container), with `overflow: hidden`, the flex layout starts at the left edge of the scrollable content — but the icon is positioned at the scrolled-left position which bleeds left of the visible container boundary.

### Root cause
The `.v2-card-type` uses `display: flex; overflow: hidden; white-space: nowrap`. The flex container starts rendering the icon at the left edge of the scroll content area. Since the content (icon + text) is wider than the container, the browser positions the icon at the start of the overflow zone, which extends left of the container's visible boundary.

Combined with Issue 1, fixing the container width will automatically fix this — the icon will fit inside the wider container.

### Immediate CSS workaround (if not widening the container)
```css
.card-type-icon {
  flex-shrink: 0;
  min-width: 0;
}
/* And on .v2-card-type: */
.v2-card-type {
  justify-content: flex-start; /* not center, avoids negative overflow */
}
```

---

## Issue 3 (HIGH): Mechanic Name Container Too Short Vertically

### What was observed
- Font size: **15.9px**
- Line height: **22.3px**
- Container height: **8.84px** (measured) / **9px** (clientHeight)

The container is **less than half the font size**. The text is being severely clipped — only the very center strip of each letter is visible. "Strike" at 15.9px in a 9px container means 3px is visible above the center line and 3px below, cutting off ascenders and descenders.

### Root cause
`GUIDE_STYLES.mechanicName` uses `guideStyle(205, 145, 478, 50)`:
- `height = (50/1142) × 202 = **8.84px**`
- `width = (478/886) × 141 = 76px`

The guide height of 50 PSD pixels maps to only 8.84px at the rendered card size. With font-size `calc(var(--card-w) * 0.11)` = 15.5px, the text needs at least 16px height.

### Fix
Increase the guide height for `mechanicName`. The font needs ~20px container to render with proper top/bottom padding:

```ts
// Before: guideStyle(205, 145, 478, 50)
// After:  guideStyle(205, 130, 478, 100)   ← taller zone, shifted up slightly
mechanicName: guideStyle(205, 130, 478, 100),
```

This maps to: `height = (100/1142) × 202 = 17.7px` — enough for the 15.9px font.

Alternatively, reduce the font size to fit the existing container:
```css
.v2-mechanic-name {
  font-size: calc(var(--card-w) * 0.058); /* was 0.11 */
}
```
At 0.058 × 141 = 8.2px — would fit but be nearly unreadable.

**Recommended:** Increase guide zone height AND slightly reduce font size to `0.09` (12.7px) for a comfortable fit.

---

## Issue 4 (MEDIUM): Card Art Reported as "Occluded by card-v2-frame"

### What was observed
All 5 card art images report `occluded: true, occludedBy: "card-v2-frame"` in the `elementFromPoint()` test. This means clicking the center of the art zone hits the `.card-v2-frame` div, not the `<img>` element.

### Assessment
This is **NOT a visual bug** — it is a DOM hit-testing artifact. The `.card-v2-frame` div is the outermost element and covers the entire card including the art area. Art images are `pointer-events: none` (correct). The frame div catching the point test is expected behavior.

**The art images are visually visible** — they are loaded (naturalWidth > 0), have `opacity: 1`, `visibility: visible`, `display: block`, and are positioned within the frame. The transparency fix is working correctly.

The "occluded by card-v2-frame" report is a false positive from the occlusion test methodology — `elementFromPoint` returns the topmost interactive element, which is the frame div (the card button itself is what's interactive). The art is painted behind the transparent window in the base frame layer, which is the intended design.

**No fix needed for Issue 4.**

---

## Issue 5 (MEDIUM): Effect Text Overflow on Long Descriptions

### What was observed
The **Adapt** card: "Smart: Block vs ATK, Cleanse vs debuff, else Attack"
- Container height: 66px
- Scroll height: 78px
- Overflow: 12px (approximately 1 line cut off)

All other cards fit within the 66px container.

### Root cause
The effect text guide (`guideStyle(134, 667, 640, 376)`) maps to 66px height at current card size. At 13.8px font size with 1.3 line-height, each line is ~17.9px. The Adapt text wraps to 4 lines (4 × 17.9 = 71.6px) but only 3.5 lines fit (3 × 17.9 = 53.7px).

### Fix options
- Reduce effect text font size when text is long (dynamic font scaling)
- Edit the Adapt card's effect text to be shorter ("Smart: context-aware action")
- Increase the effect text zone height slightly: `guideStyle(134, 650, 640, 410)` → 72.6px height

---

## Issues 6–8 (LOW): Mechanic Name Overflow on Longer Names

### What was observed
| Card name | Container W | Scroll W | Overflow |
|-----------|-------------|----------|----------|
| Double Strike | 76px | 95px | +19px |
| Empower | 76px | 78px | +2px |
| Overclock | 76px | 79px | +3px |

"Double Strike" overflows significantly. Since the container has `overflow: hidden; text-overflow: ellipsis`, it clips to "Double Str..." or similar.

### Root cause
Container width is 76px (guide: 478px → 76px at 141px card). Font is 15.9px Cinzel serif. "Double Strike" in Cinzel at 15.9px is ~95px wide.

### Fix options
- Reduce mechanic name font size: `calc(var(--card-w) * 0.085)` (was 0.11) → 12px, fits most names
- Allow text to wrap (remove `white-space: nowrap`, allow 2-line names)
- Accept truncation as-is for long names (card identity is visual anyway)

---

## Art Positioning Assessment

### Frame layer stacking order (bottom → top)
1. `card-border-{type}.webp` — full-card colored border (position: absolute, inset: 0)
2. `frame-card-art` (the PNG art image) — positioned at 14% left, 12% top, 72% wide, 48% tall
3. `card-frame-base.webp` — the transparent-windowed frame that masks art edges
4. `card-banner-chain{n}.webp` — chain color banner overlay

### Art window analysis
The CSS art position (`left:14%, top:12%, width:72%, height:48%`) on a 141×202px card:
- Art left: 19.7px, top: 24.2px, width: 101px, height: 97px

The GUIDE_STYLES `artWindow` guide (`x:194, y:186, w:498, h:412`):
- Maps to: left=31px, top=33px, width=79px, height=73px

**The CSS `frame-card-art` placement (101×97px) does NOT match the artWindow guide (79×73px).** The art is about 22px wider and 24px taller than the transparent window defined in the PSD. This means art is bleeding OUTSIDE the pentagon window and being hidden by the `card-frame-base.webp` overlay — which is the correct behavior (the base frame masks out the edges). The art IS visible through the transparent pentagon window.

This appears intentional — the art over-fills the pentagon and the frame naturally crops it.

---

## Card Type Label Position vs. Visual Frame

The card type label in the PSD is at y=615/1142 = **53.9% down the card**. On a 202px card, this is at y=109px from top of the frame (absolute y≈848 in viewport).

The card art zone ends at roughly y=121px (top 24px + height 97px). The card type label at y=109px actually **overlaps the art area** by about 12px. This may be intentional (the type label sits on the lower portion of the art window / banner area), but it means the type label text overlaps with the bottom of the art image.

---

## Measurements Reference Table

All measurements at 141×202px card (viewport 1280×720, combat-basic scenario):

| Element | CSS class | Position (in card) | Size | Font size | Status |
|---------|-----------|-------------------|------|-----------|--------|
| AP cost gem | `.v2-ap-cost` | top:5.6px, left:2.9px | 26×21px | 26.1px | OK |
| Mechanic name | `.v2-mechanic-name` | top:25.6px, left:32.6px | 76×9px | 15.9px | BROKEN (font > container) |
| Card art | `.frame-card-art` | top:24.2px, left:19.7px | 101×97px | — | OK visually |
| Card type | `.v2-card-type` | top:108.7px, left:56px | 29×10px | 12.3px | BROKEN (too narrow) |
| Effect text | `.v2-effect-text` | top:117.9px, left:21.3px | 102×66px | 13.8px | OK (1 card overflows) |

---

## Recommended Fix Priority

### Fix 1 (CRITICAL — do first): Widen `.v2-card-type` guide zone

In `/src/ui/utils/cardFrameV2.ts`:
```ts
// BEFORE:
cardType: guideStyle(352, 615, 182, 54),

// AFTER — centered, ~2.2× wider, fits all type strings including UTILITY:
cardType: guideStyle(243, 608, 400, 70),
```

At 141px card: width = (400/886)×141 = **63.7px** — fits "UTILITY" at 12px font + emoji.
Height = (70/1142)×202 = **12.4px** — fits the 12.3px font.

### Fix 2 (HIGH — do second): Fix `.v2-mechanic-name` guide zone height

```ts
// BEFORE:
mechanicName: guideStyle(205, 145, 478, 50),

// AFTER — same width, more height, same center:
mechanicName: guideStyle(205, 120, 478, 110),
```

At 141px card: height = (110/1142)×202 = **19.5px** — fits 15.9px font with ~2px padding each side.

### Fix 3 (LOW — optional): Reduce mechanic name font size for long names

```css
.v2-mechanic-name {
  font-size: calc(var(--card-w) * 0.09); /* was 0.11 — saves ~3px on 141px card */
}
```

This gives 12.7px font size, fitting ~85px of text in the 76px container — enough for "Double Strike" to be readable without truncation.

### Fix 4 (LOW — optional): Shorten Adapt card description

"Smart: Block vs ATK, Cleanse vs debuff, else Attack" → "Smart: counters enemy action or attacks"

---

## What is Working Correctly

- Card art images all loaded successfully (naturalWidth > 0, opacity 1, visibility visible)
- The pentagon transparency fix is working — art IS showing through the frame window
- AP cost gem: correctly positioned and sized (26px in a 26×21px container)
- Effect text: fits correctly for 4 out of 5 cards tested
- Frame layers (border, base, banner) all load correctly and are pixel-perfect full-card overlays
- All 3 hands tested (Strike/Block, Buff/Debuff, Utility/Wild) confirmed consistent behavior
- No JavaScript console errors related to card rendering
- Card art sources are correct per card type (strike.png, block.png, scout.png, mirror.png, etc.)
