// === Vocabulary Question Variant Service ===
// Selects and builds question variants for vocabulary facts based on card tier.
// Supports Forward, Reverse, Synonym Pick, and Definition Match.
// NO Phaser, Svelte, or DOM imports.

import type { Fact } from '../data/types';
import type { CardTier } from '../data/card-types';
import synonymMapData from '../data/generated/synonymMap.json';

/** Loaded synonym map — populated by build-synonym-map.mjs, empty until then. */
const synonymMap = synonymMapData as Record<string, { synonyms: string[]; related: string[] }>;

/** Available vocab question variant types. */
export type VocabVariant = 'forward' | 'reverse' | 'synonym' | 'definition';

/** Result of building a variant question. */
export interface VariantQuestion {
  /** The variant type that was actually used (may differ from requested if fallback occurred). */
  variant: VocabVariant;
  /** The question text to display. */
  questionText: string;
  /** The correct answer string. */
  correctAnswer: string;
  /** Whether answer choices should be L2 (target language) words or English. */
  answerPool: 'english' | 'l2';
  /** For synonym variant: the synonym alternatives that are also correct. */
  acceptableAnswers?: string[];
}

/**
 * Weighted variant selection per tier.
 * Tier 1: forward only
 * Tier 2a: forward 60%, reverse 40%
 * Tier 2b: forward 30%, reverse 30%, synonym 20%, definition 20%
 * Tier 3: handled by mastery system (free recall), not used here
 */
const TIER_VARIANT_WEIGHTS: Record<string, { variant: VocabVariant; weight: number }[]> = {
  '1':  [{ variant: 'forward', weight: 1 }],
  '2a': [{ variant: 'forward', weight: 60 }, { variant: 'reverse', weight: 40 }],
  '2b': [
    { variant: 'forward', weight: 30 },
    { variant: 'reverse', weight: 30 },
    { variant: 'synonym', weight: 20 },
    { variant: 'definition', weight: 20 },
  ],
  '3':  [{ variant: 'forward', weight: 1 }], // Tier 3 uses free recall elsewhere
};

/**
 * Select a variant type for the given tier and fact.
 * Validates that the selected variant is actually feasible for this fact,
 * falling back to 'forward' if not.
 *
 * NOTE: Variants only trigger for vocab facts at tier 2a+.
 * - Tier 1 (stability<2 OR consecutiveCorrect<2): forward-only — this is EXPECTED for early runs.
 * - Tier 2a (stability>=2, consecutiveCorrect>=2): 60% forward / 40% reverse
 * - Tier 2b (stability>=5, consecutiveCorrect>=3): 30/30/20/20 forward/reverse/synonym/definition
 * - Tier 3: free-recall mastery trial, handled elsewhere — forward used as MC fallback
 *
 * In a fresh run all cards start at Tier 1, so ALL questions will be forward until
 * a card reaches stability>=2 AND consecutiveCorrect>=2 (roughly 2 correct answers in a row
 * with FSRS stability growing past 2 days). This is by design, not a bug.
 */
export function selectVariant(tier: CardTier, fact: Fact): VocabVariant {
  // Only vocab facts get variants
  if (fact.type !== 'vocabulary') return 'forward';

  const weights = TIER_VARIANT_WEIGHTS[tier] ?? TIER_VARIANT_WEIGHTS['1'];
  const selected = weightedRandomPick(weights);

  // Validate the selected variant is feasible; fall back to forward if data is missing
  let fallbackReason: string | null = null;
  if (selected === 'synonym' && !hasSynonymData(fact.correctAnswer)) {
    fallbackReason = `synonym: no synonymMap entry for "${fact.correctAnswer}"`;
  } else if (selected === 'definition' && !hasValidDefinition(fact)) {
    fallbackReason = `definition: explanation missing or too short (<15 chars)`;
  } else if (selected === 'reverse' && !canExtractL2Word(fact)) {
    fallbackReason = `reverse: could not extract L2 word from quizQuestion "${fact.quizQuestion}"`;
  }

  const final: VocabVariant = fallbackReason ? 'forward' : selected;

  if (import.meta.env.DEV) {
    console.log(
      `[QuizVariant] fact=${fact.id} tier=${tier} selected=${selected} final=${final}` +
      (fallbackReason ? ` reason="fallback — ${fallbackReason}"` : ` reason="ok"`),
    );
  }

  return final;
}

/**
 * Build the question presentation for a given variant.
 * Returns the question text, correct answer, and which answer pool to use.
 */
export function buildVariantQuestion(fact: Fact, variant: VocabVariant): VariantQuestion {
  switch (variant) {
    case 'forward':
      return buildForward(fact);
    case 'reverse':
      return buildReverse(fact);
    case 'synonym':
      return buildSynonym(fact);
    case 'definition':
      return buildDefinition(fact);
    default:
      return buildForward(fact);
  }
}

// ── Synonym map accessors ──

/**
 * Returns synonym list for a word, or empty array if none.
 */
function getSynonyms(word: string): string[] {
  return synonymMap[word.toLowerCase()]?.synonyms ?? [];
}

