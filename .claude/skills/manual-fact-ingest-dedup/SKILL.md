# manual-fact-ingest-dedup

## Trigger Conditions
Use this skill when:
- Manually ingesting facts from JSON/JSONL files into the content pipeline
- Cleaning duplicates from existing generated or seed data
- Reviewing semantic overlap between fact datasets
- Merging curated facts into seed/generated datasets
- Auditing existing facts for near-duplicate content

## Overview
End-to-end pipeline for manual fact ingestion with schema validation, two-stage deduplication (exact + semantic with TF-IDF), CJK-aware scoring, persistent dedup index, interactive review UI, source-mix prep for generation workers, and safe merge workflow. All operations are non-destructive until explicit finalize step.

Local paid Anthropic API generation is intentionally disabled in this repo. Use external Claude subscription workers for live fact generation, then run ingestion/QA/promotion here.

## Commands

### Build Mixed Source Inputs (for generation workers)
```bash
npm run content:source-mix
# Writes data/raw/mixed/<domain>.json and source-mix report in data/generated/qa-reports/
```

```bash
# Custom run for selected domains only
node scripts/content-pipeline/manual-ingest/source-mix.mjs \
  --domains geography,history,space_astronomy \
  --output-dir data/raw/mixed \
  --report data/generated/qa-reports/source-mix-report.json
```

### Validate Input
```bash
node scripts/content-pipeline/manual-ingest/run.mjs validate \
  --input data/my-facts.json --domain geography
```

### Deduplicate (Dry Run)
```bash
node scripts/content-pipeline/manual-ingest/run.mjs dedup \
  --input data/my-facts.json --domain geography --dry-run
```

### Dedup with TF-IDF + Persistent Index
```bash
# Build index once (caches all existing facts)
node scripts/content-pipeline/manual-ingest/run.mjs build-index

# Run dedup using cached index (faster for repeated runs)
node scripts/content-pipeline/manual-ingest/run.mjs dedup \
  --input data/my-facts.json --domain geography --use-index --dry-run
```

### Interactive Review UI
```bash
node scripts/content-pipeline/manual-ingest/run.mjs review --port 3456
# Opens http://localhost:3456 — approve/reject ambiguous matches in browser
```

### Preview Merge
```bash
node scripts/content-pipeline/manual-ingest/run.mjs merge-preview \
  --input data/my-facts.json --domain geography
```

### Finalize Merge
```bash
node scripts/content-pipeline/manual-ingest/run.mjs finalize \
  --input data/my-facts.json --domain geography \
  --target data/generated/geography.jsonl
```

### Full Pipeline
```bash
node scripts/content-pipeline/manual-ingest/run.mjs full \
  --input data/my-facts.json --domain geography \
  --target data/generated/geography.jsonl
# Add --dry-run to skip finalize
```

### npm Script Aliases
```bash
npm run content:manual:validate -- --input <path> --domain <name>
npm run content:manual:dedup -- --input <path> --domain <name> --dry-run
npm run content:manual:preview -- --input <path> --domain <name>
npm run content:manual:finalize -- --input <path> --domain <name> --target <path>
npm run content:manual:full -- --input <path> --domain <name> --dry-run
npm run content:manual:review
npm run content:manual:build-index
npm run content:source-mix
npm run content:qa:gameplay -- --input data/generated --strict
npm run content:qa:gate -- --strict
```

## Dedup Pipeline

### Stage A — Cheap Candidate Generation
- Exact normalized keys (`statement::correctAnswer`)
- Character trigram blocking (shared trigram inverted index)
- CJK-aware: uses character bigrams for Japanese/Korean/Chinese text
- Domain blocking (optional, `--domain-blocking`)

### Stage B — Semantic Scoring
Multi-signal composite with TF-IDF enhancement:

| Signal | Weight | Description |
|--------|--------|-------------|
| Exact key | 1.0 (gate) | Normalized statement+answer — instant match |
| Trigram | 0.25 | Character trigram Jaccard (bigrams for CJK) |
| Keyword Jaccard | 0.30 | Significant token overlap (4+ chars, no stopwords) |
| Levenshtein | 0.20 | Character edit distance on quizQuestion |
| Answer | 0.15 | Levenshtein on correctAnswer (+ answer-match boost) |
| Statement | 0.10 | Keyword Jaccard on statement |
| TF-IDF | 0.30 blend | Corpus-aware cosine similarity (enabled by default) |

