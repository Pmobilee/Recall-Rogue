# AR-107: New Card Frame System — PSD-Based Layered Rendering

## Status: IN PROGRESS

## Overview

**Goal:** Replace the current 31 per-mechanic card frame images with a single layered card frame system extracted from the designer's PSD template. The frame uses programmatic hue-shifting to indicate card type (border color) and chain type (banner color). The art window stays empty initially — mechanic art will be generated separately in AR-106.

**Source PSD:** `data/generated/camp-art/NEW_CARD.psd` (886×1142px)

**Why:** The current system has 31 separate WebP frame images (one per mechanic), each with the mechanic name baked in. They have inconsistent styles and are ~40-80KB each (~1.5MB total). The new system uses 3 small layer images + programmatic coloring = ~50KB total, perfectly consistent, and infinitely extensible.

---

## Part 1: Layer Architecture

The PSD has 4 visible render layers + 6 invisible/guide layers:

### Render Layers (exported as WebP)

| Layer | Name | What It Is | Size | Position (x,y) |
|---|---|---|---|---|
| **0** | Base Frame | The constant card structure — cream/beige inner frame, dark text box, pentagon art window border, clasp between art and text, open book AP icon (top-left). Never changes. | 886×1142 | (0,0) |
| **2** | Upgrade Icon | Green cross/plus icon — shown ONLY on upgraded cards (via rest site upgrade, not tier-up). Floats with a gentle hover animation. | 73×73 | (139,536) |
| **3** | Colored Border | The thick outer border — currently red. Hue-shifted per **card type**. Black outlines preserved. | 782×1096 | (52,32) |
| **4** | Banner | The silver ribbon banner at top — for mechanic name text. Hue-shifted per **chain type**. Black outlines preserved. | 886×302 | (0,7) |

### Guide Layers (not rendered — define text/content positions)

| Layer | Name | Purpose | Bounds (x,y,w,h) |
|---|---|---|---|
| **1** | Upgraded | Art window border detail (guide for upgraded state) | (118, 186, 650, 454) |
| **5** | Banner Attack Title | Where mechanic name text goes inside the banner | (205, 86, 478, 86) |
| **6** | Artwork Area Top center | Pentagon-shaped mask — where mechanic art is clipped | (194, 186, 498, 412) |
| **7** | Text Area for card info | Where card effect description text goes | (134, 667, 640, 376) |
| **8** | Card type area | Where card type label/icon goes (between art & text) | (352, 615, 182, 54) |
| **9** | AP Cost Area top left | Where AP cost number renders (on the open book icon) | (18, 7, 164, 130) |

### Render Order (back to front)
1. **Colored Border** (layer 3) — behind everything
2. **Base Frame** (layer 0) — on top, its transparent areas reveal the border beneath
3. **Banner** (layer 4) — on top of both, overlaps the top portion
4. **Upgrade Icon** (layer 2) — conditional, only on `isUpgraded` cards, with CSS float animation
4. **Mechanic Art** — composited behind the base frame, clipped to the pentagon window
5. **Text overlays** — AP cost, mechanic name, card type, effect description (all CSS/Svelte text)

---

## Part 2: Color Schemes

### Card Type → Border Color (Layer 1 hue-shift)

Source color is red. We pre-generate 6 border variants:

| Card Type | Target Color | Hex | Hue Shift from Red |
|---|---|---|---|
| **Attack** | Red | #EF4444 | 0° (as-is) |
| **Shield** | Blue | #3B82F6 | ~210° |
| **Buff** | Purple | #A855F7 | ~270° |
| **Debuff** | Green | #22C55E | ~120° |
| **Utility** | Teal/Cyan | #06B6D4 | ~175° |
| **Wild** | Gold/Amber | #F59E0B | ~40° |

### Chain Type → Banner Color (Layer 2 hue-shift)

Source color is silver/neutral gray. We pre-generate 6 banner variants:

| Chain | Name | Target Color | Hex |
|---|---|---|---|
| 0 | Obsidian | Gray (as-is) | #546E7A |
| 1 | Crimson | Red | #EF5350 |
| 2 | Azure | Blue | #42A5F5 |
| 3 | Amber | Orange | #FFA726 |
| 4 | Violet | Purple | #AB47BC |
| 5 | Jade | Teal | #26A69A |

### Hue-Shifting Rules
- **Black pixels (R,G,B all < 30) must stay black** — these are outlines
- **Near-black pixels (< 50) stay unchanged** — shadow detail
- **All other pixels** get hue-shifted to the target color while preserving their original lightness and saturation ratios
- Pre-generate all variants as WebP files at build/extract time — no runtime CSS filters needed

---

## Part 3: Implementation Sub-Steps

### 3.1 — Extract & Generate Layer Assets
- [x] Extract Layer 0 (base frame) as `card-frame-base.webp` (886×1142, transparency preserved)
- [x] Extract colored border as source, then generate 6 hue-shifted variants (attack/shield/buff/debuff/utility/wild)
- [x] Extract banner as source, then generate 6 hue-shifted variants (chain 0-5)
- [x] Save all to `public/assets/cardframes/v2/`
- [x] Also generate lowres (half-size: 443×571) variants for mobile performance
- [x] Store guide layer coordinates as constants in TypeScript file

### 3.2 — Build Python Extract Script
- [x] Created `scripts/extract-card-frame.py` — PSD extraction + black-preserving hue-shift + WebP export + manifest

