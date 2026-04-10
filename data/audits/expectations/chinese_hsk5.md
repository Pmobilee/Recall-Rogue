# chinese_hsk5 — Audit Expectations

## Intended Scope
HSK Level 5 (Advanced Chinese). Official HSK 5 covers 2,500 cumulative words (1,300 new). This deck has 1,263 facts — covers the upper portion of the HSK 5 new vocabulary range.

## Canonical Source
- **Official HSK 5 Word List** (Hanban/Confucius Institute, 2010) — 2,500 cumulative words
- **CC-CEDICT** — definitions and readings
- Fact IDs start at `zh-hsk-3138`; difficulty set to 4

## Sub-decks
None. Flat structure.

## Pool Inventory
| Pool | Facts | Synthetic Distractors |
|------|-------|----------------------|
| `english_meanings` | 1263 | 0 |
| `target_language_words` | 1263 | 0 |
| `reading_pinyin` | 1263 | 0 |

## Quality Bar
- Difficulty: 4 (advanced)
- funScore: 5 (flat)
- Vocabulary includes specialized terms, idioms, formal register words
- Larger pool (1,263) means slightly better distractor variety

## Risk Areas
1. **TEMPLATE_MISFIT** — `reading_pinyin` template shows English (26 occurrences in 180-entry dump, a larger dump due to deck size).
2. **POOL_CONTAM** — `reverse` template contamination at 40 occurrences — highest absolute count of any HSK deck.
3. **LENGTH_TELL** — 48 occurrences in dump — highest count of any HSK deck. Worst ratio: 6.5×.
4. **FACTUAL_SUSPECT** — 112 deck-wide mismatches (9% of 1,263 facts) — worst rate among HSK1–5.
5. **POS mislabeling** — 69 facts labeled `partOfSpeech: "noun"` with answers that are clearly verbs, adverbs, or particles (e.g., '可' answer="can; may", '将' answer="will").
