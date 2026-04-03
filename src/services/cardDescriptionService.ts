/**
 * Card description service — generates human-readable descriptions
 * for card mechanics on the reward/inspect screens.
 */

import type { Card, CardType } from '../data/card-types';
import { getMechanicDefinition } from '../data/mechanics';
import { getMasteryBaseBonus, getMasterySecondaryBonus, getMasteryStats } from './cardUpgradeService';

const GENERIC_TYPE_DESCRIPTIONS: Record<CardType, string> = {
  attack: 'Deal direct damage to enemies.',
  shield: 'Gain block before enemy attacks.',
  buff: 'Increase output and combo pressure.',
  debuff: 'Reduce enemy tempo and threat.',
  utility: 'Tech effects for flexible turns.',
  wild: 'High-impact wildcard effect.',
};

/**
 * Get a detailed, human-readable description of what a card does mechanically.
 * Uses the card's mechanic definition to generate specific numbers and effects.
 */
export function getDetailedCardDescription(card: Card, powerOverride?: number): string {
  const power = powerOverride ?? Math.round(card.baseEffectValue * card.effectMultiplier);
  const mechanic = getMechanicDefinition(card.mechanicId);

  const apCost = Math.max(0, card.apCost ?? mechanic?.apCost ?? 1);
  const apSuffix = apCost === 0 ? ' (Free)' : apCost === 2 ? ' (Costs 2 AP)' : apCost >= 3 ? ` (Costs ${apCost} AP — full turn)` : '';

  if (!mechanic) {
    // Fallback to generic descriptions with power value
    switch (card.cardType) {
      case 'attack': return `Deals ${power} damage.${apSuffix}`;
      case 'shield': return `Gains ${power} block.${apSuffix}`;
      case 'buff': return `Buffs next card by ${power}%.${apSuffix}`;
      case 'debuff': return `Weakens enemy for ${power} turn(s).${apSuffix}`;
      case 'utility': return `Draws ${power} card(s).${apSuffix}`;
      case 'wild': return `Applies a wildcard effect.${apSuffix}`;
      default: return (GENERIC_TYPE_DESCRIPTIONS[card.cardType] ?? '') + apSuffix;
    }
  }

  const secondary = card.secondaryValue ?? mechanic.secondaryValue;

  switch (mechanic.id) {
    // Attack mechanics
    case 'strike':
      return `Deals ${power} damage.` + apSuffix;
    case 'multi_hit': {
      const hits = secondary ?? 3;
      return `Strikes ${hits} times for ${power} damage each (${power * hits} total).` + apSuffix;
    }
    case 'heavy_strike':
      return `Deals ${power} damage.${apSuffix}`;
    case 'piercing':
      return `Deals ${power} damage. Ignores enemy block.` + apSuffix;
    case 'reckless': {
      const selfDmg = secondary ?? 3;
      return `Deals ${power} damage. You take ${selfDmg} self-damage.` + apSuffix;
    }
    case 'execute': {
      const bonusDmg = secondary ?? 8;
      return `Deals ${power} damage. +${bonusDmg} bonus if enemy below 30% HP.` + apSuffix;
    }

    // Shield mechanics
    case 'block':
      return `Gain ${power} block. Absorbs damage before HP.` + apSuffix;
    case 'thorns': {
      const reflect = secondary ?? 3;
      return `Gain ${power} block. Reflect ${reflect} damage when hit.` + apSuffix;
    }
    case 'fortify':
      return `Gain ${power} block. Block persists into next turn.` + apSuffix;
    case 'parry':
      return `Gain ${power} block. Draw 1 card if enemy attacks.` + apSuffix;
    case 'brace':
      return `Gain block equal to enemy's telegraphed attack damage.` + apSuffix;

    // Mechanics reclassified from heal/regen
    case 'cleanse':
      return `Remove all debuffs. Draw 1 card.` + apSuffix;
    case 'overheal':
      return `Gain ${power} block. Double if HP below 50%.` + apSuffix;
    case 'lifetap':
      return `Deal ${power} damage. Heal 20% of damage dealt.` + apSuffix;
    case 'emergency':
      return `Gain ${power} block. Double if HP below 30%.` + apSuffix;
    case 'immunity':
      return `Absorb next damage instance (up to ${power}).` + apSuffix;

    // Buff mechanics
    case 'empower':
      return `Next card deals ${power}% more damage.` + apSuffix;
    case 'quicken':
      return `Gain +1 AP this turn.` + apSuffix;
    case 'double_strike':
      return `Next ATTACK card hits twice at full power (${power}% each).` + apSuffix;

    // Debuff mechanics
    case 'weaken':
      return `Apply ${power} Weakness. Enemy deals less damage.` + apSuffix;
    case 'expose':
      return `Apply ${power} Vulnerable. Enemy takes more damage.` + apSuffix;
    case 'slow':
      return `Skip enemy's next defend or buff action.` + apSuffix;
    case 'hex': {
      const turns = secondary ?? 3;
      return `Apply ${power} Poison over ${turns} turns.` + apSuffix;
    }

    // Utility mechanics
    case 'scout':
      return `Draw ${power} extra card(s) this turn.` + apSuffix;
    case 'focus':
      return `Next card costs 1 less AP to play.` + apSuffix;
    case 'recycle':
      return `Draw 3 cards.` + apSuffix;
    case 'foresight':
      return `Draw ${power} cards.` + apSuffix;
    case 'transmute':
      return `Transform your weakest hand card into a different type.` + apSuffix;

    // Wild mechanics
    case 'mirror':
      return `Copy the previous card's effect.` + apSuffix;
    case 'adapt':
      return `Smart action: enemy attacking → Block, debuffing → Cleanse, else → Attack. Charged: 1.5× power. Wrong: 0.7×.` + apSuffix;
    case 'overclock':
      return `Next card effect is doubled.` + apSuffix;

    // AR-264: Quiz-integrated cards
    case 'recall':
      return `QP: 10 damage. CC: 20 damage (30 on Review Queue fact + heal 6). CW: 6 damage.` + apSuffix;
    case 'precision_strike':
      return `QP: 8 damage. CC: scales with question difficulty (8 × options). CW: 4 damage.` + apSuffix;
    case 'knowledge_ward':
      return `Block scales with correct Charges this encounter. QP: 6×Charges. CC: 10×Charges. CW: 4 block.` + apSuffix;
    case 'smite':
      return `QP: 10 damage. CC: 10 + (6 × Aura level) damage. CW: 6 damage + Aura −1.` + apSuffix;
    case 'feedback_loop':
      return `QP: 5 damage. CC: 40 damage (+16 in Flow State). CW: 0 damage + Aura −3 crash.` + apSuffix;

    default:
      return (mechanic.description || (GENERIC_TYPE_DESCRIPTIONS[card.cardType] ?? '')) + apSuffix;
  }
}

