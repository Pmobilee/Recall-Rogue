# Quiz Engine Mechanics

> **Purpose:** Documents how quiz questions are selected, formatted, graded, and how the FSRS spaced repetition algorithm schedules fact reviews.
> **Last verified:** 2026-04-07
> **Source files:** `src/services/quizService.ts`, `src/services/fsrsScheduler.ts`, `src/services/questionFormatter.ts`, `src/services/questionTemplateSelector.ts`, `src/services/curatedFactSelector.ts`, `src/services/accuracyGradeSystem.ts`, `src/services/curatedDistractorSelector.ts`, `src/services/typedAnswerChecker.ts`, `src/services/synonymService.ts`

---

## Quiz Question Lifecycle

```
selectFact → selectTemplate → buildDistractors → present → gradeAnswer → reviewFact (FSRS)
```

### 1. Fact Selection

Two parallel selection paths depending on run mode:

**Legacy trivia mode** (`quizService.ts: selectQuestion`):
- Only facts in `cardState === 'review'` are eligible (new/learning stay in StudySession)
- Selects the earliest-due review card (`nextReviewAt` ascending)
- `selectReviewAheadQuestion` picks the next-soonest not-yet-due card for review-ahead quizzing
- `selectDifficultyWeightedQuestion` uses depth-based weighting: `depthExponent = 0.3 + depthRatio * 2.7` — shallow floors prefer easy facts (high easeFactor), deep floors prefer hard facts (low easeFactor)

**Curated deck mode** (`curatedFactSelector.ts: selectFactForCharge`):
Anki-faithful four-priority system:
0. **Forced new card introduction** — every `NEW_CARD_INTERVAL = 3` charges without a new card being served, a new card is force-introduced if one is available and the learning queue permits it (`canIntroduceNew()`). Prevents learning/review cards from starving new card introduction. Calls `tracker.recordNewCardServed()` to reset the counter (`selectionReason: 'unseen'`).
1. **Due learning cards** — time-critical, always served first unless Priority 0 fires (`selectionReason: 'struggling'`)
2. **Main queue** — Anki Intersperser: proportional mixing of due graduated reviews + new cards. New cards sorted by `difficulty` ascending (easier first). New cards only introduced when `canIntroduceNew()` returns true (`MAX_LEARNING = 8`). Calls `recordNewCardServed()` when a new card is served.
3. **Ahead learning** — cards in learning but not yet due, only when nothing else available
4. **Fallback** — any card except the immediately previous fact (avoids consecutive repeats)

**Dedup rule:** The ONLY dedup is `lastFactId` — prevents back-to-back repetition of the same fact. Learning cards CAN and SHOULD come back within the same encounter — that is correct Anki behavior. The longer step delays ([4, 10] charges) provide natural in-encounter spacing.

**Multi-question batch dedup** (`nonCombatQuizSelector.ts`):
`selectNonCombatStudyQuestion` accepts an optional `excludeFactIds: ReadonlySet<string>` parameter.
When provided, the fact pool is filtered to exclude those IDs before calling `selectFactForCharge`.
This prevents duplicate questions in batches like rest-site study sessions (3 questions).
The caller (`generateStudyQuestions` in `gameFlowController.ts`) accumulates `excludeFactIds` across
iterations and passes it on each call. If filtering would leave zero candidates (tiny deck), the full
pool is used as a fallback so the function never returns `null` due to exhaustion.

**Custom deck mode non-combat questions** (`nonCombatQuizSelector.ts: selectNonCombatCustomDeckQuestion`):
Custom deck runs (multiple curated decks) use a separate selector that merges facts from all custom deck items.
`factSourceDeckMap` (from `RunState.factSourceDeckMap`) resolves the correct source deck per-fact for
template and distractor selection. Called from `generateStudyQuestions` (rest sites) and
`generateQuizPhaseQuestions` (boss quiz phase) when `deckMode.type === 'custom_deck'`.
Distractors are drawn from the source deck's own answer type pools to preserve pool coherence.

