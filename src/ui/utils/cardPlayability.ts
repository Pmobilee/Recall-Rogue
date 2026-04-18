/**
 * cardPlayability.ts — Unified card playability predicates.
 *
 * Extracted from CardHand.svelte to fix Issues 6+10:
 * Two out-of-sync predicates caused the charge button to be enabled
 * visually but disabled functionally when AP was borderline.
 *
 * ## The Bug (Issues 6+10)
 * - `hasEnoughAp` (visual gate) only checked Quick Play cost: `max(0, effectiveCost - focusDiscount) <= apCurrent`
 * - `chargeAffordable` (button disabled gate) checked the REAL charge cost: QP cost + 1 surcharge
 *   (waived on momentum match / active chain match)
 * - Gap: apCurrent=1, baseCost=1, NO chain match → QP shows "playable" (1<=1), charge cost=2 → button disabled
 *   The card appeared playable but clicking did nothing (Issue 6).
 * - apCurrent=0, baseCost=1, chain match → QP cost=1, charge cost=1+0=1 > 0 → card should NOT be playable
 *   but `hasEnoughAp` returned true for charge-match scenario (Issue 10).
 *
 * ## Fix
 * Single source of truth: `canChargeCard` computes the real charge cost with all waivers.
 * `isCardPlayable` = QP-affordable OR charge-affordable.
 * Both the visual `.card-playable` class and the button `disabled` prop use these functions.
 *
 * ## Balance Pass 3 Note
 * Surge turns no longer waive the charge surcharge — they grant +1 bonus AP at turn-start
 * (SURGE_BONUS_AP in turnManager.ts). isSurgeActive is intentionally NOT a waiver here.
 */

import type { Card } from '../../data/card-types'
import { getEffectiveApCost } from '../../services/cardUpgradeService'

/** Context needed to evaluate charge affordability for a card. */
export interface ChargeContext {
  /** Current AP the player has. */
  apCurrent: number
  /** AP discount from Focus status: 1 when active, 0 otherwise. */
  focusDiscount: number
  /** True when the card's chain type matches the momentum chain type. */
  isMomentumMatch: boolean
  /** True when the card's chain type matches the active chain color for this turn. */
  isActiveChainMatch: boolean
}

/**
 * Returns the effective charge AP cost for a card given the current combat context.
 * Charge cost = max(0, effectiveCost − focusDiscount) + 1 surcharge.
 * Surcharge is waived when: isMomentumMatch OR isActiveChainMatch.
 * NOTE: Surge turns do NOT waive the surcharge (Balance Pass 3) — they grant +1 AP at turn-start instead.
 */
export function getChargeApCost(card: Card, ctx: ChargeContext): number {
  const base = Math.max(0, getEffectiveApCost(card) - ctx.focusDiscount)
  const surchargeWaived = ctx.isMomentumMatch || ctx.isActiveChainMatch
  return base + (surchargeWaived ? 0 : 1)
}

/**
 * Returns true when the player has enough AP to charge this card.
 * This is the unified gate — used for BOTH the charge button disabled state
 * AND contributing to the visual card-playable class.
 */
export function canChargeCard(card: Card, ctx: ChargeContext): boolean {
  return getChargeApCost(card, ctx) <= ctx.apCurrent
}

/**
 * Returns true when the player has enough AP for a Quick Play (no quiz).
 * Quick Play cost = max(0, effectiveCost − focusDiscount).
 */
export function canQuickPlayCard(card: Card, ctx: Pick<ChargeContext, 'apCurrent' | 'focusDiscount'>): boolean {
  return Math.max(0, getEffectiveApCost(card) - ctx.focusDiscount) <= ctx.apCurrent
}

/**
 * Returns true when a card should show the `.card-playable` visual state.
 * A card is playable when EITHER Quick Play OR Charge is affordable.
 * This preserves Quick Play as the fallback always-visible path
 * while fixing the charge-gate desync.
 *
 * NOTE: `isMastered` (tier === '3') cards can still be Quick Played but cannot
 * be charged — the caller should NOT pass a mastered card to this function
 * unless the caller handles the mastery gate separately. This function does
 * not enforce the mastery constraint; it just checks AP.
 */
export function isCardPlayable(card: Card, ctx: ChargeContext): boolean {
  return canQuickPlayCard(card, ctx) || canChargeCard(card, ctx)
}
