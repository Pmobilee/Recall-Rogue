# japanese_n2 — Quiz Audit Findings

## Summary

| Severity | Count |
|----------|-------|
| BLOCKER | 1 |
| MAJOR | 2 |
| MINOR | 1 |
| NIT | 0 |

N2 has the lowest `_fallback` rate of the JLPT vocab decks (75/177 = 42%) but still shows POOL-CONTAM in reading and reverse templates. No SELF-ANSWERING confirmed in the 177-row sample (0 cases) — N2 vocabulary has fewer pure katakana loanwords. SYNONYM-LEAK is a known elevated risk at this level.

---

## Issues

### BLOCKER

- **Fact**: representative N2 reading-template fact
- **Category**: `POOL-CONTAM`
- **Rendered**:
  ```
  Q: "What is the reading of '[kanji word]'?"
   A) [English meaning]
   B) [English meaning]
   C) [hiragana reading]  ✓
   D) [English meaning]
  ```
- **Issue**: 21 reading-template entries in 177-row sample use English-meaning distractors. Script-type alone reveals the answer. Same structural defect as N5–N4–N3.

---

### MAJOR

- **Fact**: representative N2 reverse-template fact
- **Category**: `POOL-CONTAM`
- **Rendered**:
  ```
  Q: "How do you say '[English word]' in Japanese?"
   A) [English word 1]
   B) [Japanese word]  ✓
   C) [English word 2]
   D) [English word 3]
  ```
- **Issue**: 21 reverse-template rows (same count as reading in this sample) show English distractors alongside Japanese answer.

---

- **Fact**: N2 vocabulary near-synonym pairs (conceptual)
- **Category**: `SYNONYM-LEAK`
- **Rendered**:
  ```
  Q: "Which word is closest in meaning to '増やす'?"
   A) increase  ✓
   B) go up (could describe 増える)
   C) [other]
  ```
- **Issue**: N2 vocabulary has many near-synonym pairs (増える/増やす, 変わる/変える, 続く/続ける — intransitive/transitive pairs) that are semantically very close. In `synonym_pick` templates, the English meanings of paired words may overlap enough to create genuine ambiguity. The pool is large enough (1,681 facts) that this occurs regularly.

---

### MINOR

- **Fact**: N2 kanji facts
- **Category**: `OTHER` (`_fallback` with inappropriate distractors for onyomi/kunyomi)
- **Rendered**: Kanji reading questions using English-meaning distractors via `_fallback`.
- **Issue**: Same `_fallback` routing issue as other levels; 42% of sampled rows. Kunyomi pool (163 facts) and onyomi pool (204 facts) exist but are not being used as distractor sources for the respective question types.

---

## Expected vs Actual

| Template | Expected | Actual |
|----------|----------|--------|
| `reading` | Hiragana distractors | English distractors (21 cases) |
| `reverse` | Japanese distractors | English distractors (21 cases) |
| `_fallback` | Minimal use | 42% of rows |
| `forward` | Correct | Correct |
| `synonym_pick` | Correct; near-synonyms risk | Near-synonym overlap possible |

---

## Notes

- N2 is the cleanest of the JLPT vocab decks in terms of SELF-ANSWERING (0 confirmed cases).
- The POOL-CONTAM count is lower than N3 (21 vs 27) despite a larger pool, suggesting the N2 vocabulary has slightly better template routing for some fact types.
- No synthetic distractors.
