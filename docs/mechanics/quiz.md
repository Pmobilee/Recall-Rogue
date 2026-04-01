# Quiz Engine Mechanics

> **Purpose:** Documents how quiz questions are selected, formatted, graded, and how the FSRS spaced repetition algorithm schedules fact reviews.
> **Last verified:** 2026-04-01
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
Anki three-priority system:
1. **Due learning cards** — time-critical, always served first (`selectionReason: 'struggling'`)
2. **Main queue** — Anki Intersperser: proportional mixing of due graduated reviews + new cards. New cards sorted by `difficulty` ascending (easier first). New cards only introduced when `canIntroduceNew()` returns true (`MAX_LEARNING = 8`)
3. **Ahead learning** — cards in learning but not yet due, only when nothing else available
4. **Fallback** — any card except the immediately previous fact (avoids consecutive repeats)

**Multi-question batch dedup** (`nonCombatQuizSelector.ts`):
`selectNonCombatStudyQuestion` accepts an optional `excludeFactIds: ReadonlySet<string>` parameter.
When provided, the fact pool is filtered to exclude those IDs before calling `selectFactForCharge`.
This prevents duplicate questions in batches like rest-site study sessions (3 questions).
The caller (`generateStudyQuestions` in `gameFlowController.ts`) accumulates `excludeFactIds` across
iterations and passes it on each call. If filtering would leave zero candidates (tiny deck), the full
pool is used as a fallback so the function never returns `null` due to exhaustion.

### 2. Template Selection (`questionTemplateSelector.ts`)

`selectQuestionTemplate` selects from `deck.questionTemplates` using a seeded xorshift32 RNG:

1. Filter by `template.availableFromMastery <= cardMasteryLevel`
2. Filter to templates whose `answerPoolId` contains the fact
3. Weight: difficulty match ±1 vs mastery band (+3.0), variety penalty for recently used (×0.2), fresh bonus (+2.0), reverse-capable at mastery ≥ 2 (+1.5)
4. Weighted random pick; falls back to `fact.quizQuestion` if no templates match

Template placeholders in `questionFormat` are replaced via `renderTemplate`: `{targetLanguageWord}`, `{correctAnswer}`, `{language}`, `{reading}`, `{explanation}`, `{quizQuestion}`, and any other fact field key.

Special template IDs: `reverse` (answer = `targetLanguageWord`), `reading` (answer = `fact.reading`), default (answer = `fact.correctAnswer`).

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
2. Pool size check: if fewer than 5 unique answers available, use pre-generated `fact.distractors[]`
3. Scoring from `answerPool.factIds`: known confusions (+10.0×count), reverse confusions (+5.0×count), in-run struggles (+3.0), same part-of-speech (+4.0 or ×0.3 penalty), similar difficulty ±1 (+2.0)
4. Jitter (0–0.5) seeded from `totalCharges × fact ID hash` for per-encounter variety
5. Deduplication: skips distractor answers that appear by name in the question text
6. Fallback to `fact.distractors[]` if pool yields insufficient candidates

`inRunTracker` parameter accepts `InRunFactTracker | null`. When `null` (trivia mode bridge path), in-run struggle scoring is skipped and jitter seed uses `totalCharges = 0`.

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
