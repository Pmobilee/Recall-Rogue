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

/** Configurable display option for a language deck */
export interface LanguageDeckOption {
  id: string              // 'furigana', 'romaji'
  label: string           // 'Show Furigana'
  description: string     // 'Display hiragana readings above kanji'
  type: 'toggle'          // extensible later
  default: boolean        // default value
}

/** Language configuration */
export interface LanguageConfig {
  code: string          // ISO 639-1
  name: string
  nativeName: string
  levels: LanguageLevel[]
  voiceId?: string      // TTS voice identifier
  subdecks?: string[]                    // Available subdecks e.g. ['Vocabulary', 'Kanji', 'Grammar', 'Kana']
  options?: LanguageDeckOption[]         // Configurable display options
}

export interface LanguageLevel {
  id: string            // 'N5', 'A1', etc.
  name: string          // 'JLPT N5', 'CEFR A1'
  wordCount: number     // Approximate number of vocabulary items
  order: number         // Sort order (lower = easier)
}

export const LAUNCH_LANGUAGE_CODES = ['ja', 'es', 'fr', 'de', 'ko', 'zh'] as const

export type LaunchLanguageCode = typeof LAUNCH_LANGUAGE_CODES[number]

export const LANGUAGE_FLAGS: Record<string, string> = {
  ja: '\u{1F1EF}\u{1F1F5}',
  es: '\u{1F1EA}\u{1F1F8}',
  fr: '\u{1F1EB}\u{1F1F7}',
  de: '\u{1F1E9}\u{1F1EA}',
  ko: '\u{1F1F0}\u{1F1F7}',
  zh: '\u{1F1E8}\u{1F1F3}',
}

