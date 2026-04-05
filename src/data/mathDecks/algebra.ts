/**
 * Algebra procedural deck definition.
 *
 * Covers linear equations, quadratic equations, expression simplification,
 * inequalities, and systems of equations. Each skill uses a generator from
 * `src/services/math/algebraGenerators.ts` and scales difficulty across the
 * four FSRS card tiers (1, 2a, 2b, 3).
 *
 * Source files: src/data/mathDecks/algebra.ts
 * Related docs: docs/mechanics/procedural-math.md
 */

import type { ProceduralDeck } from '../proceduralDeckTypes';

export const ALGEBRA_DECK: ProceduralDeck = {
  id: 'algebra',
  name: 'Algebra',
  domain: 'mathematics',
  description: 'Solve equations, simplify expressions, and master algebraic reasoning.',
  skills: [
    {
      id: 'alg_linear',
      name: 'Linear Equations',
      description: 'Solve for x in equations like ax + b = c.',
      generatorId: 'linear_equation',
      tierParams: {
        '1':  { rangeA: [1, 10],  rangeB: [-10, 10],  maxCoefficient: 5 },
        '2a': { rangeA: [1, 20],  rangeB: [-20, 20],  maxCoefficient: 10 },
        '2b': { rangeA: [2, 30],  rangeB: [-30, 30],  maxCoefficient: 15, allowNegativeCoefficients: true },
        '3':  { rangeA: [2, 50],  rangeB: [-50, 50],  maxCoefficient: 25, allowNegativeCoefficients: true },
      },
    },
    {
      id: 'alg_quadratic',
      name: 'Quadratic Equations',
      description: 'Find the roots of quadratic equations like ax² + bx + c = 0.',
      generatorId: 'quadratic_equation',
      tierParams: {
        '1':  { rangeA: [1, 1],  rangeB: [-6, 6] },
        '2a': { rangeA: [1, 3],  rangeB: [-8, 8] },
        '2b': { rangeA: [1, 5],  rangeB: [-10, 10] },
        '3':  { rangeA: [1, 5],  rangeB: [-12, 12] },
      },
    },
    {
      id: 'alg_simplify',
      name: 'Simplify Expressions',
      description: 'Combine like terms and distribute to simplify algebraic expressions.',
      generatorId: 'expression_simplify',
      tierParams: {
        '1':  { rangeA: [1, 5],   rangeB: [1, 5],   steps: 2 },
        '2a': { rangeA: [1, 10],  rangeB: [1, 10],  steps: 3 },
        '2b': { rangeA: [1, 10],  rangeB: [1, 10],  steps: 3, equationForm: 'distribute' },
        '3':  { rangeA: [2, 15],  rangeB: [2, 15],  steps: 4, equationForm: 'distribute' },
      },
    },
    {
      id: 'alg_inequality',
      name: 'Inequalities',
      description: 'Solve linear inequalities and express the solution.',
      generatorId: 'inequality',
      tierParams: {
        '1':  { rangeA: [1, 5],   rangeB: [-10, 10],  maxCoefficient: 5 },
        '2a': { rangeA: [1, 10],  rangeB: [-20, 20],  maxCoefficient: 10 },
        '2b': { rangeA: [1, 15],  rangeB: [-30, 30],  maxCoefficient: 15, allowNegativeCoefficients: true },
        '3':  { rangeA: [1, 25],  rangeB: [-50, 50],  maxCoefficient: 25, allowNegativeCoefficients: true },
      },
    },
    {
      id: 'alg_systems',
      name: 'Systems of Equations',
      description: 'Solve systems of two linear equations simultaneously.',
      generatorId: 'linear_system',
      tierParams: {
        '1':  { rangeA: [1, 3],   rangeB: [-5, 5] },
        '2a': { rangeA: [1, 5],   rangeB: [-10, 10] },
        '2b': { rangeA: [1, 8],   rangeB: [-15, 15] },
        '3':  { rangeA: [1, 10],  rangeB: [-20, 20], allowNegativeCoefficients: true },
      },
    },
  ],
  subDecks: [
    { id: 'linear_equations',  name: 'Linear Equations',     skillIds: ['alg_linear'] },
    { id: 'quadratics',        name: 'Quadratic Equations',  skillIds: ['alg_quadratic'] },
    { id: 'simplification',    name: 'Simplify Expressions', skillIds: ['alg_simplify'] },
    { id: 'inequalities',      name: 'Inequalities',         skillIds: ['alg_inequality'] },
    { id: 'systems',           name: 'Systems of Equations', skillIds: ['alg_systems'] },
  ],
};
