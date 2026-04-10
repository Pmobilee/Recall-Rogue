# japanese_n3 — Expectations

## Scope
JLPT N3 — intermediate vocabulary. Approximately 1,500–2,000 words. Largest of the JLPT vocab decks at 3,091 facts, reflecting the expanded N3 word list plus kanji.

## Canonical Source
JMdict + JLPT word list (jamsinclair), scriptin/jmdict-simplified.

## Sub-decks
- `vocabulary` — 1,990 facts
- `kanji` — 1,101 facts (367 kanji)

## Pool Inventory
| Pool | Facts | Synth |
|------|-------|-------|
| english_meanings | 1,990 | 0 |
| target_language_words | 1,990 | 0 |
| reading_hiragana | 1,990 | 0 |
| kanji_meanings | 367 | 0 |
| kanji_onyomi | 185 | 0 |
| kanji_kunyomi | 182 | 0 |
| kanji_characters | 367 | 0 |

## Quiz Templates
`forward`, `reverse`, `reading`, `synonym_pick`, `definition_match`, `_fallback`

## Quality Bar
- Intermediate vocabulary; words should not repeat N5/N4 words
- Kanji pool is large enough (367) for good distractor variety
- `_fallback` count (72/180 = 40%) still high but lower than N4

## Risk Areas
1. **POOL-CONTAM in `reading` template** — 27 contaminated reading entries in sample; distractors include English meanings
2. **SYNONYM-LEAK** — N3 introduces many near-synonym pairs (食べる vs 召し上がる patterns) that may appear as distractors for each other
3. **`_fallback` overuse** — 72/180 rows (40%)
4. **No synthetic distractors** — all pools at 0
5. **SELF-ANSWERING for katakana** — e.g., ジュース (juice), アイスクリーム
