/**
 * Card Art Manifest — maps mechanic IDs to card art image URLs.
 * Art is displayed in the pentagon window of the V2 card frame.
 *
 * IMPORTANT: When adding new art here, the Phaser RewardRoomScene will
 * automatically pick it up via CARD_ART_MECHANIC_IDS. No other changes needed.
 */

const ART_BASE = '/assets/cardart'

const CARD_ART_MAP: Record<string, string> = {
  strike: 'strike.png',
  multi_hit: 'multi_hit.png',
  heavy_strike: 'heavy_strike.png',
  piercing: 'piercing.png',
  reckless: 'reckless.png',
  execute: 'execute.png',
  lifetap: 'lifetap.png',
  block: 'block.png',
  thorns: 'thorns.png',
  emergency: 'emergency.png',
  fortify: 'fortify.png',
  parry: 'parry.png',
  brace: 'brace.png',
  overheal: 'overheal.png',
  empower: 'empower.png',
  quicken: 'quicken.png',
  focus: 'focus.png',
  double_strike: 'double_strike.png',
  weaken: 'weaken.png',
  expose: 'expose.png',
  hex: 'hex.png',
  slow: 'slow.png',
  scout: 'scout.png',
  recycle: 'recycle.png',
  cleanse: 'cleanse.png',
  foresight: 'foresight.png',
  mirror: 'mirror.png',
  adapt: 'adapt.png',
  overclock: 'overclock.png',
  transmute: 'transmute.png',
  immunity: 'immunity.png',
  absorb: 'absorb.png',
  aegis_pulse: 'aegis_pulse.png',
  aftershock: 'aftershock.png',
  archive: 'archive.png',
  bash: 'bash.png',
  battle_trance: 'battle_trance.png',
  bulwark: 'bulwark.png',
  burnout_shield: 'burnout_shield.png',
  catalyst: 'catalyst.png',
  chain_anchor: 'chain_anchor.png',
  chain_lightning: 'chain_lightning.png',
  chameleon: 'chameleon.png',
  conversion: 'conversion.png',
  corrode: 'corrode.png',
  corroding_touch: 'corroding_touch.png',
  curse_of_doubt: 'curse_of_doubt.png',
  dark_knowledge: 'dark_knowledge.png',
  entropy: 'entropy.png',
  eruption: 'eruption.png',
  feedback_loop: 'feedback_loop.png',
  frenzy: 'frenzy.png',
  gambit: 'gambit.png',
  guard: 'guard.png',
  hemorrhage: 'hemorrhage.png',
  ignite: 'ignite.png',
  inscription_fury: 'inscription_fury.png',
  inscription_iron: 'inscription_iron.png',
  inscription_wisdom: 'inscription_wisdom.png',
  iron_wave: 'iron_wave.png',
  ironhide: 'ironhide.png',
  kindle: 'kindle.png',
  knowledge_bomb: 'knowledge_bomb.png',
  knowledge_ward: 'knowledge_ward.png',
  lacerate: 'lacerate.png',
  mark_of_ignorance: 'mark_of_ignorance.png',
  mastery_surge: 'mastery_surge.png',
  mimic: 'mimic.png',
  overcharge: 'overcharge.png',
  phase_shift: 'phase_shift.png',
  power_strike: 'power_strike.png',
  precision_strike: 'precision_strike.png',
  reactive_shield: 'reactive_shield.png',
  recall: 'recall.png',
  recollect: 'recollect.png',
  reflex: 'reflex.png',
  reinforce: 'reinforce.png',
  riposte: 'riposte.png',
  rupture: 'rupture.png',
  sacrifice: 'sacrifice.png',
  sap: 'sap.png',
  scavenge: 'scavenge.png',
  shrug_it_off: 'shrug_it_off.png',
  sift: 'sift.png',
  siphon_knowledge: 'siphon_knowledge.png',
  siphon_strike: 'siphon_strike.png',
  smite: 'smite.png',
  stagger: 'stagger.png',
  swap: 'swap.png',
  synapse: 'synapse.png',
  tutor: 'tutor.png',
  twin_strike: 'twin_strike.png',
  unstable_flux: 'unstable_flux.png',
  volatile_slash: 'volatile_slash.png',
  war_drum: 'war_drum.png',
  warcry: 'warcry.png',
}

/**
 * All mechanic IDs that have card art available.
 * Used by RewardRoomScene to preload art textures for the reward cloth display.
 * Automatically kept in sync with CARD_ART_MAP — no manual maintenance required.
 */
export const CARD_ART_MECHANIC_IDS: readonly string[] = Object.keys(CARD_ART_MAP)

/** Get URL for card art by mechanic ID. Returns null if no art exists. */
export function getCardArtUrl(mechanicId: string): string | null {
  const file = CARD_ART_MAP[mechanicId]
  return file ? `${ART_BASE}/${file}` : null
}

/** Check if card art exists for a mechanic. */
export function hasCardArt(mechanicId: string): boolean {
  return mechanicId in CARD_ART_MAP
}
