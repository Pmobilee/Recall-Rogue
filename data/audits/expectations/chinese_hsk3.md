# chinese_hsk3 — Audit Expectations

## Intended Scope
HSK Level 3 (Intermediate Chinese). Official HSK 3 word list covers 600 cumulative words (300 new). This deck has 915 facts — significantly exceeds the official word count, covering extended intermediate vocabulary.

## Canonical Source
- **Official HSK 3 Word List** (Hanban/Confucius Institute, 2010) — 600 cumulative words
- **CC-CEDICT** — definitions and readings
- Fact IDs start at `zh-hsk-1194`; difficulty set to 2

## Sub-decks
None. Flat structure.

## Pool Inventory
| Pool | Facts | Synthetic Distractors |
|------|-------|----------------------|
| `english_meanings` | 915 | 0 |
| `target_language_words` | 915 | 0 |
| `reading_pinyin` | 915 | 0 |

## Quality Bar
- Difficulty: 2 (appropriate step up from HSK1/2)
- funScore: 5 (flat)
- Multi-character words become more common at this level (e.g., 就是, 需要)
- Some answers use semicolons to separate multiple meanings (e.g., "to hold; to grasp")

## Risk Areas
1. **TEMPLATE_MISFIT** — `reading_pinyin` template still shows English meanings (20 occurrences in dump).
2. **POOL_CONTAM** — `reverse` template mixes Chinese characters and English (15 occurrences).
3. **LENGTH_TELL** — Severity increases vs. HSK1/2 because longer compound words (2–4 chars) create even bigger length disparity with English options. Ratio up to 14× observed.
4. **FACTUAL_SUSPECT** — 69 deck-wide answer/explanation mismatches; same CC-CEDICT alternate-reading issue.
5. **SYNONYM_LEAK** — At intermediate level, English synonyms become harder to distinguish as distractors (e.g., "to hold" vs "to grasp" vs "to grip").
