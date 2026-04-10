# chinese_hsk1 — Audit Expectations

## Intended Scope
HSK Level 1 (Hanyu Shuiping Kaoshi), the first tier of China's standardized Mandarin proficiency test. Covers the most essential 150 words in the official HSK 1 word list (2010 standard). This deck extends to 466 facts, suggesting it covers the full HSK 1+2 beginner vocabulary or uses HSK 1 as a label for a broader beginner corpus.

## Canonical Source
- **Official HSK 1 Word List** (Hanban/Confucius Institute, 2010) — 150 words
- **CC-CEDICT** (community-maintained Chinese dictionary) — used for definitions and readings
- Deck source field: `"HSK Vocabulary"` with reading field containing pinyin with tone marks

## Sub-decks
None. Single flat deck with `chainThemeId` cycling 0–9.

## Pool Inventory
| Pool | Facts | Synthetic Distractors |
|------|-------|----------------------|
| `english_meanings` | 466 | 0 |
| `target_language_words` | 466 | 0 |
| `reading_pinyin` | 466 | 0 |

All 466 facts point to `answerTypePoolId: "english_meanings"`. The `reading_pinyin` pool exists but no fact references it as its answer pool — it is a separate pool for distractor sourcing.

## Quality Bar
- Difficulty: 1 across all facts (appropriate for beginner)
- funScore: 5 (flat, no variation)
- Pinyin with tone marks present in `reading` field for all facts
- No chain themes or sub-decks
- No synthetic distractors (pool size = 466, large enough for distractor variety)

## Risk Areas
1. **TEMPLATE_MISFIT** — `reading_pinyin` template asks "What is the pinyin reading of X?" but serves English meaning as the correct answer and other English meanings as distractors. Systematically affects ~20% of entries.
2. **POOL_CONTAM** — `reverse` template mixes Chinese characters (correct answer) with English meaning distractors in the same option list.
3. **LENGTH_TELL** — Mixing Chinese characters (1–4 chars) with English words (5–15 chars) in reverse template options creates obvious length tells.
4. **FACTUAL_SUSPECT** — `correctAnswer` uses the most common reading but `explanation` sometimes shows a less common pronunciation entry from CC-CEDICT (e.g., 了 answer='completion marker' but explanation describes a different reading).
5. **Zero synthetic distractors** — all distractor variety comes from pool size alone; no controlled distractor quality.
