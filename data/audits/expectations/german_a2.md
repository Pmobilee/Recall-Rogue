# german_a2 — Expectations

## Scope
Elementary German vocabulary at CEFR A2 level. 795 facts sourced from Goethe-Institut Profile Deutsch A2 and CEFRLex. Canonical authority: Goethe-Institut Zertifikat A2: Fit in Deutsch 2 word list and CEFR A2 descriptor. Covers extended everyday vocabulary: work, travel, feelings, daily routines, basic social interactions.

## Sub-Decks
None (0 sub-decks).

## Answer Pool Inventory
- `english_meanings` — 795 factIds, 0 syntheticDistractors
- `target_language_words` — 795 factIds, 0 syntheticDistractors

Single pool per language direction. No POS separation.

## POS Distribution
noun: 507 | verb: 202 | adjective: 46 | adverb: 26 | preposition: 7 | conjunction: 4 | number: 2 | pronoun: 1

## Quality Bar
Same template set as A1. At A2 the verb/noun ratio (202/507 ≈ 40%) is lower than A1, which should reduce POS-tell frequency somewhat. However the risk of pool-contamination persists from the same engine bug seen in A1.

## Risk Areas
1. **POOL-CONTAM**: Same English-in-German-slot bug as A1 — confirmed 2 instances ("bad" in fairy-tale options, "less" in unusual options).
2. **POS-TELL**: Same single-pool issue — 2 instances observed.
3. **SELF-ANSWERING at mastery=4**: 8 instances — lower count than A1 (15) consistent with smaller fact count and fewer cognates.
4. **LENGTH-TELL**: Short German words/adverbs ("rauf"=4 chars) against long English compounds ("down, downwards"=15 chars) — 5 instances.
5. **CEFR BOUNDARY**: "Wortbildung" (word formation) in an A2 deck — this is a linguistics/grammar metalanguage term more appropriate to B1/B2 level learners.
