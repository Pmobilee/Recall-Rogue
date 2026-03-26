/**
 * Card upgrade service — handles STS-style "+" upgrades at rest sites AND
 * the in-run mastery upgrade system (AR-113).
 *
 * Mastery upgrades boost card values per encounter based on quiz performance.
 * The old rest-site upgrade functions are kept for backward compatibility.
 * Pure logic — no Phaser/Svelte/DOM imports.
 */

import type { Card } from '../data/card-types';
import { getMechanicDefinition } from '../data/mechanics';
import { MASTERY_MAX_LEVEL } from '../data/balance';

// ─── Mastery Upgrade System (AR-113) ───────────────────────────────────────

/** Per-mechanic mastery definition: how values scale per mastery level. */
export interface MasteryUpgradeDef {
  /** Added to baseEffectValue PER mastery level. */
  perLevelDelta: number;
  /** Added to secondaryValue PER mastery level (if applicable). */
  secondaryPerLevelDelta?: number;
  /** AP cost reduction applied at specific levels (array of level thresholds). */
  apCostReductionAtLevels?: number[];
  /** Tag added at a specific level. [level, tagName] */
  addTagAtLevel?: [number, string];
  /** Maximum mastery level this mechanic can reach (default: MASTERY_MAX_LEVEL). */
  maxLevel?: number;
}

