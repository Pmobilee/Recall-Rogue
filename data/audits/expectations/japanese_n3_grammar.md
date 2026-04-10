# japanese_n3_grammar — Expectations

## Scope
JLPT N3 grammar — 670 facts. N3 grammar is the largest jump in complexity: introduces clause connectors, conditionals, aspect markers, and formal expression patterns.

## Canonical Source
Standard JLPT N3 grammar reference (CC BY-SA 4.0). Cross-reference: Bunpro N3, Nihongo So-Matome N3.

## Sub-decks
None (flat; 10 semantic pools).

## Pool Inventory
| Pool | Facts |
|------|-------|
| grammar_all | 670 |
| particle_post_noun | 156 |
| clause_connector | 127 |
| particle_post_verb | 30 |
| adverbial | 113 |
| + 5 others | — |

## Quiz Template
`fill_blank_grammar` exclusively — 100%.

## Quality Bar
- N3 grammar points clearly distinguished from N4/N5
- Clause-connector pools must not mix sentence-final and mid-sentence forms
- grammarNote field (extra field observed) should clarify nuance

## Risk Areas
1. **LENGTH-TELL** — 35 of 87 rows (40%) show length disparity; e.g., `為` (2ch) vs `下さいませんか` (8ch)
2. **AMBIGUOUS-Q** — multiple N3 connectors interchangeable in context (ので/から/せいで all causal; と/したら/ば conditional)
3. **SYNONYM-LEAK** — several grammar points overlap semantically: ために/為に, のに/ところを, ながら/つつ
4. **Rare grammar points** — some N3 grammar appears in very few example sentences; distractor pool may recycle heavily
5. **Sentence naturalness** — N3 sentences are more complex; LLM-generated sentences at this level have higher broken-grammar risk