/**
 * Get a short (1-2 word) mechanic tag for display on card option buttons.
 * Returns the mechanic name or the card type if no mechanic is assigned.
 */
export function getMechanicTag(card: Card): string {
  if (card.mechanicName) return card.mechanicName;
  const mechanic = getMechanicDefinition(card.mechanicId);
  if (mechanic) return mechanic.name;
  return card.cardType.charAt(0).toUpperCase() + card.cardType.slice(1);
}

/**
 * Get a short parchment-friendly description for card effect display.
 * Returns compact text like "8 dmg", "6 block", "+30% next", etc.
 * Designed to fit in the card frame parchment area.
 */
export function getShortCardDescription(card: Card, powerOverride?: number): string {
  const power = powerOverride ?? Math.round(card.baseEffectValue * card.effectMultiplier);
  const mechanic = getMechanicDefinition(card.mechanicId);

  if (!mechanic) {
    switch (card.cardType) {
      case 'attack': return `${power} damage`;
      case 'shield': return `${power} block`;
      case 'buff': return `+${power}%`;
      case 'debuff': return `${power} turns`;
      case 'utility': return `Draw ${power}`;
      case 'wild': return 'Wild effect';
      default: return '';
    }
  }

  const secondary = card.secondaryValue ?? mechanic.secondaryValue;

  switch (mechanic.id) {
    case 'strike': return `${power} damage`;
    case 'multi_hit': return `${power}×${secondary ?? 3} hits`;
    case 'heavy_strike': return `${power} damage`;
    case 'piercing': return `${power} pierce`;
    case 'reckless': return `${power} dmg, ${secondary ?? 3} self`;
    case 'execute': return `${power}+${secondary ?? 8} <30%`;
    case 'block': return `${power} block`;
    case 'thorns': return `${power} block, ${secondary ?? 3} reflect`;
    case 'fortify': return `${power} block, persists`;
    case 'parry': return `${power} block +draw`;
    case 'brace': return 'Match telegraph';
    case 'cleanse': return 'Purge debuffs';
    case 'overheal': return `${power} block ×2<50%`;
    case 'lifetap': return `${power} drain`;
    case 'emergency': return `${power} block ×2<30%`;
    case 'immunity': return `Absorb next hit`;
    case 'empower': return `Next +${power}%`;
    case 'quicken': return '+1 AP';
    case 'focus': return 'Next −1 AP';
    case 'double_strike': return `2× full power`;
    case 'weaken': return `Weak ${power}t`;
    case 'expose': return `Vuln ${power}t`;
    case 'slow': return 'Skip action';
    case 'hex': return `${power} poison ×${secondary ?? 3}`;
    case 'scout': return `Draw ${power}`;
    case 'recycle': return 'Draw 3';
    case 'foresight': return `Draw ${power}`;
    case 'transmute': return 'Transform card';
    case 'mirror': return 'Copy last';
    case 'adapt': return 'Smart: ATK/DEF';
    case 'overclock': return '2× effect';
    // AR-264: Quiz-integrated cards
    case 'recall': return '10 dmg / review bonus';
    case 'precision_strike': return '8×options dmg';
    case 'knowledge_ward': return 'Block×charges';
    case 'smite': return '10+6×Aura dmg';
    case 'feedback_loop': return '40 dmg / Flow+16';

    default: return mechanic.name;
  }
}

