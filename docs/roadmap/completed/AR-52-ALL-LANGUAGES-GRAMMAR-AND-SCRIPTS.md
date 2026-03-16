# AR-52: Grammar Decks & Script Learning for All Languages

**Status:** In Progress
**Created:** 2026-03-16
**Estimated complexity:** Medium (all programmatic — no Sonnet needed)

---

## Overview

Expand every language beyond just vocabulary by adding grammar decks (Korean, Chinese) and script learning (Japanese kana). All data is available from open-licensed sources and can be generated programmatically.

## Data Sources (all MIT/CC licensed)

| Content | Source | License | Points |
|---------|--------|---------|--------|
| Korean grammar L1-L6 | hanabira.org | MIT | 744 |
| Chinese grammar HSK 1-6 | hanabira.org | MIT | 739 |
| Japanese kana (hiragana + katakana) | full-japanese-study-deck | CC | 416 already in seed |

No European language grammar data available from open sources yet — noted as future work.

## Part A: Korean Grammar (~744 points → ~2,000 facts)

### Data: `/tmp/hanabira-kr/level{1-6}.json`

| Level | Points | Maps to |
|-------|--------|---------|
| Level 1 | 79 | korean_beginner |
| Level 2 | 118 | korean_beginner |
| Level 3 | 171 | korean_intermediate |
| Level 4 | 143 | korean_intermediate |
| Level 5 | 114 | korean_advanced |
| Level 6 | 119 | korean_advanced |

Each point has: title, short_explanation, formation, examples with Korean + English.

### Generate 2-3 facts per point (same pattern as Japanese):
1. **Meaning** (L2→L1): "What does '~게 되다' mean?" → "end up doing"
2. **Recall** (L1→L2): "Which Korean pattern means 'end up doing'?" → "~게 되다"
3. **Sentence completion**: Fill-blank with Korean example sentences

### Korean TODO
1. [ ] Add Korean grammar subcategories to taxonomy (if needed — or reuse existing beginner/intermediate/advanced)
2. [ ] Write build script: `build-korean-grammar.py`
3. [ ] Generate facts, QA spot-check
4. [ ] Write to `src/data/seed/grammar-ko.json`
5. [ ] Add `subdecks` to Korean language config (grammar tokens)
6. [ ] Rebuild DB, verify deckbuilder

## Part B: Chinese Grammar HSK 1-6 (~739 points → ~2,000 facts)

### Data: `/tmp/hanabira-cn/hsk{1-6}.json`

| Level | Points | Maps to |
|-------|--------|---------|
| HSK 1 | 85 | chinese_hsk1 |
| HSK 2 | 99 | chinese_hsk2 |
| HSK 3 | 178 | chinese_hsk3 |
| HSK 4 | 119 | chinese_hsk4 |
| HSK 5 | 119 | chinese_hsk5 |
| HSK 6 | 139 | chinese_hsk6 |

Each point has: title (with pinyin), short_explanation, formation, examples.

### Generate 2-3 facts per point:
1. **Meaning** (L2→L1): "What does '把 (bǎ)' express?" → "shift object before verb (ba-construction)"
2. **Recall** (L1→L2): "Which Chinese pattern shifts the object before the verb?" → "把 (bǎ)"
3. **Sentence completion**: Fill-blank with Chinese example sentences

### Chinese TODO
1. [ ] Write build script: `build-chinese-grammar.py`
2. [ ] Generate facts with proper HSK level categoryL2
3. [ ] QA spot-check
4. [ ] Write to `src/data/seed/grammar-zh.json`
5. [ ] Add grammar subdeck tokens to Chinese language config
6. [ ] Rebuild DB, verify

## Part C: Japanese Kana Deck (~416 facts — already in seed files)

We already have `vocab-ja-hiragana.json` (208) and `vocab-ja-katakana.json` (208) in the seed directory but they're not being loaded by the DB builder (they use a different naming convention).

### Kana TODO
1. [ ] Check if these files are already included in DB build
2. [ ] If not, ensure `build-facts-db.mjs` picks them up
3. [ ] Verify kana facts have `-kana-` in IDs for subdeck filtering
4. [ ] Verify deckbuilder shows "Kana" checkbox for Japanese

## Execution Order

1. Korean grammar (Part A) — largest new content addition
2. Chinese grammar (Part B) — same pattern as Korean
3. Japanese kana (Part C) — just wiring, content exists
4. Rebuild DB, full verification

## Acceptance Criteria

- [ ] Korean: ~2,000 grammar facts across 3 TOPIK tiers, 2-3 types each
- [ ] Chinese: ~2,000 grammar facts across HSK 1-6, 2-3 types each
- [ ] Japanese: Kana subdeck visible in deckbuilder with ~416 facts
- [ ] All facts QA spot-checked before merge
- [ ] DB rebuilt, deckbuilder shows grammar subdecks for KO and ZH
- [ ] Total DB approaches ~110K facts

## Files Affected

| File | Change |
|------|--------|
| `scripts/content-pipeline/vocab/build-korean-grammar.py` | NEW |
| `scripts/content-pipeline/vocab/build-chinese-grammar.py` | NEW |
| `src/data/seed/grammar-ko.json` | NEW |
| `src/data/seed/grammar-zh.json` | NEW |
| `src/data/subcategoryTaxonomy.ts` | May need grammar subcats for KO/ZH |
| `src/types/vocabulary.ts` | Add grammar subdeck tokens to KO/ZH configs |
| `public/facts.db` | Rebuilt |
