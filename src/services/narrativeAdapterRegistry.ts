/**
 * narrativeAdapterRegistry.ts — FactTypeAdapter registry for cross-deck narration.
 *
 * Solves the problem where narrativeGravity.ts's entity-noun model only works for
 * history/science/geography decks. For math/vocab/grammar/kanji decks it produced
 * garbage because it extracts entities that don't exist, then falls back to quoting
 * the whole question.
 *
 * Each adapter implements canEcho() (is this adapter applicable?) and
 * extractEchoText() (return a short evocative reference for narration). The adapter
 * also suggests a template family name matching the echo template directory names in
 * data/narratives/echoes/.
 *
 * Design spec: docs/mechanics/narrative.md §Thread 2 "The Echo Chamber"
 * Status: IMPLEMENTATION (Task 4.2 — Ch4 narrative overhaul)
 */

import type { DeckFact } from '../data/curatedDeckTypes';
import type { Fact } from '../data/types';

// ============================================================
// INTERFACE
// ============================================================

/** Minimal fact shape accepted by adapters — both DeckFact and Fact satisfy this. */
export interface AdaptableFact {
  correctAnswer: string;
  quizQuestion: string;
  explanation?: string;
  categoryL1?: string;
  categoryL2?: string;
  /** Part of speech presence indicates a vocabulary fact. */
  partOfSpeech?: string;
  /** Language code (e.g. 'ja', 'es', 'ko') for language/vocab/grammar facts. */
  language?: string;
  /** Pronunciation / reading (e.g. hiragana for Japanese kanji). */
  pronunciation?: string;
  /** Target language word for vocabulary facts. */
  targetLanguageWord?: string;
  /** Type field from trivia Fact. */
  type?: string;
}

/**
 * A FactTypeAdapter converts a fact of a specific deck type into the appropriate
 * echo text and narrative template family for the Woven Narrative Architecture.
 *
 * Adapters are pure functions — no side effects, no imports from game state.
 */
export interface FactTypeAdapter {
  /** Human-readable name for debugging. */
  readonly name: string;

  /**
   * Returns true if this adapter can produce meaningful echo text for the given fact.
   * Called in order — the first adapter returning true wins.
   */
  canEcho(fact: AdaptableFact): boolean;

  /**
   * Extract a short evocative reference from the fact for use in narration templates.
   * Should return 2-60 characters. Must NOT return an empty string.
   */
  extractEchoText(fact: DeckFact | Fact | AdaptableFact): string;

  /**
   * Returns the echo template family name to look up in data/narratives/echoes/.
   * Must match one of the known template categories: person, place, concept,
   * foreign_word, date, number, object, context.
   */
  selectTemplateFamily(): string;
}

// ============================================================
// HELPER UTILITIES
// ============================================================

/** Returns true if the categoryL1 field matches any of the given domains. */
function isCategoryL1(fact: AdaptableFact, ...domains: string[]): boolean {
  const c = fact.categoryL1?.toLowerCase() ?? '';
  return domains.some(d => c === d || c.startsWith(d));
}

/** Returns true if the categoryL2 field matches any of the given sub-domains. */
function isCategoryL2(fact: AdaptableFact, ...subDomains: string[]): boolean {
  const c = fact.categoryL2?.toLowerCase() ?? '';
  return subDomains.some(d => c === d || c.startsWith(d));
}

/**
 * Extract the first capitalised proper noun from a string.
 * Used for pulling person/place/entity names from explanations and answers.
 * Returns null if nothing suitable is found.
 */
function extractFirstProperNoun(text: string): string | null {
  // Match 1-3 capitalised words (allows "Napoleon Bonaparte", "The Nile")
  const match = /\b([A-Z][a-z]{1,}(?:\s+[A-Z][a-z]{1,}){0,2})\b/.exec(text);
  return match?.[1] ?? null;
}

/**
 * Extract concept terms from an explanation using suffix heuristics.
 * Returns the first word that ends with a strong concept-suffix.
 */
const CONCEPT_SUFFIXES = ['sis', 'tion', 'sion', 'ism', 'ity', 'ology', 'cracy', 'acy', 'dom'];

