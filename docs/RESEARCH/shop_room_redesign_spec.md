# Shop Room Redesign Spec

**Screen name:** Shop Room (in-universe name candidate: "The Merchant's Trove" or "The Dust Merchant")
**Last updated:** 2026-03-30
**Status:** Design spec — not yet implemented

---

## Dynamic Scaling — Global Rule

**Zero hardcoded px values for layout, sizing, spacing, or fonts.** Every `px` value in this spec maps to one of two CSS patterns:

- **Layout values** (padding, margin, gap, width, height, border-width): `calc(Xpx * var(--layout-scale, 1))`
- **Font sizes**: `calc(Xpx * var(--text-scale, 1))`

Values already using `%`, `vw`, `vh`, `rem`, or `clamp()` are fine as-is. Exceptions: `0` values, `1px` borders, `border-radius: 50%`, `opacity`, `z-index`, `flex`.

This rule applies to every CSS value in every section below. Sub-agents implementing any part of this spec must enforce it without exception.

---

## 1. Layout: Section Headers and Visual Hierarchy

### Current problem

The current shop has four product categories distinguished only by border color (white, teal, olive, gold). No section headers, no labels, no legend. New players must reverse-engineer the system purely from visual cues.

### New section order (top to bottom)

1. **Sticky gold HUD** — fixed to top of viewport, always visible while scrolling
2. **Relics** — passive items, 3 per shop visit (rarely 4 with Merchants Favor relic)
3. **Learning Cards** — purchasable combat/knowledge cards, 3 per shop visit
4. **Services** — card removal (50g base) and card transformation (35g base), grouped as a pair
5. **Your Deck (Sell)** — 3 cards from the player's current deck, each sellable for gold
6. **Exit** — back arrow in the sticky HUD, not a full-width bottom button

### Section header spec

Each section gets a visible header label:

- Font: `calc(11px * var(--text-scale, 1))`, letter-spacing `calc(2px * var(--layout-scale, 1))`, uppercase, muted text color (`#64748b`)
- Position: left-aligned above the card row, `calc(8px * var(--layout-scale, 1))` margin below the label, `calc(20px * var(--layout-scale, 1))` margin above
- Labels: `RELICS`, `LEARNING CARDS`, `SERVICES`, `YOUR DECK`
- A `1px solid rgba(100, 116, 139, 0.2)` decorative line runs from the end of the label text to the right edge of the container

The section headers carry the primary categorization burden. Border colors on items serve as secondary reinforcement only.

### Remove the full-width "Leave Shop" button

Replace with a back arrow (←) or X icon in the top-left of the sticky HUD bar. This recovers significant vertical real estate. If the player has gold remaining and at least one item is affordable, show a lightweight confirmation: "Leave without buying?" Otherwise exit silently.

---

## 2. Sticky Gold HUD Bar

### Current problem

The gold counter ("Gold: 20") sits in the top-left corner. Prices sit on the right edge of each item. The player's eye must scan 800+ pixels for every purchase decision. When scrolling down to sell/services, the gold counter scrolls out of view entirely.

### New behavior

A fixed bar at the top of the viewport that stays visible while scrolling.

```
[← Back]   [🪙] 20g   |   Shop · Floor 3   |   Deck: 12 cards
           ──────────────────────────────────────────────────
           Context subtitle: updates based on current interaction
```

### HUD spec

- Height: `calc(44px * var(--layout-scale, 1))` main bar + `calc(28px * var(--layout-scale, 1))` context subtitle (collapses to 0 when idle)
- Background: app primary background (`#0f172a`), `1px solid rgba(148, 163, 184, 0.15)` bottom border
- Position: `position: sticky; top: 0; z-index: 10`
- **Left:** back arrow icon (`calc(24px * var(--layout-scale, 1))` tap target), navigates out of shop with optional confirmation
- **Center-left:** gold coin icon (`calc(16px * var(--layout-scale, 1))`) + gold amount in amber (`#f59e0b`), font `calc(14px * var(--text-scale, 1))` weight 500
- **Center:** "Shop · Floor 3" in `calc(11px * var(--text-scale, 1))` muted text
- **Right:** "Deck: 12 cards" in `calc(11px * var(--text-scale, 1))` muted text, updates after every transaction

### Context subtitle (conditional)

The subtitle bar appears when the player interacts with any priced item:

| State | Context line text | Text color |
|-------|------------------|------------|
| Hovering unaffordable item | "20g available · Steel Skin costs 100g · need 80g more" | Red gap amount |
| Hovering affordable item | "80g available · Strike costs 50g · you can afford this" | Muted/green |
| Just purchased | "Purchased Steel Skin · 30g remaining" | Green, fades after 2 seconds |
| Just sold | "Sold Strike · 31g now available" | Amber, fades after 2 seconds |
| Just used a service | "Card removed · deck is now 11 cards" | Muted, fades after 2 seconds |
| Idle / no interaction | Subtitle collapses (0px height, 200ms transition) | — |

### Gold animation on change

When gold changes:
- Number counts up or down to the new value over 400ms
- Flashes `#22c55e` (green) briefly on increase, `#ef4444` (red) on decrease
- Small coin particles: 3–5 particles fly from the item position to the HUD gold counter on purchase, or fly outward from the counter on sell-gold-gain

---

## 3. Affordability States: Dim Unaffordable Items

### Current problem

The player has 20 gold. Every item costs 50g or more. All items look equally purchasable — same opacity, same border weight. The player wastes time reading items they cannot buy.

### New behavior

Every priced item has exactly one of three visual states:

| State | Condition | Opacity | Price color | Border | Interaction |
|-------|-----------|---------|-------------|--------|-------------|
| Affordable | Player gold ≥ item price | 100% | Amber/default | Full color (category border) | Tap to initiate buy |
| Unaffordable | Player gold < item price | 40% | Red (`#ef4444`) | Desaturated, 50% opacity | Tap triggers shake + "Need Xg more" tooltip |
| Purchased / sold out | Item already bought this visit | 0% (removed) | — | — | Not visible |

### Affordability recalculation

After every transaction (buy, sell, service use), recalculate affordability for all remaining items.

- Newly unaffordable items: smooth opacity dim from 100% → 40% over 300ms. This is the "consequences" moment — every purchase visibly closes other doors.
- Newly affordable items (after selling): animate from 40% → 100% over 300ms, border briefly pulses its category color once.

### Unaffordable tap feedback

When a player taps an unaffordable item:
- Item shakes horizontally 3 times: `translateX -4px → 4px → -4px → 0`, 150ms total CSS keyframe
- Price text flashes red
- Small tooltip appears below: "Need 27 more gold" — auto-dismisses after 2 seconds, no modal
- Item is still inspectable via long-press (see section 8)

