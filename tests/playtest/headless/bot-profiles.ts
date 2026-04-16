/**
 * Bot Profiles — Named Skill Configurations for Headless Simulator
 * =================================================================
 * Provides preset BotSkills profiles for use with BotBrain.
 * Includes:
 *  - LEGACY_PROFILES: backward-compatible with the 6 original run-batch.ts profiles (@deprecated)
 *  - ARCHETYPE_PROFILES: strategy composites (turtle, chain_god, speedrunner, etc.)
 *  - PROGRESSION_PROFILES: learning-curve model — 5 stages from first run to mastery + language_learner specialty
 *  - ALL_PROFILES: merged lookup for --profile flag
 *  - Generators: sweep profiles, isolation profiles
 *
 * Usage:
 *   import { ALL_PROFILES } from './bot-profiles.js';
 *   const skills = ALL_PROFILES['scholar'];
 *   const brain  = new BotBrain(skills);
 */

import type { BotSkills, BuildPreferences } from './bot-brain.js';

// ──────────────────────────────────────────────────────────────────────────────
// Skill axis registry (all axes except accuracy, which is special)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * All non-accuracy BotSkills axes.
 * Used for sweep generation and isolation profiles.
 */
export const SKILL_AXES = [
  'cardSelection',
  'chargeSkill',
  'chainSkill',
  'blockSkill',
  'apEfficiency',
  'surgeAwareness',
  'masteryHunting',
  'rewardSkill',
  'shopSkill',
  'restSkill',
  'relicSkill',
  'apDiscipline',
  'chargeDiscipline',
] as const;

export type SkillAxis = typeof SKILL_AXES[number];

// ──────────────────────────────────────────────────────────────────────────────
// makeSkills — builder helper
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Build a BotSkills object from explicit overrides plus a baseline for all
 * unspecified axes. Accuracy always defaults to 0.65 if not overridden.
 *
 * @param overrides  Partial skills to set explicitly
 * @param baseline   Value for all unspecified skill axes (default: 0.5)
 */
export function makeSkills(overrides: Partial<BotSkills>, baseline: number = 0.5): BotSkills {
  const base: BotSkills = {
    accuracy:        baseline,
    cardSelection:   baseline,
    chargeSkill:     baseline,
    chainSkill:      baseline,
    blockSkill:      baseline,
    apEfficiency:    baseline,
    surgeAwareness:  baseline,
    masteryHunting:  baseline,
    rewardSkill:     baseline,
    shopSkill:       baseline,
    restSkill:       baseline,
    relicSkill:      baseline,
    apDiscipline:    1.0,  // default: always uses all AP (backwards compat — existing profiles unaffected)
    chargeDiscipline: 1.0, // default: optimal EV-positive charging (backwards compat)
  };
  return { ...base, ...overrides };
}

// ──────────────────────────────────────────────────────────────────────────────
// Legacy profiles — backward-compatible with run-batch.ts PROFILES
// ──────────────────────────────────────────────────────────────────────────────

/**
 * The original 6 run-batch.ts profiles mapped to BotSkills.
 * Accuracy values match the original; skill axes are calibrated to represent
 * the implied strategy levels of each original profile.
 *
 * @deprecated Use PROGRESSION_PROFILES for balance work. Legacy profiles are
 *   static archetypes that do not model a realistic player learning curve.
 *   Still accessible via `--profile first_timer` etc. for backward compatibility.
 */
