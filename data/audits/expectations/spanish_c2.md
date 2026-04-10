# spanish_c2 — Expectations

## 1. Intended Scope
CEFR C2 (Mastery) — near-native Spanish vocabulary. Literary, archaic, rhetorical, philosophical, legal, and specialized academic register. Words a native educated speaker uses but a learner rarely encounters before C2.

## 2. Canonical Source
- CEFRLex ELELex or curated C2 word list (`sourceName` field not present in sample facts)
- Instituto Cervantes PCIC C2 as cross-reference
- C2 is the only vocab deck with chain themes (9 thematic groups) and `spanish_words` pool alongside `english_meanings`

## 3. Sub-deck / Chain Theme List
9 chain themes defined (no sub-decks):
- Literary & Poetic Register, Formal & Administrative, Philosophy & Rhetoric, Law & Justice, Science & Academia, Archaic & Rare, Mind & Abstract, Politics & Economics, Arts & Culture

## 4. Answer Pool Inventory
- `english_meanings` (794 factIds, 10 syntheticDistractors) — only vocab deck with synthetic distractors
- `spanish_words` (794 factIds, 0 syntheticDistractors) — used for reverse template

Both pools cover all 794 facts. Chain themes present but no sub-decks defined — theme grouping is logical only.

## 5. Expected Quality Bar
C2 vocabulary is inherently advanced and low-frequency. Quiz must test whether learner knows the precise English equivalent of a rare Spanish word. `synonym_pick` and `definition_match` templates used at higher mastery — correct distractor pool is essential.

## 6. Risk Areas
1. **POOL-CONTAM in reverse mode (MEDIUM)**: `spanish_words` pool distractors appear to be drawn correctly from Spanish words, but some contamination with English meanings observed (8 items in 90-item sample).
2. **LENGTH-TELL (LOW)**: Only 7 items — C2 pool's limited synthetic distractors (10 total) and narrow vocabulary range may help homogeneity, but some compound-answer vs single-word mismatches exist.
3. **SYNONYM-LEAK in definition_match / synonym_pick**: C2 words have rich synonyms; distractors like "haughtiness, arrogance" could be genuinely synonymous with expected C2 answers.
4. **`spanish_words` pool has 0 synthetic distractors**: Reverse-mode questions will always draw from the same 794-word Spanish pool — if the distractor set doesn't include near-synonyms, questions become trivial or language-contaminated.
5. **Gender form questions**: `estrafalaria` (feminine) vs `estrafalario` (masculine) — a question "How do you say 'outlandish (feminine)' in Spanish?" parenthetically reveals the answer's gender; all distractors should be feminine-form adjectives.
