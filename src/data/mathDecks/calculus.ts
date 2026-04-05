/**
 * Calculus procedural deck definition.
 *
 * Covers derivative power rule, chain rule, basic indefinite integrals,
 * limit evaluation, and definite integrals. Each sub-deck contains one
 * SkillNode whose difficulty scales across the four FSRS card tiers (1, 2a, 2b, 3).
 *
 * Source files: src/data/mathDecks/calculus.ts
 * Related docs: docs/mechanics/procedural-math.md
 */

import type { ProceduralDeck } from '../proceduralDeckTypes';

export const CALCULUS_DECK: ProceduralDeck = {
  id: 'calculus',
  name: 'Calculus',
  domain: 'mathematics',
  description: 'Master derivatives, integrals, and limits — the foundations of calculus.',
  skills: [
    {
      id: 'derivative_power_rule',
      name: 'Power Rule Derivatives',
      description: 'Differentiate polynomials using the power rule d/dx(x^n) = n·x^(n-1).',
      generatorId: 'derivative_power_rule',
      tierParams: {
        '1':  { rangeA: [1, 4],  rangeB: [1, 3], steps: 1 },
        '2a': { rangeA: [1, 6],  rangeB: [1, 4], steps: 2 },
        '2b': { rangeA: [1, 8],  rangeB: [1, 5], steps: 2 },
        '3':  { rangeA: [1, 10], rangeB: [1, 6], steps: 3 },
      },
    },
    {
      id: 'derivative_chain_rule',
      name: 'Chain Rule',
      description: 'Differentiate composite functions f(g(x)) using the chain rule.',
      generatorId: 'derivative_chain_rule',
      tierParams: {
        '1':  { rangeA: [1, 4],  rangeB: [2, 3], steps: 1 },
        '2a': { rangeA: [1, 5],  rangeB: [2, 4], steps: 1 },
        '2b': { rangeA: [1, 6],  rangeB: [2, 5], steps: 1 },
        '3':  { rangeA: [1, 8],  rangeB: [2, 6], steps: 2 },
      },
    },
    {
      id: 'basic_integral',
      name: 'Basic Integrals',
      description: 'Find indefinite integrals using the reverse power rule.',
      generatorId: 'basic_integral',
      tierParams: {
        '1':  { rangeA: [1, 3],  rangeB: [1, 2], steps: 1 },
        '2a': { rangeA: [1, 4],  rangeB: [1, 3], steps: 2 },
        '2b': { rangeA: [1, 5],  rangeB: [1, 4], steps: 2 },
        '3':  { rangeA: [1, 6],  rangeB: [1, 5], steps: 3 },
      },
    },
    {
      id: 'limit_evaluation',
      name: 'Limit Evaluation',
      description: 'Evaluate limits by direct substitution, factoring, or known special limits.',
      generatorId: 'limit_evaluation',
      tierParams: {
        '1':  { rangeA: [1, 5],  rangeB: [-3, 3], steps: 1 },
        '2a': { rangeA: [1, 6],  rangeB: [-4, 4], steps: 1 },
        '2b': { rangeA: [1, 8],  rangeB: [-5, 5], steps: 2 },
        '3':  { rangeA: [1, 10], rangeB: [-6, 6], steps: 3 },
      },
    },
    {
      id: 'definite_integral',
      name: 'Definite Integrals',
      description: 'Evaluate definite integrals using the Fundamental Theorem of Calculus.',
      generatorId: 'definite_integral',
      tierParams: {
        '1':  { rangeA: [1, 2], rangeB: [0, 3], steps: 1 },
        '2a': { rangeA: [1, 3], rangeB: [0, 4], steps: 1 },
        '2b': { rangeA: [1, 3], rangeB: [0, 4], steps: 2 },
        '3':  { rangeA: [1, 4], rangeB: [0, 5], steps: 3 },
      },
    },
  ],
  subDecks: [
    { id: 'power_rule',      name: 'Power Rule Derivatives', skillIds: ['derivative_power_rule'] },
    { id: 'chain_rule',      name: 'Chain Rule',             skillIds: ['derivative_chain_rule'] },
    { id: 'basic_integrals', name: 'Basic Integrals',        skillIds: ['basic_integral'] },
    { id: 'limits',          name: 'Limit Evaluation',       skillIds: ['limit_evaluation'] },
    { id: 'definite_integrals', name: 'Definite Integrals',  skillIds: ['definite_integral'] },
  ],
};
