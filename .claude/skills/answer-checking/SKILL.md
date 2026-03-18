---
name: answer-checking
description: Live DB-first answer checking and fixing via directly spawned subscription workers (no API scripts). Writes/checks flags in the database and supports tagged-fact fix loops that clear flags when fixed.
---

# ⚠️ AR Phase Doc Required — see `.claude/skills/work-tracking/SKILL.md` for rules.

# answer-checking

> See `docs/RESEARCH/SOURCES/content-pipeline-spec.md` for the canonical pipeline spec.

## Mission
Run answer checks and fixes directly on the live facts database (not file-only artifacts), using directly spawned Codex/Claude subscription workers.

## Non-Negotiable Rule
- NEVER use any external model gateway or API script.
- NEVER use SDK-based direct model API calls.
- ALWAYS spawn workers directly from subscription models (Codex/Claude worker execution).
- Use **Sonnet workers** (`model: "sonnet"`) for all fact quality work: rewrites, distractor generation, category verification, question improvement.
- **No Haiku for any database content.** Use Sonnet for all quality work including heuristic checking. Haiku quality has been proven insufficient.
- Sonnet produces significantly better results for: preserving answer specificity, matching distractor format/length, foreign-language diacritics, and semantic coherence.

## Live DB Rule
- Default live DB path: `public/facts.db`
- Alternate server DB path (if needed): `server/data/facts.db`
- This skill writes flags directly into DB columns on `facts`:
  - `answer_check_issue`
  - `answer_check_needs_fix`
  - `answer_check_checked_at`
  - `answer_check_checked_by`
  - `answer_check_fixed_at`
  - `answer_check_fixed_by`

## End-to-End Worker Flow (DB-native)

### 1) Check 500 facts directly in live DB
```bash
npm run content:qa:answer-check:db -- check \
  --db public/facts.db \
  --checker gpt-5.1-mini \
  --status approved \
  --limit 500
```
Note: `--checker gpt-5.1-mini` is a label stored in the `answer_check_checked_by` DB column for auditing — it does NOT call any external API.

### 2) Export currently flagged DB rows for fix workers
```bash
npm run content:qa:answer-check:db -- export-flagged \
  --db public/facts.db \
  --status approved \
  --limit 500 \
  --output data/generated/qa-reports/answer-check-live-db/flagged.jsonl
```

### 3) Spawn workers to fix flagged rows
- Workers read `flagged.jsonl`
- Workers produce `reviewed/flagged-fixed.jsonl`
- Each row should include corrected fields and `answerCheckIssue`:
  - keep non-empty if still broken
  - set empty string when fixed

### 4) Apply fixes back into live DB and clear flags when fixed
```bash
npm run content:qa:answer-check:db -- apply-fixes \
  --db public/facts.db \
  --input data/generated/qa-reports/answer-check-live-db/reviewed/flagged-fixed.jsonl \
  --fixer sonnet-1
```
Note: `--fixer sonnet-1` is a label stored in the `answer_check_fixed_by` DB column for auditing — it does NOT call any external API.

### 5) Preview facts as the player sees them
```bash
npm run content:qa:answer-check:db -- preview \
  --db public/facts.db \
  --limit 20
```

Options:
- `--flagged-only` — show only flagged facts
- `--option-count 3` — simulate N answer options (default: 3)
- `--output path/to/preview.md` — write to file instead of stdout

### Distractor Quality Checks (automatic in `check`)
The `check` command now also validates distractors:
- Placeholder text (e.g., "Alternative option 3", "other meaning")
- Too few real distractors (need 3+ after filtering placeholders)
- Duplicate distractors
- Distractor identical to correct answer
- Empty/single-character distractors
- Scientific names as distractors when question asks for common name
- Variant-specific distractor issues
- **Format mismatch (vocab)**: Distractors must match correct answer's word count (±1) and character length (within 2x ratio). Catches "pick the longest option" exploits.
- **Semantic randomness (vocab)**: Distractors must be from the same semantic field as the correct answer, not random unrelated words.
- **Nonsense templates**: "Xing process", "Act of X", "To X" pattern distractors are auto-flagged.

