# nasa_missions — Quiz Audit Findings

## Summary
90 quiz dump entries (30 facts × 3 mastery levels). One MINOR pool contamination issue (count fact in year pool). A potential SELF-ANSWERING concern for `nasa_hubble_deep_field` was investigated and cleared. Factual spot-checks on verifiable dates came back correct.

## Issues

### MINOR

- **Fact**: `nasa_moonwalkers_total` @ mastery=0,2,4
- **Category**: `POOL-CONTAM`
- **Rendered** (mastery=4):
  Q: "How many humans have walked on the Moon throughout all of NASA's Apollo missions?"
   A) 15
   B) 36
   C) 14
   D) 22
   E) 12 ✓
- **Issue**: This fact's correct answer is "12" (a count of astronauts). It is placed in the `launch_years` pool. The distractors (15, 36, 14, 22) are plausible numeric options for a count question, but they were generated as year-format numbers and happen to function here only by coincidence. The semantic pool assignment is wrong (this is a count, not a year). At mastery 4, distractors 36 and 22 are implausible as Apollo moonwalker counts (>20 people on the Moon would be headline news) — a knowledgeable player can narrow by plausibility.

## Expected vs Actual
Expected FACTUAL-SUSPECT risks for launch dates. Spot-checked: Voyager 1 launch year (1977 ✓), JWST launch year (2021 ✓), Apollo moonwalkers count (12 ✓). No factual errors found in the sample. The predicted SELF-ANSWERING for `nasa_hubble_deep_field` was a false positive — "Hubble" does not appear verbatim in the question stem ("Which space telescope captured the famous Deep Field image in 1995..."). Cleared.

## Notes
- 30 facts use `_fallback` template. All render as coherent English.
- `mission_names_short` pool includes both single-word names ("Juno," "Spirit," "Cassini") and acronyms ("STS-1," "TESS"). Length distribution was not flagged in the sample — the mix appears manageable with the short/long pool split already in place.
- No chain themes populated. Study Temple mechanic non-functional.
- `launch_years` pool has 26 total entries (6 real + 20 synthetics), which is above minimum. The synthetic year distractors (1968, 1993, 2003, 2002) are plausible alternatives for the real launch years — distractor quality is adequate.
- **Recommended fix**: Move `nasa_moonwalkers_total` from `launch_years` to a `bracket_numbers` pool (create one, or add to an existing numeric bracket pool). The count-vs-year type mismatch is a minor structural issue with no major gameplay impact.
