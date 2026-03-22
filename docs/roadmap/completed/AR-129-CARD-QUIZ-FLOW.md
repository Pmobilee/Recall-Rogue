# AR-129: Card Interaction & Quiz Flow Fixes

**Source:** docs/COMBAT-UX-AUDIT.md (C-4, H-9, H-10, H-11, H-13, H-17, M-3, M-6, M-7, M-8, M-13, M-18, M-19, L-3)
**Priority:** Critical + High
**Estimated complexity:** High

## Overview

Fix the most impactful card interaction and quiz flow issues: wrong answer confirmation, charge play discoverability, Echo card labeling, timer positioning, and tutorial text accuracy.

## Sub-steps

### 1. Wrong answer "Got it" button (C-4)
**File:** `src/ui/components/CardExpanded.svelte`

After a wrong answer, instead of auto-dismissing in 1600ms, show the correct answer highlighted green and display a "Got it" button. The player must tap to continue.

In `handleAnswer()`:
- When `!isCorrect`: set `showResult = true`, highlight correct answer in green
- Do NOT auto-dismiss via timeout
- Show a "Got it" button that calls `onanswer(index, false, false)` when tapped
- Keep the 800ms delay to reveal the correct answer, but then wait indefinitely for tap

Template addition after the answers section:
```html
{#if showResult && !isCorrect}
  <button class="got-it-btn" onclick={() => onanswer(selectedAnswerIndex, false, false)}>
    Got it
  </button>
{/if}
```

Style the button: large (min-height 48px), centered, distinct from answer buttons.

### 2. Drag-to-charge hint in portrait (H-9)
**File:** `src/ui/components/CardHand.svelte`

When a card is selected (first tap, risen state) in portrait mode, show a brief hint:
```html
{#if isSelected && !$isLandscape}
  <div class="charge-hint">
    Drag up to Charge (1.5x)
  </div>
{/if}
```
Position below the risen card. Auto-dismiss after 3 seconds. Only show if `!localStorage.getItem('hint:chargeDragSeen')`. Set the flag after first successful charge.

### 3. Charge zone visual threshold line (H-10)
**File:** `src/ui/components/CardHand.svelte`

During drag (when `dragState` is active and `isDragPreview` is true), show a horizontal dashed line at the charge zone Y position:
```html
{#if dragState && isDragPreview}
  <div class="charge-threshold-line"
    style="top: {window.innerHeight < 600 ? 45 : 55}%"
  >
    <span class="threshold-label">CHARGE</span>
  </div>
{/if}
```
Style: dashed line, semi-transparent, with a small "CHARGE" label. The line helps players see exactly where the zone starts.

### 4. Echo card "Charge Only" label (H-13)
**File:** `src/ui/components/CardHand.svelte`

Add a visual indicator on Echo cards that Quick Play is blocked:
- In the card template, when `card.isEcho`, show a small badge: "CHARGE ONLY"
- Position at the bottom of the card, below the effect description
- Style: small text, yellow/gold color to match the charge theme

### 5. Fix comparison banner text (H-17)
**File:** `src/ui/components/CardCombatOverlay.svelte`

Change line ~1641:
```
"Quick Play = safe at 1.0x. Charge = quiz for up to 3x power!"
```
To:
```
"Quick Play = safe at 1.0x. Charge = quiz for 1.5x power + Speed Bonus!"
```

### 6. Timer position above answers (M-6)
**File:** `src/ui/components/CardExpanded.svelte`

Move the timer bar from below the answer buttons to above them (below the question text). In the template, reorder so the timer div renders between the question and the answers section.

### 7. Timer expiry feedback (M-7)
**File:** `src/ui/components/CardExpanded.svelte`

When `timerExpired` becomes true, show a brief "Speed Bonus lost!" overlay text for 1.5 seconds. Change timer bar color to gray. Do NOT disable answers.

```html
{#if timerExpired && !answersDisabled}
  <div class="timer-expired-label">Speed Bonus lost!</div>
{/if}
```

### 8. Speed bonus threshold marker on timer (M-18)
**File:** `src/ui/components/CardExpanded.svelte`

Add a small gold tick mark on the timer bar at the speed bonus threshold position (25% or 30% with relic):
```html
<div class="speed-bonus-marker" style="left: {(1 - speedBonusThreshold) * 100}%"></div>
```
Style: 2px wide gold line inside the timer bar container.

### 9. Cancel affordance for selected state (M-3)
**File:** `src/ui/components/CardCombatOverlay.svelte`

When card-backdrop is visible (card selected), add a visible X button in top-right:
```html
<button class="card-backdrop" onclick={handleDeselect}>
  <span class="backdrop-cancel-hint">Tap to cancel</span>
</button>
```

### 10. Tutorial overlay mutual exclusion (M-13)
**File:** `src/ui/components/CardCombatOverlay.svelte`

Gate tutorial overlays so only one shows at a time. Add a derived:
```typescript
let activeTutorial = $derived(
  showApTutorial ? 'ap' : showChargeTutorial ? 'charge' : showComparisonBanner ? 'comparison' : null
)
```
Then render conditionally: `{#if activeTutorial === 'ap'}`, etc.

### 11. End Turn confirmation threshold (M-8)
**File:** `src/ui/components/CardCombatOverlay.svelte`

Change the confirmation condition from "any AP remaining" to "2+ AP remaining":
```typescript
if (apCurrent >= 2 && hasPlayableCards && !showEndTurnConfirm) {
```

### 12. Feedback on tapping unaffordable card (M-19)
**File:** `src/ui/components/CardCombatOverlay.svelte`

In `handleSelect()`, when the tapped card costs more AP than available, briefly show a shake animation and "Not enough AP" tooltip:
```typescript
if (!hasEnoughAp(card)) {
  // trigger brief shake + tooltip
  return
}
```

### 13. Unaffordable charge drag fallback (L-3)
**File:** `src/ui/components/CardHand.svelte`

In `handlePointerUp`, when in charge zone but can't afford charge, return card to hand instead of silently firing Quick Play. Change the fallback from `oncastdirect(index)` to just `onselectcard(index)` or return without action.

## Acceptance Criteria
- [ ] Wrong answer shows "Got it" button, waits for tap
- [ ] Portrait mode shows drag-to-charge hint on first card selection
- [ ] Charge zone threshold line visible during drag
- [ ] Echo cards show "CHARGE ONLY" badge
- [ ] Comparison banner says "1.5x" not "3x"
- [ ] Timer bar is above answer buttons
- [ ] "Speed Bonus lost!" shows on timer expiry
- [ ] Gold marker on timer bar at speed bonus threshold
- [ ] Cancel hint visible on card selection backdrop
- [ ] Only one tutorial overlay shows at a time
- [ ] End Turn confirmation only at 2+ AP
- [ ] Shake + tooltip on tapping unaffordable card

## Files Affected
- `src/ui/components/CardExpanded.svelte`
- `src/ui/components/CardHand.svelte`
- `src/ui/components/CardCombatOverlay.svelte`

## Verification Gate
- `npm run typecheck` passes
- `npm run build` passes
- `npx vitest run` passes
- Visual inspection: play card, trigger quiz, wrong answer flow, echo card, timer expiry
