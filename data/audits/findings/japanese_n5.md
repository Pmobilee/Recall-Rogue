# japanese_n5 — Quiz Audit Findings

## Summary

| Severity | Count |
|----------|-------|
| BLOCKER | 2 |
| MAJOR | 2 |
| MINOR | 1 |
| NIT | 0 |

The N5 vocab deck has two systemic structural defects that affect nearly every reading and reverse template quiz entry. The POOL-CONTAM issue in the `reading` template (English distractors appearing in "What is the reading of X?" questions) and the same defect in the `reverse` template make these question types trivially easy — the correct answer is always the only item in the expected script. These are cross-deck issues present in N5–N1.

---

## Issues

### BLOCKER

- **Fact**: `ja-jlpt-140` @ mastery=2
- **Category**: `POOL-CONTAM`
- **Rendered**:
  ```
  Q: "What is the reading of 'レコード'?"
   A) village
   B) fruit
   C) レコード  ✓
   D) sweater
  ```
- **Issue**: Reading template draws distractors from `english_meanings` pool. Correct answer is the only Japanese string in the option set — trivially identifiable without knowing the reading. Affects ~41 facts in 90-row sample.

---

- **Fact**: `ja-jlpt-3` @ mastery=2
- **Category**: `POOL-CONTAM`
- **Rendered**:
  ```
  Q: "How do you say 'approximate' in Japanese?"
   A) over there
   B) ～くらい; ぐらい  ✓
   C) only
   D) aunt
  ```
- **Issue**: Reverse template draws English-meaning distractors. Correct answer is the only Japanese string — script-type eliminates all wrong options immediately. Affects ~26 facts in 90-row sample.

---

### MAJOR

- **Fact**: `ja-jlpt-140` @ mastery=2
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  ```
  Q: "What is the reading of 'レコード'?"
   A) レコード  ✓
   B) village
   C) fruit
   D) sweater
  ```
- **Issue**: The `targetLanguageWord` is katakana `レコード` and the `reading` is also `レコード` (loanwords have no separate kana reading). The question literally asks for the reading of the word already shown in the question. Affects all katakana loanwords (レコード, アイスクリーム, etc.) in the vocabulary sub-deck. These facts should use a different template or be marked `homogeneityExempt`.

---

- **Fact**: `ja-jlpt-3` @ mastery=0
- **Category**: `_fallback` template overuse
- **Category**: `OTHER`
- **Rendered**:
  ```
  Q: "What does '～くらい; ぐらい' mean?"
   A) over there
   B) ～くらい; ぐらい
   C) approximate  ✓
  ```
- **Issue**: 30 of 90 sampled rows (33%) use `_fallback` template. The `_fallback` template uses the `english_meanings` pool for all question types regardless of quiz direction. For facts where the answer is a Japanese word (reverse/reading templates), `_fallback` produces English distractors. Root cause: kanji facts lacking a suitable template mapping fall back to this default.

---

### MINOR

- **Fact**: `ja-jlpt-4` (conceptual; any word with `about, toward` answer)
- **Category**: `AMBIGUOUS-Q`
- **Rendered**:
  ```
  Q: "What does '～ころ; ～ごろ' mean?"
   A) about, toward  ✓
   B) [other English meanings]
  ```
- **Issue**: Some N5 words have English answers containing multiple comma-separated meanings (e.g., "about, toward"), which are partially overlapping with other words in the pool. The comma-separated format means a distractor like "about" (if it existed) would be partially correct. Not widespread in this deck but worth monitoring.

---

## Expected vs Actual

| Template | Expected behavior | Actual behavior |
|----------|------------------|-----------------|
| `reading` | Japanese distractors (other hiragana readings) | English-meaning distractors from wrong pool |
| `reverse` | Japanese-word distractors | English-meaning distractors from wrong pool |
| `definition_match` | Correct (shows explanation, answer is English) | Correct |
| `forward` | Correct | Correct |
| `synonym_pick` | Correct | Correct |

---

## Notes

- 929 total facts is appropriate for N5 scope.
- Kanji sub-deck structure is sound but kanji facts overwhelmingly fall to `_fallback`.
- No synthetic distractors in any pool — at mastery=0, players see only 2 options; at mastery=2, only 3 options. Low option count reduces quiz difficulty appropriately for N5, but distractor quality within those options is compromised by pool contamination.
- The POOL-CONTAM defects are structural and affect N5 through N1 uniformly.
