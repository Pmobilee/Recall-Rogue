import { get } from 'svelte/store'
import {
  currentScreen,
  activeQuiz,
  activeFact,
  pendingArtifacts,
  studyFacts,
  studyReviewStates,
} from '../../ui/stores/gameState'
import {
  playerSave,
  persistPlayer,
  discoverFact,
  updateReviewState,
  updateReviewStateByButton,
  addMinerals,
  savePendingArtifacts,
  getDueReviews,
  syncKnowledgePoints,
  shouldShowNewCards,
  incrementNewCardCount,
  updateDailyStreak,
} from '../../ui/stores/playerData'
import type { AnkiButton } from '../../services/sm2'
import { BALANCE, getAdaptiveNewCardLimit } from '../../data/balance'
import { factsDB } from '../../services/factsDB'
import type { Fact, ReviewState } from '../../data/types'

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
   * Gathers cards by priority: review-due, then learning/relearning, then
   * new (throttled by daily limit and backlog). Populates the
   * studyFacts/studyReviewStates stores, and navigates to the
   * 'studySession' screen — handled by StudySession.svelte.
   */
  startStudySession(): void {
    const save = get(playerSave)
    if (!save) return

    if (!factsDB.isReady()) {
      console.warn('[StudyManager] FactsDB not ready — retrying init')
      factsDB.init().then(() => {
        this.startStudySession()
      }).catch(() => {
        console.error('[StudyManager] FactsDB init failed — cannot start study session')
        studyFacts.set([])
        studyReviewStates.set([])
        currentScreen.set('studySession')
      })
      return
    }

    const now = Date.now()

    // ── Gather cards by priority ────────────────────────────────
    // Priority order: review-due → relearning/learning → new (throttled)

    // 1. Review-due cards (cardState === 'review', nextReviewAt <= now)
    const reviewDue: { fact: Fact; state: ReviewState }[] = []
    for (const rs of save.reviewStates) {
      if (rs.cardState === 'review' && rs.nextReviewAt <= now) {
        const fact = factsDB.getById(rs.factId)
        if (fact) reviewDue.push({ fact, state: rs })
      }
    }
    // Sort: earliest due first
    reviewDue.sort((a, b) => a.state.nextReviewAt - b.state.nextReviewAt)

    // 2. Learning/relearning cards (in-progress, due for next step)
    const learningDue: { fact: Fact; state: ReviewState }[] = []
    for (const rs of save.reviewStates) {
      if ((rs.cardState === 'learning' || rs.cardState === 'relearning') && rs.nextReviewAt <= now) {
        const fact = factsDB.getById(rs.factId)
        if (fact) learningDue.push({ fact, state: rs })
      }
    }
    // Shuffle learning cards
    learningDue.sort(() => Math.random() - 0.5)

    // 3. New cards (throttled by daily limit + backlog)
    const newCards: { fact: Fact; state: ReviewState }[] = []
    if (shouldShowNewCards()) {
      for (const rs of save.reviewStates) {
        if (rs.cardState === 'new') {
          const fact = factsDB.getById(rs.factId)
          if (fact) newCards.push({ fact, state: rs })
        }
      }
      // Shuffle and cap at daily limit
      newCards.sort(() => Math.random() - 0.5)
      const today = new Date().toISOString().slice(0, 10)
      const alreadyStudied = save.lastNewCardDate === today ? save.newCardsStudiedToday : 0
      const dueReviewCount = save.reviewStates.filter(rs =>
        rs.cardState === 'review' && rs.nextReviewAt <= Date.now()
      ).length
      const adaptiveLimit = getAdaptiveNewCardLimit(dueReviewCount)
      const remaining = Math.max(0, adaptiveLimit - alreadyStudied)
      newCards.splice(remaining)
    }

    // ── Build ordered queue ─────────────────────────────────────
    // Review-due first, then learning/relearning, then new cards last
    const orderedCards = [...reviewDue, ...learningDue, ...newCards]

    const facts = orderedCards.map(c => c.fact)
    const reviewStates = orderedCards.map(c => c.state)

    // Fallback: if nothing is due and player has learned facts, show review-ahead
    if (facts.length === 0 && save.learnedFacts.length > 0) {
      const shuffled = [...save.learnedFacts].sort(() => Math.random() - 0.5)
      const fallbackFacts: Fact[] = []
      for (const id of shuffled) {
        const fact = factsDB.getById(id)
        if (fact) fallbackFacts.push(fact)
      }
      // Collect matching review states for these
      const allStates = save.reviewStates.filter(rs =>
        fallbackFacts.some(f => f.id === rs.factId)
      )
      studyFacts.set(fallbackFacts)
      studyReviewStates.set(allStates)
      currentScreen.set('studySession')
      return
    }

    studyFacts.set(facts)
    studyReviewStates.set(reviewStates)
    currentScreen.set('studySession')
  }

  /**
   * Handle a single card answer from the StudySession component.
   * Updates SM-2 review state using the Anki-faithful button press.
   * Tracks new card introductions for daily throttle.
   *
   * @param factId - The fact that was answered.
   * @param button - Anki button: 'again', 'okay', or 'good'.
   */
  handleStudyCardAnswer(factId: string, button: AnkiButton): void {
    // Track new cards studied for daily throttle
    const save = get(playerSave)
    if (save) {
      const state = save.reviewStates.find(r => r.factId === factId)
      if (state && state.cardState === 'new') {
        incrementNewCardCount()
      }
    }

    updateReviewStateByButton(factId, button)
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
      // Mark ritual completed and award bonus dust + O2
      const o2Bonus = ritualType === 'morning'
        ? BALANCE.MORNING_REVIEW_O2_BONUS
        : BALANCE.EVENING_REVIEW_O2_BONUS
      const updatedField = ritualType === 'morning'
        ? { lastMorningReview: today }
        : { lastEveningReview: today }
      playerSave.update(s => s ? { ...s, ...updatedField, oxygen: (s.oxygen ?? 0) + o2Bonus } : s)
      addMinerals('dust', BALANCE.RITUAL_BONUS_DUST)

      const bonusMsg = ritualType === 'morning'
        ? `Great morning practice! +${BALANCE.RITUAL_BONUS_DUST} dust & +${o2Bonus} O₂ Tank!`
        : `A productive evening! +${BALANCE.RITUAL_BONUS_DUST} dust & +${o2Bonus} O₂ Tank!`
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

    // Track study session timestamp for study score calculation
    // Also mark initial study as complete if this was the first study session
    playerSave.update(s => {
      if (!s) return s
      const now = Date.now()
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
      const timestamps = [...(s.lastStudySessionTimestamps ?? []), now].filter(t => t > sevenDaysAgo)
      const streakUpdated = updateDailyStreak(s)
      return {
        ...streakUpdated,
        lastStudySessionTimestamps: timestamps,
        hasCompletedInitialStudy: true,
      }
    })

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
      currentScreen.set('factReveal')
      return
    }

    const artifact = pending[0]
    const fact = factsDB.getById(artifact.factId)
    if (fact) {
      activeFact.set(fact)
      currentScreen.set('factReveal')
    } else {
      // Skip unknown fact
      pendingArtifacts.update(arr => arr.slice(1))
      savePendingArtifacts(get(pendingArtifacts))
      persistPlayer()
      this.reviewNextArtifact()
    }
  }

  /** Player chose to learn the current artifact fact */
  learnArtifact(): void {
    const fact = get(activeFact)
    if (fact) {
      discoverFact(fact.id)
      pendingArtifacts.update(arr => arr.filter(a => a.factId !== fact.id))
      savePendingArtifacts(get(pendingArtifacts))
      persistPlayer()
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
      pendingArtifacts.update(arr => arr.filter(a => a.factId !== fact.id))
      savePendingArtifacts(get(pendingArtifacts))
      persistPlayer()
    }
    activeFact.set(null)
    this.reviewNextArtifact()
  }
}
