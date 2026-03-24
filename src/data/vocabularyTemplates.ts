import type { QuestionTemplate } from './curatedDeckTypes';

/**
 * Standard question templates for vocabulary decks (all languages).
 * Per DECKBUILDER.md §5.2.
 *
 * Placeholder fields used:
 * - {targetLanguageWord} — the word in the target language (e.g., 食べる)
 * - {correctAnswer} — the English meaning
 * - {language} — the language name (e.g., "Japanese")
 * - {explanation} — the fact's explanation text (used for definition_match)
 */
export const VOCABULARY_TEMPLATES: QuestionTemplate[] = [
  {
    id: 'forward',
    answerPoolId: 'english_meanings',
    questionFormat: "What does '{targetLanguageWord}' mean?",
    availableFromMastery: 0,
    difficulty: 1,
    reverseCapable: false,
  },
  {
    id: 'reading',
    answerPoolId: 'reading_hiragana',
    questionFormat: "What is the reading of '{targetLanguageWord}'?",
    availableFromMastery: 1,
    difficulty: 2,
    reverseCapable: false,
  },
  {
    id: 'reverse',
    answerPoolId: 'target_language_words',
    questionFormat: "How do you say '{correctAnswer}' in {language}?",
    availableFromMastery: 2,
    difficulty: 3,
    reverseCapable: false,
  },
  {
    id: 'synonym_pick',
    answerPoolId: 'english_meanings',
    questionFormat: "Which word is closest in meaning to '{targetLanguageWord}'?",
    availableFromMastery: 3,
    difficulty: 4,
    reverseCapable: false,
  },
  {
    id: 'definition_match',
    answerPoolId: 'english_meanings',
    questionFormat: '{explanation}',
    availableFromMastery: 3,
    difficulty: 4,
    reverseCapable: false,
  },
];

/**
 * Check if a vocabulary template is applicable to a given deck.
 * The 'reading' template only applies when the deck has a reading pool
 * (e.g., reading_hiragana for Japanese, reading_pinyin for Chinese).
 */
export function getApplicableVocabTemplates(
  availablePoolIds: Set<string>,
): QuestionTemplate[] {
  return VOCABULARY_TEMPLATES.filter(t => availablePoolIds.has(t.answerPoolId));
}
