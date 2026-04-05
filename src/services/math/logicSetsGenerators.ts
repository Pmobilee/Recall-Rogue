/**
 * Procedural logic and set theory problem generators for the Logic & Sets deck.
 *
 * Five generator functions cover: truth table evaluation, set operations,
 * Venn diagram inclusion-exclusion, logical equivalence identification, and
 * set cardinality counting. All randomness is seeded via the rng parameter so
 * the same (skill, tier, seed) triple always produces the same problem.
 *
 * Source files: src/services/math/logicSetsGenerators.ts
 * Related docs: docs/mechanics/procedural-math.md
 */

import type { GeneratorParams, MathProblem } from '../../data/proceduralDeckTypes';
import { randInt, randPick, dedupeDistractors, gcd } from './mathUtils';

// ── Local helpers ─────────────────────────────────────────────────────────────

/**
 * Compute the least common multiple of two positive integers.
 * Uses the imported gcd utility.
 */
function lcm(a: number, b: number): number {
  return (a * b) / gcd(a, b);
}

/**
 * Format an array of integers as a set string.
 * Empty array → "∅"; otherwise sorts numerically and wraps in braces.
 * e.g. formatSet([3, 1, 2]) → "{1, 2, 3}"
 */
export function formatSet(arr: number[]): string {
  if (arr.length === 0) return '∅';
  const sorted = [...arr].sort((x, y) => x - y);
  return '{' + sorted.join(', ') + '}';
}

// ── Truth table templates ─────────────────────────────────────────────────────

/** A single truth-table expression template. */
interface TruthTemplate {
  /** Display string using logical operator symbols. */
  expr: string;
  /** Evaluate the expression for a given (p, q) assignment. */
  evaluate: (p: boolean, q: boolean) => boolean;
}

/** Simple 2-variable templates available at all tiers. */
const SIMPLE_TEMPLATES: TruthTemplate[] = [
  { expr: 'p ∧ q',    evaluate: (p, q) => p && q },
  { expr: 'p ∨ q',    evaluate: (p, q) => p || q },
  { expr: 'p → q',    evaluate: (p, q) => !p || q },
  { expr: 'p ↔ q',    evaluate: (p, q) => p === q },
];

/** Compound templates (negation of compound, biconditional variants). */
const COMPOUND_TEMPLATES: TruthTemplate[] = [
  { expr: '¬p ∧ q',    evaluate: (p, q) => !p && q },
  { expr: '¬p ∨ q',    evaluate: (p, q) => !p || q },
  { expr: 'p ∧ ¬q',    evaluate: (p, q) => p && !q },
  { expr: '¬(p ∧ q)',  evaluate: (p, q) => !(p && q) },
  { expr: '¬(p ∨ q)',  evaluate: (p, q) => !(p || q) },
];

/** All possible (p, q) row assignments. */
const TRUTH_ROWS: [boolean, boolean][] = [
  [true,  true ],
  [true,  false],
  [false, true ],
  [false, false],
];

// ── Logical equivalence pool ──────────────────────────────────────────────────

/** A curated equivalence entry pairing an expression with its equivalent(s) and non-equivalents. */
interface EquivalenceEntry {
  /** The expression shown in the question. */
  expr: string;
  /** Logically equivalent expressions (correct answers). */
  equivalents: string[];
  /** Plausible-but-wrong alternatives (distractors). */
  nonEquivalents: string[];
}

/**
 * Curated pool of logical equivalences organised by difficulty tier.
 * Tier-1 entries cover commutativity and basic De Morgan's laws.
 * Tier-2 entries cover contrapositive, biconditional, and distributive laws.
 * Tier-3 entries cover absorption, XOR, and advanced identities.
 */
