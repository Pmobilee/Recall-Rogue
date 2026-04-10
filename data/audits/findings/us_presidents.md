# us_presidents — Quiz Audit Findings

## Summary
US Presidents is a clean, accessible deck with the simplest pool structure in the batch (104 of 126 facts answer with a president name). Distractor quality in the `president_names` pool is good — drawing plausible wrong presidents as co-distractors. However, a BLOCKER-level factual error exists: the Reagan fact incorrectly claims he "presided over the end of the Cold War as the Soviet Union dissolved in 1991" — Reagan left office January 1989 and the USSR dissolved December 1991 under George H.W. Bush. One self-answering concern for the Lincoln self-taught fact. Minor: Joe Biden and George Washington appearing as distractors for 1960s–70s Vietnam questions is anachronistic (Biden was not president until 2021; Washington is 180 years before Vietnam). 5 issues found.

## Issues

### BLOCKER

- **Fact**: `pres_reagan_end_cold_war` @ all mastery levels
- **Category**: `FACTUAL-SUSPECT`
- **Rendered**:
  Q: "Which president presided over the end of the Cold War as the Soviet Union dissolved in 1991?"
   Answer: Ronald Reagan
- **Issue**: Ronald Reagan's presidency ended January 20, 1989. The Soviet Union dissolved December 25, 1991 — under George H.W. Bush. Reagan's Cold War pressure (Strategic Defense Initiative, Reagan Doctrine, confrontational rhetoric) contributed to conditions leading to Soviet collapse, but he did not "preside over" the 1991 dissolution. The question's use of "as the Soviet Union dissolved in 1991" makes this factually incorrect — George H.W. Bush was president in 1991. If the intent is to credit Reagan's role in ending the Cold War ideologically, the question must be reworded to not reference 1991 specifically.

### MAJOR

- **Fact**: `pres_lbj_vietnam` @ mastery=0
- **Category**: `POOL-CONTAM` (temporal mismatch)
- **Rendered** (mastery 0):
  Q: "Which president dramatically escalated U.S. involvement in the Vietnam War...?"
   A) George Washington ← 18th century president
   B) Joe Biden ← 46th president, served 2021–2025
   C) Lyndon B. Johnson ✓
- **Issue**: "George Washington" and "Joe Biden" are drawn from `president_names` pool without temporal filtering. George Washington (1789–1797) is 170+ years before the Vietnam War. Joe Biden (2021–2025) is 55+ years after. Both are eliminable by any player with basic knowledge of US history chronology. In a quiz about Vietnam-era events, only 20th-century president names should appear as distractors.

- **Fact**: `pres_lincoln_self_taught` — "never attended school for even a single day"
- **Category**: `FACTUAL-SUSPECT` (minor)
- **Issue**: The question states Lincoln "never attended school for even a single day" but the explanation contradicts this: "had less than one year of formal education total, pieced together from brief stints at frontier schools." Lincoln did attend school briefly — a few weeks at a time in frontier settlements. The claim "never attended school for even a single day" overstates the case and is inconsistent with the explanation. The answer (Abraham Lincoln) is correct, but the question framing contains inaccurate hyperbole.

### MINOR

- **Fact**: `pres_lincoln_union` @ mastery=0
- **Category**: No issue. Distractors "Jimmy Carter" and "James Madison" are plausible wrong president names in the right universe (both real presidents). James Madison is from the Civil War era — wait, Madison (1809–1817) predates Civil War. Borderline period mismatch but both are reasonable wrong answers for a general audience. PASS.

- **Fact**: `pres_jfk_youngest_elected` — distractors
- **Category**: NIT. "George Washington" appears here too at mastery 4 ("Calvin Coolidge", "James Monroe", "George Washington", "Richard Nixon"). Washington as distractor for "youngest elected" is plausible — students might confuse TR (youngest to serve) with JFK (youngest elected). PASS.

- **Fact**: `pres_cleveland_nonconsecutive` — all mastery levels
- **Category**: No issue. Distractors "Ulysses S. Grant", "Rutherford B. Hayes", "John F. Kennedy", "Lyndon B. Johnson" are all period-plausible (all served within 50–100 years of Cleveland). Good.

- **Fact**: `pres_jqadams_son_of` @ mastery=4
- **Category**: NIT. "Gerald Ford" as distractor for "first son of a president" — Ford has no presidential parent so this is a reasonable distractor. PASS.

## Expected vs Actual

**Expected**: FACTUAL-SUSPECT for Reagan Cold War dissolution claim.
**Actual**: Confirmed — Reagan left office 1989, dissolution was 1991.

**Expected**: Temporal mismatch in `president_names` pool at mastery 0.
**Actual**: Confirmed — George Washington (1789) and Joe Biden (2021) as distractors for a 1960s Vietnam question.

**Expected**: Self-answering risk for Lincoln self-taught fact.
**Actual**: Not a clean self-answer — the question asks "which president" so the answer pool (other presidents) is appropriate. The issue is the factual hyperbole in the question stem rather than self-answering.

## Notes
- The `president_names` pool at 104 facts is actually well-suited to this deck — it means wrong answers are always real presidents, which is educationally appropriate.
- Do NOT flag: "Jimmy Carter" as a distractor for Civil War questions — in a general knowledge deck, plausible-but-wrong president names are acceptable distractors even if anachronistic, as long as the player must use their knowledge to eliminate them.
- Do NOT flag: Lincoln's role in preserving the Union — factually accurate.
- The Reagan fact needs external verification before fixing — check whether George H.W. Bush is the correct answer instead, or whether the question should be reworded to ask about Reagan's Cold War strategy rather than his "presiding over" the 1991 dissolution.
