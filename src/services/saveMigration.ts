/**
 * Save migration utilities.
 *
 * Handles versioned migration of player save data between game versions.
 * V1 → V2: Relic catalogue replacement (50 relics → 42 relics).
 */

// ─── V1 → V2 Relic Migration Map ────────────────────────────────────

/**
 * Describes how to handle a v1 relic ID during migration to v2.
 *
 * - `'preserve'`: Same ID, same effects — no change needed.
 * - `'rename'`: ID changes to `v2Id`.
 * - `'auto_unlock'`: No same ID, but unlock the equivalent v2 relic.
 * - `'refund'`: Remove relic, add `coinRefund` to Mastery Coin balance.
 * - `'drop'`: Remove relic, no refund (was a free starter).
 */
export type V1RelicMigrationAction =
  | { action: 'preserve' }
  | { action: 'rename'; v2Id: string }
  | { action: 'auto_unlock'; v2Id: string }
  | { action: 'refund'; coinRefund: number }
  | { action: 'drop' };

/** Full v1 → v2 migration map for all 50 v1 relic IDs. */
export const V1_TO_V2_RELIC_MAP: Record<string, V1RelicMigrationAction> = {
  // Stat sticks — preserved
  whetstone:          { action: 'preserve' },
  steel_skin:         { action: 'preserve' },
  swift_boots:        { action: 'preserve' },

  // Renamed
  iron_buckler:       { action: 'rename', v2Id: 'iron_shield' },
  scavengers_pouch:   { action: 'rename', v2Id: 'scavengers_eye' },

  // Auto-unlock equivalents
  thorned_vest:       { action: 'auto_unlock', v2Id: 'thorn_crown' },
  stone_wall:         { action: 'auto_unlock', v2Id: 'aegis_stone' },
  venom_fang:         { action: 'auto_unlock', v2Id: 'plague_flask' },
  berserker_band:     { action: 'auto_unlock', v2Id: 'reckless_resolve' },
  chain_lightning_rod: { action: 'auto_unlock', v2Id: 'chain_reactor' },
  renewal_spring:     { action: 'auto_unlock', v2Id: 'regeneration_orb' },
  quicksilver:        { action: 'auto_unlock', v2Id: 'adrenaline_shard' },
  echo_lens:          { action: 'drop' }, // echo system removed
  double_vision:      { action: 'auto_unlock', v2Id: 'double_down' },
  polyglot_pendant:   { action: 'auto_unlock', v2Id: 'domain_mastery_sigil' },
  eidetic_memory:     { action: 'auto_unlock', v2Id: 'scholars_crown' },
  speed_reader:       { action: 'auto_unlock', v2Id: 'quicksilver_quill' },
  domain_mastery:     { action: 'auto_unlock', v2Id: 'domain_mastery_sigil' },
  prospectors_pick:   { action: 'auto_unlock', v2Id: 'scavengers_eye' },
  memory_palace:      { action: 'auto_unlock', v2Id: 'memory_nexus' },

  // Relic reworks that change ID
  herbal_pouch:       { action: 'preserve' }, // v2 changes trigger timing, kept same ID
  vitality_ring:      { action: 'preserve' }, // v2 changes value (+15→+12), kept same ID
  gold_magnet:        { action: 'preserve' }, // v2 changes value (+25%→+30%), kept same ID
  lucky_coin:         { action: 'preserve' }, // v2 reworked effect, kept same ID
  last_breath:        { action: 'preserve' }, // v2 drops +5 dmg effect, kept same ID
  combo_ring:         { action: 'drop' }, // combo system removed
  echo_chamber:       { action: 'drop' }, // echo system removed
  blood_price:        { action: 'preserve' }, // v2 changes to -2 HP/turn, kept same ID
  phoenix_feather:    { action: 'preserve' }, // v2 reworks to once/run, kept same ID

  // Already in v2 catalogue as-is
  scholars_gambit:    { action: 'preserve' },
  fortress_wall:      { action: 'refund', coinRefund: 45 }, // merged into aegis_stone

  // Paid relics with no v2 equivalent — refund coins
  glass_cannon:       { action: 'refund', coinRefund: 25 },
  crescendo_blade:    { action: 'refund', coinRefund: 45 },
  executioners_axe:   { action: 'refund', coinRefund: 50 },
  mirror_shield:      { action: 'refund', coinRefund: 50 },
  iron_resolve:       { action: 'refund', coinRefund: 40 },
  phase_cloak:        { action: 'refund', coinRefund: 60 },
  blood_pact:         { action: 'refund', coinRefund: 40 },
  time_dilation:      { action: 'refund', coinRefund: 30 },
  afterimage:         { action: 'refund', coinRefund: 40 },
  miser_ring:         { action: 'refund', coinRefund: 50 },

  // Free starters with no v2 equivalent — drop silently
  flame_brand:        { action: 'drop' },
  barbed_edge:        { action: 'drop' },
  war_drum:           { action: 'drop' },
  sharp_eye:          { action: 'drop' },
  scholars_hat:       { action: 'drop' },
  memory_palace_old:  { action: 'drop' }, // in case of duplicate key
  curiosity_gem:      { action: 'drop' },
  brain_booster:      { action: 'drop' },
  medic_kit:          { action: 'drop' },
  speed_charm:        { action: 'drop' },
  cartographers_lens: { action: 'drop' },
  momentum_gem:       { action: 'drop' },
};

// ─── Save Version Types ──────────────────────────────────────────────

