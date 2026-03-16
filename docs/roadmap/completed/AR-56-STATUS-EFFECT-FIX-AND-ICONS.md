# AR-56 — Status Effect Bug Fix & Icon Display

## Overview
**Goal:** Fix the poison bug (Mudcrawler applies poison but player takes no damage), implement proper status effect icon bars for both enemy and player, and make them clickable with info popups.

**Critical bug:** Poison is applied to the player (tracked in `playerCombatState.statusEffects`) but the tick processing in `turnManager.ts` may not be executing, OR the damage isn't reflected in the HP display. The Mudcrawler correctly has poison in its intent pool but the player HP doesn't decrease. Must investigate and fix.

**Dependencies:** None.
**Estimated complexity:** Medium-High (bug investigation + UI component work).

## Sub-steps

### 1. Investigate and fix poison not damaging player
- Add console.log in `tickPlayerStatusEffects()` in `playerCombatState.ts` (~line 107) to trace:
  - Is the function called at turn end?
  - Does `playerState.statusEffects` contain poison entries?
  - Is `takeDamage()` called with the poison value?
  - Does the HP actually decrease?
- Check `turnManager.ts` (~line 762) to verify `tickPlayerStatusEffects()` is called in the turn-end flow
- Check if there's a condition preventing the tick (e.g., only ticks enemy effects, not player)
- Check if the Mudcrawler's debuff intent is correctly structured with `statusEffect: { type: 'poison', value: 2, turns: 2 }`
- Check `enemyManager.ts` `executeEnemyIntent()` — does the debuff intent actually call `applyStatusEffect()` on the player?
- Fix whatever is broken

**Files:** `src/services/turnManager.ts`, `src/services/playerCombatState.ts`, `src/services/enemyManager.ts`, `src/data/enemies.ts`
**Acceptance:** Mudcrawler poison actually reduces player HP each turn. Console confirms tick processing.

### 2. Verify poison stacking math
- Test scenario: enemy applies 2 poison for 2 turns, then next turn applies 2 more poison for 2 turns
- Expected: Turn 1: 2 poison damage. Turn 2: 2 damage + 2 new = 4 poison total, but first batch expires → should be 2 poison. Actually need to verify the stacking model.
- Current stacking in `applyStatusEffect()`: if same type exists, values add and duration = max(existing, new)
- Verify this matches Slay the Spire model: poison deals damage = stack count, then decreases by 1 each turn
- If our model differs, document how it works and whether it needs changing

**Files:** `src/data/statusEffects.ts`
**Acceptance:** Poison stacking behavior documented and verified working correctly.

### 3. Create StatusEffectBar Svelte component
- New component: `src/ui/components/StatusEffectBar.svelte`
- Props: `effects: StatusEffect[]`, `position: 'enemy' | 'player'`
- Renders a horizontal row of small icons (one per effect type, with stack count badge)
- Each icon shows: effect type icon (emoji fallback for now), stack count, turns remaining
- Clickable: tap to show a popup explaining the effect

**Files:** `src/ui/components/StatusEffectBar.svelte` (new)
**Acceptance:** Component renders correctly with mock data.

### 4. Add StatusEffectBar to combat overlay
- Below enemy HP bar: show enemy status effects
- Above player HP bar: show player status effects
- Wire up to `turnState.enemy.statusEffects` and `turnState.playerState.statusEffects` (or equivalent)
- Position using `var(--layout-scale, 1)` for responsive scaling

**Files:** `src/ui/components/CardCombatOverlay.svelte`
**Acceptance:** Status effects visible during combat. Poison icon appears when Mudcrawler applies it.

### 5. Add effect info popup on tap
- When a status effect icon is tapped, show a small popup with:
  - Effect name (e.g., "Poison")
  - Description (e.g., "Deals 2 damage per turn. 3 turns remaining.")
  - Stack count and turns
- Popup dismisses on tap outside
- Effect descriptions stored in `statusEffects.ts`

**Files:** `src/ui/components/StatusEffectBar.svelte`, `src/data/statusEffects.ts`
**Acceptance:** Tapping a poison icon shows "Poison: Deals 2 damage per turn. 3 turns remaining."

### 6. Update GAME_DESIGN.md
- Document status effect icon system
- Document poison fix

**Files:** `docs/GAME_DESIGN.md`
**Acceptance:** Doc reflects current status effect behavior.

## Files Affected
| File | Changes |
|------|---------|
| `src/services/turnManager.ts` | Fix tick processing |
| `src/services/playerCombatState.ts` | Fix/verify poison damage |
| `src/services/enemyManager.ts` | Verify debuff intent application |
| `src/data/statusEffects.ts` | Add effect descriptions, verify stacking |
| `src/ui/components/StatusEffectBar.svelte` (new) | Icon bar component |
| `src/ui/components/CardCombatOverlay.svelte` | Wire up StatusEffectBar |
| `docs/GAME_DESIGN.md` | Document changes |

## Verification Gate
- [ ] Mudcrawler poison reduces player HP each turn
- [ ] Poison stacking works correctly (multiple applies accumulate)
- [ ] Status effect icons visible below enemy HP bar
- [ ] Status effect icons visible above player HP bar
- [ ] Tapping an icon shows info popup
- [ ] Icons update when effects are applied/expire
- [ ] `npm run typecheck` — 0 errors
- [ ] `npx vitest run` — all tests pass
