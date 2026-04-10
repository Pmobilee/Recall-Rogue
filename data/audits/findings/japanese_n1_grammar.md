# japanese_n1_grammar — Quiz Audit Findings

## Summary

| Severity | Count |
|----------|-------|
| BLOCKER | 1 |
| MAJOR | 2 |
| MINOR | 2 |
| NIT | 0 |

N1 grammar uses `fill_blank_grammar` exclusively with 177 rows sampled. LENGTH-TELL affects 29/177 rows (16%). The defining quality risk is SYNONYM-LEAK between near-identical N1 patterns (なり/なりとも, をもちまして/をもってすれば) which appear as distractors for each other and may both be grammatically valid in context.

---

## Issues

### BLOCKER

- **Fact**: `ja-gram-n1-time-nari-fill-3` @ mastery=0–4
- **Category**: `SYNONYM-LEAK`
- **Rendered**:
  ```
  Q: "[temporal/parallel action sentence]{___}"
   A) もさることながら
   B) なりとも  [distractor]
   C) なり  ✓
  ```
  And at mastery=4:
  ```
   A) もさることながら
   B) ともあろうものが
   C) なり  ✓
   D) なりとも  [distractor]
   E) に忍びない
  ```
- **Issue**: `なり` and `なりとも` are closely related N1 grammar points (なり = "as soon as / or...or"; なりとも = "at least / even if just"). `なりとも` appears as a distractor when `なり` is correct. In a fill-blank sentence with `なり` as the answer, `なりとも` may also be grammatically plausible depending on the sentence. This is BLOCKER level because it makes the question unfair for advanced learners who know both patterns.

---

### MAJOR

- **Fact**: `ja-gram-n1-cause-bakoso-fill-2` @ mastery=4
- **Category**: `LENGTH-TELL`
- **Rendered**:
  ```
  Q: "[emphatic causal clause]{___}"
   A) を押して
   B) をもってすれば
   C) とは比べものにならない
   D) 羽目になった
   E) ばこそ  ✓
  ```
- **Issue**: `ばこそ` (3ch) vs `とは比べものにならない` (12ch) — 4:1 ratio. Correct answer is not the shortest (を押して = 3ch also), but the pool contains extreme length variation. N1 has the widest character-length distribution of any grammar deck.

---

- **Fact**: `ja-gram-n1-formal-womochimashite-fill-1` @ mastery=0
- **Category**: `SYNONYM-LEAK`
- **Rendered**:
  ```
  Q: "[formal ceremony sentence]{___}"
   A) をものともせず
   B) をもちまして  ✓
   C) とて
  ```
- **Issue**: `をもちまして` ("with this / by means of") and `をもってすれば` ("if one uses") — both formal `をもって` constructions — are semantically similar. Although `をもってすれば` is not in this specific option set, `をものともせず` is from the same formal register and could appear as a cross-pool distractor in other arrangements.

---

### MINOR

- **Fact**: `ja-gram-n1-n1-app-kirai-fill-2` @ mastery=0
- **Category**: `LENGTH-TELL`
- **Rendered**:
  ```
  Q: "[tendency/habit sentence]{___}"
   A) きらいがある  ✓
   B) つ
   C) どうにも
  ```
- **Issue**: `きらいがある` (6ch) vs `つ` (1ch) — 6:1 ratio. Correct answer is the only multi-morpheme option; `つ` (archaic alternate-action particle) is a single character. Students who don't know `つ` can still eliminate it as "clearly too short."

---

- **Fact**: `purpose` pool — 12 facts
- **Category**: `OTHER` (pool exhaustion)
- **Rendered**: At mastery=4, the engine needs 4 distractors from a pool of 12 facts (11 remaining).
- **Issue**: Smallest pool in N1 grammar (12 facts). Players studying purpose-pattern grammar at high mastery will rapidly exhaust distractor variety and begin recognizing distractors rather than learning patterns.

---

## Expected vs Actual

| Aspect | Expected | Actual |
|--------|----------|--------|
| Template | `fill_blank_grammar` | Correct — 100% |
| LENGTH-TELL rate | <10% | 16% (29/177) |
| SYNONYM-LEAK | Controlled by pool separation | Present within pools (なり/なりとも) |
| Self-answering | None | None confirmed |

---

## Notes

- 177 rows sampled vs 90 for other grammar decks — N1's 1,183 facts means more unique facts appear in the sample.
- 23 semantic pools — second-finest pool architecture after N2's 26. The pool granularity mostly works but `scope_selection` (112 facts) and `concession_contrast` (111 facts) are very large, meaning distractors in those pools span a wide semantic range.
- `obligation_emotion` pool has only 16 facts — second-smallest after `purpose` (12); pool exhaustion risk at mastery=4.
- No `_fallback` usage — excellent template hygiene across all grammar decks.