/** Mastery scaling definitions for each mechanic. */
export const MASTERY_UPGRADE_DEFS: Record<string, MasteryUpgradeDef> = {
  // Attacks
  strike:        { perLevelDelta: 3 },                           // 4 -> 19 (base 4 + 5×3)
  multi_hit:     { perLevelDelta: 1 },                           // per hit
  heavy_strike:  { perLevelDelta: 3 },                           // 4 -> 19 (base 4 + 5×3)
  piercing:      { perLevelDelta: 2 },                           // 4 -> 14 (base 4 + 5×2)
  reckless:      { perLevelDelta: 3 },                           // 4 -> 19 (base 4 + 5×3)
  execute:       { perLevelDelta: 0, secondaryPerLevelDelta: 2 }, // bonus 8 -> 18
  lifetap:       { perLevelDelta: 2 },                           // 4 -> 14 (base 4 + 5×2)
  double_strike: { perLevelDelta: 1 },                           // per hit
  // Shields
  block:         { perLevelDelta: 2 },                           // 3 -> 13 (base 3 + 5×2)
  fortify:       { perLevelDelta: 1 },                           // 7 -> 12
  parry:         { perLevelDelta: 1 },                           // 3 -> 8
  brace:         { perLevelDelta: 2 },                           // 3 -> 13 (base 3 + 5×2)
  emergency:     { perLevelDelta: 1 },                           // 4 -> 9
  overheal:      { perLevelDelta: 2 },                           // 10 -> 20
  thorns:        { perLevelDelta: 0, secondaryPerLevelDelta: 1 }, // retaliate 3 -> 8
  // Buffs
  empower:       { perLevelDelta: 5 },                           // 50% -> 75%
  mirror:        { perLevelDelta: 0.05 },                        // 1.0 -> 1.25x
  adapt:         { perLevelDelta: 0.05 },                        // 1.0 -> 1.25x
  // Debuffs
  weaken:        { perLevelDelta: 0.4 },                         // floor'd: 2,2,2,3,3,4 turns
  expose:        { perLevelDelta: 0.4 },                         // floor'd: 1,1,1,2,2,3 turns
  slow:          { perLevelDelta: 0.4 },                         // floor'd: 2,2,2,3,3,4 turns
  hex:           { perLevelDelta: 1 },                           // 3 -> 8 per turn
  // Utility
  scout:         { perLevelDelta: 0, addTagAtLevel: [3, 'draw'] }, // +1 draw at L3 (via tag)
  recycle:       { perLevelDelta: 0.2 },                         // floor'd: 3,3,3,3,4,4
  foresight:     { perLevelDelta: 0, secondaryPerLevelDelta: 0.2 }, // floor'd at L3+
  quicken:       { perLevelDelta: 0, addTagAtLevel: [3, 'draw'], maxLevel: 3 },
  cleanse:       { perLevelDelta: 0, maxLevel: 2 },              // binary — no scaling
  focus:         { perLevelDelta: 0, secondaryPerLevelDelta: 0.2 }, // +1 at L3
  immunity:      { perLevelDelta: 0, maxLevel: 2 },              // binary
  overclock:     { perLevelDelta: 0, apCostReductionAtLevels: [3], maxLevel: 3 }, // AP-1 at L3
  transmute:     { perLevelDelta: 0.2, maxLevel: 3 },            // floor'd: 1 -> 2 at L3
  conjure:       { perLevelDelta: 0, maxLevel: 3 },              // Mastery improves candidate tier (handled via sourceMasteryLevel)
  forge:         { perLevelDelta: 0, maxLevel: 3 },              // Mastery improves upgrade amount and pick count

  // ── AR-206: Phase 1 Expansion Cards ─────────────────────────────────────────

  // Filler cards
  power_strike:      { perLevelDelta: 3 },                           // 4 -> 19 (base 4 + 5×3)
  twin_strike:       { perLevelDelta: 1 },                           // 5x2 -> 10x2 per hit
  iron_wave:         { perLevelDelta: 1, secondaryPerLevelDelta: 1 }, // 5+5 -> 10+10
  reinforce:         { perLevelDelta: 2 },                           // 3 -> 13 (base 3 + 5×2)
  shrug_it_off:      { perLevelDelta: 1, addTagAtLevel: [3, 'draw2'] }, // 6 -> 11; L3: draws 2
  bash:              { perLevelDelta: 3, addTagAtLevel: [3, 'vuln_ext'] }, // 4 -> 19 (base 4 + 5×3); L3: +1t Vuln
  guard:             { perLevelDelta: 2 },                           // 3 -> 13 (base 3 + 5×2)
  sap:               { perLevelDelta: 1, addTagAtLevel: [3, 'weak_ext'] }, // 3 -> 8; L3: +1t Weakness

  // Bleed cards
  rupture:           { perLevelDelta: 1, secondaryPerLevelDelta: 1 }, // 5+3 -> 10+8
  lacerate:          { perLevelDelta: 1, secondaryPerLevelDelta: 1 }, // 4+4 -> 9+9

  // Burn cards
  kindle:            { perLevelDelta: 1, secondaryPerLevelDelta: 1 }, // 4+4 -> 9+9
  ignite:            { perLevelDelta: 1 },                           // 4 -> 9 burn on next atk

  // Basic new cards
  overcharge:        { perLevelDelta: 1 },                           // 6 -> 11 base (+ per-Charge scaling unchanged)
  riposte:           { perLevelDelta: 1, secondaryPerLevelDelta: 1 }, // 5+4 -> 10+9
  absorb:            { perLevelDelta: 1, addTagAtLevel: [3, 'draw2'] }, // 5 -> 10; L3 CC: draws 2
  reactive_shield:   { perLevelDelta: 1, addTagAtLevel: [3, 'thorns_ext'] }, // 4 -> 9; L3: +1 Thorns
  sift:              { perLevelDelta: 1 },                           // look 3 -> look 8 cards
  scavenge:          { perLevelDelta: 0, addTagAtLevel: [3, 'scavenge2'], maxLevel: 3 }, // L3: QP puts 2 on top
  precision_strike:  { perLevelDelta: 3, addTagAtLevel: [3, 'timer_ext75'] }, // 4 -> 19 (base 4 + 5×3); L3: timer +75%
  stagger:           { perLevelDelta: 0, addTagAtLevel: [3, 'weak_apply'], maxLevel: 3 }, // L3: QP applies 1t Weakness
  corrode:           { perLevelDelta: 1, addTagAtLevel: [3, 'weak_ext'] }, // 5 -> 10 block removed; L3: +1t Weakness
  swap:              { perLevelDelta: 0, addTagAtLevel: [3, 'draw3cc'], maxLevel: 3 }, // L3: CC draws 3
  siphon_strike:     { perLevelDelta: 1, addTagAtLevel: [3, 'min_heal3'] }, // 6 -> 11; L3: min heal = 3
  aegis_pulse:       { perLevelDelta: 1, addTagAtLevel: [3, 'chain_buff3'] }, // 5 -> 10; L3: chain buff +3

  // Inscription cards
  inscription_fury:  { perLevelDelta: 0.5 },                        // +2 -> +4 atk (rounded)
  inscription_iron:  { perLevelDelta: 0.5 },                        // +3 -> +5 block/turn (rounded)

  // ── AR-207: Phase 2 Identity / Flagship Cards ─────────────────────────────

  // Attacks
  gambit:            { perLevelDelta: 2, addTagAtLevel: [3, 'self_dmg_minus1'] }, // 10 -> 20 dmg; L3: self-dmg -1
  chain_lightning:   { perLevelDelta: 1 },                           // base 8 -> 13 (multiplied by chain length on CC)
  volatile_slash:    { perLevelDelta: 2 },                           // 10 -> 20; CC still exhausts

  // Shields
  burnout_shield:    { perLevelDelta: 2 },                           // 8 -> 18; CC still exhausts
  knowledge_ward:    { perLevelDelta: 1 },                           // 4/domain -> 9/domain

  // Buffs
  warcry:            { perLevelDelta: 0, addTagAtLevel: [3, 'warcry_perm_str'], maxLevel: 3 }, // L3 QP: +1 permanent Str
  battle_trance:     { perLevelDelta: 0, addTagAtLevel: [3, 'battle_trance_draw4'], maxLevel: 3 }, // L3 QP: draw 4

  // Debuffs
  curse_of_doubt:    { perLevelDelta: 5 },                           // +30% -> +55% charge amp (QP base)
  mark_of_ignorance: { perLevelDelta: 1 },                           // +3 -> +8 flat charge amp (QP base)
  corroding_touch:   { perLevelDelta: 1, maxLevel: 3 },              // +1 Weakness duration/level (QP: 1t -> 4t)

  // Wilds
  phase_shift:       { perLevelDelta: 2 },                           // 8 -> 18 dmg/block; CC: 12 -> 22
  chameleon:         { perLevelDelta: 0, addTagAtLevel: [3, 'chameleon_qp_chain'], maxLevel: 3 }, // L3 QP: also inherits chain type
  dark_knowledge:    { perLevelDelta: 1 },                           // 3/curse -> 8/curse (QP base)
  chain_anchor:      { perLevelDelta: 0, addTagAtLevel: [3, 'chain_anchor_3'], maxLevel: 3 }, // L3 CC: sets chain to 3
  unstable_flux:     { perLevelDelta: 0, addTagAtLevel: [3, 'unstable_flux_qp_choice'], maxLevel: 3 }, // L3 QP: choose 1 of 2 options

  // ── AR-208: Phase 3 Advanced / Chase Cards ────────────────────────────────

  // Attacks
  smite:             { perLevelDelta: 2, maxLevel: 5 },                              // QP base 10→20; CC avg-mastery bonus unchanged
  feedback_loop:     { perLevelDelta: 2, addTagAtLevel: [3, 'feedback_weakness'], maxLevel: 3 }, // QP 5→11; CC 20→32; L3 QP applies 1 Weakness
  recall:            { perLevelDelta: 0.2, addTagAtLevel: [3, 'recall_draw'], maxLevel: 5 },    // per-card 1.0→2.0; L3: draw 1 after resolving
  hemorrhage:        { perLevelDelta: 1, maxLevel: 5 },                              // base 4→9 (+ per-Bleed multiplier unchanged)
  eruption:          { perLevelDelta: 1, maxLevel: 3 },                              // QP per-AP 8→11; CC per-AP 12→15

  // Shields
  bulwark:           { perLevelDelta: 3, maxLevel: 3 },                              // QP 18→27; CC 36→45 (still exhausts)
  conversion:        { perLevelDelta: 2, maxLevel: 3 },                              // QP cap 10→16; CC cap 15→21
  ironhide:          { perLevelDelta: 1, addTagAtLevel: [3, 'ironhide_perm_qp'], maxLevel: 3 }, // QP 6→9; L3 QP: +1 permanent Str

  // Buffs
  frenzy:            { perLevelDelta: 0, addTagAtLevel: [3, 'frenzy_qp3'], maxLevel: 3 },       // L3 QP: frees 3 cards
  mastery_surge:     { perLevelDelta: 0, addTagAtLevel: [3, 'mastery_surge_qp2'], maxLevel: 3 },// L3 QP: upgrades 2 cards
  war_drum:          { perLevelDelta: 1, maxLevel: 5 },                              // QP buff +2→+7 to all hand cards

  // Debuffs
  entropy:           { perLevelDelta: 1, addTagAtLevel: [3, 'entropy_poison_qp'], maxLevel: 3 }, // QP Burn 3→6; L3 QP: +1 Poison

  // Utility
  archive:           { perLevelDelta: 0, addTagAtLevel: [3, 'archive_retain2_qp'], maxLevel: 3 }, // L3 QP: retains 2 cards
  reflex:            { perLevelDelta: 0, addTagAtLevel: [3, 'reflex_enhanced'], maxLevel: 3 },    // L3: QP draws 3; passive = 4 block
  recollect:         { perLevelDelta: 0, addTagAtLevel: [3, 'recollect_qp2'], maxLevel: 3 },      // L3 QP: returns 2 exhausted
  synapse:           { perLevelDelta: 0, addTagAtLevel: [3, 'synapse_draw3_qp'], maxLevel: 3 },   // L3 QP: draws 3
  siphon_knowledge:  { perLevelDelta: 0, addTagAtLevel: [3, 'siphon_qp3_time4s'], maxLevel: 3 },  // L3 QP: draws 3 + 4s preview
  tutor:             { perLevelDelta: 0, addTagAtLevel: [3, 'tutor_free_qp'], maxLevel: 3 },      // L3 QP: tutored card costs 0

  // Wild
  sacrifice:         { perLevelDelta: 0, addTagAtLevel: [3, 'sacrifice_draw3_qp'], maxLevel: 3 }, // L3 QP: draws 3
  catalyst:          { perLevelDelta: 0, addTagAtLevel: [3, 'catalyst_bleed_qp'], maxLevel: 3 },  // L3 QP: also doubles Bleed
  mimic:             { perLevelDelta: 0, addTagAtLevel: [3, 'mimic_choose_qp'], maxLevel: 3 },    // L3 QP: player chooses from discard
  aftershock:        { perLevelDelta: 0.1, maxLevel: 3 },                            // QP mult 0.5→0.8; CC mult 0.7→1.0 at L3
  knowledge_bomb:    { perLevelDelta: 1, maxLevel: 5 },                              // CC per-correct 4→9 damage

  // Inscription
  inscription_wisdom: { perLevelDelta: 0, addTagAtLevel: [3, 'inscription_wisdom_heal2'], maxLevel: 3 }, // L3 CC: heals 2 HP per correct
};

