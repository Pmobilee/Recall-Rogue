import type { Card } from '../data/card-types';
import type { CardType } from '../data/card-types';
import type { RewardArchetype } from './runManager';
import { shuffled } from './randomUtils';

const ALL_REWARD_TYPES: CardType[] = ['attack', 'shield', 'buff', 'debuff', 'utility', 'wild'];

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

  let cursor = Math.random() * total;
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

  return shuffled(eligible).slice(0, count);
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
 */
export function generateCardRewardOptionsByType(
  runPool: Card[],
  activeDeckFactIds: Set<string>,
  consumedRewardFactIds: Set<string>,
  archetype: RewardArchetype,
): Card[] {
  const eligible = filterEligible(runPool, activeDeckFactIds, consumedRewardFactIds);
  const typeOptions = generateRewardTypeOptions(runPool, activeDeckFactIds, consumedRewardFactIds, archetype, 3);
  const selected: Card[] = [];
  const usedFactIds = new Set<string>();

  for (const type of typeOptions) {
    const bucket = eligible.filter((card) => card.cardType === type && !usedFactIds.has(card.factId));
    if (bucket.length === 0) continue;
    const card = bucket[Math.floor(Math.random() * bucket.length)];
    selected.push(card);
    usedFactIds.add(card.factId);
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

  const next = bucket[Math.floor(Math.random() * bucket.length)];
  return currentOptions.map((option) => option.id === current.id ? next : option);
}
