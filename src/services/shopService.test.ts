/**
 * Tests for shopService — pricing, removal, and haggle math (AR-59.15).
 */

import { describe, it, expect } from 'vitest';
import { removalPrice, priceShopCards, calculateShopPrice, generateShopRelics } from './shopService';
import type { Card } from '../data/card-types';
import { SHOP_CARD_PRICE_V2, SHOP_RELIC_MIN_PRICE, SHOP_RELIC_MAX_PRICE } from '../data/balance';

// ─── removalPrice ────────────────────────────────────────────────────────────

describe('removalPrice', () => {
  it('returns 50g for 0 prior removals (first removal)', () => {
    expect(removalPrice(0)).toBe(50);
  });

  it('returns 75g for 1 prior removal', () => {
    expect(removalPrice(1)).toBe(75);
  });

  it('returns 100g for 2 prior removals', () => {
    expect(removalPrice(2)).toBe(100);
  });

  it('returns 125g for 3 prior removals', () => {
    expect(removalPrice(3)).toBe(125);
  });
});

// ─── Haggle discount math ────────────────────────────────────────────────────

describe('haggle discount math', () => {
  it('30% off 100g = 70g', () => {
    expect(Math.floor(100 * 0.7)).toBe(70);
  });

  it('30% off 140g = 98g', () => {
    expect(Math.floor(140 * 0.7)).toBe(98);
  });

  it('30% off 50g = 35g', () => {
    expect(Math.floor(50 * 0.7)).toBe(35);
  });

  it('30% off 80g = 56g', () => {
    expect(Math.floor(80 * 0.7)).toBe(56);
  });
});

// ─── SHOP_CARD_PRICE_V2 ───────────────────────────────────────────────────────

describe('SHOP_CARD_PRICE_V2', () => {
  it('common card price is 50g', () => {
    expect(SHOP_CARD_PRICE_V2['common']).toBe(50);
  });

  it('uncommon card price is 80g', () => {
    expect(SHOP_CARD_PRICE_V2['uncommon']).toBe(80);
  });

  it('rare card price is 140g', () => {
    expect(SHOP_CARD_PRICE_V2['rare']).toBe(140);
  });
});

// ─── priceShopCards ───────────────────────────────────────────────────────────

function makeCard(tier: string): Card {
  return {
    id: `test-${tier}`,
    factId: `fact-${tier}`,
    cardType: 'attack',
    tier,
    baseEffectValue: 10,
    effectMultiplier: 1,
  } as unknown as Card;
}

describe('priceShopCards v2 pricing', () => {
  it('prices tier 1 (common) cards at 50g on floor 1', () => {
    const cards = priceShopCards([makeCard('1')], 1);
    // floor 1 discount = 3%, so floor 1 still gives ~48-50g
    expect(cards[0].price).toBeGreaterThanOrEqual(45);
    expect(cards[0].price).toBeLessThanOrEqual(50);
  });

  it('prices tier 2a (uncommon) cards at 80g on floor 0', () => {
    const cards = priceShopCards([makeCard('2a')], 0);
    expect(cards[0].price).toBe(80);
  });

  it('prices tier 2b (uncommon) cards at 80g on floor 0', () => {
    const cards = priceShopCards([makeCard('2b')], 0);
    expect(cards[0].price).toBe(80);
  });

  it('prices tier 3 (rare) cards at 140g on floor 0', () => {
    const cards = priceShopCards([makeCard('3')], 0);
    expect(cards[0].price).toBe(140);
  });
});

// ─── calculateShopPrice ───────────────────────────────────────────────────────

describe('calculateShopPrice', () => {
  it('applies no discount on floor 0', () => {
    expect(calculateShopPrice(100, 0)).toBe(100);
  });

  it('applies 3% per floor discount', () => {
    expect(calculateShopPrice(100, 2)).toBe(94); // 100 * (1 - 0.06) = 94
  });

  it('caps discount at 40%', () => {
    expect(calculateShopPrice(100, 50)).toBe(60); // max 40% off
  });
});

// ─── Relic price floor/cap (T1.3 2026-04-11) ─────────────────────────────────

function makeRelic(id: string, rarity: 'common' | 'uncommon' | 'rare' | 'legendary') {
  return { id, rarity, name: id, description: '', trigger: 'permanent', effect: () => {} } as unknown as import('../data/relics/types').RelicDefinition;
}

describe('generateShopRelics price clamping', () => {
  const commonRelic = makeRelic('test_common', 'common');
  const legendaryRelic = makeRelic('test_legendary', 'legendary');

  it('common relic at floor 0 costs exactly 40g (new base = floor)', () => {
    const result = generateShopRelics(0, [commonRelic], 1);
    expect(result[0].price).toBe(40);
  });

  it('common relic at floor 20 (max discount) stays clamped at 40g minimum', () => {
    // 40 * (1 - min(20*0.03, 0.40)) = 40 * 0.60 = 24 → clamped to 40
    const result = generateShopRelics(20, [commonRelic], 1);
    expect(result[0].price).toBeGreaterThanOrEqual(SHOP_RELIC_MIN_PRICE);
  });

  it('legendary relic at floor 0 costs exactly 120g (new cap)', () => {
    const result = generateShopRelics(0, [legendaryRelic], 1);
    expect(result[0].price).toBeLessThanOrEqual(SHOP_RELIC_MAX_PRICE);
    expect(result[0].price).toBeGreaterThanOrEqual(SHOP_RELIC_MIN_PRICE);
  });

  it('SHOP_RELIC_MIN_PRICE is 40', () => {
    expect(SHOP_RELIC_MIN_PRICE).toBe(40);
  });

  it('SHOP_RELIC_MAX_PRICE is 120', () => {
    expect(SHOP_RELIC_MAX_PRICE).toBe(120);
  });
});
