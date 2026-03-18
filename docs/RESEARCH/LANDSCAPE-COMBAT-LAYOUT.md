# Landscape Combat Layout — Agent Instructions

> **This document supplements the Master Instructions (DESKTOP-PORT-MASTER-INSTRUCTIONS.md) Section 3.**
> Agents implementing the landscape combat layout MUST follow this spec exactly.
> Reference the 4-state diagrams discussed with the game designer for visual guidance.

---

## Layout Overview

The combat screen has **three horizontal strips** in landscape mode:

| Strip | Height | Contents |
|-------|--------|----------|
| Arena | ~65% of viewport | Enemy, quiz panel, relics, chain/combo indicators, End Turn |
| Stats bar | ~8% of viewport (fixed ~30-36px) | AP, Block, HP bar |
| Card hand | ~27% of viewport | 5 cards in flat horizontal row with gaps |

---

## 1. Arena (Top ~65%)

Full-width area. Background: landscape combat background image (1920x1080 asset, scaled to fit). All combat visuals happen here.

### Default State (No Quiz Active)

**Enemy — CENTER of arena:**
- Enemy name: centered above sprite, red/yellow pixel font
- Intent badge: centered below name, shows next action (e.g., "2x3", "Block 8")
- HP bar: below intent, ~40% of arena width
- Enemy sprite: centered below HP bar
- Status effect icons: below or beside sprite

**Relics — TOP-LEFT:**
- Horizontal row of relic slots
- Shows equipped relics (up to 5), pulsing when active
- Dormant relics at 50% opacity

**Pause button — TOP-RIGHT corner**

**Right-side column (bottom-right of arena, stacked vertically above End Turn):**
- Chain counter: shows current chain type name + length (e.g., "Crimson x2"), colored by chain type
- Combo counter: shows combo count (e.g., "Combo x3")
- END TURN button: bottom-right corner of arena, below the indicators

The stacking order top-to-bottom in the right column is:
```
Chain counter
Combo counter
END TURN button (bottom-right corner)
```

### Quiz Active State

When a Charge is committed:

**Quiz panel — LEFT side of arena:**
- Takes ~55-60% of arena width
- Subtle dark panel background (semi-transparent, rounded corners)
- Slides in from left (200ms ease-out)
- Contains (top to bottom):
  1. Timer bar (full width of panel, blue, depletes left-to-right)
  2. Card effect reminder text ("Deal 8 damage")
  3. Question text (large, readable)
  4. Answer options (horizontal columns — see Section 5)
  5. Hint button (centered, below answers)

**Enemy — slides RIGHT (200ms, fast):**
- Enemy + name + intent + HP bar all slide as a group to the right ~35-40% of arena
- Enemy is always fully visible during quiz — never obscured
- The slide is a CSS transform, not a relayout — smooth and fast

