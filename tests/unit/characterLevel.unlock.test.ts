import { describe, it, expect } from 'vitest';
import {
  getUnlockedMechanics,
  getMechanicUnlockLevel,
  getUnlockedRelics,
  getRelicUnlockScheduleLevel,
} from '../../src/services/characterLevel';

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
    // IDs in mechanics.ts use short form (no _of_)
    expect(unlocked.has('inscription_fury')).toBe(true);
    expect(unlocked.has('inscription_iron')).toBe(true);
  });

  it('gates level-1+ mechanics at level 0', () => {
    const unlocked = getUnlockedMechanics(0);
    expect(unlocked.has('bash')).toBe(false);
    expect(unlocked.has('guard')).toBe(false);
    expect(unlocked.has('eruption')).toBe(false);
    expect(unlocked.has('knowledge_bomb')).toBe(false);
    expect(unlocked.has('reactive_shield')).toBe(false);
    expect(unlocked.has('warcry')).toBe(false);
    expect(unlocked.has('hemorrhage')).toBe(false);
    expect(unlocked.has('recollect')).toBe(false);
    expect(unlocked.has('siphon_strike')).toBe(false);
    expect(unlocked.has('siphon_knowledge')).toBe(false);
  });

  it('unlocks level 1 cohort at level 1', () => {
    const unlocked = getUnlockedMechanics(1);
    expect(unlocked.has('bash')).toBe(true);
    expect(unlocked.has('guard')).toBe(true);
    expect(unlocked.has('sap')).toBe(true);
    expect(unlocked.has('inscription_wisdom')).toBe(true);
  });

  it('still includes all level-0 mechanics at level 1', () => {
    const unlocked = getUnlockedMechanics(1);
    expect(unlocked.has('strike')).toBe(true);
    expect(unlocked.has('block')).toBe(true);
    expect(unlocked.has('overclock')).toBe(true);
    expect(unlocked.has('inscription_fury')).toBe(true);
    expect(unlocked.has('inscription_iron')).toBe(true);
  });

  it('still gates higher mechanics at level 1', () => {
    const unlocked = getUnlockedMechanics(1);
    expect(unlocked.has('eruption')).toBe(false);
    expect(unlocked.has('knowledge_bomb')).toBe(false);
  });

  it('unlocks level 5 cohort — reactive_shield included', () => {
    const unlocked = getUnlockedMechanics(5);
    expect(unlocked.has('kindle')).toBe(true);
    expect(unlocked.has('ignite')).toBe(true);
    expect(unlocked.has('corrode')).toBe(true);
    expect(unlocked.has('overcharge')).toBe(true);
    expect(unlocked.has('archive')).toBe(true);
    expect(unlocked.has('reactive_shield')).toBe(true);
    expect(unlocked.has('warcry')).toBe(false);
  });

  it('unlocks level 6 cohort — warcry included', () => {
    const unlocked = getUnlockedMechanics(6);
    expect(unlocked.has('gambit')).toBe(true);
    expect(unlocked.has('chameleon')).toBe(true);
    expect(unlocked.has('warcry')).toBe(true);
    expect(unlocked.has('hemorrhage')).toBe(false);
  });

  it('unlocks level 7 cohort — hemorrhage included', () => {
    const unlocked = getUnlockedMechanics(7);
    expect(unlocked.has('burnout_shield')).toBe(true);
    expect(unlocked.has('volatile_slash')).toBe(true);
    expect(unlocked.has('hemorrhage')).toBe(true);
    expect(unlocked.has('recollect')).toBe(false);
  });

  it('unlocks level 8 cohort — recollect included', () => {
    const unlocked = getUnlockedMechanics(8);
    expect(unlocked.has('ironhide')).toBe(true);
    expect(unlocked.has('war_drum')).toBe(true);
    expect(unlocked.has('recollect')).toBe(true);
  });

  it('unlocks level 11 cohort — siphon_strike included', () => {
    const unlocked = getUnlockedMechanics(11);
    expect(unlocked.has('recall')).toBe(true);
    expect(unlocked.has('mastery_surge')).toBe(true);
    expect(unlocked.has('tutor')).toBe(true);
    expect(unlocked.has('mimic')).toBe(true);
    expect(unlocked.has('siphon_strike')).toBe(true);
    expect(unlocked.has('eruption')).toBe(false);
  });

  it('unlocks eruption only at level 12+', () => {
    expect(getUnlockedMechanics(11).has('eruption')).toBe(false);
    expect(getUnlockedMechanics(12).has('eruption')).toBe(true);
  });

  it('unlocks siphon_knowledge only at level 13+', () => {
    expect(getUnlockedMechanics(12).has('siphon_knowledge')).toBe(false);
    expect(getUnlockedMechanics(13).has('siphon_knowledge')).toBe(true);
  });

  it('returns all 96 mechanics at level 13', () => {
    expect(getUnlockedMechanics(13).size).toBe(96);
  });

  it('level 25 returns same count as level 13 (no mechanics above 13)', () => {
    expect(getUnlockedMechanics(25).size).toBe(getUnlockedMechanics(13).size);
  });

  it('accumulates correctly — level 5 has more than level 4', () => {
    expect(getUnlockedMechanics(5).size).toBeGreaterThan(getUnlockedMechanics(4).size);
  });

  it('each level from 0-13 has strictly more than the previous', () => {
    for (let l = 1; l <= 13; l++) {
      expect(getUnlockedMechanics(l).size).toBeGreaterThan(
        getUnlockedMechanics(l - 1).size,
        `Expected level ${l} to unlock more mechanics than level ${l - 1}`,
      );
    }
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

  it('returns 0 for AR-206 basics (short ID form, no _of_)', () => {
    expect(getMechanicUnlockLevel('power_strike')).toBe(0);
    expect(getMechanicUnlockLevel('inscription_fury')).toBe(0);
    expect(getMechanicUnlockLevel('inscription_iron')).toBe(0);
  });

  it('returns correct level for all gated mechanics', () => {
    // Level 1
    expect(getMechanicUnlockLevel('bash')).toBe(1);
    expect(getMechanicUnlockLevel('guard')).toBe(1);
    expect(getMechanicUnlockLevel('sap')).toBe(1);
    expect(getMechanicUnlockLevel('inscription_wisdom')).toBe(1);
    // Level 2
    expect(getMechanicUnlockLevel('twin_strike')).toBe(2);
    expect(getMechanicUnlockLevel('shrug_it_off')).toBe(2);
    expect(getMechanicUnlockLevel('swap')).toBe(2);
    // Level 3
    expect(getMechanicUnlockLevel('stagger')).toBe(3);
    expect(getMechanicUnlockLevel('sift')).toBe(3);
    expect(getMechanicUnlockLevel('riposte')).toBe(3);
    // Level 4
    expect(getMechanicUnlockLevel('rupture')).toBe(4);
    expect(getMechanicUnlockLevel('lacerate')).toBe(4);
    expect(getMechanicUnlockLevel('precision_strike')).toBe(4);
    // Level 5
    expect(getMechanicUnlockLevel('kindle')).toBe(5);
    expect(getMechanicUnlockLevel('reactive_shield')).toBe(5);
    // Level 6
    expect(getMechanicUnlockLevel('gambit')).toBe(6);
    expect(getMechanicUnlockLevel('warcry')).toBe(6);
    // Level 7
    expect(getMechanicUnlockLevel('burnout_shield')).toBe(7);
    expect(getMechanicUnlockLevel('hemorrhage')).toBe(7);
    // Level 8
    expect(getMechanicUnlockLevel('ironhide')).toBe(8);
    expect(getMechanicUnlockLevel('recollect')).toBe(8);
    // Level 9
    expect(getMechanicUnlockLevel('smite')).toBe(9);
    // Level 10
    expect(getMechanicUnlockLevel('feedback_loop')).toBe(10);
    // Level 11
    expect(getMechanicUnlockLevel('recall')).toBe(11);
    expect(getMechanicUnlockLevel('siphon_strike')).toBe(11);
    // Level 12
    expect(getMechanicUnlockLevel('eruption')).toBe(12);
    // Level 13
    expect(getMechanicUnlockLevel('knowledge_bomb')).toBe(13);
    expect(getMechanicUnlockLevel('siphon_knowledge')).toBe(13);
  });

  it('returns null for unknown mechanic IDs', () => {
    expect(getMechanicUnlockLevel('nonexistent_mechanic')).toBe(null);
    expect(getMechanicUnlockLevel('')).toBe(null);
    // Old _of_ form IDs no longer exist in the schedule
    expect(getMechanicUnlockLevel('inscription_of_fury')).toBe(null);
    expect(getMechanicUnlockLevel('inscription_of_iron')).toBe(null);
    expect(getMechanicUnlockLevel('inscription_of_wisdom')).toBe(null);
  });
});