### Question & Answer Quality Checks (automatic in `check`)
The `check` command also validates question and answer quality:
- **Templated vocab prompt**: "What is the X word for Y?" pattern questions — rewrite more naturally
- **Low-context vocab prompt**: "What does X mean?" with no usage context — add part of speech, example, or semantic hint
- **Vague vocab question**: literally "What does this mean?" with no foreign word shown — the word MUST appear in the question
- **Question too short**: knowledge facts with <15 word questions that lack sufficient context
- **Severe distractor length spread**: max/min character length ratio ≥3.5x AND absolute delta ≥18 chars
- **Truncated answer**: answer ends with "..." — complete from statement/explanation or shorten to complete phrase
- **Answer appears directly in question**: answer text found verbatim in question (normalized, ≥5 chars)
- **Question expects numeric/date answer**: "how many/what year/when" but answer is non-numeric text

### Category & Subcategory Checks
- **Miscategorized fact**: category_l1 does not match the fact's actual domain (e.g., war history fact in Art & Architecture)
- **Invalid subcategory**: category_l2 is not a valid ID from the domain's taxonomy in `subcategory-taxonomy.mjs`
- **Geography protection**: facts must NOT be moved in/out of the geography domain, and `capitals_countries` subcategory must not be changed (breaks geography_drill deck routing)

## Validation Gates Reference (11 Automated Checks)

These gates apply to ALL facts entering or being fixed in the database:

| # | Gate | Rule | Action |
|---|------|------|--------|
| 1 | Answer length | `len(answer) ≤ 30 chars` | Hard reject |
| 2 | Schema validation | JSON validates against full 28-field schema | Hard reject |
| 3 | Source attribution | `sourceName` is not null/empty | Hard reject |
| 4 | Variant count | `variants.length ≥ 4` | Hard reject |
| 5 | Circular detection | Jaccard(question, answer) > 0.5 | Reject |
| 6 | Duplicate detection | Embedding cosine sim > 0.92 vs existing | Reject |
| 7 | Classification filter | Regex: `"What (type\|kind\|category) of.*is"` | Reject |
| 8 | Entity validation | Entity name vs Wikidata label fuzzy ≥ 0.85 | Reject |
| 9 | Distractor quality | All distractors ≠ answer, same type, similar length | Reject variant |
| 10 | Fun score distribution | Per-batch std_dev < 1.5 OR >30% cluster | Flag batch |
| 11 | Age rating consistency | Content keyword scan matches declared rating | Flag for review |

**28 required schema fields:** `id`, `type`, `domain`, `subdomain`, `categoryL1`, `categoryL2`, `categoryL3`, `statement`, `quizQuestion`, `correctAnswer`, `distractors`, `acceptableAnswers`, `explanation`, `wowFactor`, `visualDescription`, `variants`, `difficulty`, `funScore`, `noveltyScore`, `ageRating`, `rarity`, `sourceName`, `sourceUrl`, `contentVolatility`, `sensitivityLevel`, `sensitivityNote`, `tags`, `_haikuProcessed`, `_haikuProcessedAt`.

## Tagged Fact Variants
Use `--tags` and `--tag-mode` with `check` or `export-flagged`.

Example:
```bash
npm run content:qa:answer-check:db -- check \
  --db public/facts.db \
  --checker haiku-1 \
  --tags needs_fix,biology \
  --tag-mode any \
  --limit 500
```

## Critical Distractor Generation Rule

**NEVER generate distractors from database pools.** Distractors must NEVER be pulled from `correct_answer` values of other facts in the same domain/subcategory. This produces semantically nonsensical garbage (e.g., biology answers contaminating chemistry questions, bird species names as distractors for bird behavior questions, random capitals for flag questions).

On March 12, 2026, we had to strip 58,359 garbage distractors that were generated this way.

**MANDATORY:** ALL distractors MUST be generated by a Sonnet sub-agent that:
- Reads the specific question and understands what's being asked
- Produces plausible wrong answers semantically coherent with the question
- Matches format and length of the correct answer
- Ensures answers are factually wrong but plausible to a student
- Draws from LLM world knowledge, NEVER from database queries

**ONLY permitted DB use:** POST-GENERATION VALIDATION — checking that a generated distractor doesn't accidentally match another fact's correct answer.

**PERMANENTLY BANNED:** Scripts like `mine-distractors.mjs` or any `SELECT correct_answer FROM facts WHERE category = ...` approach for distractor generation.

## Vocabulary Format-Matching Rules — MANDATORY
When checking or fixing vocabulary facts, enforce these format-matching rules to prevent pattern-matching exploits:

