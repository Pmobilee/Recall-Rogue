# japanese_n4_grammar — Quiz Audit Findings

## Summary

| Severity | Count |
|----------|-------|
| BLOCKER | 0 |
| MAJOR | 2 |
| MINOR | 2 |
| NIT | 0 |

N4 grammar uses `fill_blank_grammar` exclusively. LENGTH-TELL affects 32/90 rows (36%), primarily from mixing long obligatory forms (なければいけません) with short particles. SYNONYM-LEAK is the most significant content risk: N4 introduces multiple near-identical obligatory/conditional pairs that can validly fill each other's blanks.

---

## Issues

### MAJOR

- **Fact**: `ja-gram-n4-n4-obl-nakereba-ikenai-fill-0` @ mastery=0–4
- **Category**: `SYNONYM-LEAK`
- **Rendered**:
  ```
  Q: "[must-do sentence]{___}"
   A) か
   B) ばかり
   C) なければいけません  ✓
   D) みたいな
  ```
  And separately:
  ```
  Q: "[similar must-do sentence]{___}"
   A) でも
   B) なければならない  ✓
   C) てくれ
  ```
- **Issue**: `なければいけません` and `なければならない` are functionally synonymous ("must do") — both correct for nearly any obligatory context. They exist as separate grammar points (いけません vs ならない nuance) but in fill-in-blank sentences they are interchangeable for most learners. When one appears as a distractor for the other, it is semantically correct and thus an unfair wrong answer.

---

- **Fact**: `ja-gram-n4-n4-te-yokatta-fill-0` @ mastery=0–4
- **Category**: `LENGTH-TELL`
- **Rendered**:
  ```
  Q: "[relief expression sentence]{___}"
   A) てよかったです  ✓
   B) 少し
   C) も
  ```
- **Issue**: `てよかったです` (8ch) vs `少し` (2ch) vs `も` (1ch). Ratio 8:1. Correct answer stands out as the multi-morpheme option among monosyllabic distractors. Affects 32 of 90 rows.

---

### MINOR

- **Fact**: `ja-gram-n4-n4-app-you-da-fill-1` @ mastery=0
- **Category**: `LENGTH-TELL`
- **Rendered**:
  ```
  Q: "[appearance expression]{___}"
   A) ようです  ✓
   B) さ
   C) ので
  ```
- **Issue**: `ようです` (4ch) vs `さ` (1ch) — 4:1 ratio. Mild but present; correct answer is the longest option and the multi-morpheme one.

---

- **Fact**: `ja-gram-n4-n4-purp-koto-ga-dekiru-fill-2` @ mastery=0
- **Category**: `SYNONYM-LEAK`
- **Rendered**:
  ```
  Q: "[ability expression]{___}"
   A) ことがあります
   B) ことができます  ✓
   C) と
  ```
- **Issue**: `ことができます` ("can do") vs `ことがあります` ("sometimes do") — both are `こと + が + [verb]` constructions visually similar. `ことがあります` appears as a distractor here; if a student doesn't yet distinguish "can" from "sometimes," they may correctly select `ことができます` for the wrong reason. This also represents a DUPLICATE-OPT risk: both start with `ことが`, making them visually confusable.

---

## Expected vs Actual

| Aspect | Expected | Actual |
|--------|----------|--------|
| Template | `fill_blank_grammar` | Correct — 100% |
| Near-synonym handling | Separate pools to avoid SYNONYM-LEAK | Same grammar_all pool used; synonyms can appear as distractors |
| LENGTH-TELL | Options within 3× length ratio | 32/90 rows exceed threshold |

---

## Notes

- 14 semantic pools vs N5's 8 — better distractor scoping than N5.
- The SYNONYM-LEAK between なければいけません/なければならない is a known pedagogical debate point (both are "must"); this may be intentional testing of the nuance, but without clear question context it creates ambiguity.
- No `_fallback` usage. Strong template hygiene.
- Translation and romaji fields present in sampled facts.
