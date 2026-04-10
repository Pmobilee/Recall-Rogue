import type { QuestionTemplate, DeckFact, CuratedDeck } from '../data/curatedDeckTypes';

export interface TemplateSelectionResult {
  template: QuestionTemplate;
  renderedQuestion: string;
  answerPoolId: string;
  /** The correct answer for this specific template (may differ from fact.correctAnswer for reverse templates) */
  correctAnswer: string;
  /**
   * The field on DeckFact whose value should be used as the distractor answer text.
   * Defaults to 'correctAnswer' for forward templates.
   *
   * For reverse templates ("How do you say X in [language]?"), distractors must come
   * from the target-language field ('targetLanguageWord'), not from 'correctAnswer'
   * (which holds the English meaning). Without this, all distractors are English words
   * while the correct answer is a target-language string — trivially eliminable by script alone.
   *
   * For reading templates ("What is the reading of X?"), distractors come from 'reading'.
   *
   * See docs/mechanics/quiz.md §"Reverse templates and target-language distractor pools".
   */
  distractorAnswerField: keyof DeckFact;
}

/**
 * Seeded random using xorshift32.
 */
function seededRandom(seed: number): () => number {
  let state = seed | 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

/**
 * Escape a string so it can be used safely inside a RegExp pattern.
 * Only the characters that have special meaning in RegExp are escaped.
 */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normalize a string for leak-detection comparison: lowercase and strip
 * leading/trailing punctuation so "abbey." and "abbey" both match "abbey".
 */
function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/[.,;:!?'"()\-–—]+$/, '').replace(/^[.,;:!?'"()\-–—]+/, '');
}

/**
 * Returns true when the fact's explanation contains the correct answer as a
 * whole word (case-insensitive, word-boundary match).
 *
 * This is used to gate explanation-based templates such as `definition_match`,
 * whose questionFormat is literally `{explanation}`. When a Wiktionary-style
 * explanation reads "pique-niquer — to picnic.", the correct answer "to picnic"
 * is present verbatim, making the question trivially self-answering.
 *
 * Matching strategy:
 * - Word-boundary (`\b`) anchors are applied around the normalized answer so
 *   that short answers like "in" do not spuriously match "indicating",
 *   "winter", etc. This is intentional — we prefer false negatives (showing
 *   a slightly self-answering question) over false positives (suppressing a
 *   perfectly valid question).
 * - Multi-word answers (e.g. "to picnic", "a building") are treated as a
 *   single token: the leading \b anchors at the start of the first word and
 *   the trailing \b anchors at the end of the last word. Interior spaces are
 *   matched literally, which is correct for prose explanations.
 * - The regex is compiled once per call (O(1)) and tested once against the
 *   explanation string (O(L) where L = explanation length).
 *
 * See docs/mechanics/quiz.md §"Explanation-based templates and answer leakage".
 */
export function explanationLeaksAnswer(fact: DeckFact): boolean {
  if (!fact.explanation || fact.explanation.trim() === '') return false;
  const answer = normalize(fact.correctAnswer);
  if (answer === '') return false;

  const pattern = new RegExp(`\\b${escapeRegExp(answer)}\\b`, 'i');
  return pattern.test(fact.explanation);
}

/**
 * The set of template IDs whose question asks for the *reading* of the target
 * word (e.g. "What is the reading of 'X'?").
 *
 * These templates are ineligible for facts where the target word is already
 * in its phonetic/reading form — i.e. when fact.reading === fact.targetLanguageWord
 * after normalisation. Applying a reading template in that case produces a
 * self-answering question: "What is the reading of 'スーパー'?" with answer "スーパー".
 *
 * Any template whose id matches /^reading(_|$)/ (starts with "reading" followed
 * by underscore or end-of-string) belongs to this family. Current members:
 *   reading, reading_pinyin, reading_hiragana
 *
 * See docs/mechanics/quiz.md §"Reading templates and phonetic-form facts".
 */
const READING_TEMPLATE_PATTERN = /^reading(_|$)/;

/**
 * Returns true when the fact's target word is already in its phonetic/reading
 * form — i.e. the reading template would produce a self-answering question.
 *
 * Returns false (never blocks) if either field is absent, so facts without an
 * explicit reading or targetLanguageWord are not affected.
 *
 * Examples:
 *   { targetLanguageWord: 'スーパー', reading: 'スーパー' } → true  (BLOCK)
 *   { targetLanguageWord: '記録',    reading: 'きろく' }   → false (allow)
 *   { targetLanguageWord: '記録',    reading: undefined }  → false (allow)
 *
 * See docs/mechanics/quiz.md §"Reading templates and phonetic-form facts".
 */
export function readingMatchesTargetWord(fact: DeckFact): boolean {
  if (!fact.reading || !fact.targetLanguageWord) return false;
  return normalize(fact.reading) === normalize(fact.targetLanguageWord);
}

/**
 * Select and render a question template for a charge-time fact.
 *
 * Selection algorithm (§5.3):
 * 1. Filter templates available at current card mastery level
 * 2. Filter templates whose answer pool contains the selected fact
 * 3. Filter out explanation-based templates when the explanation leaks the answer
 * 4. Filter out reading templates when the target word is already in phonetic form
 * 5. Weight by: difficulty appropriate to mastery, variety (no consecutive repeat), in-run template history
 * 6. Select weighted random (seeded)
 * 7. Render the template with fact data
 */
export function selectQuestionTemplate(
  fact: DeckFact,
  deck: CuratedDeck,
  cardMasteryLevel: number,
  recentTemplateIds: string[],
  runSeed: number,
): TemplateSelectionResult {
  const templates = deck.questionTemplates;

  // Step 1: Filter by mastery level
  const masteryFiltered = templates.filter(t => t.availableFromMastery <= cardMasteryLevel);

  // Step 2: Filter by answer pool containing this fact
  const poolFiltered = masteryFiltered.filter(t => {
    const pool = deck.answerTypePools.find(p => p.id === t.answerPoolId);
    return pool && pool.factIds.includes(fact.id);
  });

  // Step 3: Filter out explanation-based templates when the explanation leaks the answer.
  //
  // A template is "explanation-based" when its questionFormat contains the
  // {explanation} placeholder — meaning the rendered question IS the explanation text.
  // If the explanation already contains the correct answer (Wiktionary format:
  // "word — English meaning"), the quiz is trivially self-answering.
  //
  // This check is O(L) per template that uses {explanation}, which in practice
  // means at most one check per fact (the definition_match template).
  //
  // See docs/mechanics/quiz.md §"Explanation-based templates and answer leakage".
  const leaks = explanationLeaksAnswer(fact);

  // Step 4: Detect phonetic-form facts for reading template eligibility.
  //
  // Katakana loanwords and hiragana-only words have identical targetLanguageWord
  // and reading fields (e.g. スーパー / スーパー, レコード / レコード). Applying a
  // reading template to such facts produces "What is the reading of 'スーパー'?"
  // with correct answer "スーパー" — the question contains its own answer.
  //
  // readingMatchesTargetWord() is O(1) (two string normalisations + comparison).
  // It returns false when either field is absent, so non-vocabulary facts are unaffected.
  //
  // See docs/mechanics/quiz.md §"Reading templates and phonetic-form facts".
  const wordIsPhonetic = readingMatchesTargetWord(fact);

  const eligibleTemplates = poolFiltered.filter(t => {
    // Explanation-based template + leaking explanation → ineligible
    if (t.questionFormat.includes('{explanation}') && leaks) {
      return false;
    }
    // Reading template + already-phonetic target word → ineligible
    if (READING_TEMPLATE_PATTERN.test(t.id) && wordIsPhonetic) {
      return false;
    }
    return true;
  });

  // If no templates remain after eligibility filtering, fall back to using the fact's quizQuestion directly
  if (eligibleTemplates.length === 0) {
    return {
      template: {
        id: '_fallback',
        answerPoolId: fact.answerTypePoolId,
        questionFormat: fact.quizQuestion,
        availableFromMastery: 0,
        difficulty: fact.difficulty,
        reverseCapable: false,
      },
      renderedQuestion: fact.quizQuestion,
      answerPoolId: fact.answerTypePoolId,
      correctAnswer: fact.correctAnswer,
      distractorAnswerField: 'correctAnswer',
    };
  }

  // Step 5: Weight candidates
  const rand = seededRandom(runSeed);
  const recentSet = new Set(recentTemplateIds);

  const weighted = eligibleTemplates.map(template => {
    let weight = 1.0;

    // Difficulty matches mastery band (±1)
    const diffDelta = Math.abs(template.difficulty - Math.min(cardMasteryLevel + 1, 5));
    if (diffDelta <= 1) weight += 3.0;

    // Variety: penalize recently used templates
    if (recentSet.has(template.id)) {
      weight *= 0.2;
    } else {
      weight += 2.0;
    }

    // Reverse-capable bonus at higher mastery
    if (template.reverseCapable && cardMasteryLevel >= 2) {
      weight += 1.5;
    }

    return { template, weight };
  });

  // Weighted random selection
  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
  let roll = rand() * totalWeight;
  let selected = weighted[0].template;
  for (const w of weighted) {
    roll -= w.weight;
    if (roll <= 0) {
      selected = w.template;
      break;
    }
  }

  // Step 7: Render the template
  const rendered = renderTemplate(selected, fact, deck);

  // Determine the correct answer based on the template's answer pool
  const correctAnswer = getCorrectAnswerForTemplate(selected, fact);

  // Determine which field on DeckFact holds the distractor answer text for this template.
  // This ensures pool-based distractor selection uses the right field when the template
  // changes the axis of questioning (e.g. reverse: English→Korean means distractors
  // must be Korean words from targetLanguageWord, not English from correctAnswer).
  const distractorAnswerField = getDistractorAnswerFieldForTemplate(selected);

  return {
    template: selected,
    renderedQuestion: rendered,
    answerPoolId: selected.answerPoolId,
    correctAnswer,
    distractorAnswerField,
  };
}

/**
 * Render a template string by replacing {placeholders} with fact data.
 *
 * Supports standard placeholders:
 * - {targetLanguageWord} — fact.targetLanguageWord
 * - {correctAnswer} — fact.correctAnswer (the English meaning for vocab)
 * - {language} — fact.language mapped to display name
 * - {explanation} — fact.explanation
 * - {quizQuestion} — fact.quizQuestion
 * - {reading} — fact.reading
 * - Any other {key} — looked up from fact as (fact as any)[key]
 *
 * Falls back to fact.quizQuestion if any placeholder resolves to an
 * empty or whitespace-only string. This prevents nonsensical questions
 * like "Who created the  programming language?" when a non-language fact
 * (missing targetLanguageWord/language/reading) matches a language-specific
 * template via a shared answer pool.
 */
export function renderTemplate(
  template: QuestionTemplate,
  fact: DeckFact,
  _deck: CuratedDeck,
): string {
  let result = template.questionFormat;

  const LANGUAGE_NAMES: Record<string, string> = {
    ja: 'Japanese',
    ko: 'Korean',
    zh: 'Chinese',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    nl: 'Dutch',
    cs: 'Czech',
    it: 'Italian',
    pt: 'Portuguese',
    ru: 'Russian',
    ar: 'Arabic',
  };

  const replacements: Record<string, string> = {
    targetLanguageWord: fact.targetLanguageWord ?? '',
    correctAnswer: fact.correctAnswer,
    language: fact.language ? (LANGUAGE_NAMES[fact.language] ?? fact.language) : '',
    explanation: fact.explanation,
    quizQuestion: fact.quizQuestion,
    reading: fact.reading ?? '',
  };

  // Track whether any placeholder resolved to empty/whitespace. If so the
  // rendered question would be nonsensical (e.g. a language-specific template
  // applied to a non-language fact that shares an answer pool), so we fall
  // back to fact.quizQuestion the same way unresolved placeholders do.
  let hasEmptyReplacement = false;

  // Replace all {placeholder} patterns
  result = result.replace(/\{(\w+)\}/g, (match, key) => {
    if (key in replacements) {
      const value = replacements[key];
      if (value.trim() === '') {
        hasEmptyReplacement = true;
      }
      return value;
    }
    // Try looking up on the fact object directly
    // Dynamic key lookup on fact — safe since we only use string values
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const val = (fact as any)[key];
    if (typeof val === 'string') {
      if (val.trim() === '') {
        hasEmptyReplacement = true;
      }
      return val;
    }
    return match;
  });

  // If any placeholder was unresolved or resolved to empty/whitespace,
  // fall back to the fact's own question to avoid nonsensical output.
  if (/\{\w+\}/.test(result) || hasEmptyReplacement) {
    return fact.quizQuestion;
  }

  return result;
}

/**
 * Determine the correct answer for a given template.
 * For most templates, it's fact.correctAnswer.
 * For reverse templates, it's the target language word.
 * For reading templates, it's the reading.
 */
function getCorrectAnswerForTemplate(template: QuestionTemplate, fact: DeckFact): string {
  // Reverse template: answer is the target language word
  if (template.id === 'reverse' && fact.targetLanguageWord) {
    return fact.targetLanguageWord;
  }
  // Reading template: answer is the reading
  if (template.id === 'reading' && fact.reading) {
    return fact.reading;
  }
  // Default: the fact's correctAnswer
  return fact.correctAnswer;
}

/**
 * Determine which field on DeckFact holds the correct distractor answer text
 * for a given template.
 *
 * This mirrors the logic in getCorrectAnswerForTemplate: whichever field is
 * the "correct answer" is also the field whose pool-mates should serve as
 * distractors. Mismatching these fields is the root cause of POOL-CONTAM in
 * reverse templates — the correct answer is Korean (targetLanguageWord) but
 * distractors come from correctAnswer (English), making the correct answer
 * identifiable by script alone.
 *
 * Template IDs and their distractor fields:
 * - 'reverse'         → 'targetLanguageWord' (target-language word pool)
 * - 'reading_pinyin'  → 'reading'             (romanisation / pinyin pool)
 * - 'reading'         → 'reading'             (romanisation pool)
 * - all others        → 'correctAnswer'        (standard answer field)
 */
function getDistractorAnswerFieldForTemplate(template: QuestionTemplate): keyof DeckFact {
  if (template.id === 'reverse') return 'targetLanguageWord';
  if (template.id === 'reading_pinyin') return 'reading';
  if (template.id === 'reading') return 'reading';
  return 'correctAnswer';
}
