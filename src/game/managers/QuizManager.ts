import { get } from 'svelte/store'
import {
  currentScreen,
  activeQuiz,
  gaiaMessage,
  currentLayer,
} from '../../ui/stores/gameState'
import { playerSave, updateReviewState } from '../../ui/stores/playerData'
import {
  BALANCE,
  QUIZ_BASE_RATE,
  QUIZ_COOLDOWN_BLOCKS,
  QUIZ_FIRST_TRIGGER_AFTER_BLOCKS,
  QUIZ_FATIGUE_PENALTY_PER_QUIZ,
  QUIZ_FATIGUE_THRESHOLD,
  QUIZ_MIN_RATE,
} from '../../data/balance'
import type { MineScene } from '../scenes/MineScene'
import type { Fact } from '../../data/types'
import { analyticsService } from '../../services/analyticsService'

/** Value shape of the activeQuiz store (non-null state). */
type ActiveQuizValue = {
  fact: Fact
  choices: string[]
  source?: 'gate' | 'oxygen' | 'study' | 'artifact' | 'random' | 'layer'
  gateProgress?: { remaining: number; total: number }
  isConsistencyPenalty?: boolean
}

/**
 * Manages all quiz flows during a dive: gate quizzes, oxygen quizzes,
 * artifact appraisal quizzes, random pop quizzes, and layer entrance quizzes.
 * Also handles consistency violation detection and penalty application.
 *
 * Extracted from GameManager to keep quiz logic self-contained.
 */
export class QuizManager {
  /**
   * Narrative framing strings shown per quiz type (DD-V2-173).
   * These use adventure/discovery language — no "quiz", "test", "exam", or "grade".
   */
  static readonly NARRATIVE_FRAMES = {
    popQuiz:   "Scanner ping! Residual data detected...",
    gate:      "Knowledge Gate engaged. Authenticate to proceed.",
    artifact:  "Artifact uplink — your knowledge calibrates the analysis.",
    hazard:    "Rapid field assessment! Your knowledge reduces the damage!",
    layer:     "Depth calibration sequence — what do you recall?",
    oxygen:    "Field scan detected — answer to unlock the cache.",
  } as const
  private getMineScene: () => MineScene | null
  private randomGaia: (lines: string[], trigger?: string) => void

  /** Coordinates of the quiz gate that triggered the current quiz (used to unlock it on pass). */
  pendingGateCoords: { x: number; y: number } | null = null

  /** Fact IDs already used in the current artifact appraisal flow (avoids repeats). */
  artifactQuizUsedFactIds = new Set<string>()

  /** Dev toggle: when true, every block mined triggers a quiz (bypasses all rate/cooldown checks). */
  devForceQuizEveryBlock = false

  // =========================================================
  // Quiz rate tracking fields (DD-V2-060)
  // =========================================================

  private blocksSinceLastQuiz = 0
  private totalBlocksThisDive = 0
  private quizzesThisDive = 0
  private failureCounts: Map<string, number> = new Map()

  constructor(
    getMineScene: () => MineScene | null,
    randomGaia: (lines: string[], trigger?: string) => void,
  ) {
    this.getMineScene = getMineScene
    this.randomGaia = randomGaia
  }

  // =========================================================
  // Quiz rate tracking (DD-V2-060)
  // =========================================================

  /**
   * Call after every block is mined. Returns true if a quiz should trigger.
   * Enforces cooldown, fatigue, and first-quiz-after-10 rules. (DD-V2-060)
   */
  shouldTriggerQuiz(): boolean {
    this.totalBlocksThisDive++
    this.blocksSinceLastQuiz++

    if (this.devForceQuizEveryBlock) {
      this.blocksSinceLastQuiz = 0
      this.quizzesThisDive++
      return true
    }

    if (this.totalBlocksThisDive < QUIZ_FIRST_TRIGGER_AFTER_BLOCKS) return false
    if (this.blocksSinceLastQuiz < QUIZ_COOLDOWN_BLOCKS) return false

    const excessQuizzes = Math.max(0, this.quizzesThisDive - QUIZ_FATIGUE_THRESHOLD)
    const effectiveRate = Math.max(
      QUIZ_MIN_RATE,
      QUIZ_BASE_RATE - (excessQuizzes * QUIZ_FATIGUE_PENALTY_PER_QUIZ),
    )

    if (Math.random() < effectiveRate) {
      this.blocksSinceLastQuiz = 0
      this.quizzesThisDive++
      return true
    }
    return false
  }

