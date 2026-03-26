# AR-267: Status Effect Display Audit & Fix

## Overview

**Goal:** Ensure the player and enemy status effect icon bars (STS-style buff/debuff dots) are visible, correctly positioned relative to the current HP bar layout, and display ALL active effects including new Aura-system effects from AR-261.

**Why:** The `StatusEffectBar.svelte` component exists with 17 effect types and emoji icons, but it was built against a previous HP bar layout. After HP bar reworks, the positioning (`bottom: 46px`) may not align correctly, and the component may be occluded or invisible. Additionally, the new Knowledge Aura system (AR-261) introduces Brain Fog and Flow State which need status effect icons.

**Dependencies:** AR-261 (Knowledge Aura provides Brain Fog / Flow State effects)
**Should be done alongside or immediately after:** AR-261
**Estimated complexity:** Small-Medium (positioning fix + new effect entries + visual verification)

**Reference:** Slay the Spire status effect icon bar — small colored icons below HP showing all active buffs/debuffs with stack counts and turn durations. Tap for tooltip.

---

## Sub-steps

### 1. Audit Current StatusEffectBar Visibility

**File:** `src/ui/components/CardCombatOverlay.svelte` (line 2619)

Verify via Playwright screenshot that the player `StatusEffectBar` is actually visible during combat when effects are active. Check:
- Is it occluded by the card hand, HP bar, or other UI elements?
- Does the `bottom: 46px` positioning still work with the current HP bar layout?
- Is the enemy status bar (at `top: 48px`) visible above the enemy sprite?
- Do the icons appear when poison/strength/etc. are active?

If not visible, fix positioning to sit directly adjacent to the HP bar (player: above the HP strip, enemy: below the enemy HP bar).

**Acceptance criteria:**
- Player status bar visible between HP bar and card hand
- Enemy status bar visible near enemy HP bar
- Neither occluded by other UI elements
- Test with multiple simultaneous effects to verify no overflow issues

### 2. Fix Player StatusEffectBar Positioning

**File:** `src/ui/components/StatusEffectBar.svelte` (line 107-109)

The player bar uses `bottom: calc(46px * var(--layout-scale, 1))`. This needs to be positioned **directly above** the `.player-status-strip` element.

Check the current `.player-status-strip` height and position in `CardCombatOverlay.svelte`. The status effect bar should sit immediately above it with a small gap.

If the HP bar moved, update the `bottom` value to match. Consider using CSS relative positioning or flexbox instead of absolute pixel offsets to make it robust against future layout changes.

**Acceptance criteria:**
- Status effect icons sit directly above the player HP bar
- Gap is consistent and visually clean
- Works at all resolutions (720p to 1440p+) via `--layout-scale`

### 3. Fix Enemy StatusEffectBar Positioning

**File:** `src/ui/components/StatusEffectBar.svelte` (line 103-105)

Same audit for the enemy bar. Currently at `top: 48px`. The enemy HP bar is rendered in Phaser canvas — verify the Svelte status bar aligns with it.

**Acceptance criteria:**
- Enemy status effect icons visible near enemy HP bar
- Not overlapping enemy sprite or intent display
- Works at all resolutions

### 4. Add New Effect Types for Overhaul Systems

**File:** `src/ui/components/StatusEffectBar.svelte` (EFFECT_INFO dictionary, line 17)

Add new effect type entries for the overhaul systems:

```typescript
// Knowledge Aura states (AR-261)
brain_fog: {
  name: 'Brain Fog',
  icon: '🌫️',
  color: '#818cf8',  // indigo
  desc: (v) => `Brain Fog: enemies deal +20% damage. Aura: ${v}/10`
},
flow_state: {
  name: 'Flow State',
  icon: '✨',  // or '🔥' — pick one that's distinct
  color: '#fbbf24',  // gold
  desc: (v) => `Flow State: draw +1 card per turn. Aura: ${v}/10`
},

// Enemy-specific mechanics (AR-263)
stunned: {
  name: 'Stunned',
  icon: '💫',
  color: '#fbbf24',
  desc: () => `Stunned — skips next action`
},
hardcover: {
  name: 'Hardcover',
  icon: '📖',
  color: '#a78bfa',
  desc: (v) => `Hardcover armor: ${v}. Reduces Quick Play damage. Correct Charges strip it away.`
},
locked: {
  name: 'Locked',
  icon: '🔒',
  color: '#f87171',
  desc: () => `A card is locked — must Charge with the locked fact to unlock`
},

// Accuracy-related (AR-262)
accuracy_s: {
  name: 'S Grade',
  icon: '⭐',
  color: '#fbbf24',
  desc: () => `Perfect accuracy — bonus rewards incoming`
},
```

