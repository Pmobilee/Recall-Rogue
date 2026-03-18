/**
 * Unit tests for v2 relic effect resolver functions.
 * Covers new hooks: resolveChargeCorrectEffects, resolveChargeWrongEffects,
 * resolveChainCompleteEffects, resolveSurgeStartEffects, resolveTurnEndEffectsV2,
 * and V1→V2 save migration.
 */

import { describe, it, expect } from 'vitest';
import {
  resolveChargeCorrectEffects,
  resolveChargeWrongEffects,
  resolveChainCompleteEffects,
  resolveSurgeStartEffects,
  resolveTurnEndEffectsV2,
} from '../relicEffectResolver';
import {
  migrateRelicsV1toV2,
  needsRelicMigrationV1toV2,
  type RelicSaveState,
} from '../saveMigration';

// ─── resolveChargeCorrectEffects ────────────────────────────────────

describe('resolveChargeCorrectEffects', () => {
  describe('quicksilver_quill', () => {
    it('applies ×1.5 multiplier when answer < 2000ms', () => {
      const result = resolveChargeCorrectEffects(
        new Set(['quicksilver_quill']),
        {
          answerTimeMs: 1500,
          cardTier: 1,
          cardType: 'attack',
          isFirstChargeThisTurn: false,
          chargeCountThisEncounter: 1,
          mirrorUsedThisEncounter: false,
          adrenalineShard_usedThisTurn: false,
        },
      );
      expect(result.extraMultiplier).toBe(1.5);
    });

    it('does NOT apply multiplier when answer >= 2000ms', () => {
      const result = resolveChargeCorrectEffects(
        new Set(['quicksilver_quill']),
        {
          answerTimeMs: 2001,
          cardTier: 1,
          cardType: 'attack',
          isFirstChargeThisTurn: false,
          chargeCountThisEncounter: 1,
          mirrorUsedThisEncounter: false,
          adrenalineShard_usedThisTurn: false,
        },
      );
      expect(result.extraMultiplier).toBe(1.0);
    });
  });

  describe('adrenaline_shard', () => {
    it('refunds 1 AP when answer < 3000ms and not used this turn', () => {
      const result = resolveChargeCorrectEffects(
        new Set(['adrenaline_shard']),
        {
          answerTimeMs: 2500,
          cardTier: 1,
          cardType: 'attack',
          isFirstChargeThisTurn: true,
          chargeCountThisEncounter: 1,
          mirrorUsedThisEncounter: false,
          adrenalineShard_usedThisTurn: false,
        },
      );
      expect(result.apRefund).toBe(1);
    });

    it('does NOT refund AP when already used this turn', () => {
      const result = resolveChargeCorrectEffects(
        new Set(['adrenaline_shard']),
        {
          answerTimeMs: 1000,
          cardTier: 1,
          cardType: 'attack',
          isFirstChargeThisTurn: false,
          chargeCountThisEncounter: 2,
          mirrorUsedThisEncounter: false,
          adrenalineShard_usedThisTurn: true,
        },
      );
      expect(result.apRefund).toBe(0);
    });

    it('does NOT refund AP when answer >= 3000ms', () => {
      const result = resolveChargeCorrectEffects(
        new Set(['adrenaline_shard']),
        {
          answerTimeMs: 3001,
          cardTier: 1,
          cardType: 'attack',
          isFirstChargeThisTurn: false,
          chargeCountThisEncounter: 1,
          mirrorUsedThisEncounter: false,
          adrenalineShard_usedThisTurn: false,
        },
      );
      expect(result.apRefund).toBe(0);
    });
  });

  describe('crit_lens', () => {
    it('produces a crit ~25% of the time over many trials (statistical)', () => {
      const relics = new Set(['crit_lens']);
      const baseCtx = {
        answerTimeMs: 5000,
        cardTier: 1,
        cardType: 'attack' as const,
        isFirstChargeThisTurn: false,
        chargeCountThisEncounter: 1,
        mirrorUsedThisEncounter: false,
        adrenalineShard_usedThisTurn: false,
      };
      let crits = 0;
      const TRIALS = 2000;
      for (let i = 0; i < TRIALS; i++) {
        if (resolveChargeCorrectEffects(relics, baseCtx).isCrit) crits++;
      }
      const rate = crits / TRIALS;
      // Expect between 15% and 35% (3σ range around 25%)
      expect(rate).toBeGreaterThan(0.15);
      expect(rate).toBeLessThan(0.35);
    });

    it('never produces a crit when crit_lens is not held', () => {
      const baseCtx = {
        answerTimeMs: 5000,
        cardTier: 1,
        cardType: 'attack' as const,
        isFirstChargeThisTurn: false,
        chargeCountThisEncounter: 1,
        mirrorUsedThisEncounter: false,
        adrenalineShard_usedThisTurn: false,
      };
      for (let i = 0; i < 100; i++) {
        expect(resolveChargeCorrectEffects(new Set(), baseCtx).isCrit).toBe(false);
      }
    });
  });

  describe('memory_nexus', () => {
    it('triggers drawBonus of 2 exactly on the 3rd correct Charge', () => {
      const relics = new Set(['memory_nexus']);
      const makeCtx = (chargeCount: number) => ({
        answerTimeMs: 5000,
        cardTier: 1,
        cardType: 'attack' as const,
        isFirstChargeThisTurn: false,
        chargeCountThisEncounter: chargeCount,
        mirrorUsedThisEncounter: false,
        adrenalineShard_usedThisTurn: false,
      });

      expect(resolveChargeCorrectEffects(relics, makeCtx(1)).drawBonus).toBe(0);
      expect(resolveChargeCorrectEffects(relics, makeCtx(2)).drawBonus).toBe(0);
      expect(resolveChargeCorrectEffects(relics, makeCtx(3)).drawBonus).toBe(2);
      // After 3rd hit, further hits don't re-trigger (charge count > 3, but (4-1) = 3, not < 3)
      expect(resolveChargeCorrectEffects(relics, makeCtx(4)).drawBonus).toBe(0);
    });
  });

  describe('combo_ring', () => {
    it('sets comboRingActive on the first Charge correct of the turn', () => {
      const result = resolveChargeCorrectEffects(
        new Set(['combo_ring']),
        {
          answerTimeMs: 5000,
          cardTier: 1,
          cardType: 'attack',
          isFirstChargeThisTurn: true,
          chargeCountThisEncounter: 1,
          mirrorUsedThisEncounter: false,
          adrenalineShard_usedThisTurn: false,
        },
      );
      expect(result.comboRingActive).toBe(true);
    });

    it('does NOT set comboRingActive on subsequent Charges this turn', () => {
      const result = resolveChargeCorrectEffects(
        new Set(['combo_ring']),
        {
          answerTimeMs: 5000,
          cardTier: 1,
          cardType: 'attack',
          isFirstChargeThisTurn: false,
          chargeCountThisEncounter: 2,
          mirrorUsedThisEncounter: false,
          adrenalineShard_usedThisTurn: false,
        },
      );
      expect(result.comboRingActive).toBe(false);
    });
  });
});

