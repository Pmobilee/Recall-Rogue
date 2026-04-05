/**
 * Unit tests for geometryGenerators.ts
 *
 * Covers: determinism, valid MathProblem shape, mathematical correctness,
 * distractor integrity (no distractor equals correct answer), pi-answer format,
 * and integer-answer correctness for all five geometry generators.
 */

import { describe, it, expect } from 'vitest';
import {
  generateArea,
  generatePerimeter,
  generateVolume,
  generateAngleRelationship,
  generatePythagorean,
} from './geometryGenerators';
import { mulberry32 } from './mathUtils';
import type { GeneratorParams } from '../../data/proceduralDeckTypes';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRng(seed: number): () => number {
  return mulberry32(seed);
}

/** Assert MathProblem has the correct structure. */
function assertValidProblem(p: ReturnType<typeof generateArea>): void {
  expect(typeof p.question).toBe('string');
  expect(p.question.length).toBeGreaterThan(0);
  expect(typeof p.correctAnswer).toBe('string');
  expect(p.correctAnswer.length).toBeGreaterThan(0);
  expect(Array.isArray(p.acceptableAlternatives)).toBe(true);
  expect(Array.isArray(p.distractors)).toBe(true);
  expect(p.distractors).toHaveLength(4);
  expect(typeof p.explanation).toBe('string');
  expect(p.inputMode).toBe('choice');
}

/** Assert none of the distractors equal the correct answer. */
function assertNoDistractorEqualsAnswer(p: ReturnType<typeof generateArea>): void {
  for (const d of p.distractors) {
    expect(d).not.toBe(p.correctAnswer);
  }
}

/** Returns true if the string matches the "{N}*pi" or "{N}*pi/3" pattern. */
function isPiAnswer(s: string): boolean {
  return /^-?[\d.]+\*pi(\/3)?$/.test(s);
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const RECT_PARAMS: GeneratorParams = {
  rangeA: [2, 15],
  rangeB: [2, 15],
  shapes: ['rectangle'],
};

const ALL_AREA_SHAPES: GeneratorParams = {
  rangeA: [2, 12],
  rangeB: [2, 12],
  shapes: ['rectangle', 'square', 'triangle', 'circle', 'trapezoid'],
};

const ALL_PERIM_SHAPES: GeneratorParams = {
  rangeA: [2, 15],
  rangeB: [2, 15],
  shapes: ['rectangle', 'square', 'triangle', 'circle'],
};

const ALL_VOL_SHAPES: GeneratorParams = {
  rangeA: [2, 8],
  rangeB: [2, 8],
  shapes: ['cube', 'rectangular_prism', 'cylinder', 'sphere', 'cone'],
};

const ANGLE_ALL_PARAMS: GeneratorParams = {
  rangeA: [20, 120],
  rangeB: [20, 120],
  operations: ['complementary', 'supplementary', 'triangle', 'vertical'],
};

const PYTHAG_PARAMS: GeneratorParams = {
  rangeA: [1, 4],
  rangeB: [1, 4],
};

// ── 1. generateArea ────────────────────────────────────────────────────────────

describe('generateArea — determinism', () => {
  it('same seed produces identical output', () => {
    const p1 = generateArea(RECT_PARAMS, makeRng(42));
    const p2 = generateArea(RECT_PARAMS, makeRng(42));
    expect(p1.question).toBe(p2.question);
    expect(p1.correctAnswer).toBe(p2.correctAnswer);
    expect(p1.distractors).toEqual(p2.distractors);
  });

  it('different seeds produce different problems', () => {
    const p1 = generateArea(RECT_PARAMS, makeRng(1));
    const p2 = generateArea(RECT_PARAMS, makeRng(999));
    expect(p1.question).not.toBe(p2.question);
  });
});

describe('generateArea — rectangle correctness', () => {
  it('returns valid MathProblem', () => {
    for (let seed = 0; seed < 20; seed++) {
      assertValidProblem(generateArea(RECT_PARAMS, makeRng(seed)));
    }
  });

  it('no distractor equals correct answer', () => {
    for (let seed = 0; seed < 20; seed++) {
      assertNoDistractorEqualsAnswer(generateArea(RECT_PARAMS, makeRng(seed)));
    }
  });

  it('answer = length × width (integer)', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateArea(RECT_PARAMS, makeRng(seed));
      const match = p.question.match(/length (\d+) and width (\d+)/);
      if (!match) continue; // may pick a different shape from pool
      const l = parseInt(match[1], 10);
      const w = parseInt(match[2], 10);
      expect(parseInt(p.correctAnswer, 10)).toBe(l * w);
    }
  });
});

