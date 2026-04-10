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
  /** Rich grammar explanation shown on wrong answers for language/grammar facts. */
  grammarNote?: string;
  /** When true, quiz answers are displayed with ~ prefix + full grammar point form. Used for fragment extractions. */
  displayAsFullForm?: boolean;
  /** The full canonical grammar point to display when displayAsFullForm is true (e.g. "てくれる" for a fragment "くれ"). */
  fullFormDisplay?: string;
  /** Baked furigana segments for Japanese grammar sentences. Each segment has surface text `t`, optional hiragana reading `r` (only if `t` contains kanji), and optional English gloss `g` from JMdict (content words only). Produced by scripts/japanese/bake-grammar-furigana.mjs. */
  sentenceFurigana?: Array<{ t: string; r?: string; g?: string }>;
  /** Baked whole-sentence romaji for Japanese grammar facts. Displayed under the sentence when romaji toggle is on. */
  sentenceRomaji?: string;
  /** First-class English translation for Japanese grammar sentences (promoted out of `quizQuestion` line 2). */
  sentenceTranslation?: string;
  /** Short grammar-point label displayed as a hint in typing mode (e.g., "が — subject marker particle"). Derived from `explanation`. */
  grammarPointLabel?: string;
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
  /** Pronunciation / reading for the target word (e.g., hiragana for Japanese kanji). */
  pronunciation?: string;
  /** Part of speech: verb, noun, adjective, adverb, etc. Used for POS-matched distractors. */
  partOfSpeech?: string;
  /** Exam relevance tags for filtering study sessions. E.g. "USMLE_Step1", "high_yield", "clinical_correlation" */
  examTags?: string[];
  /** Top-level domain category (e.g. 'history', 'science', 'language'). Persisted to curated.db for runtime domain resolution. */
  categoryL1?: string;
  /** Sub-domain category (e.g. 'ancient_rome', 'mammals'). Persisted to curated.db for runtime domain resolution. */
  categoryL2?: string;
  /** Path to image asset (relative to /public/). For image-based quiz modes. */
  imageAssetPath?: string;
  /** Quiz presentation: 'text' (default), 'image_question' (image shown, text answers), 'image_answers' (text shown, image answer grid), 'chess_tactic' (interactive board puzzle). */
  quizMode?: 'text' | 'image_question' | 'image_answers' | 'chess_tactic';
  /** Quiz response mode: 'choice' (default multiple choice), 'typing' (text input with romaji→hiragana), or 'chess_move' (interactive board). */
  quizResponseMode?: 'choice' | 'typing' | 'chess_move' | 'map_pin';
  /** FEN string for chess puzzle positions. First field is the board state after the opponent's setup move. */
  fenPosition?: string;
  /** Full solution move sequence in UCI notation. Index 0 = opponent's setup move, index 1 = player's correct response. */
  solutionMoves?: string[];
  /** Lichess tactic theme tag (e.g., 'fork', 'pin', 'mateIn1'). */
  tacticTheme?: string;
  /** Original Lichess puzzle Elo rating. */
  lichessRating?: number;
  /** [latitude, longitude] of the target location for map_pin quiz mode. */
  mapCoordinates?: [number, number];
  /** Geographic region key for map centering (e.g. 'europe', 'asia'). Used with map_pin mode. */
  mapRegion?: string;
  /** Location difficulty tier 1-5 for Geo Elo calculation. tier 1 = easy capitals, tier 5 = obscure cities. */
  mapDifficultyTier?: number;
}

export interface AnswerTypePool {
  id: string;
  label: string;
  /** "name" | "year" | "number" | "term" | "place" | "word" */
  answerFormat: string;
  factIds: string[];
  /** Default 5. */
  minimumSize: number;
  /** Synthetic distractor values that belong to this pool but aren't any fact's correctAnswer.
   *  Used to pad small pools so they have enough variety for pool-based distractor selection.
   *  These appear as distractors but never as quiz questions. */
  syntheticDistractors?: string[];
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

/**
 * A player-created or imported deck (extends CuratedDeck with metadata).
 * Personal decks bypass the curated.db pipeline — they are persisted in PlayerSave
 * and registered into the in-memory deck store at startup via personalDeckStore.ts.
 */
export interface PersonalDeck extends CuratedDeck {
  /** How the deck was created. */
  source: 'anki_import' | 'manual';
  /** Unix timestamp (ms) when the deck was imported. */
  importedAt: number;
  /** Original deck name from the Anki .apkg file, if applicable. */
  ankiDeckName?: string;
  /** Total card count (may differ from facts.length if some notes were skipped). */
  cardCount: number;
}
