# AR-39: Combat Polish Round — Intent, AP, Deck, Facts, Hand, Glow

**Status:** Complete
**Created:** 2026-03-15
**Depends on:** AR-36 (completed)

## Overview

Address 7 combat UX issues from playtesting: (1) enemy intent bubble needs compact icon+number format with expandable detail, (2) AP orb is invisible due to negative top offset, (3) starter deck needs StS-style composition (heavy attack+shield, few utility), (4) fact repetition within runs, (5) card hand needs to sit 15% higher, (6) card playable glow too subtle, (7) add orange glow for combo-eligible cards.

## Deliverables

Total: 5 files edited, 1 verification gate

## Tasks

### Section A: Enemy Intent — Compact Icon + Numbers

- [x] **A.1** Edit `src/ui/components/CardCombatOverlay.svelte` — change the intent bubble summary to show: intent icon + compact notation. For attack: "⚔️ 5" (icon + damage). For debuff like weakness: "💀 1×2" (icon + stacks × turns). For defend: "🛡 3". For heal: "💚 5". For buff: "⬆ 2"
  - Acceptance: collapsed intent shows icon + compact number
- [x] **A.2** Edit `src/ui/components/CardCombatOverlay.svelte` — when intent bubble is expanded (clicked), show full natural language: "Attacks for 5 damage", "Applies 1 Weakness for 2 turns", "Gains 3 Block", "Heals 5 HP", "Buffs self for 2 turns"
  - Acceptance: expanded view shows clear descriptive text

### Section B: Fix AP Orb — Restore Visibility

- [x] **B.1** Edit `src/ui/components/CardCombatOverlay.svelte` CSS — change `.ap-orb` `top` from `calc(-60px + var(--safe-top))` to `calc(8px + var(--safe-top))` to restore visibility (the -60px pushes it off-screen when --safe-top is 0 on browsers)
  - Acceptance: AP orb visible in top-left during combat on both mobile and browser

### Section C: Starter Deck — StS-Style Composition

- [x] **C.1** Edit `src/services/cardTypeAllocator.ts` — change card type weights to be more StS-like: attack 40%, shield 35%, buff 8%, debuff 7%, utility 7%, wild 3%
  - Acceptance: pool is dominated by attack+shield (75%), with fewer utility/buff/debuff cards
- [x] **C.2** Edit `src/services/cardTypeAllocator.ts` — ensure the first 15 cards drawn (starter hand range) are heavily weighted: ~7 attack, ~5 shield, ~2 utility/buff, ~1 debuff
  - Acceptance: early encounters feel like StS where you mostly attack and block

### Section D: Fact Pool — Reduce Repetition

- [x] **D.1** Edit `src/services/deckManager.ts` or `src/services/runPoolBuilder.ts` — increase the fact cooldown from 1-3 encounters to 3-5 encounters after a fact is answered
  - Acceptance: answered facts don't reappear for at least 3 encounters
- [x] **D.2** Verify that no duplicate base-facts can appear in the same 5-card hand draw — read the dedup logic and add a console.warn if it ever falls through to a duplicate
  - Acceptance: no duplicate facts in the same hand

### Section E: Card Hand — Raise 15% Higher

- [x] **E.1** Edit `src/ui/components/CardHand.svelte` CSS — change `.card-hand-container` `bottom` from `calc(40px + 4vh)` to `calc(40px + 12vh)` (raises hand ~8vh higher, roughly 15% of viewport)
  - Acceptance: cards sit noticeably higher, still above END TURN button

### Section F: Card Glow — Bright Green for Playable, Orange for Combo

- [x] **F.1** Edit `src/ui/components/CardHand.svelte` CSS — change `.card-playable` filter to: `filter: drop-shadow(0 0 4px rgba(34, 197, 94, 0.9)) drop-shadow(0 0 10px rgba(34, 197, 94, 0.4))` — bright tight inner glow + soft outer fade
  - Acceptance: green glow is clearly visible around playable cards
- [x] **F.2** Edit `src/ui/components/CardHand.svelte` CSS — change `.card-has-frame.card-playable` similarly with same bright glow values
  - Acceptance: framed playable cards have visible green contour glow
- [x] **F.3** Edit `src/ui/components/CardHand.svelte` — add a new CSS class `.card-combo` with an orange glow: `filter: drop-shadow(0 0 4px rgba(251, 191, 36, 0.9)) drop-shadow(0 0 10px rgba(251, 191, 36, 0.4))`
  - Acceptance: combo-eligible cards get orange contour glow
- [x] **F.4** Edit `src/ui/components/CardHand.svelte` template — add `class:card-combo={comboMultiplier > 1 && !insufficientAp && !isSelected && !isOther}` to the card button
  - Acceptance: when combo multiplier > 1, playable cards glow orange instead of green

### Section G: Verification Gate

- [x] **G.1** Run `npm run typecheck` — 0 errors
  - Acceptance: 0 ERRORS
- [x] **G.2** Run `npm run build` — succeeds
  - Acceptance: build completes
- [x] **G.3** Playwright verify — AP orb visible in combat
  - Acceptance: AP number visible top-left
- [x] **G.4** Playwright verify — card glow visible on playable cards
  - Acceptance: green glow clearly visible around card edges
- [x] **G.5** Playwright verify — intent shows compact icon+number
  - Acceptance: intent bubble shows icon + number, not just text

## Files Affected

| File | Action | Task |
|------|--------|------|
| `src/ui/components/CardCombatOverlay.svelte` | EDIT | A.1-A.2, B.1 |
| `src/services/cardTypeAllocator.ts` | EDIT | C.1-C.2 |
| `src/services/deckManager.ts` | EDIT | D.1-D.2 |
| `src/ui/components/CardHand.svelte` | EDIT | E.1, F.1-F.4 |
