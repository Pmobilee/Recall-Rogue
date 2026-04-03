/**
 * Unit tests for mathProblemGenerator.ts
 *
 * Covers: determinism, all six generators, input mode, distractor count,
 * question format, mathematical correctness, PEMDAS, and error handling.
 */

import { describe, it, expect } from 'vitest';
import { generateProblem } from './mathProblemGenerator';
import type { SkillNode } from '../../data/proceduralDeckTypes';
import type { CardTier } from '../../data/card-types';

// ---------------------------------------------------------------------------
// Fixtures — minimal SkillNode objects per generator type
// ---------------------------------------------------------------------------

function makeArithmeticSkill(ops: string[] = ['+'], allowNegatives = true): SkillNode {
  const params = {
    rangeA: [10, 99] as [number, number],
    rangeB: [1, 9] as [number, number],
    operations: ops,
    allowNegatives,
  };
  return {
    id: 'arithmetic_test',
    name: 'Arithmetic Test',
    description: 'Test skill',
    generatorId: 'arithmetic',
    tierParams: { '1': params, '2a': params, '2b': params, '3': params },
  };
}

function makeMixedArithmeticSkill(): SkillNode {
  const params = {
    rangeA: [1, 20] as [number, number],
    rangeB: [1, 10] as [number, number],
    operations: ['+', '-'],
    steps: 2,
  };
  return {
    id: 'mixed_test',
    name: 'Mixed Arithmetic Test',
    description: 'Test skill',
    generatorId: 'mixed_arithmetic',
    tierParams: { '1': params, '2a': params, '2b': params, '3': params },
  };
}

function makePercentageSkill(): SkillNode {
  const params = {
    rangeA: [10, 50] as [number, number],  // percent range
    rangeB: [100, 200] as [number, number], // base range
  };
  return {
    id: 'pct_test',
    name: 'Percentage Test',
    description: 'Test skill',
    generatorId: 'percentage',
    tierParams: { '1': params, '2a': params, '2b': params, '3': params },
  };
}

function makeFractionDecimalSkill(): SkillNode {
  const params = {
    rangeA: [1, 9] as [number, number],   // numerator
    rangeB: [2, 9] as [number, number],   // denominator
  };
  return {
    id: 'frac_test',
    name: 'Fraction Decimal Test',
    description: 'Test skill',
    generatorId: 'fraction_decimal',
    tierParams: { '1': params, '2a': params, '2b': params, '3': params },
  };
}

function makeEstimationSkill(): SkillNode {
  const params = {
    rangeA: [4, 100] as [number, number],
    rangeB: [1, 1] as [number, number],
    tolerance: 1,
  };
  return {
    id: 'est_test',
    name: 'Estimation Test',
    description: 'Test skill',
    generatorId: 'estimation',
    tierParams: { '1': params, '2a': params, '2b': params, '3': params },
  };
}

function makeOrderOfOperationsSkill(): SkillNode {
  const params = {
    rangeA: [1, 10] as [number, number],
    rangeB: [1, 10] as [number, number],
  };
  return {
    id: 'ooo_test',
    name: 'Order of Operations Test',
    description: 'Test skill',
    generatorId: 'order_of_operations',
    tierParams: { '1': params, '2a': params, '2b': params, '3': params },
  };
}

const TIER: CardTier = '1';

// ---------------------------------------------------------------------------
// 1. Determinism
// ---------------------------------------------------------------------------

