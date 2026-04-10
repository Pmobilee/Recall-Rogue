# japanese_n4 — Expectations

## Scope
JLPT N4 — elementary vocabulary. Approximately 600 additional words beyond N5. Total deck: 1,143 facts.

## Canonical Source
JMdict + JLPT word list (jamsinclair/jlpt-vocab), sourced via scriptin/jmdict-simplified.

## Sub-decks
- `vocabulary` — 645 facts
- `kanji` — 498 facts (166 kanji × meaning + onyomi + kunyomi + character)

## Pool Inventory
| Pool | Facts | Synth |
|------|-------|-------|
| english_meanings | 645 | 0 |
| target_language_words | 645 | 0 |
| reading_hiragana | 645 | 0 |
| kanji_meanings | 166 | 0 |
| kanji_onyomi | 71 | 0 |
| kanji_kunyomi | 95 | 0 |
| kanji_characters | 166 | 0 |

## Quiz Templates
`forward`, `reverse`, `reading`, `synonym_pick`, `definition_match`, `_fallback`

## Quality Bar
- Vocabulary at appropriate N4 level (not N5 words repeated)
- Reading pool strictly hiragana readings
- Reverse template distractors must be Japanese words
- High `_fallback` rate (84/180 sampled rows) suggests template assignment issues

## Risk Areas
1. **`_fallback` dominance** — 84 of 180 sampled rows (47%) use `_fallback`, suggesting many kanji facts lack proper template assignment
2. **POOL-CONTAM in `reading` template** — 19 facts in sample with English-meaning distractors in reading questions
3. **SELF-ANSWERING for katakana words** — same pattern as N5 (e.g., スーパー (マーケット))
4. **No synthetic distractors** — 0 across all pools
5. **N4 vs N5 level contamination** — needs verification that N5-level words are not duplicated in this deck
