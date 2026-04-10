# japanese_n3_grammar — Quiz Audit Findings

## Summary

| Severity | Count |
|----------|-------|
| BLOCKER | 0 |
| MAJOR | 2 |
| MINOR | 2 |
| NIT | 0 |

N3 grammar uses `fill_blank_grammar` exclusively. LENGTH-TELL affects 35/87 rows (40%) — driven by mixing single-kanji expressions (為, 旨) with long compound forms (下さいませんか, 比べものにならない). AMBIGUOUS-Q is elevated at N3 where clause connectors and conditionals have genuine overlap.

---

## Issues

### MAJOR

- **Fact**: `ja-gram-n3-1583-fill-1` @ mastery=0–4
- **Category**: `LENGTH-TELL`
- **Rendered**:
  ```
  Q: "[causal clause]{___}"
   A) 為  ✓
   B) からして
   C) せいで
  ```
- **Issue**: `為` (1ch) vs `からして` (4ch) vs `せいで` (3ch). Ratio 4:1 exceeds threshold. The single-kanji answer stands out visually. Appears 3 times in the sample (mastery 0/2/4). Also present: `ja-gram-n3-1130-fill-2` with `為`/`気がする`/`を通して`.

---

- **Fact**: `ja-gram-n3-1473-fill-0` @ mastery=0
- **Category**: `LENGTH-TELL`
- **Rendered**:
  ```
  Q: "[request sentence]{___}"
   A) できるだけ
   B) 反面
   C) 下さいませんか  ✓
  ```
- **Issue**: `できるだけ` (5ch) vs `反面` (2ch) vs `下さいませんか` (8ch) — ratio 4:1. At mastery=0 with only 3 options, the longest option is the correct formal request form. Players can guess by choosing the most structurally complete option.

---

### MINOR

- **Fact**: `ja-gram-n3-641-fill-0` @ mastery=4
- **Category**: `AMBIGUOUS-Q`
- **Rendered**:
  ```
  Q: "[sentence with topic particle position]{___}"
   A) がち
   B) に対して  ✓
   C) の
   D) もしかして
   E) 聞いた
  ```
- **Issue**: The particles `の` and `に対して` can both function as post-noun modifiers in various contexts. Depending on the exact sentence, `の` (possessive/nominalizer) may be grammatically valid. N3 introduces many particles that overlap in function; single-blank contexts do not always uniquely constrain the answer.

---

- **Fact**: `ja-gram-n3-783-fill-0` @ mastery=2
- **Category**: `SYNONYM-LEAK`
- **Rendered**:
  ```
  Q: "[progressive action sentence]{___}"
   A) てくる
   B) のに
   C) ている  ✓
   D) どちらかといえば
  ```
- **Issue**: `ている` (ongoing state) vs `てくる` (change toward speaker/gradual change) — both involve the te-form and can express ongoing situations in some contexts. A student who doesn't yet distinguish the directional nuance of `てくる` might argue it's valid.

---

## Expected vs Actual

| Aspect | Expected | Actual |
|--------|----------|--------|
| Template | `fill_blank_grammar` | Correct — 100% |
| LENGTH-TELL rate | <10% | 40% (35/87 rows) |
| AMBIGUOUS-Q | Minimal | Present at clause connector level |

---

## Notes

- 87 rows sampled (vs 90 for other decks) — minor gap; 3 rows missing from expected sample.
- N3 grammar fact count (670) is the largest of the grammar decks; 10 semantic pools provide reasonable scope.
- The `clause_connector` pool (127 facts) is large enough for good distractor variety, but the semantic overlap within that category creates AMBIGUOUS-Q risk.
- No `_fallback`. Clean template routing.