const EQUIVALENCE_POOL: Record<string, EquivalenceEntry[]> = {
  tier1: [
    {
      expr: 'p ∧ q',
      equivalents: ['q ∧ p'],
      nonEquivalents: ['p ∨ q', 'p → q', '¬p ∨ ¬q'],
    },
    {
      expr: 'p ∨ q',
      equivalents: ['q ∨ p'],
      nonEquivalents: ['p ∧ q', 'p → q', '¬p ∧ ¬q'],
    },
    {
      expr: '¬(p ∧ q)',
      equivalents: ['¬p ∨ ¬q'],
      nonEquivalents: ['¬p ∧ ¬q', 'p ∨ q', 'p → q'],
    },
    {
      expr: '¬(p ∨ q)',
      equivalents: ['¬p ∧ ¬q'],
      nonEquivalents: ['¬p ∨ ¬q', 'p ∧ q', '¬p → q'],
    },
    {
      expr: 'p → q',
      equivalents: ['¬p ∨ q'],
      nonEquivalents: ['q → p', 'p ∧ q', '¬q ∨ p'],
    },
  ],
  tier2: [
    {
      expr: 'p ↔ q',
      equivalents: ['(p → q) ∧ (q → p)'],
      nonEquivalents: ['p → q', '¬p ↔ ¬q', 'p ∧ q'],
    },
    {
      expr: '¬(p → q)',
      equivalents: ['p ∧ ¬q'],
      nonEquivalents: ['¬p → ¬q', 'p ∨ ¬q', '¬p ∧ q'],
    },
    {
      expr: 'p → q',
      equivalents: ['¬q → ¬p'],
      nonEquivalents: ['q → p', '¬p → ¬q', 'p ↔ q'],
    },
    {
      expr: '(p ∧ q) ∨ r',
      equivalents: ['(p ∨ r) ∧ (q ∨ r)'],
      nonEquivalents: ['p ∧ (q ∨ r)', '(p ∨ q) ∧ r', 'p ∧ q ∧ r'],
    },
  ],
  tier3: [
    {
      expr: '(p ∨ q) ∧ r',
      equivalents: ['(p ∧ r) ∨ (q ∧ r)'],
      nonEquivalents: ['p ∨ (q ∧ r)', '(p ∧ q) ∨ r', 'p ∨ q ∨ r'],
    },
    {
      expr: '¬(p ↔ q)',
      equivalents: ['p ⊕ q'],
      nonEquivalents: ['p ↔ ¬q', '¬p ∧ ¬q', 'p ∧ ¬q'],
    },
    {
      expr: 'p ∧ (q ∨ ¬q)',
      equivalents: ['p'],
      nonEquivalents: ['p ∨ q', 'p ∧ q', 'p ↔ q'],
    },
    {
      expr: 'p ∨ (p ∧ q)',
      equivalents: ['p'],
      nonEquivalents: ['p ∧ q', 'p → q', 'p ↔ q'],
    },
  ],
};

// ── Generator 1: Truth Tables ─────────────────────────────────────────────────

/**
 * Evaluates a logical expression for a specific row of its truth table.
 *
 * Tier 1 (rangeA[0] = 1): simple 2-variable connectives (∧, ∨, →, ↔)
 * Tier 2a+ (rangeA[0] = 2): all templates including negated compounds
 * Tier 3 (rangeA[0] = 3): same pool as tier 2, wider shuffle
 *
 * Question: "In the truth table for p ∧ q, what is the result when p = True and q = False?"
 * Answer: "True" or "False"
 * Distractors: always include "Cannot be determined" and "Both True and False"
 */
export function generateTruthTable(
  params: GeneratorParams,
  rng: () => number,
): MathProblem {
  // Select template pool based on complexity level
  const complexityLevel = params.rangeA[0] ?? 1;
  const templatePool: TruthTemplate[] =
    complexityLevel >= 2
      ? [...SIMPLE_TEMPLATES, ...COMPOUND_TEMPLATES]
      : SIMPLE_TEMPLATES;

  const template = randPick(rng, templatePool);
  const [p, q] = randPick(rng, TRUTH_ROWS);
  const result = template.evaluate(p, q);

  const pStr = p ? 'True' : 'False';
  const qStr = q ? 'True' : 'False';
  const answer = result ? 'True' : 'False';

  const question = `In the truth table for ${template.expr}, what is the result when p = ${pStr} and q = ${qStr}?`;
  const explanation = `Substituting p = ${pStr} and q = ${qStr} into ${template.expr}: result is ${answer}.`;

  // Fixed distractor pool — always includes the two logical-confusion options
  const wrongBool = answer === 'True' ? 'False' : 'True';
  const distCandidates = [
    wrongBool,
    'Cannot be determined',
    'Both True and False',
    'Undefined',
  ];
  const distractors = dedupeDistractors(distCandidates, answer, 4);

  return {
    question,
    correctAnswer: answer,
    acceptableAlternatives: [],
    distractors,
    explanation,
    inputMode: 'choice',
  };
}

