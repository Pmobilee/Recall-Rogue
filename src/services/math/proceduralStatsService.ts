/**
 * Computes math practice statistics from PlayerSkillState data.
 *
 * Aggregates totalAttempts, totalCorrect, and tier distribution across all
 * tracked skill states, with optional per-deck filtering. No FSRS logic lives
 * here — this is a pure read-only aggregation layer over skillStateManager.
 *
 * Source files: src/services/math/proceduralStatsService.ts
 * Related docs: docs/RESEARCH/procedural-math-design.md, docs/mechanics/quiz.md
 */

import { getAllSkillStates, getSkillTier } from './skillStateManager';
import type { CardTier } from '../../data/card-types';

export interface MathStats {
  /** Total problems answered across all skills. */
  problemsSolved: number;
  /** Total correct answers. */
  correctCount: number;
  /** Accuracy as a percentage (0-100), or 0 if no attempts. */
  accuracyPercent: number;
  /** Tier distribution: count of skills at each tier. */
  tierDistribution: Record<CardTier, number>;
  /** Total number of skills tracked. */
  totalSkills: number;
}

/**
 * Get math practice stats, optionally filtered by deckId.
 *
 * When deckId is provided, only skill states belonging to that deck are
 * counted. When omitted, all tracked skill states are aggregated.
 *
 * accuracyPercent is 0 when problemsSolved === 0 (no division by zero).
 */
export function getMathStats(deckId?: string): MathStats {
  const states = getAllSkillStates(deckId);

  let problemsSolved = 0;
  let correctCount = 0;
  const tierDistribution: Record<CardTier, number> = { '1': 0, '2a': 0, '2b': 0, '3': 0 };

  for (const state of states) {
    problemsSolved += state.totalAttempts;
    correctCount += state.totalCorrect;
    const tier = getSkillTier(state);
    tierDistribution[tier]++;
  }

  return {
    problemsSolved,
    correctCount,
    accuracyPercent: problemsSolved > 0 ? Math.round((correctCount / problemsSolved) * 100) : 0,
    tierDistribution,
    totalSkills: states.length,
  };
}
