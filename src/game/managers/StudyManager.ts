import { get } from 'svelte/store'
import {
  currentScreen,
  activeQuiz,
  activeFact,
  pendingArtifacts,
  studyFacts,
  studyReviewStates,
  gaiaMessage,
  gaiaExpression,
} from '../../ui/stores/gameState'
import {
  playerSave,
  persistPlayer,
  addLearnedFact,
  updateReviewState,
  addMinerals,
  getDueReviews,
  syncKnowledgePoints,
} from '../../ui/stores/playerData'
import { BALANCE } from '../../data/balance'
import { factsDB } from '../../services/factsDB'
import type { Fact } from '../../data/types'

/**
 * Manages study sessions, artifact review flows, and the legacy study-answer handler.
 * Extracted from GameManager to keep study/learning logic self-contained.
 */
export class StudyManager {
  private gaiaMessage: (msg: string | null) => void
  private studyQueue: Fact[] = []
  private studyIndex = 0

  /**
   * @param setGaiaMessage - Callback to push a message to the gaiaMessage store.
   *   Accepts null to clear the current message.
   */
  constructor(setGaiaMessage: (msg: string | null) => void) {
    this.gaiaMessage = setGaiaMessage
  }

  // =========================================================
  // Study session
  // =========================================================

  /**
   * Start a dedicated card-flip study session at base.
   * Gathers due-review facts (or random learned facts as fallback),
   * populates the studyFacts/studyReviewStates stores, and navigates
   * to the 'studySession' screen — handled by StudySession.svelte.
   */
  startStudySession(): void {
    const save = get(playerSave)
    if (!save) return

    // Gather due reviews
    const dueReviews = getDueReviews()

    const facts: Fact[] = []
    for (const review of dueReviews) {
      const fact = factsDB.getById(review.factId)
      if (fact) facts.push(fact)
    }

    // Fallback: pick random learned facts when nothing is due
    if (facts.length === 0 && save.learnedFacts.length > 0) {
      const shuffled = [...save.learnedFacts].sort(() => Math.random() - 0.5)
      for (const id of shuffled) {
        const fact = factsDB.getById(id)
        if (fact) facts.push(fact)
      }
    }

    if (facts.length === 0) {
      gaiaMessage.set('No facts to review right now. Mine for new artifacts to discover more knowledge!')
      gaiaExpression.set('thinking')
      return
    }

    // Collect matching review states
    const reviewStates = save.reviewStates.filter(rs =>
      facts.some(f => f.id === rs.factId)
    )

    studyFacts.set(facts)
    studyReviewStates.set(reviewStates)
    currentScreen.set('studySession')
  }

  /**
   * Handle a single card answer from the StudySession component.
   * Updates SM-2 review state with quality 4 (correct) or 1 (incorrect).
   *
   * @param factId - The fact that was answered.
   * @param correct - Whether the player self-rated as correct.
   */
  handleStudyCardAnswer(factId: string, correct: boolean): void {
    updateReviewState(factId, correct)
  }

  /**
   * Called when the StudySession component signals completion.
   * Shows a GAIA comment based on performance and returns to base.
   *
   * @param correctCount - Number of cards the player rated as correct.
   * @param totalCount - Total cards in the session.
   */
  completeStudySession(correctCount: number, totalCount: number): void {
    studyFacts.set([])
    studyReviewStates.set([])

    const ratio = totalCount > 0 ? correctCount / totalCount : 0

    // Check for active review ritual and award bonus if not yet completed today
    const hour = new Date().getHours()
    const today = new Date().toISOString().split('T')[0]
    const save = get(playerSave)

    let ritualType: 'morning' | 'evening' | null = null
    if (hour >= BALANCE.MORNING_REVIEW_HOUR && hour < BALANCE.MORNING_REVIEW_END) {
      ritualType = 'morning'
    } else if (hour >= BALANCE.EVENING_REVIEW_HOUR && hour < BALANCE.EVENING_REVIEW_END) {
      ritualType = 'evening'
    }

    const alreadyCompleted = ritualType === 'morning'
      ? save?.lastMorningReview === today
      : ritualType === 'evening'
        ? save?.lastEveningReview === today
        : true

    if (ritualType !== null && !alreadyCompleted && save) {
      // Mark ritual completed and award bonus dust
      const updatedField = ritualType === 'morning'
        ? { lastMorningReview: today }
        : { lastEveningReview: today }
      playerSave.update(s => s ? { ...s, ...updatedField } : s)
      addMinerals('dust', BALANCE.RITUAL_BONUS_DUST)

      const bonusMsg = ritualType === 'morning'
        ? `Great morning practice! +${BALANCE.RITUAL_BONUS_DUST} dust bonus!`
        : `A productive evening! +${BALANCE.RITUAL_BONUS_DUST} dust bonus!`
      this.gaiaMessage(bonusMsg)
      setTimeout(() => this.gaiaMessage(null), 5000)
    } else {
      if (ratio === 1) {
        this.gaiaMessage('Perfect session! Your knowledge grows stronger.')
      } else if (ratio > 0.7) {
        this.gaiaMessage('Solid review. The tree appreciates your effort.')
      } else {
        this.gaiaMessage('Some of those need more practice. The tree will wait.')
      }
    }

    // Persist after potential ritual field update
    persistPlayer()

    // Recalculate and sync knowledge points from updated stats/mastery
    syncKnowledgePoints()

    currentScreen.set('base')
  }

  /** Handle a study mode quiz answer (legacy, kept for backward compatibility) */
  handleStudyAnswer(correct: boolean): void {
    const quiz = get(activeQuiz)
    if (quiz) {
      updateReviewState(quiz.fact.id, correct)
    }
    this.studyIndex++
    // Legacy path — just return to base if somehow called
    if (this.studyIndex >= this.studyQueue.length) {
      activeQuiz.set(null)
      currentScreen.set('base')
    }
  }

  // =========================================================
  // Artifact review
  // =========================================================

  /** Start reviewing pending artifacts from last dive */
  reviewNextArtifact(): void {
    const pending = get(pendingArtifacts)
    if (pending.length === 0) {
      activeFact.set(null)
      gaiaMessage.set('No artifacts waiting for review. Find more during your next dive!')
      gaiaExpression.set('calm')
      return
    }

    const factId = pending[0]
    const fact = factsDB.getById(factId)
    if (fact) {
      activeFact.set(fact)
      currentScreen.set('factReveal')
    } else {
      // Skip unknown fact
      pendingArtifacts.update(arr => arr.slice(1))
      this.reviewNextArtifact()
    }
  }

  /** Player chose to learn the current artifact fact */
  learnArtifact(): void {
    const fact = get(activeFact)
    if (fact) {
      addLearnedFact(fact.id)
      pendingArtifacts.update(arr => arr.filter(id => id !== fact.id))
    }
    activeFact.set(null)
    this.reviewNextArtifact()
  }

  /** Player chose to sell the current artifact fact */
  sellArtifact(): void {
    const fact = get(activeFact)
    if (fact) {
      // Sell value based on rarity
      const sellValues: Record<string, number> = {
        common: 5, uncommon: 10, rare: 20, epic: 40, legendary: 80, mythic: 150,
      }
      const reward = sellValues[fact.rarity] ?? 5
      addMinerals('dust', reward)
      pendingArtifacts.update(arr => arr.filter(id => id !== fact.id))
    }
    activeFact.set(null)
    this.reviewNextArtifact()
  }
}
