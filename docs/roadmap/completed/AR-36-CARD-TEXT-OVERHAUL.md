# AR-36: Card Text Overhaul — Slay the Spire Style

**Status:** Complete
**Created:** 2026-03-15
**Depends on:** AR-35 (completed)

## Overview

Overhaul card text from cryptic shorthand ("9 block +50%") to Slay the Spire-style natural language ("Gain **9** Block. +**5** below 50% HP"). Numbers are dynamically computed. Keywords (Block, Poison, Weakness, etc.) are bold and tappable on expanded view to show explanatory popups. Card size reduced to 0.30, AP gem repositioned into frame gemstone, parchment text area expanded, and card glow changed from box-shadow to contour-hugging drop-shadow.

## Deliverables

Total: 3 new files, 3 major edits, 8 verification steps

## Tasks

### Section A: Card Size Adjustment

- [x] **A.1** Edit `src/ui/components/CardHand.svelte` CSS — change `--card-w` from `calc(var(--gw, 390px) * 0.38)` to `calc(var(--gw, 390px) * 0.30)`
  - Acceptance: CSS variable updated, no other changes in this edit
- [x] **A.2** Edit `src/ui/components/CardHand.svelte` JS — change `cardW` from `viewportWidth * 0.38` to `viewportWidth * 0.30` in the `cardSpacing` derived block
  - Acceptance: JS calculation matches CSS
- [x] **A.3** Edit `src/ui/components/CardHand.svelte` JS — change card overlap from `cardW * 0.65` to `cardW * 0.58` in `cardSpacing` derived block
  - Acceptance: 5 cards fit on 390px viewport without overflowing edges

### Section B: Card Description Service — Structured Rich Text

- [x] **B.1** Create type `CardDescPart` in `src/services/cardDescriptionService.ts` — union type with segments: `{ type: 'text', value: string }`, `{ type: 'number', value: string }`, `{ type: 'keyword', value: string, keywordId: string }`, `{ type: 'conditional-number', value: string, active: boolean }`
  - Acceptance: type exported and compiles clean
- [x] **B.2** Create function `getCardDescriptionParts(card: Card, gameState?: { playerHpPercent?: number, enemyHpPercent?: number }): CardDescPart[]` in `src/services/cardDescriptionService.ts`
  - Acceptance: function exported, returns array of parts for any Card
- [x] **B.3** Implement natural language templates for all attack mechanics in `getCardDescriptionParts`: strike, multi_hit, heavy_strike, piercing, reckless, execute, lifetap
  - Acceptance: each returns correct parts with numbers and keywords (e.g., strike → `[text "Deal ", number "{power}", text " damage"]`)
- [x] **B.4** Implement natural language templates for all shield mechanics: block, thorns, fortify, parry, brace, overheal, emergency
  - Acceptance: each returns correct parts; overheal/emergency include conditional-number for HP threshold bonuses
- [x] **B.5** Implement natural language templates for all buff mechanics: empower, quicken, double_strike, focus
  - Acceptance: each returns correct parts
- [x] **B.6** Implement natural language templates for all debuff mechanics: weaken, expose, slow, hex
  - Acceptance: hex returns keyword "Poison"; weaken returns keyword "Weakness"; expose returns keyword "Vulnerable"
- [x] **B.7** Implement natural language templates for all utility mechanics: scout, recycle, foresight, transmute, cleanse, immunity
  - Acceptance: each returns correct parts
- [x] **B.8** Implement natural language templates for all wild mechanics: mirror, adapt, overclock
  - Acceptance: each returns correct parts
- [x] **B.9** Implement fallback for unknown mechanics and generic card types in `getCardDescriptionParts`
  - Acceptance: function never throws, always returns at least one text part
- [x] **B.10** Keep existing `getShortCardDescription()` and `getDetailedCardDescription()` unchanged for backward compatibility
  - Acceptance: no existing function signatures changed

### Section C: Keyword Definitions

