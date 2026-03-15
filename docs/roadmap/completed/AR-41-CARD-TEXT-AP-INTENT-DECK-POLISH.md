# AR-41: Card Text Readability, AP Fix, Intent Style, Starter Deck Mechanics

**Status:** Complete
**Created:** 2026-03-15
**Depends on:** AR-40 (completed)

## Overview

Fix 6 playtesting issues: (1) card parchment text is badly readable — needs thicker font with dark outline, (2) text segments look stitched together with bad spacing, (3) AP is capped to 2 on first encounters due to onboarding check — remove this cap, (4) intent value has ugly square background, needs styled number, (5) AP orb should sit just above the leftmost card, (6) starter deck gives too many exotic mechanics — should be 60% strike/block with rare exotics.

## Deliverables

Total: 5 files edited, 4 verification steps

## Tasks

### Section A: Card Parchment Text Readability

- [x] **A.1** Edit `src/ui/components/CardHand.svelte` CSS — change `.card-parchment-text` font to: `font-family: 'Georgia', serif; font-weight: 700; color: #2a1f14; text-shadow: -1px -1px 0 rgba(0,0,0,0.3), 1px -1px 0 rgba(0,0,0,0.3), -1px 1px 0 rgba(0,0,0,0.3), 1px 1px 0 rgba(0,0,0,0.3), 0 0 4px rgba(0,0,0,0.2);` — bold serif with dark text stroke
  - Acceptance: card text is thick, readable, has subtle dark outline
- [x] **A.2** Edit `src/ui/components/CardHand.svelte` CSS — change `.desc-number` to: `font-weight: 900; color: #1a1208; text-shadow: inherit;` — numbers are extra bold and dark
  - Acceptance: numbers stand out clearly from surrounding text
- [x] **A.3** Edit `src/ui/components/CardHand.svelte` CSS — change `.desc-keyword` to: `font-weight: 900;` — keywords match number boldness
  - Acceptance: keywords are clearly bold

### Section B: Fix Text Spacing — Add Proper Word Gaps

- [x] **B.1** Edit `src/services/cardDescriptionService.ts` — in `getCardDescriptionParts()`, ensure all text parts include proper spacing. Currently parts like `txt('Deal ')` and `txt(' damage')` have spaces but they may collapse in flex layout. Change the rendering approach: instead of relying on whitespace in text parts, add `\u00A0` (non-breaking space) at word boundaries, OR change the parchment container from `flex-wrap: wrap` to a simple `display: block; text-align: center;` with inline spans
  - Acceptance: text reads as natural sentence with proper word spacing
- [x] **B.2** Edit `src/ui/components/CardHand.svelte` CSS — change `.card-parchment-text` from `display: flex; flex-wrap: wrap; align-items: center; justify-content: center;` to `display: flex; align-items: center; justify-content: center; gap: 0; word-spacing: normal;` — or alternatively use inline-block spans. The issue is flex children collapse whitespace.
  - Acceptance: "Gain 9 Block" reads as a natural sentence, not "Gain9Block"

### Section C: Fix AP — Remove Onboarding Cap

- [x] **C.1** Edit `src/services/encounterBridge.ts` — remove or disable the AP cap at lines 411-414 that restricts AP to 2 during floor 1 encounters 1-2 when onboarding is incomplete. The user should always start with 3 AP.
  - Acceptance: first combat encounter starts with 3 AP regardless of onboarding state

### Section D: Intent Value Style — Remove Square, Nicer Font

- [x] **D.1** Edit `src/ui/components/CardCombatOverlay.svelte` CSS — change `.intent-value` from current style (has `background: rgba(0,0,0,0.3); border-radius: 4px; padding: 2px 8px; min-width: 32px;`) to: remove background and padding, increase font-size to 22px, add dark text-shadow matching intent color: `font-size: 22px; font-weight: 900; font-family: 'Georgia', serif; text-shadow: -1px -1px 0 rgba(0,0,0,0.5), 1px -1px 0 rgba(0,0,0,0.5), -1px 1px 0 rgba(0,0,0,0.5), 1px 1px 0 rgba(0,0,0,0.5); background: none; padding: 0; min-width: 0; border-radius: 0;`
  - Acceptance: intent number is large serif with dark outline, no square background

### Section E: AP Orb — Position Just Above Cards

- [x] **E.1** Edit `src/ui/components/CardCombatOverlay.svelte` CSS — change `.ap-orb` from `top: 38%; left: 12px;` to `bottom: calc(42vh); left: 12px;` — positions it just above the card hand area (cards are at `bottom: calc(40px + 12vh)` in CardHand). Using bottom-relative positioning ties it to the card area.
  - Acceptance: AP orb sits visually just above the leftmost card

### Section F: Starter Deck — Mostly Strike and Block

- [x] **F.1** Edit `src/services/runPoolBuilder.ts` — change `pickMechanic()` to weight basic mechanics heavily. For attack type: Strike should have 60% chance, all others share the remaining 40%. For shield type: Block should have 60% chance, all others share 40%. For other types, keep uniform random.
  - Acceptance: ~60% of attack cards are Strike, ~60% of shield cards are Block. Player starts with mostly basic cards.

### Section G: Verification Gate

- [x] **G.1** Run `npm run typecheck` — 0 errors
  - Acceptance: 0 ERRORS
- [x] **G.2** Run `npm run build` — succeeds
  - Acceptance: build completes
- [x] **G.3** Playwright verify — card text readable with dark outline
  - Acceptance: text is clearly readable on parchment
- [x] **G.4** Playwright verify — AP shows 3 on first encounter
  - Acceptance: AP orb displays "3"

## Files Affected

| File | Action | Task |
|------|--------|------|
| `src/ui/components/CardHand.svelte` | EDIT | A.1-A.3, B.2 |
| `src/services/cardDescriptionService.ts` | EDIT | B.1 |
| `src/services/encounterBridge.ts` | EDIT | C.1 |
| `src/ui/components/CardCombatOverlay.svelte` | EDIT | D.1, E.1 |
| `src/services/runPoolBuilder.ts` | EDIT | F.1 |
