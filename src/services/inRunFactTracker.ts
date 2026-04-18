import type { DeckFact } from '../data/curatedDeckTypes';

/**
 * Plain-object snapshot of an InRunFactTracker for save/resume.
 * Maps are flattened to `[key, value]` tuple arrays so JSON.stringify
 * can roundtrip them losslessly. See `InRunFactTracker.toJSON` /
 * `InRunFactTracker.fromJSON`.
 */
export interface InRunFactTrackerSnapshot {
  states: Array<[string, InRunFactState]>;
  learningCards: Array<[string, { step: number; dueAtCharge: number }]>;
  graduatedCards: Array<[string, number]>;
  /** @deprecated use recentFactIds — kept for backward-compat save loading */
  lastFactId?: string | null;
  recentFactIds?: string[];
  totalCharges: number;
  currentEncounter: number;
  recentTemplateIds: string[];
  chargeCount: number;
  chargesSinceLastNew: number;
  lastShownTurn?: Array<[string, number]>;
}

export interface InRunFactState {
  factId: string;
  correctCount: number;
  wrongCount: number;
  lastSeenEncounter: number;
  confusedWith: string[];       // Fact IDs this was confused with (wrong answer selections)
  averageResponseTimeMs: number;
  streak: number;               // Current consecutive correct (resets on wrong)
  /** Flat damage multiplier bonus granted by Tutor's Office or Study sessions (e.g. 0.3 = +30%). Stacks additively. */
  damageBonus: number;
  /** Encounter number at which the tutor damage bonus expires (inclusive). Undefined = no expiry. */
  tutorBonusExpiresAtEncounter?: number;
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
 * Learning steps: [4 charges, 10 charges] then graduate (15 charge cooldown).
 * Wrong answer on ANY card → back to learning step 0 (Anki "Again").
 * Max 8 cards in learning simultaneously.
 * New card forced every 3 charges with empty learning queue (card guarantee prevents starvation).
 */
export class InRunFactTracker {
  private states: Map<string, InRunFactState> = new Map();
  /** Rolling window of recently-shown fact IDs (last RECENT_FACT_WINDOW charges). */
  private recentFactIds: string[] = [];
  private totalCharges = 0;
  private currentEncounter = 1;
  private recentTemplateIds: string[] = [];  // Last 3 template IDs (for variety tracking)
  private chargeCount = 0;

  /** Anki-style learning step tracking. Cards progress: NEW → LEARNING (step 0,1) → GRADUATED */
  private learningCards: Map<string, { step: number; dueAtCharge: number }> = new Map();
  private graduatedCards: Map<string, number> = new Map(); // factId → charge number when due

  /** Charges since the last NEW card was introduced (not learning/review) */
  private chargesSinceLastNew = 0;
  /** Force a new card introduction every this many charges (Anki-style even spacing) */
  private static readonly NEW_CARD_INTERVAL = 3;

  /** Learning step delays (charges until card is due again after correct answer) */
  private static readonly STEP_DELAYS = [4, 10];
  /** Charges until a graduated card is due for review */
  private static readonly GRADUATE_DELAY = 15;
  /** Max cards allowed in learning state simultaneously */
  private static readonly MAX_LEARNING = 8;

  /**
   * How many recent fact IDs to keep in the cooldown window.
   * A fact shown within the last RECENT_FACT_WINDOW charges will be excluded
   * from selection (unless the pool is too small to avoid it).
   */
  private static readonly RECENT_FACT_WINDOW = 3;

  /** Turn number when each fact was last shown — for per-turn cooldown. */
  private lastShownTurn: Map<string, number> = new Map();

  /** Minimum full turns between repeated showings of the same fact. */
  private static readonly MIN_TURN_GAP = 1;

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
            damageBonus: 0,
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
            damageBonus: 0,
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
        damageBonus: 0,
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
   * - NEW + correct → LEARNING step 0, due in 4 charges
   * - LEARNING step 0 + correct → LEARNING step 1, due in 10 charges
   * - LEARNING step 1 + correct → GRADUATED, due in 15 charges
   * - GRADUATED + correct → stays GRADUATED, due in 15 charges
   * - ANY + wrong → LEARNING step 0, due in 4 charges (Anki "Again")
   *
   * @param turnNumber - Optional global turn number for per-turn cooldown tracking.
   *   When provided, stamps lastShownTurn[factId] so isOnTurnCooldown can filter
   *   facts that appeared too recently in turn terms.
   */
  recordCharge(factId: string, correct: boolean, turnNumber?: number): void {
    // Push to rolling recent window (replaces single lastFactId dedup)
    this.recentFactIds.push(factId);
    if (this.recentFactIds.length > InRunFactTracker.RECENT_FACT_WINDOW) {
      this.recentFactIds.shift();
    }
    this.totalCharges++;
    this.chargesSinceLastNew++;

    // Track turn for per-turn cooldown
    if (turnNumber !== undefined) {
      this.lastShownTurn.set(factId, turnNumber);
    }

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
  /**
   * True when enough charges have passed to force-introduce a new card.
   * Fires every NEW_CARD_INTERVAL (3) charges without a new card being served,
   * preventing the learning queue from starving new card introduction.
   */
  shouldForceNewCard(): boolean {
    return this.chargesSinceLastNew >= InRunFactTracker.NEW_CARD_INTERVAL;
  }

  /**
   * Reset the new card counter. Call when a new (unseen) card is actually served.
   * This resets the force-new timer so the next forced introduction is
   * NEW_CARD_INTERVAL charges later.
   */
  recordNewCardServed(): void {
    this.chargesSinceLastNew = 0;
  }

  /**
   * Returns the rolling window of recently-shown fact IDs (up to RECENT_FACT_WINDOW entries).
   * The selector uses this to prevent a fact from reappearing within the window.
   */
  getRecentFactIds(): string[] {
    return this.recentFactIds;
  }

  /**
   * Returns the most recently shown fact ID, or null if no charges have been recorded.
   * Kept for backward compatibility — prefer getRecentFactIds() for full window access.
   */
  getLastFactId(): string | null {
    return this.recentFactIds.length > 0
      ? this.recentFactIds[this.recentFactIds.length - 1]
      : null;
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

  /**
   * Add a damage bonus multiplier to a specific fact.
   * Bonuses are additive (e.g. two +0.3 bonuses = +0.6 total).
   * Creates the fact state entry if it doesn't exist yet.
   */
  addDamageBonus(factId: string, bonus: number): void {
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
        damageBonus: 0,
      };
      this.states.set(factId, state);
    }
    state.damageBonus += bonus;
  }

