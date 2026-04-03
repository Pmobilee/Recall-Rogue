/**
 * Selects which math skill to practice next from a procedural deck.
 *
 * Adapted from the Anki three-priority model used in curatedFactSelector.ts,
 * but significantly simpler because:
 * - No encounter cooldowns (Study Temple has no encounters)
 * - No card hand deduplication
 * - No confusion matrix
 * - No damage bonuses
 * - Typically only 10-20 skills per deck (vs hundreds of facts)
 *
 * Source files: src/services/math/proceduralSkillSelector.ts
 * Related docs: docs/content/deck-system.md, docs/mechanics/quiz.md
 */

import type { ProceduralDeck, PlayerSkillState, SkillNode } from '../../data/proceduralDeckTypes'
import type { CardTier } from '../../data/card-types'
import { createSkillState, getSkillTier } from './skillStateManager'

/** Maximum number of skills allowed in a learning state before new skill introduction is paused. */
const MAX_LEARNING = 8

export interface SkillSelection {
  skill: SkillNode
  tier: CardTier
  state: PlayerSkillState
  reason: 'due' | 'new' | 'relearning' | 'random'
}

/**
 * Finds the PlayerSkillState for a SkillNode from the provided states array,
 * or creates a default new state if none exists (without persisting it).
 */
function getStateForSkill(skillId: string, deckId: string, skillStates: PlayerSkillState[]): PlayerSkillState {
  return (
    skillStates.find((s) => s.skillId === skillId && s.deckId === deckId) ??
    createSkillState(skillId, deckId)
  )
}

/**
 * Counts how many skills are currently in a learning or relearning state.
 * Used to enforce the MAX_LEARNING cap before introducing new skills.
 */
function countLearningSkills(skills: SkillNode[], deckId: string, skillStates: PlayerSkillState[]): number {
  return skills.filter((skill) => {
    const state = getStateForSkill(skill.id, deckId, skillStates)
    return state.cardState === 'learning' || state.cardState === 'relearning'
  }).length
}

/**
 * Selects the next skill for practice from a procedural deck.
 *
 * Priority order (mirrors Anki):
 * 1. Relearning skills — always served first (player got these wrong)
 * 2. Due review skills — sorted by retrievability ascending (most-forgotten first)
 * 3. New skills — only introduced when learning queue is below MAX_LEARNING (8)
 *    Introduced in definition order (first in deck.skills first)
 * 4. Learning skills (ahead — not yet due) — nothing else available
 * 5. Fallback — any skill except lastSkillId
 *
 * @param deck - The procedural deck to select from
 * @param skillStates - Current saved states for all skills
 * @param subDeckId - Optional sub-deck filter (only skills in this sub-deck)
 * @param lastSkillId - The previously practiced skill ID (excluded from selection to prevent immediate repeats)
 */
export function selectSkillForPractice(
  deck: ProceduralDeck,
  skillStates: PlayerSkillState[],
  subDeckId?: string,
  lastSkillId?: string,
): SkillSelection {
  const now = Date.now()

  // Filter to sub-deck if specified
  let eligibleSkills: SkillNode[] = deck.skills
  if (subDeckId !== undefined) {
    const subDeck = deck.subDecks.find((sd) => sd.id === subDeckId)
    if (subDeck) {
      const skillIdSet = new Set(subDeck.skillIds)
      eligibleSkills = deck.skills.filter((s) => skillIdSet.has(s.id))
    }
  }

  // Build enriched list with states (excluding the last skill to prevent immediate repeats)
  const withStates = eligibleSkills.map((skill) => ({
    skill,
    state: getStateForSkill(skill.id, deck.id, skillStates),
  }))

  const withoutLast = withStates.filter((entry) => entry.skill.id !== lastSkillId)
  // If filtering by lastSkillId would leave nothing, use the full set
  const candidates = withoutLast.length > 0 ? withoutLast : withStates

  // === PRIORITY 1: Relearning skills ===
  const relearning = candidates.filter((e) => e.state.cardState === 'relearning')
  if (relearning.length > 0) {
    const pick = relearning[0]
    return {
      skill: pick.skill,
      tier: getSkillTier(pick.state),
      state: pick.state,
      reason: 'relearning',
    }
  }

  // === PRIORITY 2: Due review skills (sorted by retrievability ascending = most forgotten first) ===
  const dueReviews = candidates
    .filter((e) => {
      const cardState = e.state.cardState
      const dueAt = e.state.due ?? e.state.nextReviewAt
      return cardState === 'review' && dueAt <= now
    })
    .sort((a, b) => (a.state.retrievability ?? 1) - (b.state.retrievability ?? 1))

  if (dueReviews.length > 0) {
    const pick = dueReviews[0]
    return {
      skill: pick.skill,
      tier: getSkillTier(pick.state),
      state: pick.state,
      reason: 'due',
    }
  }

  // === PRIORITY 3: New skills (only if learning queue has room) ===
  const learningCount = countLearningSkills(eligibleSkills, deck.id, skillStates)
  if (learningCount < MAX_LEARNING) {
    const newSkills = candidates.filter((e) => e.state.cardState === 'new')
    if (newSkills.length > 0) {
      // Introduce in deck definition order
      const pick = newSkills[0]
      return {
        skill: pick.skill,
        tier: getSkillTier(pick.state),
        state: pick.state,
        reason: 'new',
      }
    }
  }

  // === PRIORITY 4: Ahead learning (in learning state, not yet due) ===
  const aheadLearning = candidates.filter((e) => e.state.cardState === 'learning')
  if (aheadLearning.length > 0) {
    const pick = aheadLearning[0]
    return {
      skill: pick.skill,
      tier: getSkillTier(pick.state),
      state: pick.state,
      reason: 'due',
    }
  }

  // === FALLBACK: any skill from the full candidate list ===
  // Prefer review skills that aren't quite due yet over everything else
  const any = candidates.length > 0 ? candidates : withStates
  const pick = any[0]
  return {
    skill: pick.skill,
    tier: getSkillTier(pick.state),
    state: pick.state,
    reason: 'random',
  }
}
