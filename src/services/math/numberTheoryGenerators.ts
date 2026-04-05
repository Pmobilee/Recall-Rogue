/**
 * Procedural number theory problem generators.
 *
 * Five generator functions covering prime factorization, LCM/GCD, modular
 * arithmetic, divisibility (factor counting), and prime identification.
 *
 * All generators use a "construct forward" strategy where sensible — build the
 * problem from small prime components to guarantee non-trivial, interesting
 * results. Modular arithmetic uses direct forward computation.
 *
 * All randomness is seeded via a mulberry32 PRNG so the same (params, seed)
 * pair always produces the same problem.
 *
 * Source files: src/services/math/numberTheoryGenerators.ts
 * Related docs: docs/mechanics/procedural-math.md
 */

import type { GeneratorParams, MathProblem } from '../../data/proceduralDeckTypes';
import { randInt, randPick, gcd, dedupeDistractors } from './mathUtils';

// ── Number-theory helpers ─────────────────────────────────────────────────────

/**
 * Return true if n is a prime number (trial division, safe for n < 10_000).
 */
export function isPrime(n: number): boolean {
  if (n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;
  for (let i = 3; i * i <= n; i += 2) {
    if (n % i === 0) return false;
  }
  return true;
}

/**
 * Return the smallest prime strictly greater than n.
 */
export function nextPrime(n: number): number {
  let candidate = n + 1;
  while (!isPrime(candidate)) candidate++;
  return candidate;
}

/**
 * Return the Nth prime (1-indexed: nthPrime(1) = 2).
 * Safe for n up to ~200 (covers all problems we generate).
 */
export function nthPrime(n: number): number {
  if (n < 1) return 2;
  let count = 0;
  let candidate = 1;
  while (count < n) {
    candidate++;
    if (isPrime(candidate)) count++;
  }
  return candidate;
}

/**
 * Count prime numbers in [lo, hi] inclusive.
 */
export function countPrimesInRange(lo: number, hi: number): number {
  let count = 0;
  for (let n = lo; n <= hi; n++) {
    if (isPrime(n)) count++;
  }
  return count;
}

/**
 * Return the prime factorization of n as a map from prime → exponent.
 * Returns {} for n < 2.
 */
export function primeFactorize(n: number): Map<number, number> {
  const factors = new Map<number, number>();
  if (n < 2) return factors;
  let remaining = n;
  for (let p = 2; p * p <= remaining; p++) {
    while (remaining % p === 0) {
      factors.set(p, (factors.get(p) ?? 0) + 1);
      remaining = Math.floor(remaining / p);
    }
  }
  if (remaining > 1) {
    factors.set(remaining, (factors.get(remaining) ?? 0) + 1);
  }
  return factors;
}

/**
 * Format a factorization map as a canonical string, e.g. "2^3 × 3 × 5^2".
 * Primes are listed in ascending order.
 */
export function formatFactorization(factors: Map<number, number>): string {
  const parts: string[] = [];
  const primes = [...factors.keys()].sort((a, b) => a - b);
  for (const p of primes) {
    const exp = factors.get(p)!;
    parts.push(exp === 1 ? String(p) : `${p}^${exp}`);
  }
  return parts.join(' × ');
}

/**
 * Return the total count of divisors of n (including 1 and n itself).
 * Based on the formula: d(n) = Π(eᵢ + 1) over the prime factorization.
 */
export function countDivisors(n: number): number {
  if (n < 1) return 0;
  if (n === 1) return 1;
  const factors = primeFactorize(n);
  let count = 1;
  for (const exp of factors.values()) {
    count *= exp + 1;
  }
  return count;
}

// ── LCM helper ────────────────────────────────────────────────────────────────

function lcm(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return Math.abs(a * b) / gcd(a, b);
}

// ── Generator 1: Prime Factorization ─────────────────────────────────────────

/**
 * Generates a prime factorization problem.
 *
 * Uses a "construct forward" approach: pick 2–3 small primes, multiply them
 * together (with optional repeated factors for higher tiers), so the result
 * is always factorisable and the answer is always non-trivial.
 *
 * The number being factorized is shown as a decimal integer; the answer is
 * the canonical factorization string (e.g. "2^3 × 3 × 5").
 *
 * @param params - rangeA = small prime pool upper bound (2–rangeA[1]).
 *                 steps = max number of prime factors to multiply (default 3).
 * @param rng    - Seeded PRNG.
 * @returns A MathProblem with a factorization string answer.
 */
export function generatePrimeFactorization(
  params: GeneratorParams,
  rng: () => number,
): MathProblem {
  const primePoolMax = params.rangeA[1];
  const maxFactors = params.steps ?? 3;

  // Build the prime pool — all primes up to primePoolMax
  const primePool: number[] = [];
  for (let p = 2; p <= primePoolMax; p++) {
    if (isPrime(p)) primePool.push(p);
  }
  // Guarantee at least 2 primes available
  if (primePool.length < 2) primePool.push(2, 3);

  // Pick a random count of prime factors in [2, maxFactors]
  const factorCount = randInt(rng, 2, maxFactors);

  // Build the factorization by picking primes (with possible repeats for higher tiers)
  const factorMap = new Map<number, number>();
  for (let i = 0; i < factorCount; i++) {
    const p = randPick(rng, primePool);
    factorMap.set(p, (factorMap.get(p) ?? 0) + 1);
  }

  // Compute the number n = product of prime^exponent
  let n = 1;
  for (const [prime, exp] of factorMap) {
    n *= Math.pow(prime, exp);
  }

  // Guard: if n is too large (> 9999) or is prime itself, fall back to simple case
  if (n > 9999 || isPrime(n)) {
    const p1 = primePool[0];
    const p2 = primePool[Math.min(1, primePool.length - 1)];
    factorMap.clear();
    factorMap.set(p1, 2);
    if (p1 !== p2) factorMap.set(p2, 1);
    n = p1 * p1 * (p1 !== p2 ? p2 : 1);
    if (n > 9999) { factorMap.clear(); factorMap.set(2, 3); n = 8; }
  }

  const correctAnswer = formatFactorization(factorMap);

  // Build distractors: mutate exponents and swap primes
  const candidates: string[] = [];

  // Distractor: increment one exponent by 1
  for (const [p, e] of factorMap) {
    const alt = new Map(factorMap);
    alt.set(p, e + 1);
    candidates.push(formatFactorization(alt));
  }

  // Distractor: decrement one exponent by 1 (remove if hits 0)
  for (const [p, e] of factorMap) {
    const alt = new Map(factorMap);
    if (e - 1 === 0) alt.delete(p); else alt.set(p, e - 1);
    if (alt.size > 0) candidates.push(formatFactorization(alt));
  }

  // Distractor: replace one prime with its nextPrime
  for (const [p, e] of factorMap) {
    const np = nextPrime(p);
    if (np <= primePoolMax + 10) {
      const alt = new Map(factorMap);
      alt.delete(p);
      alt.set(np, (alt.get(np) ?? 0) + e);
      candidates.push(formatFactorization(alt));
    }
  }

  // Distractor: replace one prime with a smaller prime (or 2 if already smallest)
  const sortedPrimes = [...factorMap.keys()].sort((a, b) => a - b);
  for (const p of sortedPrimes) {
    const smallerPrime = primePool.find(q => q < p) ?? 2;
    if (smallerPrime !== p) {
      const e = factorMap.get(p)!;
      const alt = new Map(factorMap);
      alt.delete(p);
      alt.set(smallerPrime, (alt.get(smallerPrime) ?? 0) + e);
      candidates.push(formatFactorization(alt));
    }
  }

  // Distractor: drop one factor entirely (if more than 1 distinct prime)
  if (factorMap.size > 1) {
    for (const p of factorMap.keys()) {
      const alt = new Map(factorMap);
      alt.delete(p);
      candidates.push(formatFactorization(alt));
    }
  }

  // Distractor: add an extra factor (a prime not already in factorMap)
  const unusedPrimes = primePool.filter(p => !factorMap.has(p));
  if (unusedPrimes.length > 0) {
    const extra = unusedPrimes[0];
    const alt = new Map(factorMap);
    alt.set(extra, 1);
    candidates.push(formatFactorization(alt));
  }

  const distractors = dedupeDistractors(candidates, correctAnswer, 4);

  const explanation =
    `${n} = ${correctAnswer} (verify by multiplying the factors together)`;

  return {
    question: `Write the prime factorization of ${n}`,
    correctAnswer,
    acceptableAlternatives: [],
    distractors,
    explanation,
    inputMode: 'choice',
  };
}

// ── Generator 2: LCM / GCD ────────────────────────────────────────────────────

/**
 * Generates an LCM or GCD problem.
 *
 * Tier 1 (steps=1): GCD only. Constructs a and b by picking a shared factor g
 * and two coprime multipliers, so GCD(a, b) = g and the answer is always clean.
 *
 * Tier 2+ (steps=2): randomly chooses LCM or GCD. LCM is constructed via the
 * same shared-factor method — LCM(a, b) = a × b / GCD(a, b).
 *
 * @param params - rangeA = factor range [min, max], rangeB = multiplier range.
 *                 steps = 1 → GCD only; 2 → random LCM or GCD.
 * @param rng    - Seeded PRNG.
 * @returns A MathProblem with an integer answer.
 */
export function generateLcmGcd(
  params: GeneratorParams,
  rng: () => number,
): MathProblem {
  const gcdMin = params.rangeA[0];
  const gcdMax = params.rangeA[1];
  const multMin = Math.max(params.rangeB[0], 1);
  const multMax = params.rangeB[1];
  const mode = (params.steps ?? 1) <= 1 ? 'gcd' : (rng() < 0.5 ? 'gcd' : 'lcm');

  // Construct forward: pick shared factor g, pick two coprime multipliers m1, m2
  const g = randInt(rng, gcdMin, gcdMax);
  let m1 = randInt(rng, multMin, multMax);
  let m2 = randInt(rng, multMin, multMax);

  // Ensure m1 and m2 are coprime (so GCD(g×m1, g×m2) = g exactly)
  // Up to 20 attempts to find coprime pair
  for (let attempt = 0; attempt < 20; attempt++) {
    if (gcd(m1, m2) === 1) break;
    m2 = randInt(rng, multMin, multMax);
  }
  // If still not coprime after retries, force coprime by using m2 = m1 + 1
  if (gcd(m1, m2) !== 1) m2 = m1 + 1;

  const a = g * m1;
  const b = g * m2;

  const gcdResult = g; // By construction GCD(a, b) = g
  const lcmResult = lcm(a, b); // = a × b / g = g × m1 × m2

  let correctAnswer: string;
  let question: string;
  let explanation: string;

  if (mode === 'gcd') {
    correctAnswer = String(gcdResult);
    question = `Find GCD(${a}, ${b})`;
    explanation = `${a} = ${g} × ${m1}, ${b} = ${g} × ${m2}. GCD = ${g}`;
  } else {
    correctAnswer = String(lcmResult);
    question = `Find LCM(${a}, ${b})`;
    explanation =
      `GCD(${a}, ${b}) = ${gcdResult}. LCM = ${a} × ${b} ÷ ${gcdResult} = ${lcmResult}`;
  }

  // Distractors — include the "wrong operation" answer and near-values
  const wrongOp = mode === 'gcd' ? lcmResult : gcdResult;
  const candidates = [
    String(wrongOp),
    String(Math.abs(a - b)),  // absolute difference (common mistake)
    String(a + b),             // sum (another common mistake)
    String(correctAnswer === String(gcdResult + 1) ? gcdResult + 2 : gcdResult + 1),
    String(Number(correctAnswer) + 2),
    String(Math.max(1, Number(correctAnswer) - 1)),
    String(Number(correctAnswer) * 2),
    String(Math.round(Number(correctAnswer) / 2)),
  ];

  const distractors = dedupeDistractors(candidates, correctAnswer, 4);

  return {
    question,
    correctAnswer,
    acceptableAlternatives: [],
    distractors,
    explanation,
    inputMode: 'choice',
  };
}

// ── Generator 3: Modular Arithmetic ──────────────────────────────────────────

/**
 * Generates a modular arithmetic problem.
 *
 * The `steps` parameter selects the sub-type:
 *   1 = basic mod (a mod m = ?)
 *   2 = modular addition ((a + b) mod m = ?)
 *   3 = modular multiplication ((a × b) mod m = ?)
 *   4 = modular exponentiation (a^e mod m = ?, small values only)
 *
 * @param params - rangeA = dividend/base range, rangeB = modulus range.
 *                 steps = sub-type selector (1–4).
 * @param rng    - Seeded PRNG.
 * @returns A MathProblem with an integer answer in [0, m-1].
 */
export function generateModularArithmetic(
  params: GeneratorParams,
  rng: () => number,
): MathProblem {
  const aMin = params.rangeA[0];
  const aMax = params.rangeA[1];
  const mMin = Math.max(params.rangeB[0], 2);
  const mMax = params.rangeB[1];
  const subType = params.steps ?? 1;

  const m = randInt(rng, mMin, mMax);

  let question: string;
  let answer: number;
  let explanation: string;

  if (subType === 1) {
    // Basic mod: a mod m
    const a = randInt(rng, aMin, aMax);
    answer = ((a % m) + m) % m;
    question = `${a} mod ${m} = ?`;
    explanation = `${a} ÷ ${m} = ${Math.floor(a / m)} remainder ${answer}. So ${a} mod ${m} = ${answer}`;

  } else if (subType === 2) {
    // Modular addition: (a + b) mod m
    const a = randInt(rng, aMin, aMax);
    const b = randInt(rng, aMin, aMax);
    const sum = a + b;
    answer = sum % m;
    question = `(${a} + ${b}) mod ${m} = ?`;
    explanation = `${a} + ${b} = ${sum}. ${sum} mod ${m} = ${answer}`;

  } else if (subType === 3) {
    // Modular multiplication: (a × b) mod m
    const a = randInt(rng, Math.min(aMin, 10), Math.min(aMax, 20));
    const b = randInt(rng, Math.min(aMin, 10), Math.min(aMax, 20));
    const product = a * b;
    answer = product % m;
    question = `(${a} × ${b}) mod ${m} = ?`;
    explanation = `${a} × ${b} = ${product}. ${product} mod ${m} = ${answer}`;

  } else {
    // Modular exponentiation: a^e mod m (small values to keep arithmetic manageable)
    const a = randInt(rng, 2, Math.min(aMax, 10));
    const e = randInt(rng, 2, 5);
    const power = Math.pow(a, e);
    answer = power % m;
    question = `${a}^${e} mod ${m} = ?`;
    explanation = `${a}^${e} = ${power}. ${power} mod ${m} = ${answer}`;
  }

  const correctAnswer = String(answer);

  // Distractors: nearby values in [0, m-1], wrong-mod-operation answers
  const candidates: string[] = [];
  for (let delta = 1; delta <= 4; delta++) {
    candidates.push(String((answer + delta) % m));
    candidates.push(String((answer - delta + m) % m));
  }
  // Include m itself (forgot to take mod), and m-1 (off-by-one)
  candidates.push(String(m));
  candidates.push(String(m - 1));

  const distractors = dedupeDistractors(candidates, correctAnswer, 4);

  return {
    question,
    correctAnswer,
    acceptableAlternatives: [],
    distractors,
    explanation,
    inputMode: 'choice',
  };
}

// ── Generator 4: Divisibility ─────────────────────────────────────────────────

/**
 * Generates a divisor-count problem: "How many positive divisors does N have?"
 *
 * Constructs n forward from prime factors to ensure it has an interesting
 * number of divisors (not 1 or 2, which are trivial/prime).
 *
 * @param params - rangeA = prime pool range, rangeB = divisor count range hint.
 *                 steps = max prime factors in construction (default 3).
 * @param rng    - Seeded PRNG.
 * @returns A MathProblem with an integer answer (the divisor count).
 */
export function generateDivisibility(
  params: GeneratorParams,
  rng: () => number,
): MathProblem {
  const primeMax = params.rangeA[1];
  const maxFactors = params.steps ?? 3;

  // Build prime pool
  const primePool: number[] = [];
  for (let p = 2; p <= primeMax; p++) {
    if (isPrime(p)) primePool.push(p);
  }
  if (primePool.length < 2) primePool.push(2, 3);

  // Construct n from random prime factors (same strategy as factorization generator)
  const factorCount = randInt(rng, 2, maxFactors);
  const factorMap = new Map<number, number>();
  for (let i = 0; i < factorCount; i++) {
    const p = randPick(rng, primePool);
    factorMap.set(p, (factorMap.get(p) ?? 0) + 1);
  }

  let n = 1;
  for (const [prime, exp] of factorMap) {
    n *= Math.pow(prime, exp);
  }

  // Guard against trivial or huge n
  if (n > 9999 || n < 4) {
    n = 12; // 12 = 2^2 × 3, has 6 divisors
    factorMap.clear();
    factorMap.set(2, 2);
    factorMap.set(3, 1);
  }

  const divisorCount = countDivisors(n);
  const correctAnswer = String(divisorCount);

  // Build explanation listing all divisors
  const allDivisors: number[] = [];
  for (let d = 1; d <= n; d++) {
    if (n % d === 0) allDivisors.push(d);
  }
  const factStr = formatFactorization(factorMap);
  const explanation =
    `${n} = ${factStr}. Divisors: ${allDivisors.join(', ')}. Count = ${divisorCount}`;

  // Distractors: nearby counts, common mistakes
  const candidates = [
    String(divisorCount + 1),
    String(divisorCount - 1),
    String(divisorCount + 2),
    String(divisorCount * 2),
    String(Math.max(1, divisorCount - 2)),
    String(factorMap.size), // just the number of distinct prime factors
    String(allDivisors.length - 1), // forgot to count n itself
    String(allDivisors.length + 1),
  ];

  const distractors = dedupeDistractors(candidates, correctAnswer, 4);

  return {
    question: `How many positive divisors does ${n} have?`,
    correctAnswer,
    acceptableAlternatives: [],
    distractors,
    explanation,
    inputMode: 'choice',
  };
}

// ── Generator 5: Prime Identification ─────────────────────────────────────────

/**
 * Generates a prime number identification problem.
 *
 * The `steps` parameter selects the sub-type:
 *   1 = which of these numbers is prime? (multiple-choice: 1 prime, 3 composites)
 *   2 = what is the next prime after N?
 *   3 = how many primes are in [lo, hi]?
 *   4 = what is the Nth prime?
 *
 * @param params - rangeA = number range for selection/searching.
 *                 steps = sub-type selector (1–4).
 * @param rng    - Seeded PRNG.
 * @returns A MathProblem with an integer or number string answer.
 */
export function generatePrimeIdentification(
  params: GeneratorParams,
  rng: () => number,
): MathProblem {
  const lo = params.rangeA[0];
  const hi = params.rangeA[1];
  const subType = params.steps ?? 1;

  let question: string;
  let correctAnswer: string;
  let explanation: string;
  let candidates: string[];

  if (subType === 1) {
    // "Which of these is prime?" — pick 1 prime and 3 composites from [lo, hi]
    const primesInRange: number[] = [];
    const compositesInRange: number[] = [];
    for (let n = Math.max(lo, 2); n <= hi; n++) {
      if (isPrime(n)) primesInRange.push(n);
      else compositesInRange.push(n);
    }

    // Fallback if range is too sparse
    if (primesInRange.length === 0) primesInRange.push(nthPrime(randInt(rng, 3, 10)));
    if (compositesInRange.length < 3) {
      const extras = [4, 6, 8, 9, 10, 12, 14, 15].filter(n => !compositesInRange.includes(n));
      compositesInRange.push(...extras.slice(0, 3 - compositesInRange.length));
    }

    // Shuffle and pick
    const chosenPrime = randPick(rng, primesInRange);
    const shuffledComposites = [...compositesInRange].sort(() => rng() - 0.5);
    const chosenComposites = shuffledComposites.slice(0, 3);

    correctAnswer = String(chosenPrime);
    const wrongOptions = chosenComposites.map(String);
    question = `Which of these numbers is prime?`;
    explanation =
      `${chosenPrime} is prime (divisible only by 1 and itself). ` +
      `${chosenComposites.join(', ')} are all composite.`;

    // For this sub-type, distractors are the non-prime options
    const distractors = dedupeDistractors(wrongOptions, correctAnswer, 4);
    return {
      question,
      correctAnswer,
      acceptableAlternatives: [],
      distractors,
      explanation,
      inputMode: 'choice',
    };

  } else if (subType === 2) {
    // "What is the next prime after N?"
    const n = randInt(rng, lo, hi);
    const result = nextPrime(n);
    correctAnswer = String(result);
    question = `What is the next prime number after ${n}?`;
    explanation = `After ${n}, the next prime is ${result}`;

    // Distractors: nearby integers that are NOT prime, plus adjacent primes
    const prevPrime = result > 2 ? (() => {
      let p = result - 1;
      while (p > 1 && !isPrime(p)) p--;
      return p;
    })() : 2;

    candidates = [
      String(result + 1),
      String(result + 2),
      String(result - 1),
      String(prevPrime),
      String(nextPrime(result)),
      String(result + 4),
      String(result - 2),
    ];

  } else if (subType === 3) {
    // "How many primes are in [lo, hi]?"
    // Use a fixed sub-range to keep the answer manageable
    const rangeSize = Math.min(hi - lo, 20);
    const subLo = randInt(rng, lo, Math.max(lo, hi - rangeSize));
    const subHi = subLo + rangeSize;

    const count = countPrimesInRange(Math.max(subLo, 2), subHi);
    correctAnswer = String(count);
    question = `How many prime numbers are in the range [${subLo}, ${subHi}]?`;
    explanation =
      `Primes in [${subLo}, ${subHi}]: ` +
      [...Array(subHi - subLo + 1).keys()]
        .map(i => i + subLo)
        .filter(n => n >= 2 && isPrime(n))
        .join(', ') +
      `. Count = ${count}`;

    candidates = [
      String(count + 1),
      String(count - 1),
      String(count + 2),
      String(Math.max(0, count - 2)),
      String(count + 3),
      String(count * 2),
      String(Math.max(1, Math.round(count * 1.5))),
    ];

  } else {
    // "What is the Nth prime?"
    const nMax = Math.min(Math.floor((hi - lo) / 2) + 5, 20);
    const n = randInt(rng, 1, Math.max(nMax, 5));
    const result = nthPrime(n);
    correctAnswer = String(result);
    question = `What is the ${n}${ordinalSuffix(n)} prime number?`;
    explanation = `The ${n}${ordinalSuffix(n)} prime is ${result}`;

    candidates = [
      String(nthPrime(Math.max(1, n - 1))),
      String(nthPrime(n + 1)),
      String(nthPrime(Math.max(1, n - 2))),
      String(nthPrime(n + 2)),
      String(result + 1),
      String(result - 1),
      String(result + 2),
    ];
  }

  const distractors = dedupeDistractors(candidates, correctAnswer, 4);

  return {
    question,
    correctAnswer,
    acceptableAlternatives: [],
    distractors,
    explanation,
    inputMode: 'choice',
  };
}

// ── Internal utility ──────────────────────────────────────────────────────────

/** Returns ordinal suffix for a number: 1→"st", 2→"nd", 3→"rd", 4+→"th". */
function ordinalSuffix(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}