describe('generateArea — all shapes', () => {
  it('returns valid MathProblem for all shape types across many seeds', () => {
    for (let seed = 0; seed < 50; seed++) {
      assertValidProblem(generateArea(ALL_AREA_SHAPES, makeRng(seed)));
    }
  });

  it('no distractor equals correct answer for all shapes', () => {
    for (let seed = 0; seed < 50; seed++) {
      assertNoDistractorEqualsAnswer(generateArea(ALL_AREA_SHAPES, makeRng(seed)));
    }
  });

  it('circle area answer matches {N}*pi format', () => {
    const circleParams: GeneratorParams = { rangeA: [2, 10], rangeB: [2, 10], shapes: ['circle'] };
    for (let seed = 0; seed < 20; seed++) {
      const p = generateArea(circleParams, makeRng(seed));
      expect(isPiAnswer(p.correctAnswer)).toBe(true);
    }
  });

  it('triangle area is always a positive integer', () => {
    const triParams: GeneratorParams = { rangeA: [2, 20], rangeB: [2, 20], shapes: ['triangle'] };
    for (let seed = 0; seed < 30; seed++) {
      const p = generateArea(triParams, makeRng(seed));
      const n = parseInt(p.correctAnswer, 10);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThan(0);
    }
  });

  it('trapezoid area is always a positive integer', () => {
    const trapParams: GeneratorParams = { rangeA: [2, 15], rangeB: [2, 15], shapes: ['trapezoid'] };
    for (let seed = 0; seed < 30; seed++) {
      const p = generateArea(trapParams, makeRng(seed));
      const n = parseInt(p.correctAnswer, 10);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThan(0);
    }
  });
});

// ── 2. generatePerimeter ──────────────────────────────────────────────────────

describe('generatePerimeter — determinism', () => {
  it('same seed produces identical output', () => {
    const p1 = generatePerimeter(RECT_PARAMS, makeRng(7));
    const p2 = generatePerimeter(RECT_PARAMS, makeRng(7));
    expect(p1.question).toBe(p2.question);
    expect(p1.correctAnswer).toBe(p2.correctAnswer);
  });
});

describe('generatePerimeter — correctness', () => {
  it('returns valid MathProblem for all shapes', () => {
    for (let seed = 0; seed < 50; seed++) {
      assertValidProblem(generatePerimeter(ALL_PERIM_SHAPES, makeRng(seed)));
    }
  });

  it('no distractor equals correct answer', () => {
    for (let seed = 0; seed < 50; seed++) {
      assertNoDistractorEqualsAnswer(generatePerimeter(ALL_PERIM_SHAPES, makeRng(seed)));
    }
  });

  it('rectangle perimeter = 2*(l+w)', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generatePerimeter(RECT_PARAMS, makeRng(seed));
      const match = p.question.match(/length (\d+) and width (\d+)/);
      if (!match) continue;
      const l = parseInt(match[1], 10);
      const w = parseInt(match[2], 10);
      expect(parseInt(p.correctAnswer, 10)).toBe(2 * (l + w));
    }
  });

  it('circle circumference answer matches {N}*pi format', () => {
    const circleParams: GeneratorParams = { rangeA: [2, 10], rangeB: [2, 10], shapes: ['circle'] };
    for (let seed = 0; seed < 20; seed++) {
      const p = generatePerimeter(circleParams, makeRng(seed));
      expect(isPiAnswer(p.correctAnswer)).toBe(true);
    }
  });

  it('triangle perimeter sides sum correctly', () => {
    const triParams: GeneratorParams = { rangeA: [1, 4], rangeB: [1, 4], shapes: ['triangle'] };
    for (let seed = 0; seed < 20; seed++) {
      const p = generatePerimeter(triParams, makeRng(seed));
      const match = p.question.match(/sides (\d+), (\d+), and (\d+)/);
      if (!match) continue;
      const a = parseInt(match[1], 10);
      const b = parseInt(match[2], 10);
      const cc = parseInt(match[3], 10);
      expect(parseInt(p.correctAnswer, 10)).toBe(a + b + cc);
    }
  });
});

// ── 3. generateVolume ─────────────────────────────────────────────────────────

describe('generateVolume — determinism', () => {
  it('same seed produces identical output', () => {
    const p1 = generateVolume(ALL_VOL_SHAPES, makeRng(13));
    const p2 = generateVolume(ALL_VOL_SHAPES, makeRng(13));
    expect(p1.question).toBe(p2.question);
    expect(p1.correctAnswer).toBe(p2.correctAnswer);
  });
});