**Right-side indicators stay in place** (chain, combo, End Turn don't move)

### Quiz Result State (500ms)

**Correct answer:**
- Quiz panel fills with green flash overlay (opacity 0.12-0.15)
- Large "CORRECT" text centered in quiz panel
- Damage calculation breakdown shown below
- Damage number flies from quiz panel toward enemy sprite
- Enemy HP bar decreases

**Wrong answer:**
- Quiz panel fills with red flash overlay
- "WRONG" text + correct answer revealed
- No damage. Chain breaks. Combo decreases.

**After 500ms:**
- Quiz panel fades out (200ms)
- Enemy slides back to center (200ms)
- Cards un-dim and become interactive again
- Next action can be taken

---

## 2. Stats Bar (Middle Strip, ~30-36px)

Full-width horizontal bar between arena and card hand.

Layout left to right:
```
[AP circle] [AP label] ... [Block badge] [========= HP bar =========] ... [empty]
```

**AP counter:**
- Left-most element
- Orange/coral circle with AP number inside (large, bold)
- "AP" label text to the right of the circle

**Block indicator:**
- To the LEFT of the HP bar
- Blue badge showing "Block: X"
- When block is 0, still visible but dimmed

**Player HP bar:**
- Center of the stats bar
- Green fill, shows "current / max" text centered on bar
- Width: ~50-60% of stats bar

**The stats bar has NO End Turn button** — that's in the arena.

---

## 3. Card Hand (Bottom Strip, ~27%)

Five cards in a **flat horizontal row with even gaps** between them (like Slay the Spire PC). No arc, no overlap.

### Card Layout

Each card shows:
- **Chain type glow** (top-left corner): radial gradient, 28-32px diameter, colored by chain type
- **Chain type icon** (inside glow): small icon (diamond, flame, droplet, star, crescent, leaf)
- **AP cost** (top-right): number colored by chain type with text shadow for contrast
- **Mechanic name** (center): Strike, Block, Hex, etc.
- **Effect value** (below name): "Deal 8", "Gain 6", "Draw 2"

### Chain Type Pulse

When 2+ cards in hand share a `chainType`:
- Their top-left glows pulse in sync
- Opacity oscillates 30% → 60% over 1.5s (sine wave)
- Non-matching cards stay static at 30%
- All cards of the same chainType share animation phase

### Card Sizing

At 1920x1080:
- Card width: ~150-170px each
- Card height: fills the hand strip (~75-85% of strip height)
- Gap between cards: ~20-30px
- Hand is centered horizontally
- Cards should NOT overlap — flat row with clear separation

---

## 4. Card Selection (State 2)

### On Click/Tap

The clicked card:
1. **Rises upward** out of the hand strip, into the lower portion of the arena
2. Scales slightly larger (1.1x)
3. Shows expanded info: mechanic name, effect value, and the current fact's question preview
4. Has a thicker border (1.5-2px) in the chain type color

### Charge Button

- Appears **directly above** the risen card
- Amber/gold colored pill button
- Text: "CHARGE +1" (or "CHARGE FREE" during Surge, or "CHARGE FREE" for first-time facts)
- Keyboard shortcut: E key

### Quick Play (No Button)

- **There is no Quick Play button.**
- Tapping/clicking the selected card AGAIN performs Quick Play
- The card itself acts as the Quick Play trigger
- A subtle text hint on the risen card: "Tap again = quick play" (or similar, small and unobtrusive)
- Keyboard shortcut: Q key (when a card is selected)

### Deselect

- Clicking empty space or pressing Escape deselects the card
- Card slides back down to its hand position
- Charge button disappears

### Other Cards During Selection

- All non-selected cards dim to ~35% opacity
- They are NOT clickable while another card is selected (must deselect first)

---

## 5. Quiz Panel (State 3)

### Position & Size

- LEFT side of arena
- Width: ~55-60% of arena width
- Height: auto-sized to content, vertically centered in arena
- Slides in from left edge (200ms ease-out)
- Background: `var(--color-background-primary)` at ~95% opacity, rounded corners (12px)
- Subtle border: 0.5px `var(--color-border-secondary)`

### Timer Bar

- Full width of quiz panel, at the very top
- Blue fill that depletes from right to left over the timer duration
- Height: 6px, rounded
- When typed quiz mode is active: timer gets +3 seconds

### Content Stack (top to bottom)

1. **Timer bar** (6px)
2. **Effect reminder** (small text): "Deal 8 damage" — reminds player what the card does
3. **Question** (large, bold): "What does 'tevreden' mean?"
4. **Answer options** (see below)
5. **Hint button** (blue, centered): "Hint (1)" — decrements hint count on use

### Answer Options Layout

**Horizontal columns based on answer count:**

| Answer Count | Layout |
|---|---|
| 2 | Two wide buttons side by side |
| 3 | Three columns, equal width |
| 4 | 2x2 grid (two rows of two) |

Each answer button:
- Shows keyboard number (1, 2, 3, 4) as a small badge in the top-left
- Full text of the answer
- Hover highlight on mouse-over
- Click or press corresponding number key to select

**True/False:**
- Two wide buttons: "True" (T key) | "False" (F key)

**Typed input (vocab, when enabled in settings):**
- Large text input field replaces answer buttons
- Auto-focused when quiz appears
- Placeholder text shows expected format
- Enter to submit
- 1.1x Scholar multiplier for correct typed answers

### Card Hand During Quiz

- All cards dim to ~30% opacity
- Cards are NOT interactive during quiz
- After quiz resolves (State 4 → State 1), cards un-dim

---

## 6. Surge Effect (Both Portrait + Landscape)

> **This effect applies to BOTH layout modes.** It is a viewport-level overlay, not specific to landscape.

### When Active

On Surge turns (every 3rd turn, starting turn 2):

**Golden border effect around the ENTIRE game viewport:**
- Animated golden/amber spark particles flowing along all four edges
- Particles are small (2-4px), varying opacity (0.5-0.9)
- Travel clockwise around the border continuously
- Speed: moderate, not frantic
- ~20-30 particles visible at any time
- Particle colors: alternate between `#FFCA28` (Gilded) and `#FFA726` (Amber)

**Border glow:**
- 2-3px golden border/glow on the outermost edge of the viewport
- Subtle, not overwhelming — think "ambient warmth" not "screaming gold"

**Implementation:**
- CSS/Canvas overlay at the viewport level (above all game content, pointer-events: none)
- Particles animate using CSS `@keyframes` or a lightweight Canvas 2D particle loop
- Performance: keep particle count low, use `will-change: transform` for GPU acceleration
- Must work identically in portrait and landscape — the border wraps the viewport regardless of dimensions

### Duration

- Starts with Surge announcement (flash + label per GDD)
- Persists for the entire Surge turn
- Fades out smoothly (300ms) when Surge ends

### Interaction with Other States

- The golden border is ALWAYS visible during a Surge turn, including during quiz (State 3) and result (State 4)
- It renders on top of all other elements (z-index above everything)
- It does not interfere with clicking/tapping (pointer-events: none on the overlay)

---

## 7. Transition Timing Summary

| Transition | Duration | Easing |
|---|---|---|
| Card selected (rise from hand) | 150ms | ease-out |
| Card deselected (return to hand) | 120ms | ease-in |
| Charge button appear | 100ms | fade-in |
| Quiz panel slide in (from left) | 200ms | ease-out |
| Enemy slide to right | 200ms | ease-out (simultaneous with quiz) |
| Quiz panel fade out (after result) | 200ms | fade-out |
| Enemy slide back to center | 200ms | ease-out (simultaneous with quiz fade) |
| Cards dim on quiz | 150ms | opacity transition |
| Cards un-dim after quiz | 200ms | opacity transition |
| Correct answer green flash | 300ms | flash then hold |
| Wrong answer red flash | 300ms | flash then hold |
| Result display hold | 500ms | static |
| Damage number fly to enemy | 400ms | ease-in with slight arc |
| Surge border fade in | 300ms | opacity transition |
| Surge border fade out | 300ms | opacity transition |

---

## 8. Keyboard Shortcuts (Landscape Only)

| Key | Action | Context |
|-----|--------|---------|
| 1-5 | Select card 1-5 (left to right) | Hand visible, no card selected |
| Q | Quick Play selected card | Card selected |
| E | Charge selected card | Card selected |
| Escape | Deselect card / Cancel | Card selected or quiz active |
| Space | Skip animation / Confirm | Result animation playing |
| 1-4 | Select answer 1-4 | Quiz multiple choice |
| T / F | True / False | Quiz true/false |
| Enter | Submit typed answer | Quiz typed input focused |
| Tab | End Turn | Hand visible |

**All actions must also be performable via mouse click.** Keyboard is acceleration, not requirement.

---

## 9. Mouse Behaviors (Landscape Only)

| Interaction | Behavior |
|---|---|
| Hover card in hand | Card subtly enlarges (1.05x), info preview tooltip |
| Click card in hand | Select card (rises, Charge button appears) |
| Click selected card | Quick Play (card plays immediately) |
| Click Charge button | Commit to Charge (quiz appears) |
| Click empty space | Deselect card |
| Click quiz answer | Select that answer |
| Hover quiz answer | Highlight effect |
| Hover enemy | Tooltip with next 2-3 intents, all status effects, damage breakdown |
| Right-click card | Detailed card info (fact, chain type, FSRS tier) |

---

## 10. Portrait Mode

**Portrait mode is UNCHANGED from the current implementation.** The only addition is:

- **Surge golden border effect** — same implementation as landscape, wraps the portrait viewport
- All other portrait elements stay exactly as they are

---

## 11. Responsive Breakpoint

```
aspect ratio >= 1.0 → landscape layout (this document)
aspect ratio < 1.0  → portrait layout (current implementation, unchanged)
```

The layout switches live on viewport resize or device rotation. The Phaser canvas resizes and repositions all sprites. Svelte overlay components swap via `{#if $layoutMode === 'landscape'}`.

---

## 12. What Agents Must Inspect Before Implementing

1. Current combat Phaser scene — how enemy sprites, backgrounds, and VFX are positioned
2. Current Svelte combat overlay — how card hand, quiz panel, AP counter, HP bar are rendered
3. Current animation system — how card selection, quiz transitions, and damage numbers animate
4. Current Phaser-Svelte boundary — which elements are Phaser sprites vs Svelte DOM elements
5. Current touch/pointer event handlers — these need mouse equivalents in landscape

---

## 13. Acceptance Criteria

- [ ] Arena takes ~65% of viewport in landscape, enemy centered by default
- [ ] Enemy slides right when quiz activates, slides back when quiz resolves
- [ ] Quiz panel slides in from left, takes ~55-60% of arena
- [ ] Quiz panel is compact — no wasted empty space
- [ ] Answer options laid out as horizontal columns based on answer count
- [ ] Stats bar shows AP (left), Block (left of HP), HP bar (center)
- [ ] Card hand is flat horizontal row with gaps — no overlap, no arc
- [ ] Chain type glow + icon visible on each card's top-left
- [ ] AP cost colored by chain type on each card
- [ ] Matching chain types pulse in sync
- [ ] Card selection: card rises above hand, Charge button appears above card
- [ ] Quick Play: tap selected card again (no separate button)
- [ ] All keyboard shortcuts work in landscape
- [ ] All actions clickable with mouse only
- [ ] Mouse hover on cards shows subtle enlarge + tooltip
- [ ] Mouse hover on enemy shows expanded intent tooltip
- [ ] Chain counter + Combo counter stacked above End Turn (right side of arena)
- [ ] Surge golden border effect works in BOTH portrait and landscape
- [ ] Surge particles animate along all four viewport edges
- [ ] All transitions match the timing table
- [ ] Portrait mode is pixel-identical to pre-port version (except surge border addition)
- [ ] 60fps at 1920x1080
