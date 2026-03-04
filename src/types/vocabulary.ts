/** SM-2 track types for vocabulary learning (DD-V2-128) */
export type VocabularyTrack = 'recognition' | 'recall' | 'usage'

/** All review track types including default for general facts */
export type ReviewTrack = 'default' | VocabularyTrack

/** Vocabulary fact content type */
export type VocabularyFactType = 'vocabulary' | 'grammar' | 'phrase'

/** Listening fact stub (Phase 24.3 — future implementation) */
export interface ListeningFact {
  id: string
  type: 'listening'
  language: string
  languageLevel: string
  audioPromptUrl: string
  transcriptOptions: string[]
  correctTranscript: string
  category: string[]
  sourceUrl: string
  sourceName: string
  age_rating: 'kid' | 'teen' | 'adult'
}

/** Conversation fact stub (Phase 24.3 — future implementation) */
export interface ConversationFact {
  id: string
  type: 'conversation'
  language: string
  languageLevel: string
  scenario: string
  correctResponse: string
  alternativeResponses: string[]
  category: string[]
  sourceUrl: string
  sourceName: string
  age_rating: 'kid' | 'teen' | 'adult'
}

/** Quiz content for a specific track */
export interface TrackQuizContent {
  question: string
  correctAnswer: string
  distractors: string[]
  hint?: string
}

/** Full vocabulary fact with all three SM-2 tracks */
export interface VocabularyFact {
  id: string
  type: VocabularyFactType
  language: string            // ISO 639-1: 'ja', 'es', 'fr'
  languageLevel: string       // 'N5', 'N4', 'N3', 'A1', 'A2', 'B1'

  // Target language content
  word: string
  reading?: string            // Japanese: hiragana reading
  romaji?: string             // Japanese: romanized reading
  partOfSpeech: string

  // Meanings and context
  primaryMeaning: string
  alternativeMeanings: string[]
  exampleSentence: string
  exampleSentenceTranslation: string
  contextNote?: string

  // Quiz content per track
  recognition: TrackQuizContent
  recall: TrackQuizContent
  usage: TrackQuizContent & { sentenceWithBlank: string }

  // Audio (DD-V2-094)
  audioUrl?: string
  audioGeneratedAt?: string

  // Standard fact fields
  category: string[]
  imageUrl?: string
  imagePrompt?: string
  gaiaComment: string
  wowFactor?: string
  sourceUrl: string
  sourceName: string
  age_rating: 'kid' | 'teen' | 'adult'
}

/** Language configuration */
export interface LanguageConfig {
  code: string          // ISO 639-1
  name: string
  nativeName: string
  levels: LanguageLevel[]
  voiceId?: string      // TTS voice identifier
}

export interface LanguageLevel {
  id: string            // 'N5', 'A1', etc.
  name: string          // 'JLPT N5', 'CEFR A1'
  wordCount: number     // Approximate number of vocabulary items
  order: number         // Sort order (lower = easier)
}

/** Supported languages for V1 */
export const SUPPORTED_LANGUAGES: LanguageConfig[] = [
  {
    code: 'ja',
    name: 'Japanese',
    nativeName: '\u65e5\u672c\u8a9e',
    levels: [
      { id: 'N5', name: 'JLPT N5', wordCount: 280, order: 1 },
      { id: 'N4', name: 'JLPT N4', wordCount: 650, order: 2 },
      { id: 'N3', name: 'JLPT N3', wordCount: 400, order: 3 }
    ],
    voiceId: 'ja-JP-NanamiNeural'
  },
  {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Espa\u00f1ol',
    levels: [
      { id: 'A1', name: 'CEFR A1', wordCount: 500, order: 1 },
      { id: 'A2', name: 'CEFR A2', wordCount: 800, order: 2 }
    ],
    voiceId: 'es-ES-ElviraNeural'
  }
]

/** Get language config by code */
export function getLanguageConfig(code: string): LanguageConfig | undefined {
  return SUPPORTED_LANGUAGES.find(l => l.code === code)
}

/**
 * Determine which SM-2 tracks are active for a vocabulary fact.
 * DD-V2-128: Tracks unlock sequentially based on recognition interval.
 * - recognition: always active from discovery
 * - recall: activates when recognition interval >= 4 days
 * - usage: activates when recognition interval >= 15 days
 */
export function getActiveTracksForVocabularyFact(
  recognitionInterval: number
): VocabularyTrack[] {
  const tracks: VocabularyTrack[] = ['recognition']
  if (recognitionInterval >= 4) tracks.push('recall')
  if (recognitionInterval >= 15) tracks.push('usage')
  return tracks
}

/**
 * Check if attempting to quiz a stub fact type.
 * Throws for unimplemented types (listening, conversation).
 */
export function assertQuizzableType(type: string): void {
  if (type === 'listening') {
    throw new Error('ListeningFact quiz not yet implemented — Phase 24.4')
  }
  if (type === 'conversation') {
    throw new Error('ConversationFact quiz not yet implemented — Phase 24.4')
  }
}