  /**
   * Get the current damage bonus multiplier for a fact (0 if none / fact not tracked).
   */
  getDamageBonus(factId: string): number {
    return this.states.get(factId)?.damageBonus ?? 0;
  }

  /**
   * Decay (clear) tutor damage bonuses that have expired.
   * Call at the start of each encounter.
   * @param currentEncounterNumber - The current encounter number from floor state.
   */
  decayTutorBonuses(currentEncounterNumber: number): void {
    for (const state of this.states.values()) {
      if (
        state.tutorBonusExpiresAtEncounter !== undefined &&
        currentEncounterNumber > state.tutorBonusExpiresAtEncounter
      ) {
        state.damageBonus = Math.max(0, state.damageBonus - 0.3); // Remove tutor portion
        state.tutorBonusExpiresAtEncounter = undefined;
      }
    }
  }

  /** Get all tracked fact states (for review museum, meditation UI, etc.) */
  getAllStates(): InRunFactState[] {
    return Array.from(this.states.values());
  }

  /**
   * True if the fact was shown too recently in turn terms (within MIN_TURN_GAP turns).
   * A fact shown on turn N cannot reappear until turn N + MIN_TURN_GAP + 1.
   * Returns false if no turn data exists for the fact.
   *
   * @param factId - The fact to check.
   * @param currentTurn - The current global turn number.
   */
  isOnTurnCooldown(factId: string, currentTurn: number): boolean {
    const lastTurn = this.lastShownTurn.get(factId);
    if (lastTurn === undefined) return false;
    return currentTurn - lastTurn <= InRunFactTracker.MIN_TURN_GAP;
  }

  /**
   * Serialize the tracker to a plain object for JSON storage.
   * Named `toJSON` so `JSON.stringify` invokes it automatically — every
   * `RunState` autosave path therefore captures the full tracker state
   * (including the three internal Maps) instead of an empty `{}`.
   */
  toJSON(): InRunFactTrackerSnapshot {
    return {
      states: [...this.states],
      learningCards: [...this.learningCards],
      graduatedCards: [...this.graduatedCards],
      recentFactIds: [...this.recentFactIds],
      totalCharges: this.totalCharges,
      currentEncounter: this.currentEncounter,
      recentTemplateIds: [...this.recentTemplateIds],
      chargeCount: this.chargeCount,
      chargesSinceLastNew: this.chargesSinceLastNew,
      lastShownTurn: [...this.lastShownTurn],
    };
  }

  /**
   * Reconstruct an `InRunFactTracker` from a snapshot produced by `toJSON`.
   * Defensive against missing/malformed fields so legacy and partially
   * corrupt saves still load — the runSaveService deserializer relies on
   * this for forward/backward compatibility.
   *
   * Migration: if `recentFactIds` is absent but `lastFactId` is present (old save),
   * seeds the window with `[lastFactId]` to preserve single-fact dedup on resume.
   */
  static fromJSON(snapshot: InRunFactTrackerSnapshot | null | undefined): InRunFactTracker {
    const tracker = new InRunFactTracker();
    if (!snapshot || typeof snapshot !== 'object') {
      return tracker;
    }
    tracker.states = Array.isArray(snapshot.states) ? new Map(snapshot.states) : new Map();
    tracker.learningCards = Array.isArray(snapshot.learningCards) ? new Map(snapshot.learningCards) : new Map();
    tracker.graduatedCards = Array.isArray(snapshot.graduatedCards) ? new Map(snapshot.graduatedCards) : new Map();

    // Migrate old saves: recentFactIds takes priority; fall back to lastFactId singleton; else empty.
    if (Array.isArray(snapshot.recentFactIds)) {
      tracker.recentFactIds = [...snapshot.recentFactIds];
    } else if (typeof snapshot.lastFactId === 'string') {
      tracker.recentFactIds = [snapshot.lastFactId];
    } else {
      tracker.recentFactIds = [];
    }

    tracker.totalCharges = typeof snapshot.totalCharges === 'number' ? snapshot.totalCharges : 0;
    tracker.currentEncounter = typeof snapshot.currentEncounter === 'number' ? snapshot.currentEncounter : 1;
    tracker.recentTemplateIds = Array.isArray(snapshot.recentTemplateIds) ? [...snapshot.recentTemplateIds] : [];
    tracker.chargeCount = typeof snapshot.chargeCount === 'number' ? snapshot.chargeCount : 0;
    tracker.chargesSinceLastNew = typeof snapshot.chargesSinceLastNew === 'number' ? snapshot.chargesSinceLastNew : 0;
    tracker.lastShownTurn = Array.isArray(snapshot.lastShownTurn) ? new Map(snapshot.lastShownTurn) : new Map();
    return tracker;
  }
}
