# AR-104: Universal Card Frame Redesign

## Status: PENDING — Requires user review before implementation

## Overview

**Goal:** Design and generate a single, universal card frame via NanoBanana that replaces all 6 current per-type frames. The frame must clearly communicate all card information at a glance (like Slay the Spire) without being visually busy, while maintaining our RPG dungeon-study aesthetic.

**Why:** The current system has 6 different frame borders (attack/shield/buff/debuff/utility/wild) each generated independently, resulting in inconsistent border widths, decorative motifs, and gem styles. The chain indicator is a crude 6px CSS border-top colored bar. Important information (AP cost, chain type, card type, tier) is scattered across CSS badges that feel bolted-on rather than integrated into the frame design.

**Dependencies:** NanoBanana access, ComfyUI + SDXL pixel art LoRA
**Complexity:** Medium (design-heavy, code changes are straightforward frame swap)

---

## Part 1: Current State Assessment

### What the current card frame communicates:
| Information | Current Method | Problem |
|---|---|---|
| **Card type** (attack/shield/etc.) | Entirely different frame border art per type | 6 separate frames = style inconsistency, huge asset burden |
| **Chain type** (0-5) | 6px CSS `border-top` colored bar + tiny chain icon badge (12px, bottom-left) + animated ember particles | Bar is crude, icon is nearly invisible at card size |
| **AP cost** | CSS-styled gem overlay (top-left) OR circle badge (top-right) depending on whether frame art exists | Two different systems, neither integrated into frame design |
| **Tier** (1/2a/2b/3) | CSS text badge (top-right): "2a", "2b", or "★" + drop-shadow glow per tier | Functional but not beautiful; CSS text over art looks cheap |
| **Domain** | Thin colored stripe (CSS) + small domain icon | Stripe is subtle; domain icon placement varies |
| **Mechanic name** | Baked into the card frame art as a title banner | Can't change without regenerating entire frame |
| **Card state** (playable/echo/trial/upgraded) | CSS borders, opacity changes, dashed borders | Works but feels like debug styling, not designed |

### Visual problems identified:
1. **Buff and Debuff frames look nearly identical** — both use golden/amber borders with amber gems
2. **Frame border thickness varies** — attack frames have thick molten borders, shield frames have thin steel, utility has circuit-trace lines
3. **Gem style inconsistent** — attack has faceted red ruby, shield has rough blue crystal, buff/debuff have smooth amber ovals, utility has faceted purple amethyst, wild has opal
4. **The mechanic name is baked into the art** — "Strike", "Block", "Hex" etc. are painted into each frame, meaning we need 31+ separate frame images
5. **No clear visual hierarchy** — at card size, everything competes for attention
6. **Chain indicator (the most strategically important info) is the least visible element** — a 6px bar

### What Slay the Spire gets right:
- **One frame design** with color tinting for type (red=attack, blue=skill, gray=power, rainbow=curse)
- **Large, unmistakable cost circle** top-left
- **Card name banner** is part of the frame, not baked into art
- **Art window** is a clean rectangle — art fills it without competing with frame elements
- **Rarity** shown via simple frame color (gray/blue/gold) — not a badge
- **Everything reads instantly at thumbnail size**

---

## Part 2: The Perfect Card Frame Design

### Design Philosophy
One frame. Six tintable zones. Every indicator integrated into the frame's physical structure, not CSS overlaid on top. The frame itself tells the story.

### Frame Anatomy (top to bottom):

```
┌─────────────────────────────┐
│  [GEM]   ═══ BANNER ═══    │  ← Title banner (mechanic name rendered as text, NOT baked into art)
│                             │
│  ┌─────────────────────┐    │
│  │                     │    │  ← Art window (clean rectangle, ~60% of card height)
│  │    MECHANIC ART     │    │     This is where the NanoBanana art goes
│  │                     │    │
│  │                     │    │
│  └─────────────────────┘    │
│                             │
│  ┌─────────────────────┐    │
│  │   PARCHMENT TEXT    │    │  ← Description area (effect text, damage numbers)
│  │   AREA              │    │     ~30% of card height
│  └─────────────────────┘    │
│         [TYPE ICON]         │  ← Card type icon centered at bottom
└─────────────────────────────┘
```

### Indicator Integration Plan:

#### 1. Chain Gemstone (Top-Left)
- **Current:** 6px CSS border-top bar (nearly invisible)
- **New:** A **socket/setting carved into the frame's top-left corner** — an empty gemstone mount that is part of the frame art itself
- **How it works:** The frame art has a clearly defined gem socket (dark cavity with metallic prongs/setting). We programmatically render a colored gemstone SPRITE inside it, tinted to the chain color
- **Size:** ~18% of card width (same as current AP gem) — large enough to see at thumbnail
- **The 6 chain colors fill the gem:** Obsidian (#546E7A), Crimson (#EF5350), Azure (#42A5F5), Amber (#FFA726), Violet (#AB47BC), Jade (#26A69A)
- **Gem shape:** Hexagonal cut (6-sided, matching 6 chain types — thematic!)

#### 2. AP Cost (Top-Right)
- **Current:** CSS circle badge OR overlaid gem depending on frame
- **New:** A **circular coin/medallion socket** carved into the frame's top-right corner
- **The number is rendered as styled text inside**, with background color indicating cost tier:
  - 0 AP: Emerald green
  - 1 AP: Steel blue (default)
  - 2 AP: Amber gold
  - 3+ AP: Ruby red

#### 3. Card Type (Bottom-Center or Border Treatment)
- **Current:** Entire frame changes per type
- **New:** The frame border has **one consistent design** but includes a **tintable accent channel** — decorative trim lines or rune channels carved into the border that we programmatically tint:
  - Attack: Warm red/orange accent
  - Shield: Cool blue/steel accent
  - Buff: Golden/amber accent
  - Debuff: Purple/dark accent
  - Utility: Teal/cyan accent
  - Wild: Prismatic/rainbow animated accent
- Plus a small **card type icon** at bottom-center of the frame (sword/shield/star/etc.)

#### 4. Tier (Frame Material/Glow — No Badge)
- **Current:** Tiny CSS text badge
- **New:** Tier is communicated through the frame's material appearance:
  - **Tier 1:** Base frame (stone/iron — matte, no glow)
  - **Tier 2a:** Frame gains subtle silver sheen (CSS filter)
  - **Tier 2b:** Frame gains bright silver with faint glow
  - **Tier 3:** Frame turns gold with prominent glow — MASTERED text via CSS (already works)

#### 5. Domain (Art Window Border Accent)
- **Current:** Thin colored stripe + small icon
- **New:** The art window's inner border has a **1-2px colored accent line** matching the domain color, plus the domain icon rendered at a fixed position (bottom-left of art window)

#### 6. Mechanic Name (Title Banner)
- **Current:** Baked into frame art ("Strike", "Block", etc.)
- **New:** The frame has a **blank title banner/scroll/plate** at the top. The mechanic name is rendered as **styled text** (Cinzel font, fantasy style) over this blank banner. This means ONE frame image serves ALL 31+ mechanics.

### Frame Art Style Direction:
- **Material:** Aged stone with iron/bronze fittings — like a dungeon doorframe or ancient tablet
- **Decorative motifs:** Subtle runic/scholarly engravings along borders — quill nibs, scroll flourishes, compass roses, open books — tying to the knowledge/study theme
- **Corner ornaments:** Small rivets or rune stones at each corner
- **Overall feel:** Durable, ancient, scholarly-martial — a warrior-scholar's equipment
- **Parchment text area:** Weathered parchment/vellum texture, slightly inset from frame
- **Art window:** Clean rectangular cutout with subtle beveled edge

---

## Part 3: NanoBanana Generation Instructions

### Frame Generation Prompt

**What to generate:** A card frame border (NO interior art, NO text). The art window and parchment area should be **white/blank** — we composite art and text in-game.

**Prompt structure for NanoBanana:**

```
POSITIVE PROMPT:
pixel art card frame border, fantasy RPG trading card game,
aged stone frame with bronze metal fittings,
empty hexagonal gem socket top-left corner (dark cavity with metal prongs),
empty circular medallion socket top-right corner,
blank title scroll banner across top,
clean rectangular art window cutout (white center, approximately 60% of card height),
aged parchment text area bottom third (slightly inset),
subtle runic engravings along borders, scholarly dungeon aesthetic,
small decorative rivets at corners,
quill and scroll motifs in border detail,
tintable accent channel running along inner border edge,
card type icon space at bottom center,
warm torchlit stone texture, dungeon study hall feeling,
consistent 2px dark outline, clean edges,
512x729 pixels, clean solid white background where art window is,
professional card game quality, Slay the Spire inspired clarity,
16-bit pixel art style, clean readable at small sizes

NEGATIVE PROMPT:
text, letters, words, numbers, title, name,
interior art, character, scene, illustration in center,
modern, sci-fi, photorealistic, blurry,
too busy, cluttered, noisy, overcrowded details,
gradient background, transparent background, alpha channel,
3D render, smooth shading, anti-aliased
```

**Resolution:** 512 x 729px (maintains current 1.42:1 aspect ratio)
**Output format:** PNG with transparency (art window area transparent)

### Post-Generation Steps:
1. Receive frame PNG from NanoBanana
2. Verify gem socket, medallion socket, banner, art window, and parchment areas are clearly defined
3. Verify white background fill in the art window area (NOT transparent — transparent creates fake PNG artifacts with NanoBanana)
4. Test at actual card display size (mobile: ~85px wide, desktop landscape: ~120px wide)
5. Verify type accent channels are identifiable for tinting
6. Iterate with prompt adjustments if any zone isn't clear enough
7. Enemy/character sprites should have black border/outline on white background for clean separation

---

## Part 4: Implementation Sub-Steps

### 4.1 — Frame Asset Swap
- [ ] Replace 31 mechanic-specific frame WebPs with single universal frame PNG
- [ ] Update `cardFrameManifest.ts` to return universal frame for all mechanics
- [ ] Remove mechanic name from frame art; render via CSS/Svelte text overlay on banner

### 4.2 — Chain Gemstone System
- [ ] Create 6 gem sprite variants (one per chain color) OR one white gem + CSS `hue-rotate`/`filter`
- [ ] Position gem sprite in the frame's top-left socket
- [ ] Remove old `border-top: 6px solid` chain indicator
- [ ] Remove old `.chain-glow` radial gradient and `.chain-ember-container` particles
- [ ] Chain type should be immediately obvious at thumbnail size

### 4.3 — AP Cost Medallion
- [ ] Render AP number in the frame's top-right socket area
- [ ] Background color by cost tier (green/blue/amber/red)
- [ ] Remove old `.ap-badge` and `.ap-gem` dual systems; unify to one

### 4.4 — Type Accent Tinting
- [ ] Apply CSS filter or overlay to the frame's accent channels based on card type
- [ ] Render card type icon at bottom-center position
- [ ] Remove old per-type frame selection logic

### 4.5 — Tier Material Treatment
- [ ] Tier 1: no filter (base frame)
- [ ] Tier 2a: `filter: brightness(1.1)` + subtle silver CSS glow
- [ ] Tier 2b: `filter: brightness(1.2) saturate(1.1)` + brighter silver glow
- [ ] Tier 3: `filter: sepia(0.3) saturate(1.5) brightness(1.15)` + gold glow (existing gold treatment works)

### 4.6 — Title Banner Text
- [ ] Render mechanic name as styled Cinzel text over the banner area
- [ ] Position: absolute, centered horizontally in banner
- [ ] Font: 'Cinzel', serif, bold, with text-shadow for readability

### 4.7 — Testing & Polish
- [ ] Visual test at mobile card size (85px wide) — all indicators readable?
- [ ] Visual test at landscape card size (120px wide)
- [ ] Visual test in expanded/quiz view
- [ ] Test all 6 chain colors in gem
- [ ] Test all 6 card types with accent tinting
- [ ] Test all tier levels
- [ ] Test echo/trial/upgraded states still work
- [ ] Playwright screenshots across all states

---

## Part 5: Acceptance Criteria

1. **One frame image** serves all 31+ card mechanics (mechanic name is text, not baked art)
2. **Chain type** is communicated via a prominent gemstone (not a thin border) — visible at 85px card width
3. **AP cost** has a dedicated, integrated position in the frame — not a floating CSS badge
4. **Card type** is communicated via frame accent color + bottom icon — not by swapping entire frame
5. **Tier** is communicated via frame material treatment — not a tiny text badge
6. **The card reads clearly at thumbnail size** — a player can glance at their hand and instantly parse type, cost, and chain
7. **Art window is clean** — mechanic art fills it without competing with frame elements
8. **RPG dungeon-study aesthetic** maintained — stone, bronze, runes, parchment
9. All existing card states (echo, trial, upgraded, playable, dimmed) continue to work
10. Mobile performance: single frame image is lighter than loading 31 different frames

## Files Affected
- `src/ui/components/CardHand.svelte` — frame rendering, indicator positioning
- `src/ui/utils/cardFrameManifest.ts` — simplify to return universal frame
- `public/assets/cardframes/` — replace 31 WebPs with 1 universal PNG + gem sprites
- `src/data/chainTypes.ts` — gem color mapping (existing colors work)
- `docs/GAME_DESIGN.md` — update card visual system section
- `docs/ARCHITECTURE.md` — update asset pipeline section

## Verification Gate
- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] Playwright screenshot of 5-card hand — all indicators visible
- [ ] Playwright screenshot of expanded card view
- [ ] Visual comparison: before (current) vs. after (new frame)
- [ ] Mobile device test (Capacitor build) at actual phone resolution