/**
 * Returns related words for a word, or empty array if none.
 */
export function getRelatedWords(word: string): string[] {
  return synonymMap[word.toLowerCase()]?.related ?? [];
}

/**
 * Returns true if the synonym map has an entry for this word.
 */
function hasSynonymData(word: string): boolean {
  return word.toLowerCase() in synonymMap;
}

// ── Variant builders ──

function buildForward(fact: Fact): VariantQuestion {
  return {
    variant: 'forward',
    questionText: fact.quizQuestion,
    correctAnswer: fact.correctAnswer,
    answerPool: 'english',
  };
}

function buildReverse(fact: Fact): VariantQuestion {
  const l2Word = extractL2Word(fact);
  if (!l2Word) return buildForward(fact); // fallback

  const langName = getLanguageName(fact.language ?? '');
  return {
    variant: 'reverse',
    questionText: `How do you say "${fact.correctAnswer}" in ${langName}?`,
    correctAnswer: l2Word,
    answerPool: 'l2',
  };
}

function buildSynonym(fact: Fact): VariantQuestion {
  const synonyms = getSynonyms(fact.correctAnswer);
  if (synonyms.length === 0) return buildForward(fact); // fallback

  const l2Word = extractL2Word(fact);
  const displayWord = l2Word || fact.correctAnswer;

  // Pick one synonym as the correct answer
  const correctSynonym = synonyms[Math.floor(Math.random() * synonyms.length)];

  return {
    variant: 'synonym',
    questionText: `Which word is closest in meaning to "${displayWord}"?`,
    correctAnswer: correctSynonym,
    answerPool: 'english',
    acceptableAnswers: synonyms, // all synonyms are acceptable
  };
}

function buildDefinition(fact: Fact): VariantQuestion {
  const definition = extractDefinition(fact);
  if (!definition) return buildForward(fact); // fallback

  return {
    variant: 'definition',
    questionText: definition,
    correctAnswer: fact.correctAnswer,
    answerPool: 'english',
  };
}

// ── Helpers ──

/**
 * Extract the L2 (target language) word from a vocab fact's quizQuestion.
 * Quiz questions typically look like: 'What does "ベンチ" mean?' or 'What does "Bank" mean?'
 */
export function extractL2Word(fact: Fact): string | null {
  // Try quoted word first: What does "word" mean?
  const quoted = fact.quizQuestion.match(/["「'']([^"」'']+)["」'']/);
  if (quoted) return quoted[1];

  // Try: What does WORD (reading) mean?
  const withReading = fact.quizQuestion.match(/What does [""]?(.+?)[""]?\s*(?:\(|mean)/i);
  if (withReading) return withReading[1].trim();

  // Try extracting from statement: "WORD means X in Language"
  const fromStatement = fact.statement.match(/^(.+?)\s+means?\s+/i);
  if (fromStatement) return fromStatement[1].trim();

  return null;
}

/**
 * Check if a fact has a usable definition for the Definition Match variant.
 */
function hasValidDefinition(fact: Fact): boolean {
  return !!extractDefinition(fact);
}

/**
 * Extract a clean definition from the fact's explanation field.
 * Strips the L2 word and language references to create a pure English definition.
 */
function extractDefinition(fact: Fact): string | null {
  const explanation = fact.explanation;
  if (!explanation || explanation.length < 15) return null;

  // explanation often looks like: "Bank — bench (which people sit on). Part of speech: noun."
  // We want: "bench (which people sit on)"
  // Strip the L2 word prefix if present
  let def = explanation;

  // Remove "WORD — " prefix
  const dashIdx = def.indexOf('—');
  if (dashIdx > 0 && dashIdx < 30) {
    def = def.slice(dashIdx + 1).trim();
  } else {
    const colonIdx = def.indexOf(':');
    if (colonIdx > 0 && colonIdx < 30) {
      def = def.slice(colonIdx + 1).trim();
    }
  }

  // Remove "Part of speech: X." suffix
  def = def.replace(/\.\s*Part of speech:.*$/i, '').trim();
  // Remove "Also: ..." suffix
  def = def.replace(/\.\s*Also:.*$/i, '').trim();

  if (def.length < 10) return null;

  // Don't show if it just says the correct answer with no extra info
  if (def.toLowerCase() === fact.correctAnswer.toLowerCase()) return null;

  return def;
}

/** Map language codes to display names. */
function getLanguageName(code: string): string {
  const names: Record<string, string> = {
    ja: 'Japanese',
    ko: 'Korean',
    zh: 'Chinese',
    de: 'German',
    fr: 'French',
    es: 'Spanish',
    nl: 'Dutch',
    cs: 'Czech',
  };
  return names[code] ?? code;
}

/**
 * Check if we can extract an L2 word for reverse questions.
 */
function canExtractL2Word(fact: Fact): boolean {
  return extractL2Word(fact) !== null;
}

/**
 * Weighted random selection from a list of { variant, weight } entries.
 */
function weightedRandomPick(entries: { variant: VocabVariant; weight: number }[]): VocabVariant {
  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * total;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) return entry.variant;
  }
  return entries[0].variant;
}
