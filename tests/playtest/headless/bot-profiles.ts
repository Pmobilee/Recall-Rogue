/**
 * Bot Profiles — Named Skill Configurations for Headless Simulator
 * =================================================================
 * Provides preset BotSkills profiles for use with BotBrain.
 * Includes:
 *  - LEGACY_PROFILES: backward-compatible with the 6 original run-batch.ts profiles
 *  - ARCHETYPE_PROFILES: strategy composites (turtle, chain_god, speedrunner, etc.)
 *  - ALL_PROFILES: merged lookup for --profile flag
 *  - Generators: sweep profiles, isolation profiles
 *
 * Usage:
 *   import { ALL_PROFILES } from './bot-profiles.js';
 *   const skills = ALL_PROFILES['scholar'];
 *   const brain  = new BotBrain(skills);
 */

import type { BotSkills } from './bot-brain.js';

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
    accuracy:       baseline,
    cardSelection:  baseline,
    chargeSkill:    baseline,
    chainSkill:     baseline,
    blockSkill:     baseline,
    apEfficiency:   baseline,
    surgeAwareness: baseline,
    masteryHunting: baseline,
    rewardSkill:    baseline,
    shopSkill:      baseline,
    restSkill:      baseline,
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
// Combined lookup
// ──────────────────────────────────────────────────────────────────────────────

/**
 * All named profiles merged (legacy + archetype).
 * Use with `--profile <name>` flag in run-batch.ts.
 */
export const ALL_PROFILES: Record<string, BotSkills> = {
  ...LEGACY_PROFILES,
  ...ARCHETYPE_PROFILES,
};

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
    Math.abs(a.restSkill      - b.restSkill)       < eps
  );
}
