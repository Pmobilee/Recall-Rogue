/**
 * petTraits.ts
 * Full definition of all Dust Cat personality traits. (DD-V2-042)
 * Each trait has a name, description, passive bonus, and
 * a modifier map for dome animation weights.
 */

export type TraitId =
  | 'playful'    // +3% quiz score bonus (curiosity keeps cat engaged)
  | 'curious'    // +1 extra fog-of-war reveal tile on entry per layer
  | 'loyal'      // +5 happiness restored per mine dive completed
  | 'stubborn'   // Happiness decays 25% slower (−1.5/hr instead of −2/hr)
  | 'timid'      // Cat reacts to hazard blocks; GAIA warns player 1 tick earlier
  | 'brave'      // Cat react_excited on boss floor entry; +2% block damage
  | 'lazy'       // Happiness minimum floor: 20 (cat never goes below 20)
  | 'energetic'  // +1 extra food item spawned in Feed mini-game (9 instead of 8)
  | 'scholar'    // +1 knowledge point per 5 facts reviewed while cat happiness >= 60
  | 'nocturnal'  // Happiness decays 50% slower during 22:00–06:00 local time

export interface PetTrait {
  id: TraitId
  name: string
  description: string
  /** Short label for the trait chip in the UI. */
  label: string
  /** Passive effect description shown in tooltip. */
  effectDescription: string
  /** Animation weight modifiers for DustCatWanderer. Keys = DustCatAmbientAnim. */
  animWeightMods: Partial<Record<string, number>>
  /** Colour used for the trait chip badge. */
  badgeColor: string
}

export const PET_TRAITS: Record<TraitId, PetTrait> = {
  playful: {
    id: 'playful',
    name: 'Playful',
    label: 'Playful',
    description: 'Always ready for a game. Turns learning into fun.',
    effectDescription: '+3% to quiz score bonus rewards',
    animWeightMods: { react_happy: 3, react_excited: 2, idle_groom: -1 },
    badgeColor: '#FF7043',
  },
  curious: {
    id: 'curious',
    name: 'Curious',
    label: 'Curious',
    description: 'Investigates every corner of the mine and dome alike.',
    effectDescription: '+1 fog-of-war reveal tile per layer entry',
    animWeightMods: { idle_sniff: 3, walk: 1 },
    badgeColor: '#29B6F6',
  },
  loyal: {
    id: 'loyal',
    name: 'Loyal',
    label: 'Loyal',
    description: 'Sticks close and celebrates every safe return.',
    effectDescription: '+5 happiness on mine return',
    animWeightMods: { react_happy: 2, idle_sit: 1 },
    badgeColor: '#66BB6A',
  },
  stubborn: {
    id: 'stubborn',
    name: 'Stubborn',
    label: 'Stubborn',
    description: 'Does things at its own pace. Prefers its own schedule.',
    effectDescription: 'Happiness decays 25% slower',
    animWeightMods: { sleep: 2, idle_sit: 2, walk: -1 },
    badgeColor: '#8D6E63',
  },
  timid: {
    id: 'timid',
    name: 'Timid',
    label: 'Timid',
    description: 'Startles easily, but that means it senses danger first.',
    effectDescription: 'GAIA hazard warning fires 1 tick earlier when cat is following',
    animWeightMods: { idle_sniff: 2, react_happy: -1 },
    badgeColor: '#AB47BC',
  },
  brave: {
    id: 'brave',
    name: 'Brave',
    label: 'Brave',
    description: 'Fearless in the face of the unknown.',
    effectDescription: '+2% block damage; plays excited anim on boss floors',
    animWeightMods: { react_excited: 3, walk: 2, sleep: -2 },
    badgeColor: '#EF5350',
  },
  lazy: {
    id: 'lazy',
    name: 'Lazy',
    label: 'Lazy',
    description: 'Content to nap anywhere. Hard to disappoint.',
    effectDescription: 'Happiness never drops below 20',
    animWeightMods: { sleep: 4, idle_sit: 2, walk: -2 },
    badgeColor: '#78909C',
  },
  energetic: {
    id: 'energetic',
    name: 'Energetic',
    label: 'Energetic',
    description: 'Boundless energy. Could run circles around the drill.',
    effectDescription: '+1 food item in Feed mini-game',
    animWeightMods: { walk: 3, react_excited: 2, sleep: -3 },
    badgeColor: '#FFCA28',
  },
  scholar: {
    id: 'scholar',
    name: 'Scholar',
    label: 'Scholar',
    description: 'Sits attentively during study sessions. Pays close attention.',
    effectDescription: '+1 knowledge point per 5 facts reviewed at happiness >= 60',
    animWeightMods: { idle_sit: 3, idle_groom: 1 },
    badgeColor: '#5C6BC0',
  },
  nocturnal: {
    id: 'nocturnal',
    name: 'Nocturnal',
    label: 'Nocturnal',
    description: 'Most alert after dark. Happiness barely fades at night.',
    effectDescription: 'Happiness decays 50% slower between 22:00–06:00 local time',
    animWeightMods: { sleep: -2, walk: 2, idle_sniff: 1 },
    badgeColor: '#26C6DA',
  },
}

/** All trait IDs as an ordered array for random selection. */
export const ALL_TRAIT_IDS: TraitId[] = Object.keys(PET_TRAITS) as TraitId[]

/**
 * Randomly assign two distinct trait IDs. Uses the provided seeded random if
 * given, otherwise Math.random(). (DD-V2-042: traits are permanent per save.)
 *
 * @param seed - Optional numeric seed for deterministic assignment.
 */
export function assignTraits(seed?: number): [TraitId, TraitId] {
  const rng = seed !== undefined
    ? (() => { let s = seed; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xFFFFFFFF } })()
    : Math.random.bind(Math)
  const pool = [...ALL_TRAIT_IDS]
  const idxA = Math.floor(rng() * pool.length)
  const [traitA] = pool.splice(idxA, 1)
  const idxB = Math.floor(rng() * pool.length)
  const traitB = pool[idxB]
  return [traitA, traitB]
}
