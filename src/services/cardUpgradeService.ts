/**
 * Card upgrade service — handles STS-style "+" upgrades at rest sites.
 * Upgrades boost existing mechanic values without changing mechanic identity.
 * Pure logic — no Phaser/Svelte/DOM imports.
 */

import type { Card } from '../data/card-types';
import { getMechanicDefinition } from '../data/mechanics';
import { getCardTier } from './tierDerivation';

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

/** Upgrade definitions for each Phase 1 and Phase 2 mechanic. */
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
 * Returns true if the card can be upgraded.
 * Cards that are already upgraded, echo cards, or cards without a known mechanic cannot be upgraded.
 */
export function canUpgradeCard(card: Card): boolean {
  if (card.isUpgraded) return false;
  if (card.isEcho) return false;
  if (!card.mechanicId) return false;
  return card.mechanicId in UPGRADE_DEFS;
}

/**
 * Applies the upgrade to a card in-place.
 * Boosts baseEffectValue and optionally secondaryValue, appends "+" to mechanicName, sets isUpgraded.
 * Returns the same card reference for convenience.
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
 * Returns a preview of what the upgrade would look like without applying it.
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
 * Higher tier cards appear first because the player knows them better,
 * making upgrades more impactful (correct answers trigger full effect more often).
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
