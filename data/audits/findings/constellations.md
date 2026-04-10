# constellations — Quiz Audit Findings

## Summary
90 quiz dump entries (30 facts × 3 mastery levels). Two MAJOR issues identified: one soft SELF-ANSWERING where the constellation name leaks the answer, and one question with a clearly wrong-category distractor. Both are addressable.

## Issues

### MAJOR

- **Fact**: `const_mc_cygnus_black_hole` @ mastery=0,2,4
- **Category**: `SELF-ANSWERING`
- **Rendered** (mastery=0):
  Q: "Which object in the constellation Cygnus was the first to be widely accepted as a black hole?"
   A) Cepheid variable
   B) Cygnus X-1 ✓
   C) Over half
- **Issue**: The word "Cygnus" appears in the question stem ("the constellation Cygnus"). The correct answer is "Cygnus X-1" which contains "Cygnus" verbatim. A player matching the constellation name to the answer can identify the correct option without any astronomical knowledge. The distractor "Over half" is also a POOL-CONTAM signal — it is a statistical description, not an astronomical object name.

---

- **Fact**: `const_star_polaris_cepheid` @ mastery=0,2,4
- **Category**: `SYNTHETIC-WEAK` + `POOL-CONTAM`
- **Rendered** (mastery=2):
  Q: "Besides being the North Star, Polaris is also a notable example of what type of variable star?"
   A) Cepheid variable ✓
   B) White dwarf
   C) Halley's Comet
   D) Guest star
- **Issue 1**: Distractor "Halley's Comet" is not a type of star — it is a solar system object in a completely different astronomical category. This is POOL-CONTAM / SYNTHETIC-WEAK: a distractor from the wrong conceptual domain makes a nonsensical option. A player asking "Is Halley's Comet a type of variable star?" will trivially answer No.
- **Issue 2**: At mastery 4, distractor "Inanimate object" appears — a metacategory description, not an astronomical term. Same SYNTHETIC-WEAK issue.

## Expected vs Actual
Expected SELF-ANSWERING from constellation-name-in-question pattern. `const_mc_cygnus_black_hole` confirms this. Also expected concept pool heterogeneity — "Halley's Comet" in a star-type question confirms wrong-category distractor contamination.

## Notes
- 30 facts use `_fallback` template — all render as coherent English questions. No broken grammar.
- POS-TELL cases found in 3 facts (questions using "his" for Ptolemy, "her" for Cassiopeia, "his" for Zeus) — all NIT-level as the gendered pronoun is context-appropriate and the options still require genuine knowledge.
- `const_mc_cygnus_black_hole`: The distractor "Over half" appears at mastery 2 and 4. This likely comes from a `concept_terms` or `date_numbers` pool — it is a statistical fragment, completely wrong category for an astronomical object question.
- No chain themes populated. Study Temple mechanic non-functional.
- **Fix priorities**: (1) Rephrase `const_mc_cygnus_black_hole` to avoid "Cygnus" in the question, e.g., "The first object widely accepted as a black hole was designated X-1 in which constellation?" (2) Remove "Halley's Comet" and "Inanimate object" from the synthetic distractor list for star-type pools. (3) "Over half" must be removed from any pool that also contains object names.
