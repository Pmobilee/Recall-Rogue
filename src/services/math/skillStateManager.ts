/**
 * Manages FSRS-based skill state for procedural math decks.
 *
 * PlayerSkillState has the same FSRS fields as ReviewState/PlayerFactState,
 * so we reuse the existing scheduler and tier derivation by wrapping them.
 * This avoids duplicating any FSRS logic.
 *
 * Source files: src/services/math/skillStateManager.ts
 * Related docs: docs/content/deck-system.md, docs/mechanics/quiz.md
 */

import type { PlayerSkillState } from '../../data/proceduralDeckTypes'
import type { PlayerFactState } from '../../data/types'
import type { CardTier } from '../../data/card-types'
import { reviewFact } from '../fsrsScheduler'
import { getCardTier } from '../tierDerivation'
import { load, save } from '../saveService'

/**
 * Creates a new PlayerSkillState with FSRS defaults.
 * Matches the same defaults used by createFactState in fsrsScheduler.ts.
 */
export function createSkillState(skillId: string, deckId: string): PlayerSkillState {
  return {
    skillId,
    deckId,
    cardState: 'new',
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReviewAt: 0,
    lastReviewAt: 0,
    quality: 0,
    learningStep: 0,
    lapseCount: 0,
    isLeech: false,
    stability: 0,
    consecutiveCorrect: 0,
    passedMasteryTrial: false,
    retrievability: 0,
    difficulty: 5,
    totalAttempts: 0,
    totalCorrect: 0,
    averageResponseTimeMs: 0,
  }
}

/**
 * Converts a PlayerSkillState to a PlayerFactState so the FSRS scheduler
 * (which operates on PlayerFactState) can process it.
 *
 * The mapping is straightforward: all FSRS fields are identical.
 * skillId → factId is the only structural difference.
 */
function toFactState(skillState: PlayerSkillState): PlayerFactState {
  return {
    factId: skillState.skillId,
    cardState: skillState.cardState,
    easeFactor: skillState.easeFactor,
    interval: skillState.interval,
    repetitions: skillState.repetitions,
    nextReviewAt: skillState.nextReviewAt,
    lastReviewAt: skillState.lastReviewAt,
    quality: skillState.quality,
    learningStep: skillState.learningStep,
    lapseCount: skillState.lapseCount,
    isLeech: skillState.isLeech,
    stability: skillState.stability ?? 0,
    consecutiveCorrect: skillState.consecutiveCorrect ?? 0,
    passedMasteryTrial: skillState.passedMasteryTrial ?? false,
    retrievability: skillState.retrievability ?? 0,
    difficulty: skillState.difficulty ?? 5,
    due: skillState.due ?? skillState.nextReviewAt,
    lastReview: skillState.lastReview ?? skillState.lastReviewAt,
    reps: skillState.reps ?? skillState.repetitions,
    lapses: skillState.lapses ?? skillState.lapseCount,
    state: skillState.state ?? skillState.cardState,
    masteredAt: skillState.masteredAt ?? 0,
    graduatedRelicId: null,
    lastVariantIndex: -1,
    totalAttempts: skillState.totalAttempts,
    totalCorrect: skillState.totalCorrect,
    averageResponseTimeMs: skillState.averageResponseTimeMs,
    tierHistory: [],
  }
}

/**
 * Copies updated FSRS fields from a PlayerFactState back into a PlayerSkillState.
 * Stats fields (totalAttempts, totalCorrect, averageResponseTimeMs) come from
 * the updated fact state since reviewFact() already handles those.
 */
