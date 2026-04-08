/**
 * Card description service — generates human-readable descriptions
 * for card mechanics on the reward/inspect screens.
 *
 * Style conventions (verb-first, as of 2026-04-08):
 * - getCardDescriptionParts: verb-first, `\n` for line breaks (2 lines max ideal)
 * - getShortCardDescription: terse verb-first, ≤20 chars target
 * - getDetailedCardDescription: full prose, verb-first, proper sentences
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
 * Verb-first prose; proper sentences.
 */
export function getDetailedCardDescription(card: Card, powerOverride?: number): string {
  const power = powerOverride ?? Math.round(card.baseEffectValue);
  const mechanic = getMechanicDefinition(card.mechanicId);

  const apCost = Math.max(0, card.apCost ?? mechanic?.apCost ?? 1);
  const apSuffix = apCost === 0 ? ' (Free)' : apCost === 2 ? ' (Costs 2 AP)' : apCost >= 3 ? ` (Costs ${apCost} AP — full turn)` : '';

  if (!mechanic) {
    // Fallback to generic descriptions with power value
    switch (card.cardType) {
      case 'attack': return `Deal ${power} damage.${apSuffix}`;
      case 'shield': return `Gain ${power} Block.${apSuffix}`;
      case 'buff': return `Buff next card by ${power}%.${apSuffix}`;
      case 'debuff': return `Weaken enemy for ${power} turn(s).${apSuffix}`;
      case 'utility': return `Draw ${power} card(s).${apSuffix}`;
      case 'wild': return `Apply a wildcard effect.${apSuffix}`;
      default: return (GENERIC_TYPE_DESCRIPTIONS[card.cardType] ?? '') + apSuffix;
    }
  }

  const secondary = card.secondaryValue ?? mechanic.secondaryValue;

  switch (mechanic.id) {
    // Attack mechanics
    case 'strike':
      return `Deal ${power} damage.` + apSuffix;
    case 'multi_hit': {
      const hits = secondary ?? 3;
      return `Deal ${power} damage ${hits} times (${power * hits} total).` + apSuffix;
    }
    case 'heavy_strike':
      return `Deal ${power} damage.${apSuffix}`;
    case 'piercing':
      return `Deal ${power} damage. Ignores enemy Block.` + apSuffix;
    case 'reckless': {
      const selfDmg = secondary ?? 3;
      return `Deal ${power} damage. Take ${selfDmg} self-damage.` + apSuffix;
    }
    case 'execute': {
      const bonusDmg = secondary ?? 8;
      return `Deal ${power} damage. +${bonusDmg} bonus if enemy below 30% HP.` + apSuffix;
    }

    // Shield mechanics
    case 'block':
      return `Gain ${power} Block. Absorbs damage before HP.` + apSuffix;
    case 'thorns': {
      const reflect = secondary ?? 3;
      return `Gain ${power} Block. Reflect ${reflect} damage when hit.` + apSuffix;
    }
    case 'fortify':
      return `Gain ${power} Block. Persists into next turn.` + apSuffix;
    case 'parry':
      return `Gain ${power} Block. Draw 1 card if enemy attacks.` + apSuffix;
    case 'brace':
      return `Gain Block equal to enemy's telegraphed attack damage.` + apSuffix;

    // Mechanics reclassified from heal/regen
    case 'cleanse':
      return `Purge all debuffs. Draw 1 card.` + apSuffix;
    case 'overheal':
      return `Gain ${power} Block. Double if HP below 50%.` + apSuffix;
    case 'lifetap':
      return `Deal ${power} damage. Heal 20% of damage dealt.` + apSuffix;
    case 'emergency':
      return `Gain ${power} Block. Double if HP below 30%.` + apSuffix;
    case 'immunity':
      return `Absorb next damage instance (up to ${power}).` + apSuffix;

    // Buff mechanics
    case 'empower':
      return `Next card deals ${power}% more damage.` + apSuffix;
    case 'quicken':
      return `Gain +1 AP this turn.` + apSuffix;
    case 'double_strike':
      return `Next attack card hits twice at full power (${power}% each).` + apSuffix;

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
      return `Next card's effect is doubled.` + apSuffix;

    // AR-264: Quiz-integrated cards
    case 'recall':
      return `Deal 10 damage (QP). CC: 20 damage (30 on Review Queue fact). CW: 6 damage.` + apSuffix;
    case 'precision_strike':
      return `Deal 8 damage (QP). CC: scales with question difficulty (8 × options). CW: 4 damage.` + apSuffix;
    case 'knowledge_ward':
      return `Gain Block scaled by correct Charges this encounter. QP: 6×Charges. CC: 10×Charges. CW: 4 Block.` + apSuffix;
    case 'smite':
      return `Deal 10 damage (QP). CC: 10 + (6 × Aura level) damage. CW: 6 damage + Aura −1.` + apSuffix;
    case 'feedback_loop':
      return `Deal 5 damage (QP). CC: 40 damage (+16 in Flow State). CW: 0 damage + Aura −3 crash.` + apSuffix;

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
 * Verb-first terse format, ≤20 chars target.
 */
export function getShortCardDescription(card: Card, powerOverride?: number): string {
  const power = powerOverride ?? Math.round(card.baseEffectValue);
  const mechanic = getMechanicDefinition(card.mechanicId);

  if (!mechanic) {
    switch (card.cardType) {
      case 'attack': return `Deal ${power}`;
      case 'shield': return `Gain ${power}`;
      case 'buff': return `+${power}%`;
      case 'debuff': return `${power} turns`;
      case 'utility': return `Draw ${power}`;
      case 'wild': return 'Wild effect';
      default: return '';
    }
  }

  const secondary = card.secondaryValue ?? mechanic.secondaryValue;

  switch (mechanic.id) {
    case 'strike': return `Deal ${power}`;
    case 'multi_hit': return `${secondary ?? 3}× ${power} dmg`;
    case 'heavy_strike': return `Deal ${power}`;
    case 'piercing': return `${power} pierce`;
    case 'reckless': return `${power} dmg, ${secondary ?? 3} self`;
    case 'execute': return `${power}+${secondary ?? 8} <30%`;
    case 'block': return `Gain ${power}`;
    case 'thorns': return `Gain ${power}, refl ${secondary ?? 3}`;
    case 'fortify': return `Gain ${power}, lasts`;
    case 'parry': return `Gain ${power}, draw`;
    case 'brace': return 'Match telegraph';
    case 'cleanse': return 'Purge';
    case 'overheal': return `Gain ${power} ×2<50%`;
    case 'lifetap': return `${power} drain`;
    case 'emergency': return `Gain ${power} ×2<30%`;
    case 'immunity': return 'Absorb next';
    case 'empower': return `Next +${power}%`;
    case 'quicken': return '+1 AP';
    case 'focus': return 'Next −1 AP';
    case 'double_strike': return '2× full power';
    case 'weaken': return `Weak ${power}`;
    case 'expose': return `Vuln ${power}`;
    case 'slow': return 'Skip action';
    case 'hex': return `Poison ${power}×${secondary ?? 3}`;
    case 'scout': return `Draw ${power}`;
    case 'recycle': return 'Draw 3';
    case 'foresight': return `Draw ${power}`;
    case 'transmute': return 'Transform';
    case 'mirror': return 'Copy last';
    case 'adapt': return 'Smart';
    case 'overclock': return '2× effect';
    // AR-264: Quiz-integrated cards
    case 'recall': return '10/20/30 dmg';
    case 'precision_strike': return 'Deal 8×options';
    case 'knowledge_ward': return 'Gain ×charges';
    case 'smite': return '10+6×Aura dmg';
    case 'feedback_loop': return 'CC: 40 dmg';

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
 *
 * Style: verb-first; use `\n` in txt() for line breaks (renderer splits on \n into .desc-line divs).
 * 2 lines max ideal. Keywords use kw(), numbers use num()/numWithMastery().
 */
export function getCardDescriptionParts(card: Card, gameState?: CardGameState, powerOverride?: number): CardDescPart[] {
  const power = powerOverride ?? Math.round(card.baseEffectValue);
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
      return [txt('Deal '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' damage\n'), num(hits), txt(' times')];
    }
    case 'heavy_strike':
      return [txt('Deal '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' damage')];
    case 'piercing':
      return [txt('Deal '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' damage\n'), kw('Pierce', 'pierce')];
    case 'reckless':
      return [txt('Deal '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' damage\nSelf-hit '), num(secondary ?? 3)];
    case 'execute': {
      const bonus = secondary ?? 8;
      const active = eHp < 0.3;
      const secMasteryBonus = getMasterySecondaryBonus(mechanic.id, masteryLevel);
      const bonusParts: CardDescPart[] = secMasteryBonus > 0 && masteryLevel > 0
        ? [cond(bonus, active), masteryNum('+' + Math.round(secMasteryBonus))]
        : [cond(bonus, active)];
      return [txt('Deal '), num(power), txt(' damage\n+'), ...bonusParts, txt(' if <30% HP')];
    }
    case 'lifetap':
      return [txt('Deal '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' damage\nHeal 20%')];

    // Shields
    case 'block':
      return [txt('Gain '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block')];
    case 'thorns':
      return [txt('Gain '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block'), txt('\nReflect '), ...numWithSecondaryMastery(secondary ?? 3, mechanic.id, masteryLevel)];
    case 'fortify':
      return [txt('Gain '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block'), txt('\nPersists')];
    case 'parry':
      return [txt('Gain '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block'), txt('\nDraw on hit')];
    case 'brace':
      return [kw('Block', 'block'), txt('\n= enemy attack')];
    case 'overheal': {
      const doubled = power * 2;
      const active = pHp < 0.5;
      return [txt('Gain '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block'), txt('\n×2 ('), cond(doubled, active), txt(') if <50%')];
    }
    case 'emergency': {
      const active = pHp < 0.3;
      const val = active ? power * 2 : power;
      return [txt('Gain '), ...numWithMastery(val, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block'), txt('\n×2 if <30%')];
    }

    // Buffs
    case 'empower':
      return [txt('Next card\n+'), ...numWithMastery(power, mechanic.id, masteryLevel), txt('% damage')];
    case 'quicken':
      return [txt('+'), num(1), txt(' AP\nthis turn')];
    case 'focus': {
      const count = Math.max(1, Math.floor((secondary as number | undefined) ?? 1));
      return count > 1
        ? [txt('Next '), num(count), txt(' cards −1 AP')]
        : [txt('Next card −1 AP')];
    }
    case 'double_strike':
      return [txt('Next attack\nhits twice')];

    // Debuffs
    case 'weaken':
      return [txt('Apply\n'), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Weakness', 'weakness')];
    case 'expose':
      return [txt('Apply\n'), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Vulnerable', 'vulnerable')];
    case 'slow':
      return [txt("Skip enemy's\nnext action")];
    case 'hex': {
      const turns = secondary ?? 3;
      return [txt('Apply '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Poison', 'poison'), txt('\n'), num(turns), txt(' turns')];
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
      return [txt('Transform\nweakest card')];
    case 'cleanse':
      return [txt('Purge debuffs\nDraw 1')];
    case 'immunity':
      return [txt('Absorb next hit\nup to '), num(power)];

    // Wild
    case 'mirror':
      return [txt('Copy last card')];
    case 'adapt':
      return [txt('Auto:\n'), kw('Block', 'block'), txt('·Atk·'), kw('Cleanse', 'cleanse')];
    case 'overclock':
      return [txt('Next card ×2')];

    // AR-264: Quiz-integrated cards
    case 'recall':
      return [txt('Deal '), num(10), txt(' damage\nCC: '), num(20), txt(' / Review: '), num(30)];
    case 'precision_strike':
      return [txt('Deal '), num(8), txt(' damage\nCC: ×(options+1)')];
    case 'knowledge_ward':
      return [txt('Gain '), kw('Block', 'block'), txt(' ×\ncorrect charges')];
    case 'smite':
      return [txt('Deal '), num(10), txt(' damage\n+'), num(6), txt(' per Aura')];
    case 'feedback_loop':
      return [txt('CC: Deal '), num(40), txt(' damage\n+'), num(16), txt(' in '), kw('Flow State', 'flow_state')];

    default:
      return [txt(mechanic.name)];
  }
}
