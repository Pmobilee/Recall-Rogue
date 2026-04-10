# czech_b2 — Audit Expectations

## Intended Scope
CEFR B2 Czech (Upper-Intermediate). Advanced everyday Czech: abstract topics, professional contexts, nuanced expression. CEFR B2 typically adds 1,500–2,000 words; this deck has 1,382 facts — the largest Czech deck and appropriately sized.

## Canonical Source
- **Kaikki.org + wordfreq** — frequency-based selection
- Fact IDs span `cs-freq-2004` to `cs-freq-3216+`; difficulty set to 2

## Sub-decks
None.

## Pool Inventory
| Pool | Facts | Synthetic Distractors |
|------|-------|----------------------|
| `english_meanings` | 1382 | 0 |
| `target_language_words` | 1382 | 0 |

## Quality Bar
- Difficulty: 2 (same as B1 — no progression signal between B1 and B2)
- funScore: 5 (flat)
- B2 vocabulary includes country names (Belarus, Germany), technical terms, and specialized vocabulary

## Risk Areas
1. **SELF_ANSWERING (COGNATES)** — 32 cases in JSON where Czech word and English answer are sufficiently similar that the answer appears in the question (bomba/bomb, dieta/diet, farma/farm, filmový/film, formulář/form). At B2, Germanic/Latin loan words in Czech become very common.
2. **SELF_ANSWERING (PROPER NOUNS)** — Country names (Bělorusko/Belarus) and demonyms (Němec/German) where Czech and English are cognates — the explanation contains the English name.
3. **DEFINITION_MATCH SELF_ANSWERING** — 13 cases where explanation text echoes the correct answer.
4. **DIFFICULTY_FLAT** — difficulty=2 same as B1; no progression signal between levels.
5. **COUNTRY_DEMONYM_SCOPE** — At B2, country names and demonyms are valid vocabulary, but they are always partially self-answering when Czech closely mirrors the English name.