/**
 * Get the total base value bonus for a given mastery level.
 */
export function getMasteryBaseBonus(mechanicId: string, level: number): number {
  const def = MASTERY_UPGRADE_DEFS[mechanicId];
  if (!def) return 0;
  return def.perLevelDelta * level;
}

/**
 * Get the total secondary value bonus for a given mastery level.
 */
export function getMasterySecondaryBonus(mechanicId: string, level: number): number {
  const def = MASTERY_UPGRADE_DEFS[mechanicId];
  if (!def?.secondaryPerLevelDelta) return 0;
  return def.secondaryPerLevelDelta * level;
}

/**
 * Check if a tag should be added at this mastery level.
 * Returns the tag name if applicable, or null.
 */
export function getMasteryAddedTag(mechanicId: string, level: number): string | null {
  const def = MASTERY_UPGRADE_DEFS[mechanicId];
  if (!def?.addTagAtLevel) return null;
  const [threshold, tag] = def.addTagAtLevel;
  return level >= threshold ? tag : null;
}

/**
 * Check how many AP reductions apply at this mastery level.
 */
export function getMasteryApReduction(mechanicId: string, level: number): number {
  const def = MASTERY_UPGRADE_DEFS[mechanicId];
  if (!def?.apCostReductionAtLevels) return 0;
  return def.apCostReductionAtLevels.filter(l => level >= l).length;
}