describe('getUnlockedRelics', () => {
  it('returns 5 expansion relics at level 0', () => {
    const unlocked = getUnlockedRelics(0);
    expect(unlocked.size).toBe(5);
    expect(unlocked.has('quick_study')).toBe(true);
    expect(unlocked.has('thick_skin')).toBe(true);
    expect(unlocked.has('tattered_notebook')).toBe(true);
    expect(unlocked.has('battle_scars')).toBe(true);
    expect(unlocked.has('brass_knuckles')).toBe(true);
  });

  it('gates level-1+ relics at level 0', () => {
    const unlocked = getUnlockedRelics(0);
    expect(unlocked.has('pocket_watch')).toBe(false);
    expect(unlocked.has('chain_link_charm')).toBe(false);
    expect(unlocked.has('omniscience')).toBe(false);
    expect(unlocked.has('singularity')).toBe(false);
  });

  it('unlocks level 1 relics at level 1', () => {
    const unlocked = getUnlockedRelics(1);
    expect(unlocked.has('pocket_watch')).toBe(true);
    expect(unlocked.has('chain_link_charm')).toBe(true);
    expect(unlocked.size).toBe(7);
  });

  it('unlocks level 2 relics at level 2', () => {
    const unlocked = getUnlockedRelics(2);
    expect(unlocked.has('worn_shield')).toBe(true);
    expect(unlocked.has('bleedstone')).toBe(true);
    expect(unlocked.has('gladiator_s_mark')).toBe(true);
    expect(unlocked.size).toBe(10);
  });

  it('unlocks endgame relics only at their levels', () => {
    expect(getUnlockedRelics(19).has('omniscience')).toBe(false);
    expect(getUnlockedRelics(20).has('omniscience')).toBe(true);
    expect(getUnlockedRelics(22).has('singularity')).toBe(false);
    expect(getUnlockedRelics(23).has('singularity')).toBe(true);
  });

  it('returns all 37 expansion relics at level 23', () => {
    // 17 from starters expansion section + 20 from unlockable expansion section (excl. toxic_bloom at level 24)
    expect(getUnlockedRelics(23).size).toBe(37);
  });

  it('level 25 returns same count as level 23 (no relics above 23)', () => {
    expect(getUnlockedRelics(25).size).toBe(getUnlockedRelics(23).size);
  });

  it('accumulates correctly — each level adds relics or stays same', () => {
    for (let l = 1; l <= 25; l++) {
      expect(getUnlockedRelics(l).size).toBeGreaterThanOrEqual(getUnlockedRelics(l - 1).size);
    }
  });
});