/** Supported launch languages for vocabulary mode (AR-18). */
export const SUPPORTED_LANGUAGES: LanguageConfig[] = [
  {
    code: 'ja',
    name: 'Japanese',
    nativeName: '\u65e5\u672c\u8a9e',
    levels: [
      { id: 'N5', name: 'JLPT N5', wordCount: 800, order: 1 },
      { id: 'N4', name: 'JLPT N4', wordCount: 1500, order: 2 },
      { id: 'N3', name: 'JLPT N3', wordCount: 3500, order: 3 },
      { id: 'N2', name: 'JLPT N2', wordCount: 5000, order: 4 },
      { id: 'N1', name: 'JLPT N1', wordCount: 10000, order: 5 }
    ],
    voiceId: 'ja-JP-NanamiNeural',
    subdecks: ['Vocabulary', 'Kanji', 'Grammar', 'Kana'],
    options: [
      { id: 'furigana', label: 'Show Furigana', description: 'Display hiragana readings above kanji', type: 'toggle', default: true },
      { id: 'romaji', label: 'Show Romaji', description: 'Display romanized readings', type: 'toggle', default: false },
      { id: 'kanaOnly', label: 'Kana Only', description: 'Replace all kanji with hiragana (for beginners)', type: 'toggle', default: false },
      { id: 'alwaysWrite', label: 'Always Write Answers', description: 'Type answers instead of multiple choice', type: 'toggle', default: false },
    ]
  },
  {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Espa\u00f1ol',
    levels: [
      { id: 'A1', name: 'CEFR A1', wordCount: 700, order: 1 },
      { id: 'A2', name: 'CEFR A2', wordCount: 1500, order: 2 },
      { id: 'B1', name: 'CEFR B1', wordCount: 2600, order: 3 },
      { id: 'B2', name: 'CEFR B2', wordCount: 3800, order: 4 },
      { id: 'C1', name: 'CEFR C1', wordCount: 4600, order: 5 },
      { id: 'C2', name: 'CEFR C2', wordCount: 5200, order: 6 }
    ],
    voiceId: 'es-ES-ElviraNeural',
    subdecks: ['spanish_a1', 'spanish_a2', 'spanish_b1', 'spanish_b2', 'spanish_c1'],
    options: [
      { id: 'alwaysWrite', label: 'Always Write Answers', description: 'Type answers instead of multiple choice', type: 'toggle' as const, default: false }
    ]
  },
  {
    code: 'fr',
    name: 'French',
    nativeName: 'Fran\u00e7ais',
    levels: [
      { id: 'A1', name: 'CEFR A1', wordCount: 650, order: 1 },
      { id: 'A2', name: 'CEFR A2', wordCount: 1400, order: 2 },
      { id: 'B1', name: 'CEFR B1', wordCount: 2500, order: 3 },
      { id: 'B2', name: 'CEFR B2', wordCount: 3600, order: 4 },
      { id: 'C1', name: 'CEFR C1', wordCount: 4400, order: 5 },
      { id: 'C2', name: 'CEFR C2', wordCount: 5000, order: 6 }
    ],
    voiceId: 'fr-FR-DeniseNeural',
    subdecks: ['french_a1', 'french_a2', 'french_b1', 'french_b2', 'french_c1', 'french_c2'],
    options: [
      { id: 'alwaysWrite', label: 'Always Write Answers', description: 'Type answers instead of multiple choice', type: 'toggle' as const, default: false }
    ]
  },
  {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    levels: [
      { id: 'A1', name: 'CEFR A1', wordCount: 700, order: 1 },
      { id: 'A2', name: 'CEFR A2', wordCount: 1500, order: 2 },
      { id: 'B1', name: 'CEFR B1', wordCount: 2600, order: 3 },
      { id: 'B2', name: 'CEFR B2', wordCount: 3800, order: 4 },
      { id: 'C1', name: 'CEFR C1', wordCount: 4700, order: 5 },
      { id: 'C2', name: 'CEFR C2', wordCount: 5300, order: 6 }
    ],
    voiceId: 'de-DE-KatjaNeural',
    subdecks: ['german_a1', 'german_a2', 'german_b1', 'german_b2', 'german_c1', 'german_c2'],
    options: [
      { id: 'alwaysWrite', label: 'Always Write Answers', description: 'Type answers instead of multiple choice', type: 'toggle' as const, default: false }
    ]
  },
  {
    code: 'nl',
    name: 'Dutch',
    nativeName: 'Nederlands',
    levels: [
      { id: 'A1', name: 'CEFR A1', wordCount: 650, order: 1 },
      { id: 'A2', name: 'CEFR A2', wordCount: 1400, order: 2 },
      { id: 'B1', name: 'CEFR B1', wordCount: 2500, order: 3 },
      { id: 'B2', name: 'CEFR B2', wordCount: 3600, order: 4 },
      { id: 'C1', name: 'CEFR C1', wordCount: 4400, order: 5 }
    ],
    voiceId: 'nl-NL-ColetteNeural',
    subdecks: ['dutch_a1', 'dutch_a2', 'dutch_c1'],
    options: [
      { id: 'alwaysWrite', label: 'Always Write Answers', description: 'Type answers instead of multiple choice', type: 'toggle' as const, default: false }
    ]
  },
  {
    code: 'cs',
    name: 'Czech',
    nativeName: '\u010ce\u0161tina',
    levels: [
      { id: 'A1', name: 'CEFR A1', wordCount: 650, order: 1 },
      { id: 'A2', name: 'CEFR A2', wordCount: 1400, order: 2 },
      { id: 'B1', name: 'CEFR B1', wordCount: 2500, order: 3 },
      { id: 'B2', name: 'CEFR B2', wordCount: 3600, order: 4 },
      { id: 'C1', name: 'CEFR C1', wordCount: 4400, order: 5 }
    ],
    voiceId: 'cs-CZ-VlastaNeural',
    subdecks: ['czech_a1', 'czech_a2', 'czech_b1', 'czech_b2', 'czech_c1'],
    options: [
      { id: 'alwaysWrite', label: 'Always Write Answers', description: 'Type answers instead of multiple choice', type: 'toggle' as const, default: false }
    ]
  },
  {
    code: 'ko',
    name: 'Korean',
    nativeName: '\ud55c\uad6d\uc5b4',
    levels: [
      { id: 'TOPIK1', name: 'TOPIK 1', wordCount: 800, order: 1 },
      { id: 'TOPIK2', name: 'TOPIK 2', wordCount: 1600, order: 2 },
      { id: 'TOPIK3', name: 'TOPIK 3', wordCount: 2600, order: 3 },
      { id: 'TOPIK4', name: 'TOPIK 4', wordCount: 3600, order: 4 },
      { id: 'TOPIK5', name: 'TOPIK 5', wordCount: 4500, order: 5 },
      { id: 'TOPIK6', name: 'TOPIK 6', wordCount: 5400, order: 6 }
    ],
    voiceId: 'ko-KR-SunHiNeural',
    subdecks: ['korean_beginner', 'korean_intermediate', 'korean_advanced'],
    options: [
      { id: 'romanization', label: 'Show Romanization', description: 'Display romanized pronunciation', type: 'toggle', default: false },
      { id: 'alwaysWrite', label: 'Always Write Answers', description: 'Type answers instead of multiple choice', type: 'toggle' as const, default: false },
    ]
  },
  {
    code: 'zh',
    name: 'Mandarin Chinese',
    nativeName: '\u666e\u901a\u8bdd',
    levels: [
      { id: 'HSK1', name: 'HSK 1', wordCount: 500, order: 1 },
      { id: 'HSK2', name: 'HSK 2', wordCount: 1272, order: 2 },
      { id: 'HSK3', name: 'HSK 3', wordCount: 2245, order: 3 },
      { id: 'HSK4', name: 'HSK 4', wordCount: 3245, order: 4 },
      { id: 'HSK5', name: 'HSK 5', wordCount: 4316, order: 5 },
      { id: 'HSK6', name: 'HSK 6', wordCount: 5456, order: 6 }
    ],
    voiceId: 'zh-CN-XiaoxiaoNeural',
    subdecks: ['chinese_hsk1', 'chinese_hsk2', 'chinese_hsk3', 'chinese_hsk4', 'chinese_hsk5', 'chinese_hsk6', 'chinese_hsk7'],
    options: [
      { id: 'pinyin', label: 'Show Pinyin', description: 'Display pinyin pronunciation above characters', type: 'toggle', default: true },
      { id: 'pinyinOnly', label: 'Pinyin Only', description: 'Replace characters with pinyin (for beginners)', type: 'toggle', default: false },
      { id: 'alwaysWrite', label: 'Always Write Answers', description: 'Type answers instead of multiple choice', type: 'toggle' as const, default: false },
    ]
  },
]

/** Get language config by code */
export function getLanguageConfig(code: string): LanguageConfig | undefined {
  return SUPPORTED_LANGUAGES.find(l => l.code === code)
}

export function getLanguageFlag(code: string): string {
  return LANGUAGE_FLAGS[code] ?? '\u{1F310}'
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
