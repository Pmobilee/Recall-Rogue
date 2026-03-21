// === Synonym Lookup Service ===
// Pre-computed WordNet synonym data loaded at build time.
// NO Phaser, Svelte, or DOM imports.

import synonymData from '../data/generated/synonymMap.json';

const map = synonymData as Record<string, { synonyms: string[]; related: string[] }>;

/** Get synonyms for a word (members of the same WordNet synset). */
export function getSynonyms(word: string): string[] {
  return map[word.toLowerCase()]?.synonyms ?? [];
}

/** Get related words (same category but different meaning — e.g., sibling hyponyms). */
export function getRelatedWords(word: string): string[] {
  return map[word.toLowerCase()]?.related ?? [];
}

/** Whether WordNet synonym data exists for this word. */
export function hasSynonymData(word: string): boolean {
  return word.toLowerCase() in map;
}
