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
}

/** Upgrade definitions for each Phase 1 mechanic. */
export const UPGRADE_DEFS: Record<string, MechanicUpgrade> = {
  strike:    { baseValueDelta: 3 },                           // 8 → 11 dmg
  multi_hit: { baseValueDelta: 0, secondaryValueDelta: 1 },   // 3 hits → 4 hits
  block:     { baseValueDelta: 2 },                           // 6 → 8 block
  thorns:    { baseValueDelta: 1, secondaryValueDelta: 1 },   // 4+2 → 5+3
  restore:   { baseValueDelta: 3 },                           // 8 → 11 heal
  cleanse:   { baseValueDelta: 2 },                           // 6 → 8 heal
  empower:   { baseValueDelta: 10 },                          // 30% → 40%
  quicken:   { baseValueDelta: 0, addTag: 'draw' },           // +1 AP → +1 AP + draw 1
  weaken:    { baseValueDelta: 1 },                           // 2 → 3 turns
  expose:    { baseValueDelta: 1 },                           // 1 → 2 turns
  scout:     { baseValueDelta: 1 },                           // draw 1 → draw 2
  recycle:   { baseValueDelta: 1 },                           // cycle 1 → cycle 1 + draw 1
  sustained: { baseValueDelta: 1 },                           // 3 → 4 regen
  emergency: { baseValueDelta: 2 },                           // 4 → 6 burst
  mirror:    { baseValueDelta: 0.25 },                        // 1.0 → 1.25 multiplier
  adapt:     { baseValueDelta: 0.25 },                        // 1.0 → 1.25 multiplier
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
}

/**
 * Returns a preview of what the upgrade would look like without applying it.
 */
export function getUpgradePreview(card: Card): UpgradePreview | null {
  const upgrade = UPGRADE_DEFS[card.mechanicId ?? ''];
  if (!upgrade) return null;

  return {
    upgradedName: (card.mechanicName ?? '') + '+',
    currentBaseValue: card.baseEffectValue,
    newBaseValue: card.baseEffectValue + upgrade.baseValueDelta,
    secondaryDelta: upgrade.secondaryValueDelta,
    addTag: upgrade.addTag,
  };
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
    // Within same tier, prefer higher effectMultiplier (harder facts = stronger cards)
    return (b.effectMultiplier ?? 1) - (a.effectMultiplier ?? 1);
  });

  return eligible.slice(0, count);
}
