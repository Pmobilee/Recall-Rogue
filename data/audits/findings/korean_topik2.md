# korean_topik2 — Quiz Audit Findings

## Summary

| Severity | Count |
|----------|-------|
| BLOCKER | 1 |
| MAJOR | 1 |
| MINOR | 1 |
| NIT | 1 |

TOPIK II has identical structural characteristics to TOPIK I: no `_fallback`, strong template variety, NIKL-sourced vocabulary. The same systemic POOL-CONTAM defect is present in the reverse template (49/49 = 100% contamination). Multi-meaning answers affect 26 facts (14%). Overall this is the cleanest Korean vocabulary deck in content quality, with fewer synonym-leak risks found than TOPIK I.

---

## Issues

### BLOCKER

- **Fact**: `ko-nikl-4669` @ mastery=2
- **Category**: `POOL-CONTAM`
- **Rendered**:
  ```
  Q: "How do you say 'even number' in Korean?"
   A) 짝수  ✓         ← Korean
   B) schedule         ← English
   C) headache pill/medicine  ← English
   D) developed country       ← English
  ```
- **Issue**: All 3 distractors are English meanings from the `english_meanings` pool. Correct answer is the only Korean string — script-type eliminates all wrong options. This is structurally identical to TOPIK I's reverse template defect. Confirmed across all 49 reverse-template rows (100% contamination).

---

### MAJOR

- **Fact**: `ko-nikl-2684` @ mastery=2
- **Category**: `AMBIGUOUS-Q`
- **Rendered**:
  ```
  Q: "How do you say 'quarrel' in Korean?"
   A) resignation
   B) ordinary
   C) 말다툼  ✓
   D) all one's life
  ```
  And at mastery=4 (definition_match):
  ```
  Q: "말다툼 — The act of debating in order to tell right from wrong. Part of speech: noun..."
   A) quarrel  ✓
   B) ordinary
   C) resignation
   D) balloon
   E) all one's life
  ```
- **Issue**: The `definition_match` template for `말다툼` defines it as "the act of debating in order to tell right from wrong" — this definition could ambiguously describe "debate" or "argument" as well as "quarrel." The correct English answer "quarrel" is more informal/emotional than the formal definition suggests. Advanced TOPIK II learners may select "debate" (if it appeared as an option) as more accurate to the definition.

---

### MINOR

- **Fact**: TOPIK II multi-meaning answers (26 facts)
- **Category**: `AMBIGUOUS-Q`
- **Rendered**: Examples like "even number" (single meaning, clear) vs compound answers containing "/".
- **Issue**: 26 of 180 sampled rows (14%) have comma-separated or slash-separated correct answers. At TOPIK II level, words are more complex and genuinely polysemous. The multi-meaning format is less problematic than at TOPIK I, because the `definition_match` template provides full context. However, in `forward` template ("What does X mean?"), a compound answer like "developed country" (single meaning, clear) is fine while "headache pill/medicine" creates minor ambiguity about which slash-separated term is "more correct."

---

### NIT

- **Fact**: `ko-nikl-4669` synonym_pick @ mastery=4
- **Category**: `SYNONYM-LEAK`
- **Rendered**:
  ```
  Q: "Which word is closest in meaning to '짝수'?"
   A) headache pill/medicine
   B) developed country
   C) play, game
   D) even number  ✓
   E) schedule
  ```
- **Issue**: "headache pill/medicine" uses a slash-separated distractor format inconsistent with the non-slash correct answer "even number." The slash format creates visual noise without adding pedagogical value. Minor formatting inconsistency.

---

## Expected vs Actual

| Aspect | Expected | Actual |
|--------|----------|--------|
| Reverse template | Korean-word distractors | English distractors (49/49 = 100%) |
| Forward template | English distractors from meaning pool | Correct |
| definition_match | Correct | Mostly correct; one definition ambiguity noted |
| synonym_pick | Near-synonym management | Mostly clean; one NIT on slash formatting |
| `_fallback` | None | None — excellent |

---

## Notes

- 2,207 facts is appropriate for TOPIK II scope (intermediate–advanced).
- The reverse template pool contamination is the single highest-priority fix for all Korean vocabulary decks — same root cause as JLPT vocab decks: `target_language_words` pool not being used as distractor source for reverse templates.
- TOPIK II correctly does not use a `reading` template (no romanization testing in Korean).
- No synthetic distractors in either pool.
- The `definition_match` entries are generally well-constructed with formal definitions — better than TOPIK I's samples in definition precision.
