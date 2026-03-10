# Content Pipeline (AR-15+)

This folder contains source registry, data fetchers, generation tooling, vocabulary imports, and QA scripts for AR-15 through AR-19.

## Quick start

1. Verify SPARQL output counts:
```bash
node scripts/content-pipeline/fetch/verify-sparql.mjs
```

2. Fetch everything:
```bash
node scripts/content-pipeline/fetch-all.mjs
```

3. Fetch one domain only:
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

## Fact generation (AR-17)

- `generate/haiku-client.mjs` - API client with retry/rate/cost tracking
- `generate/batch-generate.mjs` - batch JSON -> JSONL generation
- `generate/validate-output.mjs` - schema + quality validation
- `generate/estimate-cost.mjs` - token/cost estimate
- `generate/sample.mjs` - small sample generation

Example:
```bash
node scripts/content-pipeline/generate/sample.mjs --domain geography --count 5 --dry-run --output /tmp/geography-sample.json
node scripts/content-pipeline/generate/validate-output.mjs --input /tmp/geography-sample.json --schema-only

# End-to-end dry-run: source -> generated JSONL -> ingest normalization report
node scripts/content-pipeline/generate/batch-generate.mjs --input data/raw/geography.json --domain geography --output /tmp/geography.generated.jsonl --limit 20 --dry-run
node scripts/content-pipeline/generate/validate-output.mjs --input /tmp/geography.generated.jsonl --strict
node scripts/ingest-facts.mjs --source /tmp/geography.generated.jsonl --domain geography --dry-run --report /tmp/geography.ingest-report.json
```

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

## QA and migration (AR-19)

- `qa/cross-domain-dedup.mjs`
- `qa/coverage-report.mjs`
- `qa/review-sample.mjs`
- `qa/generate-validation-summary.mjs`
- `qa/migrate-to-production.mjs`
- `qa/final-validation.mjs`

## Notes

- SPARQL templates use `{{LIMIT}}` and `{{OFFSET}}`.
- Per-domain minimums are configured in `sources.json`:
  - `minimumPolicy: "strict"` fails verification when below threshold.
  - `minimumPolicy: "advisory"` only warns (used for map/country-heavy domains like geography).
- Raw outputs are written to `data/raw/`.
