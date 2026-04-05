/**
 * Number Theory procedural deck definition.
 *
 * Covers prime factorization, LCM/GCD, modular arithmetic, divisibility
 * (factor counting), and prime identification. Each skill uses a generator
 * from `src/services/math/numberTheoryGenerators.ts` and scales difficulty
 * across the four FSRS card tiers (1, 2a, 2b, 3).
 *
 * Source files: src/data/mathDecks/numberTheory.ts
 * Related docs: docs/mechanics/procedural-math.md
 */

import type { ProceduralDeck } from '../proceduralDeckTypes';

export const NUMBER_THEORY_DECK: ProceduralDeck = {
  id: 'number_theory',
  name: 'Number Theory',
  domain: 'mathematics',
  description: 'Explore primes, factors, modular arithmetic, and divisibility — the building blocks of number theory.',
  skills: [
    {
      id: 'nt_prime_factorization',
      name: 'Prime Factorization',
      description: 'Write a number as a product of prime powers.',
      generatorId: 'prime_factorization',
      tierParams: {
        // Tier 1: small primes only (2, 3, 5), 2 factors, numbers up to ~75
        '1':  { rangeA: [2, 7],  rangeB: [2, 4],  steps: 2 },
        // Tier 2a: primes up to 11, allow 3 factors
        '2a': { rangeA: [2, 11], rangeB: [2, 5],  steps: 3 },
        // Tier 2b: primes up to 13, up to 4 factors
        '2b': { rangeA: [2, 13], rangeB: [2, 6],  steps: 4 },
        // Tier 3: primes up to 17, up to 4 factors (larger composites)
        '3':  { rangeA: [2, 17], rangeB: [2, 8],  steps: 4 },
      },
    },
    {
      id: 'nt_lcm_gcd',
      name: 'LCM & GCD',
      description: 'Find the greatest common divisor or least common multiple of two numbers.',
      generatorId: 'lcm_gcd',
      tierParams: {
        // Tier 1: GCD only (steps=1), small shared factors
        '1':  { rangeA: [1, 5],  rangeB: [2, 6],  steps: 1 },
        // Tier 2a: GCD or LCM (steps=2), moderate range
        '2a': { rangeA: [2, 10], rangeB: [2, 8],  steps: 2 },
        // Tier 2b: larger shared factors, multipliers up to 12
        '2b': { rangeA: [2, 15], rangeB: [3, 12], steps: 2 },
        // Tier 3: large shared factors, multipliers up to 20
        '3':  { rangeA: [3, 20], rangeB: [3, 20], steps: 2 },
      },
    },
    {
      id: 'nt_modular_arithmetic',
      name: 'Modular Arithmetic',
      description: 'Compute remainders and apply modular operations.',
      generatorId: 'modular_arithmetic',
      tierParams: {
        // Tier 1: basic mod (steps=1), small dividends
        '1':  { rangeA: [5, 30],   rangeB: [2, 9],   steps: 1 },
        // Tier 2a: modular addition (steps=2)
        '2a': { rangeA: [5, 50],   rangeB: [2, 12],  steps: 2 },
        // Tier 2b: modular multiplication (steps=3)
        '2b': { rangeA: [5, 50],   rangeB: [2, 15],  steps: 3 },
        // Tier 3: modular exponentiation (steps=4), small bases
        '3':  { rangeA: [2, 20],   rangeB: [5, 20],  steps: 4 },
      },
    },
    {
      id: 'nt_divisibility',
      name: 'Divisibility & Factors',
      description: 'Count and identify all positive divisors of a number.',
      generatorId: 'divisibility',
      tierParams: {
        // Tier 1: small primes (2, 3, 5), 2 prime factors → simple numbers
        '1':  { rangeA: [2, 7],  rangeB: [2, 4],  steps: 2 },
        // Tier 2a: primes up to 11, 3 factors
        '2a': { rangeA: [2, 11], rangeB: [2, 6],  steps: 3 },
        // Tier 2b: primes up to 13, up to 4 factors
        '2b': { rangeA: [2, 13], rangeB: [2, 8],  steps: 4 },
        // Tier 3: primes up to 17, up to 4 factors (more divisors)
        '3':  { rangeA: [2, 17], rangeB: [2, 10], steps: 4 },
      },
    },
    {
      id: 'nt_prime_identification',
      name: 'Prime Identification',
      description: 'Identify primes, find the next prime, count primes in a range, and locate the Nth prime.',
      generatorId: 'prime_identification',
      tierParams: {
        // Tier 1: sub-type 1 — which is prime? (numbers in 2–30)
        '1':  { rangeA: [2, 30],  rangeB: [2, 30],  steps: 1 },
        // Tier 2a: sub-type 2 — next prime after N (N in 2–50)
        '2a': { rangeA: [2, 50],  rangeB: [2, 50],  steps: 2 },
        // Tier 2b: sub-type 3 — count primes in [lo, hi] (range up to 50)
        '2b': { rangeA: [2, 50],  rangeB: [2, 50],  steps: 3 },
        // Tier 3: sub-type 4 — Nth prime (N up to 20)
        '3':  { rangeA: [1, 20],  rangeB: [2, 73],  steps: 4 },
      },
    },
  ],
  subDecks: [
    { id: 'prime_factorization', name: 'Prime Factorization', skillIds: ['nt_prime_factorization'] },
    { id: 'lcm_gcd',            name: 'LCM & GCD',            skillIds: ['nt_lcm_gcd'] },
    { id: 'modular_arithmetic', name: 'Modular Arithmetic',   skillIds: ['nt_modular_arithmetic'] },
    { id: 'divisibility',       name: 'Divisibility & Factors', skillIds: ['nt_divisibility'] },
    { id: 'prime_identification', name: 'Prime Identification', skillIds: ['nt_prime_identification'] },
  ],
};
