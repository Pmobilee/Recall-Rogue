/**
 * Card description service — generates human-readable descriptions
 * for card mechanics on the reward/inspect screens.
 */

import type { Card, CardType } from '../data/card-types';
import { getMechanicDefinition } from '../data/mechanics';
import { getMasteryBaseBonus, getMasterySecondaryBonus } from './cardUpgradeService';

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
      return `Apply Weakness for ${power} turns. Enemy deals less damage.` + apSuffix;
    case 'expose':
      return `Apply Vulnerable for ${power} turn(s). Enemy takes more damage.` + apSuffix;
    case 'slow':
      return `Skip enemy's next defend or buff action.` + apSuffix;
    case 'hex': {
      const turns = secondary ?? 3;
      return `Apply ${power} Poison for ${turns} turns.` + apSuffix;
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
    case 'thorns': return `${power} block +${secondary ?? 3} reflect`;
    case 'fortify': return `${power} persistent`;
    case 'parry': return `${power} block +draw`;
    case 'brace': return 'Match telegraph';
    case 'cleanse': return 'Purge debuffs';
    case 'overheal': return `${power} block ×2 <50%`;
    case 'lifetap': return `${power} drain`;
    case 'emergency': return `${power} block ×2`;
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
    case 'recycle': return 'Draw 3 cards';
    case 'foresight': return `Draw ${power}`;
    case 'transmute': return 'Transform card';
    case 'mirror': return 'Copy last';
    case 'adapt': return 'Smart: ATK/DEF/Cleanse';
    case 'overclock': return '2× effect';
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
/** Returns [num(base)] or [num(base), masteryNum('+bonus')] depending on mastery level. */
function numWithMastery(base: number, mechanicId: string, masteryLevel: number): CardDescPart[] {
  const bonus = getMasteryBaseBonus(mechanicId, masteryLevel);
  if (bonus <= 0 || masteryLevel <= 0) return [num(base)];
  return [num(base), masteryNum('+' + Math.round(bonus))];
}
/** Returns [num(base)] or [num(base), masteryNum('+bonus')] using secondary mastery bonus. */
function numWithSecondaryMastery(base: number, mechanicId: string, masteryLevel: number): CardDescPart[] {
  const bonus = getMasterySecondaryBonus(mechanicId, masteryLevel);
  if (bonus <= 0 || masteryLevel <= 0) return [num(base)];
  return [num(base), masteryNum('+' + Math.round(bonus))];
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
      return [txt('Deal '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' damage')];
    case 'multi_hit': {
      const hits = secondary ?? 3;
      return [txt('Hit '), num(hits), txt(' times for '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' each')];
    }
    case 'heavy_strike':
      return [txt('Deal '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' damage')];
    case 'piercing':
      return [txt('Deal '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' damage. Ignores '), kw('Block', 'block')];
    case 'reckless':
      return [txt('Deal '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' damage. Take '), num(secondary ?? 3), txt(' self-damage')];
    case 'execute': {
      const bonus = secondary ?? 8;
      const active = eHp < 0.3;
      const secMasteryBonus = getMasterySecondaryBonus(mechanic.id, masteryLevel);
      const bonusParts: CardDescPart[] = secMasteryBonus > 0 && masteryLevel > 0
        ? [cond(active ? bonus : 0, active), masteryNum('+' + Math.round(secMasteryBonus))]
        : [cond(active ? bonus : 0, active)];
      return [txt('Deal '), num(power), txt(' damage. +'), ...bonusParts, txt(' below 30%')];
    }
    case 'lifetap':
      return [txt('Deal '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' damage. Heal 20% dealt')];

    // Shields
    case 'block':
      return [txt('Gain '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block')];
    case 'thorns':
      return [txt('Gain '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block'), txt('. Reflect '), ...numWithSecondaryMastery(secondary ?? 3, mechanic.id, masteryLevel), txt(' damage')];
    case 'fortify':
      return [txt('Gain '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block'), txt('. Persists next turn')];
    case 'parry':
      return [txt('Gain '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block'), txt('. Draw 1 if attacked')];
    case 'brace':
      return [txt('Gain '), kw('Block', 'block'), txt(' equal to enemy attack')];
    case 'overheal': {
      const bonus = Math.round(power * 1.0); // doubled power when below 50%
      const active = pHp < 0.5;
      return [txt('Gain '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block'), txt('. ×2 ('), cond(active ? bonus * 2 : power, active), txt(') below 50% HP')];
    }
    case 'emergency': {
      const active = pHp < 0.3;
      const val = active ? power * 2 : power;
      return [txt('Gain '), ...numWithMastery(val, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block'), txt('. ×2 below 30% HP')];
    }

    // Buffs
    case 'empower':
      return [txt('Next card +'), ...numWithMastery(power, mechanic.id, masteryLevel), txt('% damage')];
    case 'quicken':
      return [txt('Gain +'), num(1), txt(' AP this turn')];
    case 'focus': {
      const count = Math.max(1, Math.floor((secondary as number | undefined) ?? 1));
      return count > 1
        ? [txt('Next '), num(count), txt(' cards cost 1 less AP')]
        : [txt('Next card costs 1 less AP')];
    }
    case 'double_strike':
      return [txt('Next ATTACK card hits twice at full power')];

    // Debuffs
    case 'weaken':
      return [txt('Apply '), kw('Weakness', 'weakness'), txt(' for '), num(power), txt(' turns')];
    case 'expose':
      return [txt('Apply '), kw('Vulnerable', 'vulnerable'), txt(' for '), num(power), txt(' turns')];
    case 'slow':
      return [txt("Skip enemy's next action")];
    case 'hex': {
      const turns = secondary ?? 3;
      return [txt('Apply '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Poison', 'poison'), txt(' for '), num(turns), txt(' turns')];
    }

    // Utility
    case 'scout': {
      const drawCount = Math.max(1, Math.floor((secondary as number | undefined) ?? power ?? 2));
      return [txt('Draw '), num(drawCount), txt(drawCount !== 1 ? ' cards' : ' card')];
    }
    case 'recycle':
      return [txt('Draw '), num(3), txt(' cards')];
    case 'foresight':
      return [txt('Draw '), num(power), txt(' cards')];
    case 'transmute':
      return [txt('Transform your weakest hand card')];
    case 'cleanse':
      return [txt('Remove all debuffs. Draw 1')];
    case 'immunity':
      return [txt('Absorb next damage instance (up to '), num(power), txt(')')];

    // Wild
    case 'mirror':
      return [txt("Copy previous card's effect")];
    case 'adapt':
      return [txt('Smart: '), kw('Block', 'block'), txt(' vs ATK, '), kw('Cleanse', 'cleanse'), txt(' vs debuff, else Attack')];
    case 'overclock':
      return [txt('Next card ×2 effect')];

    default:
      return [txt(mechanic.name)];
  }
}
