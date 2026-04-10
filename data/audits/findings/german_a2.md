# german_a2 — Quiz Audit Findings

## Summary
795 facts, 90 quiz dump entries. Pool-contamination (English words in German reverse-mode options) confirmed — 2 instances affecting "bad" and "less" as distractors. POS-tell (2 instances) and self-answering (8 instances at mastery=4) follow the same pattern as other vocabulary decks. One CEFR-level concern: "Wortbildung" (word formation — a linguistics metalanguage term) is placed at A2.

| Category | Count |
|---|---|
| BLOCKER | 0 |
| MAJOR | 12 (pool-contam: 2, POS-tell: 2, self-answering: 8) |
| MINOR | 5 (length-tell: 5) |
| NIT | 1 (CEFR level concern for Wortbildung) |

---

## Issues

### MAJOR

- **Fact**: `de-cefr-1684` @ mastery=2
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "How do you say 'fairy tale' in German?"
   A) Märchen  ✓
   B) ear
   C) car accident
   D) bad
- **Issue**: "bad" is an English adjective appearing in a reverse-mode question where all options should be German nouns. "ear" and "car accident" are also English phrases — the pool-contamination is severe here, with 3 of 4 distractors being English. The correct answer "Märchen" is trivially identifiable as the only German word.

---

- **Fact**: `de-cefr-2134` @ mastery=2
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "How do you say 'unusual' in German?"
   A) ungewöhnlich  ✓
   B) less
   C) expensive
   D) festive
- **Issue**: "less" is an English comparative appearing in a German-word slot. "expensive" and "festive" are also English adjectives — another case of the English meanings pool contaminating the target-language-words pool.

---

- **Fact**: `de-cefr-1859` @ mastery=4
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "Wortbildung — The study of the construction or creation of words from lexical or..."
   A) series  B) word formation  ✓  C) excitement  D) sparkling wine  E) gas station
- **Issue**: "word formation" appears in the explanation (the definition IS "the study of... words from..."). Also flags a CEFR concern: "Wortbildung" is a linguistics metalanguage term — A2 learners study word formation effects but don't typically learn the metalinguistic term for it.

---

- **Fact**: `de-cefr-2161` @ mastery=4
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "verschicken — to send out. Also: to send off"
   A) to connect  B) to send out  ✓  C) to shave  D) to follow  E) to develop
- **Issue**: "to send out" appears verbatim in the explanation.

---

- **Fact**: `de-cefr-1543` @ mastery=4
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "Freundschaft — friendship. Also: relations, relatives"
   A) polite  B) friendship  ✓  C) difficult  D) football match  E) scarce
- **Issue**: "friendship" is the first word of the definition — cognate self-answer.

---

- **Fact**: `de-cefr-1896` @ mastery=0
- **Category**: `POS-TELL`
- **Rendered**:
  Q: "What does 'basteln' mean?"
   A) to burn
   B) to do crafts  ✓
   C) dumpling
- **Issue**: 2 infinitive verbs vs 1 noun "dumpling". Noun is immediately eliminable.

---

- **Fact**: `de-cefr-1894` @ mastery=0
- **Category**: `POS-TELL`
- **Rendered**:
  Q: "What does 'auswandern' mean?"
   A) following
   B) to scatter
   C) to emigrate  ✓
- **Issue**: 2 verbs vs 1 gerund-adjective "following". POS mismatch.

---

- **Additional self-answering**: 5 more at mastery=4 — pattern identical to A1/A2.

---

### MINOR

- **Fact**: `de-cefr-2069` @ mastery=0 and mastery=2
- **Category**: `LENGTH-TELL`
- **Rendered** (mastery=0):
  Q: "What does 'rauf' mean?"
   A) down, downwards  (15 chars)
   B) up  ✓  (2 chars)
   C) along  (5 chars)
- **Issue**: "up" (2 chars) vs "down, downwards" (15 chars) — ratio 7.5×. "rauf" is a colloquial directional adverb; its short English equivalent "up" is visually stark against the compound "down, downwards".

---

- **Additional length-tell**: 4 more instances across directional adverbs and short German words vs long English compound distractors.

---

### NIT

- **Fact**: `de-cefr-1859` (Wortbildung)
- **Category**: `OTHER` (CEFR level placement)
- **Issue**: "Wortbildung" (word formation) is a linguistics terminology term placed in an A2 deck. CEFR A2 learners focus on practical vocabulary; metalinguistic terminology is typically B1+ in German language courses. The word exists in German and may appear in textbooks at A2, but is flagged for human review.

---

## Expected vs Actual
- Expected: A2 (795 facts) would have fewer pool-contamination instances than A1 (1,420 facts)
- Actual: Confirmed — 2 instances at A2 vs 3 instances at A1. But the severity is similar: when contamination fires, most distractors in the option set are English
- Expected: Smaller pool would increase repeated distractor exposure
- Actual: No repeated distractor instances detected in the 90-entry sample

## Notes
- Pool-contamination in German decks is a systemic engine issue. All four German vocabulary decks (A1, A2, B1, B2) show it. The pattern is consistent: in reverse-mode questions, the distractor source falls back to `english_meanings` for some entries, producing English distractors in German-word slots.
- The "Wortbildung" self-answering is particularly egregious: the explanation "The study of the construction or creation of words from lexical or grammatical elements" directly defines "word formation" — the answer appears both semantically (the definition IS "word formation") and literally in the expanded explanation.
