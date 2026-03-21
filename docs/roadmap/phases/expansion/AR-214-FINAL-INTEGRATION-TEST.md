# AR-214: Final Integration Test & Visual Audit

**Source:** docs/RESEARCH/EXPANSION_FINAL_PRODUCTION.md — all parts
**Priority:** Critical — final quality gate before release
**Estimated complexity:** High
**Depends on:** AR-213 (all docs synced)
**Blocks:** Nothing (this is the final AR)

## Overview

Comprehensive end-to-end testing of the complete expansion. This AR verifies that everything works together: all 91 cards play correctly, all 77 relics trigger correctly, Burn/Bleed/Cursed/Inscription systems interact properly, the card unlock progression works, and the game is visually polished on all target platforms (mobile portrait, mobile landscape, desktop).

This is the last AR. After this passes, the expansion is ready for alpha. The only remaining user task is generating card art via ComfyUI (queued by AR-212).

## TODO

### E2E Smoke Tests

- [ ] 1. Run full E2E test suite
  **Files:** `tests/e2e/01-app-loads.cjs`, `tests/e2e/03-save-resume.cjs`
  **What:** Run all existing E2E tests. They must pass without modification. Any failures indicate regression.
  **Acceptance:** All E2E tests pass.

- [ ] 2. Full run smoke test via Playwright
  **Files:** N/A (Playwright MCP)
  **What:** Using Playwright MCP, play a complete run from start to finish:
  1. Navigate to `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`
  2. Start a new run, choose a domain
  3. Play through 3+ encounters using a mix of new and existing cards
  4. Verify: card hand renders, quiz works, Charge resolves, damage applies, enemy HP updates
  5. Try to trigger Burn, Bleed, and Cursed states
  6. Play an Inscription card and verify persistence
  7. Complete or retreat from the run
  Take screenshots at each stage.
  **Acceptance:** Full run completes without crashes or visual glitches.

### Card Verification

- [ ] 3. Verify all 60 new cards play correctly
  **Files:** N/A (Playwright + headless)
  **What:** Using `__terraScenario.load('combat-basic')` with each new mechanic in the deck:
  - Quick Play each card: verify correct QP value
  - Charge each card: verify quiz appears, correct CC value on right answer, correct CW on wrong
  - Check mastery display shows base+bonus correctly
  Batch: run headless sim with each new mechanic in isolation (1 mechanic per deck, 50 runs). 0 crashes.
  **Acceptance:** All 60 mechanics resolve correctly in all 3 modes (QP/CC/CW).

- [ ] 4. Test multi-hit + Burn/Bleed interactions
  **Files:** N/A (headless sim)
  **What:** Specifically test:
  - Twin Strike + 8 Burn: should trigger Burn twice (8+4=12 bonus, Burn at 2)
  - Twin Strike + 5 Bleed: each hit +5 bonus = +10 total
  - Multi-Hit (existing, 3 hits) + Burn + Bleed: all interactions correct
  **Acceptance:** Damage math matches expansion spec examples exactly.

- [ ] 5. Test exhaust + Recollect interactions
  **Files:** N/A (headless sim)
  **What:** Specifically test:
  - Volatile Slash CC → exhausts → Recollect → returns to discard → re-drawable
  - Inscription of Fury → played → removed from game → Recollect CANNOT target it
  - Bulwark CC → exhausts → visible in exhaust pile viewer
  **Acceptance:** Exhaust mechanics work correctly. Inscriptions cannot be Recollected.

- [ ] 6. Test Cursed Card flow end-to-end
  **Files:** N/A (Playwright)
  **What:** Manually trigger a cursed card scenario:
  1. Load combat, find a mastery 0 card
  2. Charge it, answer wrong → fact should be cursed
  3. Verify purple tint/cracked border on next draw
  4. Verify QP deals 0.7x damage
  5. Charge the cursed card, answer correctly → cure
  6. Verify cure animation, card returns to normal
  7. Verify Free First Charge wrong does NOT curse
  **Acceptance:** Full curse → cure flow works visually and mechanically.

- [ ] 7. Test Chain system with new cards
  **Files:** N/A (headless sim + Playwright)
  **What:** Specifically test:
  - Chain Anchor → sets next chain to 2 → Chain Lightning benefits
  - Chain Lightning counts itself in chain length
  - Synapse wildcard extends chain
  - Chain Forge prevents one break per encounter
  - Chromatic Chain carries across turns
  - Null Shard disables chains but CL floors at length 1
  **Acceptance:** All chain interactions match Appendix F rulings.

### Relic Verification

