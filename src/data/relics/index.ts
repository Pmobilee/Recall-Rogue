export type {
  RelicRarity,
  RelicCategory,
  RelicTrigger,
  RelicEffect,
  RelicDefinition,
  RunRelic,
} from './types';

import { STARTER_RELICS } from './starters';
import { UNLOCKABLE_RELICS } from './unlockable';
import type { RelicDefinition } from './types';

/** Complete catalogue of all relic definitions. */
export const FULL_RELIC_CATALOGUE: RelicDefinition[] = [
  ...STARTER_RELICS,
  ...UNLOCKABLE_RELICS,
];

/** Lookup map: relic ID → definition. */
export const RELIC_BY_ID: Record<string, RelicDefinition> = Object.fromEntries(
  FULL_RELIC_CATALOGUE.map((r) => [r.id, r]),
);

/** IDs of the 25 free starter relics. */
export const STARTER_RELIC_IDS: string[] = STARTER_RELICS.map((r) => r.id);

export { STARTER_RELICS } from './starters';
export { UNLOCKABLE_RELICS } from './unlockable';
