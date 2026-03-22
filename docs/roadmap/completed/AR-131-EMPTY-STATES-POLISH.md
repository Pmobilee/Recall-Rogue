# AR-131: Empty States & Polish

**Source:** docs/COMBAT-UX-AUDIT.md (H-8, M-2, M-5, M-9, M-10, M-16, L-1, L-4, L-5, L-6, L-7)
**Priority:** Medium + Low
**Estimated complexity:** Low

## Overview

Polish empty states (relic tray, discard pile), attach pile tooltips, add deck composition stat, add turn counter, and miscellaneous low-priority visual refinements.

## Sub-steps

### 1. Relic tray empty state (H-8)
**File:** `src/ui/components/RelicTray.svelte`

When the player has 0 relics, instead of showing 5 empty slots, show a single compact placeholder:
- If `relics.length === 0`: show a small "No relics" label with a faint dotted-outline icon
- If `relics.length > 0`: show equipped relics + remaining empty slots as faint dotted outlines (current behavior but with reduced visual weight)

### 2. Pile tooltip attachment (M-9)
**File:** `src/ui/components/CardCombatOverlay.svelte`

The `pileTooltip()` function exists but is never attached. Add `title` attribute to both pile indicators:
```html
<div class="pile-indicator draw-pile-indicator"
  title={pileTooltip('Draw', turnState.deck.drawPile)}
  ...>
```
```html
<div class="pile-indicator discard-pile-indicator"
  title={pileTooltip('Discard', turnState.deck.discardPile, false)}
  ...>
```

### 3. Enemy info button touch target (M-10)
**File:** `src/ui/components/CardCombatOverlay.svelte`

Ensure the enemy info button has minimum 44x44px touch target:
```css
button[aria-label="Enemy info"] {
  min-width: 44px;
  min-height: 44px;
  padding: 8px;
}
```

### 4. Total deck composition stat (M-16)
**File:** `src/ui/components/CardCombatOverlay.svelte`

Add a small deck count near the draw pile:
```html
<span class="deck-total-label">
  Deck: {drawPileCount + discardPileCount + handCards.length}
</span>
```
Position near the draw pile indicator, small text, low opacity.

### 5. Turn counter (L-1)
**File:** `src/ui/components/CardCombatOverlay.svelte`

Add a turn counter near the enemy name or floor counter:
```html
<span class="turn-counter-label">Turn {turnState.turnNumber}</span>
```
Style: small, semi-transparent, near the enemy name heading.

### 6. Intent update animation (L-1 related)
**File:** `src/ui/components/CardCombatOverlay.svelte`

Add a brief scale-pulse animation when the intent bubble content changes. Use a `{#key}` block:
```html
{#key intentDetailText}
  <button class="enemy-intent-bubble" ...>
    ...
  </button>
{/key}
```
Add CSS animation on mount: `animation: intentPulse 300ms ease-out;`

### 7. Intent bubble tap feedback (L-6)
**File:** `src/ui/components/CardCombatOverlay.svelte`

Improve the active state feedback from 8% brightness to a visible scale:
```css
.enemy-intent-bubble:active {
  transform: translateX(-50%) scale(0.95);
  filter: brightness(0.85);
}
```

### 8. Fizzle duration constant (L-5)
**File:** `src/ui/utils/mechanicAnimations.ts`

Export a `FIZZLE_DURATION` constant:
```typescript
export const FIZZLE_DURATION = 400
```

**File:** `src/ui/components/CardCombatOverlay.svelte`
Import and use it instead of hardcoded 400:
```typescript
import { FIZZLE_DURATION } from '../utils/mechanicAnimations'
// ...
setTimeout(() => { ... }, turboDelay(FIZZLE_DURATION))
```

### 9. Stack icon visual tiers (L-7)
No change — the numeric count label is sufficient. The stack visual is supplementary. Mark as won't-fix.

## Acceptance Criteria
- [ ] 0 relics shows compact "No relics" placeholder, not 5 empty slots
- [ ] Pile indicators show tooltip on hover/long-press
- [ ] Enemy info button has 44px minimum touch target
- [ ] Deck total count visible near draw pile
- [ ] Turn counter visible near enemy name
- [ ] Intent bubble pulses on content change
- [ ] Intent bubble has clear active-state feedback
- [ ] FIZZLE_DURATION exported and used

## Files Affected
- `src/ui/components/CardCombatOverlay.svelte`
- `src/ui/components/RelicTray.svelte`
- `src/ui/utils/mechanicAnimations.ts`

## Verification Gate
- `npm run typecheck` passes
- `npm run build` passes
- Visual inspection of empty states and polish elements
