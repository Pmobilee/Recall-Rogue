# AR-127: Combat Accessibility & Color Fixes

**Source:** docs/COMBAT-UX-AUDIT.md (C-1, C-3, H-5, H-15, M-12, M-14, L-10, L-11)
**Priority:** Critical + High
**Estimated complexity:** Medium

## Overview

Fix color-blind unsafe color pairs, add missing DOM accessibility for enemy HP, improve numeric readability of AP orb, and add screen-reader announcements for quiz outcomes.

## Sub-steps

### 1. Color-blind safe intent colors (C-3)
**File:** `src/ui/components/CardCombatOverlay.svelte`

Replace the red/green intent value colors with a color-blind safe palette:
- `intent-value-attack`: change `#ef4444` (red) to `#ef4444` (keep red — it's fine alone)
- `intent-value-heal`: change `#22c55e` (green) to `#38bdf8` (sky blue) — distinguishable from red by deuteranopes
- `intent-value-buff`: keep `#eab308` (yellow)
- `intent-value-debuff`: keep `#a855f7` (purple)

Also update the INTENT_COLORS and INTENT_BORDER_COLORS maps:
- `heal`: change from green rgba to blue rgba: `rgba(56, 189, 248, 0.25)` / `rgba(56, 189, 248, 0.6)`

### 2. Color-blind safe HP bar (C-3)
**File:** `src/ui/components/CardCombatOverlay.svelte`

Change `playerHpColor` derived to use blue instead of green for high HP:
- `> 0.5`: `#38bdf8` (sky blue) instead of `#2ecc71` (green)
- `> 0.25`: `#f59e0b` (amber) — keep
- `<= 0.25`: `#ef4444` (red) — keep

Also update the Phaser `playerHpColor()` function in `CombatScene.ts`:
- `COLOR_HP_GREEN` rename to `COLOR_HP_BLUE = 0x38bdf8`

### 3. Enemy HP mirrored to DOM (C-1)
**File:** `src/ui/components/CardCombatOverlay.svelte`

Add a visually-hidden `aria-live="polite"` div that mirrors enemy HP:
```html
<div class="sr-only" aria-live="polite" role="status">
  {enemyName}: {turnState.enemy.currentHP} of {turnState.enemy.template.maxHP} HP
</div>
```
CSS: `.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }`

### 4. AP orb numeric readout (H-5)
**File:** `src/ui/components/CardCombatOverlay.svelte`

The AP orb already shows a number (`<span class="ap-number">{apCurrent}</span>`). Verify the font size is at least 28px and clearly visible. Add a small "AP" label below the number. Update the aria-label to include max: `aria-label="Action points: {apCurrent} of {apMax}"`.

### 5. Status effect popup per-icon (H-15)
**File:** `src/ui/components/StatusEffectBar.svelte`

Change the popup behavior so tapping a specific effect icon shows only THAT effect's description, not all effects. Change from global `showPopup` toggle to per-effect state:
- Track `activeEffectType: string | null` instead of `showPopup: boolean`
- Each icon's onclick sets `activeEffectType = effect.type`
- Popup shows only the matching effect's info
- Backdrop click clears `activeEffectType`

### 6. Eliminated answer aria-labels (H-15 accessibility)
**File:** `src/ui/components/CardExpanded.svelte`

Add `aria-label` to quiz answer buttons when eliminated by hint:
```
aria-label={eliminatedIndices.has(i) ? `${answer} — eliminated by hint` : answer}
```

### 7. Quiz result aria-live announcements (L-11)
**File:** `src/ui/components/CardExpanded.svelte`

Add `role="status"` and `aria-live="assertive"` to the quiz result overlay div (CORRECT/WRONG flash). Add `aria-live="polite"` to the speed bonus badge.

### 8. Weakness/Immunity icon clarity (M-14)
**File:** `src/ui/components/StatusEffectBar.svelte`

Change confusing emoji mappings:
- `weakness`: change from `💧` to `⬇` (down arrow — universal "reduced")
- `immunity`: change from `🛡️` to `✨` (sparkle — distinct from block shield)

## Acceptance Criteria
- [ ] Intent heal color is sky blue, not green
- [ ] HP bar uses blue for healthy, amber for caution, red for critical
- [ ] Enemy HP is accessible via screen reader
- [ ] AP orb shows clear number with "AP" label
- [ ] Status effect icons show per-effect popup on tap
- [ ] Eliminated quiz answers have descriptive aria-labels
- [ ] Quiz results announced to screen readers
- [ ] Weakness icon is down-arrow, immunity is sparkle

## Files Affected
- `src/ui/components/CardCombatOverlay.svelte`
- `src/ui/components/StatusEffectBar.svelte`
- `src/ui/components/CardExpanded.svelte`
- `src/game/scenes/CombatScene.ts`

## Verification Gate
- `npm run typecheck` passes
- `npm run build` passes
- Visual inspection: combat-basic, combat-boss, combat-low-hp scenarios
