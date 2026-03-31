# Quiz & Fact Selection Services

> **Purpose:** Question serving, fact selection, distractor generation, answer formatting, grading, and the fact database layer.
> **Last verified:** 2026-03-31
> **Source files:** quizService.ts, curatedFactSelector.ts, curatedDistractorSelector.ts, nonCombatQuizSelector.ts, questionFormatter.ts, questionTemplateSelector.ts, distractorFilter.ts, numericalDistractorService.ts, vocabDistractorService.ts, vocabVariantService.ts, synonymService.ts, accuracyGradeSystem.ts, factsDB.ts, factPackService.ts, factSpriteManifest.ts, japaneseTokenizer.ts, languageService.ts, fsrsScheduler.ts (see also learning.md), sm2.ts (see also learning.md)

## Overview

Quiz serving splits into two pipelines: the **legacy facts DB** path (sql.js SQLite, `quizService`) for general knowledge, and the **curated deck** path (`curatedFactSelector`, `questionTemplateSelector`, `curatedDistractorSelector`) for structured learning content. Both paths ultimately flow through `nonCombatQuizSelector` for non-combat quiz contexts (rest rooms, study temple, boss phases).

---

## factsDB

| | |
|---|---|
| **File** | src/services/factsDB.ts |
| **Purpose** | Lazy-loaded sql.js SQLite wrapper for the main facts database. Defers 300 KB WASM from critical path. |
| **Key exports** | `factsDB` (singleton with `init`, `isReady`, `getAll`, `getById`, `getByCategory`, `search`) |
| **Key dependencies** | factPackService, sql.js (dynamic import), legalConstants |

## quizService

| | |
|---|---|
| **File** | src/services/quizService.ts |
| **Purpose** | Selects the next due review-state fact for quiz; handles vocab and numerical distractor dispatch |
| **Key exports** | `selectQuestion` |
| **Key dependencies** | vocabDistractorService, numericalDistractorService, balance.ts |

## curatedFactSelector

| | |
|---|---|
| **File** | src/services/curatedFactSelector.ts |
| **Purpose** | Anki three-queue fact selection for curated decks: learning queue first, then review/new intersperser |
| **Key exports** | `selectFactForCharge`, `FactSelectionResult` (interface) |
| **Key dependencies** | inRunFactTracker (injected), seededRng |

## questionTemplateSelector

| | |
|---|---|
| **File** | src/services/questionTemplateSelector.ts |
| **Purpose** | Selects and renders a question template for a charge-time fact; filters by mastery level and tracks variety |
| **Key exports** | `selectQuestionTemplate`, `TemplateSelectionResult` (interface) |
| **Key dependencies** | curatedDeckTypes (injected deck data) |

## curatedDistractorSelector

| | |
|---|---|
| **File** | src/services/curatedDistractorSelector.ts |
| **Purpose** | Picks distractors for curated deck charges using confusion matrix, in-run struggle data, and similarity pools |
| **Key exports** | `selectDistractors`, `getDistractorCount`, `DistractorSelectionResult` (interface) |
| **Key dependencies** | confusionMatrix (injected), inRunFactTracker (injected) |

## nonCombatQuizSelector

| | |
|---|---|
| **File** | src/services/nonCombatQuizSelector.ts |
| **Purpose** | Builds quiz questions for non-combat contexts (rest room, study temple, boss phases, mastery challenges). Supports flag/image question types. |
| **Key exports** | `selectNonCombatStudyQuestion`, `rollFlagQuestionType`, `NonCombatQuizQuestion` (interface) |
| **Key dependencies** | curatedFactSelector, questionTemplateSelector, curatedDistractorSelector, numericalDistractorService, inRunFactTracker |

## questionFormatter

| | |
|---|---|
| **File** | src/services/questionFormatter.ts |
| **Purpose** | Maps card tier + mastery trial flag to quiz presentation options (option count, reverse mode, fill-blank, timer) |
| **Key exports** | `getQuestionPresentation`, `QuestionPresentation` (interface) |
| **Key dependencies** | balance.ts (TIER_QUESTION_FORMAT, MASTERY_TRIAL) |

## distractorFilter

| | |
|---|---|
| **File** | src/services/distractorFilter.ts |
| **Purpose** | Runtime regex filter that removes placeholder/garbage distractor strings before they reach the player |
| **Key exports** | `isPlaceholderDistractor` |
| **Key dependencies** | None |

## numericalDistractorService

| | |
|---|---|
| **File** | src/services/numericalDistractorService.ts |
| **Purpose** | Generates semantically sensible wrong-answer numbers for numeric facts using brace-pattern detection and seeded PRNG |
| **Key exports** | `isNumericalAnswer`, `getNumericalDistractors`, `displayAnswer` |
| **Key dependencies** | balance.ts |

## vocabDistractorService

| | |
|---|---|
| **File** | src/services/vocabDistractorService.ts |
| **Purpose** | Per-language per-subdeck distractor index (vocab/kanji/grammar/kana for ja/ko/zh); prevents cross-subdeck contamination |
| **Key exports** | `getVocabDistractors` |
| **Key dependencies** | factsDB |

## vocabVariantService

| | |
|---|---|
| **File** | src/services/vocabVariantService.ts |
| **Purpose** | Selects and builds question variant type (forward/reverse/synonym/definition) based on card tier progression |
| **Key exports** | `selectVariant`, `buildVariantQuestion`, `VocabVariant` (type), `VARIANT_PROGRESSION` |
| **Key dependencies** | synonymMap.json (pre-generated) |

## synonymService

| | |
|---|---|
| **File** | src/services/synonymService.ts |
| **Purpose** | Pre-computed WordNet synonym lookup for use in vocab variant questions |
| **Key exports** | `getSynonyms`, `getRelatedWords`, `hasSynonymData` |
| **Key dependencies** | synonymMap.json (pre-generated) |

## accuracyGradeSystem

| | |
|---|---|
| **File** | src/services/accuracyGradeSystem.ts |
| **Purpose** | Post-encounter accuracy grading (C/B/A/S) that unlocks bonus card reward options at A/S grades |
| **Key exports** | `gradeAccuracy`, `AccuracyGrade` (type), `GradeResult` (interface) |
| **Key dependencies** | None (pure math) |

## factPackService

| | |
|---|---|
| **File** | src/services/factPackService.ts |
| **Purpose** | Offline-first JSON fact pack manager; caches approved facts from the server for 7 days |
| **Key exports** | `factPackService` (singleton with `init`, `getFacts`, `syncPacks`) |
| **Key dependencies** | None (localStorage + fetch) |

## factSpriteManifest

| | |
|---|---|
| **File** | src/services/factSpriteManifest.ts |
| **Purpose** | In-memory cache of approved fact IDs that have 64x64 sprites; queried by FactArtwork.svelte |
| **Key exports** | `getFactSpriteManifest` |
| **Key dependencies** | None (fetch + Set cache) |

## japaneseTokenizer

| | |
|---|---|
| **File** | src/services/japaneseTokenizer.ts |
| **Purpose** | Lazy-loading kuromoji.js Japanese tokenizer with sentence cache; used for hover dictionary in quiz overlay |
| **Key exports** | `tokenizeJapanese`, `JapaneseToken` (interface) |
| **Key dependencies** | kuromoji (dynamic import), JMdict data |

## languageService

| | |
|---|---|
| **File** | src/services/languageService.ts |
| **Purpose** | Svelte store for the active language mode (enabled/disabled, language code, JLPT/CEFR level) |
| **Key exports** | `languageMode` (store), `LanguageModeState` (interface) |
| **Key dependencies** | vocabulary types |