function extractConceptTerm(text: string): string | null {
  const words = text.split(/\s+/);
  for (const w of words) {
    const cleaned = w.replace(/[^a-zA-Z]/g, '').toLowerCase();
    if (cleaned.length >= 6 && CONCEPT_SUFFIXES.some(s => cleaned.endsWith(s))) {
      return cleaned;
    }
  }
  return null;
}

// ============================================================
// BUILT-IN ADAPTERS
// ============================================================

/**
 * HistoryAdapter — extracts person/event/place entities from answers + explanations.
 * Works for history/biography/political-history decks.
 */
const HistoryAdapter: FactTypeAdapter = {
  name: 'HistoryAdapter',

  canEcho(fact: AdaptableFact): boolean {
    return isCategoryL1(fact, 'history', 'biography', 'politics');
  },

  extractEchoText(fact: AdaptableFact): string {
    // Prefer the correct answer itself if it reads as a proper noun
    if (/^[A-Z]/.test(fact.correctAnswer) && fact.correctAnswer.length >= 4) {
      return fact.correctAnswer;
    }
    // Fall back to first proper noun in explanation
    if (fact.explanation) {
      const noun = extractFirstProperNoun(fact.explanation);
      if (noun) return noun;
    }
    return fact.correctAnswer;
  },

  selectTemplateFamily(): string {
    return 'person'; // history answers are usually people, places, or events
  },
};

/**
 * ScienceAdapter — extracts concept/discovery terms from science decks.
 */
const ScienceAdapter: FactTypeAdapter = {
  name: 'ScienceAdapter',

  canEcho(fact: AdaptableFact): boolean {
    return isCategoryL1(fact, 'science', 'medicine', 'anatomy', 'physics', 'chemistry', 'biology');
  },

  extractEchoText(fact: AdaptableFact): string {
    // Prefer proper-noun answers (laws, theorems, named phenomena)
    if (/^[A-Z]/.test(fact.correctAnswer) && fact.correctAnswer.length >= 4) {
      return fact.correctAnswer;
    }
    // Try extracting a concept term from explanation
    const term = extractConceptTerm(fact.explanation ?? '');
    if (term) return term;
    return fact.correctAnswer;
  },

  selectTemplateFamily(): string {
    return 'concept';
  },
};

/**
 * GeographyAdapter — extracts place names from geography/travel decks.
 */
const GeographyAdapter: FactTypeAdapter = {
  name: 'GeographyAdapter',

  canEcho(fact: AdaptableFact): boolean {
    return (
      isCategoryL1(fact, 'geography', 'travel', 'countries') ||
      isCategoryL2(fact, 'capitals', 'countries', 'rivers', 'mountains', 'oceans')
    );
  },

  extractEchoText(fact: AdaptableFact): string {
    // Geography answers are almost always place names
    return fact.correctAnswer;
  },

  selectTemplateFamily(): string {
    return 'place';
  },
};

/**
 * MythologyAdapter — extracts deity/creature/artifact names.
 */
const MythologyAdapter: FactTypeAdapter = {
  name: 'MythologyAdapter',

  canEcho(fact: AdaptableFact): boolean {
    return isCategoryL1(fact, 'mythology', 'religion', 'folklore');
  },

  extractEchoText(fact: AdaptableFact): string {
    if (/^[A-Z]/.test(fact.correctAnswer) && fact.correctAnswer.length >= 3) {
      return fact.correctAnswer;
    }
    const noun = extractFirstProperNoun(fact.explanation ?? '');
    return noun ?? fact.correctAnswer;
  },

  selectTemplateFamily(): string {
    return 'person'; // mythological beings use person templates — evocative presences
  },
};

/**
 * MathAdapter — returns abstract concept references for math facts.
 * Math answers (numbers, formulas) make terrible echo text verbatim.
 * Instead we generate poetic references that evoke the mathematical idea.
 */

/** Evocative fragments for math narration — substituted instead of verbatim answers. */
const MATH_ECHO_FRAGMENTS = [
  'the shape of a problem yet unsolved',
  'the count of what cannot be counted',
  'a theorem pressed into silence',
  'the proof folded into the dark',
  'a number that bends back on itself',
  'the ratio that cannot be named',
  'the sum of all forgotten variables',
  'an equation dissolved into stone',
];

