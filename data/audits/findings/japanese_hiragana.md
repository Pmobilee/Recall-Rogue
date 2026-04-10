# japanese_hiragana — Quiz Audit Findings

## Summary

| Severity | Count |
|----------|-------|
| BLOCKER | 1 |
| MAJOR | 1 |
| MINOR | 1 |
| NIT | 0 |

The hiragana deck has a systemic POOL-CONTAM defect: the single `english_meanings` pool is used for both forward (character→romaji) and reverse (romaji→character) facts. Forward questions correctly show English/romaji answers, but reverse questions need hiragana-character distractors. Because the pool mixes both types, 82 of 90 rows present option sets that mix hiragana characters and romaji strings — the answer type is trivially identifiable by script alone.

---

## Issues

### BLOCKER

- **Fact**: `ja-hiragana-ra-reverse` @ mastery=0–4
- **Category**: `POS-TELL`
- **Rendered**:
  ```
  Q: "Which hiragana character represents 'ra'?"
   A) yu         ← romaji
   B) ぎ         ← hiragana
   C) ら  ✓     ← hiragana
  ```
  At mastery=4:
  ```
   A) ら  ✓
   B) ぼ
   C) yu        ← only romaji option
   D) も
   E) ぎ
  ```
- **Issue**: Correct answer `ら` is hiragana. Distractors are a mix of hiragana characters AND romaji romanizations (from the forward-fact answers in the same pool). The presence of romaji "yu" in a question asking for a hiragana character is script-type contamination — any player who knows that the answer must be a hiragana character can eliminate all romaji options immediately. Affects 82 of 90 rows (91%).

---

### MAJOR

- **Fact**: `ja-hiragana-ki-forward` @ mastery=0
- **Category**: `POS-TELL`
- **Rendered**:
  ```
  Q: "What sound does the hiragana き represent?"
   A) た      ← hiragana character
   B) to      ← romaji answer
   C) ki  ✓  ← romaji answer
  ```
- **Issue**: Forward question has correct answer `ki` (romaji) but distractor `た` is a hiragana character. A player knows the answer must be a romaji string (since the question asks for "sound"), so `た` is immediately eliminable by script type. The single-pool architecture makes this bidirectional: both forward and reverse questions pull from a pool containing both character-type facts and romaji-type facts.

---

### MINOR

- **Fact**: `ja-hiragana-a-forward` / `ja-hiragana-a-reverse` class
- **Category**: `SELF-ANSWERING` (structural)
- **Rendered**:
  ```
  Q: "What sound does the hiragana あ represent?"
   A) a  ✓
   [distractors: other romaji sounds]
  ```
- **Issue**: For the basic vowels (あ, い, う, え, お), the romanization (a, i, u, e, o) is trivially guessable even without studying hiragana — they map to the most common English vowel letters. This is inherent to the content (not a data defect) but should be acknowledged as a difficulty calibration note: difficulty=1 is appropriate, but even difficulty=1 may be too generous for basic vowels since the question is answerable by English vowel logic alone.

---

## Expected vs Actual

| Aspect | Expected | Actual |
|--------|----------|--------|
| Forward template (character→romaji) | Romaji distractors from same pool | Mixed hiragana + romaji distractors |
| Reverse template (romaji→character) | Hiragana-character distractors | Mixed hiragana + romaji distractors |
| Template used | Specialized kana template | `_fallback` (100%) |
| Script consistency per option set | All options same script type | 82/90 rows have mixed scripts |

---

## Notes

- 208 facts is correct for the complete hiragana chart (46 base + dakuten + handakuten + digraphs × 2 directions).
- The root fix is a separate `hiragana_characters` pool (reverse-fact answers) and a `romaji_sounds` pool (forward-fact answers), or a dedicated kana template that enforces script-type consistency in distractors.
- Difficulty progression (1–5 by character complexity) is sound pedagogically.
- No `syntheticDistractors` — the pool is too small and too mixed to generate meaningful synthetics without first fixing the pool separation.
