---
paths:
  - "data/decks/**"
  - "data/deck-architectures/**"
  - "scripts/content-pipeline/**"
  - "scripts/verify-all-decks.mjs"
  - "scripts/quiz-audit*.*"
  - "scripts/audit-dump-samples.ts"
  - "scripts/fix-*.mjs"
  - "scripts/fix-*.ts"
---

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
- Pool answer length homogeneity: max/min ratio < 3× within each pool (Check #20)
- Semantic category homogeneity: no cross-category contamination — names with descriptions, consoles with streaming services, hardware with trivia (Check #26 warns; manual review required)
- NEVER use em-dashes (—) in `correctAnswer` — explanation text goes in `explanation` field
- Answers must be concise: core answer only, no parenthetical elaborations
- No compound questions asking two things with one answer — split into two facts
- Answer must not appear verbatim in question stem (self-answering)
- Question type keywords must match answer format (who→name, when→date, how many→number)
- No duplicate or near-duplicate facts within the same pool
- Image-quiz facts MUST be in separate `visual_*` pools — never mixed with text facts
- No raw brace characters in `syntheticDistractors` — bracket-notation tokens like `{7}` or `{1990}` must never appear in distractor arrays (verify-all-decks Check #24 catches this with HARD FAIL — 2026-04-10)

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
- `platform_console_names` (game consoles + streaming services) → `console_platform_names` + `streaming_social_platform_names` (2026-04-10: Netflix answer appeared in same pool as Game Boy, PlayStation 2 — streaming services are NOT game consoles)
- `invention_details_long` (inventor names + descriptions + dates) → `inventor_pair_names` + `invention_details_long` (2026-04-10: barcode patent "Who?" question was in same pool as descriptions like "Intake, Compression, Power/Combustion, Exhaust" — names and descriptions have different grammatical form)
- `genre_format_names` (hardware innovations + comic issues + formats + trivia) → `game_innovations` + `comic_debut_issues` + `media_format_names` + remaining (2026-04-10: N64 "analog stick" answer was in same pool as "King of Comics" and "$15 billion+" — semantic categories were completely unrelated)

**Semantic homogeneity self-review — MANDATORY before marking a deck done:**
After defining pools, for each pool ask: "If I showed a player the 4 quiz options for question X, could they eliminate wrong answers just by category?" If yes, the pool is contaminated.
- Barcode test: "Who patented barcode?" options = ["Norman Woodland & Silver", "Intake, Compression, Power, Exhaust", "Wing-warping (roll), front elevator (pitch), rudder (yaw)", "Mulberry fibers, fishnets, old rags"] → FAIL — descriptions eliminate themselves
- Netflix test: "Which streaming service?" options = ["Netflix", "Game Boy", "Nintendo Switch", "Sega Genesis"] → FAIL — consoles are obviously not streaming services
- N64 test: "What innovation did N64 controller include?" options = ["analog stick", "King of Comics", "$15 billion+", "San Diego"] → FAIL — categories mixed

**Kanji pools require kanji templates:** If a deck defines kanji-specific pools (`kanji_meanings`, `kanji_onyomi`, `kanji_kunyomi`, `kanji_characters`), it MUST also have `questionTemplates` entries that target each pool. A pool with no referencing template is dead weight — facts assigned to it silently fall through to `_fallback` and the templating system has no effect. Run `audit-dump-samples.ts` and check for high `_fallback` percentages to detect this issue.

## Batch Deck Verification — MANDATORY

After modifying ANY curated deck:

```bash
node scripts/verify-all-decks.mjs           # Summary table (all decks)
node scripts/verify-all-decks.mjs --verbose  # Per-fact details on failures
```

26 checks per fact/deck. Target: **0 failures**. Warnings are informational. (Check #24: brace-leak; Check #25: grammar-scar catalog; Check #26: semantic-category heuristics) Stamping is opt-in via `--stamp-registry`; a plain verify run no longer updates the registry (2026-04-10).

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

After EVERY deck creation, re-check, or major modification, **50 facts MUST be sampled and read back** as they appear in-game (Q + 4 options). This catches: eliminatable distractors, length mismatch, ambiguous questions, pool contamination, grammar scars, placeholder leaks, and content the structural verifier can't detect.

### 50-Fact Sampling Protocol (updated 2026-04-10)

The 50 samples MUST be distributed across varied difficulty levels and sub-decks to surface problems that cluster by topic or difficulty:

1. **Stratify by `difficulty`** — if the deck has difficulty 1-5, draw ~10 facts per level. If the deck has fewer distinct levels, draw proportionally.
2. **Stratify by `subDeckId` / `chainThemeId`** — ensure every sub-deck is represented. Small sub-decks get at least 2 samples; large ones get proportional coverage.
3. **Stratify by `answerTypePoolId`** — include facts from every pool that has ≥3 members. This surfaces pool-specific contamination (length-tells, cross-category distractors).
4. **Random within strata** — don't take the first N from each bucket; use a seeded random draw so re-runs are reproducible.
5. **Read every sampled fact fully** — question + correctAnswer + rendered distractors + explanation. Grep for known scar patterns (`\bthe this\b`, `\ba this\b`, `\b[adjective] this\b`) and obvious placeholder leaks.

Why 50 (not 20 or 10): the 2026-04-10 re-check sweep found 3 placeholder leaks in decks that had previously passed 20-fact samples, because the scars clustered in obscure sub-decks (hundred-handers, stymphalian birds, bomber crews) that a 20-sample draw did not reach. The 10-sample shortcut is only acceptable for smoke-checking after a narrowly-scoped fix (e.g. "verify the 3 facts I just changed").

```bash
# Knowledge decks — full deck or per-pool sample
npm run audit:quiz-engine                                     # All knowledge decks
npm run audit:quiz-engine -- --deck <id> --verbose            # Single deck, detail
npm run audit:quiz-engine -- --render --deck <id>             # Render for LLM review

# Canonical 50-fact protocol — use --stratified for vocab AND knowledge decks
npx tsx --tsconfig tests/playtest/headless/tsconfig.json scripts/quiz-audit-engine.ts --deck <id> --stratified 50
npx tsx --tsconfig tests/playtest/headless/tsconfig.json scripts/quiz-audit-engine.ts --deck <id> --stratified 50 --include-vocab
```

> **`scripts/quiz-audit-engine.ts` supports `--stamp-registry` for single-deck audits (requires `--deck`).** When the audit completes with 0 failures and `--deck <id>` is specified, the engine stamps `lastQuizAudit` in the inspection registry via `scripts/registry/updater.ts`. Multi-deck fleet sweeps (no `--deck`) print a skip notice and leave stamping to `scripts/quiz-audit.mjs --stamp-registry`, which handles the fleet case. (See `docs/gotchas.md` 2026-04-11 for the history of this flag.)

**`--stratified 50` is the canonical command for meeting the 50-fact protocol.** It replaces manual per-pool sampling by distributing the budget across the cross-product of `(difficulty × chainThemeId × answerTypePoolId)`. Every sub-group of the deck gets proportional representation. This is especially critical for vocab decks where `--sample 5` was producing only 15 total checks (5 facts × 3 mastery levels) because the deck has a single mega-pool.

Use `--sample N` only for quick smoke-checks on narrowly-scoped fixes to specific pools.

24 checks (10 structural + 14 engine-enabled). Run `node scripts/quiz-audit.mjs --deck <id> --full` for structural-only.

**Audit engine false-positive guards (as of 2026-04-10):** Three check types have explicit suppression logic to avoid noise:

- **Check 4 (`length_mismatch`)**: Skipped entirely for vocab decks (`classifyDeck === 'vocab'`). Japanese/Korean/Chinese/French/etc. words naturally vary in character length (kanji 1–4 chars, kana 2–10, loanwords longer). The real game engine uses confusion-matrix scoring, not length matching. Non-vocab decks (medical, history, AP subjects) retain the check.
- **Check 26 (`distractor_format_inconsistency`)**: Skipped when BOTH correct answer and distractor look like math/physics formulas (new `looksLikeFormula()` helper). Formulas differ in format features (capitalization, word count) by nature. Only skips formula-vs-formula pairs; mixed formula/prose pairs still fire as genuine issues. Additionally, capitalization is treated as a **single categorical axis** (Phase-3 fix, 2026-04-10): the two old boolean fields `startsCapital` + `isAllLower` are replaced by one `capitalizationStyle` field (`'capitalized' | 'lowercase' | 'mixed' | 'numeric'`). This eliminates the double-count false-positive where "Bones" vs "ufotable" (same semantic pool, different brand-name casing) tripped the ≥2 diff threshold. The threshold itself stays at ≥2 — only the counting axis is fixed. Real cross-format pool contamination (e.g. single-word name vs multi-word phrase that also differs in cap style) still fires because at least two distinct axes (cap style + isMultiWord) differ.
- **Check 28 (`reverse_distractor_language_mismatch`)**: `hasCJK()` regex covers all Japanese script ranges: hiragana (U+3040-309F), katakana (U+30A0-30FF), kanji (U+4E00-9FFF), Hangul (U+AC00-D7AF), and fullwidth/halfwidth forms (U+FF00-FFEF). This prevents fullwidth-ASCII loanwords like ＦＡＸ, ＯＵＴ from being misclassified as non-Japanese.

## LLM Content Review — MANDATORY

**After structural checks AND engine audit pass, run LLM content review.** Programmatic checks catch FORMAT issues. LLM review catches SEMANTIC issues. Both required.

Generate rendered samples, then have LLM evaluate: question clarity, answer correctness, distractor plausibility, eliminatability, length tells, domain coherence, ambiguity.

Required: after initial assembly, after bulk modifications (10+ facts), after pool redesign, before production-ready status.

## Post-Assembly Quality Gate — MANDATORY (added 2026-04-08)

**After assembling ANY new deck, run this COMPLETE quality pipeline before committing:**

```bash
# Step 1: Structural validation (26 checks, 0 failures required)
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

## 12 Deck Quality Anti-Patterns — Lessons from 2026-04-08 and 2026-04-10 Audits

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

### Anti-Pattern 9: Mega-pool POOL-CONTAM (>100 facts in one pool)

**Rule:** Any pool with more than 100 real facts is a mega-pool and a strong POOL-CONTAM source. Distractors drawn from such a pool cross topic/unit/period boundaries freely, letting players eliminate options by sub-field rather than by knowledge of the correct answer. **Split mega-pools by exam unit (for AP/IB/JLPT/HSK), time period (for history), or topic axis (for general knowledge).**

**Why:** The 2026-04-10 quiz audit (Pattern 2) found that all 7 AP decks shipped with one or two catch-all "concept" pools spanning the entire CED scope. Examples: `ap_biology.term_definitions_long` (214 facts across all 8 units), `ap_world_history.concept_terms` (297 facts across 9 units), `ap_us_history.concept_terms` (142 facts across 9 periods). A Unit 1 question could draw distractors from Unit 8, making sub-field elimination trivial. The same pattern appears in `ancient_greece.historical_phrases_long` (87), `ancient_rome.historical_phrases` (80), and `world_war_ii.historical_events` (167). The fix landed 2026-04-10: 9 mega-pools were split into 56 unit-coherent sub-pools, reassigning 1,523 fact references.

**How to apply:**
1. **For AP / standardized-exam decks:** split by `examTags.unit` (or `Period_N` for AP US History). Use the helper script pattern: group facts by unit, create one sub-pool per unit named `<old_id>_u<N>`, merge units with <5 facts into the nearest viable bucket, point each fact's `answerTypePoolId` at its new sub-pool, remove the original mega-pool.
2. **For history / general knowledge decks** without exam tags: split by century, region, or topical axis. Pick whichever produces the most semantically coherent buckets.
3. **Minimum sub-pool size:** ≥5 real facts. Pad to ≥15 total with `syntheticDistractors`.
4. **Verify after the split:** every fact's `answerTypePoolId` must reference an existing pool (no orphans). Run `node scripts/verify-all-decks.mjs` and re-run `audit-dump-samples.ts --deck <id>` to confirm POOL-CONTAM rate drops.
5. **Detection:** `verify-all-decks.mjs` should warn whenever a knowledge-deck pool has >100 real facts. (Future Phase 5 task.)
6. **Exception:** language-vocab pools with thousands of words are intentional — POS-separated pools are the right fix there (Anti-Pattern 5 / Anti-Pattern 6 territory), not unit-splitting.
7. **For medical/science decks with root word pools:** split by body system. `medical_terminology` had a `root_meanings_mid` pool (138 facts) with roots spanning cardiovascular, respiratory, digestive, nervous, musculoskeletal, integumentary, reproductive, urinary, sensory, and general domains — causing cardiovascular terms ("Vein", "Clot") to appear as distractors for respiratory questions. Split into 10 sub-pools named `root_meanings_{system}` (e.g. `root_meanings_cardiovascular`, `root_meanings_nervous`). 2026-04-10.

### Anti-Pattern 10: Mixed-POS vocabulary pools

**Rule:** Vocabulary deck `english_meanings` pools (and any pool used by a forward/reverse template for vocab facts) MUST be split by `partOfSpeech` before deployment. A pool mixing verbs ("to swim"), nouns ("table"), adjectives ("empty"), and adverbs ("quickly") lets players eliminate distractors by part-of-speech recognition without any vocabulary knowledge (POS-TELL).

**Why:** At mastery=0 (3-option quizzes), when a question asks the meaning of a verb but one distractor is a noun, the answer is narrowed to 2 choices without knowing the word. Confirmed across 14 Spanish, French, and German vocabulary decks (2026-04-10 audit, Pattern #6). 15,947 facts were reassigned.

**How to apply:**
1. After assembling a vocabulary deck, inspect the `english_meanings` pool's `factIds`. Check the `partOfSpeech` field distribution.
2. Pre-validate POS tags BEFORE splitting: look for facts tagged "verb" whose `correctAnswer` has no "to " prefix — they may be nouns or adjectives. Common Spanish errors: `difunto` ("deceased"), `pendiente` ("pending") were both tagged "verb" but are adjectives.
3. Split into up to 5 sub-pools: `_verbs`, `_nouns`, `_adjectives`, `_adverbs`, `_other`. Sub-pools with <5 real facts merge into `_nouns` (or the largest available).
4. Pad each sub-pool to 15+ total (factIds + syntheticDistractors) with POS-appropriate wrong answers: verbs → "to swim", "to refuse", ...; nouns → "table", "decision", ...; adjectives → "empty", "rapid", ...; adverbs → "quickly", "rarely", ...
5. Update each fact's `answerTypePoolId` to its new POS-specific pool ID.
6. Remove the original `english_meanings` pool.
7. **CRITICAL:** In the POS routing function, check `adverb` BEFORE `verb` — `'verb' in 'adverb'` is `True` in Python, so naive ordering routes adverbs into the verbs pool.
8. Run `node scripts/verify-all-decks.mjs` — 0 failures required.

### Anti-Pattern 11: Numeric facts in non-numeric pools

**Rule:** Any fact whose `correctAnswer` is a bare number (integer, count, or percentage without additional text) MUST be placed in a `bracket_numbers` pool, NOT in name or label pools.

**Why:** The 2026-04-10 audit found `myth_norse_sleipnir_legs` (answer "8") in `object_names` and `nasa_moonwalkers_total` (answer "12") in `launch_years`. At mastery 4, "8" appeared as a distractor for "What object did Thrym place on Freyja's lap?" — trivially eliminable because a bare number is not an object name. Similarly, duration answers ("Approximately six months") must not live in device-name pools.

**How to apply:**
1. After any pool design, grep for facts whose `correctAnswer` matches `^\d+$` or is a bare number string. Confirm they're in a `bracket_numbers` pool.
2. Duration strings ("X weeks", "X months", "X years") belong in a `duration_answers` pool with duration-shaped synthetics.
3. Percentage values ("75%", "~45%") belong in a `percentage_values` pool, not in year or count pools.
4. Run `verify-all-decks.mjs` — homogeneity check #20 will flag pools mixing 1-digit numbers with multi-word names.

### Anti-Pattern 12: Knowledge decks without chainThemes or subDecks

**Rule:** Every knowledge deck (non-vocabulary, non-grammar) MUST satisfy at least one of the following before deployment:
- A populated `chainThemes` array with ≥3 entries (classic authoring approach — preferred for NEW decks without a natural sub-deck structure), OR
- A populated `subDecks` array where each sub-deck has a non-empty `factIds` list.

`chainThemes` remains the recommended approach for new decks because it allows rich theme labeling and explicit `chainThemeId` mapping. However, decks that already have a well-structured `subDecks` array do NOT need `chainThemes` — `src/services/chainDistribution.ts` Priority-1 fallback uses `deck.subDecks` directly as TopicGroups, which provides the same runtime chain grouping experience. As of 2026-04-10, 22 of 24 decks previously flagged `empty_chain_themes_runtime` have populated `subDecks` and work correctly without `chainThemes`.

The audit checks (`scripts/quiz-audit-engine.ts` check 34 and `scripts/verify-all-decks.mjs` check #24) now only warn when BOTH `chainThemes` and `subDecks` are absent. Two decks that lack both (`world_capitals`, `world_countries`) are the genuine cases to address.

**Why:** The 2026-04-10 audit found 8+ knowledge decks with `chainThemes: []` despite having sub-decks with `chainThemeId` values on facts. Without `chainThemes`, the Study Temple chain mechanic has no theme definitions — the chain system falls back and players never experience the knowledge chain progression mechanic. Confirmed across `ancient_greece`, `ancient_rome`, `world_war_ii`, `greek_mythology`, `norse_mythology`, `egyptian_mythology`, `mammals_world`, `dinosaurs`, `medieval_world`.

**How to apply:**
1. **New deck with sub-decks that already exist:** populate `factIds` on each sub-deck entry (run `node scripts/fix-empty-subdecks.mjs`). You do NOT need to add `chainThemes` separately — the Priority-1 fallback handles runtime grouping.
2. **New deck without natural sub-decks:** define `chainThemes` with ≥3 entries in the same authoring pass. Derive themes from topical clusters. Assign `chainThemeId` on each sub-deck object.
3. Verify that the deck satisfies at least one path: `jq '.subDecks | length' data/decks/<name>.json` ≥1 OR `jq '.chainThemes | length' data/decks/<name>.json` ≥3.
4. Facts already carry `chainThemeId` via their sub-deck membership; the `chainThemes` array is the lookup table that makes those IDs meaningful at runtime when the `chainThemes` path is chosen.

### Anti-Pattern 13: Cross-Category Pool Contamination
**What:** Facts from completely different semantic categories placed in the same answer pool. Players can instantly eliminate wrong answers not because they know the answer, but because the distractors are from a different *type* of thing.
**Why it happens:** Pool names are too broad ("invention_details_long", "genre_format_names", "platform_console_names") and any fact vaguely matching the broad name gets added without checking semantic compatibility with existing pool members.
**Impact:** Quiz becomes trivially easy — "analog stick" is obviously not "King of Comics" or "$15 billion+". The educational value is zero because no knowledge is required to eliminate distractors.
**Examples (2026-04-10):**
- `inv_3_barcode_patent` ("Who patented barcode?") in pool with descriptions like "Intake, Compression, Power/Combustion, Exhaust" → name questions and description answers are always eliminable from each other
- `pc_5_netflix_platform` ("Which streaming service?") in pool with game consoles like "Game Boy", "PlayStation 2" → consoles are obviously not streaming services
- `pc_1_n64_innovation` ("What did N64 controller include?") in pool with "King of Comics", "$15 billion+" → hardware innovation not in same category as nickname or market size
**Prevention:** After defining every pool, apply the semantic homogeneity test: "Would a student with NO knowledge of the subject still be able to eliminate some distractors purely by category type?" If yes, split the pool. Check #33 in `verify-all-decks.mjs` provides digit-pattern and ALL-CAPS heuristics as signals.
**Fix script:** `node scripts/fix-pool-heterogeneity.mjs` (splits on length ratio); manual semantic splits required for cross-category contamination

### Anti-Pattern 14: Kanji reading facts must store kana in correctAnswer

**Rule:** Facts in `kanji_onyomi` and `kanji_kunyomi` pools MUST store the kana reading in `correctAnswer` (e.g., "ニチ", "くに"), NOT the kanji character (e.g., "日", "国"). The kanji character belongs only in `targetLanguageWord`. The `reading` field and `correctAnswer` must be identical for these facts.

**Why:** The game engine's `getDistractorAnswerFieldForTemplate()` returns `'reading'` for `kanji_onyomi`/`kanji_kunyomi` templates — distractors are drawn by comparing `fact.reading` across pool members. If `correctAnswer` holds the kanji character instead of kana, the displayed correct answer and all kana distractors are in different scripts, making the answer trivially identifiable. Additionally, `getCorrectAnswerForTemplate()` now explicitly routes these templates through `fact.reading`, so any `correctAnswer` divergence is caught at render time.

**Verification:** Run `node scripts/fix-kanji-correct-answer.mjs --deck <id> --dry-run` — it should report "No changes needed. Data is already correct." for all JLPT decks.

**Fix script:** `node scripts/fix-kanji-correct-answer.mjs --deck <id>` (applies `correctAnswer = reading` for all kanji_onyomi/kanji_kunyomi facts where they diverge)

**Audit engine note (quiz-audit-engine.ts Check 14):** The `template_rendering_fallback` check in the audit engine fires when a selected template renders to the same string as `fact.quizQuestion`. For kanji facts (whose quizQuestion was authored to match the template format), this was a false positive. Fixed 2026-04-10: Check 14 now verifies that at least one template placeholder resolved to an empty/missing value before firing. If all placeholders resolve to non-empty strings, the identical render is intentional and no warning is emitted.
