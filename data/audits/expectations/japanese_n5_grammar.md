# japanese_n5_grammar — Expectations

## Scope
JLPT N5 grammar — 375 facts covering all canonical N5 grammar patterns. Fill-in-the-blank sentence format with furigana, romaji, and English translation.

## Canonical Source
FJSD + standard textbook (CC BY-SA 4.0), referenced via jlptsensei.com/jlpt-n5-grammar-list/. Bunpro N5 grammar list is a cross-reference standard.

## Sub-decks
None (flat deck; 8 semantic pools used for distractor scoping).

## Pool Inventory
| Pool | Facts |
|------|-------|
| grammar_all | 375 |
| particle_case | 114 |
| question_word | 22 |
| verb_form | 149 |
| demonstrative | 15 |
| existence_pattern | 9 |
| sentence_ender | 60 |
| adjective_form | 6 |

## Quiz Template
`fill_blank_grammar` exclusively — 100% across all 90 sampled rows.

## Quality Bar
- Sentences grammatically natural, not textbook-stilted
- Distractors from same semantic pool (particles with particles, verb forms with verb forms)
- Translation present and accurate in all facts
- grammarPointLabel field populated for all facts

## Risk Areas
1. **LENGTH-TELL** — 54 of 90 rows (60%) have option sets with max/min character ratio > 3× (e.g., `に` vs `てはいけません`)  — single particles paired with multi-morpheme grammar structures
2. **SYNONYM-LEAK / AMBIGUOUS-Q** — particle questions where multiple particles could be grammatically valid (e.g., `と` vs `や` both valid "and" particles in some contexts)
3. **Pool semantic diversity** — `grammar_all` pool (375 facts) likely draws distrators across wildly different grammar types, reducing quiz coherence
4. **adjective_form pool** — only 6 facts; distractor variety is very low for adjective questions
5. **DUPLICATE-OPT risk** — small pools (demonstrative: 15, adjective_form: 6) may produce repeated distractors