**Custom deck fact pool interleaving** (`src/utils/interleaveFacts.ts`):
Facts from custom deck items are merged via round-robin interleaving — NOT sequential concatenation.
`interleaveFacts([[a1,a2,a3],[b1,b2],[c1]])` → `[a1,b1,c1,a2,b2,a3]`.
This applies in two places:
- `runManager.ts` (`createRunState`, custom deck branch) — seeds the `InRunFactTracker` with interleaved IDs
- `nonCombatQuizSelector.ts` (`selectNonCombatCustomDeckQuestion`) — builds the `factPool` passed to `selectFactForCharge`

Without interleaving, the largest deck's facts appear first in every FIFO queue, monopolizing early
encounters because the Anki selector introduces new cards in pool order.

**Selector tiebreaker bias fix** (`curatedFactSelector.ts`):
The two `rand() - 0.5` tiebreakers used when sorting new cards by difficulty (Priority 0 and Priority 2)
were replaced with Fisher-Yates shuffle + stable sort. The old pattern slightly biased toward earlier
elements (expected value is positive for small indices), compounding the FIFO problem. The new pattern:
1. Fisher-Yates shuffles the candidate list uniformly at random (using the seeded `rand()`)
2. `Array.sort` by `difficulty` then preserves shuffle order within the same difficulty tier (stable)

### 2. Template Selection (`questionTemplateSelector.ts`)

`selectQuestionTemplate` selects from `deck.questionTemplates` using a seeded xorshift32 RNG:

1. Filter by `template.availableFromMastery <= cardMasteryLevel`
2. Filter to templates whose `answerPoolId` contains the fact
3. Weight: difficulty match ±1 vs mastery band (+3.0), variety penalty for recently used (×0.2), fresh bonus (+2.0), reverse-capable at mastery ≥ 2 (+1.5)
4. Weighted random pick; falls back to `fact.quizQuestion` if no templates match

Template placeholders in `questionFormat` are replaced via `renderTemplate`: `{targetLanguageWord}`, `{correctAnswer}`, `{language}`, `{reading}`, `{explanation}`, `{quizQuestion}`, and any other fact field key.

`renderTemplate` falls back to `fact.quizQuestion` in two cases:
- Any `{placeholder}` pattern remains unresolved after substitution (key not found on fact)
- Any placeholder resolves to an empty or whitespace-only string (e.g. a non-language fact with no `targetLanguageWord` or `language` field matched a language-specific template via a shared answer pool — this would otherwise produce nonsensical questions like "Who created the  programming language?")

Special template IDs: `reverse` (answer = `targetLanguageWord`), `reading` (answer = `fact.reading`), default (answer = `fact.correctAnswer`).

**Note:** Different question templates can reference different `answerPoolId` values for the same fact. A vocabulary fact might use the `english_meanings` pool for forward questions and the `target_language_words` pool for reverse questions. The pool used is always determined by the selected template, not the fact itself.

### 3. Question Formatting (`questionFormatter.ts`)

`getQuestionPresentation` controls how a question is rendered based on card tier:

| Card Tier | Options | Allow Reverse | Allow Fill-Blank | Close Distractors |
|-----------|---------|---------------|------------------|-------------------|
| `'1'`     | 3       | No            | No               | No                |
| `'2a'`    | 4       | Yes (30%)     | No               | No                |
| `'2b'`    | 5       | Yes (30%)     | Yes (20%)        | Yes               |
| `'3'`     | 0 (typing mode) | No   | No               | No                |

Mastery Trial overrides (`MASTERY_TRIAL` constant): 5 options, close distractors, 4-second timer, slow reader disabled, requires `REQUIRED_STABILITY = 30` and `REQUIRED_CONSECUTIVE_CORRECT = 7`.

### 4. Distractor Selection (`curatedDistractorSelector.ts`)

