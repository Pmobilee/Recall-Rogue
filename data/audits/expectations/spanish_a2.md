# spanish_a2 — Expectations

## 1. Intended Scope
CEFR A2 (Waystage) — elementary Spanish vocabulary. Learner can communicate in simple, routine tasks; vocabulary covers everyday topics: shopping, transport, family relationships, basic descriptions.

## 2. Canonical Source
- CEFRLex ELELex frequency lists (confirmed in `sourceName` / `sourceUrl`)
- Instituto Cervantes PCIC A2 lexical inventory as cross-reference

## 3. Sub-deck / Chain Theme List
No sub-decks or chain themes defined. Flat list (873 facts). Fact IDs continue from A1 (es-cefr-1547 onwards), confirming the decks form a sequential series.

## 4. Answer Pool Inventory
- `english_meanings` (873 factIds, 0 syntheticDistractors)
- `target_language_words` (873 factIds, 0 syntheticDistractors)

POS distribution: noun (571), verb (222), adjective (61), adverb (8), preposition (6), other (5). More noun-heavy than A1.

## 5. Expected Quality Bar
Same as A1 — forward/reverse templates, POS consistency within distractor sets, English-only distractors on forward, Spanish-only on reverse.

## 6. Risk Areas
1. **POOL-CONTAM in reverse mode (HIGH)**: Same structural issue as A1 — `target_language_words` pool draws English meanings as distractors for reverse questions.
2. **LENGTH-TELL (MEDIUM)**: Pool mixes short single-word answers ("cow", "access") with multi-word compounds ("dunghill, dung heap"). Ratio violations likely.
3. **POS-TELL (LOWER than A1)**: Higher noun percentage may reduce POS-TELL frequency, but verb/noun mixing remains structurally possible.
4. **Zero synthetic distractors**: No padding, all distractors from same pool → vocabulary cross-contamination.
5. **"Dunghill, dung heap" at A2**: CEFR placement of `estercolero` is suspect — extremely rare word unlikely to appear in A2 exams; may reflect frequency-list artifact rather than genuine A2 vocab.