describe('generateVolume — correctness', () => {
  it('returns valid MathProblem for all shapes', () => {
    for (let seed = 0; seed < 50; seed++) {
      assertValidProblem(generateVolume(ALL_VOL_SHAPES, makeRng(seed)));
    }
  });

  it('no distractor equals correct answer', () => {
    for (let seed = 0; seed < 50; seed++) {
      assertNoDistractorEqualsAnswer(generateVolume(ALL_VOL_SHAPES, makeRng(seed)));
    }
  });

  it('cube volume = s^3 (integer)', () => {
    const cubeParams: GeneratorParams = { rangeA: [2, 8], rangeB: [2, 8], shapes: ['cube'] };
    for (let seed = 0; seed < 20; seed++) {
      const p = generateVolume(cubeParams, makeRng(seed));
      const match = p.question.match(/side length (\d+)/);
      if (!match) continue;
      const s = parseInt(match[1], 10);
      expect(parseInt(p.correctAnswer, 10)).toBe(s * s * s);
    }
  });

  it('rectangular prism volume = l*w*h (integer)', () => {
    const prismParams: GeneratorParams = {
      rangeA: [2, 8], rangeB: [2, 8], shapes: ['rectangular_prism'],
    };
    for (let seed = 0; seed < 20; seed++) {
      const p = generateVolume(prismParams, makeRng(seed));
      const match = p.question.match(/dimensions (\d+) × (\d+) × (\d+)/);
      if (!match) continue;
      const l = parseInt(match[1], 10);
      const w = parseInt(match[2], 10);
      const h = parseInt(match[3], 10);
      expect(parseInt(p.correctAnswer, 10)).toBe(l * w * h);
    }
  });

  it('cylinder volume answer matches pi format', () => {
    const cylParams: GeneratorParams = { rangeA: [2, 8], rangeB: [2, 8], shapes: ['cylinder'] };
    for (let seed = 0; seed < 20; seed++) {
      const p = generateVolume(cylParams, makeRng(seed));
      expect(isPiAnswer(p.correctAnswer)).toBe(true);
    }
  });

  it('sphere volume answer matches pi format', () => {
    const sphereParams: GeneratorParams = { rangeA: [2, 6], rangeB: [2, 6], shapes: ['sphere'] };
    for (let seed = 0; seed < 20; seed++) {
      const p = generateVolume(sphereParams, makeRng(seed));
      // Accepts "{N}*pi" or "{N}*pi/3"
      expect(isPiAnswer(p.correctAnswer)).toBe(true);
    }
  });

  it('cone volume answer matches pi format', () => {
    const coneParams: GeneratorParams = { rangeA: [2, 6], rangeB: [2, 6], shapes: ['cone'] };
    for (let seed = 0; seed < 20; seed++) {
      const p = generateVolume(coneParams, makeRng(seed));
      expect(isPiAnswer(p.correctAnswer)).toBe(true);
    }
  });
});

// ── 4. generateAngleRelationship ──────────────────────────────────────────────

describe('generateAngleRelationship — determinism', () => {
  it('same seed produces identical output', () => {
    const p1 = generateAngleRelationship(ANGLE_ALL_PARAMS, makeRng(77));
    const p2 = generateAngleRelationship(ANGLE_ALL_PARAMS, makeRng(77));
    expect(p1.question).toBe(p2.question);
    expect(p1.correctAnswer).toBe(p2.correctAnswer);
  });
});

