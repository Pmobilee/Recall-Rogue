# dutch_a1 — Quiz Audit Findings

## Summary
90 quiz entries (30 facts × 3 mastery levels). Primary issue: 5 perfect Dutch-English cognates create inescapable SELF_ANSWERING across all templates, with `nl-cefr-111` (school=school) appearing 3 times in the 30-fact sample — an outsized share. Definition_match template leaks answers via Wiktionary explanations (4 cases). LENGTH_TELL driven by short cognate answers against longer non-cognate options.

Counts: SELF_ANSWERING×7 (dump), LENGTH_TELL×11, EXPLANATION-MISSING (thin)×4+.

---

## Issues

### BLOCKER

- **Fact**: `nl-cefr-111` @ mastery=0
- **Category**: `SELF-ANSWERING`
- **Rendered** (forward template):
  Q: "What does 'school' mean?"
   A) school  ✓
   B) small, little
   C) sad
- **Issue**: Dutch "school" = English "school". The question contains the answer. Answerable without any knowledge of Dutch. Appears 3 times in the 30-fact sample (mastery 0, 2, 4) meaning it was sampled multiple times.

---

- **Fact**: `nl-cefr-111` @ mastery=2
- **Category**: `SELF-ANSWERING` + `LENGTH_TELL`
- **Rendered** (reverse template):
  Q: "How do you say 'school' in Dutch?"
   A) school  ✓ (6)
   B) small, little (12)
   C) sad (3)
   D) alone (5)
- **Issue**: Dutch answer "school" is identical to the English word in the question. Length ratio = 4× ("small, little" at 12 chars vs "sad" at 3). Two separate issues compounding.

---

- **Fact**: `nl-cefr-111` @ mastery=4
- **Category**: `SELF-ANSWERING`
- **Rendered** (synonym_pick template):
  Q: "Which word is closest in meaning to 'school'?"
   A) school  ✓
   B) alone
   C) sad
   D) small, little
   E) bus, can, tin
- **Issue**: The correct answer IS the word in the question. All five templates are broken for this fact.

---

- **Fact**: `nl-cefr-17` @ mastery=0
- **Category**: `SELF-ANSWERING`
- **Rendered** (definition_match template):
  Q: "broer — brother (male sibling). Also: bro"
   A) brother  ✓
   B) stick
   C) kitchen
   D) female friend
   E) mine
- **Issue**: "brother" appears in the explanation text. Correct answer guessable from question.

---

- **Fact**: `nl-cefr-161` @ mastery=0
- **Category**: `SELF-ANSWERING`
- **Rendered** (definition_match template):
  Q: "zus — sister."
   A) food
   B) shop, store
   C) mine
   D) sister  ✓
   E) female friend
- **Issue**: "sister" in explanation. Particularly clear-cut — the explanation IS the correct answer.

---

### MAJOR

- **Fact**: `nl-cefr-91` (from definition_match analysis)
- **Category**: `SELF-ANSWERING`
- **Rendered** (definition_match):
  Q: "naam — name. Also: reputation"
   Correct: "name"
- **Issue**: "name" in explanation.

---

- **Fact**: deck-wide
- **Category**: `OTHER`
- **Issue**: Pool size of 161 facts is small. At mastery=4, the engine needs 4+ distractors from a pool of 161 other English meanings. The sample already shows "bus, can, tin" appearing as a distractor for "school/synonym_pick" — cross-domain semantic noise due to small pool.

---

### MINOR

- **Fact**: `nl-cefr-111` appearing 3× in 30-fact dump sample
- **Category**: `OTHER`
- **Issue**: With only 161 facts in the deck, the sampling algorithm has high collision rate. In a 30-fact sample, one fact (nl-cefr-111) appears at all three mastery levels, consuming 10% of the sample. This is a deck-size artifact, not a sampling bug, but it reveals the small pool problem.

---

### NIT

- **Fact**: `nl-cefr-1` (aardig)
- **Category**: `OTHER`
- **Issue**: partOfSpeech="adverb" but aardig is primarily an adjective (aardige/aardig). As a standalone form, it functions adverbially only in specific constructions. Minor metadata inaccuracy.

---

## Expected vs Actual
- **Expected**: A1 Dutch tests basic vocabulary knowledge not readable from the question itself.
- **Actual**: 5 cognate facts (school, week, man, bank, bus) are always self-answering; definition_match leaks answers for 4 more.
- **Expected**: Distractor quality is appropriate to the answer category (food-adjacent for food words, etc.).
- **Actual**: "bus, can, tin" appears as a synonym distractor for "school" — cross-domain semantic noise.

## Notes
- Dutch A1 has the lowest fact count in the batch (161 facts vs 161–1382 range). The NT2Lex source may not provide enough A1-level items, or the ingestion pipeline truncated early. Czech A1 has 476 facts for comparison. Expanding to 300+ facts would improve distractor variety and reduce sample collision.
- The cognate problem is inherent to Dutch vocabulary: Dutch and English share Germanic roots, making cognates extremely common even at A1 (school, week, man, bank, bus, auto). These items need special handling — perhaps a "recognition" flag or exclusion from question templates where the Dutch word appears as a clue.
