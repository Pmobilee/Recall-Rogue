// === Boss Quiz Phase Service (AR-59.7) ===
// Pure logic for boss quiz phase threshold detection, question generation, and result resolution.
// No DOM, Phaser, or Svelte imports.

import type { CardRunState } from '../data/card-types';
import type { RunState } from './runManager';
import {
  BOSS_QUIZ_PHASES,
  QUIZ_PHASE_CORRECT_HP_DRAIN,
  type BossQuizPhaseConfig,
} from '../data/balance';
import { shuffled } from './randomUtils';
import { factsDB } from './factsDB';
import { selectNonCombatStudyQuestion, selectNonCombatCustomDeckQuestion } from './nonCombatQuizSelector';
import { getConfusionMatrix } from './confusionMatrixStore';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface QuizQuestion {
  factId: string;
  question: string;
  /** Shuffled answer options — includes correctAnswer. */
  answers: string[];
  correctAnswer: string;
  categoryL2?: string;
  /** Quiz presentation mode: 'text' (default), 'image_question', 'image_answers'. */
  quizMode?: 'text' | 'image_question' | 'image_answers' | 'chess_tactic';
  /** Path to the question image asset (image_question mode). */
  imageAssetPath?: string;
  /** Parallel image paths for each answer choice (image_answers mode). */
  answerImagePaths?: string[];
  /** Baked furigana segments for Japanese grammar sentences. */
  sentenceFurigana?: Array<{ t: string; r?: string; g?: string }>;
  /** Whole-sentence romaji (baked). */
  sentenceRomaji?: string;
  /** English translation for Japanese grammar sentences. */
  sentenceTranslation?: string;
  /** Short grammar-point label for hint display. */
  grammarPointLabel?: string;
  /** Chess puzzle board position in FEN notation (chess_move response mode). */
  fenPosition?: string;
  /** Lichess puzzle solution moves: [0]=opponent setup move, [1]=player correct response (UCI). */
  solutionMoves?: string[];
  /** Lichess puzzle rating for Elo calculation. */
  lichessRating?: number;
  /** Response mode override for this question. 'chess_move' renders ChessBoard instead of answer buttons. */
  quizResponseMode?: 'choice' | 'typing' | 'chess_move' | 'map_pin';
}

export interface QuizPhaseOutcome {
  /** Total HP to remove from boss at phase end (0 if rapid-fire, where effects were per-answer). */
  bossDamage: number;
  /** Total HP to restore to boss at phase end (rapid-fire wrong answers, or 0). */
  bossHeal: number;
  /** Total Strength stacks to add to boss. */
  bossStrengthGain: number;
  /** Number of random buffs to grant the player (Archivist phase). */
  playerRandomBuffs: number;
  /**
   * Total damage to deal to the player (from wrongPlayerDamage penalties).
   * Goes through the damage pipeline so block can reduce it.
   * For rapid-fire phases, this is pre-computed here; the caller applies it.
   */
  playerDamage: number;
  correctCount: number;
  wrongCount: number;
  totalCount: number;
  /** Theme for the results screen. */
  theme: 'positive' | 'negative' | 'neutral';
}

// ---------------------------------------------------------------------------
// getQuizPhaseTimerSeconds
// ---------------------------------------------------------------------------

/**
 * Returns the timer duration in milliseconds for a specific question index in a boss quiz phase.
 *
 * For phases with timerDecreasePerQ and timerMinSeconds, the timer decreases by
 * timerDecreasePerQ seconds per question, floored at timerMinSeconds.
 *
 * For phases with only timerOverrideMs (no decrease config), returns timerOverrideMs
 * for all questions.
 *
 * @param config - The phase configuration.
 * @param questionIndex - Zero-based index of the current question (0 = first question).
 * @returns Timer duration in milliseconds for the given question.
 */
export function getQuizPhaseTimerSeconds(
  config: BossQuizPhaseConfig,
  questionIndex: number,
): number {
  const startMs = config.timerOverrideMs ?? 12000;
  const startSeconds = startMs / 1000;

  if (config.timerDecreasePerQ != null && config.timerDecreasePerQ > 0) {
    const minSeconds = config.timerMinSeconds ?? 5;
    const seconds = Math.max(minSeconds, startSeconds - questionIndex * config.timerDecreasePerQ);
    return seconds * 1000;
  }

  return startMs;
}

// ---------------------------------------------------------------------------
// checkQuizPhaseThreshold
// ---------------------------------------------------------------------------

