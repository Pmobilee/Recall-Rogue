# AR-203: Burn & Bleed Status Effects

## Overview

Implements two new debuff status effects — Burn and Bleed — that add reactive damage amplification to combat. Both are applied to enemies (and, for Burn, optionally to the player via the Volatile Manuscript relic). Neither deals independent passive damage; both are triggered by other damage sources, creating interesting synergies with multi-hit mechanics and attack-heavy decks.

**Dependencies:**
- `src/data/statusEffects.ts` — add `'burn'` and `'bleed'` to `StatusEffectType`; add trigger logic
- `src/services/cardEffectResolver.ts` — add `burnStacks` and `bleedStacks` fields to `CardEffectResult`; populate from mechanic cases
- `src/services/turnManager.ts` — integrate Burn and Bleed into the attack damage pipeline and the end-of-enemy-turn decay
- `src/services/enemyManager.ts` — integrate Burn into `executeEnemyIntent` for Self-Burn (player-side)
- `src/data/balance.ts` — add `BURN_HALVE_ON_HIT`, `BURN_ROUND_DOWN`, `BLEED_BONUS_PER_STACK`, `BLEED_DECAY_PER_TURN` constants
- `src/ui/components/` — extend whichever component renders enemy status effect icons (currently inline in game scenes; see UI TODO below)
- `docs/GAME_DESIGN.md` — document both effects in the Status Effects section
- `data/inspection-registry.json` — add Burn and Bleed entries to the `statusEffects` table

**Estimated complexity:** Medium (4–6 files, well-contained logic, no new data structures)

---

## Damage Pipeline Reference

The existing attack damage pipeline in `turnManager.ts → playCardAction` resolves in this order (simplified):

1. Compute base damage from mechanic value
2. Apply combo/chain/speed/buff multipliers
3. Apply relic attack modifiers (percent then flat)
4. Apply Overclock, Double Strike multipliers
5. Apply Mastery Ascension flat bonus
6. Apply Phoenix Rage (+50%)
7. Apply Perfect Storm synergy
8. Apply Scholars Crown / Crit Lens / Mirror of Knowledge
9. Apply Double Down
10. Apply Quick Play immunity / damage multipliers / chargeResistant
11. **[NEW] Apply Burn bonus to damage total (before block)**
12. **[NEW] Apply Bleed bonus to damage total (before block)**
13. Call `applyDamageToEnemy(enemy, damage)` — block absorbed here

Burn and Bleed bonuses are added at steps 11–12 to `effect.damageDealt` before `applyDamageToEnemy` is called. This means they interact with block identically to the base attack damage — they are not pierce damage.

---

## Sub-Steps

### TODO-1: Add `'burn'` and `'bleed'` to `StatusEffectType`

**File:** `src/data/statusEffects.ts`

**What:**
- Add `'burn'` and `'bleed'` to the `StatusEffectType` union (line 6).
- The existing `applyStatusEffect` and `tickStatusEffects` functions already handle generic additive stacking and per-turn expiry, but Burn and Bleed have non-standard tick behaviour — Burn does NOT tick per turn (it fires on-hit and self-halves), and Bleed decays by 1 at end of enemy turn (not poison-style damage). This means neither should produce `poisonDamage` or `regenHeal` in `tickStatusEffects`. They simply decrement `turnsRemaining` like any other effect — the decay logic lives in `turnManager.ts` (see TODO-4).
- Add `burnBonusDealt` and `bleedBonusDealt` to `TickResult` for completeness (both will be 0 from `tickStatusEffects` itself; the real trigger logic is in the turn manager).
- Add two new exported helper functions:

```typescript
/**
 * Triggers Burn on a hit. Returns the bonus damage dealt and the updated Burn stack count.
 * Burn deals damage equal to current stacks, then halves (round down). Expires at 0.
 *
 * @param effects - The target's status effects array (mutated in place).
 * @returns { bonusDamage, stacksAfter }
 */
export function triggerBurn(effects: StatusEffect[]): { bonusDamage: number; stacksAfter: number }

/**
 * Returns the Bleed bonus damage for the given damage source.
 * Bleed adds +1 per stack to incoming card-play damage. Does NOT mutate stacks (decay is separate).
 *
 * @param effects - The target's status effects array.
 * @returns The flat bonus damage from Bleed (0 if no Bleed stacks).
 */
export function getBleedBonus(effects: StatusEffect[]): number
```

**`triggerBurn` logic:**
```
const burn = effects.find(e => e.type === 'burn' && e.turnsRemaining > 0)
if (!burn) return { bonusDamage: 0, stacksAfter: 0 }
const bonusDamage = burn.value          // current stacks = bonus damage
burn.value = Math.floor(burn.value / 2) // halve, round down
if (burn.value <= 0) {
  remove burn from effects               // expired
}
return { bonusDamage, stacksAfter: burn.value ?? 0 }
```

**`getBleedBonus` logic:**
```
const bleed = effects.find(e => e.type === 'bleed' && e.turnsRemaining > 0)
return bleed ? bleed.value * BLEED_BONUS_PER_STACK : 0
```

**`tickStatusEffects` change:** Inside the tick loop, skip `burn` and `bleed` for damage/heal output (they contribute 0). They still have `turnsRemaining` decremented each tick for the Bleed decay path — but see TODO-4 for the canonical decay location.

**Acceptance criteria:**
- `StatusEffectType` includes `'burn'` and `'bleed'` with no TypeScript errors
- `triggerBurn` correctly halves stacks and removes at 0: 8 stacks → returns `{ bonusDamage: 8, stacksAfter: 4 }`, then 1 stack → returns `{ bonusDamage: 1, stacksAfter: 0 }` and removes the effect
- `getBleedBonus` returns `stacks * BLEED_BONUS_PER_STACK` (= stacks × 1 at default)
- `tickStatusEffects` does not produce `poisonDamage` or `regenHeal` for burn/bleed
- All existing unit tests in `tests/` still pass (`npx vitest run`)

---

### TODO-2: Add balance constants

**File:** `src/data/balance.ts`

**What:** Add the following exports near the existing combat constants section:

```typescript
// === BURN STATUS EFFECT (AR-203) ===
/** When true, Burn triggers on every hit and halves after triggering. */
export const BURN_HALVE_ON_HIT = true
/** When true, Burn halving rounds down (floor). */
export const BURN_ROUND_DOWN = true

// === BLEED STATUS EFFECT (AR-203) ===
/** Flat bonus damage Bleed adds to incoming card-play damage, per stack. */
export const BLEED_BONUS_PER_STACK = 1
/** How many Bleed stacks decay at the end of each enemy turn. */
export const BLEED_DECAY_PER_TURN = 1
```

**Acceptance criteria:**
- Constants are exported and importable
- `npm run typecheck` passes

---

### TODO-3: Add `burnStacks` / `bleedStacks` to `CardEffectResult` and populate in mechanic cases

**File:** `src/services/cardEffectResolver.ts`

**What:**
- Add two optional fields to `CardEffectResult`:

```typescript
/** Burn stacks to apply to the target on this card play. */
applyBurnStacks?: number;
/** Bleed stacks to apply to the target on this card play. */
applyBleedStacks?: number;
```

- In the relevant `switch (mechanicId)` cases (whichever new cards or existing cards are intended to apply Burn/Bleed), populate `result.applyBurnStacks` or `result.applyBleedStacks`.

**Initial cards that apply Burn/Bleed** (per Appendix E/F of the expansion spec; implement only what is confirmed in the spec):
- Cards with `mechanicId: 'ignite'` → set `result.applyBurnStacks` based on play mode (quick: 3, charge_correct: 8, charge_wrong: 1)
- Cards with `mechanicId: 'lacerate'` → set `result.applyBleedStacks` based on play mode (quick: 2, charge_correct: 6, charge_wrong: 1)

