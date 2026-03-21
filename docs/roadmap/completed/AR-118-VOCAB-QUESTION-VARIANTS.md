# AR-118: Vocabulary Question Variant System

## Overview

Implement multiple question formats for vocabulary facts across all 8 languages. Currently vocab cards always ask "What does [word] mean?" — this AR adds Reverse, Synonym Pick, and Definition Match variants that are selected based on card tier, testing progressively deeper knowledge.

Also upgrades distractor selection to prefer words the player has seen but not mastered (FSRS-aware), and handles the case where a card has fewer upgrades available than variant types.

**Scope:** All vocabulary facts across all 8 supported languages (JA, KO, ZH, DE, FR, ES, NL, CS).

---

## Sub-steps

### 1. Create `vocabVariantService.ts` — variant selection engine

- [ ] 1.1 Define variant types: `'forward' | 'reverse' | 'synonym' | 'definition'`
- [ ] 1.2 Define tier → variant weighted selection:
  ```
  Tier 1:  forward only (100%)
  Tier 2a: forward (60%), reverse (40%)
  Tier 2b: forward (30%), reverse (30%), synonym (20%), definition (20%)
  Tier 3:  free recall (existing system, no change)
  ```
- [ ] 1.3 `selectVariant(tier, fact)` — picks a variant using weighted random, with fallback:
  - If synonym selected but no WordNet data → fall back to forward
  - If definition selected but `explanation` field empty/short → fall back to forward
  - If reverse selected but can't generate L2 distractors → fall back to forward
- [ ] 1.4 `buildVariantQuestion(fact, variant)` — returns `{ question: string, correctAnswer: string, answerPool: 'english' | 'l2' }`:
  - **forward**: question = `fact.quizQuestion`, answer = `fact.correctAnswer`, pool = english
  - **reverse**: question = `"How do you say '${fact.correctAnswer}' in ${languageName}?"`, answer = L2 word (extracted from quizQuestion), pool = l2
  - **synonym**: question = `"Which word is closest in meaning to ${L2word}?"`, answer = WordNet synonym, pool = english (synonyms + unrelated words)
  - **definition**: question = explanation text (stripped of L2 word), answer = `fact.correctAnswer`, pool = english

**Files:** `src/services/vocabVariantService.ts`

**Acceptance:** Pure functions. Unit tests for each variant type and tier selection.

### 2. Build WordNet synonym lookup (build-time pre-computation)

- [ ] 2.1 Create `scripts/build-synonym-map.mjs` that:
  - Reads all unique `correctAnswer` values from vocab facts in the seed data
  - Looks up each in WordNet (via `natural` npm package or `wordnet-db`)
  - For each word with a synset: stores `{ synonyms: string[], related: string[] }`
  - `synonyms` = other words in the same synset (correct answers for synonym pick)
  - `related` = sibling words from the same hypernym (good distractors for synonym pick)
  - Outputs to `src/data/generated/synonymMap.json`
- [ ] 2.2 Create `src/services/synonymService.ts` that loads the map and exposes:
  - `getSynonyms(word)` → string[] (may be empty)
  - `getRelatedWords(word)` → string[] (same-category but different meaning)
  - `hasSynonymData(word)` → boolean

**Files:** `scripts/build-synonym-map.mjs`, `src/services/synonymService.ts`, `src/data/generated/synonymMap.json`

**Acceptance:** Map covers 70%+ of single-word English answers. `getSynonyms('bench')` returns `['seat']` or similar.

### 3. Upgrade distractor selection — FSRS-aware smart pool

- [ ] 3.1 Update `vocabDistractorService.ts` to accept an optional `seenFactIds: Set<string>` parameter
- [ ] 3.2 When provided, partition the candidate pool:
  - **Priority 1:** Facts in `seenFactIds` that are NOT mastered (due/overdue in FSRS) — these are the hardest distractors
  - **Priority 2:** Other facts in `seenFactIds` (seen but currently fresh)
  - **Priority 3:** Unseen facts (fallback for early game)
