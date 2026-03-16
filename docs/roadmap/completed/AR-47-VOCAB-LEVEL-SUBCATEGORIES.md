# AR-47: Vocabulary Per-Level Subcategories

**Status:** In Progress
**Created:** 2026-03-16

## Problem

All vocab languages except Chinese have flat `categoryL2` values (e.g., `"ja"`, `"es"`, `"de"`). This means the deckbuilder shows all 7,726 Japanese facts as one group instead of separate N5/N4/N3/N2/N1 decks. Chinese already works correctly with `chinese_hsk1` through `chinese_hsk7`.

## TODO

1. [ ] Add per-CEFR subcategories to `subcategoryTaxonomy.ts` for ES/FR/DE/NL/CS/KO
2. [ ] Fix Japanese seed: set `categoryL2` to `japanese_n5`..`japanese_n1` based on curated `jlptLevel`
3. [ ] Fix European + Korean seeds: set `categoryL2` to per-CEFR subcategories based on curated `cefrLevel`
4. [ ] Rebuild DB
5. [ ] Verify deckbuilder shows separate level decks

## Acceptance Criteria

- [ ] Each language's seed facts have per-level `categoryL2` values
- [ ] Deckbuilder shows separate decks per JLPT/CEFR/TOPIK level
- [ ] DB rebuilt successfully

## Files Affected

- `src/data/subcategoryTaxonomy.ts` — add ~30 new subcategories
- `src/data/seed/vocab-{ja,es,fr,de,nl,ko,cs}.json` — update categoryL2
- `public/facts.db` — rebuild
