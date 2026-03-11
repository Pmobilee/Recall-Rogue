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

  if (!mechanic) {
    // Fallback to generic descriptions with power value
    switch (card.cardType) {
      case 'attack': return `Deals ${power} damage.`;
      case 'shield': return `Gains ${power} block.`;
      case 'buff': return `Buffs next card by ${power}%.`;
      case 'debuff': return `Weakens enemy for ${power} turn(s).`;
      case 'utility': return `Draws ${power} card(s).`;
      case 'wild': return `Applies a wildcard effect.`;
      default: return GENERIC_TYPE_DESCRIPTIONS[card.cardType] ?? '';
    }
  }

  const secondary = card.secondaryValue ?? mechanic.secondaryValue;

  switch (mechanic.id) {
    // Attack mechanics
    case 'strike':
      return `Deals ${power} damage.`;
    case 'multi_hit': {
      const hits = secondary ?? 3;
      return `Strikes ${hits} times for ${power} damage each (${power * hits} total).`;
    }
    case 'heavy_strike':
      return `Deals ${power} damage. Costs 2 AP.`;
    case 'piercing':
      return `Deals ${power} damage. Ignores enemy block.`;
    case 'reckless': {
      const selfDmg = secondary ?? 3;
      return `Deals ${power} damage. You take ${selfDmg} self-damage.`;
    }
    case 'execute': {
      const bonusDmg = secondary ?? 8;
      return `Deals ${power} damage. +${bonusDmg} bonus if enemy below 30% HP.`;
    }

    // Shield mechanics
    case 'block':
      return `Gain ${power} block. Absorbs damage before HP.`;
    case 'thorns': {
      const reflect = secondary ?? 2;
      return `Gain ${power} block. Reflect ${reflect} damage when hit.`;
    }
    case 'fortify':
      return `Gain ${power} block. Block persists into next turn.`;
    case 'parry':
      return `Gain ${power} block. Draw 1 card if enemy attacks.`;
    case 'brace':
      return `Gain block equal to enemy's telegraphed attack damage.`;

    // Mechanics reclassified from heal/regen
    case 'cleanse':
      return `Remove all debuffs. Draw 1 card.`;
    case 'overheal':
      return `Gain ${power} block. +50% if HP below half.`;
    case 'lifetap':
      return `Deal ${power} damage. Heal 20% of damage dealt.`;
    case 'emergency':
      return `Gain ${power} block. Double if HP below 30%.`;
    case 'immunity':
      return `Absorb the next status damage instance.`;

    // Buff mechanics
    case 'empower':
      return `Next card deals ${power}% more damage.`;
    case 'quicken':
      return `Gain +1 AP this turn.`;
    case 'double_strike':
      return `Next attack hits twice at ${power}% power.`;
    case 'focus':
      return `Next card gets a guaranteed difficulty bonus.`;

    // Debuff mechanics
    case 'weaken':
      return `Apply Weakness for ${power} turns. Enemy deals less damage.`;
    case 'expose':
      return `Apply Vulnerable for ${power} turn(s). Enemy takes more damage.`;
    case 'slow':
      return `Skip enemy's next defend or buff action.`;
    case 'hex': {
      const turns = secondary ?? 3;
      return `Apply ${power} Poison for ${turns} turns.`;
    }

    // Utility mechanics
    case 'scout':
      return `Draw ${power} extra card(s) this turn.`;
    case 'recycle':
      return `Discard this card and draw a new one.`;
    case 'foresight':
      return `Reveal the next ${power} enemy intents.`;
    case 'transmute':
      return `Transform a random card in your hand to a new type.`;

    // Wild mechanics
    case 'mirror':
      return `Copy the previous card's effect.`;
    case 'adapt':
      return `Adapt to the most needed effect (attack, heal, or block).`;
    case 'overclock':
      return `Next card effect is doubled, but draw 1 less next turn.`;

    default:
      return mechanic.description || (GENERIC_TYPE_DESCRIPTIONS[card.cardType] ?? '');
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