/** Minimal shape of a v1/v2 save that contains relic state. */
export interface RelicSaveState {
  /** Version of the save format. */
  version?: number;
  /** Set of relic IDs the player has unlocked in the Hub. */
  unlockedRelicIds?: string[];
  /** Relics currently equipped in an active run. */
  runRelics?: Array<{ definitionId: string; [key: string]: unknown }>;
  /** Player's Mastery Coin balance. */
  masteryCoins?: number;
}

// ─── Migration Function ──────────────────────────────────────────────

/**
 * Migrate a save from v1 relic catalogue to v2.
 *
 * Mutates `save` in-place and sets `save.version = 2`.
 *
 * Actions taken per relic:
 * - `preserve`: no change
 * - `rename`: update ID in unlockedRelicIds and runRelics
 * - `auto_unlock`: add v2 equivalent ID to unlockedRelicIds (replace v1 ID)
 * - `refund`: remove ID, add coinRefund to masteryCoins
 * - `drop`: remove ID silently
 *
 * @param save - The save state to migrate (mutated in-place).
 * @returns The coin refund total applied.
 */
export function migrateRelicsV1toV2(save: RelicSaveState): number {
  let totalRefund = 0;
  const newUnlockedIds: string[] = [];

  for (const id of save.unlockedRelicIds ?? []) {
    const migration = V1_TO_V2_RELIC_MAP[id];

    if (!migration) {
      // Unknown relic ID — keep it as-is (may be a v2 relic already); deduplicate
      if (!newUnlockedIds.includes(id)) {
        newUnlockedIds.push(id);
      }
      continue;
    }

    switch (migration.action) {
      case 'preserve':
        newUnlockedIds.push(id);
        break;

      case 'rename':
        // Replace with new ID (avoid duplicates)
        if (!newUnlockedIds.includes(migration.v2Id)) {
          newUnlockedIds.push(migration.v2Id);
        }
        break;

      case 'auto_unlock':
        // Unlock v2 equivalent (avoid duplicates)
        if (!newUnlockedIds.includes(migration.v2Id)) {
          newUnlockedIds.push(migration.v2Id);
        }
        break;

      case 'refund':
        totalRefund += migration.coinRefund;
        // Do NOT push id — relic is removed
        break;

      case 'drop':
        // Silently removed
        break;
    }
  }

  save.unlockedRelicIds = newUnlockedIds;

  // Migrate active run relics (mid-run saves)
  if (save.runRelics && save.runRelics.length > 0) {
    save.runRelics = save.runRelics
      .map((rr) => {
        const migration = V1_TO_V2_RELIC_MAP[rr.definitionId];
        if (!migration) return rr; // unknown — keep

        switch (migration.action) {
          case 'preserve': return rr;
          case 'rename': return { ...rr, definitionId: migration.v2Id };
          case 'auto_unlock': return { ...rr, definitionId: migration.v2Id };
          case 'refund': return null; // remove from active run
          case 'drop': return null;  // remove from active run
        }
      })
      .filter((rr): rr is NonNullable<typeof rr> => rr !== null);
  }

  // Apply coin refunds
  if (totalRefund > 0) {
    save.masteryCoins = (save.masteryCoins ?? 0) + totalRefund;
  }

  save.version = 2;
  return totalRefund;
}

/**
 * Check whether a save requires V1→V2 relic migration.
 *
 * @param save - The save state to inspect.
 * @returns True if migration is needed.
 */
export function needsRelicMigrationV1toV2(save: RelicSaveState): boolean {
  return (save.version ?? 1) < 2;
}

// ─── V2 → V3 Journal/Profile Data Migration ─────────────────────────────────

/**
 * Migrate a save from v2 to v3.
 *
 * V3 adds: runHistory, lifetimeEnemyKillCounts, and new PlayerStats counters
 * (totalVictories, totalDefeats, totalRetreats, cumulativePlaytimeMs,
 *  totalEnemiesDefeated, totalElitesDefeated, totalBossesDefeated, lifetimeFactsMastered).
 *
 * All new fields default to 0 / empty — historical data cannot be reconstructed.
 *
 * Mutates `save` in-place and sets `save.version = 3`.
 */
export function migrateV2toV3(save: Record<string, unknown>): void {
  // New PlayerSave fields
  if (!Array.isArray(save['runHistory'])) {
    save['runHistory'] = [];
  }
  if (!save['lifetimeEnemyKillCounts'] || typeof save['lifetimeEnemyKillCounts'] !== 'object') {
    save['lifetimeEnemyKillCounts'] = {};
  }

  // New PlayerStats fields — default all counters to 0
  const stats = save['stats'] as Record<string, unknown> | undefined;
  if (stats) {
    if (typeof stats['totalVictories'] !== 'number') stats['totalVictories'] = 0;
    if (typeof stats['totalDefeats'] !== 'number') stats['totalDefeats'] = 0;
    if (typeof stats['totalRetreats'] !== 'number') stats['totalRetreats'] = 0;
    if (typeof stats['cumulativePlaytimeMs'] !== 'number') stats['cumulativePlaytimeMs'] = 0;
    if (typeof stats['totalEnemiesDefeated'] !== 'number') stats['totalEnemiesDefeated'] = 0;
    if (typeof stats['totalElitesDefeated'] !== 'number') stats['totalElitesDefeated'] = 0;
    if (typeof stats['totalBossesDefeated'] !== 'number') stats['totalBossesDefeated'] = 0;
    if (typeof stats['lifetimeFactsMastered'] !== 'number') stats['lifetimeFactsMastered'] = 0;
  }

  save['version'] = 3;
}

/**
 * Returns true if the save requires V2 → V3 migration.
 */
export function needsMigrationV2toV3(save: Record<string, unknown>): boolean {
  return ((save['version'] as number | undefined) ?? 1) < 3;
}
