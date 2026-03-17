# AR-70: Chain Types Phase 1 — Random Even Distribution

## Overview

Replace the `categoryL2`-based chain system with 6 named chain types assigned evenly at run start. Facts bind to card slots persistently for the entire run (no more per-draw shuffling). Chain type is visually communicated via AP cost text color and top-left glow, and is visible on card reward screens for chain-aware deckbuilding.

**Source spec:** `docs/RESEARCH/Chaining/CHAIN-TYPES-IMPLEMENTATION.md`

**Complexity:** Large — touches core combat loop, deck building, card rendering, reward screen, shop, relics, save/load.

**Dependencies:** None (replaces existing chain system in-place).

## Sub-Steps

### Phase A: Data & Types Foundation

- [x] **A1. Define chain type constants**
  - File: NEW `src/data/chainTypes.ts`
  - Create `CHAIN_TYPES` array with 6 entries: `{ index, name, hexColor, glowColor }`
  - Export helper functions: `getChainTypeName(index)`, `getChainTypeColor(index)`, `getChainTypeGlowColor(index)`
  - Acceptance: File exists, exports correct types, all 6 entries match spec (Obsidian, Crimson, Azure, Amber, Violet, Jade)

- [x] **A2. Add `chainType` to Card interface**
  - File: `src/data/card-types.ts`
  - Add `chainType?: number` to the `Card` interface (runtime-only, 0-5)
  - Acceptance: TypeScript compiles, no downstream type errors

- [x] **A3. Add `boundFactId` to Card interface**
  - File: `src/data/card-types.ts`
  - Add `boundFactId?: string` to the `Card` interface (the persistent fact binding)
  - This is separate from `factId` which currently gets reassigned per draw
  - Acceptance: TypeScript compiles

**CHECKPOINT A:** `npm run typecheck` passes. No runtime changes yet.

---

### Phase B: Fact-to-Card Binding at Run Start

- [x] **B1. Modify `buildRunPool()` to bind facts to cards**
  - File: `src/services/runPoolBuilder.ts`
  - After cards are created and mechanics assigned, assign one fact per card slot permanently
  - Set `card.boundFactId = fact.id` on each card
  - Assign `card.chainType = shuffledIndex % 6` (Fisher-Yates shuffle facts first, then mod 6)
  - Ensure even distribution: max difference between any two chain type groups = 1
  - Acceptance: Every card in the pool has a `boundFactId` and `chainType` (0-5). Distribution is even.

- [x] **B2. Modify `drawHand()` to use bound facts instead of re-pairing**
  - File: `src/services/deckManager.ts`
  - Remove the per-draw fact assignment logic (`pickCandidateFactId()` calls)
  - When a card is drawn, use `card.boundFactId` as its `factId` directly
  - Keep the Hand Composition Guard (≥1 attack card)
  - Acceptance: Cards drawn always have their bound fact. No per-draw fact shuffling.

- [x] **B3. Handle fact cooldown with bound cards**
  - File: `src/services/deckManager.ts`
  - Choose the simpler approach: cards with cooled-down facts sink to bottom of draw pile
  - When shuffling draw pile, move cards whose bound fact is on cooldown to the end
  - If ALL cards have cooled-down facts (edge case), draw normally anyway
  - Acceptance: Cooled-down facts are deprioritized but never cause empty hands.

- [x] **B4. Update card reward generation for bound facts**
  - File: `src/services/rewardGenerator.ts`
  - Each reward card must come with a pre-bound fact and chainType
  - Enforce ≥2 distinct chain types across the 3 reward options
  - If all 3 share same chainType, re-roll one card's fact (max 1 re-roll)
  - Acceptance: Reward cards always have boundFactId and chainType. ≥2 distinct types in options.

**CHECKPOINT B:** `npm run typecheck` passes. Run unit tests: `npx vitest run`. Fix any failures caused by binding changes. Manual test: start a run, verify cards have stable facts across multiple draws in the same encounter.

---

### Phase C: Chain Resolution Switchover

- [x] **C1. Replace `categoryL2` chain check with `chainType`**
  - File: `src/services/chainSystem.ts`
  - In `extendOrResetChain()`: change `categoryL2 === _chain.categoryL2` to `chainType === _chain.chainType`
  - Accept `chainType: number` parameter instead of / in addition to `categoryL2`
  - Cards without chainType (undefined) always break/reset chain
  - Acceptance: Chain builds when consecutive Charge plays share `chainType`, not `categoryL2`.

- [x] **C2. Update callers to pass `chainType`**
  - Files: `src/services/turnManager.ts`, `src/services/encounterBridge.ts`, or wherever `extendOrResetChain()` is called
  - Pass `card.chainType` from the played card to the chain system
  - Acceptance: Chain resolution works end-to-end with chainType.

