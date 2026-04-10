# french_a2_grammar — Quiz Audit Findings

## Summary
354 facts, 75 quiz dump entries. The dominant issue is extreme length-tell in the `y_pronoun_uses` and `en_pronoun_uses` pools, where the correct answer is a single character ("y" or "en") but distractors are full French sentences. The ratio reaches 19× — the worst length-tell in the entire batch. Additional length-tell in `superlatif_forms`, `imperatif_tu_forms`, `comparatif_plus_moins_aussi`, and `time_expressions_passe`.

| Category | Count |
|---|---|
| BLOCKER | 0 |
| MAJOR | 3 (pool design: y/en synthetics are wrong type — 3 distinct pool instances, same root cause) |
| MINOR | 14 (length-tell: 14) |
| NIT | 0 |

---

## Issues

### MAJOR

- **Fact**: `fr-gram-a2-yen-y-03` @ mastery=0, 2, and 4
- **Category**: `LENGTH-TELL` (severity upgraded to MAJOR due to 19× ratio)
- **Rendered** (mastery=0):
  Q: "Je suis également allé là-bas. → J'{___} suis également allé.\n(I also went there...)"
   A) y  ✓
   B) Ils lui sont allés.
   C) J'en vais.
- **Issue**: Correct answer "y" is 1 character. Distractors are complete sentences (10–19 chars). The single-letter answer is immediately visually distinguishable from the sentence-length distractors regardless of French knowledge. A 19× length ratio makes this a trivially easy guess. Root cause: synthetic distractors for `y_pronoun_uses` are full sentences, not short pronoun alternatives (like "en", "lui", "leur").

---

- **Fact**: `fr-gram-a2-yen-en-01` @ mastery=0, 2, and 4
- **Category**: `LENGTH-TELL` (severity MAJOR — 8.5× ratio)
- **Rendered** (mastery=2):
  Q: "Je ne veux plus de café. → Je n'{___} veux plus.\n(I don't want any more coffee.)"
   A) Je n'y veux plus.
   B) en  ✓
   C) J'y ai trois.
   D) J'en suis allé.
- **Issue**: "en" is 2 characters; all distractors are full sentences (10–17 chars). The same root cause as `y_pronoun_uses` — en/y pronoun facts should have short-form distractors (other pronouns: "y", "lui", "me", "te", "le", "la") not full sentences.

---

- **Fact**: `fr-gram-a2-comp-aussi-que-2` @ mastery=4
- **Category**: `LENGTH-TELL`
- **Rendered**:
  Q: "Ma sœur est {___} mon frère.\n(My sister is as intelligent as my brother.)"
   A) aussi intelligente que  ✓
   B) aussi bon que
   C) moins cher que
   D) plus grand que
   E) que
- **Issue**: "que" (3 chars) vs "aussi intelligente que" (21 chars) — ratio 7×. The outlier option "que" is obviously too short to fill "est ___ mon frère" grammatically.

---

### MINOR

- **Fact**: `fr-gram-a2-superlatif-le-moins-0` @ mastery=0, 2, and 4
- **Category**: `LENGTH-TELL`
- **Rendered** (mastery=0):
  Q: "Cherchez {___} hôtel de la région.\n(Look for the cheapest hotel...)"
   A) le moins cher  ✓
   B) la moins difficile
   C) de
- **Issue**: "de" (2 chars) vs "la moins difficile" (18 chars) — ratio 9×. "de" is obviously wrong for filling a superlative slot.

---

- **Fact**: `fr-gram-a2-imp-tu-prendre-0` @ mastery=0, 2, and 4
- **Category**: `LENGTH-TELL`
- **Rendered** (mastery=0):
  Q: "{___} l'autre chaise!\n(Take the other chair!)"
   A) aie
   B) ne parle pas  ✓?
   C) prends  ✓
- **Issue**: "aie" (3 chars) vs "ne parle pas" (12 chars) — ratio 4×. The negative form "ne parle pas" is structurally a different length category.

---

- **Fact**: `fr-gram-a2-time-passe-0` @ mastery=0, 2, and 4
- **Category**: `LENGTH-TELL`
- **Rendered** (mastery=0):
  Q: "J'ai pris froid {___}.\n(I caught a cold yesterday.)"
   A) hier  ✓
   B) avant-hier
   C) l'année dernière
- **Issue**: "hier" (4 chars) vs "l'année dernière" (16 chars) — ratio 4×. However, the time-expression pool is inherently variable in length; this may be exempt if the pool is marked `homogeneityExempt`.

---

- **Fact**: `fr-gram-a2-depuis-pendant-3` @ mastery=4
- **Category**: `LENGTH-TELL`
- **Rendered**:
  Q: "J'ai lu {___} une heure avant de dormir.\n(I read for an hour before sleeping.)"
   A) depuis  B) il y a  C) dans  D) pendant des heures depuis  E) pendant  ✓
- **Issue**: "pendant des heures depuis" (25 chars) is a malformed distractor — it's neither a plausible completion nor the right format. Likely a synthetic generated from combining two time expressions.

---

## Expected vs Actual
- Expected: A2 grammar pools would be cleanly partitioned with appropriate short-form distractors
- Actual: `y_pronoun_uses` and `en_pronoun_uses` pools have sentence-length synthetics instead of pronoun alternatives — pool design error, not a sampling issue
- Expected: `temps_expressions` length variation would be inherent (exempt)
- Actual: The "pendant des heures depuis" distractor at mastery=4 is malformed and should not appear — it is not a valid time expression

## Notes
- The y/en pool length-tell is the most severe issue found across all 12 decks in this batch (19× ratio). The fix requires replacing the synthetic distractors in `y_pronoun_uses` and `en_pronoun_uses` with short-form pronoun alternatives ("lui", "me", "te", "le", "la", "nous", "vous").
- The `fr-gram-a2-relatif-2` pool shows "ceux dont" (8 chars) vs "que" (3 chars) — minor ratio but "ceux dont" is also a plausible relative pronoun construction, so this is more a MAJOR AMBIGUOUS-Q than a length-tell.
- All french_a2_grammar issues are in the pool design / synthetic distractor domain — the actual sentence content and correct answers are pedagogically sound.
