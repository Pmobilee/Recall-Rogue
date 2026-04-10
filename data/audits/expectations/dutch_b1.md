# dutch_b1 — Audit Expectations

## Intended Scope
CEFR B1 Dutch (Intermediate). Productive vocabulary for handling most everyday situations, expressing opinions, and understanding main points of standard speech. CEFR B1 adds 1,000–1,500 words; this deck has only 232 facts — significantly under-populated for a B1 level deck (Czech B1 has 976 facts for comparison).

## Canonical Source
- **CEFRLex NT2Lex + Kaikki.org**
- Fact IDs start at `nl-cefr-947`; difficulty=1

## Sub-decks
None.

## Pool Inventory
| Pool | Facts | Synthetic Distractors |
|------|-------|----------------------|
| `english_meanings` | 232 | 0 |
| `target_language_words` | 232 | 0 |

## Quality Bar
- Difficulty: 1 (same as A1 and A2 — no progression whatsoever across three CEFR levels)
- funScore: 5 (flat)
- 6 perfect cognates: CD/cd, drug/drug, mama/mama, periode/period, programma/program, resultaat/result

## Risk Areas
1. **DECK_TOO_SMALL** — 232 facts is insufficient for a B1 deck. Pool size limits distractor variety severely. At mastery=4, 4 distractors from 232 facts is manageable, but thematic clusters reduce effective variety further.
2. **SELF_ANSWERING (COGNATES)** — 5 cognates confirmed in JSON (periode/period, programma/program, resultaat/result, single/single, sport/sport); additional definition_match self-answering in dump (6 cases).
3. **DIFFICULTY_FLAT** — difficulty=1 unchanged from A1, despite representing two full CEFR levels of advancement (B1 is 4 steps above A1).
4. **LENGTH_TELL** — 10 occurrences; multi-word answers ("refrigerator, fridge", "foreign countries, abroad") alongside single-word options create large length ratios.
5. **"SINGLE"** — nl-cefr-1117: Dutch word "single" = English answer "single". Borrowed English word used in Dutch (unmarried/single release).