Note: These mechanic IDs do not yet exist in `src/data/mechanics.ts`. The `CardEffectResult` fields should be added now so that when mechanic definitions land (a separate AR), they can call into this resolver cleanly. For now, the fields are populated only if the switch case matches — no mechanic definition = field stays undefined.

**Acceptance criteria:**
- `CardEffectResult` has `applyBurnStacks?: number` and `applyBleedStacks?: number`
- `npm run typecheck` passes with no errors on the resolver
- Existing mechanic cases are unmodified (no regressions)

---

### TODO-4: Integrate Burn and Bleed into the damage pipeline in `turnManager.ts`

**File:** `src/services/turnManager.ts`

**What:** Three integration points.

#### 4A — Apply Burn/Bleed stacks from card effects (in `playCardAction`)

After the block at line ~1012 (`for (const status of effect.statusesApplied) { applyStatusEffect(...) }`), add:

```typescript
// AR-203: apply Burn stacks to enemy
if ((effect.applyBurnStacks ?? 0) > 0) {
  applyStatusEffect(enemy.statusEffects, {
    type: 'burn',
    value: effect.applyBurnStacks!,
    turnsRemaining: 99, // Burn expires by halving to 0, not by turn count
  });
}
// AR-203: apply Bleed stacks to enemy
if ((effect.applyBleedStacks ?? 0) > 0) {
  applyStatusEffect(enemy.statusEffects, {
    type: 'bleed',
    value: effect.applyBleedStacks!,
    turnsRemaining: 99, // Bleed expires by decay at end of enemy turn
  });
}
```

`turnsRemaining: 99` is a sentinel — these effects don't expire by the standard tick countdown, but the existing `applyStatusEffect` stacking logic (additive value, max turnsRemaining) is still correct for stacking behaviour.

#### 4B — Trigger Burn and Bleed as damage bonuses (in `playCardAction`, attack damage path)

This is the critical pipeline integration. BEFORE the call to `applyDamageToEnemy` (currently at line ~962), and only when `effect.damageDealt > 0` and the damage source is a card play (not Thorns/reflect), add:

```typescript
// AR-203 Step 11: Burn — triggers on any card attack hit, adds bonus = current stacks, then halves
// Burn does NOT trigger on Thorns/reflect damage (this path is card-play only).
if (effect.damageDealt > 0) {
  const burnResult = triggerBurn(enemy.statusEffects);
  if (burnResult.bonusDamage > 0) {
    effect.damageDealt += burnResult.bonusDamage;
    effect.finalValue += burnResult.bonusDamage;
    turnState.turnLog.push({
      type: 'status_tick',
      message: `Burn triggered: +${burnResult.bonusDamage} damage (${burnResult.stacksAfter} stacks remaining)`,
      value: burnResult.bonusDamage,
    });
  }
}

// AR-203 Step 12: Bleed — adds flat bonus per stack to card-play damage, before block
// Bleed does NOT trigger on passive damage (Poison ticks, Thorns, Burn itself).
if (effect.damageDealt > 0) {
  const bleedBonus = getBleedBonus(enemy.statusEffects);
  if (bleedBonus > 0) {
    effect.damageDealt += bleedBonus;
    effect.finalValue += bleedBonus;
    turnState.turnLog.push({
      type: 'status_tick',
      message: `Bleed: +${bleedBonus} damage`,
      value: bleedBonus,
    });
  }
}
```

**Twin Strike (multi-hit) interaction with Burn:**
Twin Strike uses `mechanicId: 'multi_hit'` and calls `applyAttackDamage(finalValue * hits)` as a single combined damage call — so Burn currently fires once for the combined total. To correctly fire Burn once per hit (8 stacks → +8 on hit 1 becoming 4 stacks → +4 on hit 2), `multi_hit` needs to be split into per-hit resolution.

