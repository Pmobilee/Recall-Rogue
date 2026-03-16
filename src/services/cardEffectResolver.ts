// === Card Effect Resolver ===
// Resolves card play into effect results. Does not mutate player/enemy state.

import type { Card, CardType } from '../data/card-types';
import type { StatusEffect } from '../data/statusEffects';
import type { PlayerCombatState } from './playerCombatState';
import type { EnemyInstance } from '../data/enemies';
import {
  BASE_EFFECT,
  COMBO_MULTIPLIERS,
  ECHO,
  LEGACY_TIER_MULTIPLIER,
  TIER_MULTIPLIER,
  getBalanceValue,
  getBalanceOverrides,
} from '../data/balance';
import { isVulnerable } from '../data/statusEffects';
import { getMechanicDefinition } from '../data/mechanics';

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
}

export interface AdvancedResolveOptions {
  activeRelicIds?: Set<string>;
  isFirstAttackThisEncounter?: boolean;
  isDoubleStrikeActive?: boolean;
  isFocusActive?: boolean;
  isOverclockActive?: boolean;
  damageDealtThisTurn?: number;
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

function getComboMultiplier(comboCount: number): number {
  const multipliers = getBalanceValue('comboMultipliers', COMBO_MULTIPLIERS);
  const comboIndex = Math.min(comboCount, multipliers.length - 1);
  return multipliers[comboIndex] ?? 1;
}

function resolveEchoBase(card: Card, activeRelicIds: Set<string>): number {
  if (!card.isEcho) return card.baseEffectValue;
  if (activeRelicIds.has('echo_lens')) {
    if (card.originalBaseEffectValue != null) return card.originalBaseEffectValue;
    return card.baseEffectValue / ECHO.POWER_MULTIPLIER;
  }
  return card.baseEffectValue;
}

export function resolveCardEffect(
  card: Card,
  playerState: PlayerCombatState,
  enemy: EnemyInstance,
  comboCount: number,
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

  // Focus is now AP-reduction only — no damage multiplier applied here.
  const focusAdjustedMultiplier = card.effectMultiplier;
  const tierMultiplier = getTierMultiplier(card.tier);
  const comboMultiplier = getComboMultiplier(comboCount);
  const buffMultiplier = 1 + buffNextCard / 100;
  const overclockMultiplier = advanced.isOverclockActive ? 2 : 1;
  const baseEffectValue = resolveEchoBase(card, activeRelicIds);

  const strikeTag = mechanic?.tags.includes('strike') ?? false;
  const sharpenedEdgeBonus = strikeTag && activeRelicIds.has('barbed_edge') ? 3 : 0;
  const effectiveBase = baseEffectValue + sharpenedEdgeBonus;

  let attackRelicMultiplier = 1;
  if (effectiveType === 'attack') {
    if (advanced.isFirstAttackThisEncounter && activeRelicIds.has('flame_brand')) {
      attackRelicMultiplier *= 1.4;
    }
    if (activeRelicIds.has('glass_cannon')) {
      attackRelicMultiplier *= 1.35;
    }
  }

  const rawValue = effectiveBase * tierMultiplier * focusAdjustedMultiplier;
  result.rawValue = rawValue;
  const finalValue = Math.round(rawValue * comboMultiplier * speedBonus * buffMultiplier * attackRelicMultiplier * overclockMultiplier);
  result.finalValue = finalValue;

  const applyAttackDamage = (baseDamage: number): void => {
    let damage = Math.max(0, Math.round(baseDamage + (passiveBonuses?.attack ?? 0)));
    if (isVulnerable(enemy.statusEffects)) damage = Math.round(damage * 1.5);
    result.damageDealt = damage;
    result.enemyDefeated = damage >= enemy.currentHP;
  };

  // Double Strike buff consumes on next attack card — full power per hit.
  if (advanced.isDoubleStrikeActive && effectiveType === 'attack') {
    const perHit = Math.round(finalValue * 1.0);
    applyAttackDamage(perHit * 2);
    return result;
  }

  const mechanicId = card.mechanicId ?? '';
  switch (mechanicId) {
    case 'multi_hit': {
      const hits = (card.secondaryValue ?? mechanic?.secondaryValue ?? 3) + (activeRelicIds.has('chain_lightning_rod') ? 1 : 0);
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
      const bonusBase = card.secondaryValue ?? mechanic?.secondaryValue ?? 8;
      const executeBonus = enemy.currentHP / enemy.maxHP < threshold
        ? Math.round(bonusBase * tierMultiplier * focusAdjustedMultiplier * comboMultiplier * speedBonus * buffMultiplier * attackRelicMultiplier * overclockMultiplier)
        : 0;
      applyAttackDamage(finalValue + executeBonus);
      return result;
    }
    case 'fortify': {
      const shield = finalValue + (passiveBonuses?.shield ?? 0);
      result.shieldApplied = shield;
      result.persistentShield = shield;
      return result;
    }
    case 'parry': {
      result.shieldApplied = finalValue + (passiveBonuses?.shield ?? 0);
      const enemyIsAttacking = enemy.nextIntent.type === 'attack' || enemy.nextIntent.type === 'multi_attack';
      if (enemyIsAttacking) result.parryDrawBonus = 1;
      return result;
    }
    case 'brace': {
      const enemyIsAttacking = enemy.nextIntent.type === 'attack' || enemy.nextIntent.type === 'multi_attack';
      result.shieldApplied = enemyIsAttacking ? enemy.nextIntent.value + (passiveBonuses?.shield ?? 0) : 0;
      return result;
    }
    case 'overheal': {
      const targetShield = finalValue + (passiveBonuses?.shield ?? 0);
      const healthPercentage = playerState.hp / playerState.maxHP;
      const bonusMultiplier = healthPercentage < 0.5 ? 2.0 : 1.0;
      result.shieldApplied = Math.round(targetShield * bonusMultiplier);
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
      if (card.isUpgraded) result.extraCardsDrawn = 1;
      result.finalValue = 1;
      return result;
    }
    case 'focus': {
      result.applyFocusBuff = true;
      // Focus+: secondaryValue = 1 means grant 2 charges (two cards get AP reduction)
      const focusCharges = (card.secondaryValue ?? mechanic?.secondaryValue ?? 0) > 0 ? 2 : 1;
      result.focusCharges = focusCharges;
      return result;
    }
    case 'double_strike': {
      result.applyDoubleStrikeBuff = true;
      return result;
    }
    case 'slow': {
      result.applySlow = true;
      return result;
    }
    case 'hex': {
      result.statusesApplied.push({ type: 'poison', value: 3, turnsRemaining: 3 });
      return result;
    }
    case 'foresight': {
      result.applyForesight = true;
      result.extraCardsDrawn = 1;
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
      result.shieldApplied = finalValue + (passiveBonuses?.shield ?? 0);
      result.thornsValue = card.secondaryValue ?? mechanic?.secondaryValue ?? 2;
      return result;
    }
    case 'cleanse': {
      result.applyCleanse = true;
      result.extraCardsDrawn = 1;
      return result;
    }
    case 'empower': {
      // empower sets buffNextCard — handled via buff fallback, but we need it to
      // set finalValue correctly so turnManager picks it up for buffNextCard.
      result.finalValue = finalValue;
      return result;
    }
    case 'recycle': {
      result.extraCardsDrawn = Math.max(1, finalValue);
      return result;
    }
    case 'emergency': {
      const hpPercent = playerState.hp / playerState.maxHP;
      const block = hpPercent < 0.3 ? finalValue * 2 : finalValue;
      result.shieldApplied = Math.round(block) + (passiveBonuses?.shield ?? 0);
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
        result.shieldApplied = finalValue + (passiveBonuses?.shield ?? 0);
      } else if (intentType === 'debuff') {
        result.adaptCleanse = true;
      } else {
        // defend, buff, heal, or unknown — go offensive
        applyAttackDamage(finalValue);
      }
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
      result.shieldApplied = finalValue + (passiveBonuses?.shield ?? 0);
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
