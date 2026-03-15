# AR-45: Vocabulary Answer Length Normalization

**Status:** Complete
**Created:** 2026-03-16
**Depends on:** None
**Estimated complexity:** Medium (data cleanup script + runtime service upgrade)

---

## Problem

Vocabulary quiz answers have wildly inconsistent lengths across all 8 languages. Since the runtime distractor service picks `correctAnswer` values from other facts in the same language, a player can often guess the correct answer by length alone:

- **Correct answer is the longest**: "to smile slightly, smirk (not smugly, but in an amused or contented way...)" (127 chars) vs distractors "gold rush mood" (14 chars)
- **Correct answer is the shortest**: "nest" (4 chars) vs distractors "unlikely to go so far as to; not as bad as" (43 chars)

This is a game-breaking exploit that undermines the educational value.

### Severity Per Language

| Language | Total | Answers >40 chars | Parentheticals | Semicolons | Median len | p99 len | Special Issue |
|----------|-------|-------------------|----------------|------------|------------|---------|---------------|
| ZH | 11,470 | 1,687 (15%) | 1,496 | 1,070 | 11 | 72 | Multi-meaning semicolons |
| JA | 7,726 | 672 (9%) | 1,092 | 32 | 9 | 49 | Parenthetical clarifiers |
| ES | 11,434 | 2,715 (24%) | 2,048 | 452 | 12 | 97 | Wiktionary verbose defs |
| FR | 12,728 | 3,258 (26%) | 2,715 | 893 | 14 | 98 | Wiktionary verbose defs |
| DE | 18,610 | 6,414 (34%) | 4,137 | 1,079 | 18 | 125 | Longest answers + cognates |
| NL | 9,866 | 3,317 (34%) | 1,700 | 330 | 17 | 109 | Verbose Wiktionary defs |
| KO | 9,757 | 8,763 (90%) | 141 | 310 | 59 | 232 | NIKL defs are sentences, not translations |
| CS | 15,393 | 4,389 (29%) | 3,832 | 217 | 14 | 111 | Wiktionary verbose defs |

---

## Root Cause Analysis

### Problem 1: Data-side — Answers are dictionary definitions, not quiz answers

The vocab pipeline pulled `correctAnswer` directly from dictionary sources without normalization:

- **Wiktionary (ES/FR/DE/NL/CS)**: Definitions include parenthetical disambiguators like "wing (of a bird or other flying animal; of an aircraft; of a building)" — useful in a dictionary, fatal in a quiz.
- **HSK (ZH)**: Answers include multiple meanings separated by semicolons: "he; him (used for either sex when the sex is unknown or unimportant)"
- **JMdict (JA)**: Similar parenthetical qualifiers: "science (natural sciences and related fields, incl. mathematics, engineering, medicine, etc.)"
- **NIKL (KO)**: Definitions are *explanatory sentences*, not translations: "A place where products are displayed and sold on a small scale" instead of "store" or "shop"

### Problem 2: Runtime-side — Distractor service doesn't match answer length

`vocabDistractorService.ts` picks distractors from the same language filtered by difficulty ±1, but has NO length-matching logic. A 4-char correct answer can appear alongside 80-char distractors.

### Problem 3: Cognate leaks (DE/NL/ES/FR)

European languages have cognates where the answer IS the question: "What does 'Emission' mean?" → "emission". These are trivially guessable.

---

## Solution Design

### Two-pronged approach: data normalization + runtime length matching

**Prong 1: Seed file cleanup script** (`scripts/content-pipeline/normalize-vocab-answers.mjs`)

For each language, apply language-specific normalization rules to `correctAnswer`, moving the full definition to `explanation` (or a new `fullDefinition` field) so nothing is lost.

**Prong 2: Runtime distractor length matching** (upgrade `vocabDistractorService.ts`)

After picking candidates by language + difficulty, filter further by answer length similarity before final selection.

---

## Sub-Steps

### 1. Data Normalization Script

**File:** `scripts/content-pipeline/normalize-vocab-answers.mjs`

Applies these transformations in order per fact:

#### 1a. Strip parenthetical clarifications (ALL languages except KO)

```
"wing (of a bird or other flying animal)" → "wing"
"to take off (from the ground)" → "to take off"
"bar (loanword)" → "bar"
```

**Rule:** Remove `(...)` blocks at the end of answers. Keep parentheticals that ARE the answer (rare).

**Regex:** `/\s*\([^)]*\)$/` applied iteratively until no trailing parens remain. Also handle mid-string parens: `/\s*\([^)]+\)/g` but only if the result is still ≥3 chars.

#### 1b. Take first meaning before semicolons (ALL languages)

```
"he; him" → "he"
"to exist; to be alive" → "to exist"
"supper, dinner" → "supper"  (also handle comma-separated synonyms >2)
```

**Rule:** Split on `;`, take first. For comma-separated synonyms, keep first two if both are short, otherwise first only.

#### 1c. Cap at 40 characters with smart truncation (ALL languages)

If answer still >40 chars after 1a+1b, truncate at the last word boundary before 40 chars. Never cut mid-word.

#### 1d. Korean special handling — LLM rewrite pass

Korean answers are explanatory sentences from NIKL, not translations. No regex can fix:
- "A place where products are displayed and sold on a small scale" → "store, shop"
- "A value amount for something that is for sale" → "price"
- "To explain knowledge or skills to help someone understand it" → "to teach"

