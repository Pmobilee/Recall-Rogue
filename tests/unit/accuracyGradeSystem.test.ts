import { describe, it, expect } from 'vitest';
import { calculateAccuracyGrade } from '../../src/services/accuracyGradeSystem';

describe('calculateAccuracyGrade', () => {
  // === Edge cases ===
  it('returns grade C with no bonuses when 0 charges attempted', () => {
    const result = calculateAccuracyGrade(0, 0);
    expect(result.grade).toBe('C');
    expect(result.accuracy).toBe(0);
    expect(result.bonusCardOptions).toBe(0);
    expect(result.guaranteeUncommon).toBe(false);
  });

  it('clamps chargesCorrect to chargesAttempted if somehow higher', () => {
    const result = calculateAccuracyGrade(5, 10);
    // clamped to 5/5 = 100% → grade S
    expect(result.grade).toBe('S');
    expect(result.accuracy).toBe(100);
  });

  // === S grade (90%+) ===
  it('returns grade S at 100% accuracy (1/1 correct)', () => {
    const result = calculateAccuracyGrade(1, 1);
    expect(result.grade).toBe('S');
    expect(result.accuracy).toBe(100);
    expect(result.bonusCardOptions).toBe(1);
    expect(result.guaranteeUncommon).toBe(true);
  });

  it('returns grade S at 90% accuracy (9/10 correct)', () => {
    const result = calculateAccuracyGrade(10, 9);
    expect(result.grade).toBe('S');
    expect(result.accuracy).toBe(90);
    expect(result.bonusCardOptions).toBe(1);
    expect(result.guaranteeUncommon).toBe(true);
  });

  it('returns grade S at 95% accuracy', () => {
    const result = calculateAccuracyGrade(20, 19);
    expect(result.grade).toBe('S');
    expect(result.accuracy).toBe(95);
    expect(result.bonusCardOptions).toBe(1);
    expect(result.guaranteeUncommon).toBe(true);
  });

  // === A grade (80-89%) ===
  it('returns grade A at exactly 80% accuracy (8/10 correct)', () => {
    const result = calculateAccuracyGrade(10, 8);
    expect(result.grade).toBe('A');
    expect(result.accuracy).toBe(80);
    expect(result.bonusCardOptions).toBe(1);
    expect(result.guaranteeUncommon).toBe(false);
  });

  it('returns grade A at 89% accuracy — boundary check (not S)', () => {
    // 89/100 = 89% → A grade (not S, which requires 90%)
    const result = calculateAccuracyGrade(100, 89);
    expect(result.grade).toBe('A');
    expect(result.accuracy).toBe(89);
    expect(result.bonusCardOptions).toBe(1);
    expect(result.guaranteeUncommon).toBe(false);
  });

  it('returns grade A at 85% accuracy', () => {
    const result = calculateAccuracyGrade(20, 17);
    expect(result.grade).toBe('A');
    expect(result.accuracy).toBe(85);
    expect(result.bonusCardOptions).toBe(1);
    expect(result.guaranteeUncommon).toBe(false);
  });

  // === B grade (60-79%) ===
  it('returns grade B at exactly 60% accuracy (6/10 correct)', () => {
    const result = calculateAccuracyGrade(10, 6);
    expect(result.grade).toBe('B');
    expect(result.accuracy).toBe(60);
    expect(result.bonusCardOptions).toBe(0);
    expect(result.guaranteeUncommon).toBe(false);
  });

  it('returns grade B at 70% accuracy (7/10 correct)', () => {
    const result = calculateAccuracyGrade(10, 7);
    expect(result.grade).toBe('B');
    expect(result.accuracy).toBe(70);
    expect(result.bonusCardOptions).toBe(0);
    expect(result.guaranteeUncommon).toBe(false);
  });

  it('returns grade B at 79% accuracy — boundary check (not A)', () => {
    // 79/100 = 79% → B grade (not A, which requires 80%)
    const result = calculateAccuracyGrade(100, 79);
    expect(result.grade).toBe('B');
    expect(result.accuracy).toBe(79);
    expect(result.bonusCardOptions).toBe(0);
    expect(result.guaranteeUncommon).toBe(false);
  });

  // === C grade (<60%) ===
  it('returns grade C at 50% accuracy (5/10 correct)', () => {
    const result = calculateAccuracyGrade(10, 5);
    expect(result.grade).toBe('C');
    expect(result.accuracy).toBe(50);
    expect(result.bonusCardOptions).toBe(0);
    expect(result.guaranteeUncommon).toBe(false);
  });

  it('returns grade C at 0% accuracy (0 correct out of 5 attempts)', () => {
    const result = calculateAccuracyGrade(5, 0);
    expect(result.grade).toBe('C');
    expect(result.accuracy).toBe(0);
    expect(result.bonusCardOptions).toBe(0);
    expect(result.guaranteeUncommon).toBe(false);
  });

  it('returns grade C at 59% accuracy — boundary check (not B)', () => {
    // 59/100 = 59% → C (not B, which requires 60%)
    const result = calculateAccuracyGrade(100, 59);
    expect(result.grade).toBe('C');
    expect(result.accuracy).toBe(59);
    expect(result.bonusCardOptions).toBe(0);
    expect(result.guaranteeUncommon).toBe(false);
  });

  // === Rounding edge cases ===
  it('rounds accuracy to nearest integer', () => {
    // 2/3 = 66.67% → rounds to 67% → B grade
    const result = calculateAccuracyGrade(3, 2);
    expect(result.accuracy).toBe(67);
    expect(result.grade).toBe('B');
  });

  it('handles large numbers correctly', () => {
    // 900/1000 = 90% → S grade
    const result = calculateAccuracyGrade(1000, 900);
    expect(result.grade).toBe('S');
    expect(result.accuracy).toBe(90);
  });
});
