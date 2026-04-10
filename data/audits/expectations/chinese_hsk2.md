# chinese_hsk2 — Audit Expectations

## Intended Scope
HSK Level 2 (Elementary Chinese). Official HSK 2 word list (2010 standard) covers 300 cumulative words (150 new at this level). This deck has 705 facts, indicating it extends into broader elementary vocabulary beyond the strict HSK 2 list.

## Canonical Source
- **Official HSK 2 Word List** (Hanban/Confucius Institute, 2010) — 300 cumulative words
- **CC-CEDICT** — definitions and readings
- Deck source field: `"HSK Vocabulary"`; fact IDs start at `zh-hsk-475`

## Sub-decks
None. Flat structure with `chainThemeId` cycling 0–9.

## Pool Inventory
| Pool | Facts | Synthetic Distractors |
|------|-------|----------------------|
| `english_meanings` | 705 | 0 |
| `target_language_words` | 705 | 0 |
| `reading_pinyin` | 705 | 0 |

Same three-pool architecture as HSK1. All facts reference `english_meanings` as their `answerTypePoolId`.

## Quality Bar
- Difficulty: 1 across all facts
- funScore: 5 (flat)
- Tone-marked pinyin in `reading` field
- No sub-decks, no chain themes

## Risk Areas
1. **TEMPLATE_MISFIT** — `reading_pinyin` template systematically shows English meanings when asking for pinyin (same HSK1 failure, 23 occurrences).
2. **POOL_CONTAM** — `reverse` template mixes Chinese characters with English distractors (12 occurrences).
3. **POS_TELL** — `zh-hsk-475` (啊, ā): `correctAnswer="interjection"`, `partOfSpeech="noun"` — meta-answer tells part of speech without testing vocabulary.
4. **FACTUAL_SUSPECT** — CC-CEDICT alternate reading in explanation contradicts tested answer (66 deck-wide mismatches).
5. **LENGTH_TELL** — Chinese characters (1–3 chars) vs English words (3–20 chars) in reverse template options.
