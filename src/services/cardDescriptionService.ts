/**
 * Card description service — generates human-readable descriptions
 * for card mechanics on the reward/inspect screens.
 */

import type { Card, CardType } from '../data/card-types';
import { getMechanicDefinition } from '../data/mechanics';

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
export function getDetailedCardDescription(card: Card): string {
  const power = Math.round(card.baseEffectValue * card.effectMultiplier);
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
      const reflect = secondary ?? 2;
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
      return `Gain ${power} block. +50% if HP below half.` + apSuffix;
    case 'lifetap':
      return `Deal ${power} damage. Heal 20% of damage dealt.` + apSuffix;
    case 'emergency':
      return `Gain ${power} block. Double if HP below 30%.` + apSuffix;
    case 'immunity':
      return `Absorb the next status damage instance.` + apSuffix;

    // Buff mechanics
    case 'empower':
      return `Next card deals ${power}% more damage.` + apSuffix;
    case 'quicken':
      return `Gain +1 AP this turn.` + apSuffix;
    case 'double_strike':
      return `Next attack hits twice at ${power}% power.` + apSuffix;
    case 'focus':
      return `Next card gets a guaranteed difficulty bonus.` + apSuffix;

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
    case 'recycle':
      return `Discard this card and draw a new one.` + apSuffix;
    case 'foresight':
      return `Reveal the next ${power} enemy intents.` + apSuffix;
    case 'transmute':
      return `Transform a random card in your hand to a new type.` + apSuffix;

    // Wild mechanics
    case 'mirror':
      return `Copy the previous card's effect.` + apSuffix;
    case 'adapt':
      return `Adapt to the most needed effect (attack, heal, or block).` + apSuffix;
    case 'overclock':
      return `Next card effect is doubled, but draw 1 less next turn.` + apSuffix;

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
