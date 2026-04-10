# czech_b1 — Quiz Audit Findings

## Summary
90 quiz entries (30 facts × 3 mastery levels). LENGTH_TELL highest among Czech decks (24 occurrences) driven by short 3-letter Czech words like "eso" (ace) appearing among multi-word English distractors. 11 SELF_ANSWERING instances in definition_match. Proper nouns (Washington, New York) as vocabulary items are functionally unteachable — they are identical in Czech and English.

Counts: SELF_ANSWERING×11 (definition_match), LENGTH_TELL×24, SELF_ANSWERING×5 (proper nouns, JSON-level).

---

## Issues

### BLOCKER

- **Fact**: `cs-freq-1354` (Washington), `cs-freq-1873` (New York)
- **Category**: `SELF-ANSWERING`
- **Rendered** (forward template):
  Q: "What does 'Washington' mean?"
   Correct: "Washington"
   Q: "What does 'New York' mean?"
   Correct: "New York"
- **Issue**: The Czech and English words are identical. This is not a vocabulary test — it is testing whether students can read English. Every template (forward, reverse, synonym_pick, definition_match) is trivially solvable for these proper nouns.

---

- **Fact**: `cs-freq-1354` (Milan), `cs-freq-1699` (Ivan)
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "What does 'Milan' mean?" → correct: "Milan"
  Q: "What does 'Ivan' mean?" → correct: "Ivan"
- **Issue**: Same: given names that are spelled identically in Czech and English.

---

### MAJOR

- **Fact**: `cs-freq-1946` @ mastery=0
- **Category**: `LENGTH_TELL`
- **Rendered** (forward template):
  Q: "What does 'eso' mean?"
   A) elsewhere (9)
   B) headache (8)
   C) ace (3)  ✓
- **Issue**: "eso" = "ace" (3 chars). "elsewhere" (9), "headache" (8) are much longer. Length ratio = 3×; plus the 3-letter answer is the only single English word, making it visually distinct. In synonym_pick template, the 5-option version shows "Tuesday, ace, profit/benefit, headache, elsewhere" — ace is still the shortest.

---

- **Fact**: `cs-freq-1715` @ mastery=0
- **Category**: `SELF-ANSWERING`
- **Rendered** (definition_match template):
  Q: "přírodní zdroj — natural resource."
   A) Great Britain
   B) natural resource  ✓
   C) absolute
   D) second time
   E) share
- **Issue**: "natural resource" appears verbatim in the question. Multi-word answers make this particularly obvious — the player simply matches the phrase.

---

- **Fact**: `cs-freq-1018` @ mastery=0
- **Category**: `SELF-ANSWERING`
- **Rendered** (definition_match template):
  Q: "správný — correct. Also: proper"
   A) customer
   B) pi
   C) health insurance
   D) public transit
   E) correct  ✓
- **Issue**: "correct" is the first word in the explanation. Self-answering guaranteed.

---

- **Fact**: `cs-freq-1001` @ mastery=0
- **Category**: `SELF-ANSWERING`
- **Rendered** (definition_match template):
  Q: "působit — to work (to act as intended). Also: to work as, to be employed as..."
   Correct: "to work"
- **Issue**: "to work" appears in the opening parenthetical. Correct answer is contained in the question.

---

### MINOR

- **Fact**: `cs-freq-1190` (from JSON)
- **Category**: `SELF-ANSWERING`
- **Rendered**: "What does 'standardní' mean?" → correct: "standard"
- **Issue**: Czech adjective with English cognate answer. Not in dump sample but present in deck JSON.

---

- **Fact**: `cs-freq-1946` @ mastery=2
- **Category**: `LENGTH_TELL`
- **Rendered** (synonym_pick):
  Q: "Which word is closest in meaning to 'eso'?"
   A) profit, benefit (13)
   B) headache (8)
   C) elsewhere (9)
   D) Tuesday (7)
   E) ace (3)  ✓
- **Issue**: "ace" (3 chars) stands out as the shortest option in a 5-option list. Length ratio = 4.3×.

---

### NIT

- **Fact**: deck-wide
- **Category**: `OTHER`
- **Issue**: Proper nouns (city names, person names) appearing as vocabulary items at B1 adds deck bloat without genuine learning value. Washington, New York, Milan, Ivan are recognized globally — their presence as Czech vocabulary facts dilutes the deck.

---

## Expected vs Actual
- **Expected**: B1 vocabulary tests genuine Czech lexical knowledge.
- **Actual**: 4 facts test proper nouns that are orthographically identical in Czech and English; 11 definition_match facts leak the answer in the explanation.
- **Expected**: LENGTH_TELL rate comparable to A1/A2 (4 cases).
- **Actual**: 24 LENGTH_TELL instances — 6× higher than A1, likely driven by a subset of short Czech words paired with long English distractors.

## Notes
- The proper noun problem (Washington, New York, Milan, Ivan) is a content curation issue: frequency-based word selection includes these because they appear frequently in Czech text, but their pedagogical value as "vocabulary items" is zero for English speakers.
- LENGTH_TELL spike in B1 vs A1/A2 may indicate this level's pool contains more short Czech slang/abbreviations (eso = ace) that pair poorly with multi-word English synonyms drawn from the pool.
