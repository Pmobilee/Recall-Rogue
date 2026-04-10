# japanese_n1 — Quiz Audit Findings

## Summary

| Severity | Count |
|----------|-------|
| BLOCKER | 3 |
| MAJOR | 2 |
| MINOR | 1 |
| NIT | 0 |

N1 has the most severe `_fallback` rate of all JLPT decks (111/180 = 62%) and 3 confirmed SELF-ANSWERING cases. The POOL-CONTAM pattern is present in reading and reverse templates. The very high `_fallback` rate suggests N1's large kanji pool (1,232 kanji) is almost entirely falling through to fallback, making onyomi/kunyomi question types non-functional.

---

## Issues

### BLOCKER

- **Fact**: `ja-jlpt-5232` @ mastery=4
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  ```
  Q: "What is the reading of 'しかしながら'?"
   A) oil
   B) しかしながら  ✓
   C) sure, very
   D) near to
   E) at the latest
  ```
- **Issue**: `しかしながら` is written in hiragana — the word IS the reading. Asking "What is the reading?" when the word is already in its phonetic form is self-answering. The answer appears verbatim in the question stem (the word shown is already hiragana, which is what the reading asks for). Affects all hiragana-written vocabulary words assigned to the `reading` template.

---

- **Fact**: `ja-jlpt-5128` @ mastery=4
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  ```
  Q: "What is the reading of 'アプローチ'?"
   A) アプローチ  ✓
   B) domestic animals
   C) kotatsu
   D) knowledge
  ```
- **Issue**: Katakana loanword — reading is identical to the word. Same structural defect as other JLPT levels but more prevalent at N1 where formal vocabulary includes more katakana loan terms.

---

- **Fact**: `ja-jlpt-5349` @ mastery=4
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  ```
  Q: "What is the reading of 'はらはら'?"
   A) to step into
   B) to offer
   C) now, come, crucial moment
   D) はらはら  ✓
  ```
- **Issue**: `はらはら` is a hiragana reduplication word (onomatopoeia for "fluttering/anxiously"). Already in phonetic form — asking for the "reading" of a hiragana word is meaningless and self-answering.

---

### MAJOR

- **Fact**: representative N1 reading-template fact
- **Category**: `POOL-CONTAM`
- **Rendered**:
  ```
  Q: "What is the reading of '[N1 kanji compound]'?"
   A) oil
   B) [hiragana reading]  ✓
   C) sure, very
   D) near to
  ```
- **Issue**: 12 reading-template rows in 180-row sample show English distractors. Same structural defect as all other JLPT levels. At N1, this is especially problematic because the target audience (advanced learners) would be most harmed by trivially easy questions.

---

- **Fact**: N1 `_fallback` dominance for kanji facts
- **Category**: `OTHER`
- **Rendered**: 111/180 rows (62%) use `_fallback` — the highest rate across all JLPT decks.
- **Issue**: N1 has 1,232 kanji facts. The vast majority of kanji onyomi, kunyomi, and meaning facts route to `_fallback`. This means kanji reading questions at N1 show English distractors when they should show Japanese readings, and the `_fallback` template's question phrasing may not match the intended question type.

---

### MINOR

- **Fact**: N1 reverse-template entries
- **Category**: `POOL-CONTAM`
- **Rendered**:
  ```
  Q: "How do you say '[English word]' in Japanese?"
   A) [English]  ✓ [wrong — correct should be Japanese]
   ... [wait, the Japanese is the correct answer]
  ```
- **Issue**: 10 reverse-template rows in 180-row sample show English distractors. Lowest contamination count across JLPT levels, possibly because N1's very large Japanese pool provides more diverse Japanese distractors.

---

## Expected vs Actual

| Template | Expected | Actual |
|----------|----------|--------|
| `reading` | Hiragana distractors + only kanji words as question subjects | English distractors; hiragana/katakana words also get reading template |
| `reverse` | Japanese distractors | English distractors (10 cases) |
| `_fallback` | Minimal use | 62% of rows — systemic failure |
| `forward` | Correct | Correct |

---

## Notes

- 6,269 facts is appropriate for N1 scope — largest JLPT deck, expected.
- The `reading` template should not be applied to words already written in hiragana or katakana; template assignment logic needs a script-check guard.
- N1 SYNONYM-LEAK is high risk but not directly observable in the quiz dump format (distractors are not always from the correct answer pool of other facts).
- No synthetic distractors across all pools.