- [x] **C.1** Create `src/data/keywords.ts` — export `KEYWORD_DEFINITIONS: Record<string, { name: string, description: string }>` with entries for: block, poison, weakness, vulnerable, thorns, persistent_block, lifetap, AP
  - Acceptance: file compiles, at least 8 keywords defined
- [x] **C.2** Export `getKeywordDefinition(id: string): { name: string, description: string } | undefined` from `src/data/keywords.ts`
  - Acceptance: function returns definition for known keywords, undefined for unknown

### Section D: Rich Text Rendering on Card Hand

- [x] **D.1** Edit `src/ui/components/CardHand.svelte` — import `getCardDescriptionParts` and `CardDescPart` from cardDescriptionService
  - Acceptance: import added, no errors
- [x] **D.2** Edit `src/ui/components/CardHand.svelte` — replace `.card-parchment-text` inner content (the `effect-value` span + `effect-desc` span) with an `{#each}` loop over `getCardDescriptionParts(card)` that renders: `span.desc-number` for number parts, `span.desc-keyword` (bold) for keyword parts, `span.desc-conditional` (green if active, gray if not) for conditional-number parts, plain text for text parts
  - Acceptance: card parchment shows natural language like "Gain **9** Block"
- [x] **D.3** Edit `src/ui/components/CardHand.svelte` CSS — change `.card-parchment-text` from `bottom: 4%; left: 10%; right: 10%; height: 28%` to `top: 66%; bottom: 7%; left: 8%; right: 8%` (remove height, use top/bottom)
  - Acceptance: text container spans the full parchment area of the frame
- [x] **D.4** Edit `src/ui/components/CardHand.svelte` CSS — add centering to `.card-parchment-text`: `display: flex; align-items: center; justify-content: center; text-align: center; flex-wrap: wrap;`
  - Acceptance: text is centered vertically and horizontally in the parchment area
- [x] **D.5** Edit `src/ui/components/CardHand.svelte` CSS — set base font size on `.card-parchment-text` to `calc(var(--card-w) * 0.095)` with `line-height: 1.3`
  - Acceptance: text is readable on 0.30-width cards
- [x] **D.6** Edit `src/ui/components/CardHand.svelte` CSS — add `.desc-number` style: `font-weight: 900; font-family: 'Cinzel', 'Georgia', serif; color: #3d3428;`
  - Acceptance: numbers stand out visually from surrounding text
- [x] **D.7** Edit `src/ui/components/CardHand.svelte` CSS — add `.desc-keyword` style: `font-weight: 800;`
  - Acceptance: keywords are bold
- [x] **D.8** Edit `src/ui/components/CardHand.svelte` CSS — add `.desc-conditional` style: default `color: #9ca3af;` (gray), and `.desc-conditional.active` with `color: #22c55e; font-weight: 900;` (green)
  - Acceptance: conditional values show gray when inactive, green when active
- [x] **D.9** Remove the old separate `.effect-value` large number rendering from framed card parchment area — it's now part of the natural language text
  - Acceptance: no duplicate number display on cards

### Section E: AP Gem Repositioning

- [x] **E.1** Edit `src/ui/components/CardHand.svelte` CSS — change `.ap-gem` from `top: 3.5%; left: 5.5%` to `top: 1%; left: 2.5%`
  - Acceptance: AP cost number sits visually inside the gemstone on the card frame art

### Section F: Keyword Popup Component

- [x] **F.1** Create `src/ui/components/KeywordPopup.svelte` — a small popup that shows keyword name + description, with a close/dismiss behavior (tap outside or X button)
  - Acceptance: component compiles, accepts `keywordId: string` and `x: number, y: number` props
- [x] **F.2** Edit `src/ui/components/CardExpanded.svelte` — render the card description using `getCardDescriptionParts`, with keyword parts wrapped in tappable `<button>` elements
  - Acceptance: keywords are bold and tappable in expanded view
- [x] **F.3** Edit `src/ui/components/CardExpanded.svelte` — on keyword tap, show `KeywordPopup` positioned near the tapped keyword
  - Acceptance: tapping "Block" shows a popup: "Block — Absorbs incoming damage before HP. Resets at start of your turn."
