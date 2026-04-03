/**
 * Mental Math procedural deck definition.
 *
 * Covers percentages, fractions & decimals, estimation (square roots),
 * and order-of-operations (PEMDAS). Each sub-deck contains one SkillNode
 * whose difficulty scales across the four FSRS card tiers (1, 2a, 2b, 3).
 *
 * Source files: src/data/mathDecks/mentalMath.ts
 * Related docs: docs/content/deck-system.md
 */

import type { ProceduralDeck } from '../proceduralDeckTypes';

export const MENTAL_MATH_DECK: ProceduralDeck = {
  id: 'mental_math',
  name: 'Mental Math',
  domain: 'mathematics',
  description: 'Sharpen mental calculation skills: percentages, fractions, estimation, and order of operations.',
  skills: [
    {
      id: 'mental_pct',
      name: 'Percentages',
      description: 'Calculate what percentage of a base number equals — answers are whole numbers.',
      generatorId: 'percentage',
      tierParams: {
        // rangeA = percentage value range, rangeB = base number range
        '1':  { rangeA: [10, 50],  rangeB: [20, 100]  },
        '2a': { rangeA: [5, 75],   rangeB: [20, 200]  },
        '2b': { rangeA: [1, 99],   rangeB: [50, 500]  },
        '3':  { rangeA: [1, 99],   rangeB: [100, 1000] },
      },
    },
    {
      id: 'mental_frac',
      name: 'Fractions & Decimals',
      description: 'Convert between fractions and decimals in simplest form.',
      generatorId: 'fraction_decimal',
      tierParams: {
        // rangeA = numerator range, rangeB = denominator range
        '1':  { rangeA: [1, 4],   rangeB: [2, 4]   },
        '2a': { rangeA: [1, 8],   rangeB: [2, 8]   },
        '2b': { rangeA: [1, 12],  rangeB: [2, 12]  },
        '3':  { rangeA: [1, 20],  rangeB: [2, 20]  },
      },
    },
    {
      id: 'mental_est',
      name: 'Estimation',
      description: 'Estimate square roots to the nearest whole number.',
      generatorId: 'estimation',
      tierParams: {
        // rangeA = input number range; tolerance controls acceptableAlternatives window
        '1':  { rangeA: [4, 25],     rangeB: [0, 0], tolerance: 1 },
        '2a': { rangeA: [25, 100],   rangeB: [0, 0], tolerance: 1 },
        '2b': { rangeA: [100, 500],  rangeB: [0, 0], tolerance: 1 },
        '3':  { rangeA: [500, 2000], rangeB: [0, 0], tolerance: 0 },
      },
    },
    {
      id: 'mental_pemdas',
      name: 'Order of Operations',
      description: 'Solve expressions requiring correct PEMDAS / BODMAS precedence.',
      generatorId: 'order_of_operations',
      tierParams: {
        '1':  { rangeA: [1, 5],   rangeB: [1, 5]   },
        '2a': { rangeA: [1, 10],  rangeB: [1, 10]  },
        '2b': { rangeA: [2, 15],  rangeB: [2, 15]  },
        '3':  { rangeA: [5, 25],  rangeB: [5, 25]  },
      },
    },
  ],
  subDecks: [
    { id: 'percentages',         name: 'Percentages',          skillIds: ['mental_pct'] },
    { id: 'fractions_decimals',  name: 'Fractions & Decimals', skillIds: ['mental_frac'] },
    { id: 'estimation',          name: 'Estimation',           skillIds: ['mental_est'] },
    { id: 'order_of_operations', name: 'Order of Operations',  skillIds: ['mental_pemdas'] },
  ],
};
