# french_a2 — Quiz Audit Findings

## Summary
538 facts, 90 quiz dump entries. POS-tell is more prevalent than A1 (3 instances in 30 sampled facts, ~10% of sample). Self-answering is the dominant issue type — 9 instances, all at mastery=4 via definition_match. One content flag: an explanation containing explicit anatomical slang terms is exposed as a question stem.

| Category | Count |
|---|---|
| BLOCKER | 0 |
| MAJOR | 12 (POS-tell: 3, self-answering: 9) |
| MINOR | 5 (compound-answer: 5) |
| NIT | 0 |

---

## Issues

### MAJOR

- **Fact**: `fr-cefr-935` @ mastery=0
- **Category**: `POS-TELL`
- **Rendered**:
  Q: "What does 'abriter' mean?"
   A) to shelter  ✓
   B) thrilling
   C) to develop
- **Issue**: 2 verbs ("to shelter", "to develop") vs 1 adjective ("thrilling"). POS mismatch eliminates "thrilling" immediately.

---

- **Fact**: `fr-cefr-936` @ mastery=0
- **Category**: `POS-TELL`
- **Rendered**:
  Q: "What does 'accomplir' mean?"
   A) to accomplish  ✓
   B) mixed
   C) to put down
- **Issue**: 2 verbs vs 1 adjective "mixed". Adjective is immediately eliminable by POS.

---

- **Fact**: `fr-cefr-1170` @ mastery=0
- **Category**: `POS-TELL`
- **Rendered**:
  Q: "What does 'grillé' mean?"
   A) to lead
   B) to reconstruct
   C) grilled  ✓
- **Issue**: Correct answer "grilled" is a past-participle adjective; both distractors are infinitive verbs. POS mismatch makes the non-verb answer immediately identifiable.

---

- **Fact**: `fr-cefr-1123` @ mastery=4
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "enquête — inquest, investigation, examination. Also: survey, inquiry"
   A) meadow  B) wealth  C) investigation  ✓  D) sword  E) wise
- **Issue**: "investigation" appears verbatim in the explanation string rendered as the question stem.

---

- **Fact**: `fr-cefr-935` @ mastery=4
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "abriter — to shelter, to harbour. Also: to host (an object, an event, an institution, etc.), to take cover; to shelter"
   A) to shelter  ✓  B) to develop  C) to televise  D) thrilling  E) to despair
- **Issue**: "to shelter" appears twice in the question stem (primary + secondary definition).

---

- **Fact**: `fr-cefr-1312` @ mastery=4
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "possibilité — possibility."
   A) wonder  B) pomelo  C) clue  D) south-east  E) possibility  ✓
- **Issue**: Cognate self-answer — "possibility" appears verbatim in the one-word definition.

---

- **Additional self-answering facts** (same pattern, mastery=4 definition_match):
  - `fr-cefr-1441` — "voleur — thief...robber" / answer "robber, thief"
  - `fr-cefr-990` — "blé — wheat, corn" / answer "wheat, corn"
  - `fr-cefr-933` (abandonner) — explanation contains "give up" / answer "to give up"
  - `fr-cefr-939` (actualité) — explanation contains "current events" / answer "current events"
  - `fr-cefr-940` (actuellement) — explanation contains "currently" / answer "currently"

---

### MINOR

- **Facts**: `fr-cefr-1441`, `fr-cefr-990`, and 3 additional
- **Category**: `OTHER` (compound correct answer)
- **Issue**: Comma-separated answers ("robber, thief", "wheat, corn") against single-word distractors — the comma is a format tell at mastery=0 and mastery=2.

---

## Expected vs Actual
- Expected: A2 cognates (possibilité, actualité) would be easy self-answering candidates
- Actual: Confirmed — all mastery=4 self-answering instances are cognates or near-cognates where the explanation is essentially a translation of the French word
- Expected: 0 content-flag issues
- Actual: `fr-cefr-934` (abricot) explanation contains "vulva, vagina, female genitalia" — this text is rendered verbatim as a definition_match question. The quiz question reads "abricot — apricot (fruit). Also: apricot (color), vulva, vagina, female genitalia" — inappropriate for a learning context targeting general audiences.

## Notes
- The abricot content flag is an ADULT CONTENT issue, not a quiz quality issue per the taxonomy. Flagged here as OTHER/content-policy risk pending human review.
- POS-tell rate at A2 (~10% of sampled triples) is higher than A1 (~3%). Likely because A2 has a higher verb density as a proportion of total facts. Without POS-split pools the issue will compound at B1/B2.
- Self-answering at definition_match (mastery=4) is systemic across all French vocab decks — the template renders `explanation` as the question, and explanations routinely contain the answer word for cognates.
