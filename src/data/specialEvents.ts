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
    description: 'A forge still hot in the dark. Choose 1 of 3 relic upgrades.',
    type: 'relic_forge',
  },
  {
    id: 'card_transform',
    name: 'Card Transform',
    description: 'Something in the air warps cards near your hands. Upgrade one card mechanic.',
    type: 'card_transform',
  },
  {
    id: 'deck_thin',
    name: 'Deck Thin',
    description: 'A slot in the wall. Drop up to 2 cards. They won\'t come back.',
    type: 'deck_thin',
  },
  {
    id: 'knowledge_spring',
    name: 'Knowledge Spring',
    description: 'Water trickles through cracked stone. Facts you got right this run hold a day longer.',
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
  { id: 'heal_20', label: 'A faint warmth seeps up through the floor. Restored 20 HP.', type: 'heal', value: 20 },
  { id: 'gold_50', label: '50 gold, wedged into a crack in the rock.', type: 'currency', value: 50 },
  { id: 'draw_bonus', label: 'Your mind feels sharp. Draw +1 card next encounter.', type: 'draw_bonus', value: 1 },
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
