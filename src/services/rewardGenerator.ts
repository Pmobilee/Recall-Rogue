import type { Card } from '../data/card-types';
import type { CardType } from '../data/card-types';
import { NUM_CHAIN_TYPES } from '../data/chainTypes';
import type { RewardArchetype } from './runManager';
import { UPGRADED_REWARD_CHANCE_BY_FLOOR } from '../data/balance';
import { shuffled } from './randomUtils';
import { getRunRng, isRunRngActive, seededShuffled } from './seededRng';
import { canUpgradeCard, upgradeCard } from './cardUpgradeService';

const ALL_REWARD_TYPES: CardType[] = ['attack', 'shield', 'buff', 'debuff', 'utility', 'wild'];

function getUpgradedRewardChance(floor: number): number {
  for (const t of UPGRADED_REWARD_CHANCE_BY_FLOOR) {
    if (floor >= t.minFloor && floor <= t.maxFloor) return t.chance;
  }
  return 0;
}

const ARCHETYPE_WEIGHTS: Record<RewardArchetype, Partial<Record<CardType, number>>> = {
  balanced: { attack: 1.2, shield: 1.1, buff: 0.9, debuff: 0.9, utility: 0.9, wild: 0.6 },
  aggressive: { attack: 2.4, buff: 1.6, shield: 0.6, debuff: 0.4, utility: 0.4, wild: 0.8 },
  defensive: { shield: 2.2, utility: 1, debuff: 0.9, attack: 0.6, buff: 0.5, wild: 0.6 },
  control: { debuff: 2.2, utility: 1.9, shield: 0.9, buff: 0.7, attack: 0.5, wild: 0.8 },
  hybrid: { attack: 1.4, shield: 1.4, buff: 1.1, debuff: 1.1, utility: 1.1, wild: 0.9 },
};

function filterEligible(
  runPool: Card[],
  activeDeckFactIds: Set<string>,
  consumedRewardFactIds: Set<string>,
): Card[] {
  return runPool.filter((card) =>
    !activeDeckFactIds.has(card.factId) &&
    !consumedRewardFactIds.has(card.factId) &&
    card.tier !== '3' &&
    !card.isEcho
  );
}

function pickWeightedType(availableTypes: CardType[], archetype: RewardArchetype): CardType | null {
  const weights = ARCHETYPE_WEIGHTS[archetype];
  let total = 0;
  const buckets = availableTypes.map((type) => {
    const weight = Math.max(0.01, weights[type] ?? 1);
    total += weight;
    return { type, weight };
  });

  if (buckets.length === 0 || total <= 0) return null;

  const rng = isRunRngActive() ? getRunRng('rewards') : null;
  let cursor = (rng ? rng.next() : Math.random()) * total;
  for (const bucket of buckets) {
    cursor -= bucket.weight;
    if (cursor <= 0) return bucket.type;
  }
  return buckets[buckets.length - 1]?.type ?? null;
}

/**
 * Generate card reward options from the run pool.
 * Excludes cards already in the active deck, Tier 3 facts, and Echo cards.
 */
export function generateCardRewardOptions(
  runPool: Card[],
  activeDeckFactIds: Set<string>,
  consumedRewardFactIds: Set<string>,
  count: number = 3,
): Card[] {
  const eligible = filterEligible(runPool, activeDeckFactIds, consumedRewardFactIds);

  const rng = isRunRngActive() ? getRunRng('rewards') : null;
  return (rng ? seededShuffled(rng, eligible) : shuffled(eligible)).slice(0, count);
}

/**
 * Build three unique reward TYPE options, weighted by archetype.
 */
