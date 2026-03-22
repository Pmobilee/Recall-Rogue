# AR-218: Combat HUD Layout Overhaul

> **Source:** [Playtest Feedback 2026-03-22](../PLAYTEST-FEEDBACK-2026-03-22.md) — Issues #6, #7, #8, #9, #10, #11, #12, #13, #14, #15, #16, #20, #28, #46
> **Priority:** P0 — Foundation for all other combat UI ARs
> **Complexity:** Large (14 discrete layout changes across multiple components)
> **Dependencies:** None (this is the foundation)

---

## Overview

Complete overhaul of the combat HUD layout in landscape mode. The current layout has numerous issues: misplaced elements, wrong sizes, ugly styling, and redundant text. This AR restructures the entire combat HUD to feel polished and game-ready for Steam PC at 1920x1080.

---

## User's Exact Words

- **#6:** "The end turn button has a 0 in it for some reason, dunno if this is the chain counter, but if not, we dont need this."
- **#7:** "We need a nice and clear Chain: to the right of our hand, in the middle of the card row, IF we have any chain, and must have nice black border and must be in the color of that chain!"
- **#8:** "Make the cards just 15% larger."
- **#9:** "The end turn button, put it stuck to the bottom left."
- **#10:** "The draw pile and discard pile can be twice as big."
- **#11:** "Underneath the draw pile as I can see it says Deck: 100, dunno what this is but remove it."
- **#12:** "The HP bar is enveloped in this horrible black bar, remove the black bar, center our hp bar. Make our hp green or red or orange based on hp percentage left, and make it blue only if we have ANY block!"
- **#13:** "The HP bar must be centered, and be BELOW the cards, meaning we must move up the cards."
- **#14:** "The AP sphere needs to be twice as big, and moved to about 15% of the screen to the right."
- **#15:** "We must no longer say BLOCK: 0, if there IS any block, just show the dimmed block icon we have, larger, with a number in it indicating block, stuck to the left of our hp bar, not moving the hp bar."
- **#16:** "The text of the number of cards in draw and discard also needs to match increase in size."
- **#20:** "When hovering over a card it says in the middle of the screen underneath the cards stuff like block 1 ap crimson. Have this instead show slightly above the end turn button, stuck to the left of the screen and slightly above the end turn button."
- **#28:** "For our own effects applied, they can be above our own hp bar, meaning the cards will go even a bit higher, not too much though, our icons can be a little bit smaller, or not the icons, but the boxes/containers around our icons."
- **#46:** "NO MORE BLOCK ICONS, just show (6) in front of our first number in the healthbar, or the healthbar of the enemy, if they have block."

---

## Sub-Steps

### 1. End Turn Button — Remove "0" and Relocate to Bottom-Left
- **What:** Investigate what the "0" is (likely chain counter or combo counter remnant). Remove it entirely from the end turn button.
- **What:** Move end turn button to bottom-LEFT of the screen (currently bottom-right).
- **Position:** Fixed to bottom-left corner with appropriate padding.
- **Acceptance:** End turn button is at bottom-left, no "0" text visible, functions correctly.

### 2. Chain Display — Relocate to Right of Card Hand
- **What:** Move chain display from its current position (bottom-left per GAME_DESIGN.md) to the RIGHT side of the card hand row, vertically centered with the cards.
- **Style:** Nice black border, text colored in the chain's color (using `getChainColor()`). Format: "Chain: X.x" (e.g., "Chain: 1.7").
- **Visibility:** Only visible when chain length >= 2 (existing behavior).
- **Acceptance:** Chain display appears to the right of the rightmost card when active, colored by chain type, with black border. Hidden when no chain.

### 3. Cards — 15% Larger
- **What:** Increase card size in combat hand by 15%.
- **Method:** Scale the card width/height values in `CardHand.svelte` or equivalent by 1.15x.
- **Acceptance:** Cards are visibly larger. No overflow or clipping issues. Card text still readable.

### 4. Draw Pile & Discard Pile — Twice as Big
- **What:** Double the size of draw pile and discard pile icons.
- **Acceptance:** Draw and discard pile icons are 2x their current size. Positioned correctly without overlapping other elements.

### 5. Remove "Deck: 100" Label
- **What:** Find and remove the "Deck: 100" text that appears underneath the draw pile.
- **Acceptance:** No "Deck: X" text visible anywhere on the combat screen.

### 6. Draw/Discard Card Count Text — Match Size Increase
- **What:** The card count numbers on draw and discard piles must scale proportionally with the pile size increase (2x).
- **Acceptance:** Card count text is proportionally larger, clearly readable.

### 7. Player HP Bar — Remove Black Bar Container
- **What:** Remove the ugly black bar/container that wraps the player HP bar.
- **Acceptance:** Player HP bar has no surrounding black container. Floats cleanly.

