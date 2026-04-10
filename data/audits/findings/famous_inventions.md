# famous_inventions — Quiz Audit Findings

## Summary
Famous Inventions has good overall pool design with 11 semantic pools. Two distinct issues dominate: (1) A BROKEN-GRAMMAR BLOCKER in `inv_0_steel_bessemer` — "Who introduced the device process for mass-producing cheap steel" contains "device" as an apparent word-replacement artifact for "Bessemer"; (2) `invention_names_long` pool mixes durations ("Approximately six months"), device names ("Spark-gap transmitter", "Cavity magnetron"), event names ("Daventry Experiment"), and miscellaneous items ("Window cleaning device", "His wife's hand", "Radiophysics Division") — producing absurd distractor combinations. The `invention_dates` pool mixes modern and BCE-era dates, creating trivial temporal eliminations. 9 issues found.

## Issues

### BLOCKER

- **Fact**: `inv_0_steel_bessemer` @ all mastery levels
- **Category**: `BROKEN-GRAMMAR`
- **Rendered**:
  Q: "Who introduced the device process for mass-producing cheap steel in 1855?"
- **Issue**: "device process" is garbled — likely a template/word-replacement error where a placeholder word "device" was inserted before "process" without replacing the intended word. The correct reading should be "Who introduced the Bessemer process for mass-producing cheap steel in 1855?" or simply "Who introduced the process for mass-producing cheap steel in 1855?" The word "device" makes no grammatical sense in this context. This renders on every mastery level — every player sees the broken question. BLOCKER.

### MAJOR

- **Fact**: `inv_2_radio_spark` @ mastery=0
- **Category**: `POOL-CONTAM`, `SYNTHETIC-WEAK`
- **Rendered** (mastery 0):
  Q: "What type of transmitter did Marconi use in 1895 when he developed the first radio communication system?"
   A) Spark-gap transmitter ✓
   B) His wife's hand ← nonsensical
   C) Approximately six months ← a duration, not a transmitter type
- **Issue**: "His wife's hand" is in the `invention_names_long` pool — this appears to be a distractor from a question about Wilhelm Röntgen's X-ray discovery (he famously used his wife's hand as the first X-ray subject). "Approximately six months" is a duration answer from the IC chip question. Neither is plausible as "a type of transmitter." At mastery 2, "Cavity magnetron" appears — at least that is a legitimate radio/microwave component, making it the only plausible wrong answer.

- **Fact**: `inv_3_ic_months` @ mastery=0 and mastery=2
- **Category**: `POOL-CONTAM`, `FORMAT-TELL`
- **Rendered** (mastery 0):
  Q: "How long after Jack Kilby's first IC demonstration did Robert Noyce develop his practical monolithic IC chip?"
   A) Window cleaning device ← an object, not a duration
   B) Approximately six months ✓
   C) Daventry Experiment ← a 1935 BBC radar demonstration event
- **Issue**: The question asks "how long" — a duration. "Window cleaning device" is an object (not a duration). "Daventry Experiment" is an event name (not a duration). Only "Approximately six months" is duration-format, making it trivially eliminable. At mastery 2, "Radiophysics Division" (an organizational unit) also appears — not a duration. All four distractors at mastery 4 are non-duration format, making the answer eliminable by format alone.

- **Fact**: `inv_2_xray_rontgen` @ mastery=2 and mastery=4
- **Category**: `POOL-CONTAM`, `FORMAT-TELL`
- **Rendered** (mastery 2):
  Q: "When did Wilhelm Röntgen discover X-rays?"
   A) December 28, 1895
   B) 3500–3350 BCE ← ancient Near Eastern timeline
   C) Around 1190 ← medieval era
   D) November 8, 1895 ✓
- **Issue**: "3500–3350 BCE" and "Around 1190" appear in `invention_dates` pool alongside 19th-century invention dates. A question asking when Röntgen (a modern physicist) made his discovery makes "3500–3350 BCE" and "Around 1190" trivially eliminable — wrong era by ~2,000–3,000 years. The `invention_dates` pool spans ancient through modern invention dates; temporal filtering by sub-deck era would resolve this.

