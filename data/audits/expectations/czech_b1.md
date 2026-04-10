# czech_b1 — Audit Expectations

## Intended Scope
CEFR B1 Czech (Intermediate). Covers productive vocabulary for handling familiar topics, travel, work, and opinions. CEFR B1 typically adds 1,000–1,500 words beyond A2; this deck has 976 facts — well-sized.

## Canonical Source
- **Kaikki.org + wordfreq** — frequency-based selection with Wiktionary definitions
- Fact IDs start in the `cs-freq-1001` range; difficulty set to 2

## Sub-decks
None.

## Pool Inventory
| Pool | Facts | Synthetic Distractors |
|------|-------|----------------------|
| `english_meanings` | 976 | 0 |
| `target_language_words` | 976 | 0 |

## Quality Bar
- Difficulty: 2 (appropriate step up from A1/A2)
- funScore: 5 (flat)
- B1 vocabulary includes proper nouns (Milan, Ivan, Washington, New York), technical terms, and aspect pairs

## Risk Areas
1. **SELF_ANSWERING** — 5 cases in JSON including proper nouns that are identical in Czech and English (Milan, Ivan, Washington, New York). These cannot be answered incorrectly — the Czech and English words are the same.
2. **PROPER_NOUN_FACTS** — cs-freq-1354 (Milan), cs-freq-1699 (Ivan), cs-freq-1867 (Washington), cs-freq-1873 (New York) — proper nouns as vocabulary items are always self-answering and waste quiz slots.
3. **LENGTH_TELL** — 24 occurrences in dump, highest absolute count among Czech decks. The Czech word "eso" (ace, 3 chars) vs. multi-word English distractors is the most extreme case.
4. **DEFINITION_MATCH SELF_ANSWERING** — 11 cases where explanation text contains the answer.
5. **EXPLANATION_QUALITY** — Multi-word phrases (e.g., "přírodní zdroj — natural resource") in explanation_match create SELF_ANSWERING for compound answers.
