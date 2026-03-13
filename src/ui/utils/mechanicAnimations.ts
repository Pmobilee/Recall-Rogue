import type { CardType } from '../../data/card-types';

/** Card flip to cardback duration (ms) */
export const REVEAL_DURATION = 250;

/** Type-specific swoosh effect duration (ms) */
export const SWOOSH_DURATION = 250;

/** 3D impact / directional movement duration (ms) */
export const IMPACT_DURATION = 300;

/** Minimize to discard pile duration (ms) */
export const DISCARD_DURATION = 200;

/** Tier-up celebration duration (ms) */
export const TIER_UP_DURATION = 600;

/** Animation phase for card play sequence */
export type CardAnimPhase = 'reveal' | 'swoosh' | 'impact' | 'discard' | 'tier-up' | 'fizzle' | null;

/** Visual archetype determines which CSS animation set to use */
export type CardAnimArchetype = 'attack' | 'shield' | 'buff' | 'debuff' | 'utility' | 'wild';

/**
 * Maps a card type to its visual animation archetype.
 * Shield/utility share similar calmer animations.
 */
export function getCardAnimArchetype(cardType: CardType): CardAnimArchetype {
  switch (cardType) {
    case 'attack': return 'attack';
    case 'shield': return 'shield';
    case 'buff': return 'buff';
    case 'debuff': return 'debuff';
    case 'utility': return 'utility';
    case 'wild': return 'wild';
    default: return 'attack';
  }
}

/**
 * Returns the CSS class suffix for a given card type during a given animation phase.
 * E.g., getAnimClass('attack', 'swoosh') → 'card-swoosh card-swoosh-attack'
 */
export function getAnimClass(cardType: CardType, phase: CardAnimPhase): string {
  if (!phase) return '';
  const archetype = getCardAnimArchetype(cardType);
  switch (phase) {
    case 'reveal': return 'card-reveal';
    case 'swoosh': return `card-swoosh card-swoosh-${archetype}`;
    case 'impact': return `card-impact card-impact-${archetype}`;
    case 'discard': return 'card-discard';
    case 'tier-up': return 'card-tier-up';
    case 'fizzle': return 'card-fizzle';
    default: return '';
  }
}
