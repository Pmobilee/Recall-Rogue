# AR-44 — Combat UX & Deck Polish

## Overview
**Goal:** Polish the combat screen with better card hand presentation, draw/discard pile redesign, satisfying card dealing animations with sound, deck reshuffle visuals, background fixes, and hub campsite banner improvements.

**Dependencies:** AR-43 (responsive scaling) — all new px values must use `var(--layout-scale)`.
**Estimated complexity:** Medium (mostly CSS/animation + one new audio effect + reshuffle overlay).

## Sub-steps

### 1. Card hand — stronger arch, better position
- Increase arc offset multiplier from 30 → 55 in `getArcOffset()` for a more pronounced fan curve
- Lower hand container position: `bottom: calc(24px * scale + 6vh)` (was 40px + 12vh)
- Increase rotation spread by ~30% for a more dramatic fan shape
- **Status:** DONE (agent completed)

**Files:** `src/ui/components/CardHand.svelte`
**Acceptance:** Cards form a clear arch, center card noticeably higher than edges. Hand sits lower, freeing more play area.

### 2. Draw/discard pile redesign
- Draw pile on the **right** side with green accent (#27AE60), showing card count
- Discard pile on the **left** side with orange accent (#E67E22), showing card count
- Both styled as card-shaped icons (52×68px), not small chips
- AP orb position lowered ~30px
- **Status:** DONE (agent completed)

**Files:** `src/ui/components/CardCombatOverlay.svelte`
**Acceptance:** Draw pile visible bottom-right (green), discard pile bottom-left (orange). Both show count numbers prominently.

### 3. Card dealing animation + flop sounds
- New synthesized `card_deal` sound: short papery flop using Web Audio API bandpass noise
- Cards animate in from the right side (toward draw pile) with stagger: 80ms between each card
- Each card triggers a `card_deal` sound on entry
- Discard animation direction changed to fly left (toward discard pile on left)
- **Status:** IN PROGRESS (agent running)

**Files:** `src/services/audioService.ts`, `src/ui/components/CardHand.svelte`
**Acceptance:** Cards fly in one-by-one from right with audible "flop flop flop". Discarded cards fly left.

### 4. Deck reshuffle animation
- When draw pile is empty and discard pile reshuffles, show a brief overlay
- Cards visually move from left (discard) to right (draw) one-by-one
- Each card triggers the `card_deal` flop sound with 60ms stagger
- Cards transition from orange border (discard) to green border (draw) during animation
- Auto-hides after animation completes
- Emit reshuffle event from `deckManager.ts` so UI can react
- **Status:** IN PROGRESS (agent running)

**Files:** `src/services/deckManager.ts`, `src/ui/components/CardCombatOverlay.svelte`
**Acceptance:** When draw pile runs out, player sees/hears cards shuffling from discard to draw. Animation lasts 1-2 seconds max.

### 5. Combat background — stretch to top
- Verify Phaser container fills full viewport height
- Check/reduce top vignette alpha if it obscures the background
- Ensure `_swapBackground` covers full canvas
- **Status:** IN PROGRESS (agent running)

**Files:** `src/game/scenes/CombatScene.ts`, `src/CardApp.svelte`
**Acceptance:** Background image visually fills the entire screen behind combat, no dark strip at top.

### 6. Rest room overlay — card stretches to top
- Change `.rest-overlay` from `align-items: center` to `align-items: flex-start`
- Change `.rest-card` to stretch from top of screen: remove top border-radius, add top padding for safe area
- Creates a more immersive full-screen rest experience
- **Status:** IN PROGRESS (agent running)

**Files:** `src/ui/components/RestRoomOverlay.svelte`
**Acceptance:** Rest room card visually extends from the top of the screen downward.

### 7. Hub active-run banner — orange box stretches to top
- The "Continue Run" / "Abandon Run" banner on the hub campsite screen should have its orange background extend all the way to the top of the screen
- Currently it's a small floating banner — stretch it to create a full top-section panel
- Keep button content positioned the same, just extend the background

**Files:** `src/CardApp.svelte` (active-run-banner styles)
**Acceptance:** Orange banner background fills from top of screen to its content area. Buttons remain in the same position.

## Files Affected
- `src/ui/components/CardHand.svelte` — arch, position, dealing animation
- `src/ui/components/CardCombatOverlay.svelte` — draw/discard piles, reshuffle overlay, AP orb
- `src/services/audioService.ts` — card_deal flop sound
- `src/services/deckManager.ts` — reshuffle event store
- `src/game/scenes/CombatScene.ts` — background fix
- `src/CardApp.svelte` — background container, active-run-banner
- `src/ui/components/RestRoomOverlay.svelte` — rest card stretch
- `docs/GAME_DESIGN.md` — update deck/hand visual descriptions

## Verification Gate
- [ ] `npm run typecheck` — 0 errors
- [ ] `npm run build` — succeeds
- [ ] Visual test: card hand shows clear arch with cards fanning from bottom
- [ ] Visual test: draw pile (green, right), discard pile (orange, left) both show counts
- [ ] Audio test: cards make "flop" sound when dealt, staggered
- [ ] Visual test: reshuffle shows cards moving from discard to draw with sounds
- [ ] Visual test: combat background fills full screen including top
- [ ] Visual test: rest room card extends to top of screen
- [ ] Visual test: hub active-run banner orange extends to top
- [ ] All animations respect `prefers-reduced-motion`
- [ ] All new px values use `var(--layout-scale, 1)`
