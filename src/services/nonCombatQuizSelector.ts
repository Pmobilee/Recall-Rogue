import type { DeckFact } from '../data/curatedDeckTypes';
import type { CustomDeckRunItem } from '../data/studyPreset';
import { getCuratedDeck, getCuratedDeckFacts } from '../data/curatedDeckStore';
import { selectFactForCharge } from './curatedFactSelector';
import { selectQuestionTemplate } from './questionTemplateSelector';
import { selectDistractors, getDistractorCount } from './curatedDistractorSelector';
import { InRunFactTracker } from './inRunFactTracker';
import type { ConfusionMatrix } from './confusionMatrix';
import { isNumericalAnswer, getNumericalDistractors, displayAnswer } from './numericalDistractorService';
import type { Fact } from '../data/types';
import { interleaveFacts } from '../utils/interleaveFacts';

/** Continent names indexed by chainThemeId (0–4) for World Flags deck. */
export const REGION_NAMES = ['Europe', 'Asia', 'Africa', 'Americas', 'Oceania'] as const;

/**
 * Roll a question type for image-capable (flag) facts.
 * Returns one of five variety modes with weighted probabilities.
 */
export function rollFlagQuestionType(): 'identify' | 'reverse' | 'continent' | 'not_elimination' {
  const r = Math.random();
  if (r < 0.45) return 'identify';        // 45%
  if (r < 0.70) return 'reverse';         // 25%
  if (r < 0.88) return 'continent';       // 18%
  return 'not_elimination';               // 12%
}

