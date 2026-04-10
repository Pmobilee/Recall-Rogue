# french_b1_grammar — Quiz Audit Findings

## Summary
348 facts, 87 quiz dump entries. Three length-tell instances, all tied to the same root cause: the `si_imparfait_patterns` pool has synthetic distractors that are complete si-clause sentences rather than conjugated verb forms. The `connecteurs_consecutifs` pool also shows mild length variation. Otherwise, pool design is solid. No self-answering, no POS-tell, no pool contamination.

| Category | Count |
|---|---|
| BLOCKER | 0 |
| MAJOR | 1 (si_imparfait synthetic distractor format error) |
| MINOR | 5 (length-tell: 3, plus 2 additional instances in connecteurs pool) |
| NIT | 0 |

---

## Issues

### MAJOR

- **Fact**: `fr-gram-b1-si-imp-stub-03` @ mastery=0, 2, and 4
- **Category**: `LENGTH-TELL` (MAJOR — ratio up to 10×)
- **Rendered** (mastery=4):
  Q: "Si je {___} voler, je serais oiseau.\n(If I could fly, I would be a bird.)"
   A) avais  (7 chars)
   B) étais  (5 chars)
   C) Si j'avais le temps, je viendrais.  (34 chars)
   D) pouvais  ✓  (7 chars)
   E) Je partirais en vacances si j'avais plus de congés.  (51 chars)
- **Issue**: The correct answer and two distractors are conjugated imparfait forms (5–7 chars). The other two distractors are complete si-clause sentences (34 and 51 chars) — a fundamentally different format. At mastery=4 the player can eliminate the two long options by recognizing they cannot grammatically fill the blank slot "Si je ___ voler". Root cause: synthetic distractors for `si_imparfait_patterns` were generated as complete example sentences rather than isolated verb forms. This pool needs synthetic distractors to be conjugated imparfait forms (voulais, devais, savais, comprenais, etc.), not full clauses.

---

### MINOR

- **Fact**: `fr-gram-b1-rel-dont-3` @ mastery=0, 2, and 4
- **Category**: `LENGTH-TELL`
- **Rendered** (mastery=0):
  Q: "C'est l'étudiant {___} le père est professeur.\n(He is the student whose father is a professor.)"
   A) dont  ✓  (4 chars)
   B) lesquelles  (10 chars)
   C) où  (2 chars)
- **Issue**: "où" (2 chars) vs "lesquelles" (10 chars) — ratio 5×. However, all three are genuine relative pronouns so the length variance is inherent to the French relative pronoun paradigm. Could be `homogeneityExempt` candidate; flagged as MINOR rather than MAJOR.

---

- **Fact**: `fr-gram-b1-consec-3` @ mastery=2 and 4
- **Category**: `LENGTH-TELL`
- **Rendered** (mastery=2):
  Q: "Il a plu toute la semaine, {___} les rues sont inondées.\n(It rained all week so the streets are flooded.)"
   A) de sorte que  ✓? (13 chars)
   B) donc  (4 chars)
   C) si bien que  (12 chars)
   D) tant…que  (8 chars) (wait, correct is "si bien que" ✓)
- **Issue**: "donc" (4 chars) vs "de sorte que" (13 chars) — ratio 3.3×. These are all consecutive discourse markers, but single-word connectors ("donc") are visually shorter than multi-word connectors ("si bien que", "de sorte que"). Length-tell possible if player knows that "donc" is too short to fill the slot given the surrounding clause structure. MINOR.

---

## Expected vs Actual
- Expected: B1 grammar pools would have consistent-format distractors since the template is fill-in-blank
- Actual: `si_imparfait_patterns` has sentence-length synthetics — same root cause as A2 y/en pools, confirming a pattern in how synthetic distractors were generated for "stub" pools with few real facts
- Expected: Relative pronoun pool would show some inherent length variation (dont/où/lequel/lesquelles)
- Actual: Confirmed — the variation is inherent and arguably appropriate since students need to discriminate between these forms

## Notes
- The `si_imparfait_patterns` issue is the B1 equivalent of the A2 `y_pronoun_uses` problem: pools with few real facts (6 in this case) received synthetic distractors in the wrong format — full sentences instead of conjugated forms.
- The connecteurs pools (causals, consecutifs) work well in general: options like "donc", "par conséquent", "si bien que", "de sorte que", "tant…que" are all plausible discourse markers that test genuine discrimination. Length variation is inherent here.
- The rest of the B1 grammar deck (subjonctif pools, conditionnel pools, passif, gérondif) sampled cleanly — good pool design throughout.
