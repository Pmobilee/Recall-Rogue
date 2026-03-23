# Content Pipeline (AR-11)

This pipeline is designed for high-volume fact generation and safe ingestion.

## 1) Generate Content (Claude CLI)

Use prompt templates in `scripts/prompts/`.

Example:

```bash
claude --model claude-sonnet-4-5-20250514 \
  --system-prompt scripts/prompts/vocabulary-japanese.md \
  --output tmp/vocab-ja-n3-batch-01.json \
  "Generate 50 JLPT N3 vocabulary records."
```

## 2) Validate + Deduplicate + Normalize

Dry-run validation:

```bash
node scripts/ingest-facts.mjs \
  --source tmp/vocab-ja-n3-batch-01.json \
  --domain language \
  --dry-run \
  --verify
```

Write normalized output:

```bash
node scripts/ingest-facts.mjs \
  --source tmp/vocab-ja-n3-batch-01.json \
  --domain language \
  --output docs/roadmap/evidence/ingest-output.normalized.json \
  --verify
```

Append directly into an existing seed file:

```bash
node scripts/ingest-facts.mjs \
  --source tmp/vocab-ja-n3-batch-01.json \
  --domain language \
  --target src/data/seed/vocab-n3.json \
  --verify
```

Artifacts:
- `docs/roadmap/evidence/content-ingest-report.json`
- optional normalized output file

## 3) Coverage Reporting

```bash
node scripts/report-coverage.mjs
```

Artifacts:
- `docs/roadmap/evidence/content-coverage.json`
- `docs/roadmap/evidence/content-coverage.md`

## 4) Verification Workflow (`verifiedAt`)

Mark selected IDs as verified:

```bash
node scripts/verify-facts.mjs \
  --file src/data/seed/facts-general.json \
  --ids geo-001,geo-002
```

Mark entire file:

```bash
node scripts/verify-facts.mjs --file src/data/seed/facts-general.json --all
```

## 5) Build sql.js Database

```bash
npm run build:facts
```

Outputs:
- `public/facts.db`
- `public/seed-pack.json`

## 6) Visual Description Generation

Language-themed generation:

```bash
node sprite-gen/scripts/generate-visual-descriptions.mjs --language ja --file vocab-n3 --limit 20
node sprite-gen/scripts/generate-visual-descriptions.mjs --language es --file vocab-es
node sprite-gen/scripts/generate-visual-descriptions.mjs --language fr --file vocab-fr
```

Force regeneration for a language pack:

```bash
node sprite-gen/scripts/generate-visual-descriptions.mjs --language ja --file vocab-n3 --regenerate-all
```

Validation behavior:
- Rejects descriptions with fewer than 15 words.
- Rejects generic fantasy anti-patterns (`glowing orbs`, `magic portals`, etc.).
- Rejects descriptions without language-cultural marker keywords.
- Rejects offensive stereotype phrasing.

## Quality Checklist

- Every record has `sourceName`.
- Distractors >= 2 (recommended >= 5).
- No fuzzy duplicate questions (>= 0.85 similarity).
- `acceptableAnswers` has at least 2 variants.
- `verifiedAt` is set for reviewed records.
- Coverage report generated and reviewed.
- Build succeeds (`npm run build`).
