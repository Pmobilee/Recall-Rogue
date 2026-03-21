// === Card Effect Resolver ===
// Resolves card play into effect results. Does not mutate player/enemy state.

import type { Card, CardType } from '../data/card-types';
import type { StatusEffect } from '../data/statusEffects';
import type { PlayerCombatState } from './playerCombatState';
import type { EnemyInstance } from '../data/enemies';
import {
  BASE_EFFECT,
  LEGACY_TIER_MULTIPLIER,
  TIER_MULTIPLIER,
  CHARGE_CORRECT_MULTIPLIER,
  getBalanceOverrides,
  CURSED_QP_MULTIPLIER,
  CURSED_CHARGE_CORRECT_MULTIPLIER,
  CURSED_CHARGE_WRONG_MULTIPLIER,
} from '../data/balance';
import { getMasteryBaseBonus, getMasterySecondaryBonus } from './cardUpgradeService';
import { isVulnerable } from '../data/statusEffects';
import { getMechanicDefinition, type PlayMode } from '../data/mechanics';
import { resolveAttackModifiers, resolveShieldModifiers, resolvePoisonDurationBonus } from './relicEffectResolver';

export interface CardEffectResult {
  effectType: CardType;
  rawValue: number;
  finalValue: number;
  targetHit: boolean;
  damageDealt: number;
  shieldApplied: number;
  healApplied: number;
  statusesApplied: StatusEffect[];
  extraCardsDrawn: number;
  enemyDefeated: boolean;
  mechanicId?: string;
  mechanicName?: string;
  damageDealtBypassesBlock?: boolean;
  selfDamage?: number;
  reflectDamage?: number;
  persistentShield?: number;
  parryDrawBonus?: number;
  overhealToShield?: number;
  grantsAp?: number;
  applyDoubleStrikeBuff?: boolean;
  /** double_strike charge bonus: next attack also pierces (charge_correct only). */
  doubleStrikeAddsPierce?: boolean;
  applyFocusBuff?: boolean;
  /** Number of cards that will benefit from Focus AP reduction (1 = normal, 2 = Focus+). */
  focusCharges?: number;
  applySlow?: boolean;
  applyForesight?: boolean;
  applyTransmute?: boolean;
  applyImmunity?: boolean;
  applyOverclock?: boolean;
  drawCountOverride?: number;
  /** thorns: reflect this much damage back to enemy when hit */
  thornsValue?: number;
  /** cleanse: remove debuffs from player */
  applyCleanse?: boolean;
  /** mirror: copy the previous card's full effect result */
  mirrorCopy?: boolean;
  /** adapt: cleanse one random debuff from player */
  adaptCleanse?: boolean;
  /** foresight charge_correct bonus: reveal the next enemy intent */
  revealNextIntent?: boolean;
  /** recycle charge_correct bonus: number of cards to draw from discard pile */
  drawFromDiscard?: number;
  /** AR-203: Burn stacks to apply to the target on this card play. */
  applyBurnStacks?: number;
  /** AR-203: Bleed stacks to apply to the target on this card play. */
  applyBleedStacks?: number;
  /**
   * AR-203: If set, this card's damage was resolved as N separate hits.
   * Burn triggers once per hit (halving after each). turnManager resolves per-hit loop.
   * When hitCount > 1, damageDealt in this result is the PER-HIT base value (not total).
   */
  hitCount?: number;
}

export interface AdvancedResolveOptions {
  activeRelicIds?: Set<string>;
  isFirstAttackThisEncounter?: boolean;
  isDoubleStrikeActive?: boolean;
  isFocusActive?: boolean;
  isOverclockActive?: boolean;
  damageDealtThisTurn?: number;
  /** Whether the card was answered correctly. Defaults to true. */
  correct?: boolean;
  /** How the card was played (quick/charge/charge_correct/charge_wrong). */
  playMode?: PlayMode;
  /** Knowledge Chain multiplier (1.0 = no chain). */
  chainMultiplier?: number;
  /**
   * Count of cards per domain in the active deck (draw + discard + hand, not exhaust).
   * Keyed by FactDomain string. Required for domain_mastery_sigil v2.
   */
  deckDomainCounts?: Record<string, number>;
}

