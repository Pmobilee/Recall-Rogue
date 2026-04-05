/**
 * Complex Numbers procedural deck definition.
 *
 * Covers addition, multiplication, modulus, conjugate operations, and
 * polar/argument form of complex numbers. Each skill uses a generator from
 * `src/services/math/complexNumbersGenerators.ts` and scales difficulty
 * across the four FSRS card tiers (1, 2a, 2b, 3).
 *
 * Source files: src/data/mathDecks/complexNumbers.ts
 * Related docs: docs/mechanics/procedural-math.md
 */

import type { ProceduralDeck } from '../proceduralDeckTypes';

export const COMPLEX_NUMBERS_DECK: ProceduralDeck = {
  id: 'complex_numbers',
  name: 'Complex Numbers',
  domain: 'mathematics',
  description: 'Addition, multiplication, modulus, conjugate, and polar form of complex numbers.',
  skills: [
    {
      id: 'cn_add',
      name: 'Complex Addition',
      description: 'Add two complex numbers by combining real and imaginary parts.',
      generatorId: 'complex_addition',
      tierParams: {
        '1':  { rangeA: [1, 5],    rangeB: [1, 5] },
        '2a': { rangeA: [-5, 5],   rangeB: [-5, 5] },
        '2b': { rangeA: [-10, 10], rangeB: [-10, 10] },
        '3':  { rangeA: [-15, 15], rangeB: [-15, 15] },
      },
    },
    {
      id: 'cn_multiply',
      name: 'Complex Multiplication',
      description: 'Multiply two complex numbers using FOIL and i² = -1.',
      generatorId: 'complex_multiplication',
      tierParams: {
        '1':  { rangeA: [1, 4],  rangeB: [1, 4] },
        '2a': { rangeA: [-4, 4], rangeB: [-4, 4] },
        '2b': { rangeA: [-6, 6], rangeB: [-6, 6] },
        '3':  { rangeA: [-8, 8], rangeB: [-8, 8] },
      },
    },
    {
      id: 'cn_modulus',
      name: 'Complex Modulus',
      description: 'Find |z| = √(a² + b²) using Pythagorean triples for integer results.',
      generatorId: 'complex_modulus',
      // rangeA controls the scale factor k; rangeB unused but required by GeneratorParams type
      tierParams: {
        '1':  { rangeA: [1, 5],  rangeB: [1, 5] },
        '2a': { rangeA: [1, 10], rangeB: [1, 10] },
        '2b': { rangeA: [1, 15], rangeB: [1, 15] },
        '3':  { rangeA: [1, 25], rangeB: [1, 25] },
      },
    },
    {
      id: 'cn_conjugate',
      name: 'Complex Conjugate',
      description: 'Find the conjugate z̄ and compute z + z̄, z - z̄, z × z̄.',
      generatorId: 'complex_conjugate',
      // rangeB unused but required by GeneratorParams type; steps selects sub-type (1-4)
      tierParams: {
        '1':  { rangeA: [1, 5],    rangeB: [1, 5],    steps: 1 },
        '2a': { rangeA: [-5, 5],   rangeB: [-5, 5],   steps: 2 },
        '2b': { rangeA: [-8, 8],   rangeB: [-8, 8],   steps: 3 },
        '3':  { rangeA: [-10, 10], rangeB: [-10, 10], steps: 4 },
      },
    },
    {
      id: 'cn_polar',
      name: 'Polar Form & Argument',
      description: 'Find the argument (angle in degrees) of a complex number in polar form.',
      generatorId: 'complex_polar',
      // rangeA drives magnitude; rangeB unused but required by GeneratorParams type
      tierParams: {
        '1':  { rangeA: [1, 5], rangeB: [1, 5], steps: 1 },
        '2a': { rangeA: [1, 5], rangeB: [1, 5], steps: 2 },
        '2b': { rangeA: [1, 5], rangeB: [1, 5], steps: 3 },
        '3':  { rangeA: [1, 5], rangeB: [1, 5], steps: 4 },
      },
    },
  ],
  subDecks: [
    { id: 'complex_addition_subdeck',       name: 'Complex Addition',       skillIds: ['cn_add'] },
    { id: 'complex_multiplication_subdeck', name: 'Complex Multiplication', skillIds: ['cn_multiply'] },
    { id: 'complex_modulus_subdeck',        name: 'Modulus',                skillIds: ['cn_modulus'] },
    { id: 'complex_conjugate_subdeck',      name: 'Conjugate Operations',   skillIds: ['cn_conjugate'] },
    { id: 'complex_polar_subdeck',          name: 'Polar Form & Argument',  skillIds: ['cn_polar'] },
  ],
};
