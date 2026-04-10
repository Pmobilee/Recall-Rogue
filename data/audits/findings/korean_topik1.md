# korean_topik1 — Quiz Audit Findings

## Summary

| Severity | Count |
|----------|-------|
| BLOCKER | 1 |
| MAJOR | 1 |
| MINOR | 2 |
| NIT | 0 |

TOPIK I is structurally strong: no `_fallback`, good template variety (forward/reverse/definition_match/synonym_pick), NIKL-sourced vocabulary. The main defects are (1) reverse template pool contamination — English distractors in "How do you say X in Korean?" questions — and (2) multi-meaning answers creating ambiguity. No SELF-ANSWERING or BROKEN-GRAMMAR found in the 180-row sample.

---

## Issues

### BLOCKER

- **Fact**: `ko-nikl-2442` @ mastery=2
- **Category**: `POOL-CONTAM`
- **Rendered**:
  ```
  Q: "How do you say 'Republic of Korea' in Korean?"
   A) pot           ← English meaning
   B) 대한민국  ✓   ← Korean word
   C) kilogram      ← English meaning
   D) every week    ← English meaning
  ```
- **Issue**: Reverse template should show Korean-word distractors. Instead, all 3 distractors are English meanings from the `english_meanings` pool. The correct answer is the only Korean string — trivially identifiable by script type. Confirmed across all 45 reverse-template rows in sample (100% contamination rate).

---

### MAJOR

- **Fact**: `ko-nikl-7186` @ mastery=0
- **Category**: `AMBIGUOUS-Q`
- **Rendered**:
  ```
  Q: "What does '사원' mean?"
   A) Wednesday
   B) vegetable
   C) temple, employee  ✓
  ```
- **Issue**: The Korean word `사원` is genuinely polysemous — it means both "company employee" (사원 = 社員) and "temple/shrine" (사원 = 寺院). The comma-separated answer "temple, employee" acknowledges both meanings. However: (a) the distractors don't include other meanings that might relate to either sense; (b) a student who knows only one meaning may be confused by the compound answer; (c) if the answer appears as a distractor in another question, the compound string is harder to match. 38 TOPIK I facts (21%) have multi-meaning answers in comma-separated format.

---

### MINOR

- **Fact**: `ko-nikl-514` @ mastery=0
- **Category**: `SYNONYM-LEAK`
- **Rendered**:
  ```
  Q: "What does '[Korean adjective]' mean?"
   A) young
   B) far, distant, long  ✓
   C) long                ← distractor
  ```
- **Issue**: Distractor "long" overlaps with the correct answer "far, distant, long" — the word "long" appears in both the correct answer and as a standalone distractor. This makes "long" technically a partial correct answer. A student who selects "long" (the distractor) could argue they're right because the correct answer includes "long." This is a SYNONYM-LEAK variant where the distractor is a component of the correct answer string.

---

- **Fact**: `ko-nikl-1588` @ mastery=4
- **Category**: `SYNONYM-LEAK`
- **Rendered**:
  ```
  Q: "Which word is closest in meaning to '[Korean conjunction]'?"
   A) but, however  ✓
   B) not at all
   C) by the way, however    ← distractor
   D) quickly
   E) without
  ```
- **Issue**: "but, however" and "by the way, however" both contain "however" — a near-synonym pair. The correct answer is the adversative "but/however" sense, while "by the way, however" is more of a topic-shift marker. Semantically different, but a beginning Korean learner may not distinguish them. The shared word "however" creates SYNONYM-LEAK.

---

## Expected vs Actual

| Aspect | Expected | Actual |
|--------|----------|--------|
| Reverse template | Korean-word distractors | English distractors (45/45 rows = 100%) |
| Forward template | Correct | Correct |
| definition_match | Correct | Correct |
| synonym_pick | Mostly correct; near-synonym risk | Near-synonym overlap present |
| `_fallback` | None | None — excellent |
| SELF-ANSWERING | None | None confirmed |

---

## Notes

- 1,368 facts is appropriate for TOPIK I scope.
- The reverse template pool contamination is structurally identical to the JLPT vocab decks — the `target_language_words` pool exists but is not being used as the distractor source for reverse-template questions.
- No synthetic distractors in either pool.
- The `definition_match` template works well: Korean word followed by English definition, English answer expected, English distractors. No script contamination in this template type.
- TOPIK I has no `reading` template — correct, since Korean vocab learning doesn't typically test romanization.
