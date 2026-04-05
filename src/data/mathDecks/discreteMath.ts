/**
 * Discrete Mathematics procedural deck definition.
 *
 * Covers recurrence relations, graph theory basics, number base conversion,
 * summation formulas, and proof by induction concepts. Each skill uses a
 * generator from `src/services/math/discreteMathGenerators.ts` and scales
 * difficulty across the four FSRS card tiers (1, 2a, 2b, 3).
 *
 * Source files: src/data/mathDecks/discreteMath.ts
 * Related docs: docs/mechanics/procedural-math.md
 */

import type { ProceduralDeck } from '../proceduralDeckTypes';

export const DISCRETE_MATH_DECK: ProceduralDeck = {
  id: 'discrete_math',
  name: 'Discrete Math',
  domain: 'mathematics',
  description: 'Recurrences, graph theory, base conversion, summation, and induction.',
  skills: [
    {
      id: 'dm_recurrence',
      name: 'Recurrence Relations',
      description: 'Evaluate sequences defined by recurrence relations across arithmetic, Fibonacci-like, geometric, and linear forms.',
      generatorId: 'recurrence',
      tierParams: {
        '1':  { rangeA: [1, 5], rangeB: [1, 5],  steps: 1 },
        '2a': { rangeA: [1, 5], rangeB: [1, 5],  steps: 2 },
        '2b': { rangeA: [1, 5], rangeB: [2, 4],  steps: 3 },
        '3':  { rangeA: [1, 10], rangeB: [1, 5], steps: 4 },
      },
    },
    {
      id: 'dm_graph',
      name: 'Graph Theory',
      description: 'Apply the Handshaking Lemma, spanning tree bounds, complete graph edge counts, and regular graph properties.',
      generatorId: 'graph_theory',
      tierParams: {
        '1':  { rangeA: [3, 8],   rangeB: [2, 10],  steps: 1 },
        '2a': { rangeA: [3, 10],  rangeB: [2, 15],  steps: 2 },
        '2b': { rangeA: [3, 10],  rangeB: [3, 20],  steps: 3 },
        '3':  { rangeA: [4, 12],  rangeB: [2, 6],   steps: 4 },
      },
    },
    {
      id: 'dm_base',
      name: 'Base Conversion',
      description: 'Convert numbers between decimal, binary, and hexadecimal representations.',
      generatorId: 'base_conversion',
      tierParams: {
        '1':  { rangeA: [1, 31],  rangeB: [1, 31],  steps: 1 },
        '2a': { rangeA: [1, 63],  rangeB: [1, 63],  steps: 2 },
        '2b': { rangeA: [1, 255], rangeB: [1, 255], steps: 3 },
        '3':  { rangeA: [1, 255], rangeB: [1, 255], steps: 4 },
      },
    },
    {
      id: 'dm_summation',
      name: 'Summation Formulas',
      description: 'Evaluate closed-form summations: linear sums, sum of squares, geometric series, and sums of odd numbers.',
      generatorId: 'summation',
      tierParams: {
        '1':  { rangeA: [3, 10], rangeB: [3, 10], steps: 1 },
        '2a': { rangeA: [3, 8],  rangeB: [3, 8],  steps: 2 },
        '2b': { rangeA: [2, 8],  rangeB: [2, 8],  steps: 3 },
        '3':  { rangeA: [3, 10], rangeB: [3, 10], steps: 4 },
      },
    },
    {
      id: 'dm_induction',
      name: 'Induction Concepts',
      description: 'Identify base cases, inductive step goals, LHS substitutions, and strong induction hypotheses.',
      generatorId: 'induction_base',
      tierParams: {
        '1':  { rangeA: [1, 5],  rangeB: [1, 5],  steps: 1 },
        '2a': { rangeA: [1, 5],  rangeB: [1, 5],  steps: 2 },
        '2b': { rangeA: [1, 8],  rangeB: [1, 8],  steps: 3 },
        '3':  { rangeA: [1, 10], rangeB: [1, 10], steps: 4 },
      },
    },
  ],
  subDecks: [
    { id: 'recurrences', name: 'Recurrence Relations', skillIds: ['dm_recurrence'] },
    { id: 'graphs',      name: 'Graph Theory',         skillIds: ['dm_graph'] },
    { id: 'bases',       name: 'Base Conversion',      skillIds: ['dm_base'] },
    { id: 'summation',   name: 'Summation Formulas',   skillIds: ['dm_summation'] },
    { id: 'induction',   name: 'Induction Concepts',   skillIds: ['dm_induction'] },
  ],
};
