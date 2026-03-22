# AR-94: Split CardCombatOverlay God Component

## Overview
`CardCombatOverlay.svelte` is 2,416 lines with 42 imports — the most coupled component in the codebase. It handles quiz UI, card hand orchestration, damage numbers, combo counter, status effects, relic display, and combat HUD all in one file. Split into focused sub-components while preserving all existing behavior.

**Complexity**: High
**Risk**: Medium (must not break combat flow — visual verification critical)
**Dependencies**: None

## TODO Checklist

- [x] **1. Analyze component boundaries**
  - Read `src/ui/components/CardCombatOverlay.svelte` fully
  - Identify distinct visual/logical sections:
    - Quiz question/answer display
    - Player/enemy HP bars and status
    - Damage popup numbers
    - Relic tray display
    - Combo/chain counter
    - Turn indicator and action prompts
  - Map which state/props each section needs

- [x] **2. Extract `CombatQuizSection.svelte`**
  - Move quiz question text, answer buttons, timer, and feedback into dedicated component
  - Props: quiz data, callbacks for answer selection
  - Keep parent as orchestrator

- [x] **3. Extract `CombatStatusBar.svelte`**
  - Player HP, enemy HP, shield indicators, status effect icons
  - Props: player state, enemy state, active status effects

- [x] **4. Extract `CombatRelicTray.svelte`**
  - Relic icons with activation indicators
  - Props: active relics, recently triggered relics

- [x] **5. Extract `CombatActionPrompt.svelte`**
  - Turn indicator, "Play a card" / "Answer question" prompts
  - Props: current phase, available actions

- [x] **6. Slim down parent to orchestration only**
  - Parent should be <200 lines: imports sub-components, manages combat state flow, passes props
  - All rendering delegated to children

- [x] **7. Visual verification**
  - Screenshot combat screen before and after
  - Verify all animations still work (damage popups, combo counter, status icons)
  - Test quiz flow end-to-end
  - Check mobile layout (portrait + landscape)

## Acceptance Criteria
- `CardCombatOverlay.svelte` reduced to <300 lines (orchestration only)
- Each extracted component is self-contained with clear props interface
- All combat visual behavior identical before/after (screenshot comparison)
- No new Svelte warnings or errors in console
- Import count in parent reduced from 42 to <15

## Files Affected
| Action | Path |
|--------|------|
| EDIT | `src/ui/components/CardCombatOverlay.svelte` (slim down) |
| CREATE | `src/ui/components/combat/CombatQuizSection.svelte` |
| CREATE | `src/ui/components/combat/CombatStatusBar.svelte` |
| CREATE | `src/ui/components/combat/CombatRelicTray.svelte` |
| CREATE | `src/ui/components/combat/CombatActionPrompt.svelte` |

## Verification Gate
- [x] `npm run typecheck` passes
- [x] `npm run build` passes
- [x] `npx vitest run` — all tests pass
- [x] Playwright screenshot of combat — visually identical to before
- [x] Mobile layout verified (portrait + landscape)
- [x] No console errors during combat flow