/** Structured part of a card description for rich rendering */
export type CardDescPart =
  | { type: 'text'; value: string }
  | { type: 'number'; value: string }
  | { type: 'keyword'; value: string; keywordId: string }
  | { type: 'conditional-number'; value: string; active: boolean }
  | { type: 'mastery-bonus'; value: string };

interface CardGameState {
  playerHpPercent?: number;
  enemyHpPercent?: number;
}

function num(v: number | string): CardDescPart {
  return { type: 'number', value: String(v) };
}
function masteryNum(v: number | string): CardDescPart {
  return { type: 'mastery-bonus', value: String(v) };
}
/**
 * Returns [num(base)] or [num(base), masteryNum('+bonus')] depending on mastery level.
 * `total` may already include the mastery bonus (e.g. from getEffectValue()), so we
 * subtract it back out to recover the true base for display ("4 +3", not "7 +3").
 */
function numWithMastery(total: number, mechanicId: string, masteryLevel: number): CardDescPart[] {
  // Derive bonus via stat table when available; fall back to old perLevelDelta helper.
  const stats = getMasteryStats(mechanicId, masteryLevel);
  const l0Stats = getMasteryStats(mechanicId, 0);
  const bonus = (stats && l0Stats) ? Math.round(stats.qpValue - l0Stats.qpValue) : Math.round(getMasteryBaseBonus(mechanicId, masteryLevel));
  if (bonus <= 0 || masteryLevel <= 0) return [num(total)];
  return [num(total - bonus), masteryNum('+' + bonus)];
}
/**
 * Returns [num(base)] or [num(base), masteryNum('+bonus')] using secondary mastery bonus.
 * `total` may already include the mastery bonus, so we subtract it back out to recover
 * the true base for display.
 */
function numWithSecondaryMastery(total: number, mechanicId: string, masteryLevel: number): CardDescPart[] {
  // Derive secondary bonus via stat table when available; fall back to old perLevelDelta helper.
  const stats = getMasteryStats(mechanicId, masteryLevel);
  const l0Stats = getMasteryStats(mechanicId, 0);
  const secBonus = (stats?.secondaryValue != null && l0Stats?.secondaryValue != null)
    ? Math.round(stats.secondaryValue - l0Stats.secondaryValue)
    : Math.round(getMasterySecondaryBonus(mechanicId, masteryLevel));
  if (secBonus <= 0 || masteryLevel <= 0) return [num(total)];
  return [num(total - secBonus), masteryNum('+' + secBonus)];
}
function txt(v: string): CardDescPart {
  return { type: 'text', value: v };
}
function kw(name: string, id: string): CardDescPart {
  return { type: 'keyword', value: name, keywordId: id };
}
function cond(v: number, active: boolean): CardDescPart {
  return { type: 'conditional-number', value: String(v), active };
}

/**
 * Get structured description parts for rich card text rendering.
 * Returns an array of typed segments for rendering with styled numbers,
 * bold keywords, and conditional values.
 */
