# chinese_hsk4 — Audit Expectations

## Intended Scope
HSK Level 4 (Upper-Intermediate Chinese). Official HSK 4 covers 1,200 cumulative words (600 new). This deck has 980 facts — slightly under the official new-word count but may focus on high-frequency items from this tier.

## Canonical Source
- **Official HSK 4 Word List** (Hanban/Confucius Institute, 2010) — 1,200 cumulative words
- **CC-CEDICT** — definitions and readings
- Fact IDs start at `zh-hsk-2135`; difficulty set to 3

## Sub-decks
None. Flat structure.

## Pool Inventory
| Pool | Facts | Synthetic Distractors |
|------|-------|----------------------|
| `english_meanings` | 980 | 0 |
| `target_language_words` | 980 | 0 |
| `reading_pinyin` | 980 | 0 |

## Quality Bar
- Difficulty: 3 (mid-range)
- funScore: 5 (flat)
- Vocabulary includes literary/formal particles (而 ér, 之 zhī) alongside practical words
- Multi-character compounds dominate; pinyin shows more multi-syllable patterns

## Risk Areas
1. **TEMPLATE_MISFIT** — `reading_pinyin` template shows English meanings (17 occurrences in dump).
2. **POOL_CONTAM** — `reverse` template mixes languages (18 occurrences).
3. **LENGTH_TELL** — Continues pattern from HSK1–3 with ratios up to 5.5× observed.
4. **FACTUAL_SUSPECT** — 79 answer/explanation mismatches (8% of 980 facts).
5. **LEVEL_CREEP** — Literary particles (之 = "of", 而 = "and") at difficulty=3 might be misleveled; these appear at HSK4 but resemble classical usage that students encounter later.