This requires a flag on `CardEffectResult` to indicate multi-hit resolution:

Add to `CardEffectResult`:
```typescript
/** If set, this card's damage was resolved as N separate hits. Burn triggers once per hit. */
hitCount?: number;
```

In `cardEffectResolver.ts` `multi_hit` case, set `result.hitCount = hits` and set `result.damageDealt = finalValue` (per-hit value, not total). Then in `turnManager.ts`, after the Burn/Bleed step:

```typescript
// AR-203: multi_hit per-hit resolution for Burn
if ((effect.hitCount ?? 1) > 1) {
  let totalDamage = 0;
  const hits = effect.hitCount!;
  for (let i = 0; i < hits; i++) {
    let hitDamage = effect.damageDealt; // per-hit base (pre-burn for remaining hits)
    const burnResult = triggerBurn(enemy.statusEffects);
    hitDamage += burnResult.bonusDamage;
    const bleedBonus = getBleedBonus(enemy.statusEffects);
    hitDamage += bleedBonus;
    totalDamage += hitDamage;
    if (burnResult.bonusDamage > 0) {
      turnState.turnLog.push({ type: 'status_tick', message: `Burn (hit ${i+1}): +${burnResult.bonusDamage}`, value: burnResult.bonusDamage });
    }
  }
  effect.damageDealt = totalDamage;
  effect.finalValue = totalDamage;
  effect.enemyDefeated = totalDamage >= enemy.currentHP;
  // Skip the single-hit Burn/Bleed block above when hitCount > 1
}
```

Implementation note: The cleanest approach is to check `effect.hitCount` before the single-hit Burn/Bleed block and branch accordingly. The single-hit block runs only when `hitCount` is undefined or 1.

#### 4C — Bleed decay at end of enemy turn (in `endPlayerTurn`)

After `tickEnemyStatusEffects(enemy, ...)` (line ~1380), add:

```typescript
// AR-203: Bleed decays by BLEED_DECAY_PER_TURN at end of enemy turn
// Bleed does NOT amplify Poison ticks (Bleed only triggers on card-play damage).
const bleedEffect = enemy.statusEffects.find(e => e.type === 'bleed');
if (bleedEffect) {
  bleedEffect.value = Math.max(0, bleedEffect.value - BLEED_DECAY_PER_TURN);
  if (bleedEffect.value <= 0) {
    const idx = enemy.statusEffects.indexOf(bleedEffect);
    if (idx !== -1) enemy.statusEffects.splice(idx, 1);
  }
}
```

**Bleed vs Poison timing note:** Poison ticks at end of enemy turn via `tickEnemyStatusEffects`. Bleed decays AFTER that tick. Bleed does not amplify Poison ticks because Bleed only fires on `effect.damageDealt > 0` from a card play — Poison tick damage is applied directly to `enemy.currentHP` inside `tickEnemyStatusEffects`, not via `effect.damageDealt`. This separation is already correct by construction.

**Acceptance criteria:**
- Applying 6 Burn + 4 Burn to an enemy yields 10 Burn stacks (additive)
- Attacking enemy with 8 Burn: damage increases by 8, Burn becomes 4; next hit increases by 4, Burn becomes 2
- Multi-hit (hits = 2) with 8 Burn: hit 1 gets +8 (Burn → 4), hit 2 gets +4 (Burn → 2). Total Burn bonus = 12.
- Applying 5 Bleed then attacking: damage increases by 5. Bleed stacks unchanged after attack.
- Bleed decays by 1 at end of enemy turn. After 5 enemy turns, 5 Bleed → 0 (removed).
- Thorns retaliation damage (`applyDamageToEnemy` called directly in `endPlayerTurn`) does NOT trigger Burn or Bleed.
- Poison tick damage does NOT trigger Bleed (confirmed by construction — separate code path).
- Burn bonus is 0 when enemy has no Burn stacks.
- Bleed bonus is 0 when enemy has no Bleed stacks.
- `npm run typecheck` passes. `npx vitest run` passes.

