# AR-128: Combat Layout & Ergonomics Fixes

**Source:** docs/COMBAT-UX-AUDIT.md (H-1, H-2, H-3, H-4, H-6, H-7, M-1, M-2, M-5, M-11, M-15, M-16, L-1, L-4, L-5, L-12)
**Priority:** High
**Estimated complexity:** High

## Overview

Reposition key combat UI elements for better information hierarchy, mobile ergonomics, and genre-convention compliance. The biggest changes: move intent bubble to center-top, move End Turn to bottom-right, swap draw/discard pile convention.

## Sub-steps

### 1. Reposition enemy intent bubble (H-1)
**File:** `src/ui/components/CardCombatOverlay.svelte`

Move `.enemy-intent-bubble` from top-left to center-top, below enemy name:
```css
.enemy-intent-bubble {
  position: fixed;
  top: calc(calc(32px * var(--layout-scale, 1)) + var(--safe-top));
  left: 50%;
  transform: translateX(-50%);
  /* Remove old left: 8px positioning */
}
```
Remove the `.intent-bubble-tail` pointing upward (no longer needed when centered).

In landscape mode, keep it centered but adjust top offset.

### 2. Move End Turn button to bottom-right (H-4)
**File:** `src/ui/components/CardCombatOverlay.svelte`

Change `.end-turn-btn` positioning:
```css
.end-turn-btn {
  right: calc(12px * var(--layout-scale, 1));  /* was left */
  bottom: calc(calc(12px * var(--layout-scale, 1)) + var(--safe-bottom, 0px));
  left: auto;  /* clear the old left positioning */
}
```

### 3. Swap draw/discard pile positions to genre convention (H-7)
**File:** `src/ui/components/CardCombatOverlay.svelte`

Swap the CSS classes:
- `.draw-pile-indicator`: position LEFT (cards come from left)
- `.discard-pile-indicator`: position RIGHT (cards go to right)

Update the CSS:
```css
.draw-pile-indicator {
  left: calc(12px * var(--layout-scale, 1));
  right: auto;
}
.discard-pile-indicator {
  right: calc(12px * var(--layout-scale, 1));
  left: auto;
}
```

Also update the card animation CSS vars (`--draw-pile-x`, `--discard-pile-x`) since the pile positions changed.

### 4. Co-locate AP and HP (H-2)
**File:** `src/ui/components/CardCombatOverlay.svelte`

Move the AP display into the `.player-status-strip` rather than having a separate floating AP orb. The strip already exists with block badge + HP bar. Add the AP counter as the first element:

In the portrait player-status-strip template, add AP before block:
```html
<div class="player-status-strip">
  <div class="player-ap-inline" class:ap-active={apCurrent > 0}>
    <span class="ap-num">{apCurrent}</span>
    <span class="ap-label">AP</span>
  </div>
  <!-- existing block badge -->
  <!-- existing HP track -->
</div>
```

Keep the old `.ap-orb` but only render it if NOT in the new inline mode (can be a feature flag or just remove it).

### 5. Large hand card tap target fix (C-2 / H-6)
**File:** `src/ui/components/CardHand.svelte`

When cards > 7, reduce card width further and add a horizontal scroll gesture:
- Change `handScaleFactor` to cap at 7 visible cards max: `cards.length > 7 ? 0.65 : ...`
- When cards > 7, show first 7 in fan + a "+N" overflow indicator on the right
- Tapping "+N" expands to a full-width scrollable card strip
- OR: reduce overlap to ensure minimum 44px tap strip per card: `const minTapWidth = 44; const maxOverlap = Math.max(0, cardW - minTapWidth);`

The simpler approach: ensure `cardSpacing` never drops below 44px:
```typescript
const minSpacing = 44
return Math.max(minSpacing, Math.min(overlapSpacing, ...))
```

### 6. Fan rotation reduction for readability (H-6)
**File:** `src/ui/components/CardHand.svelte`

Reduce fan spread from 39 degrees to 24 degrees for <=6 cards:
```typescript
const spread = total > 6 ? 18 : 24  // was 25 : 39
```

### 7. Safe-area padding for landscape (M-11, M-15)
**File:** `src/ui/components/CardCombatOverlay.svelte`

Add safe-area-aware positioning to landscape elements:
```css
.layout-landscape .landscape-stats-bar {
  padding-left: max(16px, env(safe-area-inset-left));
  padding-right: max(16px, env(safe-area-inset-right));
}
.layout-landscape .enemy-intent-bubble {
  top: calc(10% + env(safe-area-inset-top, 0px));
}
```

### 8. Block badge hide when 0 (M-1)
**File:** `src/ui/components/CardCombatOverlay.svelte`

Only render the block badge when `playerShield > 0`:
```html
{#if playerShield > 0}
  <div class="player-block-badge">...</div>
{/if}
```

### 9. "?" button mobile detection (L-12)
**File:** `src/ui/components/CardCombatOverlay.svelte`

The `?` keyboard help button is already gated to landscape (`{#if $isLandscape}`). This is acceptable since landscape implies keyboard. No change needed — mark as already handled.

### 10. Discard pile dim at 0 (L-4)
**File:** `src/ui/components/CardCombatOverlay.svelte`

The discard pile already handles empty state with `pile-empty` class and `opacity: 0.3`. Verify this works. No change needed if already implemented.

## Acceptance Criteria
- [ ] Intent bubble is centered below enemy name, not top-left
- [ ] End Turn button is bottom-right
- [ ] Draw pile is left, discard pile is right (genre convention)
- [ ] AP is inline with HP in the player status strip
- [ ] 10-card hand maintains 44px minimum tap targets
- [ ] Fan spread reduced to 24 degrees (was 39)
- [ ] Landscape elements respect safe-area insets
- [ ] Block badge hidden when shield = 0

## Files Affected
- `src/ui/components/CardCombatOverlay.svelte`
- `src/ui/components/CardHand.svelte`
- `src/game/scenes/CombatScene.ts` (pile position vars)

## Verification Gate
- `npm run typecheck` passes
- `npm run build` passes
- Visual inspection of all combat scenarios at 390px and 1280px widths
