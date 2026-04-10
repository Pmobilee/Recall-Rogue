# Deck Quality & Verification Rules

## Deck Quality Checklist
- Answer pools ≥5 per question (runtime floor), ≥15 recommended for distractor variety
- Pools with 5-14 members: add syntheticDistractors to reach 15+
- Chain themes ≥8 per knowledge deck, ≥3 themes selected per run
- Total facts ≥30-50 per deck
- Synonyms computed
- No duplicate questions (image_question facts excluded — image differentiates them)
- funScore and difficulty assigned
- No ambiguous answers
- `answerTypePools` uses `factIds` array — NEVER `members`, `facts`, or `items`
- Every fact's `answerTypePoolId` references an existing pool in the deck
- Pool `id` fields match what facts reference — no naming mismatches
- Image-based facts (`imageAssetPath`) must have `quizMode: "image_question"` or `"image_answers"`
- Fill-in-blank `{___}` in quizQuestion is valid grammar syntax, not a braces error
- Pool `factIds` populated by scanning facts, never hand-crafted
- Pool answer length homogeneity: max/min ratio < 3× within each pool (check #20)
- NEVER use em-dashes (—) in `correctAnswer` — explanation text goes in `explanation` field
- Answers must be concise: core answer only, no parenthetical elaborations
- No compound questions asking two things with one answer — split into two facts
- Answer must not appear verbatim in question stem (self-answering)
- Question type keywords must match answer format (who→name, when→date, how many→number)
- No duplicate or near-duplicate facts within the same pool
- Image-quiz facts MUST be in separate `visual_*` pools — never mixed with text facts

## Answer Pool Homogeneity — CRITICAL

**Pools shared by questionTemplates MUST only contain facts that make sense for ALL templates using that pool.**

- If a pool is used by a `questionTemplate`, every fact must have the fields the template's placeholders reference
- Split broad pools into domain-specific sub-pools when templates reference domain-specific placeholders
- `correctAnswer` format must be consistent within a pool (no mixing single names with comma-separated lists)

## Pool Design Rules — MANDATORY

**Every answer pool must contain facts of ONE semantic answer type.**

- **Semantic homogeneity test:** "Can every pool member serve as a plausible distractor for every other member's question?" If not, split.
- **Never mix:** dates with counts, names with descriptions, measurements with events
- **Format consistency:** All answers in a pool must be the same grammatical/syntactic form
- **Minimum 5 real facts** per non-bracket pool. If splitting would produce <5, merge into parent pool.
- **Pad to 15+** with domain-appropriate `syntheticDistractors` after splitting
- **`homogeneityExempt: true`** only for inherently variable pools. Always add `homogeneityExemptNote`.

**Common split patterns:**
- `person_names` → `person_inventor_names` + `person_politician_names` + `person_scientist_names`
- `term_definitions` → `short_terms` (≤20c) + `long_definitions` (>20c)
- `number` → `count_values` + `percentage_values` + `year_values`

**Kanji pools require kanji templates:** If a deck defines kanji-specific pools (`kanji_meanings`, `kanji_onyomi`, `kanji_kunyomi`, `kanji_characters`), it MUST also have `questionTemplates` entries that target each pool. A pool with no referencing template is dead weight — facts assigned to it silently fall through to `_fallback` and the templating system has no effect. Run `audit-dump-samples.ts` and check for high `_fallback` percentages to detect this issue.

## Batch Deck Verification — MANDATORY

After modifying ANY curated deck:

```bash
node scripts/verify-all-decks.mjs           # Summary table (all decks)
node scripts/verify-all-decks.mjs --verbose  # Per-fact details on failures
```

22 checks per fact/deck. Target: **0 failures**. Warnings are informational.

## Trivia Bridge — MANDATORY (Knowledge Decks)

**Every knowledge deck MUST be bridged to the trivia database before committing.** Language/vocabulary decks are exempt.

After batch verification passes:
1. Add deck to `scripts/content-pipeline/bridge/deck-bridge-config.json`
2. Run `node scripts/content-pipeline/bridge/extract-trivia-from-decks.mjs` — verify 0 ID collisions
3. Commit updated `bridge-curated.json` and `bridge-manifest.json` alongside the deck

## Content Quality Limits

| Field | Warn | Fail | Notes |
|-------|------|------|-------|
| `correctAnswer` length | >60 chars | >100 chars | Strip `{N}` markers. Skip vocab |
| `quizQuestion` length | >300 chars | >400 chars | Skip vocab |
| `difficulty` | — | <1 or >5, or missing | Required |
| `funScore` | — | <1 or >10, or missing | Required |
| `explanation` length | <20 chars | empty/missing | Skip vocab for short warn |
| `explanation` content | duplicates question | — | Normalized comparison |

## In-Game Quiz Audit — MANDATORY

After EVERY deck creation or major modification, 20+ facts MUST be reviewed as they appear in-game (Q + 4 options). This catches: eliminatable distractors, length mismatch, ambiguous questions, pool contamination.

```bash
npm run audit:quiz-engine                          # All knowledge decks
npm run audit:quiz-engine -- --deck <id> --verbose  # Single deck, detail
npm run audit:quiz-engine -- --render --deck <id>   # Render for LLM review
```

24 checks (10 structural + 14 engine-enabled). Run `node scripts/quiz-audit.mjs --deck <id> --full` for structural-only.

## LLM Content Review — MANDATORY

**After structural checks AND engine audit pass, run LLM content review.** Programmatic checks catch FORMAT issues. LLM review catches SEMANTIC issues. Both required.

Generate rendered samples, then have LLM evaluate: question clarity, answer correctness, distractor plausibility, eliminatability, length tells, domain coherence, ambiguity.

Required: after initial assembly, after bulk modifications (10+ facts), after pool redesign, before production-ready status.

## Post-Assembly Quality Gate — MANDATORY (added 2026-04-08)

**After assembling ANY new deck, run this COMPLETE quality pipeline before committing:**

```bash
# Step 1: Structural validation (22 checks, 0 failures required)
node scripts/verify-all-decks.mjs

# Step 2: Quiz engine audit (simulates actual quiz play, 0 failures required)
node scripts/quiz-audit.mjs --full --deck <id>

# Step 3: Pool heterogeneity check (auto-fix length mismatches)
node scripts/fix-pool-heterogeneity.mjs --dry-run

# Step 4: Synthetic distractor padding (pad pools to 15+)
node scripts/add-synthetic-distractors.mjs --dry-run

# Step 5: Self-answering detection
node scripts/fix-self-answering.mjs --dry-run

# Step 6: Sub-deck population (verify all sub-decks have factIds)
node scripts/fix-empty-subdecks.mjs --dry-run

# Step 7: Rebuild curated DB
npm run build:curated
```

**If ANY step finds issues, fix them BEFORE committing. Never ship a deck with known quality issues.**

## 4 Deck Quality Anti-Patterns — Lessons from 2026-04-08 Audit

### Anti-Pattern 1: Empty Sub-Deck factIds
**What:** Sub-decks defined in deck JSON with `factIds: []` even though facts have valid `chainThemeId` values.
**Why it happens:** Sub-deck arrays are hand-crafted instead of programmatically populated from facts.
**Impact:** Chain/themed grouping system doesn't work — facts aren't associated with their sub-deck.
**Prevention:** ALWAYS populate factIds by scanning facts: `subDeck.factIds = facts.filter(f => f.chainThemeId === subDeck.chainThemeId).map(f => f.id)`. Run `node scripts/fix-empty-subdecks.mjs --dry-run` to catch any misses.
**Fix script:** `node scripts/fix-empty-subdecks.mjs`

### Anti-Pattern 2: Pool Length Heterogeneity (Length Tells)
**What:** Answer pools mix short answers (e.g., "ATP" 3ch) with long answers (e.g., "Aminoacyl-tRNA synthetase" 25ch). Quiz shows 1 short + 3 long options = correct answer is obvious from length alone.
**Why it happens:** Pools are designed by semantic category ("molecule_names") without considering answer length distribution.
**Impact:** 354 quiz audit failures. Players can guess correctly without reading the question.
**Prevention:** After defining pools, check answer length distribution. If max/min ratio > 3x, split into `{pool}_short` and `{pool}_long`. Common splits:
  - `molecule_names` → `molecule_abbreviations` (≤5ch: ATP, CDK, p53) + `molecule_full_names` (>5ch)
  - `term_definitions` → `term_short` (single words) + `term_descriptions` (phrases/sentences)
**Fix script:** `node scripts/fix-pool-heterogeneity.mjs`

### Anti-Pattern 3: Pools Without Synthetic Distractors
**What:** Pools with 5-14 real facts and no syntheticDistractors. Players see the same 4-5 wrong answers every time.
**Why it happens:** syntheticDistractors forgotten during assembly or considered optional.
**Impact:** Repetitive quiz experience, easy to memorize distractors instead of learning.
**Prevention:** EVERY pool must have `factIds.length + syntheticDistractors.length >= 15`. After assembly, run `node scripts/add-synthetic-distractors.mjs --dry-run` to find gaps.
**Fix script:** `node scripts/add-synthetic-distractors.mjs`

### Anti-Pattern 4: Self-Answering Questions
**What:** The correctAnswer (or a distinguishing word from it) appears in the quizQuestion stem. Two levels:
- **Verbatim:** full answer substring in question (>5 chars) — always a bug
- **Word-level:** a distinguishing answer word (≥4 chars, not a stopword, not a domain-frequent term) appears in the question — makes distractors eliminable

**Example (verbatim):** "What is the **deltoid** muscle that..." with answer "deltoid".
**Example (word-level):** "Who invented the **Scoville** scale?" with answer "Wilbur Scoville" — "scoville" leaks.
**NOT a leak:** "Which **valve** controls blood flow?" with answer "Tricuspid valve" — "valve" is a domain term (appears in 3+ facts), excluded by corpus-frequency filter.

**Why it happens:** Questions are written in a form that names the answer. Common in anatomy and terminology decks.
**Impact:** Questions are trivially easy — no knowledge required, just match the leaked word against distractors.
**Prevention:** `verify-all-decks.mjs` Check #22 detects both levels with corpus-frequency filtering (words appearing in 3+ facts as leaks are excluded as domain terms). After writing questions, run the check and fix any warnings.
**Fix script:** `node scripts/fix-self-answering.mjs`

### Anti-Pattern 5: Reverse Template POOL-CONTAM — never draw cross-language distractors

**Rule:** When a vocabulary deck defines a `reverse` template ("How do you say X in [language]?"), the distractor pool's facts must be displayed using the **target-language field** (`targetLanguageWord`), not the English-meaning field (`correctAnswer`). Distractors must be target-language words so that all options are in the same language as the correct answer.

**Why:** Without this, the correct answer is the ONLY target-language option — any player can identify it by visual script recognition without knowing any vocabulary. This was confirmed as a BLOCKER across ~25 language decks in the 2026-04-10 quiz audit (Pattern 3, `docs/reports/quiz-audit-2026-04-10.md`). korean_topik2 had 100% contamination (49/49 reverse rows).

**Engine behavior (as of 2026-04-10 fix):** `selectQuestionTemplate` now returns `distractorAnswerField: keyof DeckFact` alongside `answerPoolId`. For `reverse` templates this is `'targetLanguageWord'`; for `reading`/`reading_pinyin` it is `'reading'`; for all others it is `'correctAnswer'`. All template-aware callers pass this to `selectDistractors`. No deck JSON changes are needed — the mapping is resolved engine-side.

**How to apply:**
1. When defining a reverse template in a vocab deck, ensure the `target_language_words` pool exists and has the same `factIds` as `english_meanings`.
2. Verify that each fact has a non-empty `targetLanguageWord` field — if it is missing, `resolveDisplayAnswer` falls back to `correctAnswer` (English), producing cross-language contamination again.
3. Run `npm run audit:quiz-engine -- --deck <id>` after deck assembly — POOL-CONTAM on reverse rows indicates `targetLanguageWord` is missing or the pool is misconfigured.
4. For `reading_pinyin` / `reading` templates, same rule applies: ensure `fact.reading` is populated and a `readings` or `target_readings` pool exists.

### Anti-Pattern 6: definition_match self-answering via explanation

**Rule:** The `definition_match` template renders `fact.explanation` as the question stem (`questionFormat: '{explanation}'`). Wiktionary-sourced explanations follow the format "word — English meaning" (e.g., "abbaye — abbey."). If the explanation contains the correct answer, the quiz is trivially self-answering — the player reads the answer in the question and clicks it. The engine now auto-blocks this template when the explanation leaks the answer; deck authors should understand why it fires.

**Why:** Wiktionary's canonical explanation format names the word and its meaning in the same sentence. Up to 23% of mastery=4 questions in CEFR language decks were self-answering due to this leak (confirmed 2026-04-10 quiz audit, Pattern 4). The hit rate is highest in cognate-heavy decks (French, Czech) where the answer appears almost verbatim in the explanation.

**Engine behavior (as of 2026-04-10 fix):** `explanationLeaksAnswer(fact)` checks whether `fact.explanation` contains `fact.correctAnswer` as a whole word (word-boundary, case-insensitive). If true, any template with `{explanation}` in its `questionFormat` is removed from the eligible set for that fact. The selector falls through to `synonym_pick`, `forward`, `reverse`, or `_fallback`. No deck JSON changes are needed.

**How to apply:**
1. Vocabulary deck authors: explanations in Wiktionary format ("word — meaning") are fine — the engine handles them. No rewriting needed.
2. If authoring a custom explanation-based template that uses `{explanation}` in `questionFormat`, be aware that facts whose explanation contains the answer will never use it (they fall back). This is correct behavior.
3. When adding a NEW template type with `{explanation}`, no code changes are needed — the eligibility check gates on `questionFormat.includes('{explanation}')` generically.
4. If you observe unexpectedly low `definition_match` frequency in an audit dump, check the deck's explanation style. Wiktionary-format explanations will suppress it for cognates; non-leaking explanations ("a building for education") remain eligible.
5. Run `npm run audit:quiz-engine -- --deck <id>` after assembly. Zero SELF-ANSWERING findings at mastery=4 is the target.

### Anti-Pattern 7: `reading` template on already-phonetic words

**Rule:** Templates whose `id` matches `/^reading(_|$)/` (currently: `reading`, `reading_pinyin`, `reading_hiragana`) ask "What is the reading of 'X'?" and use `fact.reading` as the correct answer. This is only meaningful when the target word's written form *differs* from its reading. Katakana loanwords (e.g., スーパー, レコード, アプローチ) and hiragana-only words (e.g., しかしながら, はらはら) have `fact.reading === fact.targetLanguageWord` — both fields are the same phonetic string. The reading template then produces: "What is the reading of 'スーパー'?" → correct answer: "スーパー". The answer is present in the question.

**Why:** JLPT decks contain a large proportion of katakana loanwords (especially N4/N5) whose reading is identical to their written form. The 2026-04-10 quiz audit (Patterns 5 & 12) identified this as a BLOCKER. Confirmed cases: `japanese_n5` (レコード), `japanese_n4` (スーパー), `japanese_n1` (しかしながら, はらはら, アプローチ).

**Engine behavior (as of 2026-04-10 fix):** `readingMatchesTargetWord(fact)` checks whether `normalize(fact.reading) === normalize(fact.targetLanguageWord)`. If true, any template whose `id` matches `/^reading(_|$)/` is removed from the eligible set for that fact. The constant `READING_TEMPLATE_PATTERN` in `questionTemplateSelector.ts` covers all current reading template ID variants. Returns `false` if either field is absent — facts without `reading` or `targetLanguageWord` are never blocked. No deck JSON changes are needed.

**How to apply:**
1. Vocabulary deck authors: no action required. The engine suppresses reading templates automatically for phonetic-form words.
2. When authoring a new reading-type template (id starting with `reading_`), the block is automatic. No engine code changes needed.
3. If you observe that a reading template is never selected for a given fact, verify whether `fact.reading === fact.targetLanguageWord`. If so, the suppression is intentional.
4. For Chinese (Mandarin) pinyin templates (`reading_pinyin`), the same rule applies — hanzi words have different pinyin readings; pinyin-only entries (rare) would be blocked.

### Anti-Pattern 8: Numeric distractors outside the answer domain

**Rule:** Numeric distractors generated by `getNumericalDistractors()` MUST stay within the semantic domain of the correct answer. Percentages must be in `[0, 100]`. Years must be in a plausible historical range. Counts must be non-negative integers. Measurements must be positive. Producing a 138% distractor for a "what fraction of solar system mass" question is a BLOCKER — players eliminate it instantly without any knowledge.

**Why:** The 2026-04-10 quiz audit found `solar_system_sun_mass_percentage` (correctAnswer `{99.86}`) producing distractors `138.52`, `120.24`, `79.89` — two of three exceed 100, impossible for a percentage. Similar issues seen in AP physics / chem decks where numeric variants ignored unit constraints.

**Engine behavior (as of 2026-04-10 fix):** `detectAnswerDomain(correctAnswerStr, questionText)` in `numericalDistractorService.ts` returns `{kind: 'percentage' | 'year' | 'count' | 'measurement' | 'unknown', clamp: {min, max} | null}`. Detection signals: trailing `%` on the answer, the words "percent"/"percentage" in the question, 4-digit year shape (1000–2100), "how many" / "how much" / "count" in the question, unit suffixes (km, kg, etc.). `getNumericalDistractors()` accepts an optional `questionText` parameter (defaults to `fact.quizQuestion`) and applies the domain clamp via `applyClamp()` to every candidate variant. Out-of-range candidates are rejected and the seeded PRNG re-rolls.

**How to apply:**
1. Deck authors using `{N}` bracket numerical answers: phrase the question with a domain hint ("how many...", "what percentage of...", "in what year...") so the detector can clamp correctly.
2. If your fact has a unit-bound answer (e.g., `{384400} km`), include the unit in the answer string — the detector recognizes common units.
3. If you observe a numeric distractor that exceeds the domain (e.g. 138% for a percentage question), check whether the question text contains the domain keyword. If not, rephrase the question to include it.
4. Edge case: ratios that legitimately exceed 1.0 (e.g., "ratio of A to B = 2.4") are NOT percentages — the detector requires `%` or "percent"/"percentage" wording. Bare decimals fall through to the unknown domain (no clamp).
5. Run `npm run audit:quiz-engine -- --deck <id>` after assembly — zero NUMERIC-WEAK findings is the target.