`getDistractorCount` returns 2 distractors at mastery 0, 3 at mastery 1–2, 4 at mastery 3–5. Meditation Chamber bonus reduces count by 1 (minimum 2) for the meditated chainThemeId.

`selectDistractors` priority order:
1. Synonym group exclusion (mandatory — synonyms never appear as distractors)
2. Pool size check: if fewer than 5 unique answers available (real + synthetic combined), use pre-generated `fact.distractors[]`
3. Scoring from `answerPool.factIds`: known confusions (+10.0×count), reverse confusions (+5.0×count), in-run struggles (+3.0), same part-of-speech (+4.0 or ×0.3 penalty), **same measurement unit (+5.0 or ×0.1 penalty — see below)**, similar difficulty ±1 (+2.0)
4. Synthetic pool members scored at base 0.5 (lower than real pool members at 1.0 — real facts always preferred); unit matching also applied to synthetics
5. Jitter (0–0.5) seeded from `totalCharges × fact ID hash` for per-encounter variety
6. Deduplication: skips distractor answers that appear by name in the question text
7. Fallback to `fact.distractors[]` if pool yields insufficient candidates

`inRunTracker` parameter accepts `InRunFactTracker | null`. When `null` (trivia mode bridge path), in-run struggle scoring is skipped and jitter seed uses `totalCharges = 0`.

#### Unit Matching (`extractUnit` helper)

`extractUnit(answer)` parses an answer string and returns the measurement unit suffix, or `null` if the answer is not a measurement. Examples: `"10 metres"` → `"metres"`, `"52,800 tonnes"` → `"tonnes"`, `"120 years"` → `"years"`, `"Great Wall"` → `null`.

When the correct answer has a detectable unit, the scoring step applies:
- **+5.0** for candidates whose unit matches exactly (e.g., metres with metres)
- **×0.1** penalty for candidates with a different unit (e.g., tonnes when correct is metres)

This prevents cross-unit contamination in broad measurement pools (such as `measurement_number` in world-wonders decks) that mix heights, weights, durations, and counts in the same pool. When fewer same-unit candidates exist than the requested distractor count, the penalty is overridden and mixed-unit candidates fill remaining slots rather than leaving the response underfilled.

The unit penalty is a scoring heuristic, not a hard filter — confusion matrix data (+10.0×count) still overrides the penalty when a player genuinely confuses two measurements of different units.

#### Synthetic Distractor Members (`AnswerTypePool.syntheticDistractors`)

`AnswerTypePool` supports an optional `syntheticDistractors?: string[]` field. These are answer strings that belong semantically to the pool but aren't the `correctAnswer` of any real fact — they pad small pools so pool-based selection is used instead of falling back to per-fact pre-generated distractors.

Key rules for synthetic members:
- They count toward the pool's viability threshold (5 unique answers minimum)
- They are injected into the internal `factById` lookup as pseudo-`DeckFact` objects with `id: '_synthetic_{answer}'`
- They are scored at base 0.5 (real pool members start at 1.0), so they are selected only after all eligible real pool members
- Unit matching is applied to synthetic members — a synthetic `"100 tonnes"` is penalised when the correct answer is `"10 metres"`
- A synthetic answer equal to `correctFact.correctAnswer` is always excluded (case-insensitive)
- They appear as distractors only — never as quiz questions (`quizQuestion: ''`)
- Content authors set this field in the deck JSON; it is never auto-generated at runtime

#### Pool Sizing Guidelines

| Pool Size (real + synthetic) | Behavior | Quality |
|------------------------------|----------|---------|
| < 5 | Pool-based selection skipped entirely — falls back to `fact.distractors[]` | No pool variety |
| 5–14 | Pool-based selection active, but limited variety | Players may memorize which answers appear together after several encounters |
| 15+ | Good distractor variety; confusion matrix rotates effectively | Recommended minimum |

**Runtime minimum: 5 unique members** (real + synthetic combined). Below this threshold, the system falls back to the per-fact `distractors[]` array entirely.