export function isCardBlocked(card: Card, enemy: EnemyInstance): boolean {
  return enemy.template.immuneDomain != null && card.domain === enemy.template.immuneDomain;
}

function getTierMultiplier(tier: Card['tier']): number {
  if (typeof tier === 'string') return TIER_MULTIPLIER[tier] ?? 1.0;
  return LEGACY_TIER_MULTIPLIER[tier as 1 | 2 | 3] ?? 1.0;
}

/** Get base effect value for a card type, checking overrides first. */
function getBaseEffect(cardType: string): number {
  const overrides = getBalanceOverrides();
  if (overrides) {
    if (cardType === 'attack' && overrides.baseEffectAttack !== undefined) return overrides.baseEffectAttack;
    if (cardType === 'shield' && overrides.baseEffectShield !== undefined) return overrides.baseEffectShield;
  }
  return BASE_EFFECT[cardType as keyof typeof BASE_EFFECT] ?? 0;
}

export function resolveCardEffect(
  card: Card,
  playerState: PlayerCombatState,
  enemy: EnemyInstance,
  speedBonus: number,
  buffNextCard: number,
  lastCardType?: CardType,
  passiveBonuses?: Partial<Record<CardType, number>>,
  advanced: AdvancedResolveOptions = {},
): CardEffectResult {
  const activeRelicIds = advanced.activeRelicIds ?? new Set<string>();
  const mechanic = getMechanicDefinition(card.mechanicId);

  const result: CardEffectResult = {
    effectType: card.cardType,
    rawValue: 0,
    finalValue: 0,
    targetHit: true,
    damageDealt: 0,
    shieldApplied: 0,
    healApplied: 0,
    statusesApplied: [],
    extraCardsDrawn: 0,
    enemyDefeated: false,
    mechanicId: card.mechanicId,
    mechanicName: card.mechanicName,
  };

  if (isCardBlocked(card, enemy)) {
    result.targetHit = false;
    return result;
  }

  let effectiveType: CardType = card.cardType;
  if (card.cardType === 'wild' && card.mechanicId !== 'overclock') {
    effectiveType = lastCardType ?? 'attack';
    result.effectType = effectiveType;
    const baseValue = getBaseEffect(effectiveType);
    card = { ...card, baseEffectValue: baseValue > 0 ? baseValue : card.baseEffectValue };
  }

  const chainMultiplier = advanced.chainMultiplier ?? 1.0;
  const buffMultiplier = 1 + buffNextCard / 100;
  const overclockMultiplier = advanced.isOverclockActive ? 2 : 1;
  const correct = advanced.correct ?? true;
  const playMode: PlayMode = advanced.playMode ?? 'quick';
  const baseEffectValue = card.baseEffectValue;

  // Tier multiplier — used for no-mechanic (legacy) cards and execute bonus.
  const tierMultiplier = getTierMultiplier(card.tier);
  // Card's effectMultiplier (tier-derived, set at card creation time).
  const focusAdjustedMultiplier = card.effectMultiplier;

  // Per-mechanic play-mode values: use mechanic's quickPlayValue / chargeCorrectValue / chargeWrongValue
  // if available; otherwise fall back to card.baseEffectValue with tier scaling (legacy path).
  const isChargeCorrect = playMode === 'charge' || playMode === 'charge_correct';
  const isChargeWrong = playMode === 'charge_wrong';

  let mechanicBaseValue: number;
  if (mechanic) {
    if (isChargeCorrect) {
      mechanicBaseValue = Math.round(mechanic.quickPlayValue * CHARGE_CORRECT_MULTIPLIER);
    } else if (isChargeWrong) {
      mechanicBaseValue = mechanic.chargeWrongValue;
    } else {
      // quick / quick_play
      mechanicBaseValue = mechanic.quickPlayValue;
    }
  } else {
    // No mechanic definition (wild fallback, unknown mechanic).
    // Apply tier multiplier to preserve pre-v2 behavior for these cards.
    mechanicBaseValue = baseEffectValue * tierMultiplier;
  }

  // Apply mastery bonus (AR-113)
  const masteryBonus = getMasteryBaseBonus(card.mechanicId ?? '', card.masteryLevel ?? 0);
  mechanicBaseValue += masteryBonus;

  const masterySecondaryBonus = getMasterySecondaryBonus(card.mechanicId ?? '', card.masteryLevel ?? 0);
  // Apply mastery secondary bonus to a copy of the card so switch cases can read it uniformly
  if (masterySecondaryBonus > 0 && mechanic) {
    const currentSecondary = card.secondaryValue ?? mechanic.secondaryValue ?? 0;
    card = { ...card, secondaryValue: currentSecondary + masterySecondaryBonus };
  }

  // AR-202: Apply cursed multipliers if the card carries a cursed fact.
  // Applied after mastery bonus but before tier/combo/chain/relic multipliers.
  if (card.isCursed) {
    const isQuickPlay2 = playMode === 'quick' || playMode === 'quick_play';
    const isChargeCorrect2 = playMode === 'charge' || playMode === 'charge_correct';
    const isChargeWrong2 = playMode === 'charge_wrong';
    // Scar Tissue relic stub (AR-203): overrides QP multiplier to 0.85 on QP plays.
    let cursedQpMult = CURSED_QP_MULTIPLIER; // 0.7
    if (isQuickPlay2 && activeRelicIds.has('scar_tissue')) {
      cursedQpMult = 0.85;
    }
    if (isQuickPlay2) {
      mechanicBaseValue = Math.round(mechanicBaseValue * cursedQpMult);
    } else if (isChargeCorrect2) {
      mechanicBaseValue = Math.round(mechanicBaseValue * CURSED_CHARGE_CORRECT_MULTIPLIER); // 1.0 — no change
    } else if (isChargeWrong2) {
      mechanicBaseValue = Math.round(mechanicBaseValue * CURSED_CHARGE_WRONG_MULTIPLIER); // 0.5
    }
  }

  const strikeTag = mechanic?.tags.includes('strike') ?? false;
  const sharpenedEdgeBonus = strikeTag && activeRelicIds.has('barbed_edge') ? 3 : 0;
  const effectiveBase = mechanicBaseValue + sharpenedEdgeBonus;

  // ── Relic attack modifiers ──────────────────────────────────────────────────
  // resolveAttackModifiers handles all attack-boosting relics (whetstone, flame_brand,
  // glass_cannon, berserker_band, etc.). We read playerState for HP context.
  const relicAttackMods = effectiveType === 'attack'
    ? resolveAttackModifiers(activeRelicIds, {
        isFirstAttack: advanced.isFirstAttackThisEncounter ?? false,
        isStrikeTagged: strikeTag,
        playerHpPercent: playerState.hp / playerState.maxHP,
        consecutiveCorrectAttacks: 0, // crescendo_blade context not tracked in card resolver; zero is safe
        cardTier: typeof card.tier === 'string' ? card.tier : 'learning',
        correctStreakThisEncounter: 0, // memory_palace context not tracked here; handled upstream
        enemyHpPercent: enemy.currentHP / enemy.maxHP,
        enemyPoisonStacks: (enemy.statusEffects ?? []).filter(s => s.type === 'poison').reduce((sum, s) => sum + (s.value ?? 0), 0),
        cardDomain: card.domain,
        deckDomainCounts: advanced.deckDomainCounts,
      })
    : null;

  // ── Relic shield modifiers ──────────────────────────────────────────────────
  const relicShieldMods = (effectiveType === 'shield' || effectiveType === 'wild')
    ? resolveShieldModifiers(activeRelicIds)
    : null;

  // Build the attack relic multiplier from the resolver results.
  // Flat bonus is applied after scaling (added to finalValue below).
  // Percent bonus is applied as a multiplier here.
  const attackRelicMultiplier = relicAttackMods
    ? 1 + relicAttackMods.percentDamageBonus
    : 1;

  const rawValue = effectiveBase * focusAdjustedMultiplier;
  result.rawValue = rawValue;
  const scaledValue = Math.round(rawValue * chainMultiplier * speedBonus * buffMultiplier * attackRelicMultiplier * overclockMultiplier);
  // Apply flat relic attack bonus after all multipliers (so it isn't multiplied by combo/chain).
  const relicFlatAttackBonus = relicAttackMods?.flatDamageBonus ?? 0;
  const finalValue = effectiveType === 'attack'
    ? scaledValue + relicFlatAttackBonus
    : scaledValue;
  result.finalValue = finalValue;

  // Flat shield bonus from relics (stone_wall: +3). Added to every shield result.
  const shieldRelicBonus = relicShieldMods?.flatBlockBonus ?? 0;

  // bastions_will Quick Play +25% block multiplier — only on Quick Play (not Charged).
  // The Charged +75% path is handled in turnManager via resolveChargeCorrectEffects.
  const isQuickPlay = playMode === 'quick' || playMode === 'quick_play';
  const quickPlayShieldMult = (isQuickPlay && (relicShieldMods?.quickPlayShieldBonus ?? 0) > 0)
    ? 1 + (relicShieldMods!.quickPlayShieldBonus / 100)
    : 1;

  const applyAttackDamage = (baseDamage: number): void => {
    let damage = Math.max(0, Math.round(baseDamage + (passiveBonuses?.attack ?? 0)));
    if (isVulnerable(enemy.statusEffects)) damage = Math.round(damage * 1.5);
    result.damageDealt = damage;
    result.enemyDefeated = damage >= enemy.currentHP;
  };

  /**
   * Applies relic shield modifiers to a base shield value:
   *   result = Math.round((base + stone_wall_flat) * bastions_will_quick_play_mult)
   * - stone_wall +3 flat applies always.
   * - bastions_will +25% applies on Quick Play only; the Charged +75% path is in turnManager.
   * All callers pass their full pre-relic shield amount as `base`.
   */
  const applyShieldRelics = (base: number): number => Math.round((base + shieldRelicBonus) * quickPlayShieldMult);

  // Double Strike buff consumes on next attack card — full power per hit.
  if (advanced.isDoubleStrikeActive && effectiveType === 'attack') {
    const perHit = Math.round(finalValue * 1.0);
    applyAttackDamage(perHit * 2);
    return result;
  }

  // TODO(AR-203): mastery_surge must skip cards where isCursed === true — per Appendix F.
  // When mastery_surge is implemented, add: if (candidate.isCursed) continue; in its hand iteration.

  const mechanicId = card.mechanicId ?? '';
  switch (mechanicId) {
    case 'multi_hit': {
      const hits = (card.secondaryValue ?? mechanic?.secondaryValue ?? 3) + (activeRelicIds.has('chain_lightning_rod') ? 1 : 0);
      // AR-203: Set hitCount so turnManager resolves Burn per-hit instead of combined.
      // damageDealt is set to the per-hit base value; turnManager accumulates the total.
      if (hits > 1) {
        applyAttackDamage(finalValue); // per-hit base (Vulnerable already applied)
        result.hitCount = hits;
        return result;
      }
      applyAttackDamage(finalValue * hits);
      return result;
    }
    case 'piercing': {
      result.damageDealtBypassesBlock = true;
      applyAttackDamage(finalValue);
      return result;
    }
    case 'reckless': {
      result.selfDamage = card.secondaryValue ?? mechanic?.secondaryValue ?? 3;
      applyAttackDamage(finalValue);
      return result;
    }
    case 'execute': {
      const threshold = mechanic?.secondaryThreshold ?? 0.3;
      // execute bonus scales with the same per-mechanic charge value (chargeCorrectValue = 8 bonus at base)
      const bonusBaseValue = isChargeCorrect ? 24 : (isChargeWrong ? 4 : 8);
      const scaledBonus = Math.round(bonusBaseValue * focusAdjustedMultiplier * chainMultiplier * speedBonus * buffMultiplier * attackRelicMultiplier * overclockMultiplier);
      const executeBonus = enemy.currentHP / enemy.maxHP < threshold ? scaledBonus : 0;
      applyAttackDamage(finalValue + executeBonus);
      return result;
    }
    case 'fortify': {
      const shield = applyShieldRelics(finalValue);
      result.shieldApplied = shield;
      result.persistentShield = shield;
      return result;
    }
    case 'parry': {
      result.shieldApplied = applyShieldRelics(finalValue);
      const enemyIsAttacking = enemy.nextIntent.type === 'attack' || enemy.nextIntent.type === 'multi_attack';
      if (enemyIsAttacking) result.parryDrawBonus = 1;
      return result;
    }
    case 'brace': {
      const enemyIsAttacking = enemy.nextIntent.type === 'attack' || enemy.nextIntent.type === 'multi_attack';
      if (!enemyIsAttacking) {
        result.shieldApplied = 0;
        return result;
      }
      // Brace scales enemy intent by play-mode multiplier
      const braceMultiplier = isChargeCorrect ? 3.0 : (isChargeWrong ? 0.7 : 1.0);
      result.shieldApplied = applyShieldRelics(Math.round(enemy.nextIntent.value * braceMultiplier));
      return result;
    }
    case 'overheal': {
      const healthPercentage = playerState.hp / playerState.maxHP;
      const bonusMultiplier = healthPercentage < 0.5 ? 2.0 : 1.0;
      result.shieldApplied = applyShieldRelics(Math.round(finalValue * bonusMultiplier));
      return result;
    }
    case 'lifetap': {
      const damageFromCard = finalValue + (passiveBonuses?.attack ?? 0);
      result.healApplied = Math.max(1, Math.floor(damageFromCard * 0.20));
      applyAttackDamage(damageFromCard);
      return result;
    }
    case 'quicken': {
      result.grantsAp = 1;
      // charge_correct bonus: also draw 1 card
      result.extraCardsDrawn = isChargeCorrect ? 1 : 0;
      result.finalValue = 1;
      return result;
    }
    case 'focus': {
      result.applyFocusBuff = true;
      // charge_correct bonus: grant 2 focus charges (two cards get AP reduction)
      const focusCharges = isChargeCorrect ? 2 : 1;
      result.focusCharges = focusCharges;
      return result;
    }
    case 'double_strike': {
      result.applyDoubleStrikeBuff = true;
      // charge_correct bonus: next attack also pierces
      if (isChargeCorrect) result.doubleStrikeAddsPierce = true;
      return result;
    }
    case 'slow': {
      result.applySlow = true;
      // charge_correct bonus: also apply Weaken for 1 turn
      if (isChargeCorrect) {
        result.statusesApplied.push({ type: 'weakness', value: 1, turnsRemaining: 1 });
      }
      return result;
    }
    case 'hex': {
      // hex poison value scales with play mode
      const poisonValue = isChargeCorrect ? 8 : (isChargeWrong ? 2 : 3);
      // plague_flask — poison lasts 1 extra turn
      const poisonTurns = 3 + resolvePoisonDurationBonus(activeRelicIds);
      result.statusesApplied.push({ type: 'poison', value: poisonValue, turnsRemaining: poisonTurns });
      return result;
    }
    case 'foresight': {
      // draw count scales with play mode; charge_correct also reveals next intent
      const drawCount = isChargeCorrect ? 3 : (isChargeWrong ? 1 : 2);
      result.extraCardsDrawn = drawCount;
      if (isChargeCorrect) result.revealNextIntent = true;
      return result;
    }
    case 'transmute': {
      result.applyTransmute = true;
      return result;
    }
    case 'immunity': {
      result.applyImmunity = true;
      return result;
    }
    case 'overclock': {
      result.applyOverclock = true;
      return result;
    }
    case 'thorns': {
      // Both block and reflect scale with play mode
      result.shieldApplied = applyShieldRelics(finalValue);
      // thornsValue scales proportionally: quick=3, charge_correct=9, charge_wrong=2
      const thornsBaseReflect = isChargeCorrect ? 9 : (isChargeWrong ? 2 : 3);
      result.thornsValue = Math.round(thornsBaseReflect * focusAdjustedMultiplier);
      return result;
    }
    case 'cleanse': {
      result.applyCleanse = true;
      result.extraCardsDrawn = 1;
      return result;
    }
    case 'empower': {
      // empower finalValue is used directly as buffNextCard in turnManager
      result.finalValue = finalValue;
      return result;
    }
    case 'scout': {
      // draw count scales with play mode
      const scoutDrawCount = isChargeCorrect ? 3 : (isChargeWrong ? 1 : 2);
      result.extraCardsDrawn = scoutDrawCount;
      return result;
    }
    case 'recycle': {
      // draw count scales with play mode; charge_correct also draws from discard
      const recycleDrawCount = isChargeCorrect ? 4 : (isChargeWrong ? 2 : 3);
      result.extraCardsDrawn = recycleDrawCount;
      if (isChargeCorrect) result.drawFromDiscard = 1;
      return result;
    }
    case 'emergency': {
      const hpPercent = playerState.hp / playerState.maxHP;
      const block = hpPercent < 0.3 ? finalValue * 2 : finalValue;
      result.shieldApplied = applyShieldRelics(Math.round(block));
      return result;
    }
    case 'mirror': {
      result.mirrorCopy = true;
      // Actual copy happens in turnManager after checking lastCardEffect.
      return result;
    }
    case 'adapt': {
      const intentType = enemy.nextIntent.type;
      if (intentType === 'attack' || intentType === 'multi_attack') {
        result.shieldApplied = applyShieldRelics(finalValue);
      } else if (intentType === 'debuff') {
        result.adaptCleanse = true;
      } else {
        // defend, buff, heal, or unknown — go offensive
        applyAttackDamage(finalValue);
      }
      return result;
    }
    // AR-203: Ignite — applies Burn stacks to enemy. Damage bonus fires on next hit via Burn trigger.
    // Mechanic definition lands in a separate AR; this stub handles when the mechanic is present.
    case 'ignite': {
      const burnStacks = isChargeCorrect ? 8 : (isChargeWrong ? 1 : 3);
      result.applyBurnStacks = burnStacks;
      return result;
    }
    // AR-203: Lacerate — applies Bleed stacks to enemy. Bonus applies on next card-play damage.
    // Mechanic definition lands in a separate AR; this stub handles when the mechanic is present.
    case 'lacerate': {
      const bleedStacks = isChargeCorrect ? 6 : (isChargeWrong ? 1 : 2);
      result.applyBleedStacks = bleedStacks;
      return result;
    }
    default:
      break;
  }

  // Fallback behavior by card type (phase-1 compatibility).
  switch (effectiveType) {
    case 'attack': {
      applyAttackDamage(finalValue);
      break;
    }
    case 'shield': {
      result.shieldApplied = applyShieldRelics(finalValue);
      break;
    }
    case 'buff': {
      result.finalValue = finalValue + (passiveBonuses?.buff ?? 0);
      break;
    }
    case 'debuff': {
      const debuffFinal = finalValue + (passiveBonuses?.debuff ?? 0);
      const weaknessValue = Math.floor(debuffFinal / 2);
      if (weaknessValue > 0) {
        result.statusesApplied.push({
          type: 'weakness',
          value: weaknessValue,
          turnsRemaining: 2,
        });
      }
      if (debuffFinal >= 5) {
        result.statusesApplied.push({
          type: 'vulnerable',
          value: 1,
          turnsRemaining: 2,
        });
      }
      break;
    }
    case 'utility': {
      result.extraCardsDrawn = Math.max(1, finalValue + (passiveBonuses?.utility ?? 0));
      break;
    }
    case 'wild':
      break;
  }

  return result;
}
