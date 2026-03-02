import { get } from 'svelte/store'
import {
  currentScreen,
  activeQuiz,
  gaiaMessage,
} from '../../ui/stores/gameState'
import { playerSave, updateReviewState } from '../../ui/stores/playerData'
import { BALANCE } from '../../data/balance'
import type { MineScene } from '../scenes/MineScene'

/**
 * Manages all quiz flows during a dive: gate quizzes, oxygen quizzes,
 * artifact appraisal quizzes, random pop quizzes, and layer entrance quizzes.
 * Also handles consistency violation detection and penalty application.
 *
 * Extracted from GameManager to keep quiz logic self-contained.
 */
export class QuizManager {
  private getMineScene: () => MineScene | null
  private randomGaia: (lines: string[], trigger?: string) => void

  /** Coordinates of the quiz gate that triggered the current quiz (used to unlock it on pass). */
  pendingGateCoords: { x: number; y: number } | null = null

  /** Fact IDs already used in the current artifact appraisal flow (avoids repeats). */
  artifactQuizUsedFactIds = new Set<string>()

  constructor(
    getMineScene: () => MineScene | null,
    randomGaia: (lines: string[], trigger?: string) => void,
  ) {
    this.getMineScene = getMineScene
    this.randomGaia = randomGaia
  }

  // =========================================================
  // Consistency violation
  // =========================================================

  /**
   * Checks if a wrong answer constitutes a consistency violation —
   * the player has demonstrably learned this fact (repetitions >= CONSISTENCY_MIN_REPS)
   * but answered it incorrectly during a dive.
   *
   * @param factId - The fact that was answered.
   * @param wasCorrect - Whether the player got it right (always false for a penalty check).
   */
  isConsistencyViolation(factId: string, wasCorrect: boolean): boolean {
    if (wasCorrect) return false // only penalize wrong answers
    const save = get(playerSave)
    if (!save) return false
    const reviewState = save.reviewStates.find(rs => rs.factId === factId)
    if (!reviewState) return false
    // Penalize if player has answered this correctly at least CONSISTENCY_MIN_REPS times before
    return reviewState.repetitions >= BALANCE.CONSISTENCY_MIN_REPS
  }

  /**
   * Applies the consistency penalty: drains extra O2 and shows a GAIA message.
   * Also updates the activeQuiz store flag so the overlay can show the warning.
   *
   * @param factId - The fact that triggered the violation.
   */
  applyConsistencyPenalty(factId: string): void {
    void factId // factId is accepted for API symmetry; violation is already confirmed by caller

    // Mark the active quiz with the consistency penalty flag before the overlay
    // transitions away, so it can display the warning line while showing results.
    activeQuiz.update(q => q ? { ...q, isConsistencyPenalty: true } : q)

    // Drain extra O2 in the MineScene
    const scene = this.getMineScene()
    if (scene) {
      scene.drainOxygen(BALANCE.CONSISTENCY_PENALTY_O2)
    }

    // GAIA callout — pick from snarky "you knew this" lines
    this.randomGaia([
      "You knew that one before! Sloppy, pilot.",
      "Inconsistent answer — you've gotten this right before.",
      "Focus! You learned this already.",
    ])
  }

  // =========================================================
  // Resume / gate
  // =========================================================

  /** Resume mining after a quiz gate answer */
  resumeQuiz(passed: boolean): void {
    activeQuiz.set(null)

    const scene = this.getMineScene()
    if (scene) {
      const coords = this.pendingGateCoords
      this.pendingGateCoords = null
      scene.resumeFromQuiz(passed, coords?.x, coords?.y)
      currentScreen.set('mining')
    } else {
      this.pendingGateCoords = null
      currentScreen.set('base')
    }
  }

  // =========================================================
  // Answer handlers
  // =========================================================

  /** Handle a quiz answer during mining (gate mode) */
  handleQuizAnswer(correct: boolean): void {
    const quiz = get(activeQuiz)
    if (quiz) {
      updateReviewState(quiz.fact.id, correct)
      if (!correct && this.isConsistencyViolation(quiz.fact.id, false)) {
        this.applyConsistencyPenalty(quiz.fact.id)
      }
    }
    this.resumeQuiz(correct)
  }

  /** Handle an oxygen quiz answer */
  handleOxygenQuizAnswer(correct: boolean): void {
    const quiz = get(activeQuiz)
    if (quiz) {
      updateReviewState(quiz.fact.id, correct)
      if (!correct && this.isConsistencyViolation(quiz.fact.id, false)) {
        this.applyConsistencyPenalty(quiz.fact.id)
      }
    }
    activeQuiz.set(null)
    const scene = this.getMineScene()
    if (scene) {
      scene.resumeFromOxygenQuiz(correct)
      currentScreen.set('mining')
    } else {
      currentScreen.set('base')
    }
  }

  /** Handle an artifact quiz answer */
  handleArtifactQuizAnswer(correct: boolean): void {
    const quiz = get(activeQuiz)
    if (quiz) {
      updateReviewState(quiz.fact.id, correct)
    }
    // Check if more questions remain by inspecting gateProgress
    const moreQuestionsRemain = quiz?.gateProgress != null && quiz.gateProgress.remaining > 0
    activeQuiz.set(null)
    const scene = this.getMineScene()
    if (scene) {
      // resumeFromArtifactQuiz will emit another 'artifact-quiz' event if questions remain
      scene.resumeFromArtifactQuiz(correct)
      if (!moreQuestionsRemain || !correct) {
        // Quiz flow is ending — return to mining
        currentScreen.set('mining')
        if (!correct) {
          gaiaMessage.set("Close enough. Let's see what we've got.")
        }
        // If all questions were answered correctly the scene will have emitted artifact-found
        // with a potentially boosted rarity — show a boost message if warranted
      }
      // If moreQuestionsRemain && correct: the scene emitted another 'artifact-quiz',
      // which updates activeQuiz and keeps currentScreen on 'quiz' via that listener
    } else {
      currentScreen.set('base')
    }
  }

  /** Handle a random (pop quiz) answer while mining */
  handleRandomQuizAnswer(correct: boolean): void {
    const quiz = get(activeQuiz)
    if (quiz) {
      updateReviewState(quiz.fact.id, correct)
      if (!correct && this.isConsistencyViolation(quiz.fact.id, false)) {
        this.applyConsistencyPenalty(quiz.fact.id)
      }
    }
    activeQuiz.set(null)
    const scene = this.getMineScene()
    if (scene) {
      scene.resumeFromRandomQuiz(correct)
      currentScreen.set('mining')
      if (correct) {
        gaiaMessage.set(`Not bad. Here's some dust for your trouble.`)
      } else {
        gaiaMessage.set("Wrong. That'll cost you some oxygen.")
      }
    } else {
      currentScreen.set('base')
    }
  }

  /** Handle a layer entrance quiz answer */
  handleLayerQuizAnswer(correct: boolean): void {
    const quiz = get(activeQuiz)
    if (quiz) {
      updateReviewState(quiz.fact.id, correct)
      if (!correct && this.isConsistencyViolation(quiz.fact.id, false)) {
        this.applyConsistencyPenalty(quiz.fact.id)
      }
    }
    activeQuiz.set(null)
    const scene = this.getMineScene()
    if (scene) {
      if (correct) {
        gaiaMessage.set("Well done. Descending...")
      } else {
        gaiaMessage.set("Wrong, but you'll survive. Barely.")
      }
      scene.resumeFromLayerQuiz(correct)
      currentScreen.set('mining')
    } else {
      currentScreen.set('base')
    }
  }
}
