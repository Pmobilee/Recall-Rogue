# japanese_n2_grammar — Quiz Audit Findings

## Summary

| Severity | Count |
|----------|-------|
| BLOCKER | 0 |
| MAJOR | 1 |
| MINOR | 3 |
| NIT | 0 |

N2 grammar is the best-performing grammar deck: lowest LENGTH-TELL rate (9/78 rows, 12%), no `_fallback`, excellent 26-pool architecture. The fine-grained pool structure largely prevents cross-category distractor contamination. Main risks are small pool sizes causing potential exhaustion, and SYNONYM-LEAK between formally similar N2 patterns.

---

## Issues

### MAJOR

- **Fact**: `ja-gram-n2-n2-feel-naranai-fill-0` @ mastery=4
- **Category**: `LENGTH-TELL`
- **Rendered**:
  ```
  Q: "[unbearable feeling sentence]{___}"
   A) 以来
   B) から～にかけて
   C) を通して
   D) ば～ほど
   E) てならない  ✓
  ```
- **Issue**: `以来` (2ch) vs `から～にかけて` (8ch including tilde) vs `てならない` (5ch). Ratio ~4:1 on some comparisons. However, with 5 options at mastery=4, the length tell is less severe than at lower mastery. Still flagged as MAJOR because `以来` is clearly shorter and eliminable by length in a field of compound grammar forms.

---

### MINOR

- **Fact**: `ja-gram-n2-temp-ittan-fill-1` @ mastery=4
- **Category**: `SYNONYM-LEAK`
- **Rendered**:
  ```
  Q: "[temporal clause with いったん]{___}"
   A) てからでないと
   B) 向けだ
   C) たとたんに
   D) に従って
   E) 一旦  ✓
  ```
- **Issue**: `てからでないと` ("not until") and `たとたんに` ("at the moment of") and `一旦` ("once") are all temporal connectors that could plausibly describe similar timeline sequences. `たとたんに` in particular (N2 pattern: "as soon as") is semantically close to `一旦...` constructions.

---

- **Fact**: `ja-gram-n2-ability-eru` pool — 8 facts total
- **Category**: `OTHER` (pool exhaustion risk)
- **Rendered**: At mastery=4, the engine needs 4 distractors from a pool of only 8 facts total (7 remaining after correct answer). This is structurally acceptable but means players at mastery=4 will see the same distractor set repeatedly.
- **Issue**: `ability` pool has only 8 facts — minimal distractor variety. Players who study ability-type grammar points at high mastery will memorize distractors, not knowledge.

---

- **Fact**: `ja-gram-n2-viewpoint-temae-fill-0` @ mastery=0
- **Category**: `LENGTH-TELL`
- **Rendered**:
  ```
  Q: "[face-saving viewpoint sentence]{___}"
   A) にほかならない
   B) かのようだ
   C) 手前  ✓
  ```
- **Issue**: `手前` (2ch) vs `にほかならない` (7ch) — 3.5:1 ratio, borderline. At mastery=0 with 3 options, correct 2-character answer is the shortest option. Mild but present.

---

## Expected vs Actual

| Aspect | Expected | Actual |
|--------|----------|--------|
| Template | `fill_blank_grammar` | Correct — 100% |
| LENGTH-TELL rate | <10% | 12% (9/78) — best grammar deck |
| Pool architecture | 26 semantic pools | Correct — 26 pools with appropriate granularity |
| Pool size adequacy | ≥15 facts per pool | Many pools at 8–20 facts; some risk exhaustion |

---

## Notes

- N2 grammar is the structural gold standard for the grammar deck series: 26 pools, clean template routing, lowest LENGTH-TELL rate.
- 78 sampled rows vs expected 90 — 12-row gap; some facts may not have reached all 3 mastery sample points.
- The fine-grained pool architecture (ability, addition, appearance_state, assertion, etc.) is the right approach for N2. N5 grammar would benefit from the same treatment.
- No confirmed SELF-ANSWERING or BROKEN-GRAMMAR in sampled rows.
