import type { Relic } from './types'

// =========================================================
// V2 Relic Types
// =========================================================

/** Relic tier controls power level. (DD-V2-062, DD-V2-068) */
export type RelicTier = 'common' | 'rare' | 'legendary'

/** Relic archetypes determine synergy groupings. */
export type RelicArchetype = 'explorer' | 'delver' | 'scholar' | 'survivor'

/** A single stat modification carried by a relic. */
export interface RelicStatEffect {
  effectId: string
  description: string
  magnitude: number
}

/** Full V2 relic definition (mining system — used only within this file). */
interface RelicDefinition {
  id: string
  name: string
  description: string
  lore: string
  tier: RelicTier
  archetype: RelicArchetype
  effects: RelicStatEffect[]
  /** Emoji icon for now (spriteKey for future asset loading) */
  icon: string
  dropWeight: number
}

/** Synergy bonus for matching archetypes. */
export interface ArchetypeSynergyBonus {
  archetype: RelicArchetype
  threshold: number
  effects: RelicStatEffect[]
  description: string
}

// =========================================================
// V2 Relic Catalogue
// =========================================================

/** Full catalogue of V2 relic definitions (18 relics: 6 common, 6 rare, 6 legendary). */
export const RELIC_CATALOGUE: RelicDefinition[] = [
  // --- Common ---
  { id: 'rc_pathfinder_boots', name: "Pathfinder's Boots", description: 'Movement costs 10% less O2.', lore: 'Worn smooth by a thousand forgotten expeditions.', tier: 'common', archetype: 'explorer', effects: [{ effectId: 'o2CostMove', description: '-10% O2 per move', magnitude: -0.10 }], icon: '👢', dropWeight: 30 },
  { id: 'rc_arcane_shard', name: 'Arcane Shard', description: 'Block damage +15%.', lore: 'A shard from a legendary drill, still humming faintly.', tier: 'common', archetype: 'delver', effects: [{ effectId: 'blockDamage', description: '+15% block damage', magnitude: 0.15 }], icon: '⛏️', dropWeight: 30 },
  { id: 'rc_focus_crystal', name: 'Focus Crystal', description: 'Nailing a field scan restores +5 O2.', lore: 'Glows faintly when you get it right.', tier: 'common', archetype: 'scholar', effects: [{ effectId: 'quizO2Reward', description: '+5 O2 on correct answer', magnitude: 5 }], icon: '🔮', dropWeight: 30 },
  { id: 'rc_carbon_weave', name: 'Carbon Weave Patch', description: 'Damage taken reduced by 10%.', lore: 'Harvested from a pre-collapse pressure suit.', tier: 'common', archetype: 'survivor', effects: [{ effectId: 'damageReduction', description: '-10% damage taken', magnitude: 0.10 }], icon: '🧥', dropWeight: 30 },
  { id: 'rc_sonar_lens', name: 'Sonar Lens', description: 'Reveal radius +1 cell.', lore: 'Pings the darkness before you even ask it to.', tier: 'common', archetype: 'explorer', effects: [{ effectId: 'revealRadius', description: '+1 reveal radius', magnitude: 1 }], icon: '🔍', dropWeight: 25 },
  { id: 'rc_delvers_cadence', name: "Delver's Cadence", description: 'Mining speed +10%.', lore: 'A cadence carved into muscle memory.', tier: 'common', archetype: 'delver', effects: [{ effectId: 'miningSpeed', description: '+10% mining speed', magnitude: 0.10 }], icon: '🎵', dropWeight: 25 },
  // --- Rare ---
  { id: 'rr_cartographers_compass', name: "Cartographer's Compass", description: 'Reveal radius +3 cells. Descent shaft always revealed.', lore: 'Belonged to the last surviving surveyor of the Third Expedition.', tier: 'rare', archetype: 'explorer', effects: [{ effectId: 'revealRadius', description: '+3 reveal radius', magnitude: 3 }, { effectId: 'revealShaftOnEntry', description: 'Shaft visible on entry', magnitude: 1 }], icon: '🧭', dropWeight: 15 },
  { id: 'rr_seismic_gauntlet', name: 'Seismic Gauntlet', description: 'Block damage +30%. Shockwave every 10 blocks.', lore: 'The resonance frequency was calibrated for Earth rock.', tier: 'rare', archetype: 'delver', effects: [{ effectId: 'blockDamage', description: '+30% block damage', magnitude: 0.30 }, { effectId: 'shockwavePeriod', description: 'Shockwave every 10 blocks', magnitude: 10 }], icon: '🥊', dropWeight: 15 },
  { id: 'rr_mnemonics_codex', name: "Mnemonist's Codex", description: 'O2 cost -20%. Missed scans cost no extra O2.', lore: 'Its owner never forgot anything. Not even pain.', tier: 'rare', archetype: 'scholar', effects: [{ effectId: 'o2CostAll', description: '-20% all O2 costs', magnitude: -0.20 }, { effectId: 'suppressQuizO2Penalty', description: 'No scan O2 penalty', magnitude: 1 }], icon: '📖', dropWeight: 15 },
  { id: 'rr_aegis_shard', name: 'Aegis Shard', description: 'Damage -25%. Auto-absorbs one lethal hit per layer.', lore: 'Still radiates the warmth of whoever it saved last.', tier: 'rare', archetype: 'survivor', effects: [{ effectId: 'damageReduction', description: '-25% damage taken', magnitude: 0.25 }, { effectId: 'lethalAbsorb', description: 'Absorb 1 lethal/layer', magnitude: 1 }], icon: '🔰', dropWeight: 15 },
  { id: 'rr_quantum_focus', name: 'Quantum Focus', description: '20% chance to mine two blocks at once.', lore: 'Exists in two states: hitting and having already hit.', tier: 'rare', archetype: 'delver', effects: [{ effectId: 'doubleMineProbability', description: '20% double-mine', magnitude: 0.20 }], icon: '⚛️', dropWeight: 12 },
  { id: 'rr_leyline_tap', name: 'Leyline Tap', description: 'Passive O2 regen: +1 O2 every 5 ticks.', lore: 'Draws from something older than the dungeon.', tier: 'rare', archetype: 'survivor', effects: [{ effectId: 'o2RegenPerTicks', description: '+1 O2/5 ticks', magnitude: 5 }], icon: '💧', dropWeight: 12 },
  // --- Legendary ---
  { id: 'rl_atlas_heart', name: 'Heart of Atlas', description: 'All movement 0 O2. Reveal +5.', lore: 'A planet compressed into something small enough to carry.', tier: 'legendary', archetype: 'explorer', effects: [{ effectId: 'o2CostMove', description: '0 O2 per move', magnitude: -1.0 }, { effectId: 'revealRadius', description: '+5 reveal radius', magnitude: 5 }], icon: '🌍', dropWeight: 3 },
  { id: 'rl_arcane_crusher', name: 'Arcane Crusher', description: 'Block damage +100%. Hard rock in 1 hit.', lore: 'Built for a planet that no longer needs to be mined.', tier: 'legendary', archetype: 'delver', effects: [{ effectId: 'blockDamage', description: '+100% block damage', magnitude: 1.0 }, { effectId: 'hardRockOneHit', description: 'Hard rock 1-hit', magnitude: 1 }], icon: '💎', dropWeight: 3 },
  { id: 'rl_akashic_record', name: 'Akashic Record', description: 'Nailed scan +20 O2. All O2 costs -40%.', lore: 'Contains everything known. Reading it is the hard part.', tier: 'legendary', archetype: 'scholar', effects: [{ effectId: 'quizO2Reward', description: '+20 O2 on correct', magnitude: 20 }, { effectId: 'o2CostAll', description: '-40% all O2', magnitude: -0.40 }], icon: '📜', dropWeight: 3 },
  { id: 'rl_phoenix_core', name: 'Phoenix Core', description: 'Resurrect once at 30% O2. Damage -40%.', lore: 'The last backup of something that refused to end.', tier: 'legendary', archetype: 'survivor', effects: [{ effectId: 'resurrection', description: 'Resurrect once/run', magnitude: 1 }, { effectId: 'damageReduction', description: '-40% damage', magnitude: 0.40 }], icon: '🔥', dropWeight: 3 },
  { id: 'rl_gravity_lens', name: 'Gravity Lens', description: 'Free movement. Shaft moves toward you.', lore: 'The shaft finds you.', tier: 'legendary', archetype: 'explorer', effects: [{ effectId: 'o2CostMove', description: '0 O2 per move', magnitude: -1.0 }, { effectId: 'shaftAttraction', description: 'Shaft approach/10 ticks', magnitude: 10 }], icon: '🌀', dropWeight: 2 },
  { id: 'rl_epoch_hammer', name: 'Epoch Hammer', description: '3×3 AoE every 5 blocks. +80% damage.', lore: 'Five million years of geology. Five swings.', tier: 'legendary', archetype: 'delver', effects: [{ effectId: 'aoeMinePeriod', description: '3×3 AoE/5 blocks', magnitude: 5 }, { effectId: 'blockDamage', description: '+80% damage', magnitude: 0.80 }], icon: '🔨', dropWeight: 2 },
]

