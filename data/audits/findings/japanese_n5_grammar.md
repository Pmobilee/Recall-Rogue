# japanese_n5_grammar — Quiz Audit Findings

## Summary

| Severity | Count |
|----------|-------|
| BLOCKER | 0 |
| MAJOR | 2 |
| MINOR | 2 |
| NIT | 1 |

Grammar decks are structurally sound — exclusively using `fill_blank_grammar` template with no `_fallback` contamination. The main issues are LENGTH-TELL (dominant, 54/90 rows) from mixing single-character particles with multi-morpheme grammar structures in the same option set, and AMBIGUOUS-Q from particle questions where context doesn't uniquely determine the correct particle.

---

## Issues

### MAJOR

- **Fact**: `ja-gram-n5-n5-particle-ni-indirect-fill-4` @ mastery=0–4
- **Category**: `LENGTH-TELL`
- **Rendered**:
  ```
  Q: "彼は先生{___}しかられた。 (He got scolded by the teacher.)"
   A) それから
   B) に  ✓
   C) てはいけません
  ```
- **Issue**: Options mix `に` (1 character) with `てはいけません` (7 characters) and `それから` (4 characters). Ratio 7:1 exceeds the 3× threshold. At mastery=0 with only 3 options, the single-character particle stands out as the likely answer by length alone. Affects 54 of 90 sampled rows (60%) — the most widespread quality issue in this deck.

---

- **Fact**: `ja-gram-n5-n5-particle-to-fill-0` @ mastery=2
- **Category**: `AMBIGUOUS-Q`
- **Rendered**:
  ```
  Q: "パン{___}ミルクを買いました。 (I bought bread and milk.)"
   A) と  ✓
   B) に
   C) が
   D) があります
  ```
- **Issue**: The particle `と` ("and") is correct, but `や` (also "and," listing particle) would also be grammatically acceptable in this context. `や` is not in the options here, but the pool includes it. For sentences requiring conjunctive "and," と/や are often interchangeable; a player who knows `や` could correctly question why it's wrong. This ambiguity pattern affects multiple N5 particle questions.

---

### MINOR

- **Fact**: `ja-gram-n5-n5-adj-i-fill-4` @ mastery=0
- **Category**: `LENGTH-TELL`
- **Rendered**:
  ```
  Q: "[sentence with i-adjective blank]"
   A) にします
   B) い  ✓
   C) しかし
  ```
- **Issue**: `い` (1 character) is the correct i-adjective ending, but it stands out as the shortest option by a significant margin when paired with multi-morpheme distractors. The adjective_form pool has only 6 facts, making distractor variety extremely limited.

---

- **Fact**: `ja-gram-n5-n5-copula-janai-fill-1` @ mastery=4
- **Category**: `POOL-CONTAM` (cross-category distractor)
- **Rendered**:
  ```
  Q: "[sentence with negation blank]"
   A) ではありません  ✓
   B) がいます
   C) のが上手
   D) をください
   E) です
  ```
- **Issue**: Distractors `がいます` (existence verb), `のが上手` (skill expression), `をください` (request) are semantically and grammatically unrelated to the negation blank. The `grammar_all` pool (375 facts) pulls distractors from across all N5 grammar categories, making the incorrect options easily eliminable by semantic category.

---

### NIT

- **Fact**: `ja-gram-n5-n5-particle-ya-fill-2` @ mastery=4
- **Category**: `LENGTH-TELL`
- **Rendered**:
  ```
  Q: "[listing particle blank]"
   A) も
   B) や  ✓
   C) と思います
   D) てあります
   E) よ
  ```
- **Issue**: Ratio `よ`(1ch) to `と思います`(4ch) to `てあります`(4ch) is 4:1. Mild length tell at mastery=4 where 5 options provide more cover, but the single-character options still stand out.

---

## Expected vs Actual

| Aspect | Expected | Actual |
|--------|----------|--------|
| Template | `fill_blank_grammar` | Correct — 100% |
| Distractor scope | Same semantic pool as answer | Mixed: particles vs multi-morpheme structures |
| Option count at mastery=0 | 3 | Correct |
| Option count at mastery=4 | 5 | Correct |
| Self-answering | None | None confirmed |

---

## Notes

- No `_fallback` usage — best structural result across all grammar decks.
- The LENGTH-TELL issue is inherent to Japanese grammar teaching: particles are single characters, while complex grammar constructions are multi-morpheme. Separating single-particle pools from multi-morpheme pools would resolve this.
- Translation fields (`sentenceTranslation`, `sentenceRomaji`) appear populated in all sampled facts — good.
- `grammarPointLabel` field populated and meaningful (e.g., "が — subject marker particle").
