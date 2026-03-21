# AR-116: Combat & UI Polish Mega-Sprint

## Overview
19 issues identified during playtesting. Organized into sub-ARs by system area. Each sub-AR is independently implementable.

---

## AR-116.1: Remove Old Upgrade Border from Cards
**Priority**: High | **Complexity**: Trivial
**Issue**: Cards with `masteryLevel > 0` get `card.isUpgraded = true` (backwards compat), which triggers a blue/green glow border via `.card-upgraded` CSS class. This is redundant — mastery is now shown via the upgrade icon.
**Fix**: Remove the `.card-upgraded` CSS rules in `CardHand.svelte` (lines ~2245-2248). Keep the `class:card-upgraded` binding but make the CSS empty/removed so it has no visual effect. OR remove the class binding entirely from all 4 card instances.
**Files**: `src/ui/components/CardHand.svelte`

---

## AR-116.2: Fix Charge Preview Damage Display
**Priority**: High | **Complexity**: Medium
**Issue**: When dragging a card toward the charge zone, the golden preview number still uses `mechanic.chargeCorrectValue` (old 3x values) instead of `quickPlayValue * 1.5`. The actual combat resolution uses 1.5x correctly, but the UI preview is wrong.
**Fix**: In `CardHand.svelte`, function `getEffectValue(card, chargeMode)` (lines ~135-141) — when `chargeMode=true`, change from `mechanic.chargeCorrectValue` to `Math.round(mechanic.quickPlayValue * 1.5)`. Import `CHARGE_CORRECT_MULTIPLIER` from balance.ts.
Also: the preview must include mastery bonus. Show `Math.round(mechanic.quickPlayValue * 1.5) + getMasteryBaseBonus(card.mechanicId, card.masteryLevel)`.
**Files**: `src/ui/components/CardHand.svelte`

---

## AR-116.3: Fix Damage Number Popup Values
**Priority**: High | **Complexity**: Medium
**Issue**: The floating damage number shown during combat (via juiceManager) uses `card.baseEffectValue * card.effectMultiplier` which is the card's base stat, not the resolved effect value (which includes mastery, charge multiplier, combo, relics, etc.).
**Fix**: The actual resolved damage is returned in `PlayCardResult.effect.finalValue`. Pass this value to the juice manager instead of computing from raw card stats. Update `handleCastDirect` and `handleAnswer` in `CardCombatOverlay.svelte` to use the resolved value from `turnState` after `onplaycard`.
**Files**: `src/ui/components/CardCombatOverlay.svelte`

---

## AR-116.4: Reward Room Auto-Continue
**Priority**: Medium | **Complexity**: Low
**Issue**: After collecting all items in a reward room, the game doesn't auto-continue. `checkAutoAdvance()` exists in `RewardRoomScene.ts` but may not fire reliably.
**Fix**: Verify `checkAutoAdvance()` is called after every item collection in `handleItemTap()`. Check the `sceneComplete` event listener in `rewardRoomBridge.ts`. Add fallback: if all items collected and no advance after 2s, force advance.
**Files**: `src/game/scenes/RewardRoomScene.ts`, `src/services/rewardRoomBridge.ts`

---

## AR-116.5: Study Quiz Visual Bugs
**Priority**: Medium | **Complexity**: Low
**Issue**: (a) Selected answer button stays purple/highlighted when advancing to next question. (b) Completion screen says "all cards upgraded" which is misleading. (c) No visual feedback showing which card got upgraded.
**Fix**:
- (a) In `StudyQuizOverlay.svelte`, ensure answer button styles fully reset. May need to force re-render with `{#key currentIndex}` wrapper around answer buttons.
- (b) Change completion text to show "X/3 cards mastered up!" with the specific card names.
- (c) After each correct answer, briefly show the card with its new mastery icon (similar to combat mastery popup).
**Files**: `src/ui/components/StudyQuizOverlay.svelte`, `src/services/gameFlowController.ts`

---

