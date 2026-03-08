# Phase 1.2: Content Pipeline

**Status**: ✅ Completed
**Depends on**: None (can run parallel with 1.1)
**Estimated effort**: 1 week

## Overview
Expand vocabulary content from 50 to 500 entries. Build tooling for generating quality content at scale.

---

## Task 1.2.1: Expand vocab-n3.json to 200 Entries
**Status**: ✅ Completed
**File**: `src/data/seed/vocab-n3.json`

### Steps:
1. Read the existing `src/data/seed/vocab-n3.json` to understand the schema
2. Each entry must have: `id`, `type`, `statement`, `quiz_question`, `correct_answer`, `distractors` (array of 8+ wrong answers), `category`, `rarity`, `difficulty`, `language`, `pronunciation`
3. Add 150 more JLPT N3 vocabulary entries following the same schema
4. Use real N3 vocabulary — these are intermediate Japanese words
5. Categories: verbs, nouns, adjectives, adverbs
6. Distractors must be plausible English translations from the same word class
7. Validate JSON is well-formed
8. Run `npm run typecheck` and `npm run build`

---

## Task 1.2.2: Add Distractor Generation Utility
**Status**: ✅ Completed
**File**: `src/services/distractorService.ts` (NEW)

### Steps:
1. Create a new service that generates distractors for vocabulary entries
2. Strategy: for each correct answer, find semantically similar words:
   - Same word class (verb→verb, noun→noun)
   - Similar length
   - Same category when possible
3. Export function: `generateDistracters(correctAnswer: string, allFacts: Fact[], count: number): string[]`
4. Filter out the correct answer and any exact duplicates
5. Add JSDoc comments
6. Run `npm run typecheck` and `npm run build`

---

## Task 1.2.3: Add N3 Vocab Batch 2 (200→500)
**Status**: ✅ Completed
**File**: `src/data/seed/vocab-n3.json`

### Steps:
1. Add 300 more N3 vocabulary entries (total: 500)
2. Ensure no duplicate IDs
3. Spread across difficulty levels 1-5
4. Spread across rarity tiers (mostly common/uncommon, some rare)
5. Validate JSON
6. Run `npm run typecheck` and `npm run build`

---

## Task 1.2.4: Category Organization
**Status**: ✅ Completed
**File**: `src/data/types.ts` (update), `src/data/seed/vocab-n3.json` (update)

### Steps:
1. Ensure all facts have proper `category` arrays: `["Language", "Japanese", "JLPT N3", "Verbs"]` etc.
2. Add a `CATEGORIES` constant to types.ts listing all top-level categories
3. Update seed data to use consistent category paths
4. Run `npm run typecheck` and `npm run build`

---

## Verification
1. `npm run typecheck` — 0 errors
2. `npm run build` — success
3. Load the game and verify Study mode has access to all 500 facts
4. Verify quiz distractors are plausible (not random gibberish)