  /** Reset quiz rate tracking for a new dive. */
  resetForDive(): void {
    this.blocksSinceLastQuiz = 0
    this.totalBlocksThisDive = 0
    this.quizzesThisDive = 0
    this.failureCounts.clear()
  }

  /**
   * Tracks failure escalation for repeated wrong answers on the same fact.
   * 1-2 wrong: show mnemonic, 3-4: alternate explanation, 5+: suggest study session.
   * (DD-V2-060)
   *
   * @param factId - The fact that was answered incorrectly.
   */
  trackFailureEscalation(factId: string): void {
    const count = (this.failureCounts.get(factId) ?? 0) + 1
    this.failureCounts.set(factId, count)

    if (count <= 2) {
      this.randomGaia([
        "Let me help you remember this one...",
        "Here's a way to think about it...",
      ], 'quiz_failure_mild')
    } else if (count <= 4) {
      this.randomGaia([
        "This one keeps surfacing for you. Try a different angle.",
        "Alternate perspective might help here.",
      ], 'quiz_failure_moderate')
    } else {
      this.randomGaia([
        "This one is proving difficult. Consider a Memory Strengthening session in the Dome — I will focus on it with you.",
      ], 'quiz_failure_severe')
    }
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

    // GAIA callout — pick from encouraging consistency reminder lines
    this.randomGaia([
      "You've recalled this before — stay consistent, pilot.",
      "Inconsistent answer — you've gotten this right before. Keep it locked in.",
      "You learned this one. Let's make sure it sticks.",
    ])
  }

  // =========================================================
  // Analytics helpers
  // =========================================================

  /**
   * Track a quiz_answered analytics event for the given quiz state.
   * Captures fact ID, correctness, quiz type, distractor count, and current layer.
   *
   * @param quiz  - The active quiz at the time of answer.
   * @param correct - Whether the player's answer was correct.
   */
  private trackQuizAnswered(
    quiz: ActiveQuizValue,
    correct: boolean,
  ): void {
    analyticsService.track({
      name: 'quiz_answered',
      properties: {
        fact_id: quiz.fact.id,
        correct,
        quiz_type: quiz.source ?? 'unknown',
        response_time_ms: 0, // Response time is not tracked at this layer
        current_layer: get(currentLayer),
        distractor_count: quiz.choices.length - 1,
      },
    })
  }

  // =========================================================
  // Resume / gate
  // =========================================================

  /** Resume mining after a quiz gate answer */
  resumeQuiz(passed: boolean): void {
    console.warn('[QM] resumeQuiz called, passed:', passed)
    try {
      activeQuiz.set(null)
      console.warn('[QM] activeQuiz cleared')

      const scene = this.getMineScene()
      console.warn('[QM] getMineScene result:', scene ? 'exists' : 'NULL')
      if (scene) {
        const coords = this.pendingGateCoords
        this.pendingGateCoords = null
        console.warn('[QM] calling resumeFromQuiz...')
        scene.resumeFromQuiz(passed, coords?.x, coords?.y)
        console.warn('[QM] resume complete, currentScreen check:', get(currentScreen))
        // Only navigate back to mining if the dive hasn't ended during resume
        // (O2 depletion triggers endDive synchronously, which sets 'diveResults')
        if (get(currentScreen) !== 'diveResults') {
          console.warn('[QM] setting currentScreen to mining')
          currentScreen.set('mining')
        } else {
          console.warn('[QM] NOT setting mining — dive ended during resume')
        }
      } else {
        this.pendingGateCoords = null
        console.warn('[QM] scene is null, setting base')
        currentScreen.set('base')
      }
    } catch (error) {
      console.error('[QM] ERROR in resumeQuiz:', error)
    }
  }

  // =========================================================
  // Answer handlers
  // =========================================================

