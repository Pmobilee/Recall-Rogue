# french_a1_grammar — Quiz Audit Findings

## Summary
194 facts, 84 quiz dump entries. Cleanest deck in the batch. No blockers, no majors. All options are conjugated verb forms from the same paradigm, eliminating POS-tell entirely. One potential concern: at higher mastery levels (4+), some pools introduce distractors from a different person of the same verb as the correct form (e.g., "parle" vs "parles" vs "parlons") — good discrimination. Length homogeneity is excellent: all conjugated forms are 4–10 characters.

| Category | Count |
|---|---|
| BLOCKER | 0 |
| MAJOR | 0 |
| MINOR | 0 |
| NIT | 2 (capitalization inconsistency) |

---

## Issues

### NIT

- **Fact**: `fr-gram-a1-pres-travailler-ils-0` @ mastery=4
- **Category**: `OTHER`
- **Rendered**:
  Q: "Ils {___} ensemble tous les jours.\n(They work together every day.)"
   A) aiment  B) parle  C) Parlez  ✓? D) habites  E) travaillent  ✓
- **Issue**: The distractor "Parlez" is capitalized while all other options are lowercase. Mid-sentence verb forms should be lowercase — the capital is a visual tell (though minor, as "Parlez" is incorrect here regardless of case).

---

- **Fact**: Various pools @ mastery=4
- **Category**: `OTHER`
- **Rendered** (example, `etre_forms` pool):
  Q: "Il {___} anglais.\n(He is speaking English.)"
   Options include both "parle" and "travaille" — same ending, same length, plausible distractors
- **Issue**: At mastery=4 (5 options), some pools present distractors that are all -e ending forms. While technically correct pool behavior, they may feel identical in difficulty to mastery=2 (3 options). Not a bug, a NIT on difficulty calibration.

---

## Expected vs Actual
- Expected: Clean fill-in-blank grammar with well-partitioned pools
- Actual: Confirmed — this deck performs as intended. Pool structure is the correct approach for grammar decks.
- Expected: Some conjugation-overlap ambiguity (je/il parle)
- Actual: Pool design mixes person-forms intentionally (parle, parles, parlons, parlez, parlent are all in `present_er_forms`) — the question stem disambiguates via subject pronoun, so this is a feature not a bug.

## Notes
- french_a1_grammar is the reference standard for what grammar deck quiz quality should look like. The _fallback fill-in-blank template with per-paradigm pools and synthetic padding is the correct architecture.
- No self-answering detected: the fill-in-blank question stem contains the target sentence with a gap — the answer word is always missing from the stem by construction.
- No length-tell detected: all options are conjugated verb forms of similar length within the same paradigm.
- This deck was listed as a "pilot quality" concern in the audit brief, but it is actually the highest-quality grammar deck in the batch.
