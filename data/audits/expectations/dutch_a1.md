# dutch_a1 — Audit Expectations

## Intended Scope
CEFR A1 Dutch (Beginner). Covers the most essential Dutch vocabulary for absolute beginners. This deck has only 161 facts — notably smaller than Czech A1 (476 facts) and smaller than the typical A1 target of 300–500 words. May represent an incomplete or pilot subset.

## Canonical Source
- **CEFRLex NT2Lex** (CEFR-aligned Dutch vocabulary list for L2 learners, UCLouvain CENTAL)
- **Kaikki.org** (Wiktionary-derived Dutch definitions)
- Source URL: `https://cental.uclouvain.be/cefrlex/`

## Sub-decks
None. Flat structure with `chainThemeId` cycling 0–9.

## Pool Inventory
| Pool | Facts | Synthetic Distractors |
|------|-------|----------------------|
| `english_meanings` | 161 | 0 |
| `target_language_words` | 161 | 0 |

Small pool (161) means limited distractor variety — at mastery=4 requiring 4 distractors, the engine must reuse items more often.

## Quality Bar
- Difficulty: 1
- funScore: 5 (flat)
- Dutch A1 includes many English cognates (school, week, man, bank, bus)
- Multi-meaning answers common: "friendly, nice" (aardig), "car, automobile" (auto)

## Risk Areas
1. **SELF_ANSWERING (COGNATES)** — 5 perfect cognates (school=school, week=week, man=man, bank=bank, bus=bus). These are always self-answering in forward/reverse/synonym_pick templates and in definition_match.
2. **SMALL POOL SIZE** — 161 facts may be insufficient for adequate distractor variety at higher mastery levels. Pool exhaustion risk.
3. **MULTI-MEANING ANSWERS** — 51 of 161 facts (32%) have comma-separated answers (e.g., "friendly, nice", "car, automobile"). This creates length tells and may cause SYNONYM_LEAK when partial matches appear as distractors.
4. **LENGTH_TELL** — 11 occurrences in dump, mostly driven by cognate facts where the one-word cognate answer is shorter than multi-word English distractors.
5. **POS inconsistency** — "aardig" (friendly, nice) labeled `partOfSpeech: "adverb"` but it is primarily an adjective.
