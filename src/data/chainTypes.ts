/**
 * Chain type definitions for the card chaining system.
 * Each chain type has a unique index, display name, hex color, and glow color.
 */

/** Defines a single chain type used in the card chaining system. */
export interface ChainTypeDef {
  /** Zero-based index identifying this chain type (0–5). */
  index: number;
  /** Display name of the chain type. */
  name: string;
  /** Primary hex color string (e.g. `#546E7A`). */
  hexColor: string;
  /** Glow color string at 30% opacity (e.g. `rgba(84, 110, 122, 0.30)`). */
  glowColor: string;
}

/** Total number of chain types in the game. */
export const NUM_CHAIN_TYPES = 6;

/** Number of chain types selected per run (subset of all 6). */
export const CHAIN_TYPES_PER_RUN = 3;

/**
 * Deterministically selects N chain types for a run based on a seed.
 * @param seed - Numeric seed for deterministic selection
 * @param count - Number of chain types to select (default: CHAIN_TYPES_PER_RUN)
 * @returns Array of chain type indices (e.g., [0, 2, 4])
 */
export function selectRunChainTypes(seed: number, count: number = CHAIN_TYPES_PER_RUN): number[] {
  // Use seeded shuffle to pick `count` indices from [0, 1, 2, 3, 4, 5]
  // Use a simple seeded RNG (multiply-with-carry / LCG variant)
  const indices = [0, 1, 2, 3, 4, 5];
  // Fisher-Yates shuffle with seeded random
  let s = seed;
  for (let i = indices.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xFFFFFFFF;
    const j = ((s >>> 0) % (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, count).sort((a, b) => a - b);
}

/** All chain type definitions, indexed 0–5. */
export const CHAIN_TYPES: readonly ChainTypeDef[] = [
  { index: 0, name: 'Obsidian', hexColor: '#546E7A', glowColor: 'rgba(84, 110, 122, 0.30)' },
  { index: 1, name: 'Crimson',  hexColor: '#EF5350', glowColor: 'rgba(239, 83, 80, 0.30)'  },
  { index: 2, name: 'Azure',    hexColor: '#42A5F5', glowColor: 'rgba(66, 165, 245, 0.30)' },
  { index: 3, name: 'Amber',    hexColor: '#FFA726', glowColor: 'rgba(255, 167, 38, 0.30)' },
  { index: 4, name: 'Violet',   hexColor: '#AB47BC', glowColor: 'rgba(171, 71, 188, 0.30)' },
  { index: 5, name: 'Jade',     hexColor: '#26A69A', glowColor: 'rgba(38, 166, 154, 0.30)' },
];

/**
 * Returns the display name for a chain type by index.
 * @param index - Chain type index (0–5).
 * @returns The chain type name, or `'Unknown'` if the index is out of range.
 */
export function getChainTypeName(index: number): string {
  return CHAIN_TYPES[index]?.name ?? 'Unknown';
}

/**
 * Returns the primary hex color for a chain type by index.
 * @param index - Chain type index (0–5).
 * @returns The hex color string, or `'#888888'` if the index is out of range.
 */
export function getChainTypeColor(index: number): string {
  return CHAIN_TYPES[index]?.hexColor ?? '#888888';
}

/**
 * Returns the glow color (30% opacity) for a chain type by index.
 * @param index - Chain type index (0–5).
 * @returns The rgba glow color string, or `'rgba(136,136,136,0.30)'` if the index is out of range.
 */
export function getChainTypeGlowColor(index: number): string {
  return CHAIN_TYPES[index]?.glowColor ?? 'rgba(136,136,136,0.30)';
}