---

## 4. Relics Row

### Real data

- **Count:** 3 per shop visit (`SHOP_RELIC_COUNT = 3`), rarely 4 with the Merchants Favor relic
- **Prices:** common=100g, uncommon=160g, rare=250g, legendary=400g (`SHOP_RELIC_PRICE`)
- **Floor discount:** 3% per floor, max 40% (`SHOP_FLOOR_DISCOUNT_PER_FLOOR = 0.03`, `SHOP_MAX_DISCOUNT = 0.40`)
- **Rarity color system:** common=`#b0bec5`, uncommon=`#2ecc71`, rare=`#3498db`, legendary=`#f1c40f`

### Relic default display (collapsed)

The default relic view in the shop row is compact: icon + name + price. Full description is hidden until hover/tap.

```
┌─────────────────────────────────────────┐
│  🛡️  Steel Skin          [common] 100g  │
└─────────────────────────────────────────┘
```

- Container padding: `calc(12px * var(--layout-scale, 1))`
- Icon: `calc(32px * var(--layout-scale, 1))`, left-aligned
- Name: `calc(14px * var(--text-scale, 1))` weight 500, white
- Rarity label: `calc(10px * var(--text-scale, 1))` pill badge, colored by rarity
- Price: `calc(14px * var(--text-scale, 1))`, right-aligned, amber if affordable, red if not

### Relic tooltip on hover/tap — vanishing tooltip spec

Relics do NOT show their full description inline. Instead, on hover (desktop) or tap (mobile), a vanishing tooltip appears:

**Tooltip visual spec:**
```
┌────────────────────────────────────────────┐
│  🛡️  Steel Skin                            │
│  ─────────────────────────────────────────  │
│  Take 3 less damage from all sources       │
│  (minimum 1).                              │
│                                            │
│  ● -3 damage from all sources              │
│  Trigger: Permanent                        │
│                                            │
│  "The skin of a soldier who              │
│   never learned to flinch."               │  ← italic flavor text
└────────────────────────────────────────────┘
           auto-dismisses in 3 seconds
```

- `role="tooltip"`
- `max-width: calc(220px * var(--layout-scale, 1))`
- `background: rgba(15, 23, 42, 0.95)`
- `border: 1px solid rgba(148, 163, 184, 0.4)`
- `border-radius: calc(8px * var(--layout-scale, 1))`
- `padding: calc(8px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1))`
- `box-shadow: 0 calc(4px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1)) rgba(0,0,0,0.5)`
- `z-index: 200` (tooltip on top), transparent backdrop dismiss button at `z-index: 199`
- Relic name: `calc(13px * var(--text-scale, 1))`, colored by rarity, `font-weight: 800`
- Description: `calc(11px * var(--text-scale, 1))`, `#e2e8f0`
- Each effect listed: bullet point, `calc(11px * var(--text-scale, 1))`, `#94a3b8`
- Trigger type: `calc(10px * var(--text-scale, 1))`, muted (`#64748b`), e.g. "Trigger: Permanent", "Trigger: On correct answer"
- Flavor text: italic, `calc(10px * var(--text-scale, 1))`, `#64748b`
- Auto-dismisses after 3 seconds if no further interaction, or immediately on tap-away (backdrop dismiss)

**Tooltip positioning:** Appears above the relic card if near the bottom of screen, below if near the top. Uses `clamp()` to stay within viewport horizontally.

### Relic display: real examples

| Relic | Rarity | Price (Floor 1) | Tooltip trigger | Tooltip effects |
|-------|--------|-----------------|-----------------|-----------------|
| Steel Skin | common | 100g | Permanent | -3 damage from all sources (min 1) |
| Hollow Armor | uncommon | 160g | On turn start | Gain shield at the start of each turn |
| Scholar's Gambit | rare | 250g | On correct answer | Bonus effect on correct quiz answer; also +1 relic slot (max relics becomes 6) |
| Barbed Edge | uncommon | 160g | On attack | Deal bonus damage when attacking |
| Inscription of Fury | rare | 250g | On attack | Attack damage scales with buff stacks |

### Scrollability signal

Remove pagination dots. Instead show the 4th relic (if present via Merchants Favor) at 30% width on the right edge of the row — this universally signals "swipe for more." On first-ever shop visit, show a one-time animated swipe hint arrow that fades after 2 seconds.

### Max relic slots

The player can hold up to 5 relics by default. Scholar's Gambit extends this to 6. The HUD or a tooltip on the relic row should reflect current relic count (e.g., "3/5 relics").

---

## 5. Learning Cards Row

### Real data

- **Count:** 6 cards per shop visit (`SHOP_CARD_COUNT = 6`)
- **Prices (before floor discount):**
  - Tier 1 (common): 50g
  - Tier 2a / Tier 2b (uncommon): 80g
  - Tier 3 (rare): 140g
- **Floor discount:** 3% per floor, max 40% (same formula as relics)
- **Haggle mechanic:** 30% discount on correct answer, 30% penalty on wrong answer (`SHOP_HAGGLE_DISCOUNT = 0.30`)

### V2 Card Frame Rendering — Mandatory

Cards in the shop render with the full V2 layered card frame system — exactly as they appear in combat. They are NOT generic text boxes. The same `CardCombatOverlay.svelte` rendering pipeline applies.

**4-layer frame (bottom → top):**

1. **Border layer** — colored by `cardType`:
   - `attack` → red (`#c0392b` family)
   - `shield` → blue (`#2980b9` family)
   - `buff` → green (`#27ae60` family)
   - `debuff` → purple (`#8e44ad` family)
   - `utility` → teal (`#16a085` family)
   - `wild` → gold (`#f39c12` family)

2. **Card art** — pentagon art window showing the mechanic's pixel art sprite (sword for strike, shield for block, etc.)

3. **Base frame** — constant transparent-windowed frame overlay

4. **Banner layer** — colored by `chainType` (0–5, each a distinct color), displays the mechanic name (e.g., "Strike", "Block", "Empower", "Scout")

5. **Upgrade icon** — green cross visible only when `masteryLevel > 0`; hue-shifts per mastery level:
   - L1 → green, L2 → blue, L3 → purple, L4 → orange, L5 → gold with glow

**Text overlays on the V2 card frame:**

| Position | Content |
|----------|---------|
| Top-left badge | AP cost (1–3 AP) |
| Banner area | Mechanic name (e.g., "Strike", "Empower", "Block") |
| Below art window | Card type label (e.g., "Attack", "Shield", "Utility") |
| Parchment area | Ultra-short description, 2–3 words (e.g., "Sharp blow", "Brace up", "Buff forward") |
| Bottom | Computed effect value (e.g., "10 dmg", "8 shield", "50% empower") |