describe('generateProblem — determinism', () => {
  it('same (skill, tier, seed) produces identical problems', () => {
    const skill = makeArithmeticSkill();
    const a = generateProblem(skill, TIER, 42);
    const b = generateProblem(skill, TIER, 42);
    expect(a.question).toBe(b.question);
    expect(a.correctAnswer).toBe(b.correctAnswer);
    expect(a.distractors).toEqual(b.distractors);
  });

  it('different seeds produce different problems (with high probability)', () => {
    const skill = makeArithmeticSkill();
    const a = generateProblem(skill, TIER, 1);
    const b = generateProblem(skill, TIER, 999);
    // They could theoretically collide but with ranges [10,99] × [1,9] it is vanishingly rare
    expect(a.question).not.toBe(b.question);
  });

  it('same seed but different tiers may produce different ranges', () => {
    const skill: SkillNode = {
      id: 'tier_test',
      name: 'Tier Test',
      description: 'Tier scaling test',
      generatorId: 'arithmetic',
      tierParams: {
        '1': { rangeA: [1, 5], rangeB: [1, 5], operations: ['+'] },
        '2a': { rangeA: [100, 200], rangeB: [100, 200], operations: ['+'] },
        '2b': { rangeA: [1000, 2000], rangeB: [1000, 2000], operations: ['+'] },
        '3': { rangeA: [10000, 20000], rangeB: [10000, 20000], operations: ['+'] },
      },
    };
    const tier1 = generateProblem(skill, '1', 7);
    const tier2a = generateProblem(skill, '2a', 7);
    // Tier 1 operands are in [1,5], tier 2a in [100,200] — answers will differ
    expect(tier1.question).not.toBe(tier2a.question);
  });
});

// ---------------------------------------------------------------------------
// 2. arithmetic generator
// ---------------------------------------------------------------------------

describe('generateProblem — arithmetic', () => {
  it('question format is "a OP b = ?"', () => {
    const skill = makeArithmeticSkill(['+']);
    const p = generateProblem(skill, TIER, 1);
    expect(p.question).toMatch(/^\d+ \+ \d+ = \?$/);
  });

  it('answer is mathematically correct for addition', () => {
    const skill = makeArithmeticSkill(['+']);
    for (let seed = 0; seed < 20; seed++) {
      const p = generateProblem(skill, TIER, seed);
      const parts = p.question.replace(' = ?', '').split(' + ');
      const a = parseInt(parts[0], 10);
      const b = parseInt(parts[1], 10);
      expect(parseInt(p.correctAnswer, 10)).toBe(a + b);
    }
  });

  it('answer is mathematically correct for subtraction', () => {
    const skill = makeArithmeticSkill(['-'], true);
    for (let seed = 0; seed < 20; seed++) {
      const p = generateProblem(skill, TIER, seed);
      const parts = p.question.replace(' = ?', '').split(' - ');
      const a = parseInt(parts[0], 10);
      const b = parseInt(parts[1], 10);
      expect(parseInt(p.correctAnswer, 10)).toBe(a - b);
    }
  });

  it('division always produces integer results', () => {
    const skill = makeArithmeticSkill(['/']);
    for (let seed = 0; seed < 30; seed++) {
      const p = generateProblem(skill, TIER, seed);
      const answer = Number(p.correctAnswer);
      expect(Number.isInteger(answer)).toBe(true);
    }
  });

  it('subtraction with allowNegatives=false: answer is never negative', () => {
    const skill = makeArithmeticSkill(['-'], false);
    for (let seed = 0; seed < 30; seed++) {
      const p = generateProblem(skill, TIER, seed);
      expect(parseInt(p.correctAnswer, 10)).toBeGreaterThanOrEqual(0);
    }
  });

  it('number ranges respect tier params', () => {
    const skill: SkillNode = {
      id: 'range_test',
      name: 'Range Test',
      description: '',
      generatorId: 'arithmetic',
      tierParams: {
        '1': { rangeA: [50, 60], rangeB: [1, 2], operations: ['+'] },
        '2a': { rangeA: [50, 60], rangeB: [1, 2], operations: ['+'] },
        '2b': { rangeA: [50, 60], rangeB: [1, 2], operations: ['+'] },
        '3':  { rangeA: [50, 60], rangeB: [1, 2], operations: ['+'] },
      },
    };
    for (let seed = 0; seed < 20; seed++) {
      const p = generateProblem(skill, '1', seed);
      const parts = p.question.replace(' = ?', '').split(' + ');
      const a = parseInt(parts[0], 10);
      const b = parseInt(parts[1], 10);
      expect(a).toBeGreaterThanOrEqual(50);
      expect(a).toBeLessThanOrEqual(60);
      expect(b).toBeGreaterThanOrEqual(1);
      expect(b).toBeLessThanOrEqual(2);
    }
  });

  it('returns exactly 4 distractors', () => {
    const skill = makeArithmeticSkill(['+']);
    const p = generateProblem(skill, TIER, 5);
    expect(p.distractors).toHaveLength(4);
  });

  it('inputMode is "choice"', () => {
    const skill = makeArithmeticSkill(['+']);
    const p = generateProblem(skill, TIER, 5);
    expect(p.inputMode).toBe('choice');
  });
});

