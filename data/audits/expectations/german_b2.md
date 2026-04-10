# german_b2 — Expectations

## Scope
Upper-intermediate German vocabulary at CEFR B2 level. 843 facts sourced from Goethe-Institut Profile Deutsch B2 / Goethe Zertifikat B2 word list. Canonical authority: Goethe-Institut Zertifikat B2 official word list and CEFR B2 descriptor. Covers formal and academic vocabulary: political discourse, technical registers, abstract concepts, literary and journalistic language.

## Sub-Decks
None (0 sub-decks).

## Answer Pool Inventory
- `english_meanings` — 843 factIds, 0 syntheticDistractors
- `target_language_words` — 843 factIds, 0 syntheticDistractors

## POS Distribution
noun: 490 | verb: 248 | adjective: 80 | adverb: 18 | preposition: 4 | conjunction: 2 | number: 1

## Quality Bar
At B2 German, the adjective share increases (80/843 ≈ 10% vs 8% at B1). More abstract vocabulary: "Priorität", "äußerst", "entstehend". The pool-contamination issue should be checked — B2 decks may be less affected if the bug has a threshold effect.

## Risk Areas
1. **POS-TELL**: 5 instances in 90 entries — high rate for the sample. B2 adjectives and verb/noun mixing in single pool.
2. **SELF-ANSWERING**: 5 instances at mastery=4. B2 cognates (Priorität→priority, äußerst→extremely) are high risk.
3. **LENGTH-TELL**: 5 instances — lower count than B1 (15) perhaps because B2 vocabulary has more uniformly-long English translations.
4. **COMPOUND ANSWERS**: 6 instances — "key, button", "deceased, late", "diverse, varied" — comma-separated answers at B2.
5. **AMBIGUOUS-Q in `de-cefr-2696`**: "die" in German is ambiguous (Würfel/cube vs sterben/die) — misidentified in german_b1 but de-cefr-2696 appears there.
