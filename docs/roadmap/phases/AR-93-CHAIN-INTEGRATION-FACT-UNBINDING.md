# AR-93: Chain System Integration + Fact Unbinding

**Status:** In Progress
**Created:** 2026-03-18

## Overview

Wire the orphaned chain system into combat, remove permanent fact-to-card binding (`boundFactId`), and update reward/shop UI. Chain types are already assigned to card slots correctly — this AR connects the multiplier, unbinds facts for per-draw FSRS shuffling, and adds missing UI elements.

## Tasks

### Section A: Remove boundFactId — Facts Shuffle Per Draw

- [x] **A.1** In `src/services/deckManager.ts` `drawHand()`: Remove the `boundFactId` path (lines ~224-232). ALL cards should use per-draw FSRS fact shuffling. The "legacy" path is now the ONLY path.
  - Acceptance: `drawHand()` never reads `card.boundFactId` — facts are always drawn from the pool per draw

- [x] **A.2** In `src/data/card-types.ts`: Remove `boundFactId` from the `Card` interface (or mark deprecated). Keep `factId` (set per draw).
  - Acceptance: No code references `boundFactId` for fact selection

- [x] **A.3** In `src/services/runPoolBuilder.ts` or `cardFactory.ts`: Stop setting `boundFactId` when creating cards.
  - Acceptance: New cards never have `boundFactId` set

- [x] **A.4** For **seeded runs**: Verify that the seeded RNG fork `'facts'` produces identical fact-to-slot pairings per draw WITHOUT `boundFactId`. The `seededShuffled()` of the fact pool + draw pile order should produce identical hands for identical seeds.
  - Acceptance: `drawHand()` uses `seededShuffled(getRunRng('facts'), factsToUse)` — verified in code

- [x] **A.5** Update `src/services/runSaveService.ts`: Remove `boundFactId` from serialization/deserialization if present.
  - Acceptance: `boundFactId` was never explicitly serialized in runSaveService; it flows through card objects which are JSON-serialized as-is. Old saves with `boundFactId` on cards will load fine (field ignored by drawHand).

- [x] **A.6** Search entire codebase for remaining `boundFactId` references and remove or update them.
  - Acceptance: Only deprecated type comment in `card-types.ts` and updated `CardRewardScreen.svelte` remain (removed `boundFactId ?? factId` fallback). `docs/GAME_DESIGN.md` updated.

### Section B: Wire Chain Into Combat

- [ ] **B.1** In `src/services/turnManager.ts`: At turn start, call `resetChain()` from chainSystem.ts.
  - Acceptance: Chain state resets to `{ chainType: null, length: 0 }` each turn

- [ ] **B.2** In `src/services/turnManager.ts` or the card play action: After a correct Charge play, call `extendOrResetChain(card.chainType)` and capture the returned chain multiplier.
  - Acceptance: Playing same-chainType cards consecutively increments chain length

- [ ] **B.3** In `src/services/cardEffectResolver.ts`: Apply the chain multiplier to card effect values, stacking with the existing combo multiplier.
  - Acceptance: A 3-chain gives 1.7× on top of combo multiplier

- [ ] **B.4** On Quick Play or wrong Charge answer: Reset chain (call `resetChain()` or let `extendOrResetChain` handle the break).
  - Acceptance: Quick Play and wrong answers break the chain

- [ ] **B.5** Update chain counter display (ComboCounter or a new ChainCounter component) to show "{Name} Chain x{length}" with chain type color.
  - Acceptance: Chain counter visible during combat when chain length ≥ 2

### Section C: Reward Screen — Chain Badge, No Fact Preview

- [ ] **C.1** In `src/ui/components/CardRewardScreen.svelte`: Remove the fact preview text (60-char quiz question).
  - Acceptance: Reward cards don't show quiz content

- [ ] **C.2** Add chain type badge to each reward card: small pill with chain type name + colored indicator.
  - Style: background = chain color at 20% opacity, text = chain type name in chain color, border = 1px solid chain color at 40%
  - Acceptance: Each reward card shows its chain type badge (e.g., "Jade", "Crimson")

- [ ] **C.3** In `src/services/rewardGenerator.ts`: Verify reward generation enforces at least 2 distinct chain types across 3 options (already partially implemented — confirm it works).
  - Acceptance: Reward options never have all 3 cards with the same chainType

### Section D: Draw Smoothing

- [ ] **D.1** In `src/services/deckManager.ts` after drawing a hand: Check if any chainType appears 2+ times. If not, swap one card to bottom of draw pile and draw a replacement preferring a matching chainType. Max 1 swap per draw.
  - Acceptance: Hands almost always have at least one chainType pair. Smoothing fires rarely (~15% of draws).

### Section E: Shop Chain Composition

- [ ] **E.1** In the shop/card removal UI: Show chain composition summary (e.g., "Obsidian x4, Crimson x3, Azure x2...") when viewing removable cards.
  - Acceptance: Player can see how removal affects their chain distribution

### Section F: Verification

- [ ] **F.1** `npm run typecheck` — 0 errors
- [ ] **F.2** `npm run build` — succeeds
- [ ] **F.3** `npx vitest run` — all tests pass (update chain tests if needed)
- [ ] **F.4** Update `docs/GAME_DESIGN.md` — chain system section reflects integration, fact unbinding, reward changes
- [ ] **F.5** Update `docs/ARCHITECTURE.md` — document chain flow in combat

## Files Affected

| File | Action | Task |
|------|--------|------|
| `src/services/deckManager.ts` | EDIT | A.1, D.1 |
| `src/data/card-types.ts` | EDIT | A.2 |
| `src/services/runPoolBuilder.ts` | EDIT | A.3 |
| `src/services/cardFactory.ts` | EDIT | A.3 |
| `src/services/runSaveService.ts` | EDIT | A.5 |
| `src/services/turnManager.ts` | EDIT | B.1, B.2, B.4 |
| `src/services/cardEffectResolver.ts` | EDIT | B.3 |
| `src/ui/components/ComboCounter.svelte` (or new) | EDIT | B.5 |
| `src/ui/components/CardRewardScreen.svelte` | EDIT | C.1, C.2 |
| `src/services/rewardGenerator.ts` | VERIFY | C.3 |
| Shop component | EDIT | E.1 |
| `docs/GAME_DESIGN.md` | EDIT | F.4 |
| `docs/ARCHITECTURE.md` | EDIT | F.5 |
