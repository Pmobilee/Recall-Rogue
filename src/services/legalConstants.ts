/**
 * Shared constants for the legal / age-gate system.
 * Kept in a plain TypeScript file so they can be imported by both
 * Svelte components and non-component services without circular-import issues.
 */

/** localStorage key under which the player's age bracket is stored. */
export const AGE_BRACKET_KEY = 'rr_age_bracket' as const

/**
 * The three age brackets that the AgeGate can produce.
 * - 'under_13' maps to AgeRating 'kid'
 * - 'teen'     maps to AgeRating 'teen'
 * - 'adult'    maps to AgeRating 'adult'
 */
export type AgeBracket = 'under_13' | 'teen' | 'adult'
