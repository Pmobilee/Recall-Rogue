/**
 * Special events that trigger after boss fights.
 * Pure data layer — no Phaser, Svelte, or DOM imports.
 */

/** A special event presented to the player after defeating a boss. */
export interface SpecialEvent {
  /** Unique event identifier. */
  id: string;
  /** Display name. */
  name: string;
  /** Player-facing description. */
  description: string;
  /** Event type determining the mechanic. */
  type: 'relic_forge' | 'card_transform' | 'deck_thin' | 'knowledge_spring' | 'mystery';
}

/** Pool of special events available after boss fights. */
export const SPECIAL_EVENTS: SpecialEvent[] = [
  {
    id: 'relic_forge',
    name: 'Relic Forge',
    description: 'The forge glows with ancient power. Choose 1 of 3 relic upgrades.',
    type: 'relic_forge',
  },
  {
    id: 'card_transform',
    name: 'Card Transform',
    description: 'Arcane energy swirls around your deck. Upgrade one card mechanic to its next tier.',
    type: 'card_transform',
  },
  {
    id: 'deck_thin',
    name: 'Deck Thin',
    description: 'The Archive offers to lighten your burden. Remove up to 2 cards from your deck.',
    type: 'deck_thin',
  },
  {
    id: 'knowledge_spring',
    name: 'Knowledge Spring',
    description: 'A crystalline spring pulses with wisdom. All facts answered correctly this run gain +1 day of memory stability.',
    type: 'knowledge_spring',
  },
  {
    id: 'mystery_event',
    name: 'Mystery Event',
    description: 'Something unusual stirs in the darkness...',
    type: 'mystery',
  },
];

/** Mystery event effects for the "mystery" special event type. */
export interface MysteryEventEffect {
  id: string;
  label: string;
  type: 'heal' | 'currency' | 'draw_bonus';
  value: number;
}

/** Pool of possible mystery effects. */
export const MYSTERY_EFFECTS: MysteryEventEffect[] = [
  { id: 'heal_20', label: 'A warm light restores 20 HP.', type: 'heal', value: 20 },
  { id: 'gold_50', label: 'You find 50 gold hidden in the rubble.', type: 'currency', value: 50 },
  { id: 'draw_bonus', label: 'Draw +1 card in the next encounter.', type: 'draw_bonus', value: 1 },
];

/** Roll a random special event from the pool. */
export function rollSpecialEvent(): SpecialEvent {
  const idx = Math.floor(Math.random() * SPECIAL_EVENTS.length);
  return { ...SPECIAL_EVENTS[idx] };
}

/** Roll a random mystery effect. */
export function rollMysteryEffect(): MysteryEventEffect {
  const idx = Math.floor(Math.random() * MYSTERY_EFFECTS.length);
  return { ...MYSTERY_EFFECTS[idx] };
}
