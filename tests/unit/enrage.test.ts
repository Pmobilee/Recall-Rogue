import { describe, it, expect } from 'vitest';
import { getEnrageBonus } from '../../src/services/turnManager';

describe('getEnrageBonus', () => {
  // Shallow (floors 1-6): enrage starts turn 12, phase1_bonus=1, phase2_bonus=3, phase1_duration=3
  it('returns 0 before enrage starts on shallow floors', () => {
    expect(getEnrageBonus(11, 3, 1.0)).toBe(0);
  });
  it('returns phase 1 bonus on shallow floors', () => {
    expect(getEnrageBonus(12, 3, 1.0)).toBe(1);  // turn 12: 1 enrage turn * 1
    expect(getEnrageBonus(13, 3, 1.0)).toBe(2);  // turn 13: 2 * 1
    expect(getEnrageBonus(14, 3, 1.0)).toBe(3);  // turn 14: 3 * 1
  });
  it('escalates to phase 2 after 3 enrage turns', () => {
    expect(getEnrageBonus(15, 3, 1.0)).toBe(6);  // 3*1 + 1*3
    expect(getEnrageBonus(16, 3, 1.0)).toBe(9);  // 3*1 + 2*3
  });

  // Deep (floors 7-12): enrage starts turn 6
  it('starts enrage earlier on deep floors', () => {
    expect(getEnrageBonus(5, 9, 1.0)).toBe(0);
    expect(getEnrageBonus(6, 9, 1.0)).toBe(1);
  });

  // Abyss (floors 13-18): enrage starts turn 5
  it('starts enrage at turn 5 on abyss floors', () => {
    expect(getEnrageBonus(4, 15, 1.0)).toBe(0);
    expect(getEnrageBonus(5, 15, 1.0)).toBe(1);
  });

  // Archive (floors 19-24): enrage starts turn 4
  it('starts enrage at turn 4 on archive floors', () => {
    expect(getEnrageBonus(3, 20, 1.0)).toBe(0);
    expect(getEnrageBonus(4, 20, 1.0)).toBe(1);
  });

  // Endless (floors 25+): enrage starts turn 5
  it('starts enrage at turn 5 on endless floors', () => {
    expect(getEnrageBonus(4, 30, 1.0)).toBe(0);
    expect(getEnrageBonus(5, 30, 1.0)).toBe(1);
  });

  // HP threshold bonus
  it('adds low HP bonus when enemy below 30%', () => {
    expect(getEnrageBonus(8, 3, 0.29)).toBe(3);   // no enrage turn bonus (startTurn=12), just low HP bonus=3
    expect(getEnrageBonus(12, 3, 0.29)).toBe(4);  // 1 (enrage) + 3 (low HP)
  });
  it('does not add low HP bonus when enemy at or above 30%', () => {
    expect(getEnrageBonus(12, 3, 0.30)).toBe(1);  // just enrage, no low HP
    expect(getEnrageBonus(12, 3, 0.50)).toBe(1);
  });
});