describe('getRelicUnlockScheduleLevel', () => {
  it('returns 0 for level-0 expansion relics', () => {
    expect(getRelicUnlockScheduleLevel('quick_study')).toBe(0);
    expect(getRelicUnlockScheduleLevel('brass_knuckles')).toBe(0);
  });

  it('returns correct level for mid-tier expansion relics', () => {
    expect(getRelicUnlockScheduleLevel('pocket_watch')).toBe(1);
    expect(getRelicUnlockScheduleLevel('bleedstone')).toBe(2);
    expect(getRelicUnlockScheduleLevel('ember_core')).toBe(3);
    expect(getRelicUnlockScheduleLevel('thoughtform')).toBe(4);
    expect(getRelicUnlockScheduleLevel('surge_capacitor')).toBe(5);
    expect(getRelicUnlockScheduleLevel('red_fang')).toBe(6);
    expect(getRelicUnlockScheduleLevel('soul_jar')).toBe(7);
    expect(getRelicUnlockScheduleLevel('archive_codex')).toBe(8);
    expect(getRelicUnlockScheduleLevel('berserker_s_oath')).toBe(9);
    expect(getRelicUnlockScheduleLevel('inferno_crown')).toBe(10);
    expect(getRelicUnlockScheduleLevel('bloodstone_pendant')).toBe(11);
    expect(getRelicUnlockScheduleLevel('volatile_manuscript')).toBe(12);
  });

  it('returns correct level for endgame expansion relics', () => {
    expect(getRelicUnlockScheduleLevel('omniscience')).toBe(20);
    expect(getRelicUnlockScheduleLevel('paradox_engine')).toBe(21);
    expect(getRelicUnlockScheduleLevel('akashic_record')).toBe(22);
    expect(getRelicUnlockScheduleLevel('singularity')).toBe(23);
  });

  it('returns null for original starter relics (not in expansion schedule)', () => {
    expect(getRelicUnlockScheduleLevel('whetstone')).toBe(null);
    expect(getRelicUnlockScheduleLevel('iron_shield')).toBe(null);
    expect(getRelicUnlockScheduleLevel('chain_reactor')).toBe(null);
    expect(getRelicUnlockScheduleLevel('nonexistent_relic')).toBe(null);
  });
});
