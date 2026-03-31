/**
 * Damage Preview Service — computes effective Quick Play and Charge Correct
 * damage/block values for display purposes only. Pure function, no side effects.
 *
 * Mirrors the cardEffectResolver damage pipeline but:
 * - Does NOT call resolveAttackModifiers/resolveShieldModifiers (they have audio side effects)
 * - Computes relic bonuses inline from the same constants
 * - Uses conservative defaults for unknowable per-play context
 */

import type { Card } from '../data/card-types';
import { getMechanicDefinition } from '../data/mechanics';
import { getMasteryBaseBonus } from './cardUpgradeService';
import {
  CHARGE_CORRECT_MULTIPLIER,
  CURSED_QP_MULTIPLIER,
  CURSED_CHARGE_CORRECT_MULTIPLIER,
} from '../data/balance';

export interface DamagePreviewContext {
  activeRelicIds: Set<string>;
  /** Empower percentage (0 = no buff) */
  buffNextCard: number;
  overclockReady: boolean;
  doubleStrikeReady: boolean;
  firstAttackUsed: boolean;
  /** 0..1 fraction of player max HP */
  playerHpPercent: number;
  /** 0..1 fraction of enemy max HP */
  enemyHpPercent: number;
  enemyPoisonStacks: number;
  enemyBurnStacks: number;
  enemyIsVulnerable: boolean;
  /** e.g. 0.3 for Core Harbinger — applied to QP only */
  enemyQpDamageMultiplier?: number;
  /** Charge-resistant enemies take 50% QP damage */
  enemyChargeResistant: boolean;
  /** Flat armor on QP attacks; 0 if none */
  enemyHardcover: number;
  /** True if hardcover has been broken this encounter */
  enemyHardcoverBroken: boolean;
  /** Flat damage bonus from active Inscription of Fury */
  inscriptionFuryBonus: number;
  /** Number of cards played this turn (for ritual_blade, momentum_wheel) */
  cardsPlayedThisTurn: number;
  /** Encounter turn number (for hollow_armor; 0 = first turn) */
  encounterTurnNumber: number;
  /** Accumulated wrong-charge count for scar_tissue flat bonus */
  scarTissueStacks: number;
}

export interface DamagePreview {
  /** Effective Quick Play damage/block */
  qpValue: number;
  /** Effective Charge Correct damage/block */
  ccValue: number;
  qpModified: 'buffed' | 'nerfed' | 'neutral';
  ccModified: 'buffed' | 'nerfed' | 'neutral';
}

/** Classify effective vs naked base as buffed/nerfed/neutral. */
function classify(effective: number, base: number): 'buffed' | 'nerfed' | 'neutral' {
  if (effective > base) return 'buffed';
  if (effective < base) return 'nerfed';
  return 'neutral';
}

/**
 * Compute inline attack relic bonuses without audio side effects.
 * Returns { flat, percent } adjustments that mirror resolveAttackModifiers.
 */
