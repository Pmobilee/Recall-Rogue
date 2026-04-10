# french_b2_grammar — Quiz Audit Findings

## Summary
397 facts, 93 quiz dump entries. Six length-tell instances across three pools. Two structural quality issues: a truncated/malformed distractor in the concordance pool, and an ambiguous quiz format in the opinion_negative pool where all options express semantically equivalent ideas. Mise en relief pools have an inherent ambiguity: the question specifies a target element but multiple syntactically valid cleft sentences could be constructed.

| Category | Count |
|---|---|
| BLOCKER | 0 |
| MAJOR | 2 (malformed distractor: 1, ambiguous-Q: 1) |
| MINOR | 4 (length-tell: 4) |
| NIT | 2 (parenthetical encoding in option, mixed_conditionals minor length) |

---

## Issues

### MAJOR

- **Fact**: `fr-gram-b2-concord-005` @ mastery=2 and mastery=4
- **Category**: `BROKEN-GRAMMAR` / `OTHER` (malformed distractor)
- **Rendered** (mastery=2):
  Q: "Je veux qu'elle {___} la vérité.\n(I want her to tell the truth.)\nContext: The telling is desired but not yet done."
   A) subjonctif présent  ✓
   B) subjonctif imparfait
   C) qu'il vienne demain (présent  ← MALFORMED
   D) subjonctif passé
- **Issue**: Distractor "qu'il vienne demain (présent" is a truncated option — an incomplete parenthetical that was cut off. The option reads like a sentence fragment with an unclosed parenthesis. At mastery=4 there are two such malformed distractors: "qu'il vienne demain (présent" and "qu'il fasse ses devoirs (présent". These are not valid answers and the malformation makes them eliminable immediately.

---

- **Fact**: `fr-gram-b2-subord-019` @ mastery=0, 2, and 4
- **Category**: `AMBIGUOUS-Q`
- **Rendered** (mastery=0):
  Q: "Après avoir analysé toutes les options, {___}.\n(After analyzing all the options, I'm not sure this is the best solution.)"
   A) je ne suis pas certain(e) que ce plan fonctionne
   B) je ne suis pas sûr(e) que ce soit la meilleure solution  ✓
   C) je ne crois pas qu'il puisse réussir
- **Issue**: All three options are grammatically correct B2 negative-opinion subjonctif constructions. The question stem is translated as "I'm not sure this is the best solution" — which maps precisely to option B but a student completing this in French could reasonably produce any of the three. The quiz is testing which of three plausible correct answers was authored, not grammar knowledge. The parenthetical "(e)" in the correct answer also introduces a gender-neutral rendering that is awkward as a multiple-choice option.

---

### MINOR

- **Fact**: `fr-gram-b2-disc-passe-040` @ mastery=0, 2, and 4
- **Category**: `LENGTH-TELL`
- **Rendered** (mastery=0):
  Q: "Direct: « Le mois prochain, je déménagerai. » → Dans le discours rapporté au passé, le mois prochain devient…"
   A) le mois suivant  ✓  (15 chars)
   B) là  (2 chars)
   C) ce jour-là  (10 chars)
- **Issue**: "là" (2 chars) is visually isolated from all other temporal marker options (10–15 chars). The single bare adverb "là" is structurally different from multi-word temporal expressions and would not fit "le mois prochain devient là" grammatically — student could eliminate it without temporal marker knowledge.

---

- **Fact**: `fr-gram-b2-conn-addition-07` @ mastery=2 and mastery=4
- **Category**: `LENGTH-TELL`
- **Rendered** (mastery=2):
  Q: "Ce résultat est surprenant, {___} choquant pour certains observateurs."
   A) voire  ✓  (5 chars)
   B) en outre  (8 chars)
   C) de plus  (7 chars)
   D) non seulement…mais aussi  (24 chars)
- **Issue**: "non seulement…mais aussi" (24 chars) is 4.8× longer than "voire" (5 chars). The multi-word connector cannot fit "surprenant, ___ choquant" grammatically since "non seulement…mais aussi" requires a binary clause structure — a student who knows French can eliminate it, but the length itself is also a tell.

---

### NIT

- **Fact**: `fr-gram-b2-si-t3-023` @ mastery=4
- **Category**: `LENGTH-TELL` (NIT — ratio at 3×, borderline)
- **Rendered**:
  Q: "Si elle n'avait pas quitté Paris, elle {___}.\n(If she hadn't left Paris, she would still be living there.)"
   A) serais moins fatigué  (20 chars, wrong person agreement)
   B) voudrait  (8 chars)
   C) serais médecin  (14 chars, wrong person)
   D) pourrions voyager  (17 chars, wrong person)
   E) habiterait encore là-bas  ✓  (24 chars)
- **Issue**: Length ratio 3× but also note: options A, C, D use "serais/pourrions" (1st person forms) when subject is "elle" (3rd person) — these are arguably eliminable by person agreement. However, this is the pool testing mixed conditionals, and including wrong-person forms may be intentional as a discrimination point.

---

- **Fact**: Various `opinion_negative_subj` entries
- **Category**: `OTHER` (parenthetical gender notation in answer)
- **Issue**: "je ne suis pas sûr(e)" and "je ne suis pas certain(e)" encode feminine forms in parentheses. As a fill-in-blank option this renders visually as punctuation noise. Minor presentation issue.

---

## Expected vs Actual
- Expected: B2 grammar pools with 0 synthetics would have consistent real-fact options
- Actual: The concordance pool has malformed distractor strings containing truncated parentheticals — likely a data entry error during fact authoring, not a generation artifact
- Expected: Mise en relief pool would be straightforward (correct sentence highlights the specified element)
- Actual: Mise en relief pools work correctly — the question includes the specific element to cleft (e.g., "le sujet « elle »") and the correct option uses that exact element. The format is unambiguous.
- Expected: discours_rapporte_temps_markers would have length-consistent temporal markers
- Actual: "là" as a single-word adverb is inherently shorter than multi-word temporal markers — this is a domain-inherent variation. However ratio 7.5× exceeds the 3× threshold significantly.

## Notes
- The malformed distractors in `concordance_subj_present_passe` ("qu'il vienne demain (présent") look like partial example sentences that were truncated during data entry. The pool contains both metalinguistic labels ("subjonctif présent", "subjonctif passé") and example sentences in mixed format — a pool-design inconsistency.
- The `discours_rapporte_temps_markers` pool inherently mixes single adverbs ("là", "alors", "là-bas") with multi-word phrases ("le lendemain", "le mois suivant", "à ce moment-là"). This pool should be flagged as `homogeneityExempt` if the variation is accepted, or split into short-marker and long-marker sub-pools.
- The mixed_conditionals pool at mastery=4 shows wrong-person conditional forms as distractors (serais/pourrions when subject is elle) — this could be intentional (teaching person agreement in conditionals) or accidental pool design. Ambiguous.