export function getCardDescriptionParts(card: Card, gameState?: CardGameState, powerOverride?: number): CardDescPart[] {
  const power = powerOverride ?? Math.round(card.baseEffectValue * card.effectMultiplier);
  const mechanic = getMechanicDefinition(card.mechanicId);
  const masteryLevel = card.masteryLevel ?? 0;

  if (!mechanic) {
    switch (card.cardType) {
      case 'attack': return [txt('Deal '), ...numWithMastery(power, card.mechanicId ?? '', masteryLevel), txt(' damage')];
      case 'shield': return [txt('Gain '), ...numWithMastery(power, card.mechanicId ?? '', masteryLevel), txt(' '), kw('Block', 'block')];
      case 'buff': return [txt('Buff +'), num(power), txt('%')];
      case 'debuff': return [txt('Debuff '), num(power), txt(' turns')];
      case 'utility': return [txt('Draw '), num(power)];
      case 'wild': return [txt('Wild effect')];
      default: return [txt(card.cardType)];
    }
  }

  const secondary = card.secondaryValue ?? mechanic.secondaryValue;
  const pHp = gameState?.playerHpPercent ?? 1;
  const eHp = gameState?.enemyHpPercent ?? 1;

  switch (mechanic.id) {
    // Attacks
    case 'strike':
      return [...numWithMastery(power, mechanic.id, masteryLevel), txt(' damage')];
    case 'multi_hit': {
      const hits = secondary ?? 3;
      return [num(hits), txt('× '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' damage')];
    }
    case 'heavy_strike':
      return [...numWithMastery(power, mechanic.id, masteryLevel), txt(' damage')];
    case 'piercing':
      return [...numWithMastery(power, mechanic.id, masteryLevel), txt(' damage. Pierce')];
    case 'reckless':
      return [...numWithMastery(power, mechanic.id, masteryLevel), txt(' damage. '), num(secondary ?? 3), txt(' self-hit')];
    case 'execute': {
      const bonus = secondary ?? 8;
      const active = eHp < 0.3;
      const secMasteryBonus = getMasterySecondaryBonus(mechanic.id, masteryLevel);
      const bonusParts: CardDescPart[] = secMasteryBonus > 0 && masteryLevel > 0
        ? [cond(bonus, active), masteryNum('+' + Math.round(secMasteryBonus))]
        : [cond(bonus, active)];
      return [num(power), txt(' damage. +'), ...bonusParts, txt(' <30%')];
    }
    case 'lifetap':
      return [...numWithMastery(power, mechanic.id, masteryLevel), txt(' damage. Heal 20%')];

    // Shields
    case 'block':
      return [...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block')];
    case 'thorns':
      return [...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block'), txt('. Reflect '), ...numWithSecondaryMastery(secondary ?? 3, mechanic.id, masteryLevel)];
    case 'fortify':
      return [...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block'), txt('. Persists')];
    case 'parry':
      return [...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block'), txt('. Draw on hit')];
    case 'brace':
      return [kw('Block', 'block'), txt(' = enemy attack')];
    case 'overheal': {
      const doubled = power * 2;
      const active = pHp < 0.5;
      return [...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block'), txt('. ×2 ('), cond(doubled, active), txt(') <50%')];
    }
    case 'emergency': {
      const active = pHp < 0.3;
      const val = active ? power * 2 : power;
      return [...numWithMastery(val, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block'), txt('. ×2 <30%')];
    }

    // Buffs
    case 'empower':
      return [txt('+'), ...numWithMastery(power, mechanic.id, masteryLevel), txt('% next damage')];
    case 'quicken':
      return [txt('+'), num(1), txt(' AP this turn')];
    case 'focus': {
      const count = Math.max(1, Math.floor((secondary as number | undefined) ?? 1));
      return count > 1
        ? [txt('Next '), num(count), txt(' cards −1 AP')]
        : [txt('Next card −1 AP')];
    }
    case 'double_strike':
      return [txt('Next ATK hits ×2')];

    // Debuffs
    case 'weaken':
      return [txt('Apply '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Weakness', 'weakness')];
    case 'expose':
      return [txt('Apply '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Vulnerable', 'vulnerable')];
    case 'slow':
      return [txt("Skip enemy's next defend or buff")];
    case 'hex': {
      const turns = secondary ?? 3;
      return [txt('Apply '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Poison', 'poison'), txt(', '), num(turns), txt('t')];
    }

    // Utility
    case 'scout': {
      const drawCount = Math.max(1, Math.floor((secondary as number | undefined) ?? power ?? 2));
      return [txt('Draw '), num(drawCount)];
    }
    case 'recycle':
      return [txt('Draw '), num(3)];
    case 'foresight':
      return [txt('Draw '), num(power)];
    case 'transmute':
      return [txt('Transform weakest card')];
    case 'cleanse':
      return [txt('Purge debuffs. Draw 1')];
    case 'immunity':
      return [txt('Absorb up to '), num(power), txt(' damage')];

    // Wild
    case 'mirror':
      return [txt('Copy last card')];
    case 'adapt':
      return [txt('Auto: '), kw('Block', 'block'), txt('/ATK/'), kw('Cleanse', 'cleanse')];
    case 'overclock':
      return [txt('Next card ×2')];

    // AR-264: Quiz-integrated cards
    case 'recall':
      return [txt('CC: '), num(20), txt(' dmg. Review Queue: '), num(30), txt(' dmg + heal '), num(6)];
    case 'precision_strike':
      return [txt('CC: '), num(8), txt(' × (options+1) damage')];
    case 'knowledge_ward':
      return [txt('QP: '), num(6), txt('×Charges block. CC: '), num(10), txt('×Charges block')];
    case 'smite':
      return [txt('CC: '), num(10), txt(' + '), num(6), txt('×Aura dmg. CW: Aura −1')];
    case 'feedback_loop':
      return [txt('CC: '), num(40), txt(' dmg (+'), num(16), txt(' in '), kw('Flow State', 'flow_state'), txt('). CW: Aura −3')];

    default:
      return [txt(mechanic.name)];
  }
}