describe('generateAngleRelationship — correctness', () => {
  it('returns valid MathProblem', () => {
    for (let seed = 0; seed < 50; seed++) {
      assertValidProblem(generateAngleRelationship(ANGLE_ALL_PARAMS, makeRng(seed)));
    }
  });

  it('no distractor equals correct answer', () => {
    for (let seed = 0; seed < 50; seed++) {
      assertNoDistractorEqualsAnswer(generateAngleRelationship(ANGLE_ALL_PARAMS, makeRng(seed)));
    }
  });

  it('answer is always a positive integer', () => {
    for (let seed = 0; seed < 50; seed++) {
      const p = generateAngleRelationship(ANGLE_ALL_PARAMS, makeRng(seed));
      const n = parseInt(p.correctAnswer, 10);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThan(0);
    }
  });

  it('complementary: angles sum to 90', () => {
    const compParams: GeneratorParams = {
      rangeA: [10, 80], rangeB: [10, 80], operations: ['complementary'],
    };
    for (let seed = 0; seed < 30; seed++) {
      const p = generateAngleRelationship(compParams, makeRng(seed));
      const match = p.question.match(/One angle is (\d+)°/);
      if (!match) continue;
      const given = parseInt(match[1], 10);
      const answer = parseInt(p.correctAnswer, 10);
      expect(given + answer).toBe(90);
    }
  });

  it('supplementary: angles sum to 180', () => {
    const suppParams: GeneratorParams = {
      rangeA: [10, 170], rangeB: [10, 170], operations: ['supplementary'],
    };
    for (let seed = 0; seed < 30; seed++) {
      const p = generateAngleRelationship(suppParams, makeRng(seed));
      const match = p.question.match(/One angle is (\d+)°/);
      if (!match) continue;
      const given = parseInt(match[1], 10);
      const answer = parseInt(p.correctAnswer, 10);
      expect(given + answer).toBe(180);
    }
  });

  it('triangle: three angles sum to 180', () => {
    const triParams: GeneratorParams = {
      rangeA: [20, 120], rangeB: [20, 120], operations: ['triangle'],
    };
    for (let seed = 0; seed < 30; seed++) {
      const p = generateAngleRelationship(triParams, makeRng(seed));
      const match = p.question.match(/angles of (\d+)° and (\d+)°/);
      if (!match) continue;
      const a = parseInt(match[1], 10);
      const b = parseInt(match[2], 10);
      const answer = parseInt(p.correctAnswer, 10);
      expect(a + b + answer).toBe(180);
    }
  });

  it('vertical: answer equals the given angle', () => {
    const vertParams: GeneratorParams = {
      rangeA: [20, 150], rangeB: [20, 150], operations: ['vertical'],
    };
    for (let seed = 0; seed < 30; seed++) {
      const p = generateAngleRelationship(vertParams, makeRng(seed));
      const match = p.question.match(/forming an angle of (\d+)°/);
      if (!match) continue;
      const given = parseInt(match[1], 10);
      const answer = parseInt(p.correctAnswer, 10);
      expect(answer).toBe(given);
    }
  });
});

// ── 5. generatePythagorean ────────────────────────────────────────────────────

describe('generatePythagorean — determinism', () => {
  it('same seed produces identical output', () => {
    const p1 = generatePythagorean(PYTHAG_PARAMS, makeRng(55));
    const p2 = generatePythagorean(PYTHAG_PARAMS, makeRng(55));
    expect(p1.question).toBe(p2.question);
    expect(p1.correctAnswer).toBe(p2.correctAnswer);
  });
});

describe('generatePythagorean — correctness', () => {
  it('returns valid MathProblem', () => {
    for (let seed = 0; seed < 50; seed++) {
      assertValidProblem(generatePythagorean(PYTHAG_PARAMS, makeRng(seed)));
    }
  });

  it('no distractor equals correct answer', () => {
    for (let seed = 0; seed < 50; seed++) {
      assertNoDistractorEqualsAnswer(generatePythagorean(PYTHAG_PARAMS, makeRng(seed)));
    }
  });

  it('answer is always a positive integer', () => {
    for (let seed = 0; seed < 50; seed++) {
      const p = generatePythagorean(PYTHAG_PARAMS, makeRng(seed));
      const n = parseInt(p.correctAnswer, 10);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThan(0);
    }
  });

  it('hypotenuse case: a^2 + b^2 = c^2', () => {
    // Force hypotenuse case by checking many seeds — some will hide the hypotenuse.
    let foundHypotenuse = false;
    for (let seed = 0; seed < 100; seed++) {
      const p = generatePythagorean(PYTHAG_PARAMS, makeRng(seed));
      if (!p.question.includes('legs')) continue;
      foundHypotenuse = true;
      const match = p.question.match(/legs (\d+) and (\d+)/);
      if (!match) continue;
      const a = parseInt(match[1], 10);
      const b = parseInt(match[2], 10);
      const c = parseInt(p.correctAnswer, 10);
      expect(a * a + b * b).toBe(c * c);
    }
    expect(foundHypotenuse).toBe(true);
  });

  it('missing leg case: a^2 + b^2 = c^2', () => {
    let foundLeg = false;
    for (let seed = 0; seed < 100; seed++) {
      const p = generatePythagorean(PYTHAG_PARAMS, makeRng(seed));
      if (!p.question.includes('hypotenuse')) continue;
      foundLeg = true;
      const legMatch = p.question.match(/leg of (\d+)/);
      const hypMatch = p.question.match(/hypotenuse (\d+)/);
      if (!legMatch || !hypMatch) continue;
      const knownLeg = parseInt(legMatch[1], 10);
      const hyp = parseInt(hypMatch[1], 10);
      const missingLeg = parseInt(p.correctAnswer, 10);
      expect(knownLeg * knownLeg + missingLeg * missingLeg).toBe(hyp * hyp);
    }
    expect(foundLeg).toBe(true);
  });

  it('explanation references a^2 + b^2 = c^2', () => {
    for (let seed = 0; seed < 20; seed++) {
      const p = generatePythagorean(PYTHAG_PARAMS, makeRng(seed));
      expect(p.explanation).toContain('a² + b² = c²');
    }
  });
});
