---
name: answer-checking
description: Live DB-first answer checking and fixing via directly spawned subscription workers (no API scripts). Writes/checks flags in the database and supports tagged-fact fix loops that clear flags when fixed.
---

# answer-checking

## Mission
Run answer checks and fixes directly on the live facts database (not file-only artifacts), using directly spawned Codex/Claude subscription workers.

## Non-Negotiable Rule
- NEVER use any external model gateway or API script.
- NEVER use SDK-based direct model API calls.
- ALWAYS spawn workers directly from subscription models (Codex/Claude worker execution).
- Use **Sonnet workers** (`model: "sonnet"`) for all fact quality work: rewrites, distractor generation, category verification, question improvement.
- Haiku workers (`model: "haiku"`) are acceptable ONLY for: simple heuristic checking, format validation, counting, and mechanical transforms.
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
  --fixer haiku-1
```

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

**MANDATORY:** ALL distractors MUST be generated by an LLM (GPT-5.2+ or Haiku agent) that:
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