**Price tag:** Overlaid on the card's bottom-right corner as a floating tag, or as a separate price badge directly below the card. The price tag is NOT part of the V2 frame layers — it is a Svelte overlay positioned absolutely relative to the card container.

### Computed effect values — NOT "Power X"

Cards display their actual computed mechanic values. "Power X" does not appear anywhere on the card or in the shop UI.

**Damage formula (historical — superseded 2026-04-03):**
```
// DEPRECATED: effectMultiplier is always 1.0 for active tiers (no-op). getMasteryBaseBonus/perLevelDelta
// replaced by MASTERY_STAT_TABLES. Current formula uses getMasteryStats(mechanicId, masteryLevel).qpValue.
computedValue = Math.round(baseEffectValue * effectMultiplier) + getMasteryBaseBonus(mechanicId, masteryLevel)

Where: getMasteryBaseBonus = perLevelDelta * masteryLevel
```

**Real examples (Tier 1 cards, masteryLevel = 0):**

| Mechanic | Base effect | Tier mult | Computed | Shown as |
|----------|------------|-----------|----------|----------|
| Strike | 4 | 1.0× | 4 | "4 dmg" |
| Block | 3 | 1.0× | 3 | "3 shield" |
| Heavy Strike | 4 | 1.0× | 4 | "4 dmg" |
| Bash | 4 | 1.0× | 4 | "4 dmg" |
| Scout | — | — | — | "Draw 1" |
| Heal | — | — | — | "Heal 15%" |
| Empower | — | — | 50% | "Empower 50%" |

**Tier 2a examples (multiplier 1.3×):**

| Mechanic | Computed (T2a) | Shown as |
|----------|---------------|----------|
| Strike | `Math.round(4 * 1.3)` = 5 | "5 dmg" |
| Block | `Math.round(3 * 1.3)` = 4 | "4 shield" |

### Sale mechanic — one card is 50% off

One random card per shop visit gets a 50% discount. This is determined at shop generation time and persists for the entire visit.

**Visual spec:**
- A diagonal "SALE" ribbon/badge in the top-right corner of the card, red background (`#dc2626`) with white text, `calc(10px * var(--text-scale, 1))` bold uppercase
- Price display: original price shown with CSS `text-decoration: line-through` in muted text, sale price in green (`#22c55e`) or gold next to it
  - Example: ~~80g~~ → **40g**
- The sale is applied on top of the floor discount (floor discount first, then 50% sale)
- The haggle system still applies on sale cards: 30% discount stacks (50% off → then 30% haggle = 65% total discount)
- Only one card per shop visit receives the sale; relics are never on sale

### Pre-upgraded cards (masteryLevel > 0)

Some shop cards may spawn with `masteryLevel > 0` (rare but possible). These show:
- The upgrade icon (green cross, hue-shifted by level) on the V2 frame
- The fully upgraded effect value already computed
- A small green "+X" indicator showing the mastery bonus contribution

**Example — Strike at mastery L2:**
- Base: 4 (attack base)
- Mastery bonus: `perLevelDelta (3) × masteryLevel (2)` = +6
- Computed value: 4 + 6 = **10 dmg**
- Display: "10 dmg" with blue upgrade icon, "+6" in `#22c55e` small text

**Example — Block at mastery L3:**
- Base: 3
- Mastery bonus: `perLevelDelta (2) × 3` = +6
- Computed value: 3 + 6 = **9 shield**
- Display: "9 shield" with purple upgrade icon, "+6" in green

### Synergy tags

Every learning card shows a synergy tag. This is an expansion of the existing Empower synergy system — it becomes universal.

| Condition | Tag display |
|-----------|------------|
| Card synergizes with 1+ cards in player's current deck | Green pill: "Synergy: [card name(s)]" |
| Card conflicts with player's strategy | Red pill: "Conflicts with: [card name]" |
| No synergies or conflicts detected | Grey pill: "No synergies" |

**Why every card:** Showing a synergy tag on only Empower suggests it's a one-off. Showing it on every card — even "No synergies" — tells the player the system always checked.

### Card display example

```
┌────────────────────────────────────────────────────────┐
│                                                        │
│  [V2 Frame: red border, sword art, "Strike" banner]    │
│                                                        │
│  AP: 1     Strike          SALE ← ribbon              │
│           [pixel art]                                  │
│  Attack · T2a                                          │
│  Sharp blow                                            │
│  5 dmg                    ~~80g~~ → 40g               │
│                                                        │
│  [Synergy: Reckless, Heavy Strike]                     │
└────────────────────────────────────────────────────────┘
```

---

## 6. Services Section: Card Removal and Card Transformation

Card removal and card transformation are the two most strategically impactful shop actions. They share a "SERVICES" section header and appear side by side on desktop, stacked on mobile.

### Escalating price model (per run, not per shop)

| Service | 1st use | 2nd use | 3rd use | 4th use | Formula |
|---------|---------|---------|---------|---------|---------|
| Card removal | 50g | 75g | 100g | 125g | `SHOP_REMOVAL_BASE_PRICE (50) + usesThisRun × SHOP_REMOVAL_PRICE_INCREMENT (25)` |
| Card transformation | 35g | 60g | 85g | 110g | `35 + usesThisRun × 25` |

The escalation is per-run, not per-shop-visit. Using removal in the Floor 2 shop means the Floor 5 shop shows removal at 75g.

### Price escalation display

When a service has been used at least once this run, show the price history:

```
CARD REMOVAL          75g
                      ↑ was 50g (+25g)   ← 11px tertiary text, amber/red arrow
```

### Services layout