export const LEGACY_PROFILES: Record<string, BotSkills> = {
  /** Confused new player: poor accuracy, rarely charges, no strategy. */
  first_timer: makeSkills({
    accuracy:       0.45,
    cardSelection:  0.0,
    chargeSkill:    0.1,
    chainSkill:     0.0,
    blockSkill:     0.0,
    apEfficiency:   0.2,
    surgeAwareness: 0.0,
    masteryHunting: 0.0,
    rewardSkill:    0.2,
    shopSkill:      0.2,
    restSkill:      0.0,
    relicSkill:     0.0,
  }, 0),

  /** Casual player: decent accuracy, some charging, minimal strategy. */
  casual_learner: makeSkills({
    accuracy:       0.65,
    cardSelection:  0.2,
    chargeSkill:    0.35,
    chainSkill:     0.1,
    blockSkill:     0.1,
    apEfficiency:   0.4,
    surgeAwareness: 0.1,
    masteryHunting: 0.1,
    rewardSkill:    0.3,
    shopSkill:      0.3,
    restSkill:      0.3,
    relicSkill:     0.2,
  }, 0),

  /** Regular player: moderate skill across all axes. */
  regular: makeSkills({
    accuracy:       0.62,
    cardSelection:  0.4,
    chargeSkill:    0.4,
    chainSkill:     0.2,
    blockSkill:     0.3,
    apEfficiency:   0.5,
    surgeAwareness: 0.2,
    masteryHunting: 0.2,
    rewardSkill:    0.5,
    shopSkill:      0.5,
    restSkill:      0.5,
    relicSkill:     0.4,
  }, 0),

  /** Lower accuracy but good game mechanics — typical "gamer" profile. */
  gamer: makeSkills({
    accuracy:       0.55,
    cardSelection:  0.6,
    chargeSkill:    0.5,
    chainSkill:     0.4,
    blockSkill:     0.5,
    apEfficiency:   0.7,
    surgeAwareness: 0.5,
    masteryHunting: 0.4,
    rewardSkill:    0.6,
    shopSkill:      0.6,
    restSkill:      0.6,
    relicSkill:     0.5,
  }, 0),

  /** Dedicated player: high accuracy, solid strategic play. */
  dedicated: makeSkills({
    accuracy:       0.70,
    cardSelection:  0.7,
    chargeSkill:    0.7,
    chainSkill:     0.6,
    blockSkill:     0.6,
    apEfficiency:   0.8,
    surgeAwareness: 0.7,
    masteryHunting: 0.6,
    rewardSkill:    0.7,
    shopSkill:      0.7,
    restSkill:      0.7,
    relicSkill:     0.7,
  }, 0),

  /** Scholar: highest accuracy, near-optimal strategy on all axes. */
  scholar: makeSkills({
    accuracy:       0.82,
    cardSelection:  0.8,
    chargeSkill:    0.85,
    chainSkill:     0.7,
    blockSkill:     0.7,
    apEfficiency:   0.9,
    surgeAwareness: 0.8,
    masteryHunting: 0.8,
    rewardSkill:    0.8,
    shopSkill:      0.8,
    restSkill:      0.8,
    relicSkill:     0.9,
  }, 0),
};

// ──────────────────────────────────────────────────────────────────────────────
// Archetype profiles — strategy composites
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Named strategic archetypes for testing how specific skill axes affect
 * win rates and run quality.
 */
