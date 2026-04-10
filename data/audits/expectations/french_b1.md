# french_b1 — Expectations

## Scope
Intermediate French vocabulary at CEFR B1 level. 1,412 facts sourced from CEFRLex FLELex + Kaikki.org. Canonical authority: CEFR B1 descriptor + Référentiel B1 pour le français (Beacco et al., Didier). Covers discussion vocabulary: opinions, media, travel, society, abstract concepts. B1 introduces more polysemous and register-sensitive words.

## Sub-Decks
None (0 sub-decks).

## Answer Pool Inventory
- `english_meanings` — 1,412 factIds, 0 syntheticDistractors
- `target_language_words` — 1,412 factIds, 0 syntheticDistractors

No POS-separated pools. The larger fact pool (1,412) provides more distractor variety than A1/A2 but does not fix POS mixing.

## POS Distribution
noun: 805 | verb: 423 | adjective: 97 | adverb: 72 | preposition: 7 | determiner: 1 | number: 5 | conjunction: 1 | interjection: 1

## Quality Bar
Same template set (forward, reverse, definition_match, synonym_pick). At B1 the synonym_pick template is used more (18 of 180 entries = 10%), creating additional risk where semantically close English synonyms appear together.

## Risk Areas
1. **POS-TELL**: Larger verb share (30%) in a single pool. More triples will contain mixed POS at B1.
2. **SELF-ANSWERING**: B1 introduces many English cognates (progresser, stade, préfecture) where the explanation is structurally identical to the answer.
3. **LENGTH-TELL**: More multi-word answers at B1 ("to come back down", "to deep-freeze", "daughter-in-law"). Reverse-mode options mixing French short words with long English phrases create high ratios.
4. **POOL-CONTAM**: One instance of English word "work" appearing as a distractor in reverse mode (French word expected).
5. **SYNONYM-PICK quality**: B1 synonym_pick template tests "Which word is closest in meaning to X?" where distractors may be semantically near enough to be ambiguous.