export function generateRewardTypeOptions(
  runPool: Card[],
  activeDeckFactIds: Set<string>,
  consumedRewardFactIds: Set<string>,
  archetype: RewardArchetype,
  count: number = 3,
): CardType[] {
  const eligible = filterEligible(runPool, activeDeckFactIds, consumedRewardFactIds);
  const typesInPool = new Set<CardType>(eligible.map((card) => card.cardType));
  const availableTypes = ALL_REWARD_TYPES.filter((type) => typesInPool.has(type));
  const picked: CardType[] = [];

  while (picked.length < count && availableTypes.length > 0) {
    const choice = pickWeightedType(availableTypes, archetype);
    if (!choice) break;
    picked.push(choice);
    const idx = availableTypes.indexOf(choice);
    if (idx >= 0) availableTypes.splice(idx, 1);
  }

  return picked;
}

/**
 * Generate one preview reward card per selected type.
 * Optionally applies floor-based upgrade probability to pre-upgrade cards.
 */
export function generateCardRewardOptionsByType(
  runPool: Card[],
  activeDeckFactIds: Set<string>,
  consumedRewardFactIds: Set<string>,
  archetype: RewardArchetype,
  currentFloor: number = 1,
): Card[] {
  const eligible = filterEligible(runPool, activeDeckFactIds, consumedRewardFactIds);
  const typeOptions = generateRewardTypeOptions(runPool, activeDeckFactIds, consumedRewardFactIds, archetype, 3);
  const selected: Card[] = [];
  const usedFactIds = new Set<string>();
  const usedMechanicIds = new Set<string>();

  for (const type of typeOptions) {
    const bucket = eligible.filter((card) =>
      card.cardType === type &&
      !usedFactIds.has(card.factId) &&
      !usedMechanicIds.has(card.mechanicId ?? '')
    );
    if (bucket.length === 0) continue;
    const rng = isRunRngActive() ? getRunRng('rewards') : null;
    const card = bucket[Math.floor((rng ? rng.next() : Math.random()) * bucket.length)];
    selected.push(card);
    usedFactIds.add(card.factId);
    if (card.mechanicId) usedMechanicIds.add(card.mechanicId);
  }

  // Apply floor-based upgrade chance
  const upgradeChance = getUpgradedRewardChance(currentFloor);
  if (upgradeChance > 0) {
    const rng = isRunRngActive() ? getRunRng('rewards') : null;
    for (let i = 0; i < selected.length; i++) {
      const roll = rng ? rng.next() : Math.random();
      if (roll < upgradeChance && canUpgradeCard(selected[i])) {
        selected[i] = upgradeCard({ ...selected[i] });
      }
    }
  }

  // === Chain Type Diversity (AR-70) ===
  // Ensure at least 2 distinct chain types across reward options.
  if (selected.length >= 3) {
    const chainTypes = new Set(selected.map(c => c.chainType).filter(t => t !== undefined));
    if (chainTypes.size <= 1 && selected[0]?.chainType !== undefined) {
      // All same chainType — try to swap one card's fact for a different chainType
      const targetType = selected[0].chainType;
      const altCard = eligible.find(c =>
        c.chainType !== undefined &&
        c.chainType !== targetType &&
        !usedFactIds.has(c.factId)
      );
      if (altCard) {
        selected[selected.length - 1] = altCard;
      }
    }
  }

  return selected;
}

/**
 * Reroll the preview fact for a chosen type while preserving type choice.
 */
export function rerollRewardCardInType(
  runPool: Card[],
  activeDeckFactIds: Set<string>,
  consumedRewardFactIds: Set<string>,
  currentOptions: Card[],
  type: CardType,
): Card[] {
  const eligible = filterEligible(runPool, activeDeckFactIds, consumedRewardFactIds);
  const current = currentOptions.find((option) => option.cardType === type);
  if (!current) return currentOptions;

  const usedFactIds = new Set(currentOptions.map((option) => option.factId));
  usedFactIds.delete(current.factId);

  const bucket = eligible.filter((card) =>
    card.cardType === type &&
    card.factId !== current.factId &&
    !usedFactIds.has(card.factId)
  );
  if (bucket.length === 0) return currentOptions;

  const rng = isRunRngActive() ? getRunRng('rewards') : null;
  const next = bucket[Math.floor((rng ? rng.next() : Math.random()) * bucket.length)];
  return currentOptions.map((option) => option.id === current.id ? next : option);
}
