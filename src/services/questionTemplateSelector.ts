import type { QuestionTemplate, DeckFact, CuratedDeck } from '../data/curatedDeckTypes';

export interface TemplateSelectionResult {
  template: QuestionTemplate;
  renderedQuestion: string;
  answerPoolId: string;
  /** The correct answer for this specific template (may differ from fact.correctAnswer for reverse templates) */
  correctAnswer: string;
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
 * Select and render a question template for a charge-time fact.
 *
 * Selection algorithm (§5.3):
 * 1. Filter templates available at current card mastery level
 * 2. Filter templates whose answer pool contains the selected fact
 * 3. Weight by: difficulty appropriate to mastery, variety (no consecutive repeat), in-run template history
 * 4. Select weighted random (seeded)
 * 5. Render the template with fact data
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

  // If no templates match, fall back to using the fact's quizQuestion directly
  if (poolFiltered.length === 0) {
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
    };
  }

  // Step 3: Weight candidates
  const rand = seededRandom(runSeed);
  const recentSet = new Set(recentTemplateIds);

  const weighted = poolFiltered.map(template => {
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

  // Step 5: Render the template
  const rendered = renderTemplate(selected, fact, deck);

  // Determine the correct answer based on the template's answer pool
  const correctAnswer = getCorrectAnswerForTemplate(selected, fact);

  return {
    template: selected,
    renderedQuestion: rendered,
    answerPoolId: selected.answerPoolId,
    correctAnswer,
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