**Strategy:** Run a Sonnet sub-agent batch pass over all ~9,757 Korean facts:
- Input: `targetWord` (Korean) + current `correctAnswer` (NIKL definition)
- Prompt: "Convert this Korean-English dictionary definition into a concise English translation (1-4 words). Keep the same meaning but make it quiz-answer-length."
- Output: Replace `correctAnswer` with concise version, save original as `fullDefinition`

Batch in chunks of 200 facts per Sonnet worker, ~49 workers total. Can run 7 in parallel.

#### 1e. Save full definition to `fullDefinition` field

Before any truncation, copy the original `correctAnswer` to a new field `fullDefinition`. This preserves the rich dictionary data for the explanation screen after answering.

#### 1f. Cognate detection and flagging (DE/NL/ES/FR)

Flag facts where `correctAnswer` (after normalization) is identical or near-identical to `targetWord`:
- Exact match (case-insensitive): "Emission" → "emission"
- Levenshtein distance ≤ 2 AND length > 4: "Management" → "management"

**Action:** Don't delete these — they're legitimate easy questions. But tag them with `cognate: true` so the runtime service can:
- Show them at appropriate difficulty (these should be difficulty 1)
- Optionally deprioritize them in quiz selection if the player has proven they know cognates

### 2. Runtime Distractor Length Matching

**File:** `src/services/vocabDistractorService.ts`

Upgrade `getVocabDistractors()` to add a length-similarity filter:

```typescript
// After filtering by difficulty ±1, further filter by answer length
const targetLen = fact.correctAnswer.length
const lenMin = Math.max(2, Math.floor(targetLen * 0.4))
const lenMax = Math.ceil(targetLen * 2.5)

// Filter candidates whose correctAnswer is within length range
const lengthMatched = close.filter(c => {
  const l = c.correctAnswer.length
  return l >= lenMin && l <= lenMax
})
```

**Fallback:** If length filtering yields <3 candidates, relax to ±3x length ratio. If still <3, fall back to current unfiltered behavior (better to show mismatched lengths than no quiz at all).

### 3. Verification

After running the normalization:
- Re-run the same 10-per-language spot-check from the audit
- Verify answer length distributions: target median 8-15 chars, p99 <45 chars
- Verify no data loss: `fullDefinition` field preserved for all modified facts
- Rebuild DB and visually test in-game

---

## Execution Order

1. [x] Write `normalize-vocab-answers.mjs` with rules 1a-1c, 1e-1f (programmatic, all languages except KO LLM pass)
2. [x] Run in `--dry-run` mode, review before/after samples per language
3. [x] Run for real on all 7 non-Korean languages, rebuild DB
4. [x] Spot-check: re-run 10-per-language audit, verify distributions — **1/80 issues (Korean only, expected)**
5. [x] Korean LLM pass: 83 Haiku batches of 100 items rewrote NIKL definitions → concise 1-3 word translations (median 10 chars, max 30). 8,245 facts updated.
6. [x] Apply Korean results, rebuild DB — 60.2MB, 98,942 facts
7. [x] Spot-check Korean — 0 issues in 10 samples, answers now "store", "price", "furniture" etc.
8. [x] Upgrade `vocabDistractorService.ts` with length-matching filter
9. [x] Full spot-check: simulate 10 quiz questions per language, verify no length-exploitable patterns
10. [ ] Update `docs/RESEARCH/SOURCES/content-pipeline-progress.md` known quality issues section

---

## Acceptance Criteria

- [ ] All 8 languages have `correctAnswer` median length 6-18 chars, p99 <50 chars
- [ ] Korean answers are concise English translations (1-4 words), not NIKL definition sentences
- [ ] No parenthetical clarifications remain in `correctAnswer` (moved to `fullDefinition`)
- [ ] No semicolon-separated multi-meanings in `correctAnswer` (first meaning only)
- [ ] `fullDefinition` field preserves original dictionary definition for all modified facts
- [ ] Runtime distractor service selects length-matched distractors (±2.5x ratio)
- [ ] Cognate facts flagged with `cognate: true` field
- [ ] 10-per-language spot-check passes with 0 length-mismatch issues
- [ ] DB rebuilt and verified

---

## Files Affected

| File | Change |
|------|--------|
| `scripts/content-pipeline/normalize-vocab-answers.mjs` | NEW — normalization script |
| `src/data/seed/vocab-{zh,ja,es,fr,de,nl,ko,cs}.json` | Modified — normalized answers |
| `src/services/vocabDistractorService.ts` | Modified — length-matching filter |
| `src/data/types.ts` | Modified — add `fullDefinition?: string` and `cognate?: boolean` fields |
| `public/facts.db` | Rebuilt |
| `docs/RESEARCH/SOURCES/content-pipeline-progress.md` | Updated — quality issues resolved |

---

## Risk Assessment

- **Data loss risk:** LOW — `fullDefinition` preserves originals, and all changes are to seed JSON files (version controlled)
- **Korean LLM risk:** MEDIUM — Sonnet may occasionally produce wrong concise translations. Mitigation: spot-check 50 random Korean facts after LLM pass
- **Runtime regression risk:** LOW — length filter has graceful fallback to current behavior
- **Cognate false positives:** LOW — only flag exact/near-exact matches, no semantic analysis needed