- [x] **C3. Update chain counter display**
  - File: `src/ui/components/CardCombatOverlay.svelte` or `ComboCounter.svelte`
  - Chain counter format: `"{Name} Chain x{length}"` (e.g., "Jade Chain x3")
  - Text color = chain type hex color
  - Import `getChainTypeName()` and `getChainTypeColor()` from chainTypes.ts
  - Acceptance: Chain counter shows chain type name and uses correct color.

**CHECKPOINT C:** `npm run typecheck` && `npx vitest run`. Manually test: play 2 cards of same chain type → chain builds. Play different chain type → chain resets. Chain counter shows correct name and color.

---

### Phase D: Visual — AP Cost Color & Chain Glow

- [x] **D1. AP cost text color = chain type color**
  - File: `src/ui/components/CardHand.svelte`
  - Change AP badge text color to `getChainTypeColor(card.chainType)`
  - Add `textShadow: '0 0 2px rgba(0,0,0,0.6)'` for readability
  - Apply to all card states: in hand, selected, committed
  - Acceptance: AP cost text matches chain type color. Readable on all backgrounds.

- [x] **D2. Top-left chain type glow on cards**
  - File: `src/ui/components/CardHand.svelte`
  - Add radial gradient glow element, top-left corner (~12px from edges, ~28-32px diameter)
  - Color: chain type glow color (30% opacity)
  - Layer: behind card content, above card background
  - Acceptance: Glow visible on all cards, correct color per chain type.

- [x] **D3. Pulse animation for matching chain types**
  - File: `src/ui/components/CardHand.svelte`
  - When 2+ cards in hand share a `chainType`, their glows pulse in sync
  - Opacity oscillation: 30% → 60% over 1.5s cycle (sine wave via CSS animation)
  - Non-matching cards stay static at 30%
  - All cards of same chainType share animation phase (use shared CSS class or animation-delay: 0)
  - Acceptance: Matching cards pulse together. Non-matching stay static. Animation is smooth.

**CHECKPOINT D:** Visual inspection via Playwright screenshot. Cards show colored AP text and glowing corners. Matching chain types pulse together.

---

### Phase E: Card Reward Screen Updates

- [x] **E1. Show chain type badge on reward cards**
  - File: `src/ui/components/CardRewardScreen.svelte`
  - Add small pill/tag (top-right or bottom-left of reward card)
  - Background: chain type color at 20% opacity
  - Text: chain type name (e.g., "Obsidian") in chain type color
  - Border: 1px solid chain type color at 40% opacity
  - Acceptance: Badge visible on all 3 reward options with correct colors.

- [x] **E2. Show bound fact preview on reward cards**
  - File: `src/ui/components/CardRewardScreen.svelte`
  - Display the quiz question or fact statement (truncated to ~60 chars if needed)
  - Smaller font below mechanic name
  - Acceptance: Fact preview visible on reward cards, doesn't overflow layout.

**CHECKPOINT E:** Playwright screenshot of reward screen. Badge and fact preview visible on all 3 options. At least 2 distinct chain type colors shown.

---

### Phase F: Draw Smoothing

- [x] **F1. Implement draw smoothing in drawHand()**
  - File: `src/services/deckManager.ts`
  - After drawing a hand, count chainType occurrences
  - If NO chainType appears 2+ times:
    - Pick one card in hand
    - Swap it to bottom of draw pile
    - Draw replacement, preferring card whose chainType matches any card already in hand
    - Max 1 swap per draw
  - If no valid replacement exists, skip smoothing
  - Acceptance: Draw smoothing fires only when zero pairs exist. Max 1 swap. Chain pair probability approaches ~95%+.

**CHECKPOINT F:** Unit test: draw 1000 hands from a 20-card pool, verify <5% of hands have zero chain pairs after smoothing.

---

### Phase G: Shop Card Removal Updates

- [x] **G1. Show chain type indicator on removable cards in shop**
  - File: Shop component (find exact file — likely in `src/ui/components/`)
  - Display chain type badge (same style as reward screen) on each removable card
  - Acceptance: Chain type visible when browsing cards for removal.

- [x] **G2. Show chain composition summary in shop**
  - File: Shop component
  - Above/below card list, show summary: "Obsidian x4, Crimson x3, Azure x2..."
  - Only show types that exist in the deck
  - Use chain type colors for each entry
  - Acceptance: Summary reflects actual deck composition. Updates when cards are removed.

- [x] **G3. Card removal removes bound fact from pool**
  - File: `src/services/shopService.ts` or wherever card removal is handled
  - When a card is removed, also remove its `boundFactId` from the run's fact pool
  - Acceptance: Removed card's fact never appears again in the run.

**CHECKPOINT G:** Manual test: enter shop, see chain composition. Remove a card. Composition updates. Removed fact doesn't reappear.

---

### Phase H: Relic Compatibility

