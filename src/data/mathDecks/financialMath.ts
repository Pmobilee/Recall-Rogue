/**
 * Financial Math procedural deck definition.
 *
 * Covers simple interest, compound interest, straight-line depreciation,
 * markup/discount, and sales tax calculations. Each skill uses a generator
 * from `src/services/math/financialMathGenerators.ts` and scales difficulty
 * across the four FSRS card tiers (1, 2a, 2b, 3).
 *
 * Source files: src/data/mathDecks/financialMath.ts
 * Related docs: docs/mechanics/procedural-math.md
 */

import type { ProceduralDeck } from '../proceduralDeckTypes';

export const FINANCIAL_MATH_DECK: ProceduralDeck = {
  id: 'financial_math',
  name: 'Financial Math',
  domain: 'mathematics',
  description: 'Interest, depreciation, markup, discount, and tax calculations.',
  skills: [
    {
      id: 'fin_simple_interest',
      name: 'Simple Interest',
      description: 'Calculate interest earned using I = P × r × t.',
      generatorId: 'simple_interest',
      tierParams: {
        '1':  { rangeA: [100, 500],   rangeB: [1, 2] },
        '2a': { rangeA: [100, 1000],  rangeB: [1, 3] },
        '2b': { rangeA: [200, 2000],  rangeB: [1, 5] },
        '3':  { rangeA: [500, 5000],  rangeB: [2, 10] },
      },
    },
    {
      id: 'fin_compound_interest',
      name: 'Compound Interest',
      description: 'Calculate final amounts using A = P(1 + r/n)^(nt).',
      generatorId: 'compound_interest',
      tierParams: {
        '1':  { rangeA: [100, 1000],  rangeB: [1, 2] },
        '2a': { rangeA: [100, 1000],  rangeB: [1, 3] },
        '2b': { rangeA: [200, 2000],  rangeB: [1, 4] },
        '3':  { rangeA: [200, 5000],  rangeB: [2, 5] },
      },
    },
    {
      id: 'fin_depreciation',
      name: 'Depreciation',
      description: 'Find asset value using straight-line depreciation: V = P - P × rate × t.',
      generatorId: 'depreciation',
      tierParams: {
        '1':  { rangeA: [100, 1000],  rangeB: [1, 2] },
        '2a': { rangeA: [200, 2000],  rangeB: [1, 3] },
        '2b': { rangeA: [500, 5000],  rangeB: [1, 4] },
        '3':  { rangeA: [500, 10000], rangeB: [1, 5] },
      },
    },
    {
      id: 'fin_markup_discount',
      name: 'Markup & Discount',
      description: 'Calculate final prices after markup or discount percentages.',
      generatorId: 'markup_discount',
      tierParams: {
        '1':  { rangeA: [10, 100],  rangeB: [1, 1] },
        '2a': { rangeA: [10, 200],  rangeB: [1, 2] },
        '2b': { rangeA: [20, 500],  rangeB: [3, 4] },
        '3':  { rangeA: [50, 1000], rangeB: [4, 5] },
      },
    },
    {
      id: 'fin_tax_calculation',
      name: 'Sales Tax',
      description: 'Calculate sales tax totals, tax amounts, and pre-tax prices.',
      generatorId: 'tax_calculation',
      tierParams: {
        '1':  { rangeA: [10, 100],  rangeB: [1, 1] },
        '2a': { rangeA: [10, 200],  rangeB: [1, 2] },
        '2b': { rangeA: [20, 500],  rangeB: [1, 3] },
        '3':  { rangeA: [50, 1000], rangeB: [1, 4] },
      },
    },
  ],
  subDecks: [
    { id: 'simple_interest',   name: 'Simple Interest',   skillIds: ['fin_simple_interest'] },
    { id: 'compound_interest', name: 'Compound Interest', skillIds: ['fin_compound_interest'] },
    { id: 'depreciation',      name: 'Depreciation',      skillIds: ['fin_depreciation'] },
    { id: 'markup_discount',   name: 'Markup & Discount', skillIds: ['fin_markup_discount'] },
    { id: 'tax_calculation',   name: 'Sales Tax',         skillIds: ['fin_tax_calculation'] },
  ],
};
