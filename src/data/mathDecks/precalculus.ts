/**
 * Pre-Calculus procedural deck definition.
 *
 * Covers logarithm evaluation, exponent rules, arithmetic/geometric sequences,
 * introductory limits (substitution, difference of squares, cubic factoring),
 * and polynomial long division. Each sub-deck contains one SkillNode whose
 * difficulty scales across the four FSRS card tiers (1, 2a, 2b, 3).
 *
 * Source files: src/data/mathDecks/precalculus.ts
 * Related docs: docs/mechanics/procedural-math.md
 */

import type { ProceduralDeck } from '../proceduralDeckTypes';

export const PRECALCULUS_DECK: ProceduralDeck = {
  id: 'precalculus',
  name: 'Pre-Calculus',
  domain: 'mathematics',
  description: 'Master logarithms, exponent laws, sequences, limits, and polynomial division — the bridge to calculus.',
  skills: [
    {
      id: 'logarithm',
      name: 'Logarithms',
      description: 'Evaluate logarithmic expressions using the definition log_b(x) = n ↔ b^n = x.',
      generatorId: 'logarithm',
      tierParams: {
        '1':  { rangeA: [1, 4],  rangeB: [1, 3] },
        '2a': { rangeA: [1, 6],  rangeB: [1, 4] },
        '2b': { rangeA: [1, 8],  rangeB: [1, 5] },
        '3':  { rangeA: [1, 10], rangeB: [1, 6] },
      },
    },
    {
      id: 'exponent_rules',
      name: 'Exponent Rules',
      description: 'Apply product, quotient, and power rules to simplify exponential expressions.',
      generatorId: 'exponent_rules',
      tierParams: {
        '1':  { rangeA: [1, 4],  rangeB: [1, 4], steps: 1 },
        '2a': { rangeA: [1, 5],  rangeB: [1, 5], steps: 2 },
        '2b': { rangeA: [1, 6],  rangeB: [1, 6], steps: 3 },
        '3':  { rangeA: [1, 8],  rangeB: [1, 8], steps: 4 },
      },
    },
    {
      id: 'sequence',
      name: 'Sequences & Series',
      description: 'Find nth terms and partial sums of arithmetic and geometric sequences.',
      generatorId: 'sequence',
      tierParams: {
        '1':  { rangeA: [1, 5],  rangeB: [2, 8],  steps: 1 },
        '2a': { rangeA: [1, 4],  rangeB: [2, 6],  steps: 2 },
        '2b': { rangeA: [1, 6],  rangeB: [4, 10], steps: 3 },
        '3':  { rangeA: [1, 4],  rangeB: [3, 6],  steps: 4 },
      },
    },
    {
      id: 'limit_intro',
      name: 'Introductory Limits',
      description: 'Evaluate limits by substitution, difference of squares, and factoring.',
      generatorId: 'limit_intro',
      tierParams: {
        '1':  { rangeA: [1, 5],  rangeB: [-3, 4], steps: 1 },
        '2a': { rangeA: [1, 4],  rangeB: [-3, 3], steps: 2 },
        '2b': { rangeA: [1, 6],  rangeB: [-3, 4], steps: 3 },
        '3':  { rangeA: [1, 5],  rangeB: [-3, 3], steps: 4 },
      },
    },
    {
      id: 'polynomial_division',
      name: 'Polynomial Division',
      description: 'Divide polynomials using long division or synthetic division to find quotients.',
      generatorId: 'polynomial_division',
      tierParams: {
        '1':  { rangeA: [1, 3],  rangeB: [-3, 3], steps: 1 },
        '2a': { rangeA: [1, 4],  rangeB: [-3, 3], steps: 2 },
        '2b': { rangeA: [1, 3],  rangeB: [-3, 3], steps: 3 },
        '3':  { rangeA: [1, 4],  rangeB: [-3, 3], steps: 4 },
      },
    },
  ],
  subDecks: [
    { id: 'logarithms',           name: 'Logarithms',            skillIds: ['logarithm'] },
    { id: 'exponent_rules',       name: 'Exponent Rules',        skillIds: ['exponent_rules'] },
    { id: 'sequences_series',     name: 'Sequences & Series',    skillIds: ['sequence'] },
    { id: 'introductory_limits',  name: 'Introductory Limits',   skillIds: ['limit_intro'] },
    { id: 'polynomial_division',  name: 'Polynomial Division',   skillIds: ['polynomial_division'] },
  ],
};
