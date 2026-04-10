# dutch_a2 — Audit Expectations

## Intended Scope
CEFR A2 Dutch (Elementary). Expands vocabulary into everyday situations, common actions, and basic descriptions. CEFR A2 typically adds 400–600 words; this deck has 785 facts — larger than expected for A2 alone, suggesting it may include A2+ or overlap with lower B1. This is the largest Dutch deck.

## Canonical Source
- **CEFRLex NT2Lex + Kaikki.org**
- Fact IDs start at `nl-cefr-162`; difficulty=1

## Sub-decks
None.

## Pool Inventory
| Pool | Facts | Synthetic Distractors |
|------|-------|----------------------|
| `english_meanings` | 785 | 0 |
| `target_language_words` | 785 | 0 |

## Quality Bar
- Difficulty: 1 (same as A1 — no progression signal)
- funScore: 5 (flat)
- Multi-meaning answers continue (283 of 785 = 36% have commas)
- 18 perfect cognates (best/best, contact/contact, detective/detective, film/film, hand/hand, open/open, plan/plan, student/student, wild/wild)

## Risk Areas
1. **SELF_ANSWERING (COGNATES)** — 18 perfect cognates confirmed in JSON; 10 in dump sample. Dutch-English cognate density higher at A2 than A1.
2. **DEFINITION_MATCH SELF_ANSWERING** — 7 cases in dump where explanation contains the answer.
3. **LENGTH_TELL** — 10 occurrences; multi-meaning comma answers (e.g., "medicine, cure") are longer than single-word distractors.
4. **MULTI-MEANING ANSWER INCONSISTENCY** — 283 facts with comma-separated answers create format inconsistency; sometimes "a, b" vs. sometimes "a; b" (semicolons used in Chinese decks but commas in Dutch).
5. **DIFFICULTY_FLAT** — difficulty=1 same as A1, despite expanded vocabulary scope.
