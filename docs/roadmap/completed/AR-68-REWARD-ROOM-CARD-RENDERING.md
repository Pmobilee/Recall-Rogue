# AR-68: Reward Room — RPG Borders, Gold Size, Spacing, Card Rendering

## Overview
Polish pass addressing remaining visual issues:
1. All items on the cloth need black RPG-style pixel borders
2. Gold piles need to be bigger
3. Items should spread evenly across the cloth pedestal surface
4. Card detail popup should show the card exactly as it appears in-hand (card frame art, AP gem, parchment text with description parts) — reuse the existing Svelte card rendering by showing a DOM overlay
5. Small cards on the cloth should also look better with the frame art

## Sub-steps

### 1. RPG pixel outline on all reward sprites
- In Phaser, apply a 1-2px black outline effect to all item sprites
- Use Phaser's postFX pipeline or the 8-direction shift technique:
  - Create 8 copies of the sprite shifted ±1px in cardinal+diagonal directions, tinted black
  - Place them behind the main sprite
- Simpler approach: use `preFX.addGlow(0x000000, 1, 0, false, 0.5, 8)` on each sprite for a dark outline glow

### 2. Bigger gold
- Increase gold scale from `sf * 2.0` to `sf * 2.8`

### 3. Better cloth spread
- Compute positions that use more of the cloth area
- For the typical 5-item reward (gold + vial + 3 cards), use a layout that spreads across the full cloth width with slight vertical variation

### 4. Card detail as Svelte DOM overlay
- When a card is tapped in the Phaser scene, emit an event to the bridge
- The bridge triggers a Svelte component overlay (`RewardCardDetail.svelte`) that renders the card using the same frame/AP/parchment-text pattern from CardHand
- Accept/Reject buttons below the card
- This gives pixel-perfect card rendering matching the in-hand display

### 5. Rendered card preview on cloth
- Keep the small card frame images on the cloth (they look fine as thumbnails)
- The detail popup does the heavy lifting for readability

## Files Affected
- `src/game/scenes/RewardRoomScene.ts` — outline FX, gold size, spacing
- `src/ui/components/RewardCardDetail.svelte` — new Svelte overlay for card detail
- `src/CardApp.svelte` — mount the overlay
- `src/services/rewardRoomBridge.ts` — forward card tap events

## Verification Gate
- [ ] All items have visible dark outline/border
- [ ] Gold piles prominently sized
- [ ] Items spread across full cloth surface
- [ ] Card tap shows proper card rendering with frame, AP gem, description
- [ ] Accept/Reject flow works
- [ ] `npm run typecheck` passes
