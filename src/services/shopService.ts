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
  SHOP_CARD_PRICE,
  SHOP_FLOOR_DISCOUNT_PER_FLOOR,
  SHOP_MAX_DISCOUNT,
  SHOP_FOOD_ITEMS,
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
 * @returns Array of purchasable relic items.
 */
export function generateShopRelics(
  floor: number,
  eligibleRelics: RelicDefinition[],
): ShopRelicItem[] {
  const relics: ShopRelicItem[] = [];
  const remainingRelics = [...eligibleRelics];
  for (let i = 0; i < SHOP_RELIC_COUNT && remainingRelics.length > 0; i++) {
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
 * Prices shop cards based on their tier and floor.
 *
 * @param cards - Card options to price.
 * @param floor - Current floor number (affects pricing).
 * @returns Array of purchasable card items with prices.
 */
export function priceShopCards(cards: Card[], floor: number): ShopCardItem[] {
  return cards.map(card => {
    const basePrice = SHOP_CARD_PRICE[card.tier] ?? 15;
    return {
      card,
      price: calculateShopPrice(basePrice, floor),
    };
  });
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