1. **Word count**: Each distractor word count must be within ±1 of the correct answer's word count
2. **Character length**: Each distractor must be within 0.5x-2.0x of the correct answer's character length
3. **Style consistency**: Comma-separated answers need comma-separated distractors; single words need single words
4. **Semantic relatedness**: Distractors must be plausible wrong translations from the same semantic field
5. **No nonsense**: Reject "Xing process", "Act of X", "library action" type generated garbage

These rules apply to ALL 8 languages: ja, ko, es, de, it, fr, nl, cs.
Facts failing these checks should be flagged with `answer_check_issue: "format_mismatch_distractors"`.

Note: New vocabulary facts (post-rebuild) use runtime distractor selection and do NOT ship with pre-generated distractors. These format-matching rules apply only to legacy vocab facts or knowledge fact distractors.

## Vocab Answer Length Normalization (AR-45)

Vocabulary answers had wildly inconsistent lengths (4 chars vs. 127 chars), creating length-mismatch exploits where players could guess by character count alone. This was fixed in AR-45.

**Rules enforced:**
- All vocabulary answers should be in 6-18 character range (p99 <50 chars)
- Answers >50 chars must be truncated to core meaning
- Runtime distractor selection in `vocabDistractorService.ts` enforces length-matching
- When fixing vocab facts, ensure answer length is normalized BEFORE generating/checking distractors

## Domain Canonicalization (AR-48)

All domain names must use canonical IDs from `src/data/domainMetadata.ts`. Non-canonical names found in the March 2026 audit:
- "Physics" → `natural_sciences`
- "Animals & Wildlife" display name used as ID → `animals_wildlife`
- 189 facts had non-canonical domain names

**When fixing facts:** Always verify `categoryL1` matches canonical domain IDs. Use `normalizeFactDomain()` from `src/data/card-types.ts` as reference.

## Notes
- `check` updates DB flags immediately.
- `export-flagged` reads DB flags and creates worker-fix payloads.
- `apply-fixes` writes corrections to DB and clears `answer_check_issue`/`answer_check_needs_fix` when fixed.

## Full-Database Quality Sweep

For comprehensive review of ALL facts (not just flagged), use the quality sweep script:

### 1) Export all rows as domain-grouped batches
```bash
node scripts/content-pipeline/qa/quality-sweep-db.mjs export \
  --db public/facts.db \
  --output-dir data/generated/quality-sweep/batches/
```

### 2) Process batches via Sonnet workers
The orchestrator reads pending batches from the manifest, spawns Sonnet sub-agents (`model: "sonnet"`), and writes validated results. Batches are grouped by domain/language for optimal prompt context.

- Vocab batches: 100 rows each (simpler content)
- Knowledge batches: 50 rows each (complex content + category verification)
- ~574 total batches, resumable via `data/generated/quality-sweep/manifest.json`

### 3) Apply validated results to DB
```bash
node scripts/content-pipeline/qa/quality-sweep-db.mjs apply \
  --db public/facts.db \
  --input-dir data/generated/quality-sweep/results/
```

### 4) Verify convergence
```bash
node scripts/content-pipeline/qa/quality-sweep-db.mjs verify \
  --db public/facts.db
```

### What the sweep fixes per row
- **quizQuestion**: templated, vague, low-context, too-short, answer-in-question
- **correctAnswer**: truncated, self-referencing, broken
- **distractors**: length spread, duplicates, empties, placeholders, semantic mismatches, format mismatches
- **explanation**: broken or truncated
- **category_l1**: verify correct domain assignment
- **category_l2**: verify valid subcategory from domain taxonomy

## Canonical References & Lessons Learned

- **Pipeline spec:** `docs/RESEARCH/SOURCES/content-pipeline-spec.md`
- **AR-45:** Vocab answer length normalization — prevents length-matching exploits
- **AR-48:** Domain canonicalization — 189 facts had non-canonical domain names
- **AR-51:** Pre-ingestion quality gate — 8.2% failure rate found in full DB scan
- **AR-52:** Distractor backlog cleanup — 76 knowledge + 8,992 vocab facts fixed
- **AR-53:** Fact repetition & FSRS audit — pool size 120→200, cooldown min 3→5
- **March 12, 2026:** 58,359 garbage distractors stripped (database pool generation)
- **March 15-16, 2026:** Quality gate + backlog cleanup completed
