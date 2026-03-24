/**
 * Types for curated deck data loaded from JSON.
 * Per DECKBUILDER.md §3.1.
 */

/** A full curated deck loaded from JSON. */
export interface CuratedDeck {
  id: string;
  name: string;
  domain: string;
  subDomain?: string;
  description: string;
  minimumFacts: number;
  targetFacts: number;
  facts: DeckFact[];
  answerTypePools: AnswerTypePool[];
  synonymGroups: SynonymGroup[];
  questionTemplates: QuestionTemplate[];
  difficultyTiers: DifficultyTier[];
}

export interface DeckFact {
  id: string;
  correctAnswer: string;
  acceptableAlternatives: string[];
  synonymGroupId?: string;
  /** Generic chain theme slot 0-5. */
  chainThemeId: number;
  answerTypePoolId: string;
  /** Difficulty 1-5. */
  difficulty: number;
  /** Fun score 1-10. */
  funScore: number;
  quizQuestion: string;
  explanation: string;
  visualDescription: string;
  sourceName: string;
  sourceUrl?: string;
  /** Volatile facts may become incorrect over time (e.g. current record holders). */
  volatile?: boolean;
  /** Pre-generated fallback distractors (8-12). */
  distractors: string[];
  // Vocabulary-specific optional fields
  targetLanguageWord?: string;
  reading?: string;
  language?: string;
  /** Part of speech: verb, noun, adjective, adverb, etc. Used for POS-matched distractors. */
  partOfSpeech?: string;
}

export interface AnswerTypePool {
  id: string;
  label: string;
  /** "name" | "year" | "number" | "term" | "place" | "word" */
  answerFormat: string;
  factIds: string[];
  /** Default 5. */
  minimumSize: number;
}

export interface SynonymGroup {
  id: string;
  factIds: string[];
  reason: string;
}

export interface QuestionTemplate {
  id: string;
  answerPoolId: string;
  /** Template string with {placeholders}. */
  questionFormat: string;
  availableFromMastery: number;
  difficulty: number;
  reverseCapable: boolean;
}

export interface DifficultyTier {
  tier: 'easy' | 'medium' | 'hard';
  factIds: string[];
}
