/**
 * Type definitions for the procedural math deck system.
 * Used by Study Temple to generate arithmetic and math problems on-the-fly
 * instead of drawing from a static fact database.
 *
 * Source files: src/data/proceduralDeckTypes.ts
 * Related docs: docs/content/deck-system.md, docs/mechanics/quiz.md
 */

import type { CardTier } from './card-types';

/**
 * Parameters for a math problem generator at a specific FSRS tier.
 * Controls the difficulty envelope for generated problems.
 */
export interface GeneratorParams {
  /** Operand A range [min, max] (inclusive). */
  rangeA: [number, number];
  /** Operand B range [min, max] (inclusive). */
  rangeB: [number, number];
  /** For mixed-operation generators: which operations to include ('+', '-', '*', '/'). */
  operations?: string[];
  /** Number of chained operations (1 = simple, 2+ = compound multi-step). */
  steps?: number;
  /** Whether decimal operands/answers are permitted. */
  allowDecimals?: boolean;
  /** Whether negative operands/answers are permitted. */
  allowNegatives?: boolean;
  /**
   * Acceptable error margin for answers.
   * Useful for division or decimal problems where rounding varies.
   */
  tolerance?: number;
  /** Shape/type pool for geometry generators, e.g. ['rectangle','triangle','circle']. */
  shapes?: string[];
  /** Maximum coefficient magnitude for algebra generators. */
  maxCoefficient?: number;
  /** Whether to include negative coefficients in algebra generators. */
  allowNegativeCoefficients?: boolean;
  /** Equation form hint for algebra, e.g. 'linear','quadratic','system'. */
  equationForm?: string;
  /** Number of data points for statistics generators. */
  dataSetSize?: number;
  /** Maximum value in a generated data set. */
  dataMax?: number;
  /** Standard angle set for trig generators in degrees, e.g. [0, 30, 45, 60, 90]. */
  angles?: number[];
  /** Trig functions to use, e.g. ['sin','cos','tan']. */
  trigFunctions?: string[];
  /** Probability context types, e.g. ['dice','cards','coins']. */
  probabilityContext?: string[];
}

/**
 * A single math skill that generates problems procedurally.
 * Skills are the atomic unit of the math deck — each maps to one generator function.
 */
export interface SkillNode {
  /** Unique skill ID within its deck, e.g. 'add_2digit'. */
  id: string;
  /** Player-facing display name, e.g. 'Two-Digit Addition'. */
  name: string;
  /** Brief description for the UI skill tooltip. */
  description: string;
  /** Which generator function to call when producing a problem for this skill. */
  generatorId: string;
  /** Generator params per FSRS card tier — harder ranges at higher tiers. */
  tierParams: Record<CardTier, GeneratorParams>;
}

/**
 * A procedural deck containing skill nodes instead of static facts.
 * Only `domain: 'mathematics'` decks are procedural — all other domains use
 * the curated fact pipeline.
 */
export interface ProceduralDeck {
  /** Unique deck ID, e.g. 'arithmetic'. */
  id: string;
  /** Player-facing display name, e.g. 'Arithmetic'. */
  name: string;
  /** Always 'mathematics' for procedural decks. */
  domain: 'mathematics';
  /** Player-facing description shown in Study Temple. */
  description: string;
  /** All skill nodes belonging to this deck. */
  skills: SkillNode[];
  /** Sub-deck groupings for scoped practice sessions. */
  subDecks: ProceduralSubDeck[];
}

/**
 * A sub-deck grouping within a procedural deck.
 * Allows players to focus on a subset of skills (e.g., "Addition only").
 */
export interface ProceduralSubDeck {
  /** Unique sub-deck ID within its parent, e.g. 'addition'. */
  id: string;
  /** Player-facing display name, e.g. 'Addition'. */
  name: string;
  /** References to SkillNode.id values that belong to this sub-deck. */
  skillIds: string[];
}

/**
 * FSRS state tracked per skill node.
 * Parallel to ReviewState used for static facts — same scheduling semantics,
 * but keyed on skillId+deckId instead of factId.
 */
export interface PlayerSkillState {
  /** The skill this state belongs to (references SkillNode.id). */
  skillId: string;
  /** The deck this skill belongs to (references ProceduralDeck.id). */
  deckId: string;

  // ── FSRS core fields (same semantics as ReviewState) ──────────────────────
  /** Current FSRS learning state for this skill. */
  cardState: 'new' | 'learning' | 'review' | 'relearning';
  /** FSRS ease factor (2.5 default). */
  easeFactor: number;
  /** Current review interval in days. */
  interval: number;
  /** Total review repetitions completed. */
  repetitions: number;
  /** Unix timestamp (ms) of the next scheduled review. */
  nextReviewAt: number;
  /** Unix timestamp (ms) of the most recent review. */
  lastReviewAt: number;
  /** Last quality score (0–5). */
  quality: number;
  /** Current step within the learning/relearning phase. */
  learningStep: number;
  /** Number of times this skill has lapsed back to relearning. */
  lapseCount: number;
  /** True when lapseCount exceeds the leech threshold. */
  isLeech: boolean;
  /** FSRS stability estimate (days). Optional — computed by scheduler. */
  stability?: number;
  /** Number of consecutive correct answers at current streak. */
  consecutiveCorrect?: number;
  /** True if this skill has passed a mastery trial review. */
  passedMasteryTrial?: boolean;
  /** Current FSRS retrievability estimate (0–1). */
  retrievability?: number;
  /** FSRS difficulty parameter (1–10). */
  difficulty?: number;
  /** Alias for nextReviewAt in days since epoch (FSRS-4.5 field). */
  due?: number;
  /** Alias for lastReviewAt in days since epoch (FSRS-4.5 field). */
  lastReview?: number;
  /** Alias for repetitions (FSRS-4.5 field). */
  reps?: number;
  /** Alias for lapseCount (FSRS-4.5 field). */
  lapses?: number;
  /** Alias for cardState (FSRS-4.5 field). */
  state?: 'new' | 'learning' | 'review' | 'relearning';
  /** Unix timestamp (ms) when this skill was first considered mastered. */
  masteredAt?: number;

  // ── Aggregate stats ────────────────────────────────────────────────────────
  /** Total number of problem attempts for this skill. */
  totalAttempts: number;
  /** Total number of correct answers for this skill. */
  totalCorrect: number;
  /** Rolling average response time in milliseconds. */
  averageResponseTimeMs: number;
}

/**
 * Output of a math problem generator.
 * Consumed by the quiz engine exactly like a static Fact — the engine
 * treats MathProblem as a one-time ephemeral fact.
 */
export interface MathProblem {
  /** Human-readable question string, e.g. "347 + 589 = ?". */
  question: string;
  /** The single canonical correct answer string, e.g. "936". */
  correctAnswer: string;
  /**
   * Alternative correct answer strings accepted by the grader.
   * e.g. ["936.0"] for problems where decimal formatting varies.
   */
  acceptableAlternatives: string[];
  /** Algorithmically generated wrong answers for multiple-choice mode. */
  distractors: string[];
  /** Step-by-step explanation shown after the answer, e.g. "347 + 589 = 936". */
  explanation: string;
  /**
   * Controls the input widget shown to the player.
   * 'choice' = multiple-choice buttons, 'typing' = free-text input.
   */
  inputMode: 'choice' | 'typing';
}