**Recommended minimum: 15+.** Pools of 5–14 are technically functional but risk repetitive patterns — players can begin memorizing which 4 answers appear with which question after enough encounters. The confusion matrix partially mitigates this by preferring the player's personal confusion pairs, but variety is still limited when total candidates are few.

**Padding with synthetics:** For pools with 5–14 real facts, add `syntheticDistractors` to reach at least 15 total members. At exactly 5 real members a player will always see 4 of the same 5 answers — synthetics break that predictability. Synthetics score lower than real facts (0.5 vs 1.0) so real members are always drawn first; synthetics appear only when real options are exhausted or when they are the strongest-scoring available candidates.

**Numeric pools are exempt:** Bracket-notation facts (`{8848}`, `{1789}`) generate distractors at runtime via `getNumericalDistractors` — pool sizing rules do not apply to them.

**Trivia mode distractor path** (`quizService.ts: getQuizChoices`):

`getQuizChoices` checks for a `bridge:{deckId}` tag on the fact first. If present, `getBridgedDistractors` attempts pool-based selection via `selectDistractors` using the source curated deck's answer type pools and the global confusion matrix (neutral mastery level 1, no `InRunFactTracker`). Falls back to pre-generated distractors if the deck isn't loaded, the fact ID isn't found in the deck, or the pool has fewer than 5 facts.

For non-bridged facts: uses `fact.distractors` directly; falls back to `getVocabDistractors` for vocab type and `getNumericalDistractors` for brace-marked answers. Slices to `BALANCE.QUIZ_DISTRACTORS_SHOWN = 3` wrong answers (4 total choices).

### 5. Grading

`gradeAnswer(fact, answer)` — exact string match against `displayAnswer(fact.correctAnswer)`. Binary: correct or incorrect. No partial credit. `acceptableAlternatives` are handled upstream before calling `gradeAnswer`.

### Typed Answer Grading (`typedAnswerChecker.ts`)

Used by both tier-3 card formatting (where options count = 0 forces typing) and the always-write typing mode (all language decks). `checkTypedAnswer` replaces `gradeAnswer` for lenient matching whenever a text input is presented.

**`TypedAnswerResult` interface:**

```typescript
interface TypedAnswerResult {
  correct: boolean;       // true = accepted for scoring
  closeMatch: boolean;    // true = within Levenshtein threshold but not accepted
  matchedSynonym: boolean; // true = accepted via synonym lookup
}
```

**Exported API:**
- `checkTypedAnswer(typed, correctAnswer, acceptableAlternatives, language): TypedAnswerResult` — returns a result object indicating whether the answer is correct, a close-but-wrong match, or a synonym match.
- `normalizeAnswer(str): string` — applies trim, lowercase, NFD accent folding, trailing punctuation strip, space collapse. Exported for reuse by UI display normalization.
- `extractCandidates(answer): string[]` — decomposes an answer string into all matchable normalized variants.

**Normalization pipeline** (applied to both typed input and all answer candidates):
1. `trim()` and `.toLowerCase()`
2. Unicode NFD accent folding — strips combining diacritics (café → cafe)
3. Strip trailing punctuation (`[.!?;:]`)
4. Collapse multiple internal spaces

**Candidate decomposition** (applied to correctAnswer and each acceptableAlternative):
- Split on ` / ` for slash alternatives (`"grey / gray"` → `["grey", "gray"]`)
- Split each slash segment on `, ` for comma synonyms (`"lawyer, solicitor"` → `["lawyer", "solicitor"]`)
- Full unsplit string is always a candidate (handles answers like `"bacon, lettuce, and tomato"`)
- Trailing parenthetical stripped: `"sandwich (bread roll)"` → `"sandwich"`
- Leading `"to "` stripped: `"to abandon"` → `"abandon"`

**Bidirectional "to" prefix:** If the player types `"to eat"` against answer `"eat"`, the typed "to" is stripped. If the player types `"eat"` against answer `"to eat"`, a `"to {typed}"` candidate is also tried.

