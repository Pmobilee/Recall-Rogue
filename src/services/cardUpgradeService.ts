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
  strike:        { perLevelDelta: 2 },                           // 8 -> 18
  multi_hit:     { perLevelDelta: 1 },                           // per hit
  heavy_strike:  { perLevelDelta: 2 },                           // 14 -> 24
  piercing:      { perLevelDelta: 1 },                           // 6 -> 11
  reckless:      { perLevelDelta: 2 },                           // 12 -> 22
  execute:       { perLevelDelta: 0, secondaryPerLevelDelta: 2 }, // bonus 8 -> 18
  lifetap:       { perLevelDelta: 1 },                           // 8 -> 13
  double_strike: { perLevelDelta: 1 },                           // per hit
  // Shields
  block:         { perLevelDelta: 2 },                           // 6 -> 16
  fortify:       { perLevelDelta: 1 },                           // 7 -> 12
  parry:         { perLevelDelta: 1 },                           // 3 -> 8
  brace:         { perLevelDelta: 2 },                           // 5 -> 15
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
 * Echo cards, cards at max level, already-changed-this-encounter, and unknown mechanics cannot upgrade.
 */
export function canMasteryUpgrade(card: Card): boolean {
  if (card.isEcho) return false;
  const def = MASTERY_UPGRADE_DEFS[card.mechanicId ?? ''];
  const maxLevel = def?.maxLevel ?? MASTERY_MAX_LEVEL;
  if ((card.masteryLevel ?? 0) >= maxLevel) return false;
  if (card.masteryChangedThisEncounter) return false;
  if (!card.mechanicId) return false;
  return card.mechanicId in MASTERY_UPGRADE_DEFS;
}

/**
 * Whether a card can be mastery-downgraded.
 * Echo cards, cards at level 0, and already-changed-this-encounter cards cannot downgrade.
 */
export function canMasteryDowngrade(card: Card): boolean {
  if (card.isEcho) return false;
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
  if (card.isEcho) return false;
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