- [ ] 8. Verify all 36 new relics trigger correctly
  **Files:** N/A (headless sim relic audit)
  **What:** Run relic audit: each relic must trigger at least once in 500 simulated runs.
  Special attention:
  - Soul Jar: GUARANTEED button appears when charges available
  - Mind Palace: streak tracks correctly with forgiveness
  - Deja Vu: turn 1 card spawn with correct fact
  - Dragon's Heart: triggers on elite/boss kill
  - Paradox Engine: +1 AP permanent, wrong = 0.3x + 5 piercing
  - Volatile Manuscript: self-Burn applies and triggers on enemy attack
  **Acceptance:** All relics trigger. Special relics verified manually via Playwright.

### Visual Audit

- [ ] 9. Mobile portrait visual audit
  **Files:** N/A (Playwright MCP)
  **What:** Set viewport to 390x844 (iPhone 14 Pro). Take screenshots of:
  1. Card hand with new card types (attack, shield, buff, debuff, utility, wild, inscription)
  2. Cursed card visual state (purple tint, cracked border)
  3. Burn status icon on enemy
  4. Bleed status icon on enemy
  5. Inscription persistence indicator
  6. Soul Jar GUARANTEED button state
  7. CardBrowser overlay (Tutor/Mimic/Scavenge)
  8. Multi-choice popup (Phase Shift QP, Unstable Flux CC)
  9. Exhaust pile viewer
  Verify all elements are readable, not overlapping, touch-friendly.
  **Acceptance:** All screenshots show correct layout. No overlapping elements. All text readable.

- [ ] 10. Mobile landscape visual audit
  **Files:** N/A (Playwright MCP)
  **What:** Set viewport to 844x390 (iPhone 14 Pro landscape). Take screenshots of same 9 screens as TODO 9.
  **Acceptance:** All elements adapt to landscape correctly.

- [ ] 11. Desktop visual audit
  **Files:** N/A (Playwright MCP)
  **What:** Set viewport to 1920x1080. Take screenshots of same 9 screens.
  **Acceptance:** All elements look correct at desktop resolution.

### Integration

- [ ] 12. Run full test suite
  **Files:** N/A
  **What:** Run the complete verification sequence:
  ```bash
  npm run typecheck
  npm run build
  npx vitest run
  node tests/e2e/01-app-loads.cjs
  node tests/e2e/03-save-resume.cjs
  npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 500
  ```
  **Acceptance:** All pass with 0 errors, 0 crashes.

- [ ] 13. Update inspection registry — final pass
  **Files:** `data/inspection-registry.json`
  **What:** For every new element (60 cards, 36 relics, 2 status effects, Cursed system, Inscription keyword, Card Browser UI):
  - Set `mechanicInspectionDate` to today
  - Set `lastChangedDate` to today
  - Set appropriate visual inspection dates for portrait/landscape/desktop
  **Acceptance:** All new elements have current inspection dates.

- [ ] 14. Final self-review checklist
  **Files:** N/A
  **What:** Workers must answer ALL of these:
  - [ ] All 91 card mechanics are defined and resolve correctly?
  - [ ] All 77 relics are defined and trigger correctly?
  - [ ] Burn and Bleed work per spec (block interaction, Bleed no-poison-trigger)?
  - [ ] Cursed Card system works end-to-end (curse → draw → cure)?
  - [ ] Inscriptions persist, exhaust = remove from game, cannot be Recollected?
  - [ ] Card unlock gating works at all levels?
  - [ ] Combo system is fully removed (no comboCount, no COMBO_*)?
  - [ ] Echo system is fully removed (no ghost cards, no echo relics)?
  - [ ] Headless sim runs 3000+ runs with 0 crashes?
  - [ ] All 3 viewport sizes render correctly?
  - [ ] GAME_DESIGN.md is fully updated?
  - [ ] ARCHITECTURE.md is fully updated?
  - [ ] inspection-registry.json has all new elements?
  - [ ] No stale references to Echo, Combo, Signal Flare, Echo Chamber?
  **Acceptance:** ALL boxes checked.

## Testing Plan

1. E2E suite: all existing tests pass
2. Full run: manual playthrough via Playwright
3. Headless sim: 500+ runs, 0 crashes
4. Visual audit: 3 viewport sizes × 9 screens = 27 screenshots
5. Relic audit: all 77 relics trigger
6. Interaction edge cases: multi-hit + Burn/Bleed, exhaust + Recollect, chain rulings

## Verification Gate

```bash
npm run typecheck          # Clean
npm run build              # Clean
npx vitest run             # All pass
node tests/e2e/01-app-loads.cjs   # Pass
node tests/e2e/03-save-resume.cjs # Pass
npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 500  # 0 crashes
```

All screenshots reviewed and approved.

## Files Affected

| File | Change Type |
|------|------------|
| `data/inspection-registry.json` | Final inspection date updates |
| (No code changes — this is a testing AR) | |

## Doc Updates Required

- None (AR-213 handles all doc sync)