- [ ] 3.3 Within each priority tier, maintain existing difficulty-proximity and length-matching logic
- [ ] 3.4 For **Reverse variant** distractors: select L2 words instead of English words
  - Extract the L2 word from each candidate's `quizQuestion` (regex: text between quotes or before "means")
  - Apply same priority ordering (seen-not-mastered first)
  - Avoid L2 words that translate to the same English word as the target
- [ ] 3.5 For **Synonym variant** distractors: use WordNet `getRelatedWords()` + random unrelated English words
- [ ] 3.6 Thread `seenFactIds` from the run state (available in `deckManager` or `runState.seenFacts`)

**Files:** `src/services/vocabDistractorService.ts`

**Acceptance:** Distractors for a player who has seen 50+ words should predominantly come from their seen-but-not-mastered pool.

### 4. Wire variant selection into quiz pipeline

- [ ] 4.1 In `CardCombatOverlay.svelte`, when building the quiz question for a vocab card:
  - Call `selectVariant(card.tier, fact)` to pick the variant type
  - Call `buildVariantQuestion(fact, variant)` to get the question text and correct answer
  - Pass the variant's `answerPool` to the distractor service (english vs L2)
- [ ] 4.2 Update `getQuestionPresentation()` to pass through the selected variant
- [ ] 4.3 Handle the display: for Reverse questions, answer buttons show L2 text; for all others, English text
- [ ] 4.4 Ensure the existing `useReverse` flag in `questionFormatter.ts` is replaced by the new variant system (remove dead code)
- [ ] 4.5 Track which variant was used for analytics/stats

**Files:** `src/ui/components/CardCombatOverlay.svelte`, `src/services/questionFormatter.ts`, `src/services/quizService.ts`

**Acceptance:** Tier 1 cards always show forward. Tier 2a cards show reverse ~40% of the time. Tier 2b shows all 4 variants. Variant type visible in quiz UI.

### 5. Handle tier/variant count mismatch gracefully

- [ ] 5.1 Not all cards will reach all tiers. The system must work when:
  - A card is at tier 1 (only forward available) — works by default
  - A card is at tier 2a but the player's seen pool is tiny (reverse falls back to forward) — covered by fallback in 1.3
  - A card's fact has no explanation (definition variant unavailable) — covered by fallback in 1.3
  - A card's answer has no WordNet data (synonym variant unavailable) — covered by fallback in 1.3
- [ ] 5.2 Log variant fallbacks for analytics (how often each variant is actually used vs requested)

**Files:** `src/services/vocabVariantService.ts`

**Acceptance:** No crashes or empty questions regardless of data availability. Graceful degradation always produces a valid question.

### 6. Unit tests

- [ ] 6.1 Test variant selection per tier (weighted distribution within 10% of expected)
- [ ] 6.2 Test buildVariantQuestion for each type
- [ ] 6.3 Test fallback when synonym/definition data missing
- [ ] 6.4 Test FSRS-aware distractor prioritization
- [ ] 6.5 Test reverse distractor extraction (L2 words from quizQuestion)

**Files:** `src/services/__tests__/vocabVariantService.test.ts`

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] `npx vitest run` passes (new + existing tests)
- [ ] Synonym map generated with 70%+ coverage
- [ ] Tier 1 vocab card: always shows forward question
- [ ] Tier 2a vocab card: shows reverse ~40% of the time (verify over 20 draws)
- [ ] Tier 2b vocab card: shows all 4 variants (verify over 40 draws)
- [ ] Reverse questions show L2 word answer buttons
- [ ] Definition questions don't show the L2 word in the question text
- [ ] Synonym questions offer a real synonym as correct answer
- [ ] Distractors prefer seen-but-not-mastered words when available
- [ ] Falls back gracefully when WordNet/explanation data missing
- [ ] Playwright visual test: enter combat, play a tier 2a+ vocab card, confirm variant question appears
- [ ] Works for all 8 languages (test at least JA, DE, ES)
- [ ] GAME_DESIGN.md updated to match implementation
