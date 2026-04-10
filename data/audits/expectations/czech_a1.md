# czech_a1 — Audit Expectations

## Intended Scope
CEFR A1 Czech (Beginner). Covers the most frequent Czech vocabulary appropriate for complete beginners. CEFR A1 corresponds to roughly 500–700 high-frequency words; this deck has 476 facts, well-sized for the level.

## Canonical Source
- **Kaikki.org** (derived from Wiktionary) — Czech dictionary definitions, POS, multi-meaning entries
- **wordfreq** — corpus-based word frequency ranking for vocabulary selection
- CEFR alignment is frequency-based, not from an official Czech A1 word list (Czech lacks a canonical authority equivalent to JLPT or HSK)

## Sub-decks
None. Flat structure with `chainThemeId` cycling 0–9.

## Pool Inventory
| Pool | Facts | Synthetic Distractors |
|------|-------|----------------------|
| `english_meanings` | 476 | 0 |
| `target_language_words` | 476 | 0 |

Only two pools — Czech decks lack the `reading_pinyin` pool since Czech uses Latin alphabet. No synthetic distractors.

## Quality Bar
- Difficulty: 1 (all facts, appropriate for beginner)
- funScore: 5 (flat)
- POS variety in the deck: conjunctions, pronouns, prepositions labeled as "noun" (data quality issue)
- Explanations sourced from Wiktionary — quality varies; some use Latin placeholder terms ("id.", "ego.")

## Risk Areas
1. **SELF_ANSWERING** — Czech-English cognates where Czech word ≈ English answer appear in the question stem (firma/firm, banka/bank). Affects 3 facts from JSON analysis, ~7 in the dump's definition_match template.
2. **EXPLANATION_QUALITY** — Wiktionary-sourced explanations include "ono — id." (cs-freq-3) and "já — ego." — untranslated Latin placeholders presenting gibberish to English-speaking learners.
3. **POS_MISLABEL** — "jako" (as) labeled `partOfSpeech: "noun"` — systemic issue where conjunctions/adverbs/pronouns receive "noun" as default.
4. **LENGTH_TELL** — Small number of cases (4 in dump) where multi-word English phrases appear alongside short words.
5. **SYNONYM_LEAK** — Czech connectors (tak/jako/ale) translate to English synonyms (so/as/but) that can become confusing distractors for each other.
