/**
 * Synergy definitions for card mechanics and relics.
 * Used to show synergy tooltips when acquiring new cards/relics.
 */

/** Maps each mechanic to the mechanics it synergizes with */
export const MECHANIC_SYNERGIES: Record<string, string[]> = {
  empower: ['strike', 'heavy_strike', 'multi_hit', 'reckless', 'piercing', 'execute', 'lifetap'],
  double_strike: ['strike', 'heavy_strike', 'multi_hit', 'reckless', 'piercing', 'execute', 'lifetap', 'empower'],
  focus: ['heavy_strike', 'multi_hit', 'fortify', 'slow', 'double_strike'],
  expose: ['strike', 'heavy_strike', 'multi_hit', 'reckless', 'piercing', 'execute'],
  quicken: ['heavy_strike', 'multi_hit', 'double_strike'],
  hex: ['hex', 'expose'],
  brace: ['scout', 'foresight'],
  strike: ['empower', 'double_strike', 'expose'],
  heavy_strike: ['empower', 'double_strike', 'focus', 'expose', 'quicken'],
  multi_hit: ['empower', 'double_strike', 'focus', 'expose', 'quicken'],
  reckless: ['empower', 'double_strike', 'expose'],
  piercing: ['empower', 'double_strike', 'expose'],
  execute: ['empower', 'double_strike', 'expose', 'hex'],
  lifetap: ['empower', 'double_strike'],
  block: ['fortify', 'thorns', 'brace'],
  thorns: ['block', 'fortify', 'brace'],
  fortify: ['block', 'thorns', 'focus'],
  emergency: ['block', 'fortify'],
  overheal: ['block', 'emergency'],
  scout: ['brace', 'recycle', 'foresight'],
  foresight: ['brace', 'scout'],
  recycle: ['scout', 'foresight'],
  weaken: ['expose', 'hex'],
  slow: ['focus', 'expose'],
  cleanse: [],
  mirror: ['empower', 'double_strike', 'heavy_strike'],
  adapt: [],
};

/**
 * Given a mechanic name and a list of mechanics in the player's deck,
 * returns the names of deck mechanics that synergize with the given mechanic.
 */
export function findSynergies(mechanic: string, deckMechanics: string[]): string[] {
  const synergies = MECHANIC_SYNERGIES[mechanic] ?? [];
  return deckMechanics.filter(m => synergies.includes(m));
}

/**
 * Given a mechanic name and a list of mechanics in the player's deck,
 * returns a human-readable synergy label or null if no synergies.
 */
export function getSynergyLabel(mechanic: string, deckMechanics: string[]): string | null {
  const matches = findSynergies(mechanic, deckMechanics);
  if (matches.length === 0) return null;
  // Deduplicate and format
  const unique = [...new Set(matches)];
  const formatted = unique.map(m => m.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
  return formatted.join(', ');
}
