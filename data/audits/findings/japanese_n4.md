# japanese_n4 — Quiz Audit Findings

## Summary

| Severity | Count |
|----------|-------|
| BLOCKER | 2 |
| MAJOR | 2 |
| MINOR | 1 |
| NIT | 0 |

N4 exhibits identical systemic defects to N5: POOL-CONTAM in reading/reverse templates, and `_fallback` dominance. The `_fallback` rate is worse at 84/180 (47%), primarily driven by kanji facts. Two SELF-ANSWERING cases confirmed for katakana loanwords in the vocabulary pool.

---

## Issues

### BLOCKER

- **Fact**: `ja-jlpt-777` @ mastery=2
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  ```
  Q: "What is the reading of 'スーパー (マーケット)'?"
   A) スーパー (マーケット)  ✓
   B) quarrel
   C) part time
   D) Ah
  ```
- **Issue**: Katakana word with identical reading to the word itself. Question shows the word, answer is the same string. Confirmed for `ja-jlpt-777`; pattern applies to all katakana loanwords in N4 vocabulary.

---

- **Fact**: representative of `ja-kanji-n4-有-meaning` class @ mastery=0–4
- **Category**: `POOL-CONTAM` (via `_fallback`)
- **Rendered**:
  ```
  Q: "What does 有 mean?"
   A) possess  ✓
   B) room
   C) sentence
   D) leg
  ```
- **Issue**: Kanji meaning facts correctly use English-meaning distractors. However, 84/180 rows use `_fallback` which produces `english_meanings` pool distractors for ALL question types. Kanji onyomi/kunyomi facts that fall to `_fallback` would show English meanings instead of Japanese readings — not captured in this specific sample but structurally certain. The 47% fallback rate is the highest structural risk.

---

### MAJOR

- **Fact**: representative N4 reading-template fact @ mastery=2
- **Category**: `POOL-CONTAM`
- **Rendered**:
  ```
  Q: "What is the reading of '[kanji word]'?"
   A) [English meaning 1]
   B) [English meaning 2]
   C) [hiragana reading]  ✓
   D) [English meaning 3]
  ```
- **Issue**: 19 reading-template facts in 180-row sample show English distractors. Same root cause as N5 — reading pool shares the `english_meanings` distractor pool.

---

- **Fact**: representative N4 reverse-template fact @ mastery=2
- **Category**: `POOL-CONTAM`
- **Rendered**:
  ```
  Q: "How do you say '[English word]' in Japanese?"
   A) [English word 1]
   B) [Japanese word]  ✓
   C) [English word 2]
   D) [English word 3]
  ```
- **Issue**: 26 reverse-template entries in 180-row sample show English distractors alongside Japanese correct answer.

---

### MINOR

- **Fact**: `ja-jlpt-777` (スーパー マーケット class)
- **Category**: `POOL-CONTAM` (POS-TELL subtype)
- **Rendered**:
  ```
  Q: "What is the reading of 'スーパー (マーケット)'?"
   A) スーパー (マーケット)  ✓
   B) quarrel
   C) part time
   D) Ah
  ```
- **Issue**: In addition to the self-answering defect, the option set mixes Japanese (katakana) and English strings — POS-TELL from script type alone allows elimination of all wrong answers.

---

## Expected vs Actual

| Template | Expected | Actual |
|----------|----------|--------|
| `reading` | Hiragana-reading distractors | English-meaning distractors (19 cases) |
| `reverse` | Japanese-word distractors | English-meaning distractors (26 cases) |
| `_fallback` | Appropriate fallback | Used for 47% of rows |
| `forward` | Correct | Correct |

---

## Notes

- N4 deck is structurally correct (1,143 facts, 7 pools, 2 sub-decks).
- The `_fallback` dominance in kanji facts (has-meaning, has-onyomi, has-kunyomi) suggests kanji template routing is broken at this level.
- No synthetic distractors across all pools.
