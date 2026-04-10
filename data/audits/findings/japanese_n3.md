# japanese_n3 — Quiz Audit Findings

## Summary

| Severity | Count |
|----------|-------|
| BLOCKER | 2 |
| MAJOR | 1 |
| MINOR | 2 |
| NIT | 0 |

N3 shows the same systemic POOL-CONTAM defects as N5/N4, with the highest reading-template contamination count in the sample (27 entries). `_fallback` rate is 72/180 (40%). One SELF-ANSWERING confirmed for katakana word ジュース.

---

## Issues

### BLOCKER

- **Fact**: `ja-jlpt-1418` @ mastery=2
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  ```
  Q: "What is the reading of 'ジュース'?"
   A) ジュース  ✓
   B) [English distractors]
  ```
- **Issue**: Katakana loanword (ジュース = "juice") has identical word and reading. Confirmed case; affects all katakana loanwords in N3 vocabulary.

---

- **Fact**: representative N3 reading-template fact
- **Category**: `POOL-CONTAM`
- **Rendered**:
  ```
  Q: "What is the reading of '[kanji compound]'?"
   A) [English meaning]
   B) [hiragana reading]  ✓
   C) [English meaning]
   D) [English meaning]
  ```
- **Issue**: 27 contaminated reading entries in 180-row sample — highest absolute count across N5/N4/N3. English meanings appear as distractors in reading questions. The correct reading is the only non-English option.

---

### MAJOR

- **Fact**: representative N3 reverse-template fact
- **Category**: `POOL-CONTAM`
- **Rendered**:
  ```
  Q: "How do you say '[English word]' in Japanese?"
   A) [English meaning 1]
   B) [Japanese word]  ✓
   C) [English meaning 2]
   D) [English meaning 3]
  ```
- **Issue**: 16 reverse-template rows in 180-row sample show English distractors. Same root cause as N5/N4.

---

### MINOR

- **Fact**: any N3 vocabulary word with multiple English translations
- **Category**: `AMBIGUOUS-Q`
- **Rendered**: Questions like "What does '会議' mean?" where the correct answer is "meeting" but "conference" and "assembly" are plausible synonyms not listed as `acceptableAlternatives`.
- **Issue**: N3 introduces more abstract vocabulary with genuine near-synonym ambiguity. Some distractors may be partially correct English translations of the word.

---

- **Fact**: N3 kanji facts
- **Category**: `OTHER` (`_fallback` template)
- **Rendered**: Kanji facts route to `_fallback` for 40% of rows.
- **Issue**: `_fallback` for kanji onyomi/kunyomi questions produces English distractors instead of Japanese-reading distractors, making the Japanese reading trivially identifiable.

---

## Expected vs Actual

| Template | Expected | Actual |
|----------|----------|--------|
| `reading` | Hiragana distractors | English distractors (27 cases) |
| `reverse` | Japanese distractors | English distractors (16 cases) |
| `_fallback` | Minimal use | 40% of rows |
| `forward` | Correct | Correct |
| `synonym_pick` | Correct | Correct |

---

## Notes

- At 3,091 facts, N3 is the largest standard JLPT vocab deck. Pool sizes are sufficient (1,990 vocabulary facts).
- The SYNONYM-LEAK risk at N3 is elevated: pairs like 食べる/召し上がる (eat/eat-honorific) will both appear in the pool and may surface as distractors for each other's synonym_pick questions.
- No synthetic distractors.
