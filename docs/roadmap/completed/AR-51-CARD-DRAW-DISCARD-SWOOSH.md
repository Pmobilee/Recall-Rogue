# AR-51: Card Draw/Discard Swoosh Animations

**Status:** Complete
**Created:** 2026-03-16
**Completed:** 2026-03-16
**Depends on:** None

## Overview

Cards visually fly out of the draw pile when drawn and into the discard pile when discarded. Multiple previous attempts failed due to CSS transform conflicts between keyframe animations and Svelte's inline transform-based fan positioning. Investigation confirmed root cause and the Web Animations API was used as the fix.

## Problem Statement

1. **Draw**: Cards spring out of the draw pile icon (bottom-right) as tiny dots and grow into their fan position. Previously they just popped in with a fade.
2. **Played card discard**: After the reveal→swoosh→impact sequence, cards fly to the discard pile (bottom-left). The `discardMinimize` keyframe existed but didn't visually work.
3. **Fizzle discard**: Wrong-answer cards fly to the discard pile. The `cardFizzle` keyframe existed but didn't visually work.
4. **End-of-turn**: Remaining hand cards fly to the discard pile before disappearing. Previously they just vanished.

## Root Cause Analysis Required

The core conflict: `.card-in-hand` uses inline `style="transform: translate3d(xOffset, arcOffset, 0) rotate(deg) scale(s)"` for fan positioning. CSS keyframe animations that also use `transform` either:
- Override the inline transform during playback (cards stack on top of each other)
- Get overridden by the inline transform (animation has no visible effect)
- Leave cards in wrong positions after animation ends (fill-mode forwards)

Previous failed approaches:
- CSS keyframe `transform` in `card-fan-in` — conflicted with inline transform
- Reactive `enteringCardIds` state — calculated wrong positions, cards stuck in center
- Direct DOM manipulation (`el.style.transform = ''`) — Svelte doesn't re-apply inline style
- CSS `translate`/`scale` as independent properties — may not be supported or composing correctly

## Tasks

### Section A: Investigation (READ-ONLY — no code changes)

- [x] **A.1** Document the EXACT CSS property chain on a `.card-in-hand` element:
  - What sets `transform`? (inline style from Svelte template)
  - What sets `transition`? (CSS rule)
  - What sets `animation`? (CSS rule)
  - What is the specificity order? Which wins?
  - Test in browser devtools: does `translate` (independent property) actually compose with `transform`?
  - **Finding**: CSS keyframe animations conflict with Svelte inline transforms. CSS custom properties are not set when the keyframe `0%` frame resolves. `!important` in keyframes is ignored per spec.

- [x] **A.2** Document the card lifecycle phases and which CSS applies at each:
  - Phase: In hand (normal) — what classes, what inline styles?
  - Phase: Animating (reveal/swoosh/impact) — does it switch to `.card-animating` (different element)?
  - Phase: Discard — `.card-discard` with `position: fixed` — where is the element at this point?
  - Phase: Fizzle — `.card-fizzle` — is the element still in the hand container?
  - **Finding**: The conflicting mechanism was fully mapped, confirming WAAPI as the solution.

- [x] **A.3** Test the `--discard-pile-x/y` and `--draw-pile-x/y` CSS custom properties:
  - Are they actually set on `document.documentElement`?
  - Are they readable from the card elements?
  - What values do they have on mobile vs desktop?
  - **Finding**: CSS vars are set by `CardCombatOverlay`, but timing is a problem — they aren't guaranteed to be set when the first keyframe resolves. Double `requestAnimationFrame` solves this.

- [x] **A.4** Determine the correct technical approach:
  - Option A: Wrapper div approach (outer div animates position, inner has fan transform)
  - Option B: Web Animations API (`el.animate()`) which can composite with existing transforms ← **CHOSEN**
  - Option C: Separate the card into two render paths (hand cards vs animating cards) more cleanly
  - Option D: Use `will-change` and layering to allow independent animation
  - **Finding**: Web Animations API with `composite: 'replace'` solves the conflict cleanly — it reads the card's existing inline `transform` as the end state, making the fan position the target.

### Section B: Implementation

- [x] **B.1** Implement draw swoosh
  - `initCardAnimOffsets` Svelte action on `.card-in-hand` elements in `CardHand.svelte`
  - Uses Web Animations API (`el.animate()`) — starts card at draw pile CSS var position (scale 0.05) and animates to fan position
  - Double `requestAnimationFrame` delay ensures CSS vars (`--draw-pile-x/y`) are set before animation starts
  - Reads card's inline `transform` (fan position) as the end state; `composite: 'replace'` mode
  - Staggered delays via inline `animation-delay` style (80ms per card index)
  - Falls back to fade-in if pile vars are unavailable

- [x] **B.2** Implement played-card discard swoosh
  - `ghostCardAnim` Svelte action on ghost (animating) cards in `CardCombatOverlay.svelte`
  - Uses `MutationObserver` to detect when `card-discard` class is added to the ghost element
  - Triggers WAAPI animation from the card's current `getBoundingClientRect()` position to the discard pile viewport position (`--discard-pile-x/y` CSS vars)
  - `composite: 'replace'` mode, 200ms duration

- [x] **B.3** Implement fizzle swoosh
  - Same `ghostCardAnim` action handles fizzle: detects `card-fizzle` class via the same `MutationObserver`
  - Identical trajectory (card flies to discard pile) but with longer duration (400ms) and `filter: grayscale(1)` applied at the WAAPI end keyframe

- [x] **B.4** Implement end-of-turn hand discard
  - `handleEndTurn()` in `CardCombatOverlay.svelte` queries all `.card-in-hand:not(.card-animating)` elements
  - Triggers staggered WAAPI animations (250ms base + 40ms per card stagger) flying each card to the discard pile
  - Calls `onendturn()` callback after the last animation completes (via Promise.all on animation finish events)
  - **Bonus — Reshuffle→draw sequencing**: `reshuffleHoldingHand` state in `CardCombatOverlay` holds `handCards` as empty array during the reshuffle animation. When the reshuffle finishes, hand cards mount normally and `initCardAnimOffsets` swooshes them in from the (now refilled) draw pile.

### Section C: Verify

- [x] **C.1** Visual test: cards fly from draw pile to hand
- [x] **C.2** Visual test: played cards fly to discard pile after impact
- [x] **C.3** Visual test: fizzled cards fly to discard pile
- [x] **C.4** Fan layout still works (cards spread, not stacked)
- [x] **C.5** `npm run typecheck` clean

## Files Affected

| File | Action | Task |
|------|--------|------|
| `src/ui/components/CardHand.svelte` | EDIT | B.1 |
| `src/ui/components/CardCombatOverlay.svelte` | EDIT | B.2, B.3, B.4, Bonus |

## Constraints

- MUST NOT break the fan layout (cards fanned in an arc at the bottom) ✓
- MUST NOT break the reveal→swoosh→impact→discard play sequence ✓
- MUST work on mobile (touch events, small viewport) ✓
- CSS `transform` on `.card-in-hand` is controlled by Svelte's inline style — cannot be overridden by keyframes without side effects ✓ (solved via WAAPI)
