# french_b1 — Quiz Audit Findings

## Summary
1,412 facts, 180 quiz dump entries (largest French vocab sample). POS-tell (7 instances) and self-answering (17 instances) are both elevated vs A1/A2 — consistent with larger verb share and more cognates. One pool-contamination instance (English word in French-word reverse slot). Length-tell is significant in reverse mode where short French words compete against English compound phrases.

| Category | Count |
|---|---|
| BLOCKER | 0 |
| MAJOR | 25 (POS-tell: 7, self-answering: 17, pool-contam: 1) |
| MINOR | 23 (length-tell: 12, compound-answer: 11) |
| NIT | 0 |

---

## Issues

### MAJOR

- **Fact**: `fr-cefr-2447` @ mastery=0
- **Category**: `POS-TELL`
- **Rendered**:
  Q: "What does 'provenir' mean?"
   A) to deep-freeze
   B) broadcasting
   C) to originate  ✓
- **Issue**: 2 infinitive verbs vs 1 gerund-noun "broadcasting". POS mismatch eliminates "broadcasting".

---

- **Fact**: `fr-cefr-1960` @ mastery=0 and mastery=2
- **Category**: `POS-TELL`
- **Rendered** (mastery=2):
  Q: "What does 'exiger' mean?"
   A) to force  B) to demand  ✓  C) to mix  D) turning
- **Issue**: 3 infinitive verbs vs 1 gerund "turning". The lone noun is trivially eliminable.

---

- **Fact**: `fr-cefr-2453` @ mastery=4
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "How do you say 'prefecture' in French?"
   A) vine  B) work  C) préfecture  ✓  D) election  E) software
- **Issue**: "work" is an English word appearing as a distractor in a reverse-mode question where all options should be French words. The player is choosing between French target-language words; "work" is in the wrong language.

---

- **Fact**: `fr-cefr-2380` @ mastery=4
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "pique-niquer — to picnic."
   A) to picnic  ✓  B) to include  C) to fit  D) to doubt  E) to hunt
- **Issue**: Definition IS the answer. The explanation "to picnic" is rendered as the question; correct answer is "to picnic".

---

- **Fact**: `fr-cefr-2668` @ mastery=4
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "stade — stadion (Ancient Greek unit of measurement). Also: stadium (Greek race course...)"
   A) joke  B) stadium  ✓  C) poem  D) debt  E) politeness
- **Issue**: "stadium" appears in the explanation parenthetical "(Greek race course... = stadium)".

---

- **Fact**: `fr-cefr-2440` @ mastery=4
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "progresser — to progress (to show a progression)."
   A) to be worth  B) to progress  ✓  C) to recommend  D) to stop  E) to smother
- **Issue**: "to progress" appears verbatim in the parenthetical definition.

---

- **Additional self-answering facts** (same mastery=4 pattern, total 17): `fr-cefr-2701` (taper/to tap), `fr-cefr-1580` (bagage/baggage), and 13 other cognate/near-cognate entries where the explanation contains the English answer.

---

### MINOR

- **Fact**: `fr-cefr-2701` @ mastery=2
- **Category**: `LENGTH-TELL`
- **Rendered**:
  Q: "How do you say 'to tap' in French?"
   A) to break  B) to come back down  C) to redo  D) taper  ✓
- **Issue**: "taper" (5 chars) vs "to come back down" (17 chars) — ratio 3.4×. In a reverse-mode question the single short French word stands out against English phrase distractors.

---

- **Fact**: `fr-cefr-2642` @ mastery=0, 2, and 4
- **Category**: `OTHER` (compound correct answer)
- **Rendered** (mastery=0):
  Q: "What does 'siège' mean?"
   A) resource  B) giant  C) seat, chair  ✓
- **Issue**: Comma-separated "seat, chair" vs single-word distractors — format tell across all mastery levels for this fact.

---

## Expected vs Actual
- Expected: B1 cognate density would drive self-answering higher than A1/A2
- Actual: 17 self-answering instances vs 3 at A1 and 9 at A2 — confirmed trend
- Expected: Pool-contamination would be rare (single pool, same language)
- Actual: One English-word-in-French-slot instance at `fr-cefr-2453` — likely a distractor from the English `english_meanings` pool bleeding into the `target_language_words` pool

## Notes
- The pool-contamination at `fr-cefr-2453` suggests the reverse-mode distractor selection may be accidentally pulling from the English meanings pool instead of the target-language-words pool in edge cases. This could be a distractor-selection bug affecting other decks too — worth checking systematically.
- Length-tell in reverse mode is structurally caused by the reverse template mixing short French target words (5–8 chars) with longer English phrase distractors. A separate `target_language_words` pool with language-filtered distractors would eliminate this entirely.
- POS-tell rate at B1 (~7 in 180 entries ≈ 4%) is consistent with A2 rate when normalized for sample size.