// ─── resolveChargeWrongEffects ──────────────────────────────────────

describe('resolveChargeWrongEffects', () => {
  const ctx = { factId: 'test_fact_001' };

  it('volatile_core: 3 self-damage, 3 enemy damage', () => {
    const result = resolveChargeWrongEffects(new Set(['volatile_core']), ctx);
    expect(result.selfDamage).toBe(3);
    expect(result.enemyDamage).toBe(3);
  });

  it('scholars_gambit: 3 self-damage', () => {
    const result = resolveChargeWrongEffects(new Set(['scholars_gambit']), ctx);
    expect(result.selfDamage).toBe(3);
    expect(result.enemyDamage).toBe(0);
  });

  it('insight_prism: sets revealAndAutopass', () => {
    const result = resolveChargeWrongEffects(new Set(['insight_prism']), ctx);
    expect(result.revealAndAutopass).toBe(true);
    expect(result.selfDamage).toBe(0);
  });

  it('volatile_core + scholars_gambit stacks: 6 self-damage total', () => {
    const result = resolveChargeWrongEffects(
      new Set(['volatile_core', 'scholars_gambit']),
      ctx,
    );
    expect(result.selfDamage).toBe(6); // 3 + 3
    expect(result.enemyDamage).toBe(3);
  });

  it('no relics: no damage, no autopass', () => {
    const result = resolveChargeWrongEffects(new Set(), ctx);
    expect(result.selfDamage).toBe(0);
    expect(result.enemyDamage).toBe(0);
    expect(result.revealAndAutopass).toBe(false);
  });
});

