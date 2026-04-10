# spanish_b1 — Quiz Audit Findings

## Summary
90 quiz items sampled (30 facts × 3 mastery levels). 55 flagged items. All three major defects present: POOL-CONTAM (19 items), POS-TELL (10 items), LENGTH-TELL (23 items). Same structural root cause as A1/A2. A notable case is `pendiente` — a homograph with both noun and adjective senses — appearing with verb distractors, making it a dual POS-TELL issue.

## Issues

### BLOCKER

- **Fact**: `es-cefr-2579` @ mastery=4
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "How do you say 'hanging' in Spanish?"
   A) to happen, to occur
   B) to integrate
   C) to confront, to face
   D) to adorn
   E) cuelga  ✓
- **Issue**: Reverse question; all four distractors are English verb phrases. `cuelga` is trivially identifiable as the only Spanish word.

---

- **Fact**: `es-cefr-2579` @ mastery=0
- **Category**: `POS-TELL`
- **Rendered**:
  Q: "What does 'cuelga' mean?"
   A) to adorn
   B) to happen, to occur
   C) hanging  ✓
- **Issue**: `cuelga` is the 3rd-person singular present of `colgar` (to hang); the correct English rendering "hanging" is participial/adjectival, but distractors "to adorn" and "to happen, to occur" are infinitive verbs. Player can eliminate by POS form ("hanging" is not in infinitive form).

---

- **Fact**: `es-cefr-2847` @ mastery=0
- **Category**: `POS-TELL`
- **Rendered**:
  Q: "What does 'pendiente' mean?"
   A) to cohabit
   B) to replace
   C) pending, outstanding  ✓
- **Issue**: `pendiente` is primarily an adjective/noun ("earring"/"pending"), tagged `verb` in deck. Distractors are infinitive verbs; correct answer is an adjective. POS-TELL works in reverse: distractors are verb-form, answer is not.

---

- **Fact**: `es-cefr-2702` @ mastery=2
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "How do you say 'gigantic' in Spanish?"
   A) originating, native
   B) gigantesco  ✓
   C) initiative
   D) attentive
- **Issue**: All distractors are English adjective phrases; `gigantesco` is trivially identifiable as the Spanish word.

### MAJOR

- **Fact**: `es-cefr-2868` @ mastery=2
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "How do you say 'to possess, to own' in Spanish?"
   A) to clarify
   B) to accumulate
   C) to impregnate
   D) poseer  ✓
- **Issue**: Three English verb phrases as distractors; `poseer` identifiable by Spanish form.

---

- **Fact**: `es-cefr-2617` @ mastery=0
- **Category**: `POS-TELL`
- **Rendered**:
  Q: "What does 'difunto' mean?"
   A) to conceive, imagine
   B) to embark, to board
   C) deceased  ✓
- **Issue**: `difunto` is an adjective/noun ("deceased"); distractors are infinitive verb phrases. POS mismatch is eliminatable.

---

- **Fact**: `es-cefr-2916` @ mastery=4
- **Category**: `LENGTH-TELL`
- **Rendered**:
  Q: "How do you say 'to irrigate' in Spanish?"
   A) regar  ✓
   B) to irritate
   C) to make a mistake
   D) to replace
   E) to commit
- **Issue**: In reverse mode, `regar` (5 chars) vs English phrases like "to make a mistake" (16 chars) — severe length tell AND language contamination.

### MINOR

- **Fact**: `es-cefr-2566` @ mastery=0
- **Category**: `POS-TELL`
- **Rendered**:
  Q: "What does 'coser' mean?"
   A) to sew  ✓
   B) to print
   C) fixed
- **Issue**: "fixed" (adjective) mixed with two verb distractors. Lower severity as two verb options remain.

---

- **Fact**: `es-cefr-2663` @ mastery=0
- **Category**: `POS-TELL`
- **Rendered**:
  Q: "What does 'estacionar' mean?"
   A) to park  ✓
   B) to dry
   C) delighted, enchanted
- **Issue**: "delighted, enchanted" (adjective) mixed with verb distractor. One adjective vs one verb.

### NIT

- **Fact**: `es-cefr-2602` @ mastery=0
- **Category**: `POS-TELL`
- **Rendered**:
  Q: "What does 'depositar' mean?"
   A) to deposit  ✓
   B) to limit
   C) functioning
- **Issue**: "functioning" (gerund/adjective) as a distractor among verb options. Mild tell.

## Expected vs Actual

| Issue Type | Expected | Actual (90-item sample) |
|---|---|---|
| POS-TELL | Medium-High | 10 items — confirmed |
| POOL-CONTAM (reverse) | High | 19 items — confirmed |
| LENGTH-TELL | Medium | 23 items — confirmed |
| DUPLICATE-OPT | None | 0 — correct |
| POS mis-tagging | Medium | Multiple (`pendiente`, `cuelga` tagged `verb`) |

## Notes
- B1 has a higher POS-TELL rate than A2 (10 vs 0) despite similar noun-to-verb ratio. Suggests B1 pool's smaller size (596 facts) means the distractor draw hits cross-POS facts more frequently.
- `pendiente` is the most instructive case: it is a well-known Spanish homograph (noun "earring" / adjective "pending, outstanding" / noun "slope, incline"). A single `partOfSpeech` field cannot represent this; the wrong POS tag causes incorrect distractors.
- The word `difunto` is tagged as `verb` but means "deceased" (adjective) — likely a POS tagging error in the source data.
- All POOL-CONTAM cases follow the identical pattern: `target_language_words` pool draws English meanings as distractors for reverse-mode questions.