```
┌─── SERVICES ─────────────────────────────────────────────────────────────┐
│                                                                          │
│  ┌──────────────────────────────┐  ┌──────────────────────────────────┐  │
│  │ 🔥  CARD REMOVAL        50g │  │ ✨  CARD TRANSFORMATION     35g  │  │
│  │                             │  │                                   │  │
│  │ Destroy a card from your    │  │ Destroy a card from your deck,    │  │
│  │ deck permanently. A leaner  │  │ replaced by one of 3 random       │  │
│  │ deck draws stronger hands.  │  │ options. A gamble.                │  │
│  │                             │  │                                   │  │
│  │ [Choose a card →]           │  │ [Choose a card →]                 │  │
│  └──────────────────────────────┘  └──────────────────────────────────┘  │
│                                                                          │
│  +25g per use this run                         +25g per use this run    │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Visual spec for service cards:**

- Side by side on desktop (50/50 split), stacked on mobile
- Container padding: `calc(14px * var(--layout-scale, 1))`
- Border: `1px solid [service color]`, background: service color at 5% opacity
- Icon: `calc(24px * var(--layout-scale, 1))`, service color
- Title: `calc(14px * var(--text-scale, 1))` weight 500
- Price: `calc(14px * var(--text-scale, 1))`, right-aligned, standard affordability rules
- Description: `calc(13px * var(--text-scale, 1))`, secondary text color, 2 lines max
- Action text: `calc(13px * var(--text-scale, 1))` tappable link, "Choose a card →"
- Escalation note: `calc(11px * var(--text-scale, 1))` tertiary text below each service card
- Haggle: both services support the haggle system (quiz a flashcard: correct = 30% off, wrong = 30% penalty)

**Service color assignments:**

| Service | Border color | Background tint | Icon |
|---------|-------------|-----------------|------|
| Card removal | Purple `#7F77DD` | Purple at 5% | Flame icon |
| Card transformation | Coral `#D85A30` | Coral at 5% | Alchemical transform icon (morph arrows) |

---

## 6a. Card Removal Interaction Flow

Card removal is the shop's most dramatic "ritual" interaction.

### Flow: When affordable

**Step 1 — Initiate (tap "Choose a card →")**
- Shop UI dims to 50% opacity behind a full-screen overlay
- Player's entire deck fans out face-up (arc on desktop, scrollable grid on mobile)
- Header text: "Select a card to destroy" — `calc(14px * var(--text-scale, 1))`, centered
- Subheader: "Cost: 50g" in `calc(13px * var(--text-scale, 1))` amber text
- "Cancel" button in top corner (back arrow)

**Step 2 — Select a card**
- Tapped card lifts (`translateY calc(-20px * var(--layout-scale, 1))`), scales to 110%
- All other cards dim to 30% opacity
- Selected card gets a red border glow (`box-shadow: 0 0 calc(12px * var(--layout-scale, 1)) #ef4444`)
- Confirmation prompt appears below selected card: "Destroy [Card Name] permanently? This cannot be undone."
- Two buttons: **"Destroy"** (red, `background: #dc2626`) and **"Cancel"** (ghost/outline)

**Step 3 — Confirm destruction**
- Card ignites from the bottom edge — a burning animation traveling upward over 800ms
- Card curls at edges as flame reaches them (CSS `clip-path` keyframe)
- Ember/particle effect: 6–10 particles float upward from card position
- Sound: crackling fire, 600ms
- Remaining deck cards slide back together, fan collapses
- Shop overlay lifts, returns to normal shop view
- Gold counter decrements with coin-fly animation
- Shopkeeper bark: "Lighter deck, sharper mind." (or variant)

**Step 4 — Post-removal state**
- Card removal price animates from 50g → 75g (number counts up, amber flash)
- Escalation note updates: "Used 1× this run · next use: 75g"
- If new price exceeds player gold: card removal service dims to 40%, price turns red
- Deck count in HUD bar updates: "Deck: 11 cards"
- Affordability recalc on all remaining shop items

### Flow: Cancel at any point

| Cancel point | What happens | Gold spent? |
|---|---|---|
| Before selecting from deck fan | Deck fan collapses, return to shop | No |
| After selecting, before confirming | Card returns to deck position, fan collapses | No |

### Edge cases

- **Deck has 1 card:** Removal is disabled. "You need at least 1 card to enter combat." Grayed out with tooltip.
- **Cursed cards:** Can be removed normally — destruction breaks the curse permanently.

---

## 6b. Card Transformation Interaction Flow

Transformation is the shop's highest-engagement feature: a gambling/draft moment where the player trades a known card for a chance at something better (or worse).

### Why 35g base (cheaper than removal)

Removal is pure deck thinning — guaranteed strategic value, no variance. Transformation is a gamble: you might improve, you might get three worse options. The lower price compensates for the risk. As the price escalates, the gamble becomes less attractive relative to removal — the correct economic tension.

### Flow

**Step 1 — Initiate (tap "Choose a card →")**
- Same overlay and deck-fan as removal
- Header: "Select a card to transform" — `calc(14px * var(--text-scale, 1))`, centered
- Subheader: "Cost: 35g · the card will be destroyed and replaced with one of 3 options" in `calc(13px * var(--text-scale, 1))` coral text
- "Cancel" button in top corner

**Step 2 — Select a card**
- Tapped card lifts and scales to 110%
- All other cards dim to 30% opacity
- Selected card gets coral/orange border glow (NOT red — this is transmutation, not destruction)
- Confirmation: "Transform [Card Name]? It will be destroyed and replaced with one of 3 random cards."
- Two buttons: **"Transform"** (coral `#D85A30`) and **"Cancel"** (ghost/outline)

**Step 3 — Transformation animation**
- Selected card lifts to center screen
- Card shimmers/vibrates: `translateX ±1px` at 30Hz for 400ms (increasing intensity)
- Card dissolves from edges inward: pixelation/particle effect over 600ms
- Coral particles swirl into a vortex at center screen for 400ms
- Sound: rising crystalline shimmer → granular dissolve → swirling wind

**Step 4 — Three replacement options appear**
- Vortex splits into three streams flying to left, center, right positions
- Three face-down V2 cards coalesce from the streams and solidify
- Cards flip face-up one at a time, 200ms stagger left-to-right
- All three cards render with full V2 frames, showing their computed effect values (NOT "Power X")
- Sound: card flip + ascending chime × 3

**Three-option quality distribution:**

| Slot | Quality tier | Visual indicator |
|------|-------------|-----------------|
| 1 random slot | High quality | Gold border glow + ★ badge in top-left corner |
| 1 random slot | Medium quality | Standard V2 frame, no special treatment |
| 1 random slot | Low quality | Slightly desaturated (filter: saturate 70%), no badge |

Slot positions are randomized — the high-quality card is not always in the same position.

**Quality tier factors:**
- Effect value relative to the destroyed card (higher = better tier)
- Synergy count with existing deck (more = higher tier)
- Card tier (T3 options rank higher)
- Anti-synergies penalize tier rating

**Three-option card spec (each uses full V2 frame):**

