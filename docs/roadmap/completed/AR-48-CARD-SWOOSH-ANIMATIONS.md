# AR-48 — Card Swoosh Animations (Draw, Discard, Reshuffle)

## Overview
**Goal:** Cards visually swoosh from the draw pile (bottom-right) into the hand each turn, and swoosh toward the discard pile (bottom-left) when played/discarded. When the draw pile runs out, cards visually fly from the discard pile to the draw pile before the next draw. All animations should feel smooth, fast, and satisfying — not intrusive.

**Dependencies:** AR-44 (draw/discard pile positions established)
**Estimated complexity:** Medium (CSS animations + JS orchestration in CardHand and CardCombatOverlay)

## Sub-steps

### 1. Cards swoosh IN from draw pile (bottom-right) each turn
- When cards are dealt into the hand at the start of a turn, each card should animate from the draw pile position (bottom-right corner) into its final hand position
- Cards arrive one at a time with ~80ms stagger delay between each
- Each card triggers the existing `card_deal` flop sound on arrival
- Animation: card starts at draw pile location (small, rotated), scales up and moves to its hand position over ~250ms
- Update `@keyframes card-fan-in` in CardHand.svelte to originate from bottom-right screen position

**Files:** `src/ui/components/CardHand.svelte`
**Acceptance:** Cards visibly fly from the draw pile icon into the hand, one by one, with flop sounds.

### 2. Cards swoosh OUT to discard pile (bottom-left) when played
- When a card is played (answered correctly or incorrectly), it should animate toward the discard pile position (bottom-left corner)
- Animation: card shrinks, rotates slightly, and moves toward bottom-left over ~200ms, then fades
- Update `@keyframes discardMinimize` to target bottom-left position
- When a card fizzles (skipped/timed out), same direction but with the existing grayscale fizzle effect

**Files:** `src/ui/components/CardHand.svelte`
**Acceptance:** Played/discarded cards visibly fly toward the discard pile icon.

### 3. Reshuffle animation — cards fly from discard to draw pile
- When draw pile is empty and discard pile reshuffles, show a subtle animation:
  - Small card silhouettes fly from the discard pile position (bottom-left) to the draw pile position (bottom-right)
  - Fast, ~40ms stagger per card, small scale (~20% of card size)
  - Each triggers a quieter/faster version of the flop sound
  - Animation happens IN PLACE at the bottom of the screen — NO center-screen overlay
- Remove the existing `reshuffle-overlay` (the full-screen overlay with "Reshuffling..." text and card grid) — replace with this subtle bottom-of-screen animation
- Total animation duration should be brief: ~0.5-1s max regardless of card count (cap stagger count at ~12 cards visually even if more are reshuffled)

**Files:** `src/ui/components/CardCombatOverlay.svelte`, `src/services/deckManager.ts` (reshuffleEvent already exists)
**Acceptance:** When draw pile empties, player sees a quick burst of card silhouettes flying left-to-right at the bottom. No intrusive overlay. Feels like a physical deck shuffle.

### 4. Add quieter "shuffle" sound variant
- Add a `card_shuffle` sound to audioService — similar to `card_deal` but quieter (gain 0.12 vs 0.25) and slightly shorter (~40ms vs 60ms)
- Used for the reshuffle animation cards

**Files:** `src/services/audioService.ts`
**Acceptance:** Reshuffle sounds are distinct from deal sounds — faster and quieter.

## Files Affected
| File | Changes |
|------|---------|
| `src/ui/components/CardHand.svelte` | card-fan-in from bottom-right, discardMinimize to bottom-left |
| `src/ui/components/CardCombatOverlay.svelte` | Remove reshuffle-overlay, add subtle reshuffle fly animation |
| `src/services/audioService.ts` | Add card_shuffle sound |
| `docs/GAME_DESIGN.md` | Update card animation descriptions |

## Verification Gate
- [ ] `npm run typecheck` — 0 errors
- [ ] `npm run build` — succeeds
- [ ] Visual: cards fly in from bottom-right draw pile on each turn
- [ ] Visual: played cards fly to bottom-left discard pile
- [ ] Visual: reshuffle shows cards flying left→right at bottom, no overlay
- [ ] Audio: flop sounds on deal, quieter shuffle sounds on reshuffle
- [ ] Timing: deal animation ~400ms total for 5 cards, reshuffle ~500-800ms
- [ ] All animations respect `prefers-reduced-motion`
- [ ] All px values use `var(--layout-scale, 1)`
