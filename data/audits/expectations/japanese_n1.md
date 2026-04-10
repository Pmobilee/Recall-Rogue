# japanese_n1 — Expectations

## Scope
JLPT N1 — advanced vocabulary. Approximately 2,000–3,000 words. Largest deck at 6,269 facts including 1,232 kanji.

## Canonical Source
JMdict + JLPT word list (jamsinclair), scriptin/jmdict-simplified.

## Sub-decks
- `vocabulary` — 2,573 facts (katakana/hiragana/kanji compound words, formal vocabulary)
- `kanji` — 3,696 facts (1,232 kanji × meaning + readings + characters)

## Pool Inventory
| Pool | Facts | Synth |
|------|-------|-------|
| english_meanings | 2,573 | 0 |
| target_language_words | 2,573 | 0 |
| reading_hiragana | 2,573 | 0 |
| kanji_meanings | 1,232 | 0 |
| kanji_onyomi | 820 | 0 |
| kanji_kunyomi | 412 | 0 |
| kanji_characters | 1,232 | 0 |

## Quiz Templates
`forward`, `reverse`, `reading`, `synonym_pick`, `definition_match`, `_fallback`

## Quality Bar
- Advanced vocabulary; many formal/literary/technical words
- Large pool sizes reduce distractor quality issue
- `_fallback` extremely high (111/180 = 62%) — most troubling of all JLPT levels

## Risk Areas
1. **`_fallback` dominance** — 111/180 rows (62%); worst rate across all JLPT levels; majority of kanji facts hit fallback
2. **SELF-ANSWERING in `reading` template** — 3 confirmed cases: しかしながら (hiragana word), はらはら (reduplication), アプローチ (katakana loan)
3. **POOL-CONTAM in `reading` template** — 12 reading-template entries with English distractors
4. **SYNONYM-LEAK very high risk** — N1 vocabulary has many near-synonyms; 綺麗/美しい, 始める/開始する type pairs
5. **No synthetic distractors** — all pools at 0