```
┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐
│ ★ HIGH QUALITY    │  │                   │  │                   │
│                   │  │                   │  │ (slightly muted)  │
│  [V2 frame:       │  │  [V2 frame:       │  │  [V2 frame:       │
│   Strike T2a,     │  │   Block T1,       │  │   Scout T1,       │
│   red border]     │  │   blue border]    │  │   teal border]    │
│                   │  │                   │  │                   │
│  AP: 1 Strike     │  │  AP: 1 Block      │  │  AP: 1 Scout      │
│  [sword art]      │  │  [shield art]     │  │  [eye art]        │
│  Sharp blow       │  │  Brace up         │  │  Scan ahead       │
│  5 dmg            │  │  4 shield         │  │  Draw 1           │
│                   │  │                   │  │                   │
│ [Synergy:         │  │ [No synergies]    │  │ [Conflicts:       │
│  Reckless]        │  │                   │  │  Hollow Armor]    │
│                   │  │                   │  │                   │
│ [Choose →]        │  │ [Choose →]        │  │ [Choose →]        │
└───────────────────┘  └───────────────────┘  └───────────────────┘

           "Choose one card to add to your deck"
     [Cancel — your card has already been destroyed]
```

**Browsing the three options:**
- Tapping a card scales it to 105% and highlights it
- Long-press opens the standard card inspection panel (section 8)
- All three show synergy tags against the current deck

**Step 5 — Confirm selection**
- Chosen card lifts and brightens (`filter: brightness(1.1)`)
- Other two cards fade to 30%, then dissolve into fading particles (400ms)
- Chosen card flips once (celebratory), then floats down into deck position
- "Added to deck ✓" confirmation text appears
- Sound: warm positive chime

**Step 6 — Post-transformation state**
- Overlay lifts, shop UI returns to full opacity
- Gold counter decrements with coin-fly animation
- Transform price animates to next tier (35g → 60g, amber flash)
- Escalation note: "Used 1× this run · next use: 60g"
- Deck count unchanged (1 card replaced 1 card)
- Affordability recalc on all remaining shop items
- Shopkeeper bark varies by quality chosen: high quality → "Fortune favors you — today." / low quality → "Hmm. At least it's... different."

### Cancel options at the three-option screen

At the three-option screen, the original card is already destroyed and gold is already spent. Canceling at this stage means the player loses both with no replacement.

**Warning text (prominent):**
> "Your card has already been destroyed. Canceling now means you lose the card and the gold but add nothing to your deck."
>
> **[Go back and choose]** (primary button) &nbsp;&nbsp; **[Cancel anyway]** (danger, small text)

| Cancel point | What happens | Gold spent? |
|---|---|---|
| Before selecting from deck fan | Return to shop | No |
| After selecting, before confirming transform | Card stays, fan collapses | No |
| At three-option screen ("Cancel anyway") | Original card destroyed, gold spent, no replacement added | Yes |

### Edge case

- **Deck has 1 card:** Transformation is disabled. "Need at least 2 cards in deck to transform." A one-card deck after transformation would leave the player in an unplayable state.

---

## 7. Sell Section ("Your Deck")

### Real data

Current sell prices from `calculateCardSellPrice()` in `encounterBridge.ts`:
- Tier 1 cards: **1g**
- Tier 2a / Tier 2b cards: **2g**
- Tier 3 cards: **3g**

Buy prices are 50g / 80g / 140g. Sell values are 1–3% of buy price. This is economically incoherent — selling is functionally worthless.

### Current problems

1. **1–3g per card is psychologically punishing.** Items cost 50–400g. Selling an entire 3-card display yields 2–6g — barely enough to matter. Players quickly learn selling is dead UI.
2. **Green sell button is a lie.** Green = good deal in every game UI convention. 1g for a card is not a good deal. The color is actively misleading.
3. **No sell confirmation.** Permanent card loss should always require a confirmation step.

### Recommended fix (Option A): Raise sell values to meaningful amounts

Sell price should be 15–25% of the card's buy price. This makes selling a genuine strategic lever: "Do I sacrifice this card to afford something better?"

| Card tier | Buy price | Recommended sell (20%) | Current sell |
|-----------|-----------|----------------------|--------------|
| Tier 1 (common) | 50g | **10g** | 1g |
| Tier 2a / 2b (uncommon) | 80g | **16g** | 2g |
| Tier 3 (rare) | 140g | **28g** | 3g |

**Alternative (Option B): Reframe as sacrifice for Grey Matter**
If raising gold values risks economy inflation, decouple selling from gold. "Sacrifice for 15 Grey Matter" or "Burn for 20 XP." Different currency, different mental model, no expectation of gold parity. Grey Matter is the meta-progression currency and adding a funneling path from selling creates a satisfying decision.

**Alternative (Option C): Move selling to a separate deck management screen**
Between floors, players access a "Deck Management" screen where cards can be sold/discarded. The shop becomes purely about acquiring. This removes the cognitive load of "should I sell here or later?"

### Sell button styling (regardless of chosen option)

- Change button color from green to **amber** (`#f59e0b`). Green = good deal. Amber = proceed with caution.
- Button text: "Sell · 10g" (not "Sell +1g" — the `+` framing implies a bonus, not a sacrifice)
- On tap: card lifts slightly, confirmation appears: "Sell [Card Name] for 10g?" with **Confirm** (amber) and **Cancel** (ghost)

### Sell section display

