# AR-66: Reward Room — Visual Scaling & Positioning Fix

## Overview
The reward room scene has critical visual bugs visible in testing:
1. **Cards render at near-full-screen size** instead of small collectible icons on the cloth
2. **Background doesn't fill edge-to-edge** — dark gaps visible at edges
3. **Items positioned below the boulder** instead of ON the cloth surface
4. **Cloth spawn zone coordinate transform is wrong** — math doesn't properly map source image coords to scene coords

**Root Cause:** The Phaser `img.width` property returns the SOURCE texture width (256px for card frames), and `setScale(40/256 = 0.156)` should produce a small icon. But in testing, cards render huge. This suggests either: (a) the scale is being overridden by the spawn animation tween which sets `scaleX: 1, scaleY: 1` as the target, (b) the image width is wrong, or (c) another scaling issue.

The spawn animation in `createItemAt()` sets initial `scaleX: 0, scaleY: 0` then tweens to `scaleX: 1, scaleY: 1` — this RESETS the scale to 1.0, overriding the `setScale(0.156)` that was applied. This is the bug.

**Dependencies:** AR-65
**Complexity:** Small-Medium

## Sub-steps

### 1. Fix spawn animation overriding card scale
- **File:** `src/game/scenes/RewardRoomScene.ts`
- In `createItemAt()`, the spawn tween targets `scaleX: 1, scaleY: 1`. This overrides any scale set on the sprite. Instead, capture the sprite's INTENDED scale before the tween and tween TO that value.
- Store the desired scale on the sprite after creation, then use it as the tween target
- **Fix pattern:**
  ```typescript
  const desiredScaleX = (sprite as any).scaleX || 1
  const desiredScaleY = (sprite as any).scaleY || 1
  ;(sprite as any).scaleX = 0
  ;(sprite as any).scaleY = 0
  // In tween:
  scaleX: desiredScaleX,
  scaleY: desiredScaleY,
  ```

### 2. Fix background to fill edge-to-edge
- Use proper cover-mode: `Math.max(scaleX, scaleY)` is correct, but the Y offset math pushes the image off-center
- Remove the cloth-center offset entirely — just use `bg.setY(H / 2)` to center the image. The background image already has the cloth/boulder in a good position for the viewport
- Or adjust the offset to be much smaller

### 3. Fix cloth zone coordinate mapping
- The cloth spawn zone bounds are in source image coordinates (1536×2752 mask)
- The background image is ALSO 1536×2752
- After cover-mode scaling, the background's top-left corner in scene coords needs to be computed correctly
- Items must be placed relative to the background image's actual rendered position, not the viewport

### 4. Reduce card/vial/gold display sizes
- Card frames: target 40px wide in game coords (already set, just needs spawn tween fix)
- Health vials: `setScale(this.sf)` makes them 56×77 game-coords — reduce to `setScale(this.sf * 0.7)` for ~39×54
- Gold piles: `setScale(this.sf)` makes them 48-112px — reduce to `setScale(this.sf * 0.6)` for ~29-67px

## Files Affected
- `src/game/scenes/RewardRoomScene.ts`

## Verification Gate
- [ ] `npm run typecheck` passes
- [ ] Cards render as small ~40px wide icons on the cloth
- [ ] Background fills entire viewport edge-to-edge
- [ ] Items positioned ON the cloth surface (upper-middle area of screen)
- [ ] Vials and gold piles proportionally sized
