# Quiz Engine Mechanics

> **Purpose:** Documents how quiz questions are selected, formatted, graded, and how the FSRS spaced repetition algorithm schedules fact reviews.
> **Last verified:** 2026-04-04
> **Source files:** `src/services/quizService.ts`, `src/services/fsrsScheduler.ts`, `src/services/questionFormatter.ts`, `src/services/questionTemplateSelector.ts`, `src/services/curatedFactSelector.ts`, `src/services/accuracyGradeSystem.ts`, `src/services/curatedDistractorSelector.ts`

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

**Playlist mode non-combat questions** (`nonCombatQuizSelector.ts: selectNonCombatPlaylistQuestion`):
Playlist runs (multiple curated decks) use a separate selector that merges facts from all playlist items.
`factSourceDeckMap` (from `RunState.factSourceDeckMap`) resolves the correct source deck per-fact for
template and distractor selection. Called from `generateStudyQuestions` (rest sites) and
`generateQuizPhaseQuestions` (boss quiz phase) when `deckMode.type === 'playlist'`.
Distractors are drawn from the source deck's own answer type pools to preserve pool coherence.

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
| `alwaysWrite` | Always Write Answers | `false` | Type answers instead of multiple choice for grammar questions |

### Chinese (`zh`)

| Option ID | Label | Default | Effect |
|-----------|-------|---------|--------|
| `pinyin` | Show Pinyin | `true` | Display pinyin pronunciation above characters |
| `pinyinOnly` | Pinyin Only | `false` | Replace characters with pinyin (beginner mode) |

### Korean (`ko`)

| Option ID | Label | Default | Effect |
|-----------|-------|---------|--------|
| `romanization` | Show Romanization | `false` | Display romanized pronunciation |

### Helper API

```typescript
// Generic
getDeckOption(languageCode, optionId, defaultValue)
setDeckOption(languageCode, optionId, value)

// Japanese
isFuriganaEnabled()        setFuriganaEnabled(enabled)
isRomajiEnabled()          setRomajiEnabled(enabled)
isKanaOnlyEnabled()        setKanaOnlyEnabled(enabled)
isAlwaysWriteEnabled('ja') setAlwaysWriteEnabled('ja', enabled)

// Chinese
isPinyinEnabled()          setPinyinEnabled(enabled)
isPinyinOnlyEnabled()      setPinyinOnlyEnabled(enabled)

// Korean
isKoreanRomanizationEnabled()  setKoreanRomanizationEnabled(enabled)
```

`isAlwaysWriteEnabled(languageCode)` accepts any language code — useful for future expansion to other grammar decks. Currently configured only for Japanese via the `SUPPORTED_LANGUAGES` options array.
