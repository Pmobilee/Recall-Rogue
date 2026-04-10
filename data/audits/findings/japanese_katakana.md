# japanese_katakana — Quiz Audit Findings

## Summary

| Severity | Count |
|----------|-------|
| BLOCKER | 1 |
| MAJOR | 1 |
| MINOR | 1 |
| NIT | 0 |

The katakana deck exhibits the same structural POS-TELL defect as hiragana: a single pool containing both katakana-character facts and romaji-romanization facts, causing script mixing in option sets. 71 of 90 rows (79%) have mixed-script option sets. The rate is slightly lower than hiragana (82/90) due to sampling variation; the root cause is identical.

---

## Issues

### BLOCKER

- **Fact**: `ja-katakana-hyo-reverse` @ mastery=0–4
- **Category**: `POS-TELL`
- **Rendered**:
  ```
  Q: "Which katakana combination represents 'hyo'?"
   A) ba      ← romaji
   B) ヒョ  ✓ ← katakana
   C) ミャ    ← katakana
  ```
  At mastery=4:
  ```
   A) ギャ
   B) ミャ
   C) ザ
   D) ヒョ  ✓
   E) ba      ← only romaji; eliminable immediately
  ```
- **Issue**: Reverse question ("which katakana represents 'hyo'?") requires a katakana answer. Distractor `ba` is a romaji romanization — clearly eliminable by script type. The romaji string "ba" is the forward-fact answer for some other katakana character leaking into this question's option set. Affects 71 of 90 rows.

---

### MAJOR

- **Fact**: `ja-katakana-cho-reverse` @ mastery=0
- **Category**: `POS-TELL`
- **Rendered**:
  ```
  Q: "Which katakana combination represents 'cho'?"
   A) ryu    ← romaji
   B) ji     ← romaji
   C) チョ  ✓ ← katakana
  ```
- **Issue**: At mastery=0 with only 3 options, both distractors are romaji while the correct answer is katakana. The answer is 100% identifiable by script type alone — no knowledge of katakana required to answer correctly.

---

### MINOR

- **Fact**: Katakana digraph combinations (ヒョ, ギャ, チョ, etc.)
- **Category**: `NIT` (elevated to MINOR for visibility)
- **Rendered**: Digraph options appear well-formed in the sample (ヒョ, ギャ, ミャ, ザ are valid katakana).
- **Issue**: The distractor generation correctly produces valid katakana digraph combinations as distractors for other digraph-type reverse questions. This is working correctly. However, the pool has no verification that base-character distractors (single-character katakana like ザ) don't appear in digraph-question option sets — a single character is visually distinct from a two-character combination and may be eliminable by format length.

---

## Expected vs Actual

| Aspect | Expected | Actual |
|--------|----------|--------|
| Reverse template | Katakana-character distractors only | Mixed katakana + romaji (71/90 rows) |
| Forward template | Romaji distractors only | Mixed romaji + katakana (present) |
| Visually similar pairs (ソ/ン, シ/ツ) | Ideally present as distractors | Not confirmed in sample — may or may not appear |
| Template | Specialized kana template | `_fallback` (100%) |

---

## Notes

- 208 facts matches hiragana exactly (same chart structure).
- The root fix is identical to hiragana: split into `katakana_characters` (reverse answers) and `romaji_sounds` (forward answers) pools, or implement a script-aware kana template.
- Pedagogically, katakana combinations (ヒョ, チョ, etc.) are correctly treated as single answer units (two-character string). The deck correctly formats these as combined digraph strings in `correctAnswer`.
- Visually similar katakana pairs (ソ/ン, シ/ツ) are the most important learning challenge for katakana students. The audit cannot confirm whether these appear as distractors for each other — this would require checking the full fact population, not just the 30-fact sample. Recommend verifying that difficulty=4–5 entries use visually similar characters as distractors.
