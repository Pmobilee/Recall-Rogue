/**
 * Bridge between the procedural math deck system and the quiz overlay.
 *
 * Connects skill selection → problem generation → quiz-ready question objects.
 * Also handles answer grading and FSRS state updates after each question.
 *
 * Typical flow:
 *   1. `startProceduralSession(deckId, subDeckId?)` — create session
 *   2. `getNextQuestion(session)` — generate a ProceduralQuizQuestion
 *   3. Show question in quiz overlay
 *   4. `gradeProceduralAnswer(deckId, skillId, correct, responseTimeMs, session)` — update FSRS
 *   5. Repeat from step 2
 *
 * Source files: src/services/math/proceduralQuizSession.ts
 * Related docs: docs/content/deck-system.md, docs/mechanics/quiz.md
 */

import type { ProceduralDeck, MathProblem } from '../../data/proceduralDeckTypes';
import type { CardTier } from '../../data/card-types';
import { getProceduralDeck } from './proceduralDeckRegistry';
import { selectSkillForPractice } from './proceduralSkillSelector';
import { getAllSkillStates, getSkillState, reviewSkill, saveSkillState } from './skillStateManager';
import { generateProblem } from './mathProblemGenerator';

// ── Session state ─────────────────────────────────────────────────────────────

/**
 * Mutable state for an active procedural practice session.
 * Created by `startProceduralSession` and mutated by `getNextQuestion`/`gradeProceduralAnswer`.
 */
export interface ProceduralSession {
  /** The deck ID being practiced (e.g. 'arithmetic'). */
  deckId: string;
  /** Optional sub-deck filter (e.g. 'addition'). Undefined = whole deck. */
  subDeckId?: string;
  /** The resolved ProceduralDeck definition. */
  deck: ProceduralDeck;
  /** Skill ID of the most recently generated question (prevents immediate repeats). */
  lastSkillId?: string;
  /** Total questions generated this session. */
  questionCount: number;
  /** Number of correct answers this session. */
  correctCount: number;
}

/**
 * Start a new procedural practice session.
 *
 * @param deckId    - ID of the procedural deck to practice (e.g. 'arithmetic').
 * @param subDeckId - Optional sub-deck to restrict practice to (e.g. 'addition').
 * @returns A new ProceduralSession, or null if the deck ID is not registered.
 */
export function startProceduralSession(deckId: string, subDeckId?: string): ProceduralSession | null {
  const deck = getProceduralDeck(deckId);
  if (!deck) return null;
  return { deckId, subDeckId, deck, questionCount: 0, correctCount: 0 };
}

// ── Question generation ───────────────────────────────────────────────────────

/**
 * A quiz question generated from a procedural skill, ready for the quiz overlay.
 * Structurally equivalent to a curated-fact quiz question so the overlay can
 * render both without branching.
 */
export interface ProceduralQuizQuestion {
  /** The skill this question was generated from. */
  skillId: string;
  /** The deck this skill belongs to. */
  deckId: string;
  /** The human-readable question string, e.g. "347 + 589 = ?". */
  question: string;
  /** The canonical correct answer string, e.g. "936". */
  correctAnswer: string;
  /** Alternative correct answers accepted by the grader (e.g. decimal variants). */
  acceptableAlternatives: string[];
  /** Shuffled answer pool: correct answer + distractors. Length = 5 (1 correct + 4 wrong). */
  answers: string[];
  /** Step-by-step explanation shown after grading. */
  explanation: string;
  /** 'choice' = multiple-choice buttons, 'typing' = free-text input. */
  inputMode: MathProblem['inputMode'];
  /** The FSRS tier that determined the difficulty envelope for this problem. */
  tier: CardTier;
}

/**
 * Generate the next quiz question for a session.
 *
 * Selects the most appropriate skill via `selectSkillForPractice`, generates a
 * problem with `generateProblem`, shuffles answers, and advances session state.
 *
 * @param session - The active ProceduralSession (mutated: lastSkillId, questionCount).
 * @param seed    - Optional explicit seed for deterministic generation. Defaults to
 *                  a combination of Date.now() and questionCount for natural variation.
 * @returns A ProceduralQuizQuestion ready for the quiz overlay.
 */
export function getNextQuestion(session: ProceduralSession, seed?: number): ProceduralQuizQuestion {
  const skillStates = getAllSkillStates(session.deckId);
  const selection = selectSkillForPractice(
    session.deck,
    skillStates,
    session.subDeckId,
    session.lastSkillId,
  );

  // Derive seed: explicit > time-based with question counter mixed in
  const effectiveSeed = seed ?? ((Date.now() ^ (session.questionCount * 7919)) >>> 0);
  const problem = generateProblem(selection.skill, selection.tier, effectiveSeed);

  session.lastSkillId = selection.skill.id;
  session.questionCount++;

  // Shuffle answers: correct + distractors
  const allAnswers = [problem.correctAnswer, ...problem.distractors];
  const shuffled = shuffleWithSeed(allAnswers, effectiveSeed);

  return {
    skillId: selection.skill.id,
    deckId: session.deckId,
    question: problem.question,
    correctAnswer: problem.correctAnswer,
    acceptableAlternatives: problem.acceptableAlternatives,
    answers: shuffled,
    explanation: problem.explanation,
    inputMode: problem.inputMode,
    tier: selection.tier,
  };
}

// ── Answer grading ────────────────────────────────────────────────────────────

/**
 * Grade a player's answer and update the FSRS skill state.
 *
 * Loads the current state for the skill, runs the FSRS scheduler, persists
 * the updated state, and increments the session's correct count if applicable.
 *
 * @param deckId        - Deck the skill belongs to.
 * @param skillId       - The skill that was just practiced.
 * @param correct       - Whether the player answered correctly.
 * @param responseTimeMs - Time taken to answer in milliseconds.
 * @param session       - The active session (mutated: correctCount).
 */
export function gradeProceduralAnswer(
  deckId: string,
  skillId: string,
  correct: boolean,
  responseTimeMs: number,
  session: ProceduralSession,
): void {
  const state = getSkillState(skillId, deckId);
  const updated = reviewSkill(state, correct, responseTimeMs);
  saveSkillState(updated);

  if (correct) session.correctCount++;
}

// ── Internal utilities ────────────────────────────────────────────────────────

/**
 * Fisher-Yates shuffle using the mulberry32 PRNG for deterministic output.
 * The same seed always produces the same shuffle for a given input array.
 */
function shuffleWithSeed<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = seed >>> 0;
  const rng = (): number => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
