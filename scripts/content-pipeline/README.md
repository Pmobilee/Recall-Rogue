# Content Pipeline (AR-15+)

This folder contains source registry, data fetchers, worker-first ingestion tooling, vocabulary imports, and QA scripts for AR-15 through AR-19.

## Quick start (worker-first pipeline)

1. Verify SPARQL output counts:
```bash
node scripts/content-pipeline/fetch/verify-sparql.mjs
```

2. Fetch everything:
```bash
node scripts/content-pipeline/fetch-all.mjs
```

3. Build worker task bundles (mixed inputs + missing-count analysis + per-domain prompts):
```bash
npm run content:workers:prepare -- --target-per-domain 1000
# Writes:
# - data/raw/mixed/<domain>.json
# - data/generated/worker-packages/tasks/<domain>.json
# - data/generated/worker-packages/prompts/<domain>.md
# - data/generated/qa-reports/agent-workers-prepare.json
```

4. Run Claude subscription workers externally using generated prompt files and write outputs to:
```text
data/generated/worker-output/<domain>.jsonl
```

5. Ingest + dedup worker outputs:
```bash
npm run content:workers:ingest -- --strict true
```

6. Run QA gate and promote into seed/db:
```bash
npm run content:workers:qa
npm run content:workers:promote
```

One-shot (all steps in sequence):
```bash
npm run content:workers:all -- --target-per-domain 1000 --strict true
```

Single-command autopilot (knowledge + vocab + visual fill + QA + DB promote):
```bash
npm run content:autopilot -- --target-per-domain 1000 --target-per-language 1000
```

Notes:
- `content:autopilot` will run prepare/ingest/QA/promote and vocab build+ingest.
- It also fills missing `visualDescription` values in generated data (and optionally seed files).
- For live fact writing quality, an Opus worker should generate missing worker outputs in
  `data/generated/worker-output/*.jsonl` before or during autopilot runs.

Single-domain fetch still available:
```bash
node scripts/content-pipeline/fetch-all.mjs --domain geography --domain-target 1500 --skip-apis
```

## API fetchers (AR-15)

All scripts support `--limit` and `--output`:

- `fetch/fetch-nasa.mjs`
- `fetch/fetch-pubchem.mjs`
- `fetch/fetch-gbif.mjs`
- `fetch/fetch-usda.mjs` (`USDA_API_KEY` or `FDC_API_KEY` required)
- `fetch/fetch-met-museum.mjs`
- `fetch/fetch-art-institute.mjs`
- `fetch/fetch-world-bank.mjs`

Legacy names (`fetch-nasa-apod.mjs`, `fetch-gbif-species.mjs`, etc.) remain as wrappers.

## Fact generation helpers (AR-17)

Local paid Anthropic API execution paths are removed from content-pipeline scripts. Live generation should happen through external Claude subscription workers using the task/prompt bundles emitted by `content:workers:prepare`.

- `generate/haiku-client.mjs` - dry-run local fact stub generator
- `generate/batch-generate.mjs` - batch JSON -> JSONL dry-run generator
- `generate/validate-output.mjs` - schema + quality validation
- `generate/estimate-cost.mjs` - token/cost estimate
- `generate/sample.mjs` - small sample dry-run generation
- `generate/generate-all-domains.mjs` - dry-run multi-domain generation helper
- `agent-workers.mjs` - full worker-first orchestrator (`prepare`, `ingest`, `qa`, `promote`, `all`)
- `autopilot.mjs` - end-to-end orchestration (knowledge + vocab + visuals + QA + promote)
- `fill-missing-visual-descriptions.mjs` - fills empty visualDescription fields without paid API calls