  /** Handle a quiz answer during mining (gate mode) */
  handleQuizAnswer(correct: boolean): void {
    console.warn('[QM] handleQuizAnswer called, correct:', correct)
    try {
      const quiz = get(activeQuiz)
      console.warn('[QM] activeQuiz exists:', !!quiz)
      if (quiz) {
        this.trackQuizAnswered(quiz, correct)
        updateReviewState(quiz.fact.id, correct, quiz.fact.category[0])
        if (!correct && this.isConsistencyViolation(quiz.fact.id, false)) {
          this.applyConsistencyPenalty(quiz.fact.id)
        }
      }
      this.resumeQuiz(correct)
    } catch (error) {
      console.error('[QM] ERROR in handleQuizAnswer:', error)
    }
  }

  /** Handle an oxygen quiz answer */
  handleOxygenQuizAnswer(correct: boolean): void {
    console.warn('[QM] handleOxygenQuizAnswer called, correct:', correct)
    try {
      const quiz = get(activeQuiz)
      console.warn('[QM] activeQuiz exists:', !!quiz)
      if (quiz) {
        this.trackQuizAnswered(quiz, correct)
        updateReviewState(quiz.fact.id, correct, quiz.fact.category[0])
        if (!correct && this.isConsistencyViolation(quiz.fact.id, false)) {
          this.applyConsistencyPenalty(quiz.fact.id)
        }
      }
      activeQuiz.set(null)
      console.warn('[QM] activeQuiz cleared')
      const scene = this.getMineScene()
      console.warn('[QM] getMineScene result:', scene ? 'exists' : 'NULL')
      if (scene) {
        console.warn('[QM] calling resumeFromOxygenQuiz...')
        scene.resumeFromOxygenQuiz(correct)
        console.warn('[QM] resume complete, currentScreen check:', get(currentScreen))
        // Only navigate back to mining if the dive hasn't ended during resume
        // (O2 depletion triggers endDive synchronously, which sets 'diveResults')
        if (get(currentScreen) !== 'diveResults') {
          console.warn('[QM] setting currentScreen to mining')
          currentScreen.set('mining')
        } else {
          console.warn('[QM] NOT setting mining — dive ended during resume')
        }
      } else {
        console.warn('[QM] scene is null, setting base')
        currentScreen.set('base')
      }
    } catch (error) {
      console.error('[QM] ERROR in handleOxygenQuizAnswer:', error)
    }
  }

  /** Handle an artifact quiz answer */
  handleArtifactQuizAnswer(correct: boolean): void {
    console.warn('[QM] handleArtifactQuizAnswer called, correct:', correct)
    try {
      const quiz = get(activeQuiz)
      console.warn('[QM] activeQuiz exists:', !!quiz)
      if (quiz) {
        this.trackQuizAnswered(quiz, correct)
        updateReviewState(quiz.fact.id, correct, quiz.fact.category[0])
      }
      // Check if more questions remain by inspecting gateProgress
      const moreQuestionsRemain = quiz?.gateProgress != null && quiz.gateProgress.remaining > 0
      activeQuiz.set(null)
      console.warn('[QM] activeQuiz cleared')
      const scene = this.getMineScene()
      console.warn('[QM] getMineScene result:', scene ? 'exists' : 'NULL')
      if (scene) {
        // resumeFromArtifactQuiz will emit another 'artifact-quiz' event if questions remain
        console.warn('[QM] calling resumeFromArtifactQuiz...')
        scene.resumeFromArtifactQuiz(correct)
        console.warn('[QM] resume complete, currentScreen check:', get(currentScreen))
        if (!moreQuestionsRemain || !correct) {
          // Quiz flow is ending — return to mining if the dive hasn't ended during resume
          // (O2 depletion triggers endDive synchronously, which sets 'diveResults')
          if (get(currentScreen) !== 'diveResults') {
            console.warn('[QM] setting currentScreen to mining')
            currentScreen.set('mining')
            if (!correct) {
              gaiaMessage.set("Close enough. Let's see what we've got.")
            }
          } else {
            console.warn('[QM] NOT setting mining — dive ended during resume')
          }
          // If all questions were answered correctly the scene will have emitted artifact-found
          // with a potentially boosted rarity — show a boost message if warranted
        }
        // If moreQuestionsRemain && correct: the scene emitted another 'artifact-quiz',
        // which updates activeQuiz and keeps currentScreen on 'quiz' via that listener
      } else {
        console.warn('[QM] scene is null, setting base')
        currentScreen.set('base')
      }
    } catch (error) {
      console.error('[QM] ERROR in handleArtifactQuizAnswer:', error)
    }
  }

