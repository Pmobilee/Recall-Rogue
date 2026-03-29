/**
 * Shop inventory generation service.
 * Generates buy/sell options for shop room visits.
 * Pure logic — no Phaser/Svelte/DOM imports.
 */

import type { Card } from '../data/card-types';
import type { RelicDefinition, RelicRarity } from '../data/relics/types';
import { shuffled } from './randomUtils';
import {
  SHOP_RELIC_COUNT,
  SHOP_CARD_COUNT,
  SHOP_RELIC_PRICE,
  SHOP_CARD_PRICE_V2,
  SHOP_FLOOR_DISCOUNT_PER_FLOOR,
  SHOP_MAX_DISCOUNT,
  SHOP_FOOD_ITEMS,
  SHOP_REMOVAL_BASE_PRICE,
  SHOP_REMOVAL_PRICE_INCREMENT,
  SHOP_SALE_DISCOUNT,
  SHOP_TRANSFORM_BASE_PRICE,
  SHOP_TRANSFORM_PRICE_INCREMENT,
} from '../data/balance';

/** A purchasable relic in the shop. */
export interface ShopRelicItem {
  relic: RelicDefinition;
  price: number;
}

/** A purchasable card in the shop. */
export interface ShopCardItem {
  card: Card;
  price: number;
}

/** A purchasable food item in the shop. */
export interface ShopFoodItem {
  type: 'ration' | 'feast' | 'elixir';
  healPct: number;
  price: number;
}

/** Complete shop inventory for one visit. */
export interface ShopInventory {
  relics: ShopRelicItem[];
  cards: ShopCardItem[];
  /** Price for card removal service this visit (escalates per removal in run). */
  removalCost?: number;
  /** Index into `cards` of the sale card this visit (50% off). Undefined if no cards. */
  saleCardIndex?: number;
  /** Price for card transformation service this visit (escalates per transform in run). */
  transformCost?: number;
}

/** Rarity weights for shop relic selection. */
const RELIC_RARITY_WEIGHTS: Record<RelicRarity, number> = {
  common: 0.40,
  uncommon: 0.35,
  rare: 0.20,
  legendary: 0.05,
};

/**
 * Calculates the discounted price for a shop item.
 * Discount = floor * SHOP_FLOOR_DISCOUNT_PER_FLOOR, capped at SHOP_MAX_DISCOUNT.
 */
export function calculateShopPrice(basePrice: number, floor: number): number {
  const discount = Math.min(floor * SHOP_FLOOR_DISCOUNT_PER_FLOOR, SHOP_MAX_DISCOUNT);
  return Math.max(1, Math.round(basePrice * (1 - discount)));
}

/**
 * Selects a relic from the pool using weighted rarity selection.
 */