export const ARCHETYPE_PROFILES: Record<string, BotSkills> = {
  /**
   * Turtle: maximizes block/shield usage, rarely charges offensively,
   * always heals at rest sites. Wins through attrition defense.
   */
  turtle: makeSkills({
    accuracy:       0.60,
    blockSkill:     1.0,
    chargeSkill:    0.2,
    chainSkill:     0.0,
    apEfficiency:   0.7,
    rewardSkill:    0.6,
    restSkill:      0.8,
    relicSkill:     0.4,
  }),

  /**
   * Chain God: maximizes chain type sequencing and surge exploitation.
   * High accuracy enables sustained charge chains.
   */
  chain_god: makeSkills({
    accuracy:       0.80,
    chainSkill:     1.0,
    chargeSkill:    0.9,
    surgeAwareness: 0.8,
    masteryHunting: 0.7,
    apEfficiency:   0.8,
    relicSkill:     0.6,
  }),

  /**
   * Speedrunner: AP efficiency and surge exploitation maximized.
   * Charges rarely (low accuracy gamble), but plays fast and uses all AP.
   */
  speedrunner: makeSkills({
    accuracy:       0.50,
    apEfficiency:   1.0,
    surgeAwareness: 1.0,
    chargeSkill:    0.3,
    cardSelection:  0.8,
    relicSkill:     0.3,
  }),

  /**
   * Mastery Farmer: charges as many high-scaling cards as possible.
   * Studies at rest sites, hunts mastery gains obsessively.
   */
  mastery_farmer: makeSkills({
    accuracy:       0.75,
    masteryHunting: 1.0,
    chargeSkill:    0.8,
    restSkill:      1.0,
    rewardSkill:    0.7,
    relicSkill:     0.5,
  }),

  /**
   * Quick Player: never charges — uses quick play for everything.
   * Tests AP efficiency and card selection without quiz variance.
   */
  quick_player: makeSkills({
    accuracy:       0.70,
    chargeSkill:    0.0,
    chainSkill:     0.0,
    apEfficiency:   0.9,
    cardSelection:  0.7,
    blockSkill:     0.5,
    relicSkill:     0.3,
  }),

  /**
   * Glass Cannon: always charges, never blocks, ignores HP.
   * Maximum offensive pressure — tests whether aggression can overcome attrition.
   */
  glass_cannon: makeSkills({
    accuracy:       0.85,
    chargeSkill:    1.0,
    chainSkill:     1.0,
    blockSkill:     0.0,
    surgeAwareness: 1.0,
    masteryHunting: 0.8,
    relicSkill:     0.5,
  }),

  /**
   * Balanced Pro: everything at 0.8 with 0.75 accuracy.
   * Solid all-around player, no specific weaknesses.
   */
  balanced_pro: makeSkills({ accuracy: 0.75 }, 0.8),

  /**
   * Complete Noob: everything at 0 — worst possible player.
   * Sanity check: should lose frequently.
   */
  complete_noob: makeSkills({ accuracy: 0.35 }, 0),

  /**
   * Perfect Player: everything maxed — ceiling test.
   * Should win nearly every run at ascension 0.
   */
  perfect_player: makeSkills({ accuracy: 0.90 }, 1.0),
};

// ──────────────────────────────────────────────────────────────────────────────
// Progression profiles — learning curve model
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Progression-based profiles modeling a single player's learning curve.
 * Replaces the static archetype approach. Each profile represents a
 * stage in the player journey from first run to mastery.
 *
 * Accuracy models 4-option MCQ on curated knowledge decks.
 * Game skill axes model gradual system discovery through play.
 *
 * These are the DEFAULT profiles when running run-batch.ts with no --profile flag.
 * Use them for balance work — they capture the realistic spread of win rates
 * across the full player lifecycle, not just static skill archetypes.
 */
