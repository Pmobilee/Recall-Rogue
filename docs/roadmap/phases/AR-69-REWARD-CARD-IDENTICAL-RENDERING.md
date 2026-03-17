# AR-69: Reward Room — Pixel-Identical Card Rendering

## Overview
The card detail popup in the reward room must render cards IDENTICALLY to how they appear in the player's hand during combat. Currently it's a broken imitation with wrong positioning, wrong fonts, wrong layout.

The fix: copy the EXACT CSS and markup structure from `CardHand.svelte`'s `.card-in-hand` rendering into `RewardCardDetail.svelte`.

## Key Card Rendering Spec (from CardHand.svelte)
- **Card dimensions**: width = `--card-w`, height = `card-w * 1.42`
- **Frame image**: `position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; border-radius: 6px`
- **AP gem**: `position: absolute; top: 1%; left: 2.5%; width: card-w*0.18; height: card-w*0.18; font: Cinzel 900 card-w*0.13; color: #fff; text-shadow: heavy black`
- **Parchment text area**: `position: absolute; top: 66%; bottom: 7%; left: 8%; right: 8%; font: Georgia 700 card-w*0.095; color: #2a1f14; centered`
- **Description parts**: numbers bold #1a1208, keywords bold, conditionals gray/#22c55e
- **Card container**: `background: transparent; border: none; border-radius: 8px; overflow: visible; box-shadow: 0 4px 12px rgba(0,0,0,0.5)`

## Sub-steps

### 1. Rewrite RewardCardDetail.svelte
- Set `--card-w` CSS variable on the card container (e.g., `200px * layout-scale` for the detail popup)
- Use identical HTML structure: `.card-front` > `img.card-frame-img` + `.ap-gem` + `.card-parchment-text` > `.parchment-inner` with description parts
- Copy ALL relevant CSS rules from CardHand.svelte exactly (don't approximate)
- The popup card should be a larger version of the hand card (200px wide instead of 117px)

### 2. Accept/Reject buttons below
- Accept (green gradient) and "Put Back" (gray) buttons below the card
- Card type color badge between card and buttons

## Files Affected
- `src/ui/components/RewardCardDetail.svelte` (rewrite)

## Verification Gate
- [ ] Card in popup looks IDENTICAL to card in hand (same frame, gem, parchment text positioning)
- [ ] Description text appears in the parchment area at 66% down, centered
- [ ] AP gem positioned at top-left corner matching the hand card
- [ ] `npm run typecheck` passes
