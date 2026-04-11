/** Keyword definitions for combat mechanic tooltips */
export interface KeywordDef {
  name: string;
  description: string;
}

export const KEYWORD_DEFINITIONS: Record<string, KeywordDef> = {
  block: {
    name: 'Block',
    description: 'Absorbs incoming damage before HP. Resets at start of your turn.',
  },
  poison: {
    name: 'Doubt',
    description: 'Deals damage at the start of each turn. Decreases by 1 each turn.',
  },
  weakness: {
    name: 'Drawing Blanks',
    description: 'Enemy deals 25% less damage while weakened.',
  },
  vulnerable: {
    name: 'Exposed',
    description: 'Target takes 50% more damage while vulnerable.',
  },
  strength: {
    name: 'Clarity',
    description: 'Attacks deal +25% damage per stack. Passive; does not tick.',
  },
  regen: {
    name: 'Recall',
    description: 'Heals value HP at the start of each turn. Decreases by 1 each turn.',
  },
  immunity: {
    name: 'Shielded Mind',
    description: 'Absorbs next Doubt (Poison) damage instance. Consumed on trigger.',
  },
  burn: {
    name: 'Brain Burn',
    description: 'On-hit: deal bonus damage equal to stacks, then stacks halve (floor).',
  },
  bleed: {
    name: 'Lingering Doubt',
    description: 'Card-play attacks deal +1 bonus damage per stack. Decays 1/turn.',
  },
  thorns: {
    name: 'Thorns',
    description: 'When hit, reflect damage back to the attacker.',
  },
  persistent_block: {
    name: 'Persistent Block',
    description: 'Block that carries over to the next turn instead of resetting.',
  },
  lifetap: {
    name: 'Lifetap',
    description: 'Heal a percentage of damage dealt to the enemy.',
  },
  ap: {
    name: 'AP',
    description: 'Action Points. Spend AP to play cards. Refreshes each turn.',
  },
  echo: {
    name: 'Echo',
    description: 'A ghostly copy of a card. Fades after use.',
  },
  mastery_trial: {
    name: 'Mastery Trial',
    description: 'A special challenge. Answering correctly masters the fact permanently.',
  },
};

/** Look up a keyword definition by ID */
export function getKeywordDefinition(id: string): KeywordDef | undefined {
  return KEYWORD_DEFINITIONS[id];
}
