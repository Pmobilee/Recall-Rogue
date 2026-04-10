# german_b1 — Expectations

## Scope
Intermediate German vocabulary at CEFR B1 level. 867 facts sourced from Goethe-Institut Profile Deutsch B1 / Zertifikat B1 word list. Canonical authority: Goethe-Institut Zertifikat B1 (formerly Zertifikat Deutsch) official word list and CEFR B1 descriptor. Covers vocabulary for expressing opinions, discussing media, describing experiences, social topics.

## Sub-Decks
None (0 sub-decks).

## Answer Pool Inventory
- `english_meanings` — 867 factIds, 0 syntheticDistractors
- `target_language_words` — 867 factIds, 0 syntheticDistractors

## POS Distribution
noun: 533 | verb: 231 | adjective: 66 | adverb: 18 | preposition: 8 | conjunction: 7 | determiner: 1 | number: 2 | particle: 1

## Quality Bar
At B1 German, vocabulary becomes more abstract: compound nouns (Bundeskanzer, Personalabteiling), formal register words, and polysemous verbs. These create additional self-answering risk (cognates and near-cognates) and length variation.

## Risk Areas
1. **POOL-CONTAM**: Confirmed 1 instance (English words "old", "out" in German reverse-mode options). Same systemic bug as A1/A2.
2. **POS-TELL**: 6 instances — highest POS-tell rate among German decks (normalized to sample size). B1 has more abstract verbs and adjectives competing in the same pool.
3. **SELF-ANSWERING**: 9 instances at mastery=4 — consistent rate with A1 (normalized).
4. **LENGTH-TELL**: 15 instances — B1 introduces longer compound nouns ("job advertisement", "federal chancellor", "workplace accident") as English translations, creating high ratios against short German words.
5. **GERMAN COMPOUND NOUN TRANSLATION**: "lauten" (to be/to read) has a complex multi-meaning explanation. The definition_match template makes "to read" self-answering from the explanation.