## AR-116.6: Map Room Distribution Rebalance
**Priority**: High | **Complexity**: Medium
**Issue**: Too many rest sites, not enough shops. Need: exactly 1 rest before boss, 1 rest randomly placed, 2 shops intelligently placed, 2 mystery rooms, rest are enemies.
**Fix**: Update `ROOM_DISTRIBUTION` weights in `balance.ts` and the guarantee logic in `mapGenerator.ts`:
- Row 6 (pre-boss): always rest (already exists)
- Rows 1-5: exactly 1 more rest (random placement)
- Rows 1-5: exactly 2 shops (spaced apart)
- Rows 1-5: exactly 2 mystery rooms (not adjacent to shops)
- Remaining nodes: combat/elite
**Files**: `src/data/balance.ts`, `src/services/mapGenerator.ts`

---

## AR-116.7: Discard Pile Empty State Border
**Priority**: Low | **Complexity**: Trivial
**Issue**: When discard pile is empty, the border is too thin to see.
**Fix**: Add CSS for empty state: `.discard-pile-indicator .pile-card-stack` when `discardStackCount === 0`, increase border to 3px and boost opacity.
**Files**: `src/ui/components/CardCombatOverlay.svelte`

---

## AR-116.8: AP Orb Position Lower on Mobile
**Priority**: Medium | **Complexity**: Trivial
**Issue**: AP orb is too high on mobile portrait. Needs to be 10% lower.
**Fix**: In `.ap-orb` CSS, change `top` from `calc(16px * scale + safe-top)` to add `10vh` offset, or adjust to `bottom: 45vh` → `bottom: 35vh` (lowering it).
**Files**: `src/ui/components/CardCombatOverlay.svelte`

---

## AR-116.9: Enemy Intent Repositioning
**Priority**: Medium | **Complexity**: Low
**Issue**: Enemy intent bubble should be positioned top-left of the enemy sprite (not top-right), with more padding around the text.
**Fix**: Change `.enemy-intent-bubble` from `right: 16px` to `left: 16px`. Increase padding to `calc(10px * scale) calc(14px * scale)`.
**Files**: `src/ui/components/CardCombatOverlay.svelte`

---

## AR-116.10: Relic Audit (Full Validation)
**Priority**: Critical | **Complexity**: Large
**Issue**: Relics may not be working correctly. Every single relic effect needs testing.
**This will be its own dedicated AR** — AR-117 (see below). Requires:
- Listing all relics and their expected effects
- Unit test for each relic trigger condition
- Visual verification in combat
- Fix any broken relics

---

## AR-116.11: Remove Relic Sell During Combat
**Priority**: Medium | **Complexity**: Low
**Issue**: Tapping a relic during combat shows a sell option. Should only show info during combat, sell only in shop/hub.
**Fix**: In `CardCombatOverlay.svelte`, pass `onsell={undefined}` or remove the onsell prop when rendering RelicTray during combat. Keep sell functionality in shop/hub contexts.
**Files**: `src/ui/components/CardCombatOverlay.svelte`, `src/ui/components/RelicTray.svelte`

---

## AR-116.12: Double Reward Room / Missing Enemy Sprite
**Priority**: High | **Complexity**: Medium
**Issue**: Reward room appeared double, then combat loaded without enemy sprite (just background). Likely a scene cleanup/re-entry bug.
**Fix**: Add guard in `RewardRoomScene.create()` to prevent double initialization. In `CombatScene`, add fallback when enemy sprite fails to load. Check encounterBridge for race conditions in room transitions.
**Files**: `src/game/scenes/RewardRoomScene.ts`, `src/game/scenes/CombatScene.ts`, `src/services/encounterBridge.ts`

---

