/**
 * Hidden relic synergy resolver.
 *
 * Defines combo bonuses that emerge when specific relics are held together.
 * Synergies are NEVER documented in-game — players discover them through play.
 * Subtle visual feedback (relic pulse) hints activation, but no tooltip explains.
 *
 * Three discovery tiers:
 *   Tier 1 (Obvious, 5-10 runs): Already work via natural stacking, just detected for UI
 *   Tier 2 (Expert, 20-50 runs): New hidden numeric bonuses
 *   Tier 3 (Mastery, 100+ runs): Deep hidden mechanics requiring game-state tracking
 */

/** Metadata for a synergy combo definition. */
export interface SynergyDefinition {
  /** Unique synergy identifier. */
  id: string;
  /** Internal name (never shown to player). */
  name: string;
  /** Relic IDs required. For `requireAnyN`, any N of these suffice. */
  requiredRelicIds: string[];
  /** If set, only N of requiredRelicIds need to be present (e.g., 2 of 3). */
  requireAnyN?: number;
  /** Discovery tier: 1=obvious, 2=expert, 3=mastery. */
  tier: 1 | 2 | 3;
}

/** Runtime record of an active synergy in the current run. */
export interface ActiveSynergy {
  id: string;
  name: string;
  /** The specific relic IDs that fulfilled this synergy. */
  matchedRelicIds: string[];
  tier: 1 | 2 | 3;
}

// ─── Synergy Definitions ────────────────────────────────────────────

export const RELIC_SYNERGIES: SynergyDefinition[] = [
  // === TIER 1: Obvious (already work via stacking, detected for UI pulse) ===
  {
    id: 'glass_berserker',
    name: 'Glass Berserker',
    requiredRelicIds: ['glass_cannon', 'berserker_band'],
    tier: 1,
  },
  {
    id: 'immortal_puncher',
    name: 'Immortal Puncher',
    requiredRelicIds: ['blood_pact', 'berserker_band'],
    tier: 1,
  },
  {
    id: 'untouchable',
    name: 'Untouchable',
    requiredRelicIds: ['fortress_wall', 'mirror_shield', 'stone_wall'],
    tier: 1,
  },

  // === TIER 2: Expert (new hidden bonuses) ===
  {
    id: 'crescendo_executioner',
    name: 'Crescendo Executioner',
    requiredRelicIds: ['crescendo_blade', 'executioners_axe'],
    tier: 2,
  },
  {
    id: 'perpetual_motion',
    name: 'Perpetual Motion',
    requiredRelicIds: ['blood_price', 'blood_pact', 'quicksilver'],
    tier: 2,
  },
  {
    id: 'knowledge_engine',
    name: 'Knowledge Engine',
    requiredRelicIds: ['eidetic_memory', 'domain_mastery', 'scholars_hat'],
    tier: 2,
  },
  {
    id: 'speed_demon',
    name: 'Speed Demon',
    requiredRelicIds: ['speed_reader', 'sharp_eye', 'speed_charm'],
    requireAnyN: 2,
    tier: 2,
  },
  {
    id: 'echo_master',
    name: 'Echo Master',
    requiredRelicIds: ['echo_lens', 'combo_ring'],
    tier: 2,
  },

  // === TIER 3: Mastery secrets (deep hidden mechanics) ===
  {
    id: 'phoenix_rage',
    name: 'Phoenix Rage',
    requiredRelicIds: ['phoenix_feather', 'glass_cannon', 'berserker_band'],
    tier: 3,
  },
  {
    id: 'perfect_storm',
    name: 'Perfect Storm',
    requiredRelicIds: ['scholars_hat', 'memory_palace', 'domain_mastery'],
    tier: 3,
  },
  {
    id: 'mastery_ascension',
    name: 'Mastery Ascension',
    // This synergy has no relic requirement — it triggers from 5+ Tier 3 cards in deck.
    // Detection is handled separately by hasMasteryAscension().
    requiredRelicIds: [],
    tier: 3,
  },
];

// ─── Detection ──────────────────────────────────────────────────────

/**
 * Detect which relic synergies are currently active.
 * Does NOT include mastery_ascension (card-count based, not relic-based).
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @returns Array of active synergies.
 */
export function detectActiveSynergies(relicIds: Set<string>): ActiveSynergy[] {
  const active: ActiveSynergy[] = [];

  for (const synergy of RELIC_SYNERGIES) {
    // Skip mastery_ascension — it's card-count based, not relic-based
    if (synergy.id === 'mastery_ascension') continue;
    if (synergy.requiredRelicIds.length === 0) continue;

    if (synergy.requireAnyN != null) {
      const matched = synergy.requiredRelicIds.filter(id => relicIds.has(id));
      if (matched.length >= synergy.requireAnyN) {
        active.push({
          id: synergy.id,
          name: synergy.name,
          matchedRelicIds: matched,
          tier: synergy.tier,
        });
      }
    } else {
      const allPresent = synergy.requiredRelicIds.every(id => relicIds.has(id));
      if (allPresent) {
        active.push({
          id: synergy.id,
          name: synergy.name,
          matchedRelicIds: [...synergy.requiredRelicIds],
          tier: synergy.tier,
        });
      }
    }
  }

  return active;
}

/**
 * Quick check: is a specific synergy active?
 *
 * @param relicIds  - Set of relic IDs the player currently holds.
 * @param synergyId - The synergy ID to check.
 * @returns True if the synergy's relic requirements are met.
 */
export function hasSynergy(relicIds: Set<string>, synergyId: string): boolean {
  const synergy = RELIC_SYNERGIES.find(s => s.id === synergyId);
  if (!synergy || synergy.requiredRelicIds.length === 0) return false;

  if (synergy.requireAnyN != null) {
    const matched = synergy.requiredRelicIds.filter(id => relicIds.has(id));
    return matched.length >= synergy.requireAnyN;
  }

  return synergy.requiredRelicIds.every(id => relicIds.has(id));
}

/**
 * Check if Mastery Ascension is active (5+ Tier 3 cards in deck).
 * Returns the flat damage bonus (+1 per T3 card, max +8).
 *
 * @param tier3CardCount - Number of Tier 3 (mastered) cards in the player's deck.
 * @returns Flat damage bonus (0 if fewer than 5 T3 cards).
 */
export function getMasteryAscensionBonus(tier3CardCount: number): number {
  if (tier3CardCount < 5) return 0;
  return Math.min(tier3CardCount, 8);
}
