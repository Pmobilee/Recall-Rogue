import type { InterestConfig } from '../data/interestConfig'
import { MAX_INFERRED_BOOST } from '../data/interestConfig'
import { CATEGORIES } from '../data/categories'

/** Positive behavioral signals tracked per category for interest inference (DD-V2-118). */
export interface CategoryBehavioralSignals {
  /** Number of times player voluntarily started a study session containing this category. */
  voluntaryStudySessions: number
  /** Number of facts from this category the player chose to KEEP (not sell). */
  artifactsKept: number
  /**
   * Number of facts from this category that reached interval >= 14 days
   * (progressing faster than average SM-2 baseline indicates natural affinity).
   */
  fastMasteryCount: number
}

/** Container for all behavioral learning signals, stored in PlayerSave. */
export interface BehavioralSignals {
  /** Per-category positive signal counts. */
  perCategory: Record<string, CategoryBehavioralSignals>
  /** Total dives completed at the time of last boost recalculation. */
  lastRecalcDives: number
}

/**
 * Records that a player voluntarily started a study session.
 * Increments voluntaryStudySessions for each category present in the session.
 */
export function recordVoluntaryStudy(
  signals: BehavioralSignals,
  sessionCategories: string[],
): BehavioralSignals {
  const updated = { ...signals, perCategory: { ...signals.perCategory } }
  for (const cat of sessionCategories) {
    const current: CategoryBehavioralSignals = updated.perCategory[cat] ?? {
      voluntaryStudySessions: 0,
      artifactsKept: 0,
      fastMasteryCount: 0,
    }
    updated.perCategory[cat] = {
      ...current,
      voluntaryStudySessions: current.voluntaryStudySessions + 1,
    }
  }
  return updated
}

/**
 * Records that a player kept an artifact (did not sell it after a dive).
 */
export function recordArtifactKept(
  signals: BehavioralSignals,
  factCategory: string,
): BehavioralSignals {
  const current: CategoryBehavioralSignals = signals.perCategory[factCategory] ?? {
    voluntaryStudySessions: 0,
    artifactsKept: 0,
    fastMasteryCount: 0,
  }
  return {
    ...signals,
    perCategory: {
      ...signals.perCategory,
      [factCategory]: { ...current, artifactsKept: current.artifactsKept + 1 },
    },
  }
}

/**
 * Records a fast mastery event — when a fact's SM-2 interval reaches 14+ days.
 */
export function recordFastMastery(
  signals: BehavioralSignals,
  factCategory: string,
): BehavioralSignals {
  const current: CategoryBehavioralSignals = signals.perCategory[factCategory] ?? {
    voluntaryStudySessions: 0,
    artifactsKept: 0,
    fastMasteryCount: 0,
  }
  return {
    ...signals,
    perCategory: {
      ...signals.perCategory,
      [factCategory]: { ...current, fastMasteryCount: current.fastMasteryCount + 1 },
    },
  }
}

/** Minimum total signal count (across all three types) for a category to receive any inferred boost. */
const SIGNAL_THRESHOLD = 3

/**
 * Recomputes inferred boosts for all categories from behavioral signals.
 * Caps each category's inferred boost at MAX_INFERRED_BOOST (0.3).
 *
 * Scoring formula per category:
 *   raw = (voluntaryStudySessions * 2) + (artifactsKept * 1) + (fastMasteryCount * 3)
 *   normalized = min(raw / 30, 1.0)
 *   inferredBoost = normalized * MAX_INFERRED_BOOST
 */
export function recalculateInferredBoosts(
  signals: BehavioralSignals,
  currentConfig: InterestConfig,
): InterestConfig {
  const newInferred: Record<string, number> = {}

  for (const cat of CATEGORIES) {
    const catSignals = signals.perCategory[cat]
    if (!catSignals) continue

    const totalSignals =
      catSignals.voluntaryStudySessions + catSignals.artifactsKept + catSignals.fastMasteryCount
    if (totalSignals < SIGNAL_THRESHOLD) continue

    const raw =
      (catSignals.voluntaryStudySessions * 2) +
      (catSignals.artifactsKept * 1) +
      (catSignals.fastMasteryCount * 3)

    const normalized = Math.min(raw / 30, 1.0)
    newInferred[cat] = Math.round(normalized * MAX_INFERRED_BOOST * 100) / 100
  }

  return { ...currentConfig, inferredBoosts: newInferred }
}

/**
 * Returns a human-readable summary of inferred boosts for the transparency panel.
 * Only returns categories where inferredBoost > 0.05 (meaningful signal).
 */
export function getInferenceTransparencySummary(
  config: InterestConfig,
): Array<{ category: string; boostPercent: number }> {
  return Object.entries(config.inferredBoosts)
    .filter(([, boost]) => boost > 0.05)
    .map(([category, boost]) => ({
      category,
      boostPercent: Math.round((boost / MAX_INFERRED_BOOST) * 100),
    }))
    .sort((a, b) => b.boostPercent - a.boostPercent)
}