**Answer-match boost:** When answers are ≥90% similar AND questions share ≥30% overlap, score is boosted by 0.15–0.40. Captures "same answer = likely same question" signal.

**TF-IDF blending:** When enabled, final score = max(base_score, base_score × 0.70 + tfidf × 0.30). This lifts structurally similar questions (e.g., "When did the Battle of X?" pattern) that token-level methods miss.

### Decision Thresholds

| Score | Decision | Tunable Flag |
|-------|----------|-------------|
| ≥ 0.92 | Auto-duplicate | `--auto-dedup-threshold` |
| 0.70 – 0.91 | Needs review | `--review-threshold` |
| < 0.70 | Distinct | — |

### CJK Support
Automatic detection via Unicode ranges (CJK Unified Ideographs, Hiragana, Katakana, Hangul). When CJK text detected:
- Trigram similarity → character bigram similarity
- Keyword extraction → character + 2-char window tokens
- TF-IDF tokenization → combined Latin keywords + CJK character tokens

## Persistent Dedup Index
Stored at `data/generated/qa-reports/dedup-index.json`. Contains:
- Exact key map (statement::answer → fact ID)
- Trigram inverted index (trigram → fact IDs)
- Minimal fact data for scoring

Build with `build-index` command. Use with `--use-index` flag. Avoids re-scanning all JSONL/seed files on repeated runs.

## Interactive Review UI
Local HTTP server at `http://localhost:3456`. Shows all needsReview items with:
- Side-by-side candidate vs match display
- Similarity score breakdown (all features)
- Accept/Reject buttons with persistent decisions
- Export decisions as JSON
- Dark theme, mobile-friendly

Decisions saved to `data/generated/qa-reports/manual-ingest-dedup-report-decisions.json`.

## QA Pipeline Integration
Semantic dedup runs automatically as part of `npm run content:qa` (the post-generation QA chain), now with a strict post-ingestion gate before migration/promotion.

**Default chain (`content:qa`):**
1. Coverage report + cross-domain exact dedup
2. Manual-ingest validate + semantic dedup (dry-run) against seed corpus (`src/data/seed`)
3. Gameplay safety gate (`qa/gameplay-safety-check.mjs`)
4. Coverage gate (`qa/coverage-gate.mjs --strict`)
5. Post-ingestion gate (`qa/post-ingestion-gate.mjs --strict`)
6. Migration + final validation

If a strict gate fails, the chain halts before migration.

Promotion (`npm run content:promote`) now enforces a passing `post-ingestion-gate.json` by default.

## Reports
All reports in `data/generated/qa-reports/`:
- `source-mix-report.json` — mixed-source composition per domain
- `manual-ingest-validation-report.json` — schema validation
- `manual-ingest-dedup-report.json` — dedup decisions with feature evidence
- `manual-ingest-flagged-report.json` — records that failed 3+ validation attempts
- `manual-ingest-merge-preview.json` — what merge would produce
- `manual-ingest-dedup-report-decisions.json` — interactive review decisions
- `dedup-index.json` — persistent trigram + exact key index
- `gameplay-safety-report.json` — run-pool safety and duplicate-risk checks
- `post-ingestion-gate.json` — strict pass/fail gate summary across QA artifacts

## Worker Runbook (Claude Subscription Workers)
For parallel workers that generate facts per domain:
1. Build mixed inputs once:
```bash
npm run content:source-mix
```
2. Generate per domain using mixed files:
```bash
npm run content:generate:all -- --source-mix --domains geography,history --limit 1000 --resume true
```
3. Run strict QA gates before promotion:
```bash
npm run content:qa -- --input data/generated --coverage-knowledge-min 3000 --coverage-language-min 0
```
4. Promote only after gate passes:
```bash
npm run content:promote -- --input data/generated --approved-only true --rebuild-db true
```

## Safety Rules
- Never overwrites existing files without `.backup-{timestamp}` copy
- All outputs to new files first
- Merge requires explicit `finalize` command
- Failed records flagged, never silently dropped
- Every accepted record preserves sourceRecordId/sourceName/sourceUrl
- Exit code 0 = success, 1 = fatal, 2 = warnings

## Failure Handling
- Individual record failures do not halt the batch
- Records failing validation ≥3 times → flagged-report (not dropped)
- Parse errors → flagged with line number
- All errors include record index, id, and error details
