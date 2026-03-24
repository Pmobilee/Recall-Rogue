import type { DeckFact } from '../data/curatedDeckTypes';
import { getCuratedDeck, getCuratedDeckFacts } from '../data/curatedDeckStore';
import { selectFactForCharge } from './curatedFactSelector';
import { selectQuestionTemplate } from './questionTemplateSelector';
import { selectDistractors, getDistractorCount } from './curatedDistractorSelector';
import { InRunFactTracker } from './inRunFactTracker';
import type { ConfusionMatrix } from './confusionMatrix';
import { isNumericalAnswer, getNumericalDistractors, displayAnswer } from './numericalDistractorService';
import type { Fact } from '../data/types';

/** A quiz question ready for display in non-combat contexts. */
export interface NonCombatQuizQuestion {
  question: string;
  correctAnswer: string;
  choices: string[];           // correct + distractors, shuffled
  factId: string;              // for FSRS update
  isStudyMode: boolean;
  /** The distractor fact IDs (for confusion matrix recording on wrong answer) */
  distractorFactIds?: string[];
}

/**
 * Select a quiz question for non-combat contexts (shop, rest, boss, mystery).
 *
 * - Study mode: selects from FULL deck pool (all chain themes, not filtered),
 *   uses pool-based distractors and deck-specific question templates.
 * - Trivia mode: returns null — caller should use existing quizService logic.
 *
 * @param context - Which non-combat context is requesting the quiz
 * @param deckId - The curated deck ID (from RunState.deckMode)
 * @param subDeckId - Optional sub-deck focus
 * @param confusionMatrix - Player's cross-run confusion matrix (passed in to avoid Svelte store dependency)
 * @param inRunTracker - In-run fact tracker; if null, a temporary empty one is created
 * @param cardMasteryLevel - Card mastery for difficulty scaling (default 1)
 * @param runSeed - Run seed for deterministic selection
 * @returns A NonCombatQuizQuestion for study mode, or null if deck not loaded / trivia mode
 */
export function selectNonCombatStudyQuestion(
  context: 'shop' | 'rest' | 'boss' | 'mystery',
  deckId: string,
  subDeckId: string | undefined,
  confusionMatrix: ConfusionMatrix,
  inRunTracker: InRunFactTracker | null,
  cardMasteryLevel: number,
  runSeed: number,
): NonCombatQuizQuestion | null {
  const deck = getCuratedDeck(deckId);
  if (!deck) return null;

  // Non-combat uses full deck pool (not chain-theme-filtered)
  const factPool = getCuratedDeckFacts(deckId, subDeckId);
  if (factPool.length === 0) return null;

  // Use provided tracker or a temporary empty one
  const tracker = inRunTracker ?? new InRunFactTracker();

  // Offset the seed by context to get variety across different non-combat rooms
  const contextOffset = context.charCodeAt(0);
  const effectiveSeed = runSeed + contextOffset;

  // Select which fact to quiz on
  const { fact } = selectFactForCharge(factPool, tracker, cardMasteryLevel, effectiveSeed);

  // Select a question template appropriate to this fact and mastery level
  const templateResult = selectQuestionTemplate(fact, deck, cardMasteryLevel, [], effectiveSeed);

  // Select distractors
  const distractorCount = getDistractorCount(cardMasteryLevel);
  const pool = deck.answerTypePools.find(p => p.id === templateResult.answerPoolId);

  let choices: string[];
  let distractorFactIds: string[] = [];

  // Bracket-answer facts (e.g. correctAnswer: "{8}" or "About {8} minutes") use
  // runtime numerical distractor generation rather than pool-based selection.
  if (isNumericalAnswer(fact.correctAnswer)) {
    // Adapt DeckFact to the minimal Fact shape that getNumericalDistractors expects
    const factAdapter = { id: fact.id, correctAnswer: fact.correctAnswer } as Fact;
    const numericalDistractors = getNumericalDistractors(factAdapter, distractorCount);
    const correctDisplay = displayAnswer(fact.correctAnswer);
    choices = [correctDisplay, ...numericalDistractors];
    // distractorFactIds stays empty — numerical distractors have no deck fact IDs
  } else if (pool) {
    const { distractors } = selectDistractors(
      fact,
      pool,
      deck.facts,
      deck.synonymGroups,
      confusionMatrix,
      tracker,
      distractorCount,
      cardMasteryLevel,
    );
    choices = [templateResult.correctAnswer, ...distractors.map((d: DeckFact) => d.correctAnswer)];
    distractorFactIds = distractors.map((d: DeckFact) => d.id);
  } else {
    // Fallback to pre-generated distractors when no pool found for this template
    choices = [templateResult.correctAnswer, ...fact.distractors.slice(0, distractorCount)];
  }

  // Shuffle choices with Fisher-Yates (non-seeded — display order doesn't need to be deterministic)
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }

  return {
    question: templateResult.renderedQuestion,
    correctAnswer: displayAnswer(templateResult.correctAnswer),
    choices,
    factId: fact.id,
    isStudyMode: true,
    distractorFactIds,
  };
}
