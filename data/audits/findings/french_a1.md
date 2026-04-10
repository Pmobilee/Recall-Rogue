# french_a1 — Quiz Audit Findings

## Summary
932 facts, 90 quiz dump entries (3 mastery levels × 30 sampled facts). Two blockers identified: a placeholder "answer" distractor appears in two entries. POS-tell is the structural weakness — one shared pool for all parts of speech. Self-answering appears exclusively in the mastery=4 definition_match template, where the explanation directly contains the answer word. Length-tell is widespread due to compound answers.

| Category | Count |
|---|---|
| BLOCKER | 2 (placeholder distractor) |
| MAJOR | 4 (POS-tell: 1, self-answering: 3) |
| MINOR | 13 (length-tell: 9, compound-answer: 4) |
| NIT | 0 |

---

## Issues

### BLOCKER

- **Fact**: `fr-cefr-772` @ mastery=2 and mastery=4
- **Category**: `SYNTHETIC-WEAK`
- **Rendered** (mastery=2):
  Q: "How do you say 'week' in French?"
   A) answer
   B) noise
   C) semaine  ✓
   D) funny, amusing
- **Issue**: Literal string "answer" appears as a distractor option — an unfilled placeholder from distractor generation. Appears at both mastery 2 and mastery 4.

---

### MAJOR

- **Fact**: `fr-cefr-663` @ mastery=0
- **Category**: `POS-TELL`
- **Rendered**:
  Q: "What does 'promettre' mean?"
   A) to promise  ✓
   B) listening
   C) to vary
- **Issue**: 2 verb options ("to promise", "to vary") vs 1 gerund-noun ("listening"). A student who knows "promettre" is a verb can eliminate "listening" immediately.

---

- **Fact**: `fr-cefr-526` @ mastery=4
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "métier — job, profession, trade. Also: skill, craft, machine, device, loom"
   A) card  B) year  C) dry  D) dog  E) profession  ✓
- **Issue**: "profession" appears verbatim in the definition string used as question stem.

---

- **Fact**: `fr-cefr-308` @ mastery=4
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "explication — explanation."
   A) hair  B) brown  C) project  D) explanation  ✓  E) oil
- **Issue**: The definition IS the answer word. The question provides zero information load.

---

- **Fact**: `fr-cefr-663` @ mastery=4
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "promettre — to promise. Also: to promise oneself, to be promising, to be hopeful"
   A) listening  B) to promise  ✓  C) to vary  D) to last  E) to find
- **Issue**: "to promise" appears verbatim in the explanation used as question.

---

### MINOR

- **Fact**: `fr-cefr-620` @ mastery=0 and mastery=2
- **Category**: `LENGTH-TELL`
- **Rendered** (mastery=0):
  Q: "What does 'pièce' mean?"
   A) city
   B) room in a house  ✓
   C) dear
- **Issue**: Length ratio 3.8× ("city"=4, "room in a house"=15). One answer is visually distinct.

---

- **Fact**: `fr-cefr-27` @ mastery=0
- **Category**: `LENGTH-TELL`
- **Rendered**:
  Q: "What does 'ancien' mean?"
   A) desk
   B) former, ancient  ✓
   C) choice
- **Issue**: Compound answer "former, ancient" is 3.8× longer than "desk". Also compound-answer issue.

---

- **Facts**: `fr-cefr-82`, `fr-cefr-27` (and 6 additional across the sample)
- **Category**: `OTHER` (compound correct answer)
- **Issue**: Correct answers use comma-separated phrasing ("well, yeah", "former, ancient", "room in a house"). When one option has a comma and distractors are single words, the comma itself becomes a tell.

---

## Expected vs Actual
- Expected: POS-TELL would be rare since A1 words are mostly common nouns
- Actual: POS-TELL occurs wherever verbs and nouns compete in the same 3-option pool — confirmed in 1 of 30 sampled facts (extrapolates to ~30 facts deck-wide)
- Expected: Placeholder distractors would not exist in a shipped deck
- Actual: `fr-cefr-772` has a literal "answer" distractor — a generation artifact

## Notes
- The mastery=4 `definition_match` template systematically produces self-answering for any fact whose explanation contains the answer word. This is a structural template issue affecting all French vocab decks, not isolated to A1.
- German vocab decks show the same POS-TELL pattern — single pool, mixed POS.
- The "answer" placeholder also appears in the `target_language_words` pool at mastery=4: entry shows "answer" as one of the English-side distractors alongside "noise", "writer". Likely a fallback distractor from when the pool had insufficient members.
