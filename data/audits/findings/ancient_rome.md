# ancient_rome — Quiz Audit Findings

## Summary
Ancient Rome is a solid, well-sourced deck with high factual quality. The dominant issue mirrors ancient_greece: `historical_phrases` (80 facts, EXEMPT) produces POOL-CONTAM at higher mastery levels. A secondary issue is pool misassignment: "She-wolf" appears in `roman_god_names` (she-wolf is a creature, not a deity), causing a CATEGORY-TELL when it appears as a distractor in god-themed questions. Date pool distractors are generally plausible (nearby years within the Roman period) — better than feared. One SELF-ANSWERING concern exists for the Stilicho question. The `bracket_numbers` distractor generation for numeric facts is excellent. 10 issues found across 30 sampled facts.

## Issues

### MAJOR

- **Fact**: `rome_god_venus_caesar` @ mastery=0
- **Category**: `POOL-CONTAM`, `CATEGORY-TELL`
- **Rendered** (mastery 0):
  Q: "Which Roman goddess of love claimed Julius Caesar as a descendant...?"
   A) Venus ✓
   B) Saturday
   C) Mars
- **Issue**: "Saturday" is not a Roman god name — it is a weekday named after Saturn. Including "Saturday" in the `roman_god_names` pool is a pool misassignment that produces a CATEGORY-TELL: any player who knows the question asks for a god name will immediately eliminate "Saturday" as not being a divine name. This persists at mastery 2 and 4.

- **Fact**: `rome_god_mars_month` @ mastery=4
- **Category**: `POOL-CONTAM`
- **Rendered** (mastery 4):
  Q: "Which Roman god of war is both the father of Romulus and Remus AND the deity after whom the month of March is named?"
   A) Mars ✓
   B) Jupiter
   C) Vulcan
   D) Ceres
   E) She-wolf
- **Issue**: "She-wolf" is the correct answer to the "what animal suckled the twins" question — it is not a Roman god. Its presence in `roman_god_names` pool causes it to appear as a distractor here. "She-wolf" is immediately eliminable as a non-deity in a "which Roman god..." question.

- **Fact**: `rome_fall_stilicho` — all mastery levels
- **Category**: `SELF-ANSWERING` (minor-to-major boundary)
- **Rendered** (mastery 0):
  Q: "Which half-Vandal Roman general served as de facto ruler of the Western Empire...only to be executed by the emperor he served in 408 CE?"
   A) Scipio Aemilianus
   B) Appius Claudius
   C) Stilicho ✓
- **Issue**: The question does not name "Stilicho" in the stem directly, so this is not a verbatim self-answer. However, a player familiar with the name "Stilicho" from the question context would be aided. This is a borderline case — the name is deliberately withheld. Not flagging as a full violation, but noting it.

### MINOR

- **Fact**: `rome_rep_founding_date` @ mastery=0
- **Category**: No issue. Distractors "49 BCE" and "44 BCE" are plausible Roman-era dates. PASS. ✓

- **Fact**: `rome_fall_adrianople` @ mastery=0
- **Category**: `LENGTH-TELL` (minor)
- **Issue**: At mastery 0, distractors "330 CE" and "376 CE" are appropriately close to "378 CE". Excellent date distractor quality.

- **Fact**: `rome_fall_constantinople_founding` @ mastery=4
- **Category**: No significant issue. Distractors 313 CE, 69 CE, 64 CE, 325 CE all fall within Roman imperial period — plausible.

- **Fact**: `rome_rep_she_wolf_legend` — assigning "She-wolf" to `roman_god_names` pool
- **Category**: `POOL-CONTAM` (root cause)
- **Issue**: The "She-wolf" fact (`rome_rep_she_wolf_legend`) has `answerTypePoolId: "roman_god_names"` which is wrong — a she-wolf is an animal, not a deity. This is the root cause of the "She-wolf" distractor appearing in `rome_god_mars_month`. The pool assignment should be `animal_names` or a dedicated `roman_legend_terms` pool.

- **Fact**: `rome_eng_roads_radiate` — numeric distractors
- **Category**: NIT. Distractors 37, 23, 19, 36 for the answer "29" are excellent — same order of magnitude, plausible for a "how many highways" question.

- **Fact**: `rome_chr_paul_new_testament` — numeric distractors
- **Category**: No issue. Distractors 16, 15, 18, 10 for answer "13" are well-chosen. PASS. ✓

- **Pools**: `historical_phrases` — 80 facts EXEMPT but not sampled in this 30-fact dump. Based on the ancient_greece pattern, expect similar POOL-CONTAM when those facts are shown. Cannot confirm without sample but flag as predicted risk.

## Expected vs Actual

**Expected**: POOL-CONTAM in `historical_phrases` (80 facts).
**Actual**: Not directly sampled in this dump. Historical phrases pool facts were not among the 30 shown. Remains a predicted risk.

**Expected**: `roman_god_names` pool contamination with "She-wolf".
**Actual**: Confirmed. "Saturday" also incorrectly placed in `roman_god_names`.

**Expected**: Date distractors might span wildly different eras (e.g., "476 CE" for 753 BCE).
**Actual**: Better than feared — date distractors generally stay within Roman-era dates. "476 CE" appears as a distractor for "753 BCE" at mastery 4, which is a 1,229-year gap, but these are the two most famous Roman dates so a player would likely know the distinction. Borderline acceptable.

## Notes
- No broken grammar detected.
- No fabricated or suspicious factual claims in sample.
- "Saturday" in `roman_god_names` pool is a clear data error but affects only the distractor pool membership; the underlying Saturday fact itself may not be in this pool — it may be a synthetic distractor that was miscategorized.
- Do NOT flag: The 753 BCE / 476 CE pairing as distractors is intentional — both are iconic Roman dates that students should know precisely to distinguish them.