function selectRelicByRarity(pool: RelicDefinition[]): RelicDefinition | null {
  if (pool.length === 0) return null;

  // Group by rarity
  const byRarity: Record<string, RelicDefinition[]> = {};
  for (const relic of pool) {
    if (!byRarity[relic.rarity]) byRarity[relic.rarity] = [];
    byRarity[relic.rarity].push(relic);
  }

  // Weighted random rarity selection
  const rand = Math.random();
  let cumulative = 0;
  for (const [rarity, weight] of Object.entries(RELIC_RARITY_WEIGHTS)) {
    cumulative += weight;
    if (rand < cumulative && byRarity[rarity]?.length) {
      const candidates = byRarity[rarity];
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
  }

  // Fallback: pick any random relic from pool
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Generates shop relics from the eligible pool.
 *
 * @param floor - Current floor number (affects pricing).
 * @param eligibleRelics - Relics available for purchase (not already held).
 * @param count - Number of relics to offer (default: SHOP_RELIC_COUNT). merchants_favor adds +1.
 * @returns Array of purchasable relic items.
 */
export function generateShopRelics(
  floor: number,
  eligibleRelics: RelicDefinition[],
  count: number = SHOP_RELIC_COUNT,
): ShopRelicItem[] {
  const relics: ShopRelicItem[] = [];
  const remainingRelics = [...eligibleRelics];
  for (let i = 0; i < count && remainingRelics.length > 0; i++) {
    const selected = selectRelicByRarity(remainingRelics);
    if (!selected) break;
    const idx = remainingRelics.findIndex(r => r.id === selected.id);
    if (idx !== -1) remainingRelics.splice(idx, 1);
    const basePrice = SHOP_RELIC_PRICE[selected.rarity] ?? 100;
    relics.push({
      relic: selected,
      price: calculateShopPrice(basePrice, floor),
    });
  }
  return relics;
}

/**
 * Maps a card tier to its pricing rarity category.
 * - Tier '1' → 'common'
 * - Tier '2a' | '2b' → 'uncommon'
 * - Tier '3' → 'rare'
 */
function cardTierToRarity(tier: string): string {
  if (tier === '1') return 'common';
  if (tier === '2a' || tier === '2b') return 'uncommon';
  return 'rare'; // tier '3'
}

/**
 * Prices shop cards based on their tier (mapped to rarity) and floor.
 * Uses v2 rarity-based pricing (AR-59.15): Common 50g, Uncommon 80g, Rare 140g.
 *
 * Note: mechanic unlock filtering is applied upstream in buildRunPool() / buildPresetRunPool().
 * Shop cards are drawn from the run pool via generateCardRewardOptionsByType(), so they already
 * contain only level-appropriate mechanics. No independent filter is needed here.
 *
 * @param cards - Card options to price.
 * @param floor - Current floor number (affects pricing).
 * @returns Array of purchasable card items with prices.
 */
export function priceShopCards(cards: Card[], floor: number): ShopCardItem[] {
  return cards.map(card => {
    const rarity = cardTierToRarity(card.tier);
    const basePrice = SHOP_CARD_PRICE_V2[rarity] ?? 50;
    return {
      card,
      price: calculateShopPrice(basePrice, floor),
    };
  });
}

/**
 * Returns the sale price for a card: 50% off, rounded down.
 *
 * Applied after any floor discount. The haggle system can stack on top multiplicatively.
 *
 * @param originalPrice - The already floor-discounted price.
 * @returns The halved price (floor division).
 */
export function getSalePrice(originalPrice: number): number {
  return Math.floor(originalPrice * SHOP_SALE_DISCOUNT);
}

/**
 * Applies a 50% sale discount to the card at `saleIndex` in-place.
 * Returns the mutated array for convenience.
 *
 * @param cards - Array of priced shop cards.
 * @param saleIndex - Index of the card receiving the discount.
 * @returns The same array with the sale card's price halved.
 */
export function applySaleDiscount(cards: ShopCardItem[], saleIndex: number): ShopCardItem[] {
  if (saleIndex >= 0 && saleIndex < cards.length) {
    cards[saleIndex].price = getSalePrice(cards[saleIndex].price);
  }
  return cards;
}

/**
 * Calculates the card removal service price for a given removal count.
 * Base price is 50g; each subsequent removal in the same run costs +25g more.
 *
 * @param cardsRemovedCount - Number of cards already removed this run.
 * @returns Gold cost for the next removal.
 */
export function removalPrice(cardsRemovedCount: number): number {
  return SHOP_REMOVAL_BASE_PRICE + cardsRemovedCount * SHOP_REMOVAL_PRICE_INCREMENT;
}

/**
 * Calculates the card transformation service price for a given transform count.
 * Base price is 35g; each subsequent use in the same run costs +25g more.
 *
 * @param transformsUsed - Number of cards already transformed this run.
 * @returns Gold cost for the next transformation.
 */
export function transformPrice(transformsUsed: number): number {
  return SHOP_TRANSFORM_BASE_PRICE + transformsUsed * SHOP_TRANSFORM_PRICE_INCREMENT;
}

/**
 * Generates food items available for purchase at the shop.
 * Always offers 1 ration + 1 feast. On floor 10+, 30% chance to replace feast with elixir.
 *
 * @param floor - Current floor number (affects pricing).
 * @returns Array of purchasable food items.
 */
export function generateShopFood(floor: number): ShopFoodItem[] {
  const items: ShopFoodItem[] = [];

  // Always offer a ration (cheap heal)
  items.push({
    type: 'ration',
    healPct: SHOP_FOOD_ITEMS.ration.healPct,
    price: calculateShopPrice(SHOP_FOOD_ITEMS.ration.basePrice, floor),
  });

  // Second item: feast by default, elixir on floor 10+ (30% chance)
  if (floor >= 10 && Math.random() < 0.30) {
    items.push({
      type: 'elixir',
      healPct: SHOP_FOOD_ITEMS.elixir.healPct,
      price: calculateShopPrice(SHOP_FOOD_ITEMS.elixir.basePrice, floor),
    });
  } else {
    items.push({
      type: 'feast',
      healPct: SHOP_FOOD_ITEMS.feast.healPct,
      price: calculateShopPrice(SHOP_FOOD_ITEMS.feast.basePrice, floor),
    });
  }

  return items;
}
