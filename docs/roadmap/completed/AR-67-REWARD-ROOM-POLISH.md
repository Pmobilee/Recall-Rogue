# AR-67: Reward Room — Layout, Readability & Interaction Polish

## Overview
Polish pass on the reward room scene addressing visual feedback from playtesting:
1. Items need to spread more across the cloth area (currently bunched together)
2. Gold piles too small/unnoticeable — need to be bigger
3. All items need drop shadows beneath them for grounding
4. Card frames are blurry/hard to read at small scale — use Lanczos (smooth) scaling instead of pixelated, and increase width slightly
5. Card tap should show full-size card with stats (including upgrade indicators) with Accept/Reject below — Reject returns card to cloth, Accept collects it
6. Auto-advance: when all items are collected (gold tapped, vial tapped, card accepted), skip the Continue button and immediately proceed to next room after a brief delay

## Sub-steps

### 1. Spread items more across cloth area
- In `computeClothLayout()`, increase `useW` from `w * 0.5` to `w * 0.75` and `useH` from `h * 0.3` to `h * 0.5`
- This uses more of the cloth surface for item placement

### 2. Bigger gold piles
- Change gold scale from `this.sf * 1.2` to `this.sf * 2.0`
- Gold should be visually prominent as a reward

### 3. Drop shadows on all items
- In `createItemAt()`, the shadow ellipse already exists but it's too small (48×14)
- Make shadow width proportional to the actual sprite width (~70% of sprite width)
- Increase shadow alpha slightly to 0.35 for better visibility

### 4. Card readability — smooth scaling
- Card frames at 256px scaled to 72px are blurry with pixelated rendering
- In `createRewardSprite` card case, after creating the image, call `img.setTexture()` approach won't work — instead, disable pixelated rendering on just that sprite: Phaser 3 doesn't have per-sprite filtering easily, but we can use `img.texture.setFilter(Phaser.Textures.FilterMode.LINEAR)` for smooth scaling
- Increase card target width from 72 to 80 for slightly better readability

### 5. Card detail popup — show actual card with stats
- Replace the current plain text popup with a proper card detail view
- Show: card frame image (larger, ~180px wide), mechanic name, card type badge, AP cost, full effect description (from `getDetailedCardDescription`), upgrade "+" indicator if `card.isUpgraded`
- Accept button (green) and Reject button (gray) below
- Reject: close overlay, card resumes idle bob on cloth (still tappable)
- Accept: collect card, disintegrate other card/relic items, emit event

### 6. Auto-advance when all items collected
- After each collection (gold, vial, card accept), check if ALL items are now collected
- If yes, wait 800ms then auto-emit `sceneComplete` (skip Continue button)
- The disintegration animation from card accept takes ~450ms, so 800ms gives time for it to finish

## Files Affected
- `src/game/scenes/RewardRoomScene.ts`

## Verification Gate
- [ ] Items spread across full cloth area
- [ ] Gold piles visually prominent
- [ ] All items have visible drop shadows
- [ ] Cards render smoothly (not pixelated)
- [ ] Card tap shows full detail with Accept/Reject
- [ ] Reject returns card to cloth
- [ ] Auto-advance fires when all items collected
- [ ] `npm run typecheck` passes