/** A quiz question ready for display in non-combat contexts. */
export interface NonCombatQuizQuestion {
  question: string;
  correctAnswer: string;
  choices: string[];           // correct + distractors, shuffled
  factId: string;              // for FSRS update
  isStudyMode: boolean;
  /** The distractor fact IDs (for confusion matrix recording on wrong answer) */
  distractorFactIds?: string[];
  /** Quiz presentation mode: 'text' (default), 'image_question', 'image_answers'. */
  quizMode?: 'text' | 'image_question' | 'image_answers' | 'chess_tactic';
  /** Path to the question image asset (image_question mode). */
  imageAssetPath?: string;
  /** Parallel image paths for each answer choice, in same order as choices (image_answers mode). */
  answerImagePaths?: string[];
  /** Baked furigana segments for Japanese grammar sentences. */
  sentenceFurigana?: Array<{ t: string; r?: string; g?: string }>;
  /** Whole-sentence romaji (baked). */
  sentenceRomaji?: string;
  /** English translation for Japanese grammar sentences. */
  sentenceTranslation?: string;
  /** Short grammar-point label for hint display. */
  grammarPointLabel?: string;
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
 * @param examTags - Optional exam tag filter
 * @param meditatedThemeId - Optional chain theme ID that has been meditated (fewer distractors)
 * @param excludeFactIds - Fact IDs already selected in this batch; excluded from the pool
 *   to prevent duplicate questions when calling this function multiple times in a loop
 *   (e.g. generateStudyQuestions builds 3 questions sequentially).
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
  examTags?: string[],
  meditatedThemeId?: number,
  excludeFactIds?: ReadonlySet<string>,
): NonCombatQuizQuestion | null {
  const deck = getCuratedDeck(deckId);
  if (!deck) return null;

  // Non-combat uses full deck pool (not chain-theme-filtered)
  let factPool = getCuratedDeckFacts(deckId, subDeckId, examTags);
  if (factPool.length === 0) return null;

  // Exclude already-selected facts to prevent duplicates across a multi-question batch.
  // Only filter if there will still be facts left — fall through to full pool if pool
  // would become empty (edge case: tiny decks smaller than questionCount).
  if (excludeFactIds && excludeFactIds.size > 0) {
    const filtered = factPool.filter(f => !excludeFactIds.has(f.id));
    if (filtered.length > 0) {
      factPool = filtered;
    }
    // If filtered is empty (deck too small), keep the full pool so the caller still
    // gets a question, even if it duplicates — better than returning null.
  }

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
  // AR-273: Pass meditation params so meditated theme gets fewer distractors.
  const distractorCount = getDistractorCount(cardMasteryLevel, meditatedThemeId, fact.chainThemeId);
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

  // Build image quiz fields if this fact uses an image-based quiz mode.
  // For flag facts (image_question + imageAssetPath), roll among 5 question types
  // for variety. Non-flag image facts fall through to the original behavior.
  let quizMode: 'text' | 'image_question' | 'image_answers' | 'chess_tactic' | undefined;
  let imageAssetPath: string | undefined;
  let answerImagePaths: string[] | undefined;
  // Start with the template question; may be overridden per question type.
  let displayQuestion = templateResult.renderedQuestion;
  // Mutable correct answer — overridden for continent mode.
  let finalCorrectAnswer = displayAnswer(templateResult.correctAnswer);

  if (fact.quizMode === 'image_question' && fact.imageAssetPath) {
    const questionType = rollFlagQuestionType();

    switch (questionType) {
      case 'identify':
        // Standard: show flag image, pick country name (text answers).
        quizMode = 'image_question';
        imageAssetPath = fact.imageAssetPath;
        // displayQuestion stays as template default.
        break;

      case 'reverse': {
        // Show country name as question, pick correct flag from image grid.
        quizMode = 'image_answers';
        const imageByAnswerRev = new Map<string, string>();
        for (const df of factPool) {
          if (df.imageAssetPath) {
            imageByAnswerRev.set(df.correctAnswer.toLowerCase(), df.imageAssetPath);
            imageByAnswerRev.set(displayAnswer(df.correctAnswer).toLowerCase(), df.imageAssetPath);
          }
        }
        answerImagePaths = choices.map(c => imageByAnswerRev.get(c.toLowerCase()) ?? '');
        displayQuestion = `Select the flag of ${finalCorrectAnswer}`;
        break;
      }

      case 'continent': {
        // Show flag image, pick which continent the country belongs to (5 text choices).
        quizMode = 'image_question';
        imageAssetPath = fact.imageAssetPath;
        displayQuestion = 'This flag belongs to a country on which continent?';
        const correctContinent = REGION_NAMES[fact.chainThemeId] ?? 'Europe';
        // Replace choices with all 5 continent names, shuffled.
        const continentChoices = [...REGION_NAMES].sort(() => Math.random() - 0.5);
        choices.length = 0;
        choices.push(...continentChoices);
        finalCorrectAnswer = correctContinent;
        break;
      }

      case 'not_elimination': {
        // Show 4 flags (3 from one continent + 1 odd-one-out). Pick the one NOT from
        // the majority continent. The current fact is the odd-one-out (correct answer).
        const factContinent = fact.chainThemeId;
        const otherContinentIdx = ((factContinent + 1 + Math.floor(Math.random() * 4)) % 5);
        const otherContinentName = REGION_NAMES[otherContinentIdx];
        const sameRegionFacts = factPool.filter(
          df => df.chainThemeId === otherContinentIdx && !!df.imageAssetPath && df.id !== fact.id,
        );

        if (sameRegionFacts.length >= 3) {
          quizMode = 'image_answers';
          const shuffledSame = [...sameRegionFacts].sort(() => Math.random() - 0.5).slice(0, 3);
          const notChoices = [...shuffledSame.map(f => f.correctAnswer), fact.correctAnswer];
          // Fisher-Yates shuffle.
          for (let i = notChoices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [notChoices[i], notChoices[j]] = [notChoices[j], notChoices[i]];
          }
          const imageByAnswerNot = new Map<string, string>();
          for (const df of factPool) {
            if (df.imageAssetPath) {
              imageByAnswerNot.set(df.correctAnswer.toLowerCase(), df.imageAssetPath);
            }
          }
          answerImagePaths = notChoices.map(a => imageByAnswerNot.get(a.toLowerCase()) ?? '');
          choices.length = 0;
          choices.push(...notChoices);
          displayQuestion = `Which of these flags is NOT from ${otherContinentName}?`;
          finalCorrectAnswer = displayAnswer(fact.correctAnswer);
        } else {
          // Fallback: not enough facts in target continent — use standard identify.
          quizMode = 'image_question';
          imageAssetPath = fact.imageAssetPath;
        }
        break;
      }
    }
  } else if (fact.quizMode && fact.quizMode !== 'text') {
    // Non-flag image facts (future use): preserve original behavior.
    quizMode = fact.quizMode;
    if (fact.quizMode === 'image_question') {
      imageAssetPath = fact.imageAssetPath;
    }
  }

  return {
    question: displayQuestion,
    correctAnswer: finalCorrectAnswer,
    choices,
    factId: fact.id,
    isStudyMode: true,
    distractorFactIds,
    quizMode,
    imageAssetPath,
    answerImagePaths,
    sentenceFurigana: fact.sentenceFurigana,
    sentenceRomaji: fact.sentenceRomaji,
    sentenceTranslation: fact.sentenceTranslation,
    grammarPointLabel: fact.grammarPointLabel,
  };
}