/**
 * Whether a card can be mastery-upgraded.
 * Cards at max level, already-changed-this-encounter, and unknown mechanics cannot upgrade.
 * AR-202: Cursed cards cannot gain mastery until cured.
 */
export function canMasteryUpgrade(card: Card): boolean {
  // AR-202: Cursed cards are locked at effective mastery 0 until cured.
  if (card.isCursed) return false;
  const def = MASTERY_UPGRADE_DEFS[card.mechanicId ?? ''];
  const maxLevel = def?.maxLevel ?? MASTERY_MAX_LEVEL;
  if ((card.masteryLevel ?? 0) >= maxLevel) return false;
  if (card.masteryChangedThisEncounter) return false;
  if (!card.mechanicId) return false;
  return card.mechanicId in MASTERY_UPGRADE_DEFS;
}

/**
 * Whether a card can be mastery-downgraded.
 * Cards at level 0 and already-changed-this-encounter cards cannot downgrade.
 */
export function canMasteryDowngrade(card: Card): boolean {
  if ((card.masteryLevel ?? 0) <= 0) return false;
  if (card.masteryChangedThisEncounter) return false;
  return true;
}

/**
 * Upgrade a card's mastery by 1 level. Mutates in place. Returns the card.
 */
export function masteryUpgrade(card: Card): Card {
  const current = card.masteryLevel ?? 0;
  if (current >= MASTERY_MAX_LEVEL) return card;
  card.masteryLevel = current + 1;
  card.masteryChangedThisEncounter = true;
  card.isUpgraded = card.masteryLevel > 0; // backwards compat
  return card;
}

