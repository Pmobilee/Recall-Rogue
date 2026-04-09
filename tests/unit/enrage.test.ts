import { describe, it, expect } from 'vitest';
import { getEnrageBonus } from '../../src/services/turnManager';

describe('getEnrageBonus', () => {
  // Pass 3 balance (2026-04-09): Enrage removed. getEnrageBonus() always returns 0.
  // Fights are balanced via enemy stats, not invisible timers.
  it('always returns 0 regardless of turn, floor, or HP (enrage removed)', () => {
    expect(getEnrageBonus(1, 1, 1.0)).toBe(0);
    expect(getEnrageBonus(8, 3, 1.0)).toBe(0);   // was enrage phase 1
    expect(getEnrageBonus(12, 9, 1.0)).toBe(0);  // was enrage on deep floors
    expect(getEnrageBonus(5, 15, 1.0)).toBe(0);  // was abyss enrage
    expect(getEnrageBonus(4, 20, 1.0)).toBe(0);  // was archive enrage
    expect(getEnrageBonus(7, 3, 0.29)).toBe(0);  // was low HP bonus
    expect(getEnrageBonus(100, 99, 0.0)).toBe(0); // extreme values
  });
});