### 8. Player HP Bar — Color by HP Percentage
- **What:** HP bar fill color changes based on remaining HP percentage:
  - Green: >= 60% HP
  - Orange: 30-59% HP
  - Red: < 30% HP
  - Blue: ONLY when player has ANY block (overrides other colors)
- **Acceptance:** HP bar color dynamically changes based on HP%. Blue when block > 0.

### 9. Player HP Bar — Center Below Cards
- **What:** Move player HP bar to be centered horizontally, positioned BELOW the card hand.
- **What:** Move cards UP to make room for HP bar below them.
- **Layout order (bottom to top):** HP bar → cards → (status effects above HP bar per #28)
- **Acceptance:** HP bar is centered below the card hand. Cards are higher than before.

### 10. AP Sphere — Twice as Big, Repositioned
- **What:** Double the AP sphere size.
- **What:** Move it to approximately 15% from the left edge of the screen (not hard left).
- **Acceptance:** AP sphere is 2x current size, positioned at ~15% screen width from left.

### 11. Block Display — Inline HP Text, No Icon
- **What:** Remove the "Block: 0" text display entirely.
- **What:** Remove the block shield icon.
- **What:** When block > 0, show block value as "(6)" prefix before the HP numbers in the HP bar text. E.g., "(6) 85/100".
- **What:** When block = 0, show nothing extra — just "85/100".
- **Applies to BOTH player and enemy HP bars** (per #46).
- **Acceptance:** No block icon or "Block: X" label anywhere. Block shown as inline "(N)" prefix in HP bar text when > 0.

### 12. Card Hover Info — Relocate Above End Turn Button
- **What:** The card info tooltip that currently shows in the middle of the screen (e.g., "block 1 ap crimson") must be moved.
- **New position:** Stuck to the left side of the screen, slightly above the end turn button.
- **Acceptance:** Card hover info appears near bottom-left, above the end turn button. Not in the middle of the screen.

### 13. Player Status Effects — Above HP Bar with Smaller Containers
- **What:** Player status effect icons (strength, poison, etc.) display ABOVE the player's HP bar.
- **What:** Cards go slightly higher to accommodate.
- **What:** Make the containers/boxes around the status effect icons smaller (not the icons themselves).
- **Acceptance:** Status effects visible above HP bar, cards shifted up, containers smaller.

---

## Layout Diagram (Landscape 1920x1080)

```
+------------------------------------------------------------------+
|  [Enemy Title + Turn]              [Enemy HP Bar]                 |
|                    [Enemy Status Effects - UNDER HP bar]          |
|                                                                   |
|                        [Enemy Sprite]                             |
|                                                                   |
|                                                                   |
|  [Draw]                                              [Discard]   |
|   (5)            [Card] [Card] [Card] [Card] [Card]     (3)     |
|                  [Chain: 1.7 - if active, right of cards]        |
|  [AP]     [Player Status Effects]                                |
|  (3)      [Player HP: (6) 85/100 - centered]                    |
|  [END]    [Card Info tooltip]                                     |
|  [TURN]                                                           |
+------------------------------------------------------------------+
```

**Key positions:**
- End Turn: bottom-left
- AP sphere: ~15% from left, near bottom
- Draw pile: left side, middle-bottom area
- Discard pile: right side, middle-bottom area
- Cards: centered, raised higher than current
- HP bar: centered, below cards
- Status effects: above HP bar
- Chain display: right of card hand
- Card info: above end turn button, left-aligned

---

## Files Affected

- `src/ui/combat/CardCombatOverlay.svelte` — main combat HUD layout
- `src/ui/combat/CardHand.svelte` — card hand sizing and positioning
- `src/ui/combat/EndTurnButton.svelte` — position and "0" removal
- `src/ui/combat/PlayerStats.svelte` — HP bar, block display, AP sphere
- `src/ui/combat/ChainCounter.svelte` — chain display relocation
- `src/ui/combat/StatusEffects.svelte` — player status effects positioning
- `src/ui/combat/DeckCounter.svelte` or equivalent — draw/discard pile sizing
- `src/ui/combat/CardInfoTooltip.svelte` or equivalent — hover info relocation

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] All 14 sub-steps visually verified via Playwright at 1920x1080
- [ ] End turn button at bottom-left, no "0"
- [ ] Cards 15% larger, no clipping
- [ ] HP bar colored by % (green/orange/red/blue), centered below cards
- [ ] Block shown as inline "(N)" text, no icons
- [ ] Chain display right of hand, colored
- [ ] AP sphere 2x size at ~15% from left
- [ ] Draw/discard 2x size with proportional text
- [ ] Card info tooltip near bottom-left
- [ ] Status effects above HP bar
- [ ] No "Deck: 100" text
- [ ] `npx vitest run` passes
- [ ] Update `docs/GAME_DESIGN.md` sections: Chain Display, Card Anatomy, status effects positioning, block display