export const PROGRESSION_PROFILES: Record<string, BotSkills> = {
  /** Runs 1-3: First contact with game and content. Tutorial-level strategy. */
  new_player: makeSkills({
    accuracy:       0.50,
    cardSelection:  0.10,
    chargeSkill:    0.15,
    chainSkill:     0.00,
    blockSkill:     0.05,
    apEfficiency:   0.15,
    surgeAwareness: 0.00,
    masteryHunting: 0.00,
    rewardSkill:    0.10,
    shopSkill:      0.10,
    restSkill:      0.05,
    relicSkill:     0.00,
  }, 0),

  /** Runs 4-10: Content recognition starting, basic strategy emerging. */
  developing: makeSkills({
    accuracy:       0.60,
    cardSelection:  0.25,
    chargeSkill:    0.35,
    chainSkill:     0.15,
    blockSkill:     0.20,
    apEfficiency:   0.35,
    surgeAwareness: 0.10,
    masteryHunting: 0.10,
    rewardSkill:    0.30,
    shopSkill:      0.25,
    restSkill:      0.25,
    relicSkill:     0.20,
  }, 0),

  /** Runs 11-25: All systems understood, strategic play begins. The average engaged player. */
  competent: makeSkills({
    accuracy:       0.68,
    cardSelection:  0.45,
    chargeSkill:    0.50,
    chainSkill:     0.35,
    blockSkill:     0.35,
    apEfficiency:   0.50,
    surgeAwareness: 0.30,
    masteryHunting: 0.25,
    rewardSkill:    0.50,
    shopSkill:      0.45,
    restSkill:      0.45,
    relicSkill:     0.40,
  }, 0),

  /** Runs 25-50: Strong deck knowledge, optimizes most decisions. */
  experienced: makeSkills({
    accuracy:       0.76,
    cardSelection:  0.65,
    chargeSkill:    0.70,
    chainSkill:     0.60,
    blockSkill:     0.55,
    apEfficiency:   0.75,
    surgeAwareness: 0.65,
    masteryHunting: 0.55,
    rewardSkill:    0.70,
    shopSkill:      0.65,
    restSkill:      0.65,
    relicSkill:     0.65,
  }, 0),

  /** Runs 50+: Near-perfect knowledge, near-optimal strategy. The aspirational ceiling. */
  master: makeSkills({
    accuracy:       0.85,
    cardSelection:  0.80,
    chargeSkill:    0.85,
    chainSkill:     0.75,
    blockSkill:     0.70,
    apEfficiency:   0.90,
    surgeAwareness: 0.80,
    masteryHunting: 0.75,
    rewardSkill:    0.80,
    shopSkill:      0.80,
    restSkill:      0.80,
    relicSkill:     0.85,
  }, 0),

  /** Specialty: Foreign language deck with zero prior knowledge (JLPT, HSK, TOPIK, CEFR). */
  language_learner: makeSkills({
    accuracy:       0.35,
    cardSelection:  0.45,
    chargeSkill:    0.50,
    chainSkill:     0.35,
    blockSkill:     0.35,
    apEfficiency:   0.50,
    surgeAwareness: 0.30,
    masteryHunting: 0.25,
    rewardSkill:    0.50,
    shopSkill:      0.45,
    restSkill:      0.45,
    relicSkill:     0.40,
  }, 0),

  /**
   * Novice: struggling real player who wastes AP and charges recklessly.
   * Models the player who understands the basic loop but makes costly execution errors —
   * ending turns early without playing all cards, and charging compulsively without
   * considering whether accuracy justifies the AP surcharge.
   * Target survival: 40–70% (vs new_player 5–15% and developing 30–50%).
   * Key difference from new_player: game knowledge is developing (0.2–0.4 axes) but
   * execution is hobbled by apDiscipline=0.4 and chargeDiscipline=0.2.
   */
  novice: makeSkills({
    accuracy:         0.55,
    cardSelection:    0.20,
    chargeSkill:      0.30,
    chainSkill:       0.10,
    blockSkill:       0.20,
    apEfficiency:     0.30,
    surgeAwareness:   0.10,
    masteryHunting:   0.10,
    rewardSkill:      0.30,
    shopSkill:        0.20,
    restSkill:        0.50,
    relicSkill:       0.20,
    apDiscipline:     0.40,  // wastes AP ~24% of turns (ends turn early, leaves cards unplayed)
    chargeDiscipline: 0.20,  // charges recklessly ~80% of the time regardless of accuracy EV
  }, 0),
};

// ──────────────────────────────────────────────────────────────────────────────
// Build profiles — mechanics-focused bots with BuildPreferences
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Build-specific profiles that guide the bot to prefer particular mechanics
 * and relics to simulate archetype-focused play strategies.
 * All use 0.76 accuracy (experienced baseline) unless noted.
 */
