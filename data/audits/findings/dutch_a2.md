# dutch_a2 — Quiz Audit Findings

## Summary
90 quiz entries (30 facts × 3 mastery levels). Ten SELF_ANSWERING cases in dump (highest raw count among Dutch decks) from Dutch-English cognates. Seven definition_match SELF_ANSWERING cases where explanation text contains the correct answer. LENGTH_TELL moderate (10 occurrences). Notably the `kerk — church` definition_match entry is a particularly informative example of how explanatory overreach causes self-answering.

Counts: SELF_ANSWERING×10 (cognates in dump), SELF_ANSWERING×7 (definition_match), LENGTH_TELL×10.

---

## Issues

### BLOCKER

- **Fact**: `nl-cefr-218` @ mastery=0
- **Category**: `SELF-ANSWERING`
- **Rendered** (forward template):
  Q: "What does 'best' mean?"
   Correct: "best"
- **Issue**: Dutch "best" = English "best". The question word IS the answer. Appears identically across forward, reverse, synonym_pick, and definition_match templates.

---

- **Fact**: `nl-cefr-271` @ mastery=0
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "What does 'contact' mean?"
   Correct: "contact"
- **Issue**: Same. Dutch "contact" = English "contact".

---

- **Fact**: `nl-cefr-341` (film), `nl-cefr-418` (hand), `nl-cefr-631` (open), `nl-cefr-658` (plan), `nl-cefr-774` (student), `nl-cefr-905` (wild)
- **Category**: `SELF-ANSWERING`
- **Issue**: Six additional perfect cognates in the 30-fact dump sample. All are answerable without Dutch knowledge.

---

- **Fact**: `nl-cefr-491` @ mastery=0
- **Category**: `SELF-ANSWERING`
- **Rendered** (definition_match template):
  Q: "kerk — church, house of Christian worship. Also: church, confessional religious organization, church, temple, non-Christian house of worship"
   A) pride
   B) number, amount
   C) hunger
   D) church  ✓
   E) voyage, speed
- **Issue**: "church" appears three times in the explanation. The explanation text is a word sense inventory that includes the correct answer repeatedly.

---

- **Fact**: `nl-cefr-264` @ mastery=0
- **Category**: `SELF-ANSWERING`
- **Rendered** (definition_match template):
  Q: "bruid — bride."
   A) real, genuine
   B) office
   C) word
   D) bride  ✓
   E) strong
- **Issue**: Minimal explanation echoes the correct answer.

---

### MAJOR

- **Fact**: `nl-cefr-602` @ mastery=0
- **Category**: `LENGTH_TELL`
- **Rendered** (forward template):
  Q: "What does 'natuur' mean?"
   A) tea (3)
   B) nature (6)  ✓
   C) medicine, cure (12)
- **Issue**: "medicine, cure" (multi-meaning answer) is 4.7× longer than "tea". In the reverse template, "natuur" itself appears as an option among English options, creating POOL_CONTAM too.

---

- **Fact**: `nl-cefr-225` @ mastery=0
- **Category**: `SELF-ANSWERING`
- **Rendered** (definition_match):
  Q: "bewegen — to move, to be in motion. Also: to move, to cause to be in motion..."
   Correct: "to move"
- **Issue**: "to move" appears in the opening phrase and repeated in "Also:".

---

### MINOR

- **Fact**: `nl-cefr-669` @ mastery=0 (from JSON analysis)
- **Category**: `SELF-ANSWERING`
- **Rendered**: "What does 'priester' mean?" → correct: "priest"
- **Issue**: "priester" and "priest" differ by 2 characters. Guessable from word shape, not Dutch knowledge.

---

- **Fact**: deck-wide (283 facts)
- **Category**: `OTHER`
- **Issue**: 36% of facts have comma-separated answers ("friendly, nice", "car, automobile", "medicine, cure"). These create two issues: (1) LENGTH_TELL when multi-word answers compete with shorter single-word options, (2) SYNONYM_LEAK when the first part of the answer ("medicine") appears as a distractor for a word correctly translated by the full phrase.

---

### NIT

- **Fact**: deck-wide
- **Category**: `OTHER`
- **Issue**: difficulty=1 same as A1. 785 facts at the same difficulty level as the 161-fact A1 deck signals no learning progression to the player.

---

## Expected vs Actual
- **Expected**: Cognate words at A2 are presented with sufficient context to test recognition vs guessability.
- **Actual**: Perfect cognates (best, contact, film, hand, plan, student, wild, open) are self-answering regardless of template.
- **Expected**: definition_match uses explanations as meaningful clues.
- **Actual**: `kerk` explanation contains "church" three times; `bewegen` contains "to move" twice.

## Notes
- The Dutch cognate problem at A2 is more severe than A1 because A2 vocabulary more often comes from Latin-derived (French borrowings into both languages) and direct Germanic cognates. `detective, contact, film, plan, student` are all international words adopted identically into Dutch and English.
- The `kerk` explanation quality issue is instructive: the Wiktionary import included the full word sense list which enumerates "church" repeatedly. A post-processing step that strips the correctAnswer text from explanation_match questions would fix this structurally.