```
┌─── YOUR DECK ─────────────────────────────────────────────────────────────┐
│                                                                           │
│  [V2 card: Strike T1]     [V2 card: Block T1]     [V2 card: Scout T2a]   │
│  Sharp blow · 4 dmg       Brace up · 3 shld       Scan ahead · Draw 1    │
│  [Sell · 10g]             [Sell · 10g]             [Sell · 16g]           │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

Cards in the sell row are shown with their full V2 frames (same as shop cards). The sell button is a small amber action button below the card, outside the frame.

### Sell animation

When confirmed:
1. Card visually tears — a vertical crack animation down the center, 200ms. Sound: paper rip.
2. Card halves separate and fade out, dissolving into gold particles that float up to the gold counter.
3. Gold counter increments (`+10g` in green, counts up). Affordability recalc runs.
4. Shopkeeper bark (on low-value sell): "Barely worth the dust on my counter."

---

## 8. Card Display — Inline V2 Frames (No Inspection Panel)

Cards in the shop render with full V2 card frames — identical to how they appear in the player's hand during combat. All information is visible directly on the card: mechanic name on the banner, AP cost badge, card type label, ultra-short description in the parchment area, and computed effect value at the bottom. No long-press inspection panel is needed.

Relics use the vanishing tooltip on hover/tap (section 4) for their detail view. Cards are self-describing via their frame.

**Hover behavior (desktop only):** When hovering a shop card, a subtle tooltip may appear showing synergy info and the full mechanic description from `getDetailedCardDescription()`. This is supplementary — the card itself is already fully readable. On mobile, the card frame alone carries all information.

---

## 9. Shopkeeper Character

### Current state

The shop is titled "Shop Room" with a pixel art background of a merchant counter and shelves. No character, no voice, no personality. Compare to Slay the Spire's Merchant (welcoming, greedy, memorable) or Darkest Dungeon's Nomad Wagon (mysterious, unsettling).

### Add a shopkeeper

**Visual:** A small pixel art portrait (64×64px) in the top-right area of the shop background, or as a persistent element docked beside the sticky HUD. Matches the game's 2D pixel art style.

**Name candidates:** "The Keeper" / "The Dust Merchant" / "The Curator" — ties to the game's lore (Grey Matter and Dust as currencies of knowledge).

**Bark system:** Context-sensitive one-liners appear as a small speech bubble near the portrait. Auto-dismiss after 3 seconds. Never block interaction. Prepare 3–5 variants per trigger.

### Bark triggers and lines

| Trigger | Example lines (3–5 variants each) |
|---------|----------------------------------|
| Enter shop | "Step closer, wanderer. Knowledge has a price." / "Ah, a customer. Browse freely." / "The deeper you go, the better my stock." |
| Browse relic (hover/tap) | "That one? Pulled it from the rubble below." / "A fine choice for those who survive long enough to use it." |
| Browse learning card | "Sharp mind, sharp blade. Same thing down here." / "That card's been popular with the regulars." |
| Tap unaffordable item | "Your purse is light. Delve deeper and return." / "The dungeon always pays — if you're brave enough." |
| Purchase item | "A fine choice. May it serve you in the dark." / "Pleasure doing business." / "Use it well — no refunds." |
| Sell card (any value) | "Barely worth the dust on my counter." / "I'll take it. Don't expect a fortune." |
| Initiate card removal | "Lighter deck, sharper mind. Choose wisely." / "Destruction is a kind of creation, they say." |
| Confirm card removal | "Gone. As if it never was." / "The flames take what they will." |
| Cancel card removal | "Changed your mind? Wise, perhaps." |
| Initiate card transformation | "Feeling lucky, wanderer? Transformation is a gamble." / "The cards shift and change. Let's see what fate offers." |
| Transformation options revealed | "Three paths — only one is yours." / "Choose carefully. Not all change is improvement." |
| Confirm transformation (high quality) | "Fortune favors you — today." / "Fascinating. Even I couldn't have predicted that outcome." |
| Confirm transformation (low quality) | "Hmm. At least it's... different." / "Not every transformation is an improvement. But you knew that." |
| Cancel transformation (lose card and gold) | "A bold choice — to walk away with nothing. Or a foolish one." |
| Service price escalated | "My services grow dearer with each use, wanderer." / "Supply and demand — even down here." |
| Leave shop (gold remaining + items affordable) | "Leave empty-handed? The dark shows no mercy to the unprepared." |
| Leave shop (nothing affordable) | "Travel safe. I'll have fresh stock next time." |
| Leave shop (bought something) | "Good luck down there. You'll need it." |

---

## 10. Animation Spec

All animations respect a global "reduce animations" setting. When enabled, all transitions use simple cross-fades at 150ms. The animations below describe the full default experience.

### 10a. Shop entrance sequence

| Time | Element | Animation | Sound |
|------|---------|-----------|-------|
| 0–400ms | Background fades in, shopkeeper portrait slides in from right | Fade + `translateX 20px → 0` | Ambient shop atmosphere (subtle, loops) |
| 400–700ms | Sticky HUD bar slides down from top, gold number counts up from 0 to actual value | `translateY -44px → 0` + count | Soft coin clinks |
| 700–1100ms | Relic cards slide up, staggered 100ms apart, left to right | `translateY calc(20px * var(--layout-scale,1)) → 0`, ease-out-back (slight bounce) | Soft card-place thud × 3 |
| 1100–1200ms | "LEARNING CARDS" header fades in | Opacity 0 → 1 | — |
| 1200–1600ms | Learning card row slides up, same stagger | Same bounce | Same thuds |
| 1600–1800ms | Services section fades in side by side | Opacity 0 → 1, `scale(0.97) → 1` | — |
| 1800–2100ms | Sell row fades in | Opacity 0 → 1 | — |
| 2100ms | Shopkeeper bark fires | Speech bubble appears | — |

**Skip:** Tapping anywhere instantly completes all entrance animations. Total target duration: ~2 seconds.

### 10b. Purchase animation

| Time | Element | Animation | Sound |
|------|---------|-----------|-------|
| 0ms | Tap item | Card scales to 102%. Inline confirmation: "Buy for Xg?" | Soft tap |
| 0–400ms | Confirm | 3–5 coin particles fly along bezier curve from item to HUD gold counter | "Cha-ching" coin sound |
| 400–500ms | Card flash | White overlay at 30% opacity for 100ms | — |
| 500–900ms | Card flip | 180° Y-axis rotation. Back face: "Added to deck ✓" | Whoosh |
| 900–1300ms | Card exit | Card shrinks (`scale 1 → 0.5`) + slides down + fades. Neighbors slide inward to fill gap | — |
| 1300–1600ms | Affordability recalc | Newly unaffordable items dim 100% → 40%, prices turn red | — |
| 1600ms | Shopkeeper bark | "A fine choice. May it serve you in the dark." | — |

### 10c. Sell animation

| Time | Element | Animation | Sound |
|------|---------|-----------|-------|
| 0ms | Tap sell button | Card lifts slightly. "Sell [name] for Xg?" confirmation | — |
| 0–200ms | Confirm sell | Card tears — vertical crack animation down center | Paper rip |
| 200–600ms | Card dissolve | Card halves separate and fade. Gold particles float up to HUD counter | Soft shimmer |
| 600–800ms | Gold increment | Counter counts up, flashes `#22c55e` | Coin clink |
| 800ms | Shopkeeper bark | "Barely worth the dust on my counter." | — |
| 800–1100ms | Affordability recalc | Newly affordable items animate 40% → 100% opacity, borders pulse | — |

### 10d. Card removal animation (the ritual)

