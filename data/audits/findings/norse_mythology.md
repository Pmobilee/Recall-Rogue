# norse_mythology — Quiz Audit Findings

## Summary
87 quiz dump entries (29 facts × 3 mastery levels). One confirmed MAJOR and one MINOR issue both stem from the same root cause: the `object_names` pool contains a numeric answer ("8" for Sleipnir's legs) that contaminates object-name quizzes at mastery 4.

## Issues

### MAJOR

- **Fact**: `myth_norse_sleipnir_legs` @ mastery=0,2,4
- **Category**: `POOL-CONTAM`
- **Rendered** (mastery=0):
  Q: "How many legs does Sleipnir, Odin's magical horse, have?"
   A) 22
   B) 10
   C) 8 ✓
- **Issue**: Correct answer "8" is numeric but placed in the `object_names` pool. The answer type is semantically incompatible with object names. At mastery 4, "8" bleeds as a distractor into `myth_norse_thor_thrym_recovered` (see below), creating a nonsensical option in an object-name question.

---

### MINOR

- **Fact**: `myth_norse_thor_thrym_recovered` @ mastery=4
- **Category**: `POOL-CONTAM`
- **Rendered** (mastery=4):
  Q: "What did Thrym place on Freyja's lap, allowing Thor to seize it?"
   A) Andvaranaut
   B) The earth
   C) 8 ✓ (WRONG — "8" is a distractor here, not the correct answer; correct is "Mjolnir")
   D) Yggdrasil
   E) Mjolnir ✓
- **Issue**: The numeric distractor "8" (Sleipnir's legs count) leaks from `object_names` pool into this question at mastery 4 where 5 options are shown. A player sees "8" as a distractor for "what object did Thrym place on Freyja's lap?" — obviously wrong, making a distractor trivially eliminable and signaling pool contamination.

## Expected vs Actual
Expected potential length heterogeneity in object_names. Actual: length heterogeneity (min=3 "8", max=12 "Draupnir"... 4.0x ratio) confirmed and the root cause is a misclassified fact. The numeric distractor bleed at mastery 4 was caught as predicted.

## Notes
- 29 facts use `_fallback` template — all render as coherent English.
- POS-TELL cases (gendered pronouns) found across ~9 unique facts but assessed as NIT-level given that Norse deity sets in each pool are already somewhat gender-balanced.
- No chain themes populated. Study Temple mechanic non-functional.
- The fix is straightforward: move `myth_norse_sleipnir_legs` to a `bracket_numbers` pool (create one if it doesn't exist) so "8" never appears as a distractor in the object_names pool.