const MathAdapter: FactTypeAdapter = {
  name: 'MathAdapter',

  canEcho(fact: AdaptableFact): boolean {
    return isCategoryL1(fact, 'math', 'mathematics') || isCategoryL2(fact, 'algebra', 'geometry', 'calculus', 'statistics', 'number_theory');
  },

  extractEchoText(fact: AdaptableFact): string {
    // Use question to seed selection for determinism
    const seed = fact.quizQuestion.length % MATH_ECHO_FRAGMENTS.length;
    return MATH_ECHO_FRAGMENTS[seed];
  },

  selectTemplateFamily(): string {
    return 'concept'; // abstract concept templates suit math
  },
};

/**
 * VocabForeignAdapter — handles vocabulary deck facts with a partOfSpeech field.
 * Extracts the English translation and wraps it evocatively.
 */
const VocabForeignAdapter: FactTypeAdapter = {
  name: 'VocabForeignAdapter',

  canEcho(fact: AdaptableFact): boolean {
    // partOfSpeech being set is the canonical vocabulary deck signal
    return fact.partOfSpeech !== undefined;
  },

  extractEchoText(fact: AdaptableFact): string {
    // For vocab facts: try to extract the foreign word from the quiz question
    // Pattern: What does "abandonar" mean? → "abandonar"
    const match = /[Ww]hat does\s+"([^"]+)"\s*(?:\([^)]*\))?\s*mean\?/.exec(fact.quizQuestion);
    if (match) return match[1];
    // Fall back to targetLanguageWord if present
    if (fact.targetLanguageWord) return fact.targetLanguageWord;
    // Fall back to the English answer
    return fact.correctAnswer;
  },

  selectTemplateFamily(): string {
    return 'foreign_word';
  },
};

/**
 * GrammarForeignAdapter — handles grammar deck facts (no partOfSpeech, but
 * categoryL2 contains 'grammar' or question uses tilde/pattern syntax).
 * Generates a poetic description of the grammatical function.
 */
const GrammarForeignAdapter: FactTypeAdapter = {
  name: 'GrammarForeignAdapter',

  canEcho(fact: AdaptableFact): boolean {
    if (fact.partOfSpeech !== undefined) return false; // handled by VocabForeignAdapter
    return (
      isCategoryL2(fact, 'grammar') ||
      fact.quizQuestion.includes('~') ||
      fact.quizQuestion.includes('conjugat') ||
      fact.quizQuestion.includes('particle') ||
      fact.quizQuestion.includes('grammar')
    );
  },

  extractEchoText(fact: AdaptableFact): string {
    // Grammar facts: generate an evocative function description
    const q = fact.quizQuestion.toLowerCase();
    if (q.includes('negative') || q.includes('negat')) {
      return 'verbs that twist when touched by negation';
    }
    if (q.includes('past') || q.includes('tense')) {
      return 'the tense where things remain completed';
    }
    if (q.includes('conditional') || q.includes('if')) {
      return 'the conditional that folds possibility into grammar';
    }
    if (q.includes('particle')) {
      return 'the invisible particle that binds the sentence together';
    }
    if (q.includes('passive')) {
      return 'the passive voice — where the acted-upon becomes subject';
    }
    if (q.includes('plural')) {
      return 'the mark that multiplies meaning';
    }
    // Generic: quote the answer in an evocative frame
    return `the form "${fact.correctAnswer}" — a pattern in the grammar`;
  },

  selectTemplateFamily(): string {
    return 'concept'; // grammar constructs use concept templates
  },
};

/**
 * KanjiAdapter — handles kanji/hanzi facts from CJK language decks.
 * Extracts meaning/reading references for atmospheric narration.
 */