### 3.2b — Upgrade Icon
- [x] Extract Upgrade Icon (green cross, 73×73) as `card-upgrade-icon.webp`
- [x] Render conditionally when `card.isUpgraded === true`
- [x] CSS animation: gentle vertical hover (translateY ±3px, 1.5s ease-in-out infinite)

### 3.3 — New Card Frame Component
- [x] Modified existing CardHand.svelte with layered V2 frame system
- [x] Render order: border → base frame → banner → upgrade icon (conditional) → text overlays
- [x] All 4 rendering contexts updated (landscape main, landscape animating, portrait main, portrait animating)

### 3.4 — Text Overlay Styling
- [x] **AP Cost**: Cinzel Bold, off-white (#f0e6d2) with black outline (-webkit-text-stroke + text-shadow). Red when cost > base, green when cost < base. Positioned in book icon area, shifted down ~10%.
- [x] **Mechanic Name**: Cinzel Bold, off-white with black outline, centered H+V in banner area.
- [x] **Card Type Label**: Fitted and centered in card type area, overflow hidden, small font.
- [x] **Effect Description**: System-ui sans-serif for readability. Numbers in white with black outline. Clean text, not pixel font.

### 3.5 — Pentagon Art Clip Path
- [ ] Art window ready for AR-106 card art (currently empty/transparent)

### 3.6 — Remove Old Card Frame System
- [x] Removed old `getCardFrameUrl` imports and `cardFrameUrls` map from CardHand.svelte
- [x] Removed `border-top: 6px solid` chain indicator from all card inline styles
- [x] Removed `.chain-glow`, `.chain-ember-container` CSS and elements
- [x] Removed `.ap-gem` and `.ap-badge` dual AP display CSS
- [x] Removed `.card-parchment-text`, `.card-front-bg`, `.card-domain-stripe`, `.card-front-name`, `.card-effect-value` old CSS
- [x] Removed per-card-type frame selection logic
- [x] Removed `getChainGlowColor` import
- [ ] Old 31 mechanic WebPs NOT YET DELETED from `public/assets/cardframes/` (cleanup step pending)

### 3.7 — Preserve Existing States
- [x] `.card-playable` — darker green glow via drop-shadow (follows pixel outline)
- [x] `.echo-card` — dashed border + reduced opacity (preserved)
- [x] `.trial-card` — yellow glow (preserved)
- [x] `.card-upgraded` — blue glow (preserved)
- [x] `.tier-2a`, `.tier-2b`, `.tier-3` — silver/gold effects (preserved)
- [x] `.insufficient-ap` — grayscale + reduced opacity (preserved)
- [x] `.card-dimmed` — low opacity (preserved)
- [x] Drag states (preserved)

### 3.8 — Landscape Mode
- [x] All 4 card rendering contexts (landscape + portrait) use V2 frame
- [x] Frame layers use `object-fit: contain` + `inset: 0` for automatic scaling

### 3.9 — CardExpanded.svelte
- [x] Updated with V2 frame decorative overlay (banner + border accent at low opacity)

---

## Part 4: File Changes

### New Files
- `scripts/extract-card-frame.py` — PSD extraction + hue-shift pipeline
- `public/assets/cardframes/v2/card-frame-base.webp` — base frame
- `public/assets/cardframes/v2/card-border-{type}.webp` × 6 — border variants
- `public/assets/cardframes/v2/card-banner-chain{0-5}.webp` × 6 — banner variants
- `public/assets/cardframes/v2/lowres/` — half-size variants of all above
- `public/assets/cardframes/v2/manifest.json` — coordinates + filenames
- `src/ui/utils/cardFrameV2.ts` — new frame constants, position data, asset URLs

### Modified Files
- `src/ui/components/CardHand.svelte` — replace frame rendering with layered system
- `src/ui/components/CardExpanded.svelte` — same for expanded/quiz view
- `src/ui/utils/cardFrameManifest.ts` — simplify or replace
- `src/data/card-types.ts` — add card type → border color mapping if not already
- `docs/GAME_DESIGN.md` — update card visual system section
- `docs/ARCHITECTURE.md` — update asset pipeline section

### Deleted Files
- `public/assets/cardframes/strike.webp` (and all 30 other mechanic WebPs)
- `public/assets/cardframes/lowres/*.webp` (all lowres variants)

---

## Part 5: Acceptance Criteria

1. Cards render with the new layered frame system — base frame + colored border + colored banner
2. Border color changes based on card type (6 types, 6 colors)
3. Banner color changes based on chain type (6 chains, 6 colors)
4. Black outlines remain black after all hue-shifting
5. AP cost number renders on the open book icon area (top-left)
6. Mechanic name renders as text on the banner
7. Card type label renders between art window and text area
8. Effect description text renders in the dark text box area
9. Pentagon art window area is empty/transparent (ready for AR-106 art)
10. All existing card states still work (playable, echo, trial, upgraded, tier glows, drag states)
11. Works in both portrait and landscape modes
12. Mobile performance: fewer/smaller assets than before
13. `npm run typecheck` passes
14. `npm run build` passes
15. Playwright screenshot verification in combat

## Verification Gate
- [x] Typecheck clean
- [x] Build clean
- [ ] Vitest passes
- [x] DOM verification: 5-card hand with mixed types and chains — confirmed border + banner + text overlays rendering
- [ ] Playwright screenshot: expanded card view
- [ ] Visual polish pass with user (text sizing, positioning, readability)
- [ ] Delete old 31 mechanic WebPs from `public/assets/cardframes/`
- [ ] Playwright screenshot: landscape mode
- [ ] Visual comparison: old frames vs new system