/**
 * Select a quiz question for non-combat contexts (shop, rest, boss, mystery) in custom deck mode.
 *
 * Custom deck mode runs use multiple curated decks. This function merges facts from all custom
 * deck items and uses the factSourceDeckMap to resolve the correct deck per-fact for template and
 * distractor selection.
 *
 * @param context - Which non-combat context is requesting the quiz
 * @param customDeckItems - The custom deck items from DeckMode.custom_deck.items
 * @param factSourceDeckMap - Maps factId -> source deckId (from RunState.factSourceDeckMap)
 * @param confusionMatrix - Player's cross-run confusion matrix
 * @param inRunTracker - In-run fact tracker; if null, a temporary empty one is created
 * @param cardMasteryLevel - Card mastery for difficulty scaling (default 1)
 * @param runSeed - Run seed for deterministic selection
 * @param meditatedThemeId - Optional chain theme ID with reduced distractors
 * @param excludeFactIds - Fact IDs already selected in this batch; excluded to prevent duplicates
 * @returns A NonCombatQuizQuestion or null if no facts available
 */
export function selectNonCombatCustomDeckQuestion(
  context: 'shop' | 'rest' | 'boss' | 'mystery',
  customDeckItems: CustomDeckRunItem[],
  factSourceDeckMap: Record<string, string>,
  confusionMatrix: ConfusionMatrix,
  inRunTracker: InRunFactTracker | null,
  cardMasteryLevel: number,
  runSeed: number,
  meditatedThemeId?: number,
  excludeFactIds?: ReadonlySet<string>,
): NonCombatQuizQuestion | null {
  // Merge facts from all custom deck items — interleaved round-robin so all decks
  // contribute proportionally from the start (flatMap would front-load the largest deck).
  let factPool: DeckFact[] = interleaveFacts(
    customDeckItems.map(item => getCuratedDeckFacts(item.deckId, item.subDeckId, item.examTags)),
  );
  if (factPool.length === 0) return null;

  // Exclude already-selected facts to prevent duplicates across a multi-question batch.
  if (excludeFactIds && excludeFactIds.size > 0) {
    const filtered = factPool.filter(f => !excludeFactIds.has(f.id));
    if (filtered.length > 0) {
      factPool = filtered;
    }
  }

  const tracker = inRunTracker ?? new InRunFactTracker();
  const contextOffset = context.charCodeAt(0);
  const effectiveSeed = runSeed + contextOffset;

  const { fact } = selectFactForCharge(factPool, tracker, cardMasteryLevel, effectiveSeed);

  // Resolve the source deck for this specific fact
  const sourceDeckId = factSourceDeckMap[fact.id];
  const deck = sourceDeckId ? getCuratedDeck(sourceDeckId) : undefined;
  if (!deck) return null;

  const templateResult = selectQuestionTemplate(fact, deck, cardMasteryLevel, [], effectiveSeed);

  const distractorCount = getDistractorCount(cardMasteryLevel, meditatedThemeId, fact.chainThemeId);
  const pool = deck.answerTypePools.find(p => p.id === templateResult.answerPoolId);

  let choices: string[];
  let distractorFactIds: string[] = [];

  if (isNumericalAnswer(fact.correctAnswer)) {
    const factAdapter = { id: fact.id, correctAnswer: fact.correctAnswer } as Fact;
    const numericalDistractors = getNumericalDistractors(factAdapter, distractorCount);
    const correctDisplay = displayAnswer(fact.correctAnswer);
    choices = [correctDisplay, ...numericalDistractors];
  } else if (pool) {
    // Use the source deck's facts for distractor selection (pool-internal coherence)
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
    choices = [templateResult.correctAnswer, ...fact.distractors.slice(0, distractorCount)];
  }

  // Shuffle choices
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }

  // Build image quiz fields
  let quizMode: 'text' | 'image_question' | 'image_answers' | 'chess_tactic' | undefined;
  let imageAssetPath: string | undefined;
  let answerImagePaths: string[] | undefined;
  let displayQuestion = templateResult.renderedQuestion;
  let finalCorrectAnswer = displayAnswer(templateResult.correctAnswer);

  if (fact.quizMode === 'image_question' && fact.imageAssetPath) {
    const questionType = rollFlagQuestionType();
    switch (questionType) {
      case 'identify':
        quizMode = 'image_question';
        imageAssetPath = fact.imageAssetPath;
        break;
      case 'reverse': {
        quizMode = 'image_answers';
        const imageByAnswerRev = new Map<string, string>();
        for (const df of factPool) {
          if (df.imageAssetPath) {
            imageByAnswerRev.set(df.correctAnswer.toLowerCase(), df.imageAssetPath);
            imageByAnswerRev.set(displayAnswer(df.correctAnswer).toLowerCase(), df.imageAssetPath);
          }
        }
        answerImagePaths = choices.map(c => imageByAnswerRev.get(c.toLowerCase()) ?? '');
        displayQuestion = `Select the flag of ${finalCorrectAnswer}`;
        break;
      }
      case 'continent': {
        quizMode = 'image_question';
        imageAssetPath = fact.imageAssetPath;
        displayQuestion = 'This flag belongs to a country on which continent?';
        const correctContinent = REGION_NAMES[fact.chainThemeId] ?? 'Europe';
        const continentChoices = [...REGION_NAMES].sort(() => Math.random() - 0.5);
        choices.length = 0;
        choices.push(...continentChoices);
        finalCorrectAnswer = correctContinent;
        break;
      }
      case 'not_elimination': {
        const factContinent = fact.chainThemeId;
        const otherContinentIdx = ((factContinent + 1 + Math.floor(Math.random() * 4)) % 5);
        const otherContinentName = REGION_NAMES[otherContinentIdx];
        const sameRegionFacts = factPool.filter(
          df => df.chainThemeId === otherContinentIdx && !!df.imageAssetPath && df.id !== fact.id,
        );
        if (sameRegionFacts.length >= 3) {
          quizMode = 'image_answers';
          const shuffledSame = [...sameRegionFacts].sort(() => Math.random() - 0.5).slice(0, 3);
          const notChoices = [...shuffledSame.map(f => f.correctAnswer), fact.correctAnswer];
          for (let i = notChoices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [notChoices[i], notChoices[j]] = [notChoices[j], notChoices[i]];
          }
          const imageByAnswerNot = new Map<string, string>();
          for (const df of factPool) {
            if (df.imageAssetPath) {
              imageByAnswerNot.set(df.correctAnswer.toLowerCase(), df.imageAssetPath);
            }
          }
          answerImagePaths = notChoices.map(a => imageByAnswerNot.get(a.toLowerCase()) ?? '');
          choices.length = 0;
          choices.push(...notChoices);
          displayQuestion = `Which of these flags is NOT from ${otherContinentName}?`;
          finalCorrectAnswer = displayAnswer(fact.correctAnswer);
        } else {
          quizMode = 'image_question';
          imageAssetPath = fact.imageAssetPath;
        }
        break;
      }
    }
  } else if (fact.quizMode && fact.quizMode !== 'text') {
    quizMode = fact.quizMode;
    if (fact.quizMode === 'image_question') {
      imageAssetPath = fact.imageAssetPath;
    }
  }

  return {
    question: displayQuestion,
    correctAnswer: finalCorrectAnswer,
    choices,
    factId: fact.id,
    isStudyMode: true,
    distractorFactIds,
    quizMode,
    imageAssetPath,
    answerImagePaths,
    sentenceFurigana: fact.sentenceFurigana,
    sentenceRomaji: fact.sentenceRomaji,
    sentenceTranslation: fact.sentenceTranslation,
    grammarPointLabel: fact.grammarPointLabel,
  };
}

// ---------------------------------------------------------------------------
// Deprecated alias — kept for backward compatibility while callers are updated.
// @deprecated Use selectNonCombatCustomDeckQuestion
// ---------------------------------------------------------------------------
export const selectNonCombatPlaylistQuestion = selectNonCombatCustomDeckQuestion;
