# korean_topik1 — Expectations

## Scope
TOPIK I vocabulary — beginner Korean. 1,368 facts covering approximately 800–1,000 words tested at TOPIK levels 1–2. Source: National Institute of Korean Language (국립국어원, NIKL).

## Canonical Source
NIKL TOPIK vocabulary list (ko-nikl-XXXX fact IDs confirm official NIKL sourcing).

## Sub-decks
None (flat; 2 pools).

## Pool Inventory
| Pool | Facts | Synth |
|------|-------|-------|
| english_meanings | 1,368 | 0 |
| target_language_words | 1,368 | 0 |

## Quiz Templates
`forward`, `reverse`, `definition_match`, `synonym_pick` (no `_fallback` in sample — strong template coverage).

## Quality Bar
- Vocabulary appropriate for TOPIK 1–2 level (everyday words, basic concepts)
- Forward: Korean word → English meaning
- Reverse: English → Korean word (distractors must be Korean words, not English)
- No `reading` template needed (Korean romanization is not a typical test format)

## Risk Areas
1. **POOL-CONTAM in `reverse` template** — 45 of 45 reverse-template rows show English-meaning distractors alongside Korean answers ("How do you say X?" shows English words as wrong options — correct answer is identifiable as the only Korean string)
2. **AMBIGUOUS-Q from multi-meaning answers** — 38 facts have answers like "temple, employee" or "Bibimbap, mixed rice"; quiz question asks for one meaning but answer string contains multiple
3. **SYNONYM-LEAK** — "but, however" (answer) vs "by the way, however" (distractor) share "however"; legitimate risk at this level
4. **No reading pool** — Korean doesn't need romanization testing, but absence of any sub-pool means all templates use same English/Korean pools; pool scope is appropriate
5. **No synthetic distractors** — 0 synth