// ── Generator 2: Set Operations ───────────────────────────────────────────────

/**
 * Builds set A and set B from the given element value range, ensures ≥1 shared
 * element, then applies a randomly chosen operation from params.operations.
 *
 * Question: "Let A = {1, 2, 3} and B = {2, 3, 4}. What is A ∪ B?"
 * Answer: formatSet result, e.g. "{1, 2, 3, 4}" or "∅"
 * Distractors: results of wrong operations + off-by-one variants
 */
export function generateSetOperations(
  params: GeneratorParams,
  rng: () => number,
): MathProblem {
  const ops = params.operations ?? ['union', 'intersection'];
  const min = params.rangeA[0];
  const max = params.rangeA[1];

  // Build a candidate pool of integers in the range
  const pool: number[] = [];
  for (let v = min; v <= max; v++) pool.push(v);

  // Shuffle pool
  const shuffled = [...pool].sort(() => rng() - 0.5);

  // Guarantee at least 1 shared element
  const sharedCount = 1 + Math.floor(rng() * 2); // 1 or 2 shared
  const shared = shuffled.slice(0, sharedCount);
  const rest = shuffled.slice(sharedCount);

  const aOnlyCount = 1 + Math.floor(rng() * 2);
  const bOnlyCount = 1 + Math.floor(rng() * 2);
  const aOnly = rest.slice(0, aOnlyCount);
  const bOnly = rest.slice(aOnlyCount, aOnlyCount + bOnlyCount);

  const setA = [...shared, ...aOnly];
  const setB = [...shared, ...bOnly];

  // Apply chosen operation
  const op = randPick(rng, ops);

  let resultArr: number[];
  let opSymbol: string;
  let opName: string;

  switch (op) {
    case 'intersection':
      resultArr = setA.filter(v => setB.includes(v));
      opSymbol = '∩';
      opName = 'A ∩ B';
      break;
    case 'difference':
      resultArr = setA.filter(v => !setB.includes(v));
      opSymbol = '−';
      opName = 'A − B';
      break;
    case 'symmetric_difference':
      resultArr = [
        ...setA.filter(v => !setB.includes(v)),
        ...setB.filter(v => !setA.includes(v)),
      ];
      opSymbol = '△';
      opName = 'A △ B';
      break;
    case 'union':
    default:
      resultArr = [...new Set([...setA, ...setB])];
      opSymbol = '∪';
      opName = 'A ∪ B';
      break;
  }

  const answer = formatSet(resultArr);

  // Build distractors from wrong operations
  const unionArr  = [...new Set([...setA, ...setB])];
  const interArr  = setA.filter(v => setB.includes(v));
  const diffArr   = setA.filter(v => !setB.includes(v));
  const symDiffArr = [
    ...setA.filter(v => !setB.includes(v)),
    ...setB.filter(v => !setA.includes(v)),
  ];

  const distCandidates: string[] = [
    formatSet(unionArr),
    formatSet(interArr),
    formatSet(diffArr),
    formatSet(symDiffArr),
    formatSet(setA),  // "only A" (forgot B)
    formatSet(setB),  // "only B" (forgot A)
  ];

  const distractors = dedupeDistractors(distCandidates, answer, 4);

  const question = `Let A = ${formatSet(setA)} and B = ${formatSet(setB)}. What is ${opName}?`;
  const explanation = `${opName}: Apply the ${opSymbol} operation to A and B to get ${answer}.`;

  return {
    question,
    correctAnswer: answer,
    acceptableAlternatives: [],
    distractors,
    explanation,
    inputMode: 'choice',
  };
}

