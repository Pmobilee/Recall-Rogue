# japanese_n2 — Expectations

## Scope
JLPT N2 — upper-intermediate vocabulary. Approximately 1,500 words. Deck contains 2,782 facts.

## Canonical Source
JMdict + JLPT word list (jamsinclair), scriptin/jmdict-simplified.

## Sub-decks
- `vocabulary` — 1,681 facts
- `kanji` — 1,101 facts (367 kanji)

## Pool Inventory
| Pool | Facts | Synth |
|------|-------|-------|
| english_meanings | 1,681 | 0 |
| target_language_words | 1,681 | 0 |
| reading_hiragana | 1,681 | 0 |
| kanji_meanings | 367 | 0 |
| kanji_onyomi | 204 | 0 |
| kanji_kunyomi | 163 | 0 |
| kanji_characters | 367 | 0 |

## Quiz Templates
`forward`, `reverse`, `reading`, `synonym_pick`, `definition_match`, `_fallback`

## Quality Bar
- Upper-intermediate level; more abstract vocabulary, compound words
- Large kanji pool reduces repeat-distractor problem
- SYNONYM-LEAK risk higher at N2 (many near-synonyms)

## Risk Areas
1. **`_fallback` dominance** — 75/177 rows (42%); kanji facts falling through to fallback
2. **POOL-CONTAM in `reading` template** — 21 reading entries contaminated with English
3. **SYNONYM-LEAK** — N2 has many near-synonym pairs (e.g., 増える/増やす, 変わる/変える)
4. **No synthetic distractors** — all pools at 0
5. **Multi-reading kanji** — some N2 kanji have multiple valid onyomi readings; distractors must not include the alternate correct reading