// ─── resolveChainCompleteEffects ────────────────────────────────────

describe('resolveChainCompleteEffects', () => {
  const ctx = (chainLength: number) => ({
    chainLength,
    firstCardId: 'card_001',
  });

  describe('chain_reactor', () => {
    it('chainLength 3 → totalSplashDamage = 18 (3 links × 6)', () => {
      const result = resolveChainCompleteEffects(
        new Set(['chain_reactor']),
        ctx(3),
      );
      expect(result.splashPerLink).toBe(6);
      expect(result.totalSplashDamage).toBe(18);
    });

    it('chainLength 2 → totalSplashDamage = 12 (2 links × 6, threshold now 2+)', () => {
      const result = resolveChainCompleteEffects(
        new Set(['chain_reactor']),
        ctx(2),
      );
      expect(result.splashPerLink).toBe(6);
      expect(result.totalSplashDamage).toBe(12);
    });

    it('chainLength 1 → no splash (below minimum)', () => {
      const result = resolveChainCompleteEffects(
        new Set(['chain_reactor']),
        ctx(1),
      );
      expect(result.splashPerLink).toBe(0);
      expect(result.totalSplashDamage).toBe(0);
    });

    it('chainLength 5 → totalSplashDamage = 30', () => {
      const result = resolveChainCompleteEffects(
        new Set(['chain_reactor']),
        ctx(5),
      );
      expect(result.totalSplashDamage).toBe(30);
    });
  });

  describe('resonance_crystal', () => {
    it('chainLength 4 → drawBonus = 2 (4 - 2)', () => {
      const result = resolveChainCompleteEffects(
        new Set(['resonance_crystal']),
        ctx(4),
      );
      expect(result.drawBonus).toBe(2);
    });

    it('chainLength 2 → drawBonus = 0 (at threshold, not beyond)', () => {
      const result = resolveChainCompleteEffects(
        new Set(['resonance_crystal']),
        ctx(2),
      );
      expect(result.drawBonus).toBe(0);
    });

    it('chainLength 3 → drawBonus = 1', () => {
      const result = resolveChainCompleteEffects(
        new Set(['resonance_crystal']),
        ctx(3),
      );
      expect(result.drawBonus).toBe(1);
    });
  });

  describe('echo_chamber', () => {
    it('chainLength 3 → echoReplay = true, echoCardPower = 0.6', () => {
      const result = resolveChainCompleteEffects(
        new Set(['echo_chamber']),
        ctx(3),
      );
      expect(result.echoReplay).toBe(true);
      expect(result.echoCardPower).toBe(0.6);
    });

    it('chainLength 2 → echoReplay = true (threshold now 2+), echoCardPower = 0.6', () => {
      const result = resolveChainCompleteEffects(
        new Set(['echo_chamber']),
        ctx(2),
      );
      expect(result.echoReplay).toBe(true);
      expect(result.echoCardPower).toBe(0.6);
    });

    it('chainLength 1 → echoReplay = false', () => {
      const result = resolveChainCompleteEffects(
        new Set(['echo_chamber']),
        ctx(1),
      );
      expect(result.echoReplay).toBe(false);
      expect(result.echoCardPower).toBe(0);
    });
  });
});

// ─── resolveSurgeStartEffects ────────────────────────────────────────