---

### TODO-5: Self-Burn (player-side Burn) in `enemyManager.ts`

**File:** `src/services/enemyManager.ts`

**What:** Self-Burn is the mechanism by which the Volatile Manuscript relic causes the player to have Burn stacks applied to them — when the enemy attacks the player, the player's own Burn triggers and adds bonus damage to the incoming attack (the player takes more damage from their own Burn).

Self-Burn uses the same `triggerBurn` function, but called against `playerState.statusEffects` instead of `enemy.statusEffects`. The trigger point is when `intentResult.damage > 0` in `endPlayerTurn` — BEFORE `takeDamage` is called (so Burn bonus applies before block, consistent with enemy-targeting Burn).

In `turnManager.ts → endPlayerTurn`, in the `if (intentResult.damage > 0)` block, after computing `incomingDamage` (after enrage, ascension, canary multipliers) but BEFORE calling `takeDamage`, add:

```typescript
// AR-203: Self-Burn — player's own Burn stacks trigger when they are hit by enemy attack
// Works identically to enemy Burn: bonus = current stacks, then halves. Before block.
const selfBurnResult = triggerBurn(playerState.statusEffects);
if (selfBurnResult.bonusDamage > 0) {
  incomingDamage += selfBurnResult.bonusDamage;
  turnState.turnLog.push({
    type: 'status_tick',
    message: `Self-Burn triggered: +${selfBurnResult.bonusDamage} incoming damage`,
    value: selfBurnResult.bonusDamage,
  });
}
```

