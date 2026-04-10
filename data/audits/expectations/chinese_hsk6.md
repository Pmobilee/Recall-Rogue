# chinese_hsk6 — Audit Expectations

## Intended Scope
HSK Level 6 (Mastery Chinese). Official HSK 6 covers 5,000+ cumulative words. This deck has 2,666 facts — covers a large subset of HSK 6 vocabulary, the most comprehensive Chinese deck in the collection.

## Canonical Source
- **Official HSK 6 Word List** (Hanban/Confucius Institute, 2010) — 5,000+ cumulative words
- **CC-CEDICT** — definitions and readings
- Fact IDs start at `zh-hsk-4436`; difficulty set to 5 (maximum)

## Sub-decks
None. Flat structure.

## Pool Inventory
| Pool | Facts | Synthetic Distractors |
|------|-------|----------------------|
| `english_meanings` | 2666 | 0 |
| `target_language_words` | 2666 | 0 |
| `reading_pinyin` | 2666 | 0 |

## Quality Bar
- Difficulty: 5 (maximum)
- funScore: 5 (flat)
- Vocabulary includes rare characters, literary terms, chengyu components, formal register
- Largest deck in the Chinese series (2,666 facts)

## Risk Areas
1. **TEMPLATE_MISFIT** — 35 occurrences in 180-entry dump — highest rate across all HSK decks.
2. **POOL_CONTAM** — 30 occurrences of reverse template mixing languages.
3. **FACTUAL_SUSPECT (SEVERE)** — 371 answer/explanation mismatches at deck level; 200 strong contradictions where explanation and correctAnswer describe fundamentally different meanings (e.g., 哦 answer="oh; I see" but explanation="to chant"; 作 answer="to do; to make" but explanation="worker").
4. **LENGTH_TELL** — 40 occurrences; worst ratio 23× (1-char 哼 vs 20-char English phrases).
5. **POS mislabeling** — 45 facts labeled "noun" with clearly non-noun answers; also some POS inconsistencies (如 labeled "noun" with answer "as" — a conjunction/preposition).
