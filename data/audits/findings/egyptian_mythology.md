# egyptian_mythology — Quiz Audit Findings

## Summary
87 quiz dump entries (29 facts × 3 mastery levels). Four BLOCKER-level broken grammar facts identified — all are unresolved pronoun placeholders ("this") in question stems that produce unintelligible text. These require immediate remediation before the deck ships.

## Issues

### BLOCKER

- **Fact**: `egypt_death_osiris_myth_throne` @ mastery=0,2,4
- **Category**: `BROKEN-GRAMMAR`
- **Rendered** (mastery=0):
  Q: "After the long contest, how did this ultimately secure the throne from Set?"
   A) Atef crown
   B) Set gave Horus the throne ✓
   C) Separated sky from earth
- **Issue**: "how did this ultimately secure the throne" — "this" is an unresolved pronoun with no clear antecedent. The question is unintelligible. Template `_fallback` rendered the raw `quizQuestion` field which contains a broken pronoun reference.

---

- **Fact**: `egypt_temp_karnak_columns` @ mastery=0,2,4
- **Category**: `BROKEN-GRAMMAR`
- **Rendered** (mastery=0):
  Q: "How many this does the Great Hypostyle Hall at Karnak contain?"
   A) 134 columns ✓
   B) 42
   C) 40000000
- **Issue**: "How many this does" — "this" replaces the noun ("columns") and is grammatically broken. The sentence is a clear template failure where a field substitution did not execute. Also note: distractor "40000000" (forty million) appears as a numeric option for a question asking about the number of columns — wildly implausible distractor quality.

---

- **Fact**: `egypt_sym_nekhbet_shen` @ mastery=0,2,4
- **Category**: `BROKEN-GRAMMAR`
- **Rendered** (mastery=0):
  Q: "In New Kingdom art, Nekhbet was depicted hovering with wings spread above the pharaoh, clutching what this?"
   A) a throne (the hieroglyph for her name)
   B) an ostrich feather
   C) The shen symbol (eternal encircling protection) ✓
- **Issue**: "clutching what this?" — trailing "this" is a broken placeholder. Should read "clutching what symbol?" or similar. Structurally unintelligible.

---

- **Fact**: `egypt_temp_westcar_khnum` @ mastery=0,2,4
- **Category**: `BROKEN-GRAMMAR`
- **Rendered** (mastery=0):
  Q: "What did the Westcar Papyrus say Khnum did for future kings' this?"
   A) infused 'health' into their bodies on his potter's wheel ✓
   B) Sia, Heka, and the serpent Mehen
   C) Spells of Coming Forth by Day
- **Issue**: "future kings' this?" — "this" replaces the noun being possessed. Unintelligible. Also: distractor "Sia, Heka, and the serpent Mehen" is a list of divine concepts unrelated to what Khnum "did" (an action), creating POOL-CONTAM between concept-names and action-descriptions.

## Expected vs Actual
Expected broken-grammar risk from `_fallback` template. Confirmed: 4 facts affected, all using `_fallback` and all with "this" as an unresolved placeholder pronoun. Likely caused by a batch rewrite pass that left incomplete substitutions. Root cause: the `quizQuestion` field in the JSON for these 4 facts contains "this" where a noun was supposed to be substituted.

## Notes
- 29 of 29 unique facts use `_fallback` template. This is unusually high and means every question in the deck is rendered from its raw `quizQuestion` field. No template-based variety.
- The `deity_names_short` pool has only 3 real facts. At mastery 0 this means 2 real-fact distractors + synthetic options. Pool is functional but thin.
- `numbers_dates` pool length ratio (min=2ch "70", max=18ch "Dynasty XVII-XX") exceeds the 3x threshold but was not detected in the sample as a player-visible tell because the questions themselves describe the context adequately.
- No chain themes populated. Study Temple mechanic non-functional.
- **4 BLOCKERs require immediate remediation** — fix the 4 `quizQuestion` fields in the JSON source to replace "this" with the correct noun.