export const BUILD_PROFILES: Record<string, { label: string; skills: BotSkills; buildPrefs: BuildPreferences }> = {
  build_poison: {
    label: 'Build: Poison/DoT',
    skills: { accuracy: 0.76, cardSelection: 0.65, chargeSkill: 0.65, chainSkill: 0.5, blockSkill: 0.4, apEfficiency: 0.6, surgeAwareness: 0.5, masteryHunting: 0.8, rewardSkill: 0.7, shopSkill: 0.5, restSkill: 0.6, relicSkill: 0.7, apDiscipline: 1.0, chargeDiscipline: 1.0 },
    buildPrefs: { preferredMechanics: ['hex', 'lacerate', 'kindle', 'corroding_touch', 'corrode'], preferredRelicCategories: ['poison'], preferredRelicIds: ['herbal_pouch', 'plague_flask'] },
  },
  build_fortress: {
    label: 'Build: Fortress/Block',
    skills: { accuracy: 0.76, cardSelection: 0.7, chargeSkill: 0.6, chainSkill: 0.4, blockSkill: 1.0, apEfficiency: 0.7, surgeAwareness: 0.4, masteryHunting: 0.6, rewardSkill: 0.7, shopSkill: 0.5, restSkill: 0.6, relicSkill: 0.7, apDiscipline: 1.0, chargeDiscipline: 1.0 },
    buildPrefs: { preferredMechanics: ['block', 'fortify', 'reinforce', 'absorb', 'thorns', 'bulwark', 'brace', 'guard'], preferredRelicCategories: ['defensive'], preferredRelicIds: ['iron_shield', 'aegis_stone', 'stone_wall'] },
  },
  build_strength: {
    label: 'Build: Strength/Power',
    skills: { accuracy: 0.76, cardSelection: 0.7, chargeSkill: 0.85, chainSkill: 0.5, blockSkill: 0.3, apEfficiency: 0.6, surgeAwareness: 0.6, masteryHunting: 0.7, rewardSkill: 0.7, shopSkill: 0.5, restSkill: 0.5, relicSkill: 0.7, apDiscipline: 1.0, chargeDiscipline: 1.0 },
    buildPrefs: { preferredMechanics: ['power_strike', 'empower', 'iron_wave', 'reckless', 'heavy_strike', 'bash'], preferredRelicCategories: ['offensive'], preferredRelicIds: ['brass_knuckles', 'whetstone', 'volatile_core', 'berserker_band'] },
  },
  build_chain: {
    label: 'Build: Chain Master',
    skills: { accuracy: 0.76, cardSelection: 0.7, chargeSkill: 0.9, chainSkill: 1.0, blockSkill: 0.4, apEfficiency: 0.7, surgeAwareness: 0.9, masteryHunting: 0.6, rewardSkill: 0.6, shopSkill: 0.5, restSkill: 0.5, relicSkill: 0.7, apDiscipline: 1.0, chargeDiscipline: 1.0 },
    buildPrefs: { preferredMechanics: ['chain_anchor', 'strike', 'twin_strike'], preferredRelicCategories: ['chain'], preferredRelicIds: ['chain_addict', 'obsidian_dice'] },
  },
  build_exhaust: {
    label: 'Build: Exhaust',
    skills: { accuracy: 0.76, cardSelection: 0.8, chargeSkill: 0.7, chainSkill: 0.4, blockSkill: 0.5, apEfficiency: 0.7, surgeAwareness: 0.5, masteryHunting: 0.6, rewardSkill: 0.8, shopSkill: 0.6, restSkill: 0.6, relicSkill: 0.8, apDiscipline: 1.0, chargeDiscipline: 1.0 },
    buildPrefs: { preferredMechanics: ['sacrifice', 'volatile_slash', 'bulwark', 'catalyst'], preferredRelicCategories: ['tactical', 'knowledge'], preferredRelicIds: ['scavengers_eye', 'tattered_notebook'] },
  },
  build_tempo: {
    label: 'Build: Tempo/Draw',
    skills: { accuracy: 0.76, cardSelection: 0.7, chargeSkill: 0.5, chainSkill: 0.5, blockSkill: 0.4, apEfficiency: 0.95, surgeAwareness: 0.8, masteryHunting: 0.5, rewardSkill: 0.7, shopSkill: 0.5, restSkill: 0.5, relicSkill: 0.6, apDiscipline: 1.0, chargeDiscipline: 1.0 },
    buildPrefs: { preferredMechanics: ['swap', 'scout', 'quicken', 'foresight', 'sift', 'reflex'], preferredRelicCategories: ['speed', 'tactical'], preferredRelicIds: ['swift_boots', 'quicksilver_quill'] },
  },
  build_control: {
    label: 'Build: Control',
    skills: { accuracy: 0.76, cardSelection: 0.85, chargeSkill: 0.7, chainSkill: 0.4, blockSkill: 0.6, apEfficiency: 0.7, surgeAwareness: 0.5, masteryHunting: 0.6, rewardSkill: 0.7, shopSkill: 0.5, restSkill: 0.6, relicSkill: 0.7, apDiscipline: 1.0, chargeDiscipline: 1.0 },
    buildPrefs: { preferredMechanics: ['weaken', 'expose', 'slow', 'stagger', 'hex', 'sap'], preferredRelicCategories: ['tactical', 'poison'], preferredRelicIds: ['plague_flask', 'null_shard'] },
  },
  build_berserker: {
    label: 'Build: Berserker',
    skills: { accuracy: 0.80, cardSelection: 0.6, chargeSkill: 0.9, chainSkill: 0.5, blockSkill: 0.35, apEfficiency: 0.6, surgeAwareness: 0.6, masteryHunting: 0.7, rewardSkill: 0.6, shopSkill: 0.4, restSkill: 0.5, relicSkill: 0.6, apDiscipline: 1.0, chargeDiscipline: 1.0 },
    buildPrefs: { preferredMechanics: ['reckless', 'lifetap', 'siphon_strike', 'execute', 'volatile_slash', 'heavy_strike'], preferredRelicCategories: ['glass_cannon', 'offensive'], preferredRelicIds: ['blood_price', 'berserkers_focus', 'reckless_resolve', 'berserker_s_oath'] },
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// Combined lookup
// ──────────────────────────────────────────────────────────────────────────────

/**
 * All named profiles merged (legacy + archetype + progression + build).
 * Use with `--profile <name>` flag in run-batch.ts.
 */
export const ALL_PROFILES: Record<string, BotSkills> = {
  ...LEGACY_PROFILES,
  ...ARCHETYPE_PROFILES,
  ...PROGRESSION_PROFILES,
};

// Merge build profile skills into ALL_PROFILES
for (const [key, bp] of Object.entries(BUILD_PROFILES)) {
  ALL_PROFILES[key] = bp.skills;
}

// ──────────────────────────────────────────────────────────────────────────────
// Sweep profile generator
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Generate profiles that sweep a single skill axis from 0 to 1.
 * All other axes are fixed at `baseline`. Accuracy is fixed at `accuracy`.
 * Useful for isolating the impact of one skill axis on win rate.
 *
 * @param axis      The axis to sweep
 * @param steps     Number of steps from 0 to 1 (default: 11 → 0.0, 0.1, …, 1.0)
 * @param baseline  Value for all non-swept, non-accuracy axes (default: 0.5)
 * @param accuracy  Fixed accuracy for all sweep profiles (default: 0.65)
 * @returns         Array of { label, skills } sorted by axis value ascending
 */
export function generateSweepProfiles(
  axis: SkillAxis,
  steps: number = 11,
  baseline: number = 0.5,
  accuracy: number = 0.65,
): { label: string; skills: BotSkills }[] {
  const result: { label: string; skills: BotSkills }[] = [];
  for (let i = 0; i < steps; i++) {
    const value = steps === 1 ? 1.0 : i / (steps - 1);
    const skills = makeSkills({ accuracy, [axis]: value }, baseline);
    result.push({ label: `${axis}=${value.toFixed(2)}`, skills });
  }
  return result;
}

// ──────────────────────────────────────────────────────────────────────────────
// Isolation profile generator
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Generate profiles where one axis is maxed (1.0) and all others are at baseline.
 * Useful for measuring the pure contribution of each skill axis.
 *
 * @param baseline  Value for all non-isolated axes (default: 0.3)
 * @param accuracy  Fixed accuracy for all profiles (default: 0.65)
 * @returns         Array of { label, skills }, one per SKILL_AXES entry
 */
export function generateIsolationProfiles(
  baseline: number = 0.3,
  accuracy: number = 0.65,
): { label: string; skills: BotSkills }[] {
  return SKILL_AXES.map(axis => ({
    label: `isolated_${axis}`,
    skills: makeSkills({ accuracy, [axis]: 1.0 }, baseline),
  }));
}

// ──────────────────────────────────────────────────────────────────────────────
// Profile label helper
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Return a human-readable name for a BotSkills object.
 * First checks ALL_PROFILES for an exact match; falls back to a summary string.
 */
export function profileLabel(skills: BotSkills): string {
  for (const [name, profile] of Object.entries(ALL_PROFILES)) {
    if (skillsEqual(skills, profile)) return name;
  }
  // Summarize dominant axes
  const dominant = SKILL_AXES
    .filter(ax => skills[ax] >= 0.8)
    .join('+');
  return `custom(acc=${skills.accuracy.toFixed(2)}${dominant ? `,${dominant}` : ''})`;
}

/**
 * Deep-equal comparison for BotSkills (all axes, epsilon 0.001).
 */
function skillsEqual(a: BotSkills, b: BotSkills): boolean {
  const eps = 0.001;
  return (
    Math.abs(a.accuracy       - b.accuracy)       < eps &&
    Math.abs(a.cardSelection  - b.cardSelection)   < eps &&
    Math.abs(a.chargeSkill    - b.chargeSkill)     < eps &&
    Math.abs(a.chainSkill     - b.chainSkill)      < eps &&
    Math.abs(a.blockSkill     - b.blockSkill)      < eps &&
    Math.abs(a.apEfficiency   - b.apEfficiency)    < eps &&
    Math.abs(a.surgeAwareness - b.surgeAwareness)  < eps &&
    Math.abs(a.masteryHunting - b.masteryHunting)  < eps &&
    Math.abs(a.rewardSkill    - b.rewardSkill)     < eps &&
    Math.abs(a.shopSkill      - b.shopSkill)       < eps &&
    Math.abs(a.restSkill       - b.restSkill)        < eps &&
    Math.abs(a.relicSkill      - b.relicSkill)       < eps &&
    Math.abs((a.apDiscipline    ?? 1.0) - (b.apDiscipline    ?? 1.0)) < eps &&
    Math.abs((a.chargeDiscipline ?? 1.0) - (b.chargeDiscipline ?? 1.0)) < eps
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Archetype build profiles — 8 strategically distinct archetypes for analytics mode
// ──────────────────────────────────────────────────────────────────────────────

/**
 * 8 strategically distinct build archetypes used in --analytics mode.
 * Each represents a different playstyle hypothesis for archetype win-rate analysis.
 * Keys match ARCHETYPE_PROFILES entries (turtle, chain_god, speedrunner,
 * mastery_farmer, quick_player, glass_cannon, balanced_pro, complete_noob).
 * @deprecated Use BUILD_PROFILES for mechanics-focused build simulation.
 */
export const ARCHETYPE_BUILD_PROFILES: Record<string, BotSkills> = {
  turtle:        ARCHETYPE_PROFILES['turtle'],
  chain_god:     ARCHETYPE_PROFILES['chain_god'],
  speedrunner:   ARCHETYPE_PROFILES['speedrunner'],
  mastery_farmer: ARCHETYPE_PROFILES['mastery_farmer'],
  quick_player:  ARCHETYPE_PROFILES['quick_player'],
  glass_cannon:  ARCHETYPE_PROFILES['glass_cannon'],
  balanced_pro:  ARCHETYPE_PROFILES['balanced_pro'],
  complete_noob: ARCHETYPE_PROFILES['complete_noob'],
};
