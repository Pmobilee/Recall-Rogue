/**
 * Card Art Manifest — maps mechanic IDs to card art image URLs.
 * Art is displayed in the pentagon window of the V2 card frame.
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
}

/** Get URL for card art by mechanic ID. Returns null if no art exists. */
export function getCardArtUrl(mechanicId: string): string | null {
  const file = CARD_ART_MAP[mechanicId]
  return file ? `${ART_BASE}/${file}` : null
}

/** Check if card art exists for a mechanic. */
export function hasCardArt(mechanicId: string): boolean {
  return mechanicId in CARD_ART_MAP
}