- [x] **H1. Update Tag Magnet to use chainType**
  - File: Wherever Tag Magnet effect is applied (likely `src/services/deckManager.ts` or relic resolver)
  - Change draw bias from matching `categoryL2` to matching `chainType` of last played card
  - +30% draw probability for matching chainType
  - Acceptance: Tag Magnet biases draws toward same chainType, not categoryL2.

- [x] **H2. Verify chain-length relics still work**
  - Chain Reactor, Resonance Crystal, Echo Chamber, Prismatic Shard
  - These trigger on chain LENGTH, not chain type identity — should work unchanged
  - Run through each relic's trigger condition and verify no references to categoryL2
  - Acceptance: All chain relics trigger correctly with new system.

**CHECKPOINT H:** Unit tests pass for relic effects. Manual test: equip Tag Magnet, play a card, verify next draw biases toward same chain type.

---

### Phase I: Save/Load & Run Persistence

- [x] **I1. Persist boundFactId and chainType in run save**
  - File: `src/services/runSaveService.ts`
  - Ensure `card.boundFactId` and `card.chainType` are serialized when saving run state
  - Ensure they're restored when loading a saved run
  - Acceptance: Save → quit → resume: cards have same bound facts and chain types.

- [x] **I2. Persist chain state across encounters**
  - Chain type assignments persist for the entire run (they already should if stored on Card)
  - Verify new cards from rewards keep their assignments across encounters
  - Acceptance: Chain types stable across multiple encounters in a saved/resumed run.

**CHECKPOINT I:** Save a run mid-combat. Reload. Verify all cards have correct boundFactId, chainType, and chain composition is identical.

---

### Phase J: Documentation & Cleanup

- [x] **J1. Update GAME_DESIGN.md**
  - Replace all `categoryL2`-based chain references with chainType system
  - Update chain mechanic section with 6 named chain types
  - Update card rendering section with AP color and glow
  - Update reward screen section with chain type badge
  - Update shop section with chain composition display
  - Document fact-to-card binding change (facts no longer shuffle per draw)
  - Update deck building strategy section

- [x] **J2. Update ARCHITECTURE.md**
  - Add `chainTypes.ts` to file map
  - Update data flow: buildRunPool → fact binding → chainType assignment
  - Update deckManager flow: drawHand no longer re-pairs facts

- [x] **J3. Remove dead code**
  - Remove unused `categoryL2` chain logic from chainSystem.ts
  - Remove per-draw fact pairing functions if fully replaced (keep if needed for backward compat)
  - Remove old chain color derivation from categoryL2 if it existed

- [x] **J4. Clean up the problem docs**
  - Delete `CHAIN-TAGGING-PROBLEM.md` and `chain-tagging-sample-facts.json` from repo root (problem is solved)

**CHECKPOINT J:** `npm run typecheck` && `npm run build` && `npx vitest run` all pass. Docs are current.

---

## Files Affected

| File | Action |
|------|--------|
| `src/data/chainTypes.ts` | NEW — chain type definitions |
| `src/data/card-types.ts` | EDIT — add chainType, boundFactId to Card |
| `src/services/runPoolBuilder.ts` | EDIT — fact binding + chain type assignment |
| `src/services/deckManager.ts` | EDIT — use bound facts, draw smoothing |
| `src/services/chainSystem.ts` | EDIT — chainType check instead of categoryL2 |
| `src/services/turnManager.ts` | EDIT — pass chainType to chain system |
| `src/services/encounterBridge.ts` | EDIT — pass chainType |
| `src/services/rewardGenerator.ts` | EDIT — bound facts + chain type diversity |
| `src/services/shopService.ts` | EDIT — remove bound fact on card removal |
| `src/services/runSaveService.ts` | EDIT — persist boundFactId + chainType |
| `src/ui/components/CardHand.svelte` | EDIT — AP color, glow, pulse animation |
| `src/ui/components/CardRewardScreen.svelte` | EDIT — chain badge, fact preview |
| `src/ui/components/CardCombatOverlay.svelte` | EDIT — chain counter name + color |
| Shop component (TBD) | EDIT — chain indicators, composition summary |
| `docs/GAME_DESIGN.md` | EDIT — chain system documentation |
| `docs/ARCHITECTURE.md` | EDIT — file structure + data flow |
| `tests/unit/` | EDIT — update chain/deck tests |

## Verification Gate

- [x] `npm run typecheck` passes
- [x] `npm run build` succeeds
- [x] `npx vitest run` — all tests pass (update tests for new chain system)
- [x] Playwright screenshot: cards show AP color + glow + pulse
- [x] Playwright screenshot: reward screen shows chain badges
- [x] Manual/Playwright: chain builds on matching chainType, breaks on mismatch
- [x] Manual/Playwright: save/load preserves chain types
- [x] `GAME_DESIGN.md` and `ARCHITECTURE.md` are up to date
