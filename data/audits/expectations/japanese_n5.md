# japanese_n5 — Expectations

## Scope
JLPT N5 — beginner vocabulary. Approximately 800 core words required for the N5 exam, supplemented with kanji facts. Deck targets 929 facts total.

## Canonical Source
JMdict + JLPT word list (jamsinclair/jlpt-vocab), sourced via scriptin/jmdict-simplified. High-quality open source corpus.

## Sub-decks
- `vocabulary` — 692 facts (general N5 vocab: nouns, verbs, adjectives, particles, phrases)
- `kanji` — 237 facts (N5 kanji with meaning, onyomi, kunyomi, character pools)

## Pool Inventory
| Pool | Facts | Synth Distractors |
|------|-------|-------------------|
| english_meanings | 692 | 0 |
| target_language_words | 692 | 0 |
| reading_hiragana | 692 | 0 |
| kanji_meanings | 79 | 0 |
| kanji_onyomi | 27 | 0 |
| kanji_kunyomi | 52 | 0 |
| kanji_characters | 79 | 0 |

## Quiz Templates
`forward`, `reverse`, `reading`, `synonym_pick`, `definition_match`, `_fallback`

## Quality Bar
- All N5 JLPT official words represented
- Reading pool should contain hiragana readings (not English or kanji)
- Reverse template: distractors should be Japanese words, not English meanings
- Kanji facts separated from vocabulary facts

## Risk Areas
1. **POOL-CONTAM in `reading` template** — reading pool contains English-meaning distractors pulled from the general pool, making Japanese-reading questions trivially easy (spot the only Japanese string)
2. **POOL-CONTAM in `reverse` template** — "How do you say X in Japanese?" shows English-meaning distractors instead of Japanese-word distractors
3. **SELF-ANSWERING in `reading` template** — katakana loanwords (レコード, ジュース, etc.) have identical word and reading; "What is the reading of 'レコード'?" with answer `レコード` is trivially self-answering
4. **`_fallback` template overuse** — 30 of 90 sampled quiz rows use `_fallback`, which uses `english_meanings` pool for all templates regardless of question type
5. **No synthetic distractors** — all 7 pools have 0 synthetic distractors, so at low mastery players see only 2 options