/**
 * Downgrade a card's mastery by 1 level. Mutates in place. Returns the card.
 */
export function masteryDowngrade(card: Card): Card {
  const current = card.masteryLevel ?? 0;
  if (current <= 0) return card;
  card.masteryLevel = current - 1;
  card.masteryChangedThisEncounter = true;
  card.isUpgraded = card.masteryLevel > 0; // backwards compat
  return card;
}

/**
 * Reset masteryChangedThisEncounter for all cards. Call at encounter start.
 */
export function resetEncounterMasteryFlags(cards: Card[]): void {
  for (const card of cards) {
    card.masteryChangedThisEncounter = false;
  }
}

/**
 * Get the effective base effect value including mastery bonus.
 * This is the value that should be used for damage/block calculations.
 */
export function getEffectiveBaseValue(card: Card): number {
  const bonus = getMasteryBaseBonus(card.mechanicId ?? '', card.masteryLevel ?? 0);
  return card.baseEffectValue + bonus;
}

/**
 * Get the effective secondary value including mastery bonus.
 */
export function getEffectiveSecondaryValue(card: Card): number | undefined {
  const mechDef = getMechanicDefinition(card.mechanicId);
  const base = card.secondaryValue ?? mechDef?.secondaryValue;
  if (base == null) return undefined;
  const bonus = getMasterySecondaryBonus(card.mechanicId ?? '', card.masteryLevel ?? 0);
  return base + bonus;
}

// ─── Legacy Rest-Site Upgrade System ────────────────────────────────────────
// @deprecated Use mastery system instead. Kept for backward compatibility.

/** Per-mechanic upgrade definition: what values change when upgraded. */
export interface MechanicUpgrade {
  /** Added to baseEffectValue. */
  baseValueDelta: number;
  /** Added to the mechanic's secondaryValue (for multi_hit hits, thorns retaliate, etc.). */
  secondaryValueDelta?: number;
  /** Optional new tag granted on upgrade (e.g., quicken+ adds 'draw'). */
  addTag?: string;
  /** AP cost change on upgrade. Negative = cheaper. */
  apCostDelta?: number;
}

/**
 * Upgrade definitions for each Phase 1 and Phase 2 mechanic.
 * @deprecated Use MASTERY_UPGRADE_DEFS and the mastery system instead.
 */
export const UPGRADE_DEFS: Record<string, MechanicUpgrade> = {
  // Phase 1
  strike:    { baseValueDelta: 3 },                                    // 8→11
  multi_hit: { baseValueDelta: 0, apCostDelta: -1 },                  // AP 2→1
  block:     { baseValueDelta: 3 },                                    // 6→9
  thorns:    { baseValueDelta: 0, secondaryValueDelta: 1, apCostDelta: -1 }, // AP 1→0, reflect +1 (4 total)
  emergency: { baseValueDelta: 2 },                                    // 4→6
  scout:     { baseValueDelta: 1, apCostDelta: -1 },                  // AP 1→0, draw 2→3
  recycle:   { baseValueDelta: 1 },                                    // draw 3→4
  cleanse:   { baseValueDelta: 0, apCostDelta: -1 },                  // AP 1→0
  empower:   { baseValueDelta: 15 },                                   // 50→65%
  quicken:   { baseValueDelta: 0, addTag: 'draw' },                   // +draw (stays 0 AP)
  weaken:    { baseValueDelta: 1 },                                    // 2→3 turns
  expose:    { baseValueDelta: 1 },                                    // 1→2 turns
  mirror:    { baseValueDelta: 0.25 },                                 // 1.0→1.25x
  adapt:     { baseValueDelta: 0.25 },                                 // 1.0→1.25x
  focus:         { baseValueDelta: 0, secondaryValueDelta: 1 },        // next TWO cards cost 1 less AP
  // Phase 2
  heavy_strike:  { baseValueDelta: 0, apCostDelta: -1 },              // AP 3→2
  piercing:      { baseValueDelta: 3 },                                // 6→9
  reckless:      { baseValueDelta: 3 },                                // 12→15
  execute:       { baseValueDelta: 0, secondaryValueDelta: 4 },       // bonus 8→12
  lifetap:       { baseValueDelta: 1, apCostDelta: -1 },              // AP 2→1, 8→9
  fortify:       { baseValueDelta: 0, apCostDelta: -1 },              // AP 2→1 (7 block)
  parry:         { baseValueDelta: 2 },                                // 3→5
  brace:         { baseValueDelta: 3 },                                // +3 flat bonus
  overheal:      { baseValueDelta: 0, apCostDelta: -1 },              // AP 2→1 (10 block, ×2 <50%)
  double_strike: { baseValueDelta: 0, apCostDelta: -1 },              // AP 2→1
  slow:          { baseValueDelta: 0, apCostDelta: -1 },              // AP 2→1
  hex:           { baseValueDelta: 1 },                                // 3→4/turn
  foresight:     { baseValueDelta: 0, secondaryValueDelta: 1 },        // draw 1→2 extra cards
  transmute:     { baseValueDelta: 1 },                                // transform 1→2
  immunity:      { baseValueDelta: 0, apCostDelta: -1 },              // AP 1→0
  overclock:     { baseValueDelta: 0, apCostDelta: -1 },              // AP 2→1
};

