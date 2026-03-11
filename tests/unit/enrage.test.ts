import { describe, it, expect } from 'vitest';
import { getEnrageBonus } from '../../src/services/turnManager';

describe('getEnrageBonus', () => {
  // Shallow (floors 1-6): enrage starts turn 9
  it('returns 0 before enrage starts on shallow floors', () => {
    expect(getEnrageBonus(8, 3, 1.0)).toBe(0);
  });
  it('returns phase 1 bonus on shallow floors', () => {
    expect(getEnrageBonus(9, 3, 1.0)).toBe(2);   // turn 9: 1 enrage turn * 2
    expect(getEnrageBonus(10, 3, 1.0)).toBe(4);  // turn 10: 2 * 2
    expect(getEnrageBonus(11, 3, 1.0)).toBe(6);  // turn 11: 3 * 2
  });
  it('escalates to phase 2 after 3 enrage turns', () => {
    expect(getEnrageBonus(12, 3, 1.0)).toBe(10); // 3*2 + 1*4
    expect(getEnrageBonus(13, 3, 1.0)).toBe(14); // 3*2 + 2*4
  });

  // Deep (floors 7-12): enrage starts turn 8
  it('starts enrage earlier on deep floors', () => {
    expect(getEnrageBonus(7, 9, 1.0)).toBe(0);
    expect(getEnrageBonus(8, 9, 1.0)).toBe(2);
  });

  // Abyss (floors 13-18): enrage starts turn 7
  it('starts enrage at turn 7 on abyss floors', () => {
    expect(getEnrageBonus(6, 15, 1.0)).toBe(0);
    expect(getEnrageBonus(7, 15, 1.0)).toBe(2);
  });

  // Archive (floors 19-24): enrage starts turn 6
  it('starts enrage at turn 6 on archive floors', () => {
    expect(getEnrageBonus(5, 20, 1.0)).toBe(0);
    expect(getEnrageBonus(6, 20, 1.0)).toBe(2);
  });

  // Endless (floors 25+): enrage starts turn 5
  it('starts enrage at turn 5 on endless floors', () => {
    expect(getEnrageBonus(4, 30, 1.0)).toBe(0);
    expect(getEnrageBonus(5, 30, 1.0)).toBe(2);
  });

  // HP threshold bonus
  it('adds low HP bonus when enemy below 30%', () => {
    expect(getEnrageBonus(8, 3, 0.29)).toBe(3);  // no enrage turn bonus, just low HP
    expect(getEnrageBonus(9, 3, 0.29)).toBe(5);  // 2 (enrage) + 3 (low HP)
  });
  it('does not add low HP bonus when enemy at or above 30%', () => {
    expect(getEnrageBonus(9, 3, 0.30)).toBe(2);  // just enrage, no low HP
    expect(getEnrageBonus(9, 3, 0.50)).toBe(2);
  });
});