// ── Generator 3: Venn Diagrams ────────────────────────────────────────────────

/**
 * Applies inclusion-exclusion principles to Venn diagram problems.
 *
 * Mode is selected by params.steps:
 *   steps = 1 (or undefined): 2-set union formula |A∪B| = |A| + |B| − |A∩B|
 *   steps = 2: reverse-solve — find |B| given |A|, |A∩B|, |A∪B|
 *   steps = 3: 3-set formula |A∪B∪C| = |A|+|B|+|C|−|A∩B|−|B∩C|−|A∩C|+|A∩B∩C|
 *   steps = 4: find specific region (elements in A only)
 *
 * Question: "If |A| = 10, |B| = 8, |A∩B| = 3, find |A∪B|."
 * Answer: positive integer string
 * Distractors: ± 1, ± 2, |A|+|B| (forgot subtraction), |A∩B| alone
 */
export function generateVennDiagram(
  params: GeneratorParams,
  rng: () => number,
): MathProblem {
  const mode = params.steps ?? 1;
  const sizeMin = params.rangeA[0];
  const sizeMax = params.rangeA[1];
  const intMin  = params.rangeB[0];
  const intMax  = params.rangeB[1];

  if (mode === 2) {
    // Reverse-solve: find |B| given |A|, |A∩B|, |A∪B|
    const sizeA = randInt(rng, sizeMin, sizeMax);
    const inter = randInt(rng, intMin, Math.min(intMax, sizeA - 1));
    // |A∪B| must be > |A| to make |B| > 0
    const union = sizeA + randInt(rng, sizeA, Math.min(sizeA * 2, sizeMax + sizeA));
    // |B| = |A∪B| − |A| + |A∩B|
    const sizeB = union - sizeA + inter;
    const answer = String(sizeB);

    const distCandidates = [
      String(sizeB + 1),
      String(sizeB - 1),
      String(sizeB + 2),
      String(sizeB - 2),
      String(union - sizeA),     // forgot to add intersection back
      String(inter),             // just the intersection
    ].filter(s => Number(s) > 0 && s !== answer);

    const distractors = dedupeDistractors(distCandidates, answer, 4);

    return {
      question: `If |A| = ${sizeA}, |A∩B| = ${inter}, and |A∪B| = ${union}, find |B|.`,
      correctAnswer: answer,
      acceptableAlternatives: [],
      distractors,
      explanation: `|B| = |A∪B| − |A| + |A∩B| = ${union} − ${sizeA} + ${inter} = ${sizeB}`,
      inputMode: 'choice',
    };
  }

  if (mode === 3) {
    // 3-set formula: |A∪B∪C| = |A|+|B|+|C| − |A∩B| − |B∩C| − |A∩C| + |A∩B∩C|
    const sA = randInt(rng, sizeMin, sizeMax);
    const sB = randInt(rng, sizeMin, sizeMax);
    const sC = randInt(rng, sizeMin, sizeMax);
    const iAB = randInt(rng, intMin, Math.min(intMax, sA, sB));
    const iBC = randInt(rng, intMin, Math.min(intMax, sB, sC));
    const iAC = randInt(rng, intMin, Math.min(intMax, sA, sC));
    const iABC = randInt(rng, 1, Math.min(iAB, iBC, iAC));
    const union3 = sA + sB + sC - iAB - iBC - iAC + iABC;
    const answer = String(union3);

    const sum3 = sA + sB + sC;
    const distCandidates = [
      String(union3 + 1),
      String(union3 - 1),
      String(union3 + 2),
      String(sum3),              // forgot pairwise subtractions
      String(sum3 - iAB - iBC - iAC), // forgot to add triple back
    ].filter(s => Number(s) > 0 && s !== answer);

    const distractors = dedupeDistractors(distCandidates, answer, 4);
    const explanation =
      `|A∪B∪C| = ${sA}+${sB}+${sC}−${iAB}−${iBC}−${iAC}+${iABC} = ${union3}`;

    return {
      question:
        `If |A| = ${sA}, |B| = ${sB}, |C| = ${sC}, |A∩B| = ${iAB}, ` +
        `|B∩C| = ${iBC}, |A∩C| = ${iAC}, |A∩B∩C| = ${iABC}, find |A∪B∪C|.`,
      correctAnswer: answer,
      acceptableAlternatives: [],
      distractors,
      explanation,
      inputMode: 'choice',
    };
  }

  if (mode === 4) {
    // Specific region: elements in A only (not in B)
    // |A only| = |A| − |A∩B|
    const sA = randInt(rng, sizeMin, sizeMax);
    const sB = randInt(rng, sizeMin, sizeMax);
    const inter = randInt(rng, intMin, Math.min(intMax, sA - 1, sB));
    const aOnly = sA - inter;
    const answer = String(aOnly);

    const distCandidates = [
      String(aOnly + 1),
      String(aOnly - 1 > 0 ? aOnly - 1 : aOnly + 2),
      String(sA),          // forgot to subtract intersection
      String(inter),       // just the intersection
      String(sA + sB - inter), // full union instead
    ].filter(s => Number(s) >= 0 && s !== answer);

    const distractors = dedupeDistractors(distCandidates, answer, 4);

    return {
      question: `A Venn diagram shows |A| = ${sA}, |B| = ${sB}, |A∩B| = ${inter}. How many elements are in A only (not in B)?`,
      correctAnswer: answer,
      acceptableAlternatives: [],
      distractors,
      explanation: `Elements in A only = |A| − |A∩B| = ${sA} − ${inter} = ${aOnly}`,
      inputMode: 'choice',
    };
  }

  // Default / mode 1: find |A∪B|
  const sA = randInt(rng, sizeMin, sizeMax);
  const sB = randInt(rng, sizeMin, sizeMax);
  const inter = randInt(rng, intMin, Math.min(intMax, sA, sB));
  const union2 = sA + sB - inter;
  const answer = String(union2);

  const distCandidates = [
    String(union2 + 1),
    String(union2 - 1),
    String(union2 + 2),
    String(sA + sB),   // forgot to subtract intersection
    String(inter),     // just intersection
    String(sA),        // just A
    String(sB),        // just B
  ].filter(s => Number(s) > 0 && s !== answer);

  const distractors = dedupeDistractors(distCandidates, answer, 4);

  return {
    question: `If |A| = ${sA}, |B| = ${sB}, and |A∩B| = ${inter}, find |A∪B|.`,
    correctAnswer: answer,
    acceptableAlternatives: [],
    distractors,
    explanation: `|A∪B| = |A| + |B| − |A∩B| = ${sA} + ${sB} − ${inter} = ${union2}`,
    inputMode: 'choice',
  };
}

