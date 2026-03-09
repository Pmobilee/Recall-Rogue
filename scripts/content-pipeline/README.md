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

## Notes

- SPARQL templates use `{{LIMIT}}` and `{{OFFSET}}`.
- Per-domain minimums are configured in `sources.json`:
  - `minimumPolicy: "strict"` fails verification when below threshold.
  - `minimumPolicy: "advisory"` only warns (used for map/country-heavy domains like geography).
- Raw outputs are written to `data/raw/`.