**Acceptance criteria:**
- All new effect types have entries in EFFECT_INFO
- Icons are visually distinct from existing effects
- Colors don't conflict with existing effect colors
- Descriptions are accurate and helpful

### 5. Wire New Effects into playerEffects Derivation

**File:** `src/ui/components/CardCombatOverlay.svelte` (playerEffects derived, line 405)

Add virtual effects for Knowledge Aura state:

```typescript
// After existing virtual effect pushes (line ~434):

// Knowledge Aura state (AR-261)
// These will be added after AR-261 provides getAuraState/getAuraLevel
import { getAuraState, getAuraLevel } from '../../services/knowledgeAuraSystem';

const auraState = getAuraState();
const auraLevel = getAuraLevel();
if (auraState === 'brain_fog') {
  effects.push({ type: 'brain_fog', value: auraLevel, turnsRemaining: 999 });
}
if (auraState === 'flow_state') {
  effects.push({ type: 'flow_state', value: auraLevel, turnsRemaining: 999 });
}
```

Similarly, wire enemy effects for Hardcover (The Textbook) and Stunned (Pop Quiz) from enemy instance state.

**Acceptance criteria:**
- Brain Fog icon appears when Aura 0-3
- Flow State icon appears when Aura 7-10
- No icon during Neutral (4-6)
- Enemy Hardcover/Stunned icons appear on relevant enemies

### 6. Wire Enemy-Specific Effects into enemyEffects Derivation

**File:** `src/ui/components/CardCombatOverlay.svelte` (enemyEffects derived, line 397)

Add virtual effects from enemy instance state:

```typescript
// After base effects (line ~401):
const enemy = turnState.enemy;
if (enemy?._stunNextTurn) {
  effects.push({ type: 'stunned', value: 1, turnsRemaining: 1 });
}
if (enemy?._hardcover > 0) {
  effects.push({ type: 'hardcover', value: enemy._hardcover, turnsRemaining: 999 });
}
```

**Acceptance criteria:**
- Stunned icon appears on Pop Quiz when stunned
- Hardcover icon appears on The Textbook with current armor value

### 7. Visual Verification at Multiple Resolutions

Test via Playwright at:
- 1920×1080 (primary target)
- 1280×720
- 2560×1440

At each resolution, verify:
- Status bars are visible and correctly positioned
- Icons are readable (not too small at 720p, not too large at 1440p)
- Multiple effects don't overflow off-screen
- Tooltip popups are fully visible and don't clip

**Acceptance criteria:**
- All resolutions look correct
- No overflow or clipping issues
- Screenshots captured for each resolution

### 8. Unit Tests

Test the StatusEffectBar effect filtering:
- Effects with `turnsRemaining <= 0` are filtered out
- Virtual effects (thorns, empower, etc.) are correctly derived from TurnState flags
- New Aura effects appear at correct thresholds

**Acceptance criteria:** All tests pass.

### 9. Update GDD

**File:** `docs/GAME_DESIGN.md`

Add or update section documenting the status effect display system:
- List all 20+ effect types with icons
- Document player bar (below HP) and enemy bar (above HP) positions
- Note which effects are "virtual" (derived from flags vs. actual statusEffects array)

**Acceptance criteria:** Status effect display system fully documented.

---

## Files Affected

| File | Change |
|------|--------|
| `src/ui/components/StatusEffectBar.svelte` | Fix positioning, add new effect types |
| `src/ui/components/CardCombatOverlay.svelte` | Wire Aura/enemy effects into derivations |
| `docs/GAME_DESIGN.md` | Document status effect display |
| Test files | Unit tests for effect filtering |

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] `npx vitest run` — all tests pass
- [ ] Playwright screenshot at 1920×1080: player status bar visible with effects
- [ ] Playwright screenshot at 1920×1080: enemy status bar visible with effects
- [ ] Playwright screenshot at 1280×720: both bars visible, readable
- [ ] Tap status icon → tooltip popup visible and not clipped
- [ ] Brain Fog icon appears at Aura 0-3 (after AR-261)
- [ ] Flow State icon appears at Aura 7-10 (after AR-261)