// ── Generator 4: Logical Equivalence ─────────────────────────────────────────

/**
 * Presents a logical expression and asks which alternative is equivalent.
 *
 * Uses EQUIVALENCE_POOL curated by tier (rangeA[0] selects the pool):
 *   1 → tier1 (commutativity, De Morgan's), 2 → tier2 (contrapositive,
 *   biconditional), 3 → tier3 (distribution, absorption, XOR)
 *
 * Question: "Which expression is logically equivalent to p → q?"
 * Answer: one of the equivalents[], e.g. "¬p ∨ q"
 * Distractors: nonEquivalents from the same entry, padded if needed
 */
export function generateLogicalEquivalence(
  params: GeneratorParams,
  rng: () => number,
): MathProblem {
  const tierLevel = params.rangeA[0] ?? 1;
  const poolKey =
    tierLevel >= 3 ? 'tier3' :
    tierLevel >= 2 ? 'tier2' :
    'tier1';

  const pool = EQUIVALENCE_POOL[poolKey];
  const entry = randPick(rng, pool);

  // Correct answer is the first (or randomly picked) equivalent
  const answer = randPick(rng, entry.equivalents);

  // Distractors: non-equivalents from this entry, shuffled
  const shuffledNonEq = [...entry.nonEquivalents].sort(() => rng() - 0.5);
  const distCandidates: string[] = [...shuffledNonEq];

  // Pad from other tiers if needed
  const fallbackPools = ['tier1', 'tier2', 'tier3'].filter(k => k !== poolKey);
  for (const fallbackKey of fallbackPools) {
    for (const fallbackEntry of EQUIVALENCE_POOL[fallbackKey]) {
      for (const ne of fallbackEntry.nonEquivalents) {
        if (!distCandidates.includes(ne) && ne !== answer) {
          distCandidates.push(ne);
        }
      }
    }
  }

  const distractors = dedupeDistractors(distCandidates, answer, 4);

  return {
    question: `Which expression is logically equivalent to ${entry.expr}?`,
    correctAnswer: answer,
    acceptableAlternatives: entry.equivalents.filter(e => e !== answer),
    distractors,
    explanation: `${entry.expr} ≡ ${answer} (logical equivalence rule)`,
    inputMode: 'choice',
  };
}