Note: `enemyManager.ts` itself does not need changes. The Self-Burn integration is entirely in `turnManager.ts`. The section is in this TODO for semantic clarity (it's the player-side analogue of the enemy-side Burn).

**Acceptance criteria:**
- Player with 8 Self-Burn stacks hit by enemy for 10: total incoming = 18 (before block), Burn → 4
- Self-Burn stacks can be applied to player via `applyStatusEffect(playerState.statusEffects, { type: 'burn', ... })`
- Self-Burn is cleansed by the `cleanse` and `adapt` mechanics (already handled — line 1044 and 1050 in turnManager already include `'burn'` in `debuffTypes`)
- `npx vitest run` passes

---

### TODO-6: Update status effect icon display in UI

**File:** Whichever Svelte component renders enemy/player status effect icons in the main combat screen. Based on the current codebase, the `CombatHUD.svelte` component is a legacy placeholder without status effect display. The active combat UI is rendered from Phaser scenes (`src/game/scenes/`). A dedicated `StatusEffectBar` component or equivalent likely needs to know about the new types.

**What:**
- Add `burn` and `bleed` to the icon/label map in the component that renders status effect pills/icons
- Burn: orange flame emoji (`🔥`) or sprite at `src/assets/ui/status/burn.png` (to be created separately), label `"Burn"`, color `#FF6B2B`
- Bleed: red droplet emoji (`💧` in red, or `🩸`) or sprite at `src/assets/ui/status/bleed.png` (to be created separately), label `"Bleed"`, color `#C0392B`
- Stack count displayed as a number overlaid on the icon (same pattern as existing Poison/Weakness display)
- Tooltip text:
  - Burn: `"Burn [N]: Next hit deals +N bonus damage, then halves."`
  - Bleed: `"Bleed [N]: Incoming card attacks deal +N damage. Decays 1/turn."`

**Acceptance criteria:**
- Burn and Bleed stacks display correctly when present on enemy
- Player Self-Burn displays on player status bar when active
- Display shows correct stack count after Burn halving
- No visual regressions on existing status effects (Poison, Weakness, Vulnerable, Strength)

---

### TODO-7: Update `docs/GAME_DESIGN.md`

**File:** `docs/GAME_DESIGN.md`

**What:** In the Status Effects section, add entries for Burn and Bleed:

```
**Burn** (debuff, enemy-targeting)
Applied to enemies by Ignite-type cards. When the target is hit by any attack card, Burn deals
bonus damage equal to current stacks, then halves (round down). Expires when reduced to 0.
Stacks additively. Triggers once per hit — Twin Strike triggers Burn twice (once per hit).
Does NOT trigger on Thorns/reflect damage. Self-Burn variant: player's own Burn stacks
trigger when they are hit by an enemy attack (same halving mechanic).

**Bleed** (debuff, enemy-targeting)
Applied to enemies by Lacerate-type cards. Each time the target takes damage from a card play,
Bleed adds +1 per stack to the incoming damage (before block). Stacks additively. Decays by 1
at end of each enemy turn. Does NOT trigger on passive damage (Poison ticks, Thorns, Burn).
```

**Acceptance criteria:**
- Both effects documented with correct trigger conditions, stacking rules, and decay timing
- Interaction table updated if one exists (Burn + multi-hit, Bleed + card-play vs passive)

---

### TODO-8: Update `data/inspection-registry.json`

**File:** `data/inspection-registry.json`

**What:** Add two entries to the `statusEffects` table:

```json
{
  "id": "burn",
  "name": "Burn",
  "status": "active",
  "lastChangedDate": "2026-03-21",
  "mechanicInspectionDate": "not_checked",
  "visualInspectionDate_portraitMobile": "not_checked",
  "visualInspectionDate_landscapeMobile": "not_checked",
  "visualInspectionDate_landscapePC": "not_checked",
  "uxReviewDate": "not_checked",
  "notes": "AR-203. On-hit: bonus = stacks, then halves. Self-Burn variant for player."
},
{
  "id": "bleed",
  "name": "Bleed",
  "status": "active",
  "lastChangedDate": "2026-03-21",
  "mechanicInspectionDate": "not_checked",
  "visualInspectionDate_portraitMobile": "not_checked",
  "visualInspectionDate_landscapeMobile": "not_checked",
  "visualInspectionDate_landscapePC": "not_checked",
  "uxReviewDate": "not_checked",
  "notes": "AR-203. +1/stack to card-play damage. Decays 1/turn at end of enemy turn."
}
```

Also update `lastChangedDate` to `"2026-03-21"` for `statusEffects` table entries touched by this AR: `poison` (tick system referenced in Bleed timing doc).

**Acceptance criteria:**
- Registry has both entries with `status: "active"`
- JSON is valid (`node -e "JSON.parse(require('fs').readFileSync('data/inspection-registry.json'))"`)

---

## Files Affected

| File | Change |
|---|---|
| `src/data/statusEffects.ts` | Add `'burn'`, `'bleed'` to `StatusEffectType`; add `triggerBurn()`, `getBleedBonus()` |
| `src/data/balance.ts` | Add 4 constants: `BURN_HALVE_ON_HIT`, `BURN_ROUND_DOWN`, `BLEED_BONUS_PER_STACK`, `BLEED_DECAY_PER_TURN` |
| `src/services/cardEffectResolver.ts` | Add `applyBurnStacks?`, `applyBleedStacks?`, `hitCount?` to `CardEffectResult`; split `multi_hit` into per-hit for Burn |
| `src/services/turnManager.ts` | Steps 11–12 in attack pipeline; Bleed decay at end of enemy turn; Self-Burn on enemy attack |
| `src/ui/components/<StatusEffectDisplay>` | Add Burn and Bleed icon/label/tooltip entries |
| `docs/GAME_DESIGN.md` | Document Burn and Bleed in Status Effects section |
| `data/inspection-registry.json` | Add Burn and Bleed entries to `statusEffects` table |

---

## Verification Gate

- [ ] `npm run typecheck` — zero errors
- [ ] `npm run build` — clean build
- [ ] `npx vitest run` — all tests pass (1900+)
- [ ] Unit tests written for `triggerBurn` (8→4→2→1→0 halving chain; additive stacking; no-stacks = 0 bonus)
- [ ] Unit tests written for `getBleedBonus` (N stacks = N bonus; 0 stacks = 0)
- [ ] Headless sim run (500 runs, any profile): Burn + Bleed don't cause crashes or NaN damage: `npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 500`
- [ ] Visual inspection via Playwright: enemy Burn/Bleed icons display after applying stacks via `__terraScenario.load('combat-basic')`, then triggering via `window.__terraDebug()`
- [ ] Confirm Bleed does NOT tick during Poison tick (check turn log shows no Bleed entry on `status_tick` lines for enemy turn passive damage)
- [ ] Confirm Burn does NOT trigger on Thorns retaliation (applyDamageToEnemy direct call path has no Burn trigger)
- [ ] Confirm Twin Strike (multi_hit, 2 hits) with 8 Burn: turn log shows "Burn (hit 1): +8" and "Burn (hit 2): +4"
- [ ] Confirm Self-Burn: player with 8 Burn stacks receives enemy attack — turn log shows "Self-Burn triggered: +8 incoming damage"

---

## Edge Cases and Clarifications

**Burn at 1 stack:** Triggers for +1 bonus damage, halves to 0.5 → floor = 0, expires. One-shot.

**Burn stacking mid-combat:** If a card applies 4 Burn and the enemy already has 3 Burn, total = 7 Burn (additive via `applyStatusEffect`). `turnsRemaining` is set to max(existing, new) = 99 in both cases, which is fine.

**Bleed at 1 stack:** Adds +1 to next card-play damage. Decays to 0 and is removed at end of enemy turn.

**Bleed with Poison:** Poison ticks at end of enemy turn via `tickEnemyStatusEffects`. Bleed decay happens AFTER the tick. Bleed bonus = 0 on Poison ticks because Poison applies damage inside `tickEnemyStatusEffects` directly to `enemy.currentHP`, completely bypassing the `effect.damageDealt > 0` path where Bleed is checked. This is correct by construction with no extra guard needed.

**Burn + Vulnerable:** Burn bonus is added to `effect.damageDealt` AFTER the Vulnerable check inside `applyAttackDamage` (which is called first to compute base damage). Because Burn is added as a flat bonus to the already-Vulnerable-scaled damage total, Burn bonus is effectively multiplied by the Vulnerable 1.5× factor. This may be intentional (Vulnerable makes you take more damage including bonus damage sources) but should be confirmed against the expansion spec. If Burn should NOT scale with Vulnerable, add Burn bonus after `applyDamageToEnemy` as pierce-style damage, bypassing block and Vulnerable scaling. **Default implementation: Burn bonus is added to `effect.damageDealt` BEFORE `applyDamageToEnemy` — this means it IS affected by block and IS consistent with the spec statement "before block".**

Wait — re-reading the spec: Burn bonus is added "BEFORE block" (step 11). `applyDamageToEnemy` handles block subtraction. Vulnerable is applied inside `applyAttackDamage` in `cardEffectResolver.ts` before the value reaches `turnManager.ts`. By the time `effect.damageDealt` is set in the resolver, Vulnerable is already baked in. So the Burn bonus added in `turnManager.ts` is NOT double-multiplied by Vulnerable — it's added after Vulnerable scaling. This is the correct behaviour.

**Self-Burn cleanse:** The cleanse mechanic already includes `'burn'` in its `debuffTypes` set (turnManager line 1044 and 1050). Self-Burn stacks on the player will be correctly cleansed by Cleanse and Adapt cards. No additional change needed.

**Burn `turnsRemaining` sentinel:** Using 99 as a sentinel for "doesn't expire by tick" means after 99 enemy turns, the effect technically reaches turnsRemaining = 0 and gets removed by `tickStatusEffects`. This is acceptable — encounters virtually never last 99 turns, and Burn will have halved to 0 naturally long before then.