- [x] **F.4** Edit `src/ui/components/CardExpanded.svelte` — popup dismisses on tap outside or close button
  - Acceptance: popup goes away cleanly without interfering with card interaction

### Section G: Contour-Hugging Card Glow

- [x] **G.1** Edit `src/ui/components/CardHand.svelte` CSS — change `.card-playable` from `box-shadow: 0 0 8px rgba(34, 197, 94, 0.5), 0 4px 8px rgba(0, 0, 0, 0.4)` to `filter: drop-shadow(0 0 6px rgba(34, 197, 94, 0.6)) drop-shadow(0 4px 8px rgba(0, 0, 0, 0.4))`
  - Acceptance: green glow follows card pixel contour, not rectangle
- [x] **G.2** Edit `src/ui/components/CardHand.svelte` CSS — change `.card-has-frame.card-playable` from `box-shadow: 0 0 10px rgba(34, 197, 94, 0.55), 0 4px 12px rgba(0, 0, 0, 0.5)` to `filter: drop-shadow(0 0 8px rgba(34, 197, 94, 0.6)) drop-shadow(0 4px 12px rgba(0, 0, 0, 0.5))`
  - Acceptance: framed card glow follows contour
- [x] **G.3** Edit `src/ui/components/CardHand.svelte` CSS — change `.drag-ready` from `box-shadow: ...` to `filter: drop-shadow(0 0 12px rgba(34, 197, 94, 0.7)) drop-shadow(0 0 24px rgba(34, 197, 94, 0.3))`
  - Acceptance: drag-ready glow follows contour
- [x] **G.4** Edit `src/ui/components/CardHand.svelte` CSS — change `.tier-2a` from `box-shadow` to `filter: drop-shadow(0 0 6px rgba(192, 192, 192, 0.45))`
  - Acceptance: tier 2a glow follows contour
- [x] **G.5** Edit `src/ui/components/CardHand.svelte` CSS — change `.tier-2b` from `box-shadow` to `filter: drop-shadow(0 0 10px rgba(192, 192, 192, 0.8))`
  - Acceptance: tier 2b glow follows contour
- [x] **G.6** Edit `src/ui/components/CardHand.svelte` CSS — change `.tier-3` from `box-shadow` to `filter: drop-shadow(0 0 12px rgba(255, 215, 0, 0.8))`
  - Acceptance: tier 3 gold glow follows contour

### Section H: Verification Gate

- [x] **H.1** Run `npm run typecheck` — 0 errors
  - Acceptance: exit code 0, 0 ERRORS in output
- [x] **H.2** Run `npm run build` — succeeds
  - Acceptance: "built in" message, no build errors
- [x] **H.3** Run `npx vitest run` — all tests pass
  - Acceptance: no test failures
- [x] **H.4** Playwright screenshot — cards show natural language text in parchment area
  - Acceptance: visible text like "Gain 9 Block" not "9 block +50%"
- [x] **H.5** Playwright screenshot — AP gem sits inside frame gemstone
  - Acceptance: number overlaps the red gem in the frame art
- [x] **H.6** Playwright screenshot — card glow follows contour
  - Acceptance: green glow is not rectangular
- [x] **H.7** Playwright verify — keyword popup works on expanded card
  - Acceptance: tap keyword → popup appears → tap outside → popup dismisses
- [x] **H.8** Playwright screenshot — text centered in full parchment area
  - Acceptance: text uses the full height of the parchment, not just bottom half

## Files Affected

| File | Action | Task |
|------|--------|------|
| `src/services/cardDescriptionService.ts` | EDIT | B.1-B.10 |
| `src/data/keywords.ts` | NEW | C.1-C.2 |
| `src/ui/components/CardHand.svelte` | EDIT | A.1-A.3, D.1-D.9, E.1, G.1-G.6 |
| `src/ui/components/KeywordPopup.svelte` | NEW | F.1 |
| `src/ui/components/CardExpanded.svelte` | EDIT | F.2-F.4 |
