# german_b2 — Quiz Audit Findings

## Summary
843 facts, 90 quiz dump entries. No pool-contamination detected in this sample (improved vs A1–B1). POS-tell (5 instances) is the most prevalent MAJOR issue, driven by adjective/verb mixing in the single pool. Self-answering (5 instances at mastery=4) follows the cognate pattern. Length-tell present but less severe than other German decks. One AMBIGUOUS-Q: "entstehend" explanation contains "emerging" twice in different parts of the definition.

| Category | Count |
|---|---|
| BLOCKER | 0 |
| MAJOR | 10 (POS-tell: 5, self-answering: 5) |
| MINOR | 11 (length-tell: 5, compound-answer: 6) |
| NIT | 0 |

---

## Issues

### MAJOR

- **Fact**: `de-cefr-3643` @ mastery=0
- **Category**: `POS-TELL`
- **Rendered**:
  Q: "What does 'entstehend' mean?"
   A) desired, wanted
   B) to emphasize
   C) emerging  ✓
- **Issue**: 1 adjective/participle ("emerging") vs 1 adjective compound ("desired, wanted") vs 1 infinitive verb ("to emphasize"). "to emphasize" is in verb format while both other options are adjectival — POS mismatch makes the verb eliminable.

---

- **Fact**: `de-cefr-3855` @ mastery=0, 2
- **Category**: `POS-TELL`
- **Rendered** (mastery=0):
  Q: "What does 'vereinfachen' mean?"
   A) to simplify  ✓
   B) unhindered
   C) to remove
- **Issue**: 2 infinitive verbs vs 1 adjective "unhindered". The adjective is immediately eliminable for a verb question.

---

- **Additional POS-tell**: 3 more instances in the 90-entry sample — consistent with B1 elevated rate.

---

- **Fact**: `de-cefr-3643` @ mastery=4
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "entstehend — originating, emerging, emerging. Also: nascent"
   A) desired, wanted  B) disappeared  C) to consider  D) to emphasize  E) emerging  ✓
- **Issue**: "emerging" appears twice in the explanation (the definition lists "emerging, emerging" — itself a content error) and then "emerging" is the correct answer. The question stem literally contains the answer twice.

---

- **Fact**: `de-cefr-3367` @ mastery=4
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "Priorität — priority."
   A) priority  ✓  B) objectivity  C) promotion  D) report  E) combustion
- **Issue**: One-word cognate definition IS the answer.

---

- **Fact**: `de-cefr-3918` @ mastery=4
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "äußerst — utmostly, extremely. Also: as the last and least favoured possibility"
   A) fortunately  B) absolutely  C) extremely  ✓  D) predominantly  E) again
- **Issue**: "extremely" appears in the definition "utmostly, extremely". The answer word is present in the explanation string.

---

- **Additional self-answering**: 2 more at mastery=4.

---

### MINOR

- **Fact**: `de-cefr-3550` @ mastery=0
- **Category**: `LENGTH-TELL`
- **Rendered**:
  Q: "What does 'ausgeschrieben' mean?"
   A) diverse, varied  (15 chars)
   B) nap  (3 chars)
   C) written out  ✓  (10 chars)
- **Issue**: "nap" (3 chars) vs "diverse, varied" (15 chars) — ratio 5×.

---

- **Fact**: `de-cefr-3444` @ mastery=4
- **Category**: `LENGTH-TELL`
- **Rendered**:
  Q: "How do you say 'key, button' in German?"
   A) classroom  B) Taste  ✓  C) theory of relativity  D) investment  E) change
- **Issue**: "Taste" (5 chars) vs "theory of relativity" (20 chars) — ratio 4×. "theory of relativity" is an obvious absurd distractor for a B2 vocab deck — does not belong in the German word pool.

---

- **Fact**: `de-cefr-3444` @ mastery=0, 2
- **Category**: `OTHER` (compound answer)
- **Rendered** (mastery=0):
  Q: "What does 'Taste' mean?"
   A) classroom  B) key, button  ✓  C) theory of relativity
- **Issue**: Comma-separated "key, button" against single-word "classroom" and phrase "theory of relativity". Multiple tells simultaneously.

---

- **Additional compound answers**: 5 more instances ("deceased, late", "coarse, rough", "diverse, varied", etc.).

---

## Expected vs Actual
- Expected: B2 pool size (843) would be sufficient for consistent distractors
- Actual: "theory of relativity" appearing as a distractor for "Taste" (key/button) is a semantic absurdity — suggests the distractor selection occasionally draws from very distant semantically unrelated facts in the pool
- Expected: Pool-contamination would continue from A1/A2/B1 pattern
- Actual: No pool-contamination detected in this 90-entry sample — may be sampling variance or the B2 pool happens not to trigger the bug in these 30 facts

## Notes
- The "entstehend — originating, emerging, emerging" definition contains a repeated word ("emerging" appears twice) — this is a content error in the explanation text that should be noted separately from the self-answering issue.
- "theory of relativity" as a distractor for `Taste` (key/button) suggests the pool selection algorithm sampled a very semantically distant fact. This is a POOL-CONTAM edge case where the English meanings pool accidentally includes compound knowledge terms alongside vocabulary translations.
- B2 marks the highest CEFR level for German in this batch — no grammar deck exists for German (unlike French which has A1–B2 grammar). The four German vocabulary decks have consistent structural issues (single pool, no POS separation, no article on nouns) that are architectural rather than content-level.