function fromFactState(updated: PlayerFactState, original: PlayerSkillState): PlayerSkillState {
  return {
    ...original,
    cardState: updated.cardState === 'suspended' ? 'review' : updated.cardState,
    easeFactor: updated.easeFactor,
    interval: updated.interval,
    repetitions: updated.repetitions,
    nextReviewAt: updated.nextReviewAt,
    lastReviewAt: updated.lastReviewAt,
    quality: updated.quality,
    learningStep: updated.learningStep,
    lapseCount: updated.lapseCount,
    isLeech: updated.isLeech,
    stability: updated.stability ?? 0,
    consecutiveCorrect: updated.consecutiveCorrect ?? 0,
    passedMasteryTrial: updated.passedMasteryTrial ?? false,
    retrievability: updated.retrievability ?? 0,
    difficulty: updated.difficulty ?? 5,
    due: updated.due ?? updated.nextReviewAt,
    lastReview: updated.lastReview ?? updated.lastReviewAt,
    reps: updated.reps ?? updated.repetitions,
    lapses: updated.lapses ?? updated.lapseCount,
    state: updated.state ?? (updated.cardState === 'suspended' ? 'review' : updated.cardState),
    masteredAt: updated.masteredAt ?? original.masteredAt,
    totalAttempts: updated.totalAttempts ?? original.totalAttempts,
    totalCorrect: updated.totalCorrect ?? original.totalCorrect,
    averageResponseTimeMs: updated.averageResponseTimeMs ?? original.averageResponseTimeMs,
  }
}

/**
 * Gets the skill state for a given skillId+deckId from the current player save.
 * Creates and returns a fresh default state if none exists (does NOT save it —
 * callers should call saveSkillState after any mutation).
 */
export function getSkillState(skillId: string, deckId: string): PlayerSkillState {
  const playerSave = load()
  const existing = playerSave?.skillStates?.find(
    (s) => s.skillId === skillId && s.deckId === deckId,
  )
  return existing ?? createSkillState(skillId, deckId)
}

/**
 * Gets all skill states from the current player save,
 * optionally filtered by deckId.
 */
export function getAllSkillStates(deckId?: string): PlayerSkillState[] {
  const playerSave = load()
  const states = playerSave?.skillStates ?? []
  if (deckId !== undefined) {
    return states.filter((s) => s.deckId === deckId)
  }
  return states
}

/**
 * Runs the FSRS scheduler on a skill state after a practice attempt.
 *
 * Delegates to fsrsScheduler.reviewFact by mapping the skill state to a
 * temporary PlayerFactState, then maps the result back. This ensures all
 * FSRS scheduling logic lives in one place.
 *
 * Does NOT persist — callers must call saveSkillState with the returned state.
 */
export function reviewSkill(
  state: PlayerSkillState,
  correct: boolean,
  responseTimeMs: number,
): PlayerSkillState {
  const factState = toFactState(state)
  const updated = reviewFact(factState, correct, responseTimeMs)
  return fromFactState(updated, state)
}

/**
 * Derives the card tier for a skill state.
 * Delegates directly to tierDerivation.getCardTier — same thresholds as regular facts.
 *
 * Tier thresholds (from tierDerivation.ts):
 * - '3': stability >= 10 AND consecutiveCorrect >= 4 AND passedMasteryTrial
 * - '2b': stability >= 5 AND consecutiveCorrect >= 3
 * - '2a': stability >= 2 AND consecutiveCorrect >= 2
 * - '1': everything else
 */
export function getSkillTier(state: PlayerSkillState): CardTier {
  return getCardTier({
    stability: state.stability,
    consecutiveCorrect: state.consecutiveCorrect,
    passedMasteryTrial: state.passedMasteryTrial,
  })
}

/**
 * Upserts a skill state into the current player save.
 * If no save exists this is a no-op (skill state is ephemeral until a full save exists).
 */
export function saveSkillState(state: PlayerSkillState): void {
  const playerSave = load()
  if (!playerSave) return

  const skillStates: PlayerSkillState[] = playerSave.skillStates ?? []
  const idx = skillStates.findIndex(
    (s) => s.skillId === state.skillId && s.deckId === state.deckId,
  )

  if (idx >= 0) {
    skillStates[idx] = state
  } else {
    skillStates.push(state)
  }

  save({ ...playerSave, skillStates })
}
