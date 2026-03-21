import { describe, it, expect } from 'vitest';
import { getUnlockedMechanics, getMechanicUnlockLevel } from '../../src/services/characterLevel';

describe('getUnlockedMechanics', () => {
  it('returns 36 mechanics at level 0', () => {
    expect(getUnlockedMechanics(0).size).toBe(36);
  });

  it('includes all 31 existing mechanics at level 0', () => {
    const unlocked = getUnlockedMechanics(0);
    // Attack
    expect(unlocked.has('strike')).toBe(true);
    expect(unlocked.has('multi_hit')).toBe(true);
    expect(unlocked.has('heavy_strike')).toBe(true);
    expect(unlocked.has('piercing')).toBe(true);
    expect(unlocked.has('reckless')).toBe(true);
    expect(unlocked.has('execute')).toBe(true);
    expect(unlocked.has('lifetap')).toBe(true);
    // Shield
    expect(unlocked.has('block')).toBe(true);
    expect(unlocked.has('thorns')).toBe(true);
    expect(unlocked.has('emergency')).toBe(true);
    expect(unlocked.has('fortify')).toBe(true);
    expect(unlocked.has('brace')).toBe(true);
    expect(unlocked.has('overheal')).toBe(true);
    expect(unlocked.has('parry')).toBe(true);
    // Buff
    expect(unlocked.has('empower')).toBe(true);
    expect(unlocked.has('quicken')).toBe(true);
    expect(unlocked.has('focus')).toBe(true);
    expect(unlocked.has('double_strike')).toBe(true);
    // Debuff
    expect(unlocked.has('weaken')).toBe(true);
    expect(unlocked.has('expose')).toBe(true);
    expect(unlocked.has('hex')).toBe(true);
    expect(unlocked.has('slow')).toBe(true);
    // Utility
    expect(unlocked.has('cleanse')).toBe(true);
    expect(unlocked.has('scout')).toBe(true);
    expect(unlocked.has('recycle')).toBe(true);
    expect(unlocked.has('foresight')).toBe(true);
    expect(unlocked.has('transmute')).toBe(true);
    expect(unlocked.has('immunity')).toBe(true);
    // Wild
    expect(unlocked.has('mirror')).toBe(true);
    expect(unlocked.has('adapt')).toBe(true);
    expect(unlocked.has('overclock')).toBe(true);
  });

  it('includes 5 AR-206 basics at level 0', () => {
    const unlocked = getUnlockedMechanics(0);
    expect(unlocked.has('power_strike')).toBe(true);
    expect(unlocked.has('iron_wave')).toBe(true);
    expect(unlocked.has('reinforce')).toBe(true);
    expect(unlocked.has('inscription_of_fury')).toBe(true);
    expect(unlocked.has('inscription_of_iron')).toBe(true);
  });

  it('gates level-1+ mechanics at level 0', () => {
    const unlocked = getUnlockedMechanics(0);
    expect(unlocked.has('bash')).toBe(false);
    expect(unlocked.has('guard')).toBe(false);
    expect(unlocked.has('eruption')).toBe(false);
    expect(unlocked.has('knowledge_bomb')).toBe(false);
  });

  it('unlocks level 1 cohort at level 1', () => {
    const unlocked = getUnlockedMechanics(1);
    expect(unlocked.has('bash')).toBe(true);
    expect(unlocked.has('guard')).toBe(true);
    expect(unlocked.has('sap')).toBe(true);
    expect(unlocked.has('inscription_of_wisdom')).toBe(true);
  });

  it('still includes all level-0 mechanics at level 1', () => {
    const unlocked = getUnlockedMechanics(1);
    expect(unlocked.has('strike')).toBe(true);
    expect(unlocked.has('block')).toBe(true);
    expect(unlocked.has('overclock')).toBe(true);
  });

  it('still gates higher mechanics at level 1', () => {
    const unlocked = getUnlockedMechanics(1);
    expect(unlocked.has('eruption')).toBe(false);
    expect(unlocked.has('knowledge_bomb')).toBe(false);
  });

  it('unlocks eruption only at level 12+', () => {
    expect(getUnlockedMechanics(11).has('eruption')).toBe(false);
    expect(getUnlockedMechanics(12).has('eruption')).toBe(true);
  });

  it('returns all 92 mechanics at level 13', () => {
    expect(getUnlockedMechanics(13).size).toBe(92);
  });

  it('level 25 returns same count as level 13 (no mechanics above 13)', () => {
    expect(getUnlockedMechanics(25).size).toBe(getUnlockedMechanics(13).size);
  });

  it('accumulates correctly — level 5 has more than level 4', () => {
    expect(getUnlockedMechanics(5).size).toBeGreaterThan(getUnlockedMechanics(4).size);
  });
});

describe('getMechanicUnlockLevel', () => {
  it('returns 0 for all 31 existing mechanics', () => {
    expect(getMechanicUnlockLevel('strike')).toBe(0);
    expect(getMechanicUnlockLevel('block')).toBe(0);
    expect(getMechanicUnlockLevel('overclock')).toBe(0);
    expect(getMechanicUnlockLevel('parry')).toBe(0);
    expect(getMechanicUnlockLevel('transmute')).toBe(0);
    expect(getMechanicUnlockLevel('immunity')).toBe(0);
  });

  it('returns 0 for AR-206 basics', () => {
    expect(getMechanicUnlockLevel('power_strike')).toBe(0);
    expect(getMechanicUnlockLevel('inscription_of_fury')).toBe(0);
  });

  it('returns correct level for gated mechanics', () => {
    expect(getMechanicUnlockLevel('bash')).toBe(1);
    expect(getMechanicUnlockLevel('twin_strike')).toBe(2);
    expect(getMechanicUnlockLevel('stagger')).toBe(3);
    expect(getMechanicUnlockLevel('rupture')).toBe(4);
    expect(getMechanicUnlockLevel('kindle')).toBe(5);
    expect(getMechanicUnlockLevel('gambit')).toBe(6);
    expect(getMechanicUnlockLevel('burnout_shield')).toBe(7);
    expect(getMechanicUnlockLevel('ironhide')).toBe(8);
    expect(getMechanicUnlockLevel('smite')).toBe(9);
    expect(getMechanicUnlockLevel('feedback_loop')).toBe(10);
    expect(getMechanicUnlockLevel('recall')).toBe(11);
    expect(getMechanicUnlockLevel('eruption')).toBe(12);
    expect(getMechanicUnlockLevel('knowledge_bomb')).toBe(13);
    expect(getMechanicUnlockLevel('siphon_knowledge')).toBe(13);
  });

  it('returns null for unknown mechanic IDs', () => {
    expect(getMechanicUnlockLevel('nonexistent_mechanic')).toBe(null);
    expect(getMechanicUnlockLevel('')).toBe(null);
  });
});