Example:
```bash
node scripts/content-pipeline/generate/sample.mjs --domain geography --count 5 --dry-run --output /tmp/geography-sample.json
node scripts/content-pipeline/generate/validate-output.mjs --input /tmp/geography-sample.json --schema-only

# End-to-end dry-run: source -> generated JSONL -> ingest normalization report
node scripts/content-pipeline/generate/batch-generate.mjs --input data/raw/geography.json --domain geography --output /tmp/geography.generated.jsonl --limit 20 --dry-run
node scripts/content-pipeline/generate/validate-output.mjs --input /tmp/geography.generated.jsonl --strict
node scripts/ingest-facts.mjs --source /tmp/geography.generated.jsonl --domain geography --dry-run --report /tmp/geography.ingest-report.json

# All domains in one run (dry-run helper only)
npm run content:generate:all -- --dry-run --limit 50 --strict false

# Same command with mixed-source inputs (dry-run)
npm run content:generate:all -- --source-mix --limit 1000 --concurrency 2 --rate-limit 80 --resume true --max-cost-usd 25
```

Safety and observability:
- `--max-cost-usd <N>` hard-stops generation when estimated spend reaches `N` USD.
- `--budget-ledger <path>` shares spend tracking across parallel workers via one ledger JSONL file.
- `--retry-report-limit <N>` caps stored retry detail volume.
- `--retry-flag-threshold <N>` marks facts that needed at least `N` retries (default `3`) while continuing ingestion.
- Retry/error artifacts are emitted to `data/generated/retries-<domain>-<timestamp>.json` and `data/generated/errors-<domain>-<timestamp>.json`.

## Vocabulary pipeline (AR-18)

- `vocab/import-jmdict.mjs`
- `vocab/import-tatoeba.mjs`
- `vocab/import-wikidata-lexemes.mjs`
- `vocab/extract-anki-wordlist.mjs`
- `vocab/enrich-wordlist.mjs`
- `vocab/verify-translations.mjs`
- `vocab/import-european-vocab.mjs`
- `vocab/level-mapper.mjs`
- `vocab/import-hsk-vocabulary.mjs`
- `vocab/match-tatoeba.mjs`
- `vocab/vocab-to-facts.mjs`
- `vocab/build-seed-packs.mjs`
- `vocab/validate-seed-packs.mjs`

Example:
```bash
# Build launch vocab seed packs (ja/es/fr/de/ko/zh) plus nl/cs scaffolds
npm run content:vocab:build -- --limit 5000

# Validate generated seed packs and emit a report
npm run content:vocab:validate -- --languages ja,es,fr,de,ko,zh --min-rows 100
```

## QA and migration (AR-19)

- `qa/cross-domain-dedup.mjs`
- `qa/coverage-report.mjs`
- `qa/review-sample.mjs`
- `qa/generate-validation-summary.mjs`
- `qa/migrate-to-production.mjs`
- `qa/final-validation.mjs`
- `qa/source-fact-check.mjs`
- `qa/flag-content-risks.mjs`
- `qa/coverage-gate.mjs`
- `qa/run-post-generation-qa.mjs`
- `qa/promote-approved-to-db.mjs`
- `qa/gameplay-safety-check.mjs`
- `qa/post-ingestion-gate.mjs`

Example:
```bash
# Source cross-reference audit + risk flags
npm run content:factcheck -- --input data/generated --sample 200
node scripts/content-pipeline/qa/flag-content-risks.mjs --input data/generated

# Full post-generation QA chain (coverage/dedup/review sample/migration/gates)
npm run content:qa -- --input data/generated

# Run gameplay safety check independently (run-pool variety + duplicate risk gate)
npm run content:qa:gameplay -- --input data/generated --strict

# Run post-ingestion quality gate independently (validation/dedup/coverage/gameplay)
npm run content:qa:gate -- --strict

# Coverage threshold gate (AR-19 target checks)
npm run content:coverage:gate -- --knowledge-min 10000 --language-min 5000

# Promote approved generated facts into seed and rebuild public/facts.db
# Note: promotion now enforces a passing post-ingestion gate report by default.
npm run content:promote -- --input data/generated --approved-only true --rebuild-db true
```

## Notes

- SPARQL templates use `{{LIMIT}}` and `{{OFFSET}}`.
- Per-domain minimums are configured in `sources.json`:
  - `minimumPolicy: "strict"` fails verification when below threshold.
  - `minimumPolicy: "advisory"` only warns (used for map/country-heavy domains like geography).
- Raw outputs are written to `data/raw/`.
