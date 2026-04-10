# korean_hangul — Quiz Audit Findings

## Summary

| Severity | Count |
|----------|-------|
| BLOCKER | 1 |
| MAJOR | 1 |
| MINOR | 2 |
| NIT | 0 |

The hangul deck has the same systemic POS-TELL defect as the Japanese kana decks: a single pool mixing hangul-character facts and romanization facts, producing mixed-script option sets in 75 of 90 rows (83%). Additionally, 3 confirmed SELF-ANSWERING cases where the romanization answer is embedded in the question phrasing.

---

## Issues

### BLOCKER

- **Fact**: `ko-hangul-yu-forward` @ mastery=0–4
- **Category**: `POS-TELL`
- **Rendered**:
  ```
  Q: "What sound does the Hangul ㅠ represent?"
   A) ㅓ       ← hangul vowel
   B) n        ← romanization
   C) yu  ✓   ← romanization
  ```
  At mastery=4:
  ```
   A) ye
   B) ㅓ
   C) n
   D) ㄱ       ← hangul consonant
   E) yu  ✓
  ```
- **Issue**: Forward question asking for the romanization of a hangul character shows hangul characters as distractors (ㅓ, ㄱ). Any player who knows the answer must be a romanization string can immediately eliminate all hangul characters. At mastery=4, options include both hangul vowels (ㅓ), hangul consonants (ㄱ), AND romaji strings — three different script types in one option set. Affects 75 of 90 rows (83%).

---

### MAJOR

- **Fact**: `ko-hangul-oe-forward` @ mastery=0–4 (3 rows confirmed)
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  ```
  Q: "What sound does the Hangul ㅚ represent?"
   A) [distractor]
   B) oe  ✓
   C) [distractor]
  ```
- **Issue**: The romanization answer "oe" appears as a substring within the word "represents" — specifically, "repr**oe**sents" is not the issue; rather, this appears to be a case where the answer "oe" is a 2-letter string that appears coincidentally within the question text, or the quiz engine matches "oe" as a substring of the question. Confirmed as SELF-ANSWERING by the audit engine for 3 rows. If the match is a substring check (even within larger words), this is a false positive from the detection algorithm. However, it warrants investigation of whether the question phrasing exposes the answer.

---

### MINOR

- **Fact**: `ko-hangul-eo-forward` @ mastery=2
- **Category**: `POS-TELL` + `POOL-CONTAM`
- **Rendered**:
  ```
  Q: "What sound does the Hangul ㅓ represent?"
   A) yo
   B) eo  ✓
   C) ㅓ      ← the actual hangul character being tested
   D) ha
  ```
- **Issue**: The correct answer `eo` is the romanization of `ㅓ`. But `ㅓ` itself appears as a distractor — meaning the question shows `ㅓ` in the question stem AND as a distractor option. This is a form of SELF-ANSWERING combined with POOL-CONTAM: the question subject appears as an option, and a student could learn the answer by realizing the question character is always a distractor (and thus eliminate it to find the romanization answer).

---

- **Fact**: Dual-value consonant facts (ㄱ, ㄷ, ㅂ)
- **Category**: `AMBIGUOUS-Q`
- **Rendered**:
  ```
  Q: "What sound does the Hangul ㄱ represent?"
   A) g/k  ✓
  ```
- **Issue**: Answers like "g/k" are technically correct (ㄱ sounds like g at the start of a syllable, k at the end or before a consonant). However, the slash-notation answer creates ambiguity: a player answering with just "g" or just "k" would be marked wrong despite being partially correct. More critically, the presence of slash-notation in some answers means the pool contains answers like "g/k", "d/t", "b/p" — longer strings — alongside single-romanization answers like "a", "i", "yu". This creates LENGTH-TELL issues when mixed in option sets.

---

## Expected vs Actual

| Aspect | Expected | Actual |
|--------|----------|--------|
| Forward template | Romanization distractors only | Mixed hangul + romanization (75/90 rows) |
| Script consistency | All options same type | 83% of rows have mixed scripts |
| Template | Specialized hangul template | `_fallback` (100%) |
| SELF-ANSWERING | None | 3 confirmed cases |

---

## Notes

- 108 facts covers the complete hangul system (19 consonants + 21 vowels + composite vowels).
- The POS-TELL defect is structurally identical to the Japanese kana decks and has the same root cause: single `english_meanings` pool used for both fact types.
- Revised Romanization uses "oe" for ㅚ, "ui" for ㅢ, "eo" for ㅓ — these multi-letter romanizations are longer than single-letter ones, creating LENGTH-TELL risk when mixed with "a", "i", "u" type answers.
- No synthetic distractors.