function computeAttackRelicBonuses(
  relicIds: Set<string>,
  ctx: DamagePreviewContext,
  isStrikeTagged: boolean,
  cardTier: string,
): { flat: number; percent: number } {
  let flat = 0;
  let percent = 0;

  // whetstone — all attacks +3 flat
  if (relicIds.has('whetstone')) flat += 3;

  // barbed_edge — strike-tagged +2 flat (from resolveAttackModifiers; +3 comes from
  // cardEffectResolver inline via sharpenedEdgeBonus, counted separately in the base)
  if (relicIds.has('barbed_edge') && isStrikeTagged) flat += 2;

  // executioners_axe — <30% enemy HP: +5 flat
  if (relicIds.has('executioners_axe') && ctx.enemyHpPercent < 0.3) flat += 5;

  // scar_tissue — +2 flat per accumulated wrong-charge stack
  if (relicIds.has('scar_tissue') && ctx.scarTissueStacks > 0) flat += ctx.scarTissueStacks * 2;

  // dragon_s_heart — passive +2 flat
  if (relicIds.has('dragon_s_heart')) flat += 2;

  // flame_brand — first attack +40%
  if (relicIds.has('flame_brand') && !ctx.firstAttackUsed) percent += 0.4;

  // red_fang — first attack +30%
  if (relicIds.has('red_fang') && !ctx.firstAttackUsed) percent += 0.3;

  // berserker_band — <50% HP: +40%
  if (relicIds.has('berserker_band') && ctx.playerHpPercent < 0.5) percent += 0.4;

  // glass_cannon — always +35%
  if (relicIds.has('glass_cannon')) percent += 0.35;

  // reckless_resolve — <40% HP: +50%; >80% HP: -15%
  if (relicIds.has('reckless_resolve')) {
    if (ctx.playerHpPercent < 0.4) percent += 0.5;
    else if (ctx.playerHpPercent > 0.8) percent -= 0.15;
  }

  // volatile_core — always +50%
  if (relicIds.has('volatile_core')) percent += 0.5;

  // festering_wound — 3+ poison on enemy: +40%
  if (relicIds.has('festering_wound') && ctx.enemyPoisonStacks >= 3) percent += 0.4;

  // curiosity_gem — tier 1 (learning) cards +15%
  if (relicIds.has('curiosity_gem') && cardTier === '1') percent += 0.15;

  // null_shard — always +25%
  if (relicIds.has('null_shard')) percent += 0.25;

  // berserker_s_oath — always +40%
  if (relicIds.has('berserker_s_oath')) percent += 0.4;

  // inferno_crown — enemy has both burn AND poison: +30%
  if (relicIds.has('inferno_crown') && ctx.enemyBurnStacks > 0 && ctx.enemyPoisonStacks > 0) {
    percent += 0.3;
  }

  // ember_core — 5+ burn stacks: +20%
  if (relicIds.has('ember_core') && ctx.enemyBurnStacks >= 5) percent += 0.2;

  // ritual_blade — first card this turn: +100%; subsequent: -25%
  // Note: these are huge swings; previews show conservative default (first card)
  if (relicIds.has('ritual_blade')) {
    if (ctx.cardsPlayedThisTurn === 0) percent += 1.0;
    else percent -= 0.25;
  }

  // momentum_wheel — 4th+ card this turn: +100%
  if (relicIds.has('momentum_wheel') && ctx.cardsPlayedThisTurn >= 4) percent += 1.0;

  return { flat, percent };
}

/**
 * Compute effective Quick Play and Charge Correct damage/block for display.
 *
 * This is a pure display function — it does NOT affect actual gameplay.
 * Integer math matches the real damage pipeline.
 */
