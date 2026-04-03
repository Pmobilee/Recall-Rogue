/**
 * Arithmetic procedural deck definition.
 *
 * Covers addition, subtraction, multiplication, division, and mixed operations.
 * Each sub-deck contains one SkillNode whose difficulty scales across the four
 * FSRS card tiers (1, 2a, 2b, 3).
 *
 * Source files: src/data/mathDecks/arithmetic.ts
 * Related docs: docs/content/deck-system.md
 */

import type { ProceduralDeck } from '../proceduralDeckTypes';

export const ARITHMETIC_DECK: ProceduralDeck = {
  id: 'arithmetic',
  name: 'Arithmetic',
  domain: 'mathematics',
  description: 'Master addition, subtraction, multiplication, and division with adaptive difficulty.',
  skills: [
    {
      id: 'arith_add',
      name: 'Addition',
      description: 'Practice adding two numbers, from single-digit up to four-digit values.',
      generatorId: 'arithmetic',
      tierParams: {
        '1':  { rangeA: [1, 20],    rangeB: [1, 20],    operations: ['+'] },
        '2a': { rangeA: [10, 99],   rangeB: [10, 99],   operations: ['+'] },
        '2b': { rangeA: [100, 999], rangeB: [100, 999], operations: ['+'] },
        '3':  { rangeA: [1000, 9999], rangeB: [1000, 9999], operations: ['+'] },
      },
    },
    {
      id: 'arith_sub',
      name: 'Subtraction',
      description: 'Practice subtracting two numbers — answers are always non-negative.',
      generatorId: 'arithmetic',
      tierParams: {
        '1':  { rangeA: [1, 20],    rangeB: [1, 20],    operations: ['-'], allowNegatives: false },
        '2a': { rangeA: [10, 99],   rangeB: [10, 99],   operations: ['-'], allowNegatives: false },
        '2b': { rangeA: [100, 999], rangeB: [100, 999], operations: ['-'], allowNegatives: false },
        '3':  { rangeA: [1000, 9999], rangeB: [1000, 9999], operations: ['-'], allowNegatives: false },
      },
    },
    {
      id: 'arith_mul',
      name: 'Multiplication',
      description: 'Practice multiplying numbers from times-tables up to large products.',
      generatorId: 'arithmetic',
      tierParams: {
        '1':  { rangeA: [2, 9],   rangeB: [2, 9],    operations: ['*'] },
        '2a': { rangeA: [2, 12],  rangeB: [10, 99],  operations: ['*'] },
        '2b': { rangeA: [10, 99], rangeB: [10, 99],  operations: ['*'] },
        '3':  { rangeA: [10, 99], rangeB: [100, 999], operations: ['*'] },
      },
    },
    {
      id: 'arith_div',
      name: 'Division',
      description: 'Practice exact-integer division — problems always divide evenly.',
      generatorId: 'arithmetic',
      tierParams: {
        // rangeA = quotient range, rangeB = divisor range (generator handles a = quotient × divisor)
        '1':  { rangeA: [1, 10],   rangeB: [2, 9],   operations: ['/'] },
        '2a': { rangeA: [2, 20],   rangeB: [2, 12],  operations: ['/'] },
        '2b': { rangeA: [5, 50],   rangeB: [2, 25],  operations: ['/'] },
        '3':  { rangeA: [10, 100], rangeB: [2, 50],  operations: ['/'] },
      },
    },
    {
      id: 'arith_mixed',
      name: 'Mixed Operations',
      description: 'Multi-step expressions combining two or three operations, evaluated left-to-right.',
      generatorId: 'mixed_arithmetic',
      tierParams: {
        '1':  { rangeA: [1, 10],   rangeB: [1, 10],   operations: ['+', '-'],           steps: 2 },
        '2a': { rangeA: [1, 20],   rangeB: [1, 20],   operations: ['+', '-', '*'],       steps: 2 },
        '2b': { rangeA: [5, 50],   rangeB: [5, 50],   operations: ['+', '-', '*'],       steps: 3 },
        '3':  { rangeA: [10, 100], rangeB: [10, 100], operations: ['+', '-', '*', '/'],  steps: 3 },
      },
    },
  ],
  subDecks: [
    { id: 'addition',        name: 'Addition',          skillIds: ['arith_add'] },
    { id: 'subtraction',     name: 'Subtraction',       skillIds: ['arith_sub'] },
    { id: 'multiplication',  name: 'Multiplication',    skillIds: ['arith_mul'] },
    { id: 'division',        name: 'Division',          skillIds: ['arith_div'] },
    { id: 'mixed',           name: 'Mixed Operations',  skillIds: ['arith_mixed'] },
  ],
};