/** Archetype synergy bonuses granted when 2+ relics of the same archetype are equipped. */
export const ARCHETYPE_SYNERGY_BONUSES: ArchetypeSynergyBonus[] = [
  { archetype: 'explorer', threshold: 2, effects: [{ effectId: 'revealRadius', description: '+2 reveal (Explorer synergy)', magnitude: 2 }, { effectId: 'o2CostMove', description: '-5% O2/move (Explorer)', magnitude: -0.05 }], description: 'Explorer Synergy (2+): +2 reveal radius, -5% move O2.' },
  { archetype: 'delver', threshold: 2, effects: [{ effectId: 'blockDamage', description: '+20% damage (Delver synergy)', magnitude: 0.20 }, { effectId: 'critChance', description: '+10% crit (Delver)', magnitude: 0.10 }], description: 'Delver Synergy (2+): +20% damage, +10% crit.' },
  { archetype: 'scholar', threshold: 2, effects: [{ effectId: 'quizO2Reward', description: '+10 O2/scan (Scholar synergy)', magnitude: 10 }, { effectId: 'quizCooldownReduction', description: '-25% cooldown (Scholar)', magnitude: -0.25 }], description: 'Scholar Synergy (2+): +10 O2/scan, -25% cooldown.' },
  { archetype: 'survivor', threshold: 2, effects: [{ effectId: 'damageReduction', description: '+15% DR (Survivor synergy)', magnitude: 0.15 }, { effectId: 'o2RegenPerTicks', description: '+1 O2/8 ticks (Survivor)', magnitude: 8 }], description: 'Survivor Synergy (2+): +15% DR, +1 O2/8 ticks.' },
]