const KanjiAdapter: FactTypeAdapter = {
  name: 'KanjiAdapter',

  canEcho(fact: AdaptableFact): boolean {
    if (fact.partOfSpeech !== undefined) return false; // VocabForeignAdapter handles those
    return (
      isCategoryL2(fact, 'kanji', 'hanzi', 'hanja', 'characters') ||
      (fact.language === 'ja' && fact.pronunciation !== undefined)
    );
  },

  extractEchoText(fact: AdaptableFact): string {
    // For kanji: pair the character(s) with their English meaning when available
    // The correctAnswer is typically the English meaning; targetLanguageWord is the kanji
    if (fact.targetLanguageWord) {
      return `${fact.targetLanguageWord} — ${fact.correctAnswer}`;
    }
    // pronunciation + answer pairing
    if (fact.pronunciation) {
      return `${fact.pronunciation} — ${fact.correctAnswer}`;
    }
    return fact.correctAnswer;
  },

  selectTemplateFamily(): string {
    return 'foreign_word'; // CJK characters always use foreign_word templates
  },
};

/**
 * DefaultAdapter — fallback for any fact type not matched by more specific adapters.
 * Quotes a meaningful fragment of the explanation to establish narrative grounding.
 */
const DefaultAdapter: FactTypeAdapter = {
  name: 'DefaultAdapter',

  canEcho(_fact: AdaptableFact): boolean {
    return true; // always matches as final fallback
  },

  extractEchoText(fact: AdaptableFact): string {
    // Try the answer first if it's a reasonable length
    if (fact.correctAnswer.length >= 4 && fact.correctAnswer.length <= 50) {
      return fact.correctAnswer;
    }
    // Extract first sentence of explanation as fallback
    if (fact.explanation) {
      const firstSentence = fact.explanation.split(/[.!?]/)[0]?.trim();
      if (firstSentence && firstSentence.length >= 8 && firstSentence.length <= 80) {
        return firstSentence;
      }
    }
    // Last resort: truncate the answer
    return fact.correctAnswer.slice(0, 40);
  },

  selectTemplateFamily(): string {
    return 'context'; // use question-context templates for unknown types
  },
};

// ============================================================
// REGISTRY
// ============================================================

/**
 * Ordered adapter registry. First adapter where canEcho() returns true wins.
 * Order matters: more specific adapters must precede more general ones.
 */
const ADAPTER_REGISTRY: FactTypeAdapter[] = [
  VocabForeignAdapter,   // partOfSpeech present — most specific signal
  KanjiAdapter,          // kanji/CJK reading+meaning pairs
  GrammarForeignAdapter, // grammar patterns (~ syntax, particle, conjugation keywords)
  MathAdapter,           // categoryL1 = math / mathematics
  MythologyAdapter,      // mythology/religion/folklore
  HistoryAdapter,        // history/biography/politics
  GeographyAdapter,      // geography/travel/countries
  ScienceAdapter,        // science/medicine/anatomy
  DefaultAdapter,        // fallback — always matches
];

/**
 * Resolve the appropriate adapter for a given fact.
 * Always returns an adapter (DefaultAdapter is the guaranteed fallback).
 *
 * @param fact - Any fact with at minimum correctAnswer, quizQuestion, and optional category fields.
 */
export function resolveAdapter(fact: AdaptableFact): FactTypeAdapter {
  for (const adapter of ADAPTER_REGISTRY) {
    if (adapter.canEcho(fact)) {
      return adapter;
    }
  }
  // TypeScript exhaustiveness guard — DefaultAdapter always matches,
  // so this line is unreachable at runtime.
  return DefaultAdapter;
}

/**
 * Build the echo text for a fact using the appropriate adapter.
 *
 * This is the primary integration point replacing the old buildEchoText() function
 * for cross-deck narration. The old buildEchoText() only handled vocab vs. knowledge;
 * this function handles all deck types via the adapter registry.
 *
 * Returns a short evocative string ready for use in {echoText} template slots.
 */
export function buildAdaptedEchoText(fact: AdaptableFact): string {
  const adapter = resolveAdapter(fact);
  return adapter.extractEchoText(fact);
}

/**
 * Get the echo template family for a fact.
 * Used by the narrative engine to select which echo template pool to draw from.
 */
export function getTemplateFamilyForFact(fact: AdaptableFact): string {
  const adapter = resolveAdapter(fact);
  return adapter.selectTemplateFamily();
}
