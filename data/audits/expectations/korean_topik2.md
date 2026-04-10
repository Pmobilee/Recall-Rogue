# korean_topik2 — Expectations

## Scope
TOPIK II vocabulary — intermediate/advanced Korean. 2,207 facts covering words for TOPIK levels 3–6. Source: NIKL (national standard).

## Canonical Source
NIKL TOPIK vocabulary list — same source authority as TOPIK I but higher-register vocabulary.

## Sub-decks
None (flat; 2 pools).

## Pool Inventory
| Pool | Facts | Synth |
|------|-------|-------|
| english_meanings | 2,207 | 0 |
| target_language_words | 2,207 | 0 |

## Quiz Templates
`forward`, `reverse`, `definition_match`, `synonym_pick` (0 `_fallback` in 180-row sample — excellent template coverage).

## Quality Bar
- Vocabulary at TOPIK 3–6 level (abstract nouns, formal verbs, academic terms)
- Definitions in `definition_match` should be formal and unambiguous
- Reverse template distractors must be Korean words
- Larger pool (2,207) provides better distractor variety than TOPIK I

## Risk Areas
1. **POOL-CONTAM in `reverse` template** — 49 of 49 reverse rows show English distractors alongside Korean answers; structurally identical to TOPIK I
2. **AMBIGUOUS-Q from multi-meaning answers** — 26 facts have comma-separated answers; higher-register vocabulary tends to be more polysemous
3. **SYNONYM-LEAK** — at TOPIK II level, many near-synonyms exist (어린아이 vs 아이, formal vs informal registers)
4. **No synthetic distractors** — 0 synth
5. **TOPIK I vs TOPIK II level overlap** — intermediate words may appear in both decks; verify no duplication