export function computeDamagePreview(card: Card, ctx: DamagePreviewContext): DamagePreview {
  const mechanic = getMechanicDefinition(card.mechanicId);
  const effectiveType = card.cardType;

  // ── Compute naked bases (no modifiers) for classification comparison ──────
  let nakedQpBase: number;
  let nakedCcBase: number;

  if (mechanic) {
    const masteryBonus = getMasteryBaseBonus(card.mechanicId ?? '', card.masteryLevel ?? 0);
    nakedQpBase = mechanic.quickPlayValue + masteryBonus;
    nakedCcBase = Math.round(mechanic.quickPlayValue * CHARGE_CORRECT_MULTIPLIER) + masteryBonus;
  } else {
    // Legacy fallback: tier-scaled base effect value
    nakedQpBase = Math.round(card.baseEffectValue * card.effectMultiplier);
    nakedCcBase = Math.round(nakedQpBase * CHARGE_CORRECT_MULTIPLIER);
  }

  // ── Early return for non-attack/shield cards ──────────────────────────────
  if (effectiveType !== 'attack' && effectiveType !== 'shield') {
    const overclockMult = ctx.overclockReady ? 2 : 1;
    const buffMult = 1 + ctx.buffNextCard / 100;
    const qp = Math.round(nakedQpBase * buffMult * overclockMult);
    const cc = Math.round(nakedCcBase * buffMult * overclockMult);
    return {
      qpValue: qp,
      ccValue: cc,
      qpModified: classify(qp, nakedQpBase),
      ccModified: classify(cc, nakedCcBase),
    };
  }

  // ── Attack cards ──────────────────────────────────────────────────────────
  if (effectiveType === 'attack') {
    const isStrikeTagged = mechanic?.tags.includes('strike') ?? false;

    // Step 1: mechanic base + mastery
    let qpBase = nakedQpBase;
    let ccBase = nakedCcBase;

    // Step 2: cursed multipliers
    if (card.isCursed) {
      let qpCursedMult = CURSED_QP_MULTIPLIER; // 0.7
      if (ctx.activeRelicIds.has('scar_tissue')) qpCursedMult = 0.85;
      qpBase = Math.round(qpBase * qpCursedMult);
      ccBase = Math.round(ccBase * CURSED_CHARGE_CORRECT_MULTIPLIER); // 1.0 — no change
    }

    // Step 3: barbed_edge +3 (mirrors cardEffectResolver sharpenedEdgeBonus, not resolveAttackModifiers)
    const sharpenedEdgeBonus = isStrikeTagged && ctx.activeRelicIds.has('barbed_edge') ? 3 : 0;

    // Step 4: inscription fury bonus
    const furyBonus = ctx.inscriptionFuryBonus;

    // effectiveBase
    const qpEffective = qpBase + sharpenedEdgeBonus + furyBonus;
    const ccEffective = ccBase + sharpenedEdgeBonus + furyBonus;

    // Step 5: card effectMultiplier (tier-derived)
    const qpScaled = qpEffective * card.effectMultiplier;
    const ccScaled = ccEffective * card.effectMultiplier;

    // Step 6: buff multiplier
    const buffMult = 1 + ctx.buffNextCard / 100;

    // Step 7: inline relic bonuses (pure, no audio)
    const relicBonuses = computeAttackRelicBonuses(
      ctx.activeRelicIds,
      ctx,
      isStrikeTagged,
      card.tier,
    );
    const attackRelicMult = 1 + relicBonuses.percent;

    // Step 8: overclock
    const overclockMult = ctx.overclockReady ? 2 : 1;

    // Step 9: scale and add flat relic bonuses after multipliers
    let qpFinal = Math.round(qpScaled * buffMult * attackRelicMult * overclockMult) + relicBonuses.flat;
    let ccFinal = Math.round(ccScaled * buffMult * attackRelicMult * overclockMult) + relicBonuses.flat;

    // Step 10: enemy-side QP modifiers (QP only)
    if (ctx.enemyQpDamageMultiplier !== undefined) {
      qpFinal = Math.max(1, Math.round(qpFinal * ctx.enemyQpDamageMultiplier));
    }
    if (ctx.enemyHardcover > 0 && !ctx.enemyHardcoverBroken) {
      qpFinal = Math.max(1, qpFinal - ctx.enemyHardcover);
    }
    if (ctx.enemyChargeResistant) {
      qpFinal = Math.max(1, Math.round(qpFinal * 0.5));
    }

    // Step 11: vulnerable (both QP and CC)
    if (ctx.enemyIsVulnerable) {
      qpFinal = Math.round(qpFinal * 1.5);
      ccFinal = Math.round(ccFinal * 1.5);
    }

    // Step 12: double strike (doubles total damage)
    if (ctx.doubleStrikeReady) {
      qpFinal *= 2;
      ccFinal *= 2;
    }

    return {
      qpValue: qpFinal,
      ccValue: ccFinal,
      qpModified: classify(qpFinal, nakedQpBase),
      ccModified: classify(ccFinal, nakedCcBase),
    };
  }

  // ── Shield cards ──────────────────────────────────────────────────────────
  const relicIds = ctx.activeRelicIds;

  let qpShield = nakedQpBase * card.effectMultiplier;
  let ccShield = nakedCcBase * card.effectMultiplier;

  // stone_wall: +3 flat
  const stoneWallFlat = relicIds.has('stone_wall') ? 3 : 0;
  // whetstone: -1 flat penalty on shields
  const whetstonePenalty = relicIds.has('whetstone') ? -1 : 0;
  const shieldFlatBonus = stoneWallFlat + whetstonePenalty;

  // worn_shield v2: -20% block
  const wornShieldMult = relicIds.has('worn_shield') ? 0.8 : 1.0;

  // hollow_armor: block disabled after turn 0
  if (relicIds.has('hollow_armor') && ctx.encounterTurnNumber > 0) {
    return {
      qpValue: 0,
      ccValue: 0,
      qpModified: 'nerfed',
      ccModified: 'nerfed',
    };
  }

  // bastions_will: +25% on QP only (CC path gets +75% in turnManager; preview uses +25%)
  const bastionsWillQpMult = relicIds.has('bastions_will') ? 1.25 : 1.0;

  const buffMult = 1 + ctx.buffNextCard / 100;
  const overclockMult = ctx.overclockReady ? 2 : 1;

  let qpFinalShield = Math.round((qpShield + shieldFlatBonus) * wornShieldMult * bastionsWillQpMult * buffMult * overclockMult);
  let ccFinalShield = Math.round((ccShield + shieldFlatBonus) * wornShieldMult * buffMult * overclockMult);

  qpFinalShield = Math.max(0, qpFinalShield);
  ccFinalShield = Math.max(0, ccFinalShield);

  return {
    qpValue: qpFinalShield,
    ccValue: ccFinalShield,
    qpModified: classify(qpFinalShield, nakedQpBase),
    ccModified: classify(ccFinalShield, nakedCcBase),
  };
}