  /** Handle a random (pop quiz) answer while mining */
  handleRandomQuizAnswer(correct: boolean): void {
    console.warn('[QM] handleRandomQuizAnswer called, correct:', correct)
    try {
      const quiz = get(activeQuiz)
      console.warn('[QM] activeQuiz exists:', !!quiz)
      if (quiz) {
        this.trackQuizAnswered(quiz, correct)
        updateReviewState(quiz.fact.id, correct, quiz.fact.category[0])
        if (!correct && this.isConsistencyViolation(quiz.fact.id, false)) {
          this.applyConsistencyPenalty(quiz.fact.id)
        }
      }
      activeQuiz.set(null)
      console.warn('[QM] activeQuiz cleared')
      const scene = this.getMineScene()
      console.warn('[QM] getMineScene result:', scene ? 'exists' : 'NULL')
      if (scene) {
        console.warn('[QM] calling resumeFromRandomQuiz...')
        scene.resumeFromRandomQuiz(correct)
        console.warn('[QM] resume complete, currentScreen check:', get(currentScreen))
        // Only navigate back to mining if the dive hasn't ended during resume
        // (O2 depletion triggers endDive synchronously, which sets 'diveResults')
        if (get(currentScreen) !== 'diveResults') {
          console.warn('[QM] setting currentScreen to mining')
          currentScreen.set('mining')
          if (correct) {
            gaiaMessage.set(`Nailed it! Dust deposit unlocked.`)
          } else {
            gaiaMessage.set("Not quite. Some O2 vented in the confusion.")
          }
        } else {
          console.warn('[QM] NOT setting mining — dive ended during resume')
        }
      } else {
        console.warn('[QM] scene is null, setting base')
        currentScreen.set('base')
      }
    } catch (error) {
      console.error('[QM] ERROR in handleRandomQuizAnswer:', error)
    }
  }

  /** Handle a layer entrance quiz answer */
  handleLayerQuizAnswer(correct: boolean): void {
    console.warn('[QM] handleLayerQuizAnswer called, correct:', correct)
    try {
      const quiz = get(activeQuiz)
      console.warn('[QM] activeQuiz exists:', !!quiz)
      if (quiz) {
        this.trackQuizAnswered(quiz, correct)
        updateReviewState(quiz.fact.id, correct, quiz.fact.category[0])
        if (!correct && this.isConsistencyViolation(quiz.fact.id, false)) {
          this.applyConsistencyPenalty(quiz.fact.id)
        }
      }
      activeQuiz.set(null)
      console.warn('[QM] activeQuiz cleared')
      const scene = this.getMineScene()
      console.warn('[QM] getMineScene result:', scene ? 'exists' : 'NULL')
      if (scene) {
        console.warn('[QM] calling resumeFromLayerQuiz...')
        scene.resumeFromLayerQuiz(correct)
        console.warn('[QM] resume complete, currentScreen check:', get(currentScreen))
        // Only navigate back to mining if the dive hasn't ended during resume
        // (O2 depletion triggers endDive synchronously, which sets 'diveResults')
        if (get(currentScreen) !== 'diveResults') {
          if (correct) {
            gaiaMessage.set("Locked in. Descending...")
          } else {
            gaiaMessage.set("Not quite, but you'll manage. Descending...")
          }
          console.warn('[QM] setting currentScreen to mining')
          currentScreen.set('mining')
        } else {
          console.warn('[QM] NOT setting mining — dive ended during resume')
        }
      } else {
        console.warn('[QM] scene is null, setting base')
        currentScreen.set('base')
      }
    } catch (error) {
      console.error('[QM] ERROR in handleLayerQuizAnswer:', error)
    }
  }
}
