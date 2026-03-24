import type { DeckFact } from '../data/curatedDeckTypes';

export interface InRunFactState {
  factId: string;
  correctCount: number;
  wrongCount: number;
  lastSeenEncounter: number;
  confusedWith: string[];       // Fact IDs this was confused with (wrong answer selections)
  averageResponseTimeMs: number;
  streak: number;               // Current consecutive correct (resets on wrong)
}

/**
 * Tracks per-run fact performance for study mode.
 * Separate from global FSRS — this is session-scoped.
 *
 * Uses Anki-faithful three-state model:
 * - NEW: never seen this run
 * - LEARNING: seen but not graduated (progresses through steps on correct, resets on wrong)
 * - GRADUATED: completed all learning steps (long cooldown before review)
 *
 * Learning steps: [2 charges, 5 charges] then graduate (10 charge cooldown).
 * Wrong answer on ANY card → back to learning step 0 (Anki "Again").
 * Max 8 cards in learning simultaneously.
 */
export class InRunFactTracker {
  private states: Map<string, InRunFactState> = new Map();
  private lastFactId: string | null = null;
  private totalCharges = 0;
  private currentEncounter = 1;
  private recentTemplateIds: string[] = [];  // Last 3 template IDs (for variety tracking)
  private chargeCount = 0;

  /** Anki-style learning step tracking. Cards progress: NEW → LEARNING (step 0,1) → GRADUATED */
  private learningCards: Map<string, { step: number; dueAtCharge: number }> = new Map();
  private graduatedCards: Map<string, number> = new Map(); // factId → charge number when due

  /** Learning step delays (charges until card is due again after correct answer) */
  private static readonly STEP_DELAYS = [2, 5];
  /** Charges until a graduated card is due for review */
  private static readonly GRADUATE_DELAY = 10;
  /** Max cards allowed in learning state simultaneously */
  private static readonly MAX_LEARNING = 8;

  /**
   * Seed from global FSRS at run start (§4.3):
   * - stability < 2 days: start with wrongCount: 1 (struggling)
   * - stability > 30 days: start with correctCount: 1 (known)
   * - else: fresh (no pre-seeded state)
   *
   * @param factIds - All fact IDs in the run's deck/sub-deck
   * @param getStability - Function that returns global FSRS stability for a factId (undefined if no data)
   */
  seedFromGlobalFSRS(
    factIds: string[],
    getStability: (factId: string) => number | undefined,
  ): void {
    for (const factId of factIds) {
      const stability = getStability(factId);
      if (stability !== undefined) {
        if (stability < 2) {
          this.states.set(factId, {
            factId,
            correctCount: 0,
            wrongCount: 1,
            lastSeenEncounter: 0,
            confusedWith: [],
            averageResponseTimeMs: 0,
            streak: 0,
          });
        } else if (stability > 30) {
          this.states.set(factId, {
            factId,
            correctCount: 1,
            wrongCount: 0,
            lastSeenEncounter: 0,
            confusedWith: [],
            averageResponseTimeMs: 0,
            streak: 0,
          });
        }
        // else: no pre-seeded state, will be created on first encounter
      }
    }
  }

  getState(factId: string): InRunFactState | undefined {
    return this.states.get(factId);
  }

  recordResult(
    factId: string,
    correct: boolean,
    responseTimeMs: number,
    encounterNumber: number,
    selectedWrongFactId?: string,
  ): void {
    let state = this.states.get(factId);
    if (!state) {
      state = {
        factId,
        correctCount: 0,
        wrongCount: 0,
        lastSeenEncounter: 0,
        confusedWith: [],
        averageResponseTimeMs: 0,
        streak: 0,
      };
      this.states.set(factId, state);
    }

    if (correct) {
      state.correctCount++;
      state.streak++;
    } else {
      state.wrongCount++;
      state.streak = 0;
      if (selectedWrongFactId && !state.confusedWith.includes(selectedWrongFactId)) {
        state.confusedWith.push(selectedWrongFactId);
      }
    }

    state.lastSeenEncounter = encounterNumber;
    // Update running average response time
    const totalAttempts = state.correctCount + state.wrongCount;
    state.averageResponseTimeMs =
      ((state.averageResponseTimeMs * (totalAttempts - 1)) + responseTimeMs) / totalAttempts;
  }

