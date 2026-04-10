# spanish_b1 — Expectations

## 1. Intended Scope
CEFR B1 (Threshold) — intermediate Spanish vocabulary. Learner handles main points of clear standard input, can express opinions on familiar topics. Vocabulary includes abstract concepts, work/travel/current events domain words.

## 2. Canonical Source
- CEFRLex ELELex frequency lists (`sourceName` / `sourceUrl` confirmed)
- Instituto Cervantes PCIC B1 lexical inventory as cross-reference

## 3. Sub-deck / Chain Theme List
No sub-decks or chain themes. Flat list (596 facts). Fact IDs continue from A2 sequence (es-cefr-2xxx range).

## 4. Answer Pool Inventory
- `english_meanings` (596 factIds, 0 syntheticDistractors)
- `target_language_words` (596 factIds, 0 syntheticDistractors)

POS: noun (377), verb (161), adjective (51), adverb (6), interjection (1).

## 5. Expected Quality Bar
At B1, learners encounter more polysemous words and partial cognates. Quiz should test productive knowledge. Forward/reverse templates expected. No chain themes required for vocab decks.

## 6. Risk Areas
1. **POOL-CONTAM in reverse mode (HIGH)**: Same structural issue — English meanings as distractors on Spanish-answer questions.
2. **POS-TELL (MEDIUM-HIGH)**: Pool mixes verbs and nouns/adjectives; smaller pool (596 vs 1,546 A1) means more frequent reuse of same distractors → POS-TELL surfaces more visibly.
3. **LENGTH-TELL (MEDIUM)**: Intermediate vocabulary has more compound answers; ratio violations expected.
4. **Homograph traps**: B1 introduces more words with multiple POS (e.g., `pendiente` = "earring" [noun] / "pending" [adjective]). Single `partOfSpeech` field may not capture this.
5. **Zero synthetic distractors**: Pool too small for reliable distractor diversity.