describe('resolveSurgeStartEffects', () => {
  it('time_warp: halves timer, sets 5.0× charge multiplier, and grants +1 AP', () => {
    const result = resolveSurgeStartEffects(new Set(['time_warp']));
    expect(result.timerMultiplier).toBe(0.5);
    expect(result.chargeMultiplierOverride).toBe(5.0);
    expect(result.bonusAP).toBe(1);
  });

  it('no time_warp: timer unchanged, no override, no bonus AP', () => {
    const result = resolveSurgeStartEffects(new Set());
    expect(result.timerMultiplier).toBe(1.0);
    expect(result.chargeMultiplierOverride).toBeNull();
    expect(result.bonusAP).toBe(0);
  });
});

// ─── resolveTurnEndEffectsV2 ─────────────────────────────────────────

describe('resolveTurnEndEffectsV2', () => {
  describe('capacitor', () => {
    it('stores 2 AP when 2 AP remain', () => {
      const result = resolveTurnEndEffectsV2(
        new Set(['capacitor']),
        { apUsed: 1, apRemaining: 2, shieldCardsPlayed: 0, lastCardPlayedId: null },
      );
      expect(result.storedAP).toBe(2);
    });

    it('caps stored AP at 3 when 4 AP remain', () => {
      const result = resolveTurnEndEffectsV2(
        new Set(['capacitor']),
        { apUsed: 0, apRemaining: 4, shieldCardsPlayed: 0, lastCardPlayedId: null },
      );
      expect(result.storedAP).toBe(3);
    });

    it('stores 0 when no capacitor', () => {
      const result = resolveTurnEndEffectsV2(
        new Set(),
        { apUsed: 2, apRemaining: 1, shieldCardsPlayed: 0, lastCardPlayedId: null },
      );
      expect(result.storedAP).toBe(0);
    });
  });

  describe('overflow_gem', () => {
    it('4+ AP spent → overflowGemBonus = 75', () => {
      const result = resolveTurnEndEffectsV2(
        new Set(['overflow_gem']),
        { apUsed: 4, apRemaining: 0, shieldCardsPlayed: 0, lastCardPlayedId: 'some_card' },
      );
      expect(result.overflowGemBonus).toBe(75);
    });

    it('3 AP spent → overflowGemBonus = 0', () => {
      const result = resolveTurnEndEffectsV2(
        new Set(['overflow_gem']),
        { apUsed: 3, apRemaining: 0, shieldCardsPlayed: 0, lastCardPlayedId: 'some_card' },
      );
      expect(result.overflowGemBonus).toBe(0);
    });
  });

  describe('regeneration_orb', () => {
    it('2 shield cards played → shieldPlayHeal = 3', () => {
      const result = resolveTurnEndEffectsV2(
        new Set(['regeneration_orb']),
        { apUsed: 2, apRemaining: 0, shieldCardsPlayed: 2, lastCardPlayedId: null },
      );
      expect(result.shieldPlayHeal).toBe(3);
    });

    it('1 shield card played → shieldPlayHeal = 0', () => {
      const result = resolveTurnEndEffectsV2(
        new Set(['regeneration_orb']),
        { apUsed: 1, apRemaining: 0, shieldCardsPlayed: 1, lastCardPlayedId: null },
      );
      expect(result.shieldPlayHeal).toBe(0);
    });
  });
});

// ─── V1 → V2 Save Migration ──────────────────────────────────────────