// =========================================================
// Synergy System (V1 — kept for backward compatibility)
// =========================================================

/** A bonus effect granted when two or more relics are combined. */
export interface RelicSynergy {
  id: string
  name: string
  description: string
  icon: string // emoji
  requiredRelics: string[] // relic IDs needed
  effect: SynergyEffect
}

export type SynergyEffect =
  | { type: 'oxygen_regen_boost'; amount: number }
  | { type: 'loot_multiplier'; multiplier: number }
  | { type: 'hazard_immunity' }
  | { type: 'reveal_all_specials' }
  | { type: 'double_artifact_chance' }

/** All available relic synergies. */
export const SYNERGIES: RelicSynergy[] = [
  {
    id: 'survivors_kit',
    name: "Survivor's Kit",
    description: 'O2 Heart + Tough Skin: regen 2x faster.',
    icon: '💪',
    requiredRelics: ['oxygen_heart', 'tough_skin'],
    effect: { type: 'oxygen_regen_boost', amount: 3 }, // +3 extra O2 per 10 blocks
  },
  {
    id: 'treasure_hunter',
    name: 'Treasure Hunter',
    description: 'Lucky Strike + Loot Magnet: 1.5x loot drops.',
    icon: '💰',
    requiredRelics: ['lucky_strike', 'loot_magnet'],
    effect: { type: 'loot_multiplier', multiplier: 1.5 },
  },
  {
    id: 'deep_diver',
    name: 'Deep Diver',
    description: 'Deep Breath + Tough Skin: immune to hazards.',
    icon: '🌊',
    requiredRelics: ['deep_breath', 'tough_skin'],
    effect: { type: 'hazard_immunity' },
  },
  {
    id: 'scholars_blessing',
    name: "Scholar's Blessing",
    description: 'Scan Expert + Lucky Strike: double artifact chances.',
    icon: '📚',
    requiredRelics: ['quiz_master', 'lucky_strike'],
    effect: { type: 'double_artifact_chance' },
  },
]

/**
 * Check which synergies are active given collected relic IDs.
 *
 * @param relicIds - IDs of relics currently held
 */
export function getActiveSynergies(relicIds: string[]): RelicSynergy[] {
  return SYNERGIES.filter(syn =>
    syn.requiredRelics.every(req => relicIds.includes(req))
  )
}

// =========================================================
// Relic catalogue
// =========================================================

/** All relics available in the game */
export const RELICS: Relic[] = [
  {
    id: 'oxygen_heart',
    name: 'Oxygen Heart',
    description: 'Restores 3 HP every 10 cards played',
    icon: '💚',
    effect: { type: 'oxygen_regen', amount: 3 },
  },
  {
    id: 'loot_magnet',
    name: 'Loot Magnet',
    description: 'Auto-collects loot within 2 tiles',
    icon: '🧲',
    effect: { type: 'loot_magnet', radius: 2 },
  },
  {
    id: 'tough_skin',
    name: 'Tough Skin',
    description: 'Reduces hazard oxygen costs by 5',
    icon: '🛡️',
    effect: { type: 'tough_skin', reduction: 5 },
  },
  {
    id: 'lucky_strike',
    name: 'Lucky Strike',
    description: '20% chance to double loot drops',
    icon: '🍀',
    effect: { type: 'lucky_strike', chance: 0.20 },
  },
  {
    id: 'deep_breath',
    name: 'Deep Breath',
    description: '+25 maximum oxygen capacity',
    icon: '🫁',
    effect: { type: 'deep_breath', bonus: 25 },
  },
  {
    id: 'quiz_master',
    name: 'Scan Expert',
    description: '+5 bonus dust on nailed field scans',
    icon: '🎓',
    effect: { type: 'quiz_master', bonus: 5 },
  },
]

/**
 * Pick a random relic the player doesn't already have this run.
 * Returns null if the player has collected all available relics.
 *
 * @param ownedRelicIds - IDs of relics already collected this run
 * @param rng - Seeded random number generator
 */
export function pickRandomRelic(ownedRelicIds: string[], rng: () => number): Relic | null {
  const available = RELICS.filter(r => !ownedRelicIds.includes(r.id))
  if (available.length === 0) return null
  return available[Math.floor(rng() * available.length)]
}