  /**
   * Anki-style learning step state machine. Called after every charge answer.
   *
   * State transitions:
   * - NEW + correct → LEARNING step 0, due in 2 charges
   * - LEARNING step 0 + correct → LEARNING step 1, due in 5 charges
   * - LEARNING step 1 + correct → GRADUATED, due in 10 charges
   * - GRADUATED + correct → stays GRADUATED, due in 10 charges
   * - ANY + wrong → LEARNING step 0, due in 2 charges (Anki "Again")
   */
  recordCharge(factId: string, correct: boolean): void {
    this.lastFactId = factId;
    this.totalCharges++;

    if (correct) {
      const learning = this.learningCards.get(factId);
      if (learning) {
        // In learning: advance to next step or graduate
        const nextStep = learning.step + 1;
        if (nextStep >= InRunFactTracker.STEP_DELAYS.length) {
          // Graduate — completed all learning steps
          this.learningCards.delete(factId);
          this.graduatedCards.set(factId, this.totalCharges + InRunFactTracker.GRADUATE_DELAY);
        } else {
          // Advance to next learning step
          learning.step = nextStep;
          learning.dueAtCharge = this.totalCharges + InRunFactTracker.STEP_DELAYS[nextStep];
        }
      } else if (this.graduatedCards.has(factId)) {
        // Already graduated — extend review interval
        this.graduatedCards.set(factId, this.totalCharges + InRunFactTracker.GRADUATE_DELAY);
      } else {
        // New card answered correctly — enter learning step 0
        this.learningCards.set(factId, {
          step: 0,
          dueAtCharge: this.totalCharges + InRunFactTracker.STEP_DELAYS[0],
        });
      }
    } else {
      // Wrong: always reset to learning step 0 (Anki "Again")
      this.graduatedCards.delete(factId); // Un-graduate if graduated
      this.learningCards.set(factId, {
        step: 0,
        dueAtCharge: this.totalCharges + InRunFactTracker.STEP_DELAYS[0],
      });
    }
  }

  /** Get all learning card IDs whose timer has expired (dueAtCharge <= totalCharges) */
  getDueLearningCards(): string[] {
    const due: string[] = [];
    for (const [factId, state] of this.learningCards) {
      if (state.dueAtCharge <= this.totalCharges) {
        due.push(factId);
      }
    }
    return due;
  }

  /** True if the fact is currently in the learning state (any step) */
  isInLearning(factId: string): boolean {
    return this.learningCards.has(factId);
  }

  /** True if the fact has graduated (completed all learning steps) */
  isGraduated(factId: string): boolean {
    return this.graduatedCards.has(factId);
  }

  /** True if the fact is graduated AND its review timer has expired */
  isGraduatedAndDue(factId: string): boolean {
    const dueAt = this.graduatedCards.get(factId);
    return dueAt !== undefined && dueAt <= this.totalCharges;
  }

  /** True if we can introduce more new cards (learning queue not full) */
  canIntroduceNew(): boolean {
    return this.learningCards.size < InRunFactTracker.MAX_LEARNING;
  }

  getLastFactId(): string | null {
    return this.lastFactId;
  }

  getTotalCharges(): number {
    return this.totalCharges;
  }

  advanceEncounter(): void {
    this.currentEncounter++;
  }

  getCurrentEncounter(): number {
    return this.currentEncounter;
  }

  /**
   * Returns the current charge count and increments it.
   * Used to vary the per-charge seed in curatedFactSelector so the same fact
   * isn't selected repeatedly within the same encounter.
   */
  getAndIncrementChargeCount(): number {
    return this.chargeCount++;
  }

  /** Track recently used question template IDs for variety */
  recordTemplateUsed(templateId: string): void {
    this.recentTemplateIds.push(templateId);
    if (this.recentTemplateIds.length > 3) {
      this.recentTemplateIds.shift();
    }
  }

  getRecentTemplateIds(): string[] {
    return [...this.recentTemplateIds];
  }
}