// ── Generator 5: Set Cardinality ──────────────────────────────────────────────

/**
 * Counts set members using divisibility and inclusion-exclusion principles.
 *
 * Mode is selected by params.steps:
 *   steps = 1 (or undefined): floor(n/k) — "How many multiples of k in {1..n}?"
 *   steps = 2: 2-set inclusion-exclusion — divisible by a or b in {1..n}
 *   steps = 3: power set — "A set has n elements. How many subsets?"  → 2^n
 *   steps = 4: 3-set inclusion-exclusion — divisible by a, b, or c in {1..n}
 *
 * Answer: positive integer string
 */
export function generateSetCardinality(
  params: GeneratorParams,
  rng: () => number,
): MathProblem {
  const mode = params.steps ?? 1;
  const nMin = params.rangeA[0];
  const nMax = params.rangeA[1];
  const kMin = params.rangeB[0];
  const kMax = params.rangeB[1];

  if (mode === 2) {
    // 2-set inclusion-exclusion: |multiples of a| + |multiples of b| − |multiples of lcm(a,b)|
    const n = randInt(rng, nMin, nMax);
    const a = randInt(rng, kMin, kMax);
    let b = randInt(rng, kMin, kMax);
    // Ensure b ≠ a and gcd(a,b) ≠ max (to avoid trivial cases)
    let attempts = 0;
    while ((b === a || b % a === 0 || a % b === 0) && attempts < 20) {
      b = randInt(rng, kMin, kMax);
      attempts++;
    }
    if (b === a) b = a + 1;

    const nA   = Math.floor(n / a);
    const nB   = Math.floor(n / b);
    const nLcm = Math.floor(n / lcm(a, b));
    const answer = nA + nB - nLcm;
    const answerStr = String(answer);

    const distCandidates = [
      String(nA + nB),        // forgot to subtract LCM count
      String(nA),             // only a
      String(nB),             // only b
      String(nA + nB + 1),
      String(Math.max(1, answer - 1)),
      String(answer + 1),
    ].filter(s => Number(s) >= 0 && s !== answerStr);

    const distractors = dedupeDistractors(distCandidates, answerStr, 4);

    return {
      question: `How many integers from 1 to ${n} are divisible by ${a} or ${b}?`,
      correctAnswer: answerStr,
      acceptableAlternatives: [],
      distractors,
      explanation:
        `Multiples of ${a}: ⌊${n}/${a}⌋ = ${nA}. Multiples of ${b}: ⌊${n}/${b}⌋ = ${nB}. ` +
        `Multiples of lcm(${a},${b}) = ${lcm(a,b)}: ⌊${n}/${lcm(a,b)}⌋ = ${nLcm}. ` +
        `Total = ${nA} + ${nB} − ${nLcm} = ${answer}`,
      inputMode: 'choice',
    };
  }

  if (mode === 3) {
    // Power set: 2^n subsets
    const n = randInt(rng, nMin, nMax);
    const answer = Math.pow(2, n);
    const answerStr = String(answer);

    const distCandidates = [
      String(n * 2),           // 2n (forgot exponentiation)
      String(n * n),           // n² (confused with something else)
      String(answer - 1),      // forgot to include empty set
      String(answer + 1),
      String(n),               // just n
    ].filter(s => s !== answerStr);

    const distractors = dedupeDistractors(distCandidates, answerStr, 4);

    return {
      question: `A set has ${n} elements. How many subsets does it have (including the empty set)?`,
      correctAnswer: answerStr,
      acceptableAlternatives: [],
      distractors,
      explanation: `The power set of an n-element set has 2^n subsets. 2^${n} = ${answer}`,
      inputMode: 'choice',
    };
  }

  if (mode === 4) {
    // 3-set inclusion-exclusion: divisible by a, b, or c in 1..n
    const n = randInt(rng, nMin, nMax);
    const a = randInt(rng, kMin, kMax);
    let b = randInt(rng, kMin, kMax);
    let c = randInt(rng, kMin, kMax);

    // Ensure all three are distinct and not multiples of each other
    let att = 0;
    while ((b === a || b % a === 0 || a % b === 0) && att < 15) {
      b = randInt(rng, kMin, kMax);
      att++;
    }
    if (b === a) b = a + 1;
    att = 0;
    while ((c === a || c === b || c % a === 0 || c % b === 0 || a % c === 0 || b % c === 0) && att < 15) {
      c = randInt(rng, kMin, kMax);
      att++;
    }
    if (c === a || c === b) c = Math.max(a, b) + 1;

    const nA    = Math.floor(n / a);
    const nB    = Math.floor(n / b);
    const nC    = Math.floor(n / c);
    const nAB   = Math.floor(n / lcm(a, b));
    const nBC   = Math.floor(n / lcm(b, c));
    const nAC   = Math.floor(n / lcm(a, c));
    const nABC  = Math.floor(n / lcm(lcm(a, b), c));
    const answer = nA + nB + nC - nAB - nBC - nAC + nABC;
    const answerStr = String(answer);

    const sumRaw = nA + nB + nC;
    const distCandidates = [
      String(sumRaw),                          // forgot pairwise subtractions
      String(sumRaw - nAB - nBC - nAC),        // forgot to add triple back
      String(answer + 1),
      String(Math.max(1, answer - 1)),
      String(nA + nB),                         // forgot C
    ].filter(s => Number(s) >= 0 && s !== answerStr);

    const distractors = dedupeDistractors(distCandidates, answerStr, 4);

    return {
      question: `How many integers from 1 to ${n} are divisible by ${a}, ${b}, or ${c}?`,
      correctAnswer: answerStr,
      acceptableAlternatives: [],
      distractors,
      explanation:
        `Using inclusion-exclusion: ` +
        `${nA}+${nB}+${nC}−${nAB}−${nBC}−${nAC}+${nABC} = ${answer}`,
      inputMode: 'choice',
    };
  }

  // Default / mode 1: floor(n/k)
  const n = randInt(rng, nMin, nMax);
  const k = randInt(rng, Math.max(kMin, 2), kMax);
  const answer = Math.floor(n / k);
  const answerStr = String(answer);

  const distCandidates = [
    String(answer + 1),
    String(Math.max(0, answer - 1)),
    String(answer + 2),
    String(Math.max(0, answer - 2)),
    String(n),     // forgot to divide (just n)
    String(k),     // just k
  ].filter(s => s !== answerStr);

  const distractors = dedupeDistractors(distCandidates, answerStr, 4);

  return {
    question: `How many multiples of ${k} are there in the set {1, 2, ..., ${n}}?`,
    correctAnswer: answerStr,
    acceptableAlternatives: [],
    distractors,
    explanation: `Multiples of ${k} up to ${n}: ⌊${n}/${k}⌋ = ${answer}`,
    inputMode: 'choice',
  };
}
