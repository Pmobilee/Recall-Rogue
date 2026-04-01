---
name: curated-trivia-bridge
description: Bridge curated deck facts into the trivia database (facts.db). Extracts one best trivia question per entity from each knowledge deck, preserving fact IDs for FSRS knowledge transfer between Study Temple and Trivia Dungeon. Use after adding/updating curated decks.
---

# curated-trivia-bridge

## Mission

Extract representative trivia facts from curated knowledge decks and inject them into `facts.db`, enabling FSRS knowledge transfer between Study Temple and Trivia Dungeon.

**Canonical doc:** `docs/content/trivia-bridge.md`

---

## When to Run

- After `/deck-master` generates a new knowledge deck
- After curated deck facts are updated, regenerated, or QA-fixed
- After adding new decks to the manifest
- Periodically to ensure bridge output is in sync with deck content

---

## Workflow

### 1. Check for New Decks

```bash
cat data/decks/manifest.json
```

Compare against `scripts/content-pipeline/bridge/deck-bridge-config.json`. If any knowledge decks are missing from the config, add them:

```json
{
  "new_deck_id": {
    "prefixSegments": 1,
    "entitySegments": 1,
    "ageRating": "teen",
    "categoryL2": "valid_subcategory_id",
    "domain": "canonical_domain_id"
  }
}
```

Refer to `src/data/subcategoryTaxonomy.ts` for valid `categoryL2` values.

### 2. Dry Run

```bash
node scripts/content-pipeline/bridge/extract-trivia-from-decks.mjs --dry-run
```

Review the summary table. Check:
- Entity counts make sense (each entity = one real-world subject)
- No unexpected skips
- Bridge total is reasonable (~2,000 for all 22 decks)

For a single deck:
```bash
node scripts/content-pipeline/bridge/extract-trivia-from-decks.mjs --deck dinosaurs --verbose
```

### 3. Generate

```bash
node scripts/content-pipeline/bridge/extract-trivia-from-decks.mjs
```

Output: `src/data/seed/bridge-curated.json` + `scripts/content-pipeline/bridge/bridge-manifest.json`

### 4. Rebuild Database

```bash
node scripts/build-facts-db.mjs
```

### 5. Verify

```bash
npm run typecheck && npm run build
npx vitest run
```

Check the build-facts-db output for:
- Total fact count increased by expected bridge amount
- No ID collision warnings
- No distractor quality warnings on bridge facts

### 6. Report

Summarize results:
- Total bridge facts added
- Per-deck breakdown (from bridge-manifest.json)
- Any warnings or skipped facts
- New total trivia pool size

---

## Key Properties

- **Same IDs**: Bridge facts use the same IDs as curated deck facts. FSRS review states transfer between modes automatically.
- **1 per entity**: Only the highest-scoring fact per entity enters trivia. No "8 questions about the same dinosaur."
- **Provenance**: Every bridge fact is tagged `"bridge:{deckId}"`. All live in `bridge-curated.json`.
- **Idempotent**: Re-running produces identical output for unchanged decks.
- **Language decks excluded**: Only knowledge decks are bridged. Vocabulary stays in Study Temple.

---

## Troubleshooting

**Entity grouping looks wrong**: Adjust `prefixSegments` and `entitySegments` in the deck config. Use `--deck <id> --verbose` to inspect.

**ID collision with existing trivia**: The script checks against `src/data/seed/knowledge-*.json`. If collision found, either rename the curated fact or skip it.

**Missing categoryL2**: Every deck in the config needs a valid `categoryL2` from `src/data/subcategoryTaxonomy.ts`. Check the taxonomy file for valid IDs per domain.