/**
 * Returns true if the card can be upgraded (rest-site system).
 * @deprecated Use canMasteryUpgrade for the mastery system instead.
 */
export function canUpgradeCard(card: Card): boolean {
  if (card.isUpgraded) return false;
  if (!card.mechanicId) return false;
  return card.mechanicId in UPGRADE_DEFS;
}

/**
 * Applies the rest-site upgrade to a card in-place.
 * @deprecated Use masteryUpgrade for the mastery system instead.
 */
export function upgradeCard(card: Card): Card {
  const upgrade = UPGRADE_DEFS[card.mechanicId ?? ''];
  if (!upgrade) return card;

  card.baseEffectValue += upgrade.baseValueDelta;

  // Apply secondary value delta if present
  if (upgrade.secondaryValueDelta != null) {
    const mechDef = getMechanicDefinition(card.mechanicId);
    const currentSecondary = card.secondaryValue ?? mechDef?.secondaryValue ?? 0;
    card.secondaryValue = currentSecondary + upgrade.secondaryValueDelta;
  }

  // Apply AP cost delta if present
  if (upgrade.apCostDelta != null) {
    card.apCost = Math.max(0, (card.apCost ?? 1) + upgrade.apCostDelta);
  }

  card.mechanicName = (card.mechanicName ?? '') + '+';
  card.isUpgraded = true;
  return card;
}

/** Upgrade preview data for the UI. */
export interface UpgradePreview {
  upgradedName: string;
  currentBaseValue: number;
  newBaseValue: number;
  secondaryDelta?: number;
  addTag?: string;
  currentApCost?: number;
  newApCost?: number;
}

/**
 * Returns a preview of what the rest-site upgrade would look like without applying it.
 * @deprecated Use mastery system instead.
 */
export function getUpgradePreview(card: Card): UpgradePreview | null {
  const upgrade = UPGRADE_DEFS[card.mechanicId ?? ''];
  if (!upgrade) return null;

  const preview: UpgradePreview = {
    upgradedName: (card.mechanicName ?? '') + '+',
    currentBaseValue: card.baseEffectValue,
    newBaseValue: card.baseEffectValue + upgrade.baseValueDelta,
    secondaryDelta: upgrade.secondaryValueDelta,
    addTag: upgrade.addTag,
  };

  if (upgrade.apCostDelta != null) {
    preview.currentApCost = card.apCost ?? 1;
    preview.newApCost = Math.max(0, (card.apCost ?? 1) + upgrade.apCostDelta);
  }

  return preview;
}

/** Tier priority for sorting upgrade candidates (higher tier = more desirable). */
const TIER_PRIORITY: Record<string, number> = { '3': 4, '2b': 3, '2a': 2, '1': 1 };

/**
 * Returns upgrade candidates from the deck, sorted by knowledge tier (highest first).
 * @deprecated Use mastery system instead.
 *
 * @param deck - All cards in the player's active deck (all piles combined).
 * @param count - Max number of candidates to return.
 */
export function getUpgradeCandidates(deck: Card[], count: number): Card[] {
  const eligible = deck.filter(canUpgradeCard);

  eligible.sort((a, b) => {
    const tierA = TIER_PRIORITY[a.tier] ?? 0;
    const tierB = TIER_PRIORITY[b.tier] ?? 0;
    if (tierB !== tierA) return tierB - tierA;
    // Within same tier, prefer higher effectMultiplier (higher tier = stronger cards)
    return (b.effectMultiplier ?? 1) - (a.effectMultiplier ?? 1);
  });

  return eligible.slice(0, count);
}