| Time | Element | Animation | Sound |
|------|---------|-----------|-------|
| 0–500ms | Tap "Choose a card" | Shop dims 50%. Deck fans out in arc/grid overlay. Header appears | Cards shuffling |
| — | Browse deck | Cards tilt slightly on hover. Long-press opens inspection | — |
| 0ms | Select card | Card lifts `translateY -20px`, scales 110%. Others dim 30%. Red glow | Low tone |
| — | Confirm prompt | "Destroy [name] permanently?" with red Destroy + ghost Cancel | — |
| 0–800ms | Confirm destroy | Card ignites from bottom. Flame travels upward. Edges curl. Embers float up | Crackling fire 600ms |
| 800–1000ms | Post-burn | Ash particles scatter. Remaining cards slide together | Soft whoosh |
| 1000–1200ms | Fan collapses | Cards animate back to deck shape, overlay lifts | — |
| 1200–1600ms | Return to shop | Shop returns to full opacity. Gold decrements. HUD deck count updates | Coin sound |
| 1600–2000ms | Price escalation | Removal price counts up from 50g → 75g, amber flash. If > gold, service dims 40% | — |
| 2000ms | Shopkeeper bark | "Lighter deck, sharper mind." | — |

### 10e. Card transformation animation (the transmutation)

**Act 1 — Selection (same deck-fan as removal):**

| Time | Element | Animation | Sound |
|------|---------|-----------|-------|
| 0–500ms | Tap "Choose a card" | Shop dims. Deck fans out. Header: "Select a card to transform" | Cards shuffling |
| — | Browse | Same hover behavior as removal | — |
| 0ms | Select | Card lifts, scales 110%. Others dim. Coral/orange glow (not red) | Warm tone |
| — | Confirm | "Transform [name]? Will be destroyed and replaced." Coral Transform + ghost Cancel | — |

**Act 2 — Transmutation:**

| Time | Element | Animation | Sound |
|------|---------|-----------|-------|
| 0–400ms | Shimmer | Card oscillates `translateX ±1px` at 30Hz, intensity increasing. Coral particles emit from edges | Rising shimmer |
| 400–1000ms | Dissolve | Card disintegrates edges-inward via pixelation/particle effect | Crystalline dissolve 600ms |
| 1000–1400ms | Vortex | Particles swirl into tight vortex at center screen, rotation accelerates | Swirling wind, increasing pitch |
| 1400–1600ms | Split | Vortex fractures into three streams flying to left, center, right | Sharp split crack |
| 1600–2000ms | Materialize | Three face-down V2 cards coalesce from streams at each position, solidify edges-inward | Three soft bell tones |

**Act 3 — The choice:**

| Time | Element | Animation | Sound |
|------|---------|-----------|-------|
| 2000–2200ms | First card flips | Left card: Y-axis 180° flip, face-up. Quality badge visible | Card flip + chime |
| 2200–2400ms | Second card flips | Center card | Card flip + chime |
| 2400–2600ms | Third card flips | Right card | Card flip + chime (highest pitch) |
| 2600ms+ | Browse | All three cards hoverable. Tap → 105% scale. Long-press → inspection. Header: "Choose one" | — |
| — | Select | Chosen card lifts + brightens (`brightness(1.1)`). Others fade 30% → dissolve particles | Positive chime |
| +400ms | Added | Chosen card flips once celebratory, floats to deck position. "Added to deck ✓" | Whoosh + ding |
| +800ms | Return | Overlay lifts. Gold decrements. Transform price → next tier. Recalc | Coin sound |

**Skip:** Tapping during Act 2 instantly skips to the three-card reveal. Act 3 browsing cannot be skipped — the player must choose or cancel.

**Total duration:** ~4 seconds (selection) + ~3 seconds (transmutation + Act 3 browsing minimum)

### 10f. Price escalation animation (shared)

| Time | Element | Animation |
|------|---------|-----------|
| 0–300ms | Old price fades | Current price fades to 50% opacity |
| 300–600ms | Number counts up | Increments from old → new value, 50ms per tick |
| 600–800ms | New price settles | Returns to 100% opacity. Brief amber flash |
| 800ms | Subtext | "Used X× this run" fades in below price |
| 800–1100ms | Affordability | If new price > gold: service card dims 100% → 40%, price turns red |

### 10g. Micro-interactions

| Interaction | Animation | Duration |
|---|---|---|
| Card hover/focus | `scale(1.01)`, border opacity increase, `translateY calc(-2px * var(--layout-scale,1))` | 150ms ease |
| Card press | `scale(0.98)` | 100ms |
| Unaffordable tap | `translateX -4px → 4px → -4px → 0`, price flashes red | 150ms |
| Synergy highlight | Cards in sell row that the browsed card synergizes with pulse green border once | 600ms |
| Relic row scroll peek | 4th relic at 30% width on row right edge | Static |
| First-time scroll hint | Animated right-pointing arrow, fades after 2 seconds | 2000ms, one-time only |
| Gold counter change | Counts to new value, flashes green (gain) or red (loss) | 400ms |
| Sale ribbon entrance | Ribbon scales in from 0 with slight bounce during shop entrance animation | 200ms ease-out-back |

---

## 11. Synergy System Expansion

### Current state

Only Empower shows a synergy tag ("Synergy: Reckless, Strike"). This is the best UX element on the screen — it answers "should I buy this?" But showing it on only one card makes it look like a one-off rather than a system.

### New behavior: synergy tags on everything

Every purchasable item — relics AND learning cards — shows a synergy tag:

| Condition | Display |
|---|---|
| Item synergizes with 1+ cards in player's current deck | Green pill: "Synergy: [card names]" |
| Item conflicts with player's strategy | Red pill: "Conflicts with: [card name]" |
| No synergies or conflicts detected | Grey pill: "No synergies" |

Showing "No synergies" on zero-synergy items is intentional — it proves the system always checked, rather than just sometimes tagging.

### Synergy cross-highlighting

When the player taps or hovers a card with synergies, the synergy target cards visible in the "Your Deck" sell row pulse with a green border glow for 600ms. This visually connects the purchase decision to the existing deck.

### Synergy count badge (optional P3 feature)

A small circled number in the top-right corner of each purchasable item showing the count of current-deck synergies. A card marked "3" is a stronger fit than one marked "0." Players compare at a glance without reading every tag. Cards in the sell row also show their synergy counts.

### Anti-synergy detection

Conflicts are surfaced as red pills. Example: if the player is running a block-heavy deck and a card requires having no block cards (hypothetical mechanic), the conflict tag makes this visible before purchase. Anti-synergies also down-rate transformation options in the three-option quality ranking.

---

## 12. Mobile Considerations

The game's primary launch target is Steam PC at 1920×1080, landscape 16:9. Mobile portrait is secondary. The shop layout must work correctly in both orientations.

