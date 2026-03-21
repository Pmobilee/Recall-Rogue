# AR-211: Combat Screen UX Polish

## Overview
Combat is the core gameplay loop and has multiple readability/ergonomics issues at 1920x1080. Card text is too small, CTA buttons lack visual weight, relic icons are tiny, and information elements (AP, block, floor counter) are hard to parse. This AR addresses all combat-screen UX issues found in the visual audit.

**Complexity**: Medium
**Dependencies**: None
**Files Affected**: `src/ui/components/CardHand.svelte`, `src/ui/components/CombatHUD.svelte`, `src/ui/components/EnemyDisplay.svelte`, `src/game/scenes/CombatScene.ts`, related CSS

## Sub-steps

### 1. Increase card description text size and readability
- Card descriptions at bottom of cards ("Deal 8 damage", "Gain 6 Block") are very small at 1080p
- Increase card description font-size using `calc(Npx * var(--text-scale, 1))`
- Ensure card name text is also sufficiently large
- Card text must remain readable even with 10-card hands (scale gracefully)
- **Acceptance**: Card descriptions legible without squinting at 1080p

### 2. Make "END TURN" button more prominent
- Currently low-contrast text in bottom-right, easy to miss
- Add background fill (dark semi-transparent), border, and hover state
- Increase font size
- Use `calc()` with `--layout-scale` for all dimensions
- **Acceptance**: END TURN button is immediately noticeable; has clear hover/active states

### 3. Enlarge AP counter and Block indicator
- AP counter (green circle "5" bottom-left) is too small
- Block indicator (shield icon) is tiny
- Increase size of both, ensure they scale with `--layout-scale`
- Add subtle label text ("AP" / "Block") if space allows
- **Acceptance**: AP and Block values readable at a glance at 1080p

### 4. Enlarge relic icons in combat HUD
- Relic icons (top-left strip) are nearly indistinguishable at 1080p
- Increase relic icon size; use `calc()` with `--layout-scale`
- Ensure tooltip on hover still works
- **Acceptance**: Each relic icon clearly identifiable without hovering at 1080p

### 5. Improve floor counter visibility
- "1/5" floor counter at top-left is tiny
- Increase font size and add subtle background pill
- Use `--text-scale` for sizing
- **Acceptance**: Floor progress visible at a glance

### 6. Improve player HP bar text
- Player HP "100/100" text on the full-width bar is small
- Increase HP text size with `--text-scale`
- **Acceptance**: Player HP number clearly readable at 1080p

### 7. Enlarge pause button
- Pause button (II) at top-right is small and lacks visual weight
- Increase size, add subtle background
- **Acceptance**: Pause button visible and clickable without precision targeting

## Verification Gate
- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] All combat scenarios (basic, boss, elite, low-hp, big-hand, mini-boss, relic-heavy) visually inspected at 1920x1080
- [ ] No hardcoded px values — all use `calc(Npx * var(--layout-scale/--text-scale, 1))`
- [ ] 10-card hands still display correctly (cards scale down gracefully)
- [ ] Card text readable in all hand sizes (5, 8, 10 cards)