describe('migrateRelicsV1toV2', () => {
  it('needsRelicMigrationV1toV2 returns true for version < 2', () => {
    expect(needsRelicMigrationV1toV2({ version: 1 })).toBe(true);
    expect(needsRelicMigrationV1toV2({ version: undefined })).toBe(true);
    expect(needsRelicMigrationV1toV2({ version: 2 })).toBe(false);
  });

  it('preserved relic (whetstone) stays as whetstone', () => {
    const save: RelicSaveState = { version: 1, unlockedRelicIds: ['whetstone'] };
    migrateRelicsV1toV2(save);
    expect(save.unlockedRelicIds).toContain('whetstone');
    expect(save.version).toBe(2);
  });

  it('renamed relic (iron_buckler → iron_shield)', () => {
    const save: RelicSaveState = { version: 1, unlockedRelicIds: ['iron_buckler'] };
    migrateRelicsV1toV2(save);
    expect(save.unlockedRelicIds).toContain('iron_shield');
    expect(save.unlockedRelicIds).not.toContain('iron_buckler');
  });

  it('auto-unlock equivalent (chain_lightning_rod → chain_reactor)', () => {
    const save: RelicSaveState = { version: 1, unlockedRelicIds: ['chain_lightning_rod'] };
    migrateRelicsV1toV2(save);
    expect(save.unlockedRelicIds).toContain('chain_reactor');
    expect(save.unlockedRelicIds).not.toContain('chain_lightning_rod');
  });

  it('refunded paid relic (glass_cannon) → removed + +25 coins', () => {
    const save: RelicSaveState = {
      version: 1,
      unlockedRelicIds: ['glass_cannon'],
      masteryCoins: 10,
    };
    const refund = migrateRelicsV1toV2(save);
    expect(save.unlockedRelicIds).not.toContain('glass_cannon');
    expect(save.masteryCoins).toBe(35); // 10 + 25
    expect(refund).toBe(25);
  });

  it('refunded paid relic (time_dilation) → +30 coins', () => {
    const save: RelicSaveState = {
      version: 1,
      unlockedRelicIds: ['time_dilation'],
      masteryCoins: 0,
    };
    migrateRelicsV1toV2(save);
    expect(save.masteryCoins).toBe(30);
    expect(save.unlockedRelicIds).not.toContain('time_dilation');
  });

  it('free dropped relic (brain_booster) → removed, +0 coins', () => {
    const save: RelicSaveState = {
      version: 1,
      unlockedRelicIds: ['brain_booster'],
      masteryCoins: 5,
    };
    const refund = migrateRelicsV1toV2(save);
    expect(save.unlockedRelicIds).not.toContain('brain_booster');
    expect(save.masteryCoins).toBe(5); // no change
    expect(refund).toBe(0);
  });

  it('migrates active runRelics (renamed relic in mid-run save)', () => {
    const save: RelicSaveState = {
      version: 1,
      unlockedRelicIds: [],
      runRelics: [
        { definitionId: 'iron_buckler', acquiredAtFloor: 1, acquiredAtEncounter: 0, triggerCount: 2 },
      ],
    };
    migrateRelicsV1toV2(save);
    expect(save.runRelics?.[0]?.definitionId).toBe('iron_shield');
  });

  it('removes refunded relics from active run', () => {
    const save: RelicSaveState = {
      version: 1,
      unlockedRelicIds: [],
      runRelics: [
        { definitionId: 'glass_cannon', acquiredAtFloor: 2, acquiredAtEncounter: 1, triggerCount: 0 },
      ],
    };
    migrateRelicsV1toV2(save);
    expect(save.runRelics).toHaveLength(0);
  });

  it('handles mixed save: multiple relics with various migration actions', () => {
    const save: RelicSaveState = {
      version: 1,
      unlockedRelicIds: [
        'whetstone',         // preserve
        'iron_buckler',      // rename → iron_shield
        'brain_booster',     // drop
        'glass_cannon',      // refund 25 coins
        'chain_lightning_rod', // auto_unlock → chain_reactor
      ],
      masteryCoins: 0,
    };
    migrateRelicsV1toV2(save);
    expect(save.unlockedRelicIds).toContain('whetstone');
    expect(save.unlockedRelicIds).toContain('iron_shield');
    expect(save.unlockedRelicIds).toContain('chain_reactor');
    expect(save.unlockedRelicIds).not.toContain('iron_buckler');
    expect(save.unlockedRelicIds).not.toContain('brain_booster');
    expect(save.unlockedRelicIds).not.toContain('glass_cannon');
    expect(save.unlockedRelicIds).not.toContain('chain_lightning_rod');
    expect(save.masteryCoins).toBe(25);
  });

  it('does not duplicate IDs when both v1 relic and its v2 equivalent are present', () => {
    const save: RelicSaveState = {
      version: 1,
      unlockedRelicIds: ['chain_lightning_rod', 'chain_reactor'],
    };
    migrateRelicsV1toV2(save);
    const chainReactorCount = (save.unlockedRelicIds ?? []).filter((id) => id === 'chain_reactor').length;
    expect(chainReactorCount).toBe(1);
  });
});