| Element | Desktop (landscape) | Mobile portrait (<768px wide) |
|---------|--------------------|-----------------------------|
| Relic row | 3 cards horizontal, 4th at 30% peeking | Same, horizontal scroll |
| Learning card row | 3 cards horizontal | 2 cards visible + 3rd at 50% peeking |
| Services section | Side by side (50/50) | Stacked vertically |
| Sell row | 3 cards horizontal | 2 cards + scroll |
| Card frames | Full V2 frame at standard size | Full V2 frame at `calc()` scaled size |
| Detail inspection panel | Slides up from card (partial overlay) | Full-screen bottom sheet |
| Deck fan (removal/transform) | Arc layout | Scrollable 2-column grid |
| Synergy tags | Inline below card | Inline below card (same) |
| HUD bar | `calc(44px * var(--layout-scale, 1))` | Same (layout-scale handles the reduction) |

Touch targets: all interactive elements must be at minimum `calc(44px * var(--layout-scale, 1))` tall/wide for mobile tap accuracy (Apple HIG standard).

---

## 13. Sound Design

All sounds respect the global mute toggle and volume slider. No individual sound exceeds 600ms except the ambient loop and the full transformation sequence.

| Moment | Sound | Duration | Notes |
|--------|-------|----------|-------|
| Enter shop | Ambient atmosphere (subtle crackle, low hum) | Loops | Very low volume, atmosphere only |
| Gold counter change | Single coin clink | 80ms | Pitch varies slightly per increment |
| Card appear (entrance stagger) | Soft card-on-wood thud | 100ms | Slightly higher pitch per successive card |
| Card hover | No sound or very faint paper rustle | 50ms | Less is more — don't fatigue the player |
| Purchase confirmed | "Cha-ching" — metallic, two-tone | 200ms | Bright and satisfying |
| Coin particle fly | Light metallic trickle | 400ms | Matches particle animation |
| Card flip | Quick whoosh | 150ms | |
| Sell confirmed | Paper tear/rip | 150ms | Reinforces sacrifice feeling |
| Removal — flames | Low crackling fire | 600ms | Matches burn animation |
| Removal — complete | Brief gong or low resonant tone | 300ms | Signals finality |
| Transform — shimmer | Rising crystalline shimmer | 400ms | Builds anticipation |
| Transform — dissolve | Granular dissolve (sand/crystal) | 600ms | Edges-inward disintegration |
| Transform — vortex | Swirling wind, increasing pitch | 400ms | Accelerating rotation |
| Transform — split | Sharp crack | 100ms | Vortex fracturing into three |
| Transform — materialize | Soft bell tone × 3 | 150ms each | One per card solidifying |
| Transform — reveal flip | Card flip + ascending chime | 200ms × 3 | Each reveal higher pitch |
| Transform — choice confirmed | Warm positive chime | 200ms | Satisfaction |
| Price escalation tick | Soft click per increment | 50ms per tick | Rapid during price count-up |
| Unaffordable shake | Dull thud or short buzz | 80ms | Negative feedback, not harsh |
| Shopkeeper bark | Text only (no voice audio) | — | Voice acting is expensive; text barks are sufficient for now |
| Leave shop | Door creak or footsteps | 200ms | Exit transition |

---

## 14. Summary: Priority Table

| Priority | Change | Effort | Impact | Notes |
|----------|--------|--------|--------|-------|
| **P0** | Add section headers ("RELICS", "LEARNING CARDS", "SERVICES", "YOUR DECK") | Small | Instant category clarity | No border-color guessing |
| **P0** | Dim unaffordable cards: 40% opacity + red price | Small | Eliminates wasted attention | Recalcs after every transaction |
| **P0** | Sticky gold HUD bar + back arrow (remove full-width Leave button) | Small–medium | Gold always visible, navigation clean | |
| **P0** | Replace "Power X" with real computed values on all cards | Small | Removes nonsensical labels | "5 dmg", "4 shield", "50% empower" |
| **P0** | Relic vanishing tooltip on hover/tap | Small–medium | Relics are completely opaque without it | Uses KeywordPopup.svelte pattern |
| **P0** | Sale mechanic: one card 50% off per shop visit | Small–medium | Immediate engagement boost, creates "which one?" tension | Sale ribbon on V2 frame; stacks with floor discount and haggle |
| **P1** | Services section: group removal + transformation with shared header | Medium | Two strategic actions become discoverable | Side by side on desktop |
| **P1** | Card removal: 50g base, deck-fan selection, confirmation, burn animation | Medium | Most impactful shop action gets proper UX | |
| **P1** | Card transformation: deck-fan → dissolve → 3 V2-framed options → choose | Large | Highest-engagement shop feature; gambling + deckbuilding dopamine | All 3 options use real V2 frames |
| **P1** | Escalating pricing (+25g per use per run) with animated price updates | Small–medium | Prevents deck-thinning abuse, creates meaningful scarcity | |
| **P1** | Expand synergy tags to all purchasable items (not just Empower) | Medium | Best existing feature becomes a system | Show "No synergies" too |
| **P1** | Sell values: raise from 1–3g to 10–28g (15–20% of buy price) | Small | Makes selling a real strategic decision | Or reframe as Grey Matter |
| **P1** | Sell button: change from green to amber | Trivial | Removes misleading "good deal" color signal | |
| **P2** | ~~Card long-press inspection~~ REMOVED — cards use inline V2 frames with all info visible | — | — | Cards are self-describing via frame |
| **P2** | Pre-upgraded card display: upgrade icon + computed upgraded value + "+X" indicator | Small | Clarity on what pre-upgraded cards actually offer | |
| **P2** | Three-option quality variance system for transformation (★ HIGH badge) | Medium | Makes transformation choices meaningful | Star badge, saturation treatment |
| **P2** | Purchase animation (coin fly, card flip, exit) | Medium | Dopamine and weight to transactions | |
| **P2** | Card removal burn animation | Medium | Most dramatic shop action gets proper ceremony | |
| **P2** | Card transformation transmutation animation (full 3-act) | Medium–large | Cinematic payoff for the shop's most exciting feature | |
| **P2** | Shopkeeper portrait + context-sensitive barks | Medium | Personality and atmosphere | Text-only, no voice |
| **P2** | Affordability recalc animations (post-transaction dimming/brightening) | Small | Visual consequences of spending decisions | |
| **P3** | Synergy cross-highlighting: pulse connected sell-row cards | Small | Advanced decision support | |
| **P3** | Anti-synergy / conflict tags | Medium | Prevents bad purchases | Requires conflict detection logic |
| **P3** | Synergy count badge (circled number on each item) | Small | Glanceable synergy comparison | |
| **P3** | Shop entrance stagger animation | Small–medium | Polish and atmosphere | |
| **P3** | Sell animation (tear + particles) | Small | Reinforces sacrifice framing | |
| **P3** | Sound design layer (full transformation sequence) | Medium | Polish — implement last | |