**Language parameter:** Reserved for future locale-specific normalization. Currently unused.

#### Synonym Matching (Phase 2)

`synonymService.ts` exposes `getSynonyms(word): string[]`, backed by a 13,000+ word WordNet-derived synonym map bundled at build time.

Matching rules:
- Only applied when the typed input is a **single word** (no spaces after normalization)
- Bidirectional check: typed word is a synonym of any answer candidate, OR any answer candidate is a synonym of the typed word
- Result: `TypedAnswerResult.correct = true`, `matchedSynonym = true`
- Example: answer is `"happy"`, player types `"glad"` → `getSynonyms("glad")` includes `"happy"` → accepted
- Blocked pairs (see below) are skipped even if WordNet reports them as synonyms

**Synonym Blocklist (`SYNONYM_BLOCKLIST` constant in `typedAnswerChecker.ts`):**

WordNet groups multiple semantic senses under a single synset for polysemous words, causing false positive matches that would be wrong in a vocabulary quiz context. The blocklist is a `Set<string>` of `"word1:word2"` pairs (lowercased, alphabetically ordered). The check is bidirectional via the `isSynonymBlocked(word1, word2)` helper.

Examples of blocked pairs and why:

| Blocked Pair | Reason |
|---|---|
| `run:test` | WordNet "trial/run/test" synset — different senses (movement vs. examination) |
| `close:finish` | Related but not interchangeable as vocab answers |
| `bear:have` | "bear" (endure) shares a synset with "have" (possess) — too broad |
| `lay:set`, `put:set`, `fix:set` | "set" is extremely polysemous |
| `jump:spring`, `leap:spring` | "spring" multi-sense (season / water source / jump) |
| `nation:state` | "state" (condition) vs. "state" (country/region) — distinct vocab concepts |

To add a new blocked pair: append a lowercase alphabetically-ordered `'word1:word2'` string to `SYNONYM_BLOCKLIST` in `typedAnswerChecker.ts` with a comment explaining the semantic conflict.

**Note:** `GrammarTypingInput.svelte` (Japanese only) does not call `checkTypedAnswer` and is unaffected by synonym matching. Japanese kana particles and grammar forms don't benefit from English WordNet synonyms.

#### Close Match Detection (Phase 3)

After exact and synonym matching fail, `checkTypedAnswer` computes Levenshtein distance between the normalized typed input and each answer candidate.

**Acceptance threshold:** distance `<= 2` AND distance `<= Math.ceil(answer.length * 0.3)`

Both conditions must hold — this prevents short answers (e.g. 3-letter words) from accepting single-character typos that would change meaning.

Close matches are **wrong for scoring**: `TypedAnswerResult.correct = false`, `closeMatch = true`. FSRS records the attempt as incorrect. The threshold exists purely for UX feedback — players see a hint that they were nearly right rather than a blunt wrong-answer response.

#### UI Feedback States

| State | `correct` | `closeMatch` | UI Display |
|-------|-----------|--------------|------------|
| Exact / synonym match | `true` | `false` | Green "Correct!" |
| Close match | `false` | `true` | Amber "Almost!" |
| Wrong | `false` | `false` | Red "Wrong" |

The `closeMatch` flag is consumed by `TypingInput.svelte` to conditionally apply the amber feedback style. `GrammarTypingInput.svelte` is unchanged — it uses its own result handling for Japanese IME input and does not read `closeMatch`.

---

## Japanese Grammar Fact Rendering (2026-04-08)

Grammar fill-in-the-blank facts use pre-baked segment data stored on the fact itself, replacing the previous runtime kuromoji tokenization path.

### Data Fields (on `Fact` and `DeckFact`)

