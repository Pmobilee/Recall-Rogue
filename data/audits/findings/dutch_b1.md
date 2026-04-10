# dutch_b1 — Quiz Audit Findings

## Summary
90 quiz entries (30 facts × 3 mastery levels). Six SELF_ANSWERING cases from definition_match, plus 5 cognate facts that are self-answering across all templates. LENGTH_TELL driven by multi-word comma answers ("refrigerator, fridge", "foreign countries, abroad") paired with short single-word distractors. The deck's 232-fact size is a structural concern — undersized for a B1 CEFR level.

Counts: SELF_ANSWERING×6 (definition_match), SELF_ANSWERING×5 (cognates), LENGTH_TELL×10.

---

## Issues

### BLOCKER

- **Fact**: `nl-cefr-947` @ mastery=0
- **Category**: `SELF-ANSWERING`
- **Rendered** (definition_match template):
  Q: "aandacht — attention. Also: respect, affection, meditation..."
   Correct: "attention"
- **Issue**: "attention" in explanation opening. SELF_ANSWERING via definition_match.

---

- **Fact**: `nl-cefr-1155` @ mastery=0
- **Category**: `SELF-ANSWERING`
- **Rendered** (definition_match template):
  Q: "verschil — difference."
   Correct: "difference"
- **Issue**: "difference" is the entire explanation after the dash.

---

- **Fact**: `nl-cefr-977` @ mastery=0
- **Category**: `SELF-ANSWERING`
- **Rendered** (definition_match):
  Q: "buur — neighbour."
   Correct: "neighbour"
- **Issue**: Same minimal-explanation pattern.

---

- **Fact**: `nl-cefr-1086` (periode), `nl-cefr-1093` (programma), `nl-cefr-1106` (resultaat), `nl-cefr-1117` (single), `nl-cefr-1123` (sport)
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "What does 'periode' mean?" → correct: "period"
  Q: "What does 'programma' mean?" → correct: "program"
  Q: "What does 'resultaat' mean?" → correct: "result"
  Q: "What does 'single' mean?" → correct: "single"
  Q: "What does 'sport' mean?" → correct: "sport"
- **Issue**: All five are Dutch-English cognates or English loanwords in Dutch. Trivially guessable.

---

### MAJOR

- **Fact**: `nl-cefr-1155` @ mastery=2
- **Category**: `LENGTH_TELL` + `SELF-ANSWERING`
- **Rendered** (definition_match template):
  Q: "verschil — difference."
   A) refrigerator, fridge (18 chars)
   B) funny (5)
   C) tax, levy (8)
   D) difference (10)  ✓
   E) teacher, docent (14)
- **Issue**: Length ratio = 4×. Multi-word distractors ("refrigerator, fridge", "teacher, docent") against shorter distractors. Plus self-answering from explanation.

---

- **Fact**: `nl-cefr-1116` @ mastery=0
- **Category**: `LENGTH_TELL`
- **Rendered**:
  Q: "What does 'buitenland' mean?"
   A) cigarette (9)
   B) foreign countries, abroad (22)  ✓
   C) north (5)
- **Issue**: Length ratio = 5×. "foreign countries, abroad" is a 22-character multi-phrase answer against "north" (5 chars). The correct answer length stands out.

---

### MINOR

- **Fact**: deck-wide
- **Category**: `OTHER`
- **Issue**: 232 facts total. A player who completes Dutch A2 (785 facts) then moves to B1 (232 facts) encounters a deck 3× smaller. The B1 experience will feel thin and will recycle distractors frequently.

---

- **Fact**: deck-wide
- **Category**: `OTHER`
- **Issue**: difficulty=1 for B1, identical to A1 (2 CEFR levels below). No difficulty signal at all across the entire Dutch deck series.

---

### NIT

- **Fact**: `nl-cefr-979` (cd)
- **Category**: `OTHER`
- **Issue**: "cd" with answer "CD, compact disc" — lowercase Dutch vs. uppercase English creates minor visual inconsistency. Not a functional issue but suggests unreviewed casing normalization.

---

## Expected vs Actual
- **Expected**: B1 deck covers 800–1,500 words at intermediate level.
- **Actual**: 232 facts — 23% of a typical B1 target.
- **Expected**: difficulty reflects B1 advancement.
- **Actual**: difficulty=1 same as A1.

## Notes
- The Dutch B1 deck appears significantly underpopulated compared to its CEFR level and compared to the Czech equivalents. This may indicate an ingestion pipeline issue where the NT2Lex B1 word list was partially processed, or the CEFRLex source has fewer B1 Dutch entries than expected.
- The LENGTH_TELL issue at B1 is driven by multi-meaning answers ("foreign countries, abroad", "refrigerator, fridge") that are common at intermediate level where Dutch one-word terms often cover broader semantic ground than any single English word.
