# dutch_b2 — Audit Expectations

## Intended Scope
CEFR B2 Dutch (Upper-Intermediate). Fluency for most everyday and professional contexts, understanding complex text. CEFR B2 adds 1,500–2,000 words; this deck has only 71 facts — critically undersized. The smallest deck in the entire batch. Czech B2 has 1,382 facts for comparison.

## Canonical Source
- **CEFRLex NT2Lex + Kaikki.org**
- Fact IDs start at `nl-cefr-1195`; difficulty=1

## Sub-decks
None.

## Pool Inventory
| Pool | Facts | Synthetic Distractors |
|------|-------|----------------------|
| `english_meanings` | 71 | 0 |
| `target_language_words` | 71 | 0 |

Pool of 71 is severely small. At mastery=4 requiring 4 distractors, only 70 other facts available. The sample sees heavy pool recycling.

## Quality Bar
- Difficulty: 1 (unchanged from A1 through B2 — no difficulty progression across all four Dutch CEFR levels)
- funScore: 5 (flat)
- 3 perfect cognates (conflict/conflict, festival/festival, gamer/gamer)

## Risk Areas
1. **DECK_CRITICALLY_SMALL** — 71 facts for a B2 deck is 95% below expectation. This deck is effectively a placeholder or stub.
2. **SELF_ANSWERING (COGNATES)** — 3 of 71 facts (4.2%) are perfect cognates; in a 30-fact dump sample, all 3 appear repeatedly.
3. **POOL_EXHAUSTION** — With 71 facts, the engine running mastery=4 (needing 4 distractors) has only 70 other facts to draw from. Option diversity is critically limited.
4. **LENGTH_TELL** — 6 occurrences; multi-word answers vs. short single words creates ratios up to 4.8×.
5. **GAMER** — nl-cefr-1206: "gamer" is an English loanword used in Dutch; its inclusion in a B2 deck and its triviality (answer = the word itself) is questionable for a language learning deck.
