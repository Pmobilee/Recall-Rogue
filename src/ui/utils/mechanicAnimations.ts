/** Card flip duration (ms) */
export const REVEAL_DURATION = 400;

/** Mechanic animation duration (ms) */
export const MECHANIC_DURATION = 500;

/** Existing launch fly-up (ms) */
export const LAUNCH_DURATION = 300;

/** Animation phase for card play sequence */
export type CardAnimPhase = 'reveal' | 'mechanic' | 'launch' | 'fizzle' | null;

/** Maps mechanic IDs to their CSS animation class names */
const MECHANIC_ANIM_MAP: Record<string, string> = {
  // Attack
  strike: 'mech-strike',
  multi_hit: 'mech-multi-hit',
  heavy_strike: 'mech-heavy-strike',
  piercing: 'mech-piercing',
  reckless: 'mech-reckless',
  execute: 'mech-execute',

  // Shield
  block: 'mech-block',
  thorns: 'mech-thorns',
  fortify: 'mech-fortify',
  parry: 'mech-parry',
  brace: 'mech-brace',

  // Heal
  restore: 'mech-restore',
  cleanse: 'mech-cleanse',
  overheal: 'mech-overheal',
  lifetap: 'mech-lifetap',

  // Buff
  empower: 'mech-empower',
  quicken: 'mech-quicken',
  double_strike: 'mech-double-strike',
  focus: 'mech-focus',

  // Debuff
  weaken: 'mech-weaken',
  expose: 'mech-expose',
  slow: 'mech-slow',
  hex: 'mech-hex',

  // Utility
  scout: 'mech-scout',
  recycle: 'mech-recycle',
  foresight: 'mech-foresight',
  transmute: 'mech-transmute',

  // Regen
  sustained: 'mech-sustained',
  emergency: 'mech-emergency',
  immunity: 'mech-immunity',

  // Wild
  mirror: 'mech-mirror',
  adapt: 'mech-adapt',
  overclock: 'mech-overclock',
};

/** Maps card types to their default fallback animation class */
const TYPE_FALLBACK_MAP: Record<string, string> = {
  attack: 'mech-strike',
  shield: 'mech-block',
  heal: 'mech-restore',
  buff: 'mech-empower',
  debuff: 'mech-weaken',
  utility: 'mech-scout',
  regen: 'mech-sustained',
  wild: 'mech-mirror',
};

/**
 * Returns the CSS animation class for a given mechanic ID.
 * Falls back to empty string if the mechanic is unknown or undefined.
 */
export function getMechanicAnimClass(mechanicId: string | undefined): string {
  if (!mechanicId) return '';
  return MECHANIC_ANIM_MAP[mechanicId] ?? '';
}

/**
 * Returns a fallback animation class based on card type,
 * used when the mechanic ID is unknown.
 */
export function getTypeFallbackAnimClass(cardType: string): string {
  return TYPE_FALLBACK_MAP[cardType] ?? '';
}