| Field | Type | Description |
|-------|------|-------------|
| `sentenceFurigana` | `Array<{t:string;r?:string;g?:string}>` | Ordered segments for the whole sentence. `t` = surface, `r` = hiragana reading (kanji only), `g` = English gloss (content words only). `{t:"{___}"}` entries mark blank positions. Baked offline by `scripts/japanese/bake-grammar-furigana.mjs`. |
| `sentenceRomaji` | `string` | Whole-sentence romaji for the Japanese sentence. Shown when the romaji toggle is ON. |
| `sentenceTranslation` | `string` | English translation (promoted from `quizQuestion` line 2 to a first-class field). |
| `grammarPointLabel` | `string` | Short grammar-point label for typing-mode hint, e.g. `"が — subject marker particle"`. |

### Rendering Path (`GrammarSentenceFurigana.svelte`)

The component receives `fact.sentenceFurigana` as `segments` and renders synchronously:
- `{___}` segments → `<span class="grammar-blank">______</span>`
- Segments with `r` + `furigana` ON + `kanaOnly` OFF → `<ruby>` with `<rt>` reading
- Segments with `r` + `kanaOnly` ON → plain hiragana text (`r`)
- All other segments → plain surface text (`t`)
- Segments with `g` (not in `excludeWords`) → hoverable with tooltip showing reading + gloss

When `segments` is empty (un-baked fact or CardExpanded), `fallbackText` is split on `
` and rendered plain.

### Romaji Row and Typing-Mode Hints (`CardExpanded.svelte`)

- `showRomaji = $derived.by(() => $deckOptions?.ja?.romaji ?? false)` — reads romaji toggle
- When `showRomaji && fact.sentenceRomaji` — renders `<p class="grammar-romaji">` below the translation
- In typing mode (`useTypingMode` + `fact.language === 'ja'`): a `.grammar-typing-hints` panel shows above `GrammarTypingInput` with `fact.grammarPointLabel` (teal label) and `fact.sentenceTranslation` (italic muted white). Panel is omitted when both fields are absent.

### StudyQuizOverlay Grammar Rendering (2026-04-08)

`StudyQuizOverlay.svelte` (rest-room study quiz) mirrors the combat grammar rendering path:

- Detects grammar facts via `isJapaneseGrammarFact = !!currentQuestion?.sentenceFurigana?.length`
- Renders `GrammarSentenceFurigana` with `segments={currentQuestion.sentenceFurigana}`, `fallbackText`, `excludeWords={[currentQuestion.correctAnswer]}`
- Shows `sentenceTranslation` as `.grammar-translation` (italic muted)
- Shows `sentenceRomaji` as `.grammar-romaji` when romaji toggle is ON
- Shows `grammarPointLabel` as `.grammar-hint-label` (teal left-bordered panel) — always visible in MCQ study mode (no typing path in study mode)

**Data pipeline for study mode grammar fields:**

`DeckFact` (sentenceFurigana/Romaji/Translation/grammarPointLabel) → `NonCombatQuizQuestion` (forwarded by `selectNonCombatStudyQuestion` and `selectNonCombatCustomDeckQuestion`) → `QuizQuestion` (forwarded in both study + custom_deck branches of `generateStudyQuestions` in `gameFlowController.ts`) → `StudyQuizOverlay` via `questions` prop.

---

## Typing Mode (Always Write Answers)

### Activation

The "Always Write Answers" toggle is available in deck options for all 8 language decks: Japanese (`ja`), Spanish (`es`), French (`fr`), German (`de`), Dutch (`nl`), Czech (`cs`), Korean (`ko`), and Mandarin Chinese (`zh`). When enabled, every eligible quiz question shows a text input instead of multiple-choice buttons.

Previously this toggle was wired only to Japanese grammar fill-in-blank questions. As of 2026-04-07 it applies to all vocab and grammar questions across all language decks.

Toggle state is stored per-language in `localStorage` under `card:deckOptions`. Read via `isAlwaysWriteEnabled(languageCode)`.

### Exclusions (automatic fallback to multiple choice)

`isTypingExcluded` is computed in both `QuizOverlay.svelte` and `CardExpanded.svelte` and returns `true` (forcing multiple choice) when any of the following apply:

| Condition | Reason |
|-----------|--------|
| `fact.quizMode === 'image_question'` or `'image_answers'` | Image quiz modes have no text answer to type |
| `isNumericalAnswer(fact.correctAnswer)` | Brace-marked numerical answers (e.g. `{107} days`) use algorithmic distractors, not free text |
| `displayAnswer(fact.correctAnswer).length > 80` | Very long answers are impractical to type correctly |

### Input Components

Two components handle typing input, selected by language:

**`GrammarTypingInput.svelte`** — Japanese only (`fact.language === 'ja'`):
- Binds wanakana for romaji→hiragana IME conversion
- Politeness form tolerance (e.g. `-masu` / `-ru` alternation)
- Props: `correctAnswer`, `acceptableAlternatives?`, `onsubmit`

**`TypingInput.svelte`** — All other languages (es, fr, de, nl, cs, ko, zh):
- Plain text input, no IME binding
- Calls `checkTypedAnswer()` from `typedAnswerChecker.ts` for lenient matching
- Props: `correctAnswer: string`, `acceptableAlternatives?: string[]`, `language: string`, `onsubmit: (isCorrect: boolean, typed: string) => void`
- Placeholder: "Type the English meaning..."

### Quiz Surfaces

Typing mode is rendered in both quiz surfaces:

| Surface | Component | Location |
|---------|-----------|----------|
| Gate quiz / study review | `QuizOverlay.svelte` | Zone B (landscape) and portrait answer area; hidden once `showResult` is true |
| Combat card charge | `CardExpanded.svelte` | Answer area; controlled via `effectiveResponseMode` derived value |

`CardExpanded.svelte` also accepts a `quizResponseMode: 'choice' | 'typing'` prop — typing mode is active if `alwaysWriteEnabled` OR `quizResponseMode === 'typing'` (the `effectiveResponseMode` derived value).

---

## FSRS Scheduler (`fsrsScheduler.ts`)

Uses the `ts-fsrs` library with `enable_fuzz: true`. The scheduler instance is module-level (`const scheduler = fsrs(generatorParameters({ enable_fuzz: true }))`).

### Card States
`'new'` → `'learning'` → `'review'` ↔ `'relearning'`

### Rating Scale
- Correct answer → `Rating.Good`
- Wrong answer → `Rating.Again`

### Key Fields (PlayerFactState)
- `stability` — FSRS memory stability; maps to scheduled interval
- `difficulty` — 1–10 scale (1 = easiest); mapped to/from `easeFactor` (1.3–2.5) via `mapEaseToFSRSDifficulty` / `mapDifficultyToEase`
- `retrievability` — 0–1; fact is dormant when < 0.7 (`isDormant`)
- `interval` — scheduled review interval in days
- `reps`, `lapses` — total reviews and wrong-answer lapses
- `averageResponseTimeMs` — rolling average of answer times (updated via weighted formula)

### Card Tier Transitions
Tiers derived by `getCardTier` (from `tierDerivation.ts`). Tier changes append to `tierHistory` as `{ from, to, date }`. Reaching tier `'3'` stamps `masteredAt` on first achievement.

### New Fact Defaults (`createFactState`)
`easeFactor: 2.5`, `difficulty: ~5`, `cardState: 'new'`, `retrievability: 0`, `consecutiveCorrect: 0`.

## Accuracy Grade System (`accuracyGradeSystem.ts`)

Post-encounter grades from `calculateAccuracyGrade(chargesAttempted, chargesCorrect)`:

| Grade | Threshold | Bonus Card Options | Guaranteed Uncommon |
|-------|-----------|-------------------|---------------------|
| S     | ≥ 90%     | +1 (4 total)      | Yes                 |
| A     | ≥ 80%     | +1 (4 total)      | No                  |
| B     | 60–79%    | 0                 | No                  |
| C     | < 60%     | 0                 | No                  |

0 charges attempted → grade C, no bonuses. Pure upside design: struggling players receive standard rewards, not penalties.

## Speed Bonus