- **Fact**: `inv_1_telegraph_cooke` @ mastery=0
- **Category**: `POOL-CONTAM`, `SYNTHETIC-WEAK`
- **Rendered** (mastery 0):
  Q: "Who patented a competing five-needle telegraph system in Britain in May 1837, predating Morse commercially?"
   A) Cooke and Wheatstone ✓
   B) Tobermorite crystals ← a calcium silicate hydrate mineral
   C) A separate condenser ← a technical component
- **Issue**: "Tobermorite crystals" is a mineral compound (not an inventor or company). "A separate condenser" is a technical component (not a person or team name). Neither is plausible as the answer to "who patented a telegraph system." At mastery 4, "Daventry Experiment" also appears — an event, not a person. All distractors from `invention_names_long` pool are drawn regardless of semantic type for a person-name question.

### MINOR

- **Fact**: `inv_2_nylon_carothers` — date distractors
- **Category**: No issue. Distractors "December 17, 1903" (Wright Brothers flight), "November 8, 1895" (X-rays), "January 14, 1942", "September 7, 1927" are all specific modern-era invention dates — appropriately challenging for a date-quiz question. PASS. ✓

- **Fact**: `inv_3_led_holonyak` — distractor quality
- **Category**: No issue. Distractors "Elias Howe" (sewing machine inventor), "Elisha Gray" (telephone dispute), "Chuck Hull" (3D printing inventor) are all real inventors in the `person_inventor_names` pool — plausible wrong answers for an "inventor of X" question. Good pool design. ✓

- **Fact**: `inv_2_radio_spark` @ mastery=2
- **Category**: MINOR improvement. "Cavity magnetron" (microwave tube) as a distractor for "spark-gap transmitter" is the closest thing to a plausible wrong transmitter type in the pool — good. But "His wife's hand" persists at mastery 2 and 4.

### NIT

- **Fact**: `inv_2_xray_rontgen` @ mastery=0
- **Category**: NIT. At mastery 0, distractors are "December 28, 1895" (X-ray publication date, one month after discovery) and "Around 1190" — the former is an excellent distractor (discovery vs. publication date), the latter is poor (medieval era). Mixed quality at mastery 0.

## Expected vs Actual

**Expected**: BROKEN-GRAMMAR in `inv_0_steel_bessemer` ("device process").
**Actual**: Confirmed — "device" appears to be a template artifact before "process".

**Expected**: `invention_names_long` format heterogeneity.
**Actual**: Confirmed — duration ("Approximately six months"), object ("His wife's hand"), event ("Daventry Experiment"), technical org ("Radiophysics Division"), device name ("Window cleaning device") all in same pool.

**Expected**: `invention_dates` pool BCE-era contamination.
**Actual**: Confirmed — "3500–3350 BCE" and "Around 1190" appearing as distractors for 1895 X-ray discovery question.

**Expected**: `person_inventor_names` pool distractor quality.
**Actual**: Good for real inventor names (Elias Howe, Elisha Gray) — synthetic distractor quality adequate.

## Notes
- "His wife's hand" appears to be the correct answer from a variant of the Röntgen X-ray discovery question (Röntgen took the first X-ray of his wife Anna Bertha's hand). It is correctly placed as an answer for the relevant fact but incorrectly appearing as a distractor in the radio transmitter question — pool contamination at the cross-fact level.
- "Tobermorite crystals" origin is unclear — may be from a cement/concrete invention fact. Not a common distractor for inventor-name questions.
- Do NOT flag: "Cavity magnetron" as a distractor for "spark-gap transmitter" — this is actually a plausible wrong answer (both are radio frequency devices).
- Do NOT flag: The factual content of the Kilby/Noyce IC timeline — the approximately six-month gap is well-documented.
