# AR-49: Japanese Hiragana & Katakana Subdecks

**Status:** Complete
**Completed:** 2026-03-16
**Created:** 2026-03-16
**Depends on:** AR-34 (vocab pipeline complete)

## Overview

Add Hiragana and Katakana character recognition subdecks for Japanese. These are the foundational writing systems — prerequisite to reading any Japanese vocabulary. Each kana character maps to a specific sound (romaji), making this a finite, programmatically-generated set.

**Why pre-generated distractors:** The vocabDistractorService picks from the `language: "ja"` pool, which includes full vocab words. Kana distractors must be OTHER kana readings (not vocab words like "食べる" for a single-character question). Pre-generating ensures pedagogically useful distractors: same-row, same-column, and visually similar kana.

## Scope

- **Hiragana:** 46 basic + 25 dakuten + 33 combinations = ~104 characters
- **Katakana:** 46 basic + 25 dakuten + 33 combinations = ~104 characters
- **Total facts:** ~416 (2 question directions × ~208 characters)
- **Question types per character:**
  - Forward: "What sound does あ represent?" → "a"
  - Reverse: "Which hiragana represents 'ka'?" → "か"
- **Variants:** 4 per fact (forward, reverse, true_false, fill_blank)

## Deliverables

Total: 1 build script, 2 seed files, 2 new subcategories, DB rebuild

## Tasks

### Section A: Add Subcategories

- [x] **A.1** Add `japanese_hiragana` and `japanese_katakana` subcategories to `src/data/subcategoryTaxonomy.ts`
  - Acceptance: New subcategories appear in the Japanese language section

### Section B: Build Kana Generation Script

- [x] **B.1** Create `scripts/content-pipeline/build-kana-facts.mjs`
  - Programmatic generation — NO LLM needed
  - Define all hiragana and katakana with readings, difficulty tiers, row/column groupings
  - Generate 2 facts per character (kana→romaji, romaji→kana)
  - Pre-generate 8 distractors per fact using smart selection:
    - Same consonant row (ka→ki,ku,ke,ko)
    - Same vowel column (ka→sa,ta,na,ha)
    - Visually similar pairs (あ/お, は/ほ, ぬ/め, ね/れ, シ/ツ, ソ/ン)
  - Generate 4 variants per fact (forward, reverse, true_false, fill_blank)
  - Difficulty tiers: 1=vowels, 2=common consonants, 3=uncommon+n, 4=dakuten, 5=combinations
  - Output: `src/data/seed/vocab-ja-hiragana.json`, `src/data/seed/vocab-ja-katakana.json`
  - Acceptance: Script runs, generates valid JSON with all required fields

### Section C: Generate & Verify

- [x] **C.1** Run `node scripts/content-pipeline/build-kana-facts.mjs`
  - Acceptance: Two seed files created with ~208 facts each
  - **Result:** 208 hiragana + 208 katakana facts generated
- [x] **C.2** Rebuild DB: `node scripts/build-facts-db.mjs`
  - Acceptance: DB includes kana facts, total increases
  - **Result:** DB rebuilt — 100,374 total facts (up from 99,958)
- [x] **C.3** Run typecheck: `npm run typecheck`
  - Acceptance: 0 errors
  - **Result:** Typecheck clean (0 errors)
- [x] **C.4** Verify kana facts in DB: query for `categoryL2 = 'japanese_hiragana'` and `japanese_katakana`
  - Acceptance: Expected count of facts per subcategory
  - **Result:** Verified: 208 hiragana + 208 katakana facts in DB with correct subcategories

## Verification Gate

- [x] `npm run typecheck` — clean
- [x] DB has ~208 hiragana + ~208 katakana facts
- [x] All kana facts have 8 pre-generated distractors (not empty)
- [x] Distractors are other kana readings (not vocab words)
- [x] All facts have 4 variants

## Files Affected

| File | Action | Task |
|------|--------|------|
| `src/data/subcategoryTaxonomy.ts` | EDIT | A.1 |
| `scripts/content-pipeline/build-kana-facts.mjs` | NEW | B.1 |
| `src/data/seed/vocab-ja-hiragana.json` | NEW | C.1 |
| `src/data/seed/vocab-ja-katakana.json` | NEW | C.1 |
| `public/facts.db` | REBUILD | C.2 |

## Kana Reference

### Difficulty Tiers
- **Tier 1 (vowels):** あいうえお / アイウエオ
- **Tier 2 (common consonants):** ka, sa, ta, na rows
- **Tier 3 (less common + special):** ha, ma, ya, ra, wa rows + ん/ン
- **Tier 4 (dakuten/handakuten):** ga, za, da, ba, pa rows
- **Tier 5 (combinations):** kya, sha, cha, nya, hya, mya, rya + voiced combos

### Visually Similar Pairs (important for distractors)
**Hiragana:** あ/お, き/さ, は/ほ, ぬ/め, ね/れ, る/ろ, わ/れ
**Katakana:** シ/ツ, ソ/ン, ウ/ワ, ク/ケ, コ/ユ, チ/テ