/**
 * Check whether a boss quiz phase should trigger given the boss's current HP fraction.
 * Returns the matching phase config and its index if a new threshold was crossed, or null.
 * Checks against `alreadyTriggeredPhaseIndices` to prevent re-triggering.
 *
 * @param bossId - The enemy template ID (e.g. 'algorithm').
 * @param currentHpPercent - Current HP as a fraction of maxHP (0–1).
 * @param alreadyTriggeredPhaseIndices - Phase indices that have already fired this encounter.
 */
export function checkQuizPhaseThreshold(
  bossId: string,
  currentHpPercent: number,
  alreadyTriggeredPhaseIndices: number[],
): { config: BossQuizPhaseConfig; phaseIndex: number } | null {
  const phases = BOSS_QUIZ_PHASES[bossId];
  if (!phases || phases.length === 0) return null;

  for (let i = 0; i < phases.length; i++) {
    if (alreadyTriggeredPhaseIndices.includes(i)) continue;
    const phase = phases[i];
    if (currentHpPercent <= phase.hpThreshold) {
      return { config: phase, phaseIndex: i };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// generateQuizPhaseQuestions
// ---------------------------------------------------------------------------

/**
 * Select quiz questions for a boss quiz phase.
 *
 * For `useWeakestDomain=true`: finds the categoryL2 with the lowest accuracy ratio
 * in `runState.categoryL2Accuracy`, then draws from that domain's cards in `factPool`.
 * Falls back to the general pool if the weakest domain has fewer facts than needed.
 *
 * For standard phases: draws from the run's general fact pool.
 *
 * Returns an array of QuizQuestion objects ready for display.
 */
export function generateQuizPhaseQuestions(
  config: BossQuizPhaseConfig,
  runState: RunState,
  factPool: CardRunState['drawPile'],
): QuizQuestion[] {
  // Study mode branch: use curated deck selector for boss quiz phase questions
  if (runState.deckMode?.type === 'study') {
    const confusionMatrix = getConfusionMatrix();
    const inRunTracker = runState.inRunFactTracker ?? null;
    const questions: QuizQuestion[] = [];
    for (let i = 0; i < config.questionCount; i++) {
      const q = selectNonCombatStudyQuestion(
        'boss',
        runState.deckMode.deckId,
        runState.deckMode.subDeckId,
        confusionMatrix,
        inRunTracker,
        1,
        runState.runSeed + i * 997,
        runState.deckMode.examTags,
      );
      if (q) {
        questions.push({
          factId: q.factId,
          question: q.question,
          answers: q.choices,
          correctAnswer: q.correctAnswer,
          quizMode: q.quizMode,
          imageAssetPath: q.imageAssetPath,
          answerImagePaths: q.answerImagePaths,
          fenPosition: q.fenPosition,
          solutionMoves: q.solutionMoves,
          lichessRating: q.lichessRating,
          quizResponseMode: q.quizResponseMode,
        });
      }
    }
    if (questions.length > 0) return questions;
    // Fall through to trivia path if study questions unavailable
  }

  // Custom deck mode branch: use curated deck selector across all custom deck items
  if (runState.deckMode?.type === 'custom_deck') {
    const confusionMatrix = getConfusionMatrix();
    const inRunTracker = runState.inRunFactTracker ?? null;
    const factSourceDeckMap = runState.factSourceDeckMap ?? {};
    const questions: QuizQuestion[] = [];
    for (let i = 0; i < config.questionCount; i++) {
      const q = selectNonCombatCustomDeckQuestion(
        'boss',
        runState.deckMode.items,
        factSourceDeckMap,
        confusionMatrix,
        inRunTracker,
        1,
        runState.runSeed + i * 997,
      );
      if (q) {
        questions.push({
          factId: q.factId,
          question: q.question,
          answers: q.choices,
          correctAnswer: q.correctAnswer,
          quizMode: q.quizMode,
          imageAssetPath: q.imageAssetPath,
          answerImagePaths: q.answerImagePaths,
          fenPosition: q.fenPosition,
          solutionMoves: q.solutionMoves,
          lichessRating: q.lichessRating,
          quizResponseMode: q.quizResponseMode,
        });
      }
    }
    if (questions.length > 0) return questions;
    // Fall through to trivia path if custom deck questions unavailable
  }

  const allFacts = factsDB.getTriviaFacts();
  const factMap = new Map(allFacts.map(f => [f.id, f]));

  // Build a flat list of unique fact IDs from the run's current deck pool
  const poolFactIds = [...new Set(factPool.map(c => c.factId))];

  let candidateFactIds: string[] = poolFactIds;

  if (config.useWeakestDomain) {
    const accuracy = (runState as RunState & { categoryL2Accuracy?: Map<string, { correct: number; total: number }> }).categoryL2Accuracy;
    if (accuracy && accuracy.size > 0) {
      // Find the categoryL2 with the lowest correct/total ratio
      let weakestCategoryL2: string | null = null;
      let lowestRatio = Infinity;

      for (const [cat, stats] of accuracy.entries()) {
        if (stats.total === 0) continue;
        const ratio = stats.correct / stats.total;
        if (ratio < lowestRatio) {
          lowestRatio = ratio;
          weakestCategoryL2 = cat;
        }
      }

      if (weakestCategoryL2) {
        // Filter pool to only facts in the weakest categoryL2
        const weakestIds = poolFactIds.filter(factId => {
          const fact = factMap.get(factId);
          return fact?.categoryL2 === weakestCategoryL2;
        });

        if (weakestIds.length >= config.questionCount) {
          candidateFactIds = weakestIds;
        } else {
          // Mix: use all weakest-domain facts + fill remainder from general pool
          const remaining = poolFactIds.filter(id => !weakestIds.includes(id));
          candidateFactIds = [...weakestIds, ...remaining];
        }
      }
    }
  }

  // Shuffle candidates and take up to questionCount
  const selected = shuffled(candidateFactIds).slice(0, config.questionCount);

  const questions: QuizQuestion[] = [];
  for (const factId of selected) {
    const fact = factMap.get(factId);
    if (!fact) continue;

    const distractors = (fact.distractors ?? []).slice(0, 3);
    const answers = shuffled([fact.correctAnswer, ...distractors]);

    questions.push({
      factId: fact.id,
      question: fact.quizQuestion,
      answers,
      correctAnswer: fact.correctAnswer,
      categoryL2: fact.categoryL2,
    });
  }

  return questions;
}

// ---------------------------------------------------------------------------
// resolveQuizPhaseResults
// ---------------------------------------------------------------------------

/**
 * Calculate and return the outcome of a completed quiz phase.
 * Does NOT mutate enemy or player state — returns a structured outcome
 * for the combat system to apply.
 *
 * For rapid-fire phases, `bossDamage` and `bossHeal` are 0 because
 * effects were already applied per-answer during the phase.
 *
 * @param config - The quiz phase configuration.
 * @param results - The number of correct and wrong answers.
 * @param enemyCurrentHP - Boss's current HP at the time of resolution (for HP-drain calc).
 */
export function resolveQuizPhaseResults(
  config: BossQuizPhaseConfig,
  results: { correct: number; wrong: number },
  enemyCurrentHP: number,
): QuizPhaseOutcome {
  const total = results.correct + results.wrong;
  const correctRatio = total > 0 ? results.correct / total : 0;

  let theme: 'positive' | 'negative' | 'neutral';
  if (correctRatio > 0.60) {
    theme = 'positive';
  } else if (correctRatio < 0.40) {
    theme = 'negative';
  } else {
    theme = 'neutral';
  }

  // Rapid-fire: boss damage/heal are applied per-answer during questioning;
  // playerDamage is pre-computed here so callers can apply it through the damage pipeline.
  if (config.rapidFire) {
    const bossStrengthGain = (config.penalties.wrongStrengthGain ?? 0) * results.wrong;
    const playerRandomBuffs = config.rewards.correctRandomBuff ? results.correct : 0;
    const playerDamage = (config.penalties.wrongPlayerDamage ?? 0) * results.wrong;
    return {
      bossDamage: 0,
      bossHeal: 0,
      bossStrengthGain,
      playerRandomBuffs,
      playerDamage,
      correctCount: results.correct,
      wrongCount: results.wrong,
      totalCount: total,
      theme,
    };
  }

  // Standard phase: HP drain per correct answer
  let bossDamage = 0;
  if (config.rewards.correctHpDrainPct != null) {
    // Each correct answer drains correctHpDrainPct of the boss's CURRENT HP at phase end
    // We calculate based on the snapshot HP passed in
    const drainPerAnswer = Math.round(enemyCurrentHP * config.rewards.correctHpDrainPct);
    bossDamage = drainPerAnswer * results.correct;
  } else if (config.rewards.correctDirectDamage != null) {
    bossDamage = config.rewards.correctDirectDamage * results.correct;
  }

  const bossStrengthGain = (config.penalties.wrongStrengthGain ?? 0) * results.wrong;
  const bossHeal = (config.penalties.wrongBossHeal ?? 0) * results.wrong;
  const playerRandomBuffs = config.rewards.correctRandomBuff ? results.correct : 0;
  const playerDamage = (config.penalties.wrongPlayerDamage ?? 0) * results.wrong;

  return {
    bossDamage,
    bossHeal,
    bossStrengthGain,
    playerRandomBuffs,
    playerDamage,
    correctCount: results.correct,
    wrongCount: results.wrong,
    totalCount: total,
    theme,
  };
}
