/**
 * Linear Algebra procedural deck definition.
 *
 * Covers matrix addition, scalar multiplication, determinants, dot products,
 * and matrix-vector multiplication. Each skill uses a generator from
 * `src/services/math/linearAlgebraGenerators.ts` and scales difficulty across
 * the four FSRS card tiers (1, 2a, 2b, 3).
 *
 * The `steps` field controls matrix/vector dimension:
 *   steps=2 → 2×2 matrices / 2D vectors
 *   steps=3 → 3×3 matrices / 3D vectors
 *   steps=4 → 4D vectors (dot product only)
 *
 * Source files: src/data/mathDecks/linearAlgebra.ts
 * Related docs: docs/mechanics/procedural-math.md
 */

import type { ProceduralDeck } from '../proceduralDeckTypes';

export const LINEAR_ALGEBRA_DECK: ProceduralDeck = {
  id: 'linear_algebra',
  name: 'Linear Algebra',
  domain: 'mathematics',
  description: 'Master matrices and vectors: addition, scalar multiplication, determinants, dot products, and matrix-vector products.',
  skills: [
    {
      id: 'la_matrix_add',
      name: 'Matrix Addition',
      description: 'Add two matrices of the same dimension element-by-element.',
      generatorId: 'matrix_addition',
      tierParams: {
        '1':  { rangeA: [1, 5],   rangeB: [1, 5],   steps: 2 },
        '2a': { rangeA: [1, 9],   rangeB: [1, 9],   steps: 2 },
        '2b': { rangeA: [-5, 5],  rangeB: [-5, 5],  steps: 2 },
        '3':  { rangeA: [-9, 9],  rangeB: [-9, 9],  steps: 3 },
      },
    },
    {
      id: 'la_scalar_mult',
      name: 'Scalar Multiplication',
      description: 'Multiply every entry of a matrix by a scalar value.',
      generatorId: 'scalar_multiplication',
      tierParams: {
        '1':  { rangeA: [1, 5],  rangeB: [2, 4],  steps: 2 },
        '2a': { rangeA: [1, 9],  rangeB: [2, 6],  steps: 2 },
        '2b': { rangeA: [-5, 5], rangeB: [2, 8],  steps: 2 },
        '3':  { rangeA: [-9, 9], rangeB: [2, 10], steps: 3 },
      },
    },
    {
      id: 'la_determinant',
      name: 'Determinant',
      description: 'Compute the determinant of a 2×2 or 3×3 matrix.',
      generatorId: 'determinant',
      tierParams: {
        '1':  { rangeA: [1, 5],  rangeB: [1, 5],  steps: 2 },
        '2a': { rangeA: [1, 9],  rangeB: [1, 9],  steps: 2 },
        '2b': { rangeA: [-5, 5], rangeB: [-5, 5], steps: 2 },
        '3':  { rangeA: [-3, 3], rangeB: [-3, 3], steps: 3 },
      },
    },
    {
      id: 'la_dot_product',
      name: 'Dot Product',
      description: 'Compute the dot product of two vectors.',
      generatorId: 'dot_product',
      tierParams: {
        '1':  { rangeA: [1, 5],  rangeB: [1, 5],  steps: 2 },
        '2a': { rangeA: [1, 9],  rangeB: [1, 9],  steps: 3 },
        '2b': { rangeA: [-5, 5], rangeB: [-5, 5], steps: 3 },
        '3':  { rangeA: [-9, 9], rangeB: [-9, 9], steps: 4 },
      },
    },
    {
      id: 'la_mat_vec_mult',
      name: 'Matrix-Vector Multiply',
      description: 'Multiply a square matrix by a column vector.',
      generatorId: 'matrix_vector_multiply',
      tierParams: {
        '1':  { rangeA: [1, 4],  rangeB: [1, 4],  steps: 2 },
        '2a': { rangeA: [1, 6],  rangeB: [1, 6],  steps: 2 },
        '2b': { rangeA: [-4, 4], rangeB: [-4, 4], steps: 2 },
        '3':  { rangeA: [-5, 5], rangeB: [-5, 5], steps: 3 },
      },
    },
  ],
  subDecks: [
    { id: 'matrix_addition',      name: 'Matrix Addition',          skillIds: ['la_matrix_add'] },
    { id: 'scalar_multiplication', name: 'Scalar Multiplication',   skillIds: ['la_scalar_mult'] },
    { id: 'determinants',         name: 'Determinants',             skillIds: ['la_determinant'] },
    { id: 'dot_products',         name: 'Dot Products',             skillIds: ['la_dot_product'] },
    { id: 'mat_vec_multiply',     name: 'Matrix-Vector Multiply',   skillIds: ['la_mat_vec_mult'] },
  ],
};
