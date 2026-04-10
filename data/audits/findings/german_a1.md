# german_a1 — Quiz Audit Findings

## Summary
1,420 facts, 180 quiz dump entries. Pool-contamination (English words in German reverse-mode options) affects 3 entries — this is a distractor-selection bug shared with german_a2 and german_b1. Self-answering at mastery=4 is pervasive (15 instances), driven by the definition_match template and German cognate density. POS-tell (5 instances) and length-tell (28 instances) are structurally inherent to the single mixed pool.

| Category | Count |
|---|---|
| BLOCKER | 0 |
| MAJOR | 23 (pool-contam: 3, POS-tell: 5, self-answering: 15) |
| MINOR | 34 (length-tell: 28, compound-answer: 6) |
| NIT | 0 |

---

## Issues

### MAJOR

- **Fact**: `de-cefr-593` @ mastery=4
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "How do you say 'square' in German?"
   A) exam
   B) Chinese
   C) Platz  ✓
   D) tower, spire
   E) new
- **Issue**: "exam" and "new" are English words in a reverse-mode question where all options should be German words. "tower, spire" is also an English phrase. Three of five options are English — distractors from the English `english_meanings` pool appear to have been used instead of the `target_language_words` pool. The player can identify the correct answer trivially by finding the one non-English option (Platz).

---

- **Fact**: `de-cefr-677` @ mastery=4
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "How do you say 'sign, plate' in German?"
   A) sound  B) Schild  ✓  C) dream  D) warehouse  E) exam
- **Issue**: "exam" is an English word in the options. All other distractors are also English nouns (sound, dream, warehouse) — only "Schild" is German. Again the English meanings pool has contaminated the reverse-mode question. The correct answer is trivially identifiable as the only capitalized German noun.

---

- **Fact**: `de-cefr-836` @ mastery=4
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "Vater — father."
   A) mistake  B) medicinal herb  C) bedroom  D) report, account  E) father  ✓
- **Issue**: The one-word English definition "father" is the answer. The definition IS the answer.

---

- **Fact**: `de-cefr-75` @ mastery=4
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "Bank — bench (which people sit on); pew. Also: workbench..."
   A) bench  ✓  B) notification  C) red  D) jewelry  E) cafe
- **Issue**: "bench" appears in the opening parenthetical of the explanation rendered as the question stem.

---

- **Fact**: `de-cefr-105` @ mastery=4
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "Biografie — biography."
   A) biography  ✓  B) castle grounds  C) in the afternoon  D) housewife  E) ton
- **Issue**: Classic cognate self-answering — "biography" IS the one-word definition.

---

- **Fact**: `de-cefr-1342` @ mastery=0, 2, 4
- **Category**: `POS-TELL`
- **Rendered** (mastery=0):
  Q: "What does 'verdienen' mean?"
   A) to earn  ✓
   B) to drive away
   C) married
- **Issue**: 2 infinitive verbs vs 1 adjective "married". The adjective is immediately eliminable.

---

- **Additional self-answering**: 12 more instances at mastery=4 — all cognates where the explanation starts with or contains the English answer (Biografie, Priorität, Freundschaft, verschicken, etc.).
- **Additional POS-tell**: 4 more instances across different facts.

---

### MINOR

- **Fact**: `de-cefr-399` @ mastery=0, 2, 4
- **Category**: `LENGTH-TELL`
- **Rendered** (mastery=0):
  Q: "What does 'Kirche' mean?"
   A) church  ✓  (6 chars)
   B) wine  (4 chars)
   C) regional studies  (16 chars)
- **Issue**: "regional studies" (16 chars) is 4× longer than "wine" (4 chars). The multi-word English compound is visually distinct.

---

- **Fact**: `de-cefr-678` @ mastery=0, 4
- **Category**: `LENGTH-TELL`
- **Rendered** (mastery=0):
  Q: "What does 'Schinken' mean?"
   A) ham  ✓  (3 chars)
   B) sometime  (8 chars)
   C) language school  (15 chars)
- **Issue**: ratio 5×. "language school" stands out as a 2-word compound against single-word options.

---

- **Fact**: `de-cefr-51`, `de-cefr-677`, `de-cefr-203` (and 3 more)
- **Category**: `OTHER` (compound correct answer)
- **Issue**: "task, job", "sign, plate", "fair, festival" — comma-separated answers against single-word distractors. The comma is a format tell.

---

- **Additional length-tell**: 25 more instances across the 180-entry sample. Pattern consistent: German nouns with short English equivalents ("ham", "church", "fun") paired against longer English compound distractors.

---

## Expected vs Actual
- Expected: German A1 as the largest deck (1,420 facts) would have the most distractor variety, reducing bad pairings
- Actual: Pool-contamination (English in German slots) is WORSE at A1 than at A2/B1/B2. Likely because the A1 pool is sampled most frequently and some edge case in distractor selection fires more often.
- Expected: German noun capitalization would help students identify German-language options in reverse mode
- Actual: The pool-contamination makes this a cheat — "Platz" is trivially identifiable as the only capitalized word among all-lowercase English distractors

## Notes
- The pool-contamination pattern (English words in reverse-mode German options) affects german_a1, german_a2, and german_b1. It suggests a distractor-selection bug where the engine occasionally pulls from `english_meanings` instead of `target_language_words` for the reverse template. This should be investigated as a systemic engine bug, not per-deck content.
- German nouns lack grammatical article in both correctAnswer ("Kirche") and distractor options. Students never learn whether "Kirche" is "die Kirche" or "der Kirche" from this deck. This is a pedagogical gap — particularly significant for German where gender determines adjective agreement throughout.
- Self-answering at mastery=4 is expected to affect ~30+ facts in the full 1,420-fact deck based on the 15/30 sampled rate.