Defined in `balance.ts`:
- `SPEED_BONUS_THRESHOLD = 0.25` — answer in first 25% of remaining timer
- `SPEED_BONUS_MULTIPLIER = 1.5` — card effect multiplied 1.5×

Timer durations by floor (`FLOOR_TIMER`): 12s (floors 1–6), 9s (floors 7–12), 7s (floors 13–18), 4s (floors 19+). Timer is for speed bonus only — no auto-dismiss or auto-play on expiry.

## Language Deck Options (`deckOptionsService.ts`)

Per-language player preferences stored in `localStorage` under the key `card:deckOptions`. All options are per-language and default to `false` unless stated otherwise.

### Japanese (`ja`)

| Option ID | Label | Default | Effect |
|-----------|-------|---------|--------|
| `furigana` | Show Furigana | `true` | Display hiragana readings above kanji |
| `romaji` | Show Romaji | `false` | Display romanized readings |
| `kanaOnly` | Kana Only | `false` | Replace all kanji with hiragana (beginner mode) |
| `alwaysWrite` | Always Write Answers | `false` | Type answers instead of multiple choice (uses GrammarTypingInput with wanakana IME) |

### Spanish (`es`)

| Option ID | Label | Default | Effect |
|-----------|-------|---------|--------|
| `alwaysWrite` | Always Write Answers | `false` | Type answers instead of multiple choice |

### French (`fr`)

| Option ID | Label | Default | Effect |
|-----------|-------|---------|--------|
| `alwaysWrite` | Always Write Answers | `false` | Type answers instead of multiple choice |

### German (`de`)

| Option ID | Label | Default | Effect |
|-----------|-------|---------|--------|
| `alwaysWrite` | Always Write Answers | `false` | Type answers instead of multiple choice |

### Dutch (`nl`)

| Option ID | Label | Default | Effect |
|-----------|-------|---------|--------|
| `alwaysWrite` | Always Write Answers | `false` | Type answers instead of multiple choice |

### Czech (`cs`)

| Option ID | Label | Default | Effect |
|-----------|-------|---------|--------|
| `alwaysWrite` | Always Write Answers | `false` | Type answers instead of multiple choice |

### Korean (`ko`)

| Option ID | Label | Default | Effect |
|-----------|-------|---------|--------|
| `romanization` | Show Romanization | `false` | Display romanized pronunciation |
| `alwaysWrite` | Always Write Answers | `false` | Type answers instead of multiple choice |

### Chinese (`zh`)

| Option ID | Label | Default | Effect |
|-----------|-------|---------|--------|
| `pinyin` | Show Pinyin | `true` | Display pinyin pronunciation above characters |
| `pinyinOnly` | Pinyin Only | `false` | Replace characters with pinyin (beginner mode) |
| `alwaysWrite` | Always Write Answers | `false` | Type answers instead of multiple choice |

### Helper API

```typescript
// Generic
getDeckOption(languageCode, optionId, defaultValue)
setDeckOption(languageCode, optionId, value)

// Japanese
isFuriganaEnabled()        setFuriganaEnabled(enabled)
isRomajiEnabled()          setRomajiEnabled(enabled)
isKanaOnlyEnabled()        setKanaOnlyEnabled(enabled)

// Chinese
isPinyinEnabled()          setPinyinEnabled(enabled)
isPinyinOnlyEnabled()      setPinyinOnlyEnabled(enabled)

// Korean
isKoreanRomanizationEnabled()  setKoreanRomanizationEnabled(enabled)

// All language decks (any language code accepted)
isAlwaysWriteEnabled(languageCode)  setAlwaysWriteEnabled(languageCode, enabled)
```

`isAlwaysWriteEnabled(languageCode)` accepts any ISO 639-1 language code. The `alwaysWrite` option is configured in `SUPPORTED_LANGUAGES` (`src/types/vocabulary.ts`) for all 8 language decks: `ja`, `es`, `fr`, `de`, `nl`, `cs`, `ko`, `zh`.
