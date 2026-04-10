# czech_a2 — Audit Expectations

## Intended Scope
CEFR A2 Czech (Elementary). Covers vocabulary beyond A1 basics, expanding into everyday situations: shopping, travel, simple descriptions. CEFR A2 typically adds 500–800 words; this deck has 475 facts — appropriate size.

## Canonical Source
- **Kaikki.org + wordfreq** — same pipeline as A1
- Fact IDs start at `cs-freq-477` (continuing from A1's range)

## Sub-decks
None. Same flat structure as A1.

## Pool Inventory
| Pool | Facts | Synthetic Distractors |
|------|-------|----------------------|
| `english_meanings` | 475 | 0 |
| `target_language_words` | 475 | 0 |

## Quality Bar
- Difficulty: 1 (same as A1 — both A1 and A2 share difficulty=1, should A2 use difficulty=2?)
- funScore: 5 (flat)
- Vocabulary starts including adjectives (moderní/modern), nouns (policejní/police), and proper nouns

## Risk Areas
1. **SELF_ANSWERING** — 2 cognates in JSON (moderní/modern, policejní/police). In dump, 11 definition_match cases where explanation text contains the answer verbatim.
2. **DIFFICULTY_FLAT** — A2 shares difficulty=1 with A1. Players see no progression signal between these two levels.
3. **EXPLANATION_QUALITY** — Wiktionary explanations at this level still tend to be minimal ("scéna — scene."), often just echoing the English translation.
4. **SYNONYM_LEAK** — A2 adds more synonymous pairs (dík = thanks, díky = thanks), increasing the risk that synonyms appear as distractors for each other.
5. **LENGTH_TELL** — Moderate; no extreme cases but multi-word English answers appear against short single words.
