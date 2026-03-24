# AR-248: Deck-Specific Question Templates

**Status:** Pending
**Complexity:** Medium (template system, selection logic, vocabulary template mapping)
**Dependencies:** AR-245 (CuratedDeck types with QuestionTemplate), AR-246 (charge-time fact selection)
**Spec Reference:** `docs/RESEARCH/DECKBUILDER.md` section 5

---

## 1. Overview

Each curated deck defines its own question templates rather than using the global variant system. Templates control how questions are phrased and which answer pool provides the answer. Template selection at charge time considers card mastery, variety, and available pools.

**Study mode only.** Trivia mode continues using the existing question system unchanged.

---

## 2. Sub-Steps

### 2.1 Create Template Selection Service

**File:** `src/services/questionTemplateSelector.ts` (NEW)

```typescript
import type { QuestionTemplate, DeckFact, CuratedDeck } from '../data/curatedDeckTypes';

export interface TemplateSelectionResult {
  template: QuestionTemplate;
  renderedQuestion: string;      // Template with placeholders filled
  answerPoolId: string;          // Pool the answer comes from
}

/**
 * Select and render a question template for a charge-time fact.
 *
 * Selection algorithm (§5.3):
 * 1. Filter to templates available at current card mastery level
 * 2. Filter to templates whose answer pool contains the selected fact
 * 3. Weight by: difficulty appropriate to mastery, variety (no consecutive repeat),
 *    in-run template history
 * 4. Select weighted random (seeded)
 * 5. Render the template with fact data
 */
export function selectQuestionTemplate(
  fact: DeckFact,
  deck: CuratedDeck,
  cardMasteryLevel: number,
  recentTemplateIds: string[],   // Last 3 template IDs used (for variety)
  runSeed: number
): TemplateSelectionResult;

/**
 * Render a template string by replacing {placeholders} with fact data.
 * Supports: {name}, {ordinal}, {year}, {japanese_word}, {english}, {kanji_word},
 * {event_description}, {definition}, and any custom placeholder matching DeckFact fields.
 */
export function renderTemplate(
  template: QuestionTemplate,
  fact: DeckFact,
  deck: CuratedDeck
): string;
```

**Template weighting:**

| Factor | Weight Modifier |
|--------|----------------|
| Difficulty matches mastery band (±1) | +3.0 |
| Not in recentTemplateIds | +2.0 |
| In recentTemplateIds | * 0.2 |
| Reverse-capable and mastery >= 2 | +1.5 |
| Base | 1.0 |

**Acceptance:**
- Templates filter by mastery correctly
- Variety weighting prevents consecutive same-template
- Placeholder rendering works for all supported fields

### 2.2 Define Standard Vocabulary Templates

**File:** `src/data/vocabularyTemplates.ts` (NEW)

Default templates for all vocabulary decks, per DECKBUILDER.md §5.2:

```typescript
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
    answerPoolId: 'reading_hiragana',  // or reading_pinyin for Chinese
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
    questionFormat: "{explanation}",
    availableFromMastery: 3,
    difficulty: 4,
    reverseCapable: false,
  },
];
```

The `reading` template only applies when the deck has a `reading_hiragana` or `reading_pinyin` answer pool. The selector should skip it for languages without separate reading systems (Spanish, French, German, etc.).

**Acceptance:** Templates export correctly. Applicable to all language decks.

### 2.3 Wire Template Selection into Charge Flow

**File:** `src/services/turnManager.ts` (MODIFY — extends AR-246 changes)

After `selectFactForCharge()` returns a fact (AR-246), call `selectQuestionTemplate()` to get the question format. Pass the rendered question and answer pool ID to the quiz overlay.

**Current quiz overlay receives:**
- `fact: Fact` with `quizQuestion` and `correctAnswer`
- `choices: string[]` (correct + distractors)

**New for study mode:**
- `renderedQuestion: string` (from template rendering, replaces `fact.quizQuestion`)
- `correctAnswer: string` (may be from a different pool than the fact's primary answer — e.g., a "number_from_name" template uses ordinal_numbers pool)
- `choices: string[]` (from pool-based distractor selection, AR-247)

The quiz overlay UI is unchanged — it just displays question + choices regardless of source.

**Acceptance:**
- Study mode charges use deck-specific templates
- Template selection respects mastery level
- Rendered questions are grammatically correct
- Trivia mode quiz questions unchanged

### 2.4 Track Recent Templates for Variety

**File:** `src/services/inRunFactTracker.ts` (MODIFY — extends AR-246)

Add a `recentTemplateIds: string[]` ring buffer (last 3) to the InRunFactTracker. Updated after each charge.

**Acceptance:** Template variety tracking prevents consecutive same-template questions.

---

## 3. Files Affected

| File | Action | Purpose |
|------|--------|---------|
| `src/services/questionTemplateSelector.ts` | CREATE | Template selection + rendering |
| `src/data/vocabularyTemplates.ts` | CREATE | Standard vocabulary deck templates |
| `src/services/turnManager.ts` | MODIFY | Use template selection in study mode charge flow |
| `src/services/inRunFactTracker.ts` | MODIFY | Add recentTemplateIds tracking |

---

## 4. Acceptance Criteria

1. `npm run typecheck` passes
2. `npm run build` succeeds
3. `npx vitest run` — all tests pass
4. Study mode questions use deck-specific templates
5. Vocabulary templates (forward, reverse, reading, synonym_pick, definition_match) all work
6. Template selection respects mastery gating
7. Variety weighting prevents repetitive question formats
8. Knowledge deck custom templates render correctly with {placeholders}
9. Trivia mode questions completely unchanged

---

## 5. Verification Gate

- [ ] `npm run typecheck` — passes
- [ ] `npm run build` — succeeds
- [ ] `npx vitest run` — all tests pass
- [ ] Unit tests for `selectQuestionTemplate()` with mastery filtering and variety
- [ ] Unit tests for `renderTemplate()` with various placeholder patterns
- [ ] Manual: Trivia run questions unchanged
- [ ] Update `docs/GAME_DESIGN.md` — document deck-specific templates, vocabulary template mapping
- [ ] Update `docs/ARCHITECTURE.md` — new services
- [ ] Update `data/inspection-registry.json` — add questionTemplateSelector system