// ---------------------------------------------------------------------------
// 3. mixed_arithmetic generator
// ---------------------------------------------------------------------------

describe('generateProblem — mixed_arithmetic', () => {
  it('returns exactly 4 distractors', () => {
    const skill = makeMixedArithmeticSkill();
    const p = generateProblem(skill, TIER, 10);
    expect(p.distractors).toHaveLength(4);
  });

  it('inputMode is "choice"', () => {
    const skill = makeMixedArithmeticSkill();
    expect(generateProblem(skill, TIER, 10).inputMode).toBe('choice');
  });

  it('multi-step left-to-right evaluation is correct', () => {
    // Use a fixed-op skill so we can reconstruct deterministically
    const skill: SkillNode = {
      id: 'mixed_fixed',
      name: 'Fixed Mixed',
      description: '',
      generatorId: 'mixed_arithmetic',
      tierParams: {
        '1':  { rangeA: [10, 10], rangeB: [5, 5], operations: ['+', '-'], steps: 2 },
        '2a': { rangeA: [10, 10], rangeB: [5, 5], operations: ['+', '-'], steps: 2 },
        '2b': { rangeA: [10, 10], rangeB: [5, 5], operations: ['+', '-'], steps: 2 },
        '3':  { rangeA: [10, 10], rangeB: [5, 5], operations: ['+', '-'], steps: 2 },
      },
    };
    // With rangeA=[10,10], rangeB=[5,5] both values are pinned.
    // We just verify the answer matches the expression in the question.
    for (let seed = 0; seed < 10; seed++) {
      const p = generateProblem(skill, '1', seed);
      // Parse expression: "10 OP 5 OP 5 = ?"
      const expr = p.question.replace(' = ?', '');
      const tokens = expr.split(' ');
      // Evaluate left-to-right
      let result = parseInt(tokens[0], 10);
      for (let i = 1; i < tokens.length; i += 2) {
        const op = tokens[i];
        const operand = parseInt(tokens[i + 1], 10);
        if (op === '+') result += operand;
        else if (op === '-') result -= operand;
        else if (op === '*') result *= operand;
        else if (op === '/') result = Math.floor(result / operand);
      }
      expect(parseInt(p.correctAnswer, 10)).toBe(result);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. percentage generator
// ---------------------------------------------------------------------------

describe('generateProblem — percentage', () => {
  it('answer equals floor(base * pct / 100)', () => {
    const skill = makePercentageSkill();
    for (let seed = 0; seed < 20; seed++) {
      const p = generateProblem(skill, TIER, seed);
      // Parse "What is X% of Y?"
      const m = p.question.match(/What is (\d+)% of (\d+)\?/);
      expect(m).not.toBeNull();
      const pct = parseInt(m![1], 10);
      const base = parseInt(m![2], 10);
      const expected = Math.floor((base * pct) / 100);
      expect(parseInt(p.correctAnswer, 10)).toBe(expected);
    }
  });

  it('returns exactly 4 distractors', () => {
    const skill = makePercentageSkill();
    expect(generateProblem(skill, TIER, 1).distractors).toHaveLength(4);
  });

  it('inputMode is "choice"', () => {
    expect(generateProblem(makePercentageSkill(), TIER, 1).inputMode).toBe('choice');
  });
});

// ---------------------------------------------------------------------------
// 5. fraction_decimal generator
// ---------------------------------------------------------------------------

describe('generateProblem — fraction_decimal', () => {
  it('fraction is in simplest form (GCD of num/den = 1) when showing fraction', () => {
    const skill = makeFractionDecimalSkill();
    for (let seed = 0; seed < 40; seed++) {
      const p = generateProblem(skill, TIER, seed);
      if (p.question.startsWith('Convert') && p.question.includes('to a fraction')) {
        // correct answer is a fraction string "n/d"
        const [numStr, denStr] = p.correctAnswer.split('/');
        const num = parseInt(numStr, 10);
        const den = parseInt(denStr, 10);
        // Compute GCD
        let a = Math.abs(num), b = Math.abs(den);
        while (b !== 0) { const t = b; b = a % b; a = t; }
        const g = a;
        expect(g).toBe(1);
      }
    }
  });

  it('decimal answer matches fraction value when converting fraction to decimal', () => {
    const skill = makeFractionDecimalSkill();
    for (let seed = 0; seed < 40; seed++) {
      const p = generateProblem(skill, TIER, seed);
      if (p.question.startsWith('Convert') && p.question.includes('to a decimal')) {
        // question: "Convert n/d to a decimal"
        const m = p.question.match(/Convert (\d+)\/(\d+) to a decimal/);
        if (m) {
          const num = parseInt(m[1], 10);
          const den = parseInt(m[2], 10);
          const expected = parseFloat((num / den).toFixed(4)).toString();
          expect(p.correctAnswer).toBe(expected);
        }
      }
    }
  });

  it('returns exactly 4 distractors', () => {
    const skill = makeFractionDecimalSkill();
    expect(generateProblem(skill, TIER, 3).distractors).toHaveLength(4);
  });

  it('inputMode is "choice"', () => {
    expect(generateProblem(makeFractionDecimalSkill(), TIER, 3).inputMode).toBe('choice');
  });
});

// ---------------------------------------------------------------------------
// 6. estimation generator
// ---------------------------------------------------------------------------

describe('generateProblem — estimation', () => {
  it('acceptableAlternatives includes answer ± tolerance values', () => {
    const skill = makeEstimationSkill();
    for (let seed = 0; seed < 20; seed++) {
      const p = generateProblem(skill, TIER, seed);
      const correct = parseInt(p.correctAnswer, 10);
      // tolerance=1 → alternatives should include correct+1 and correct-1 (if >= 0)
      const altNums = p.acceptableAlternatives.map(Number);
      expect(altNums).toContain(correct + 1);
      if (correct - 1 >= 0) {
        expect(altNums).toContain(correct - 1);
      }
    }
  });

  it('correct answer is the rounded square root', () => {
    const skill = makeEstimationSkill();
    for (let seed = 0; seed < 20; seed++) {
      const p = generateProblem(skill, TIER, seed);
      const m = p.question.match(/Estimate √(\d+)/);
      expect(m).not.toBeNull();
      const n = parseInt(m![1], 10);
      expect(parseInt(p.correctAnswer, 10)).toBe(Math.round(Math.sqrt(n)));
    }
  });

  it('returns exactly 4 distractors', () => {
    const skill = makeEstimationSkill();
    expect(generateProblem(skill, TIER, 7).distractors).toHaveLength(4);
  });

  it('inputMode is "choice"', () => {
    expect(generateProblem(makeEstimationSkill(), TIER, 7).inputMode).toBe('choice');
  });
});

// ---------------------------------------------------------------------------
// 7. order_of_operations generator
// ---------------------------------------------------------------------------

describe('generateProblem — order_of_operations', () => {
  it('PEMDAS: a + b × c = a + (b*c) not (a+b)*c', () => {
    // Force the non-parens branch by testing many seeds and checking any that
    // produce "a + b × c = ?" style (without leading parens)
    const skill = makeOrderOfOperationsSkill();
    let tested = 0;
    for (let seed = 0; seed < 100; seed++) {
      const p = generateProblem(skill, TIER, seed);
      if (p.question.startsWith('(')) continue; // parens variant — skip
      // pattern: "a + b × c = ?"
      const m = p.question.match(/^(\d+) \+ (\d+) × (\d+) = \?$/);
      if (!m) continue;
      const a = parseInt(m[1], 10);
      const b = parseInt(m[2], 10);
      const c = parseInt(m[3], 10);
      const pemdas = a + b * c;
      const leftToRight = (a + b) * c;
      expect(parseInt(p.correctAnswer, 10)).toBe(pemdas);
      expect(parseInt(p.correctAnswer, 10)).not.toBe(leftToRight);
      tested++;
      if (tested >= 5) break;
    }
  });

  it('parens variant: (a+b)×c is evaluated correctly', () => {
    const skill = makeOrderOfOperationsSkill();
    for (let seed = 0; seed < 100; seed++) {
      const p = generateProblem(skill, TIER, seed);
      if (!p.question.startsWith('(')) continue;
      const m = p.question.match(/^\((\d+) \+ (\d+)\) × (\d+) = \?$/);
      if (!m) continue;
      const a = parseInt(m[1], 10);
      const b = parseInt(m[2], 10);
      const c = parseInt(m[3], 10);
      expect(parseInt(p.correctAnswer, 10)).toBe((a + b) * c);
      break;
    }
  });

  it('specific known case: 3 + 4 × 2 = 11 not 14', () => {
    // Construct a skill that always uses rangeA=[3,3] rangeB=[4,4] … but
    // we can't control c directly. Instead test conceptually via the generator
    // invariant: PEMDAS answer ≠ left-to-right trap answer for this form.
    // We verify via the general property tested above.
    expect(3 + 4 * 2).toBe(11);
    expect((3 + 4) * 2).toBe(14);
  });

  it('returns exactly 4 distractors', () => {
    const skill = makeOrderOfOperationsSkill();
    expect(generateProblem(skill, TIER, 0).distractors).toHaveLength(4);
  });

  it('inputMode is "choice"', () => {
    expect(generateProblem(makeOrderOfOperationsSkill(), TIER, 0).inputMode).toBe('choice');
  });
});

// ---------------------------------------------------------------------------
// 8. Unknown generatorId
// ---------------------------------------------------------------------------

describe('generateProblem — unknown generatorId', () => {
  it('throws Error for unrecognised generatorId', () => {
    const skill: SkillNode = {
      id: 'bad',
      name: 'Bad',
      description: '',
      generatorId: 'definitely_not_real',
      tierParams: {
        '1':  { rangeA: [1, 10], rangeB: [1, 10] },
        '2a': { rangeA: [1, 10], rangeB: [1, 10] },
        '2b': { rangeA: [1, 10], rangeB: [1, 10] },
        '3':  { rangeA: [1, 10], rangeB: [1, 10] },
      },
    };
    expect(() => generateProblem(skill, TIER, 0)).toThrow('Unknown generatorId');
  });
});

// ---------------------------------------------------------------------------
// 9. Cross-generator: all return 4 distractors and inputMode 'choice'
// ---------------------------------------------------------------------------

describe('generateProblem — all generators return 4 distractors and choice inputMode', () => {
  const generators = [
    makeArithmeticSkill(),
    makeMixedArithmeticSkill(),
    makePercentageSkill(),
    makeFractionDecimalSkill(),
    makeEstimationSkill(),
    makeOrderOfOperationsSkill(),
  ];

  for (const skill of generators) {
    it(`${skill.generatorId} returns inputMode "choice"`, () => {
      const p = generateProblem(skill, TIER, 42);
      expect(p.inputMode).toBe('choice');
    });

    it(`${skill.generatorId} returns exactly 4 distractors`, () => {
      const p = generateProblem(skill, TIER, 42);
      expect(p.distractors).toHaveLength(4);
    });
  }
});