## AR-116.13: Fix Charge Description for Non-Damage Cards
**Priority**: Medium | **Complexity**: Medium
**Issue**: Charging a Focus card shows "Next card costs 1 less AP" — same as quick play. Should show the charged bonus (e.g., "Next 2 cards cost 1 less AP"). Same issue for other utility/buff/debuff cards.
**Fix**: In `cardDescriptionService.ts`, the `getCardDescriptionParts` function needs a `chargeMode` parameter. When `chargeMode=true`, utility mechanics show their enhanced values:
- Focus: "Next 2 cards" instead of "Next card"
- Scout: +1 extra draw
- Empower: higher percentage
The charge preview in CardHand already calls `getCardDescriptionParts(card, undefined, chargeValue)` — extend this to pass a charge flag.
**Files**: `src/services/cardDescriptionService.ts`, `src/ui/components/CardHand.svelte`

---

## AR-116.14: Mastery Level Cap Per Mechanic
**Priority**: Low | **Complexity**: Design decision
**Issue**: Some mechanics don't benefit meaningfully from 5 mastery levels (immunity, overclock, cleanse are binary). Consider capping their max mastery at 2-3.
**Decision needed**: Which mechanics cap at which level? Add `maxMasteryLevel` field to `MasteryUpgradeDef`.
**Files**: `src/services/cardUpgradeService.ts`

---

## AR-116.15: Enemy HP Bar Shows Numbers
**Priority**: Low | **Complexity**: Trivial
**Issue**: Already implemented — `CombatScene.ts` line 1781 shows `current/max`. May be a Phaser text visibility issue. Verify in-game.
**Files**: `src/game/scenes/CombatScene.ts`

---

## AR-116.16: AP Cost Font Readability
**Priority**: Medium | **Complexity**: Low
**Issue**: AP cost on cards could use a more readable font. Current: Cinzel serif with 1.5px stroke.
**Fix**: Increase `-webkit-text-stroke` to 2px, increase font weight contrast, or switch to a cleaner pixel-style font. Consider adding a dark circle background behind the number.
**Files**: `src/ui/components/CardHand.svelte`

---

## AR-116.17: Replace Combo with Chain-Only Display
**Priority**: High | **Complexity**: Medium
**Issue**: Both combo multiplier and chain display show simultaneously. User wants: remove combo counter entirely, show only chain display in bottom-left corner, in the chain's color, format "Chain: 1.3x", reset after each turn.
**Fix**:
- Remove the combo-counter div and all combo CSS from `ComboCounter.svelte`
- Move chain display to bottom-left (was bottom-right)
- Color the chain text with `getChainTypeColor(chainType)`
- Format as "Chain: {multiplier}x"
- Ensure chain resets each turn (already happens via `extendOrResetChain`)
- Remove `isPerfectTurn` / `PERFECT!` display (or keep as a subtle effect only)
**Files**: `src/ui/components/ComboCounter.svelte`, `src/ui/components/CardCombatOverlay.svelte`

---

## Execution Order (by priority)

1. **AR-116.1** — Remove upgrade border (trivial, high impact)
2. **AR-116.2** — Fix charge preview damage (high priority)
3. **AR-116.3** — Fix damage popup values (high priority)
4. **AR-116.17** — Chain-only display (high priority, user request)
5. **AR-116.6** — Map room distribution (high priority)
6. **AR-116.12** — Double reward / missing sprite (high priority)
7. **AR-116.5** — Study quiz fixes (medium)
8. **AR-116.11** — Remove relic sell in combat (medium)
9. **AR-116.13** — Charge description for non-damage cards (medium)
10. **AR-116.8** — AP orb position (medium)
11. **AR-116.9** — Enemy intent position (medium)
12. **AR-116.16** — AP cost font (medium)
13. **AR-116.4** — Reward auto-continue (medium)
14. **AR-116.7** — Discard pile border (low)
15. **AR-116.15** — Enemy HP numbers (low, verify only)
16. **AR-116.14** — Mastery level cap (design decision)
17. **AR-116.10** — Relic audit → separate AR-117

## Verification Gate
- [ ] All sub-ARs implemented and verified
- [ ] `npm run typecheck` — 0 errors
- [ ] `npm run build` — clean
- [ ] `npx vitest run` — no new failures
- [ ] Visual inspection of each fix via Playwright or device
