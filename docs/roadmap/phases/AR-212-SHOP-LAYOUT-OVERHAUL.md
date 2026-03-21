# AR-212: Shop Layout Overhaul

## Overview
The shop screen has a broken layout at 1920x1080 — the Phaser scene only fills ~40% of the left side while the shop UI is cramped in a narrow column, leaving ~40% of the right side as black void. The shop needs to use the full viewport width with a better-balanced layout.

**Complexity**: Medium
**Dependencies**: None
**Files Affected**: `src/ui/components/ShopRoom.svelte`, `src/game/scenes/ShopScene.ts`, related CSS

## Sub-steps

### 1. Redesign shop to use full viewport width
- Current: Phaser scene left ~40%, shop list center ~30%, black void right ~40%
- Target: Either (a) full-width Phaser background with shop UI overlaid, or (b) Phaser scene full-height left 35%, shop UI filling remaining 65%
- Remove the black void — every pixel should be used
- Use flexbox/grid with responsive units
- **Acceptance**: No empty black void; shop fills the viewport

### 2. Improve relic item cards in shop
- Relic descriptions are truncated/abbreviated ("All attack cards +1 base damage" cut off)
- Show full relic description text
- Enlarge relic icon in shop item row
- Use `--text-scale` and `--layout-scale` for all sizing
- **Acceptance**: Full relic descriptions visible without truncation

### 3. Improve card items display in shop
- Card items (Heavy Strike, Lifetap, etc) show as small pills with price
- Show card art thumbnail or at minimum card type icon + full name + key stat
- **Acceptance**: Card shop items show enough info to make informed purchase decisions

### 4. Improve Card Removal section
- Currently visually disconnected at bottom
- Integrate it better into the shop flow — perhaps as a dedicated tab or clearly separated section
- **Acceptance**: Card removal option is clearly part of the shop experience

### 5. Enlarge "Leave Shop" button
- Currently small text at very bottom
- Make it a full-width button with clear styling
- **Acceptance**: Leave Shop button clearly visible and accessible

### 6. Show gold balance prominently
- "Gold: 500" / "Gold: 1000" text is small
- Display gold with large icon + number in a HUD-style element
- Use `--text-scale` for sizing
- **Acceptance**: Player always knows their gold at a glance

## Verification Gate
- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] Shop screenshots at 1920x1080 show no black void areas
- [ ] All shop items (relics, cards, card removal) display complete information
- [ ] No hardcoded px values
- [ ] Shop-loaded scenario with relics + cards both display correctly
