# AR-95: Split CardHand God Component

## Overview
`CardHand.svelte` is 2,417 lines — the largest component in the codebase. It handles card rendering, arc layout, drag/drop, charge preview, tier-up animations, keyboard input, and play confirmation all in one file. Split into focused sub-components.

**Complexity**: High
**Risk**: Medium (drag/drop and animations are sensitive to refactoring)
**Dependencies**: None (can be done independently of AR-94)

## TODO Checklist

- [ ] **1. Analyze component structure**
  - Read `src/ui/components/CardHand.svelte` fully
  - Map state flow: which variables feed into which visual sections
  - Identify the drag state machine boundaries
  - List all animation triggers and their dependencies

- [ ] **2. Extract `CardArcLayout.svelte`**
  - Pure rendering: positions cards in arc/fan layout
  - Props: cards array, selected index, layout params
  - No interaction logic — just positioning math and rendering

- [ ] **3. Extract `CardDragController.svelte` (or `.ts` module)**
  - All pointer event handlers: pointerdown, pointermove, pointerup
  - Drag frame management (`flushDragFrame`, `clearDragFrame`)
  - Drop zone detection and card play initiation
  - Exports: drag state, handlers to bind

- [ ] **4. Extract `CardChargePreview.svelte`**
  - Charge bar visualization
  - Tier-up preview indicators
  - Props: card charge state, threshold data

- [ ] **5. Extract `CardPlayConfirmation.svelte`**
  - "Play this card?" confirmation UI
  - Props: selected card, confirm/cancel callbacks

- [ ] **6. Slim parent to orchestration**
  - Parent manages card array state and delegates to sub-components
  - Target: <300 lines

- [ ] **7. Visual + interaction verification**
  - Card fan renders correctly at all hand sizes (1-7 cards)
  - Drag and drop still works smoothly
  - Card play flow unchanged
  - Keyboard navigation still works
  - Charge preview and tier-up animations work
  - Mobile touch interactions verified

## Acceptance Criteria
- `CardHand.svelte` reduced to <300 lines
- Drag/drop behavior identical (test on touch and mouse)
- All card animations preserved
- Keyboard accessibility maintained
- No performance regression in card rendering

## Files Affected
| Action | Path |
|--------|------|
| EDIT | `src/ui/components/CardHand.svelte` (slim down) |
| CREATE | `src/ui/components/hand/CardArcLayout.svelte` |
| CREATE | `src/ui/components/hand/CardDragController.svelte` (or `.ts`) |
| CREATE | `src/ui/components/hand/CardChargePreview.svelte` |
| CREATE | `src/ui/components/hand/CardPlayConfirmation.svelte` |

## Verification Gate
- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] `npx vitest run` — all tests pass
- [ ] Playwright: card hand renders, drag works, play flow works
- [ ] Mobile layout verified
- [ ] No performance regression (60fps card animations)
