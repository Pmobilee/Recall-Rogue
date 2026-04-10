# french_a2 — Expectations

## Scope
Elementary French vocabulary at CEFR A2 level. 538 facts sourced from CEFRLex FLELex + Kaikki.org. Canonical authority: CEFR A2 descriptor + Référentiel A2 pour le français (Beacco et al., Didier). Covers extended everyday vocabulary: shopping, travel, food, feelings, basic descriptions.

## Sub-Decks
None (0 sub-decks). Facts distinguished by chainThemeId cycling 0–5.

## Answer Pool Inventory
- `english_meanings` — 538 factIds, 0 syntheticDistractors
- `target_language_words` — 538 factIds, 0 syntheticDistractors

All facts map to `english_meanings`. No POS-separated pools.

## POS Distribution
noun: 345 | verb: 144 | adjective: 33 | adverb: 11 | preposition: 3 | conjunction: 2

## Quality Bar
Same template set as A1: forward, reverse, definition_match, synonym_pick. Distractors exclusively from pool; 0 synthetics means any pool sampling gap will surface repeated or unsuitable distractors.

## Risk Areas
1. **POS-TELL**: Same single-pool issue as A1 — verbs, nouns, and adjectives in one pool. At A2 the verb share is high (~27%), making mixed-POS triples common.
2. **SELF-ANSWERING at mastery=4**: definition_match template fires for all entries; explanation strings routinely contain the answer word (particularly for cognates and near-cognates).
3. **COMPOUND CORRECT ANSWERS**: Multiple entries have comma-separated answers ("robber, thief", "wheat, corn") — when distractors are single words the comma is a length and format tell.
4. **CEFR BOUNDARY**: Some A2 words (e.g., "enquête" — inquest) are arguably B1 level; reverse leakage would inflate difficulty for A2 learners.
5. **CONTENT NOTE**: Explanation for `abricot` includes vulgar secondary meanings ("vulva, vagina, female genitalia") — this explanation text appears in definition_match quizzes visible to all learners including minors.
