# chinese_hsk2 — Quiz Audit Findings

## Summary
90 quiz entries (30 facts × 3 mastery levels). Same systemic failures as HSK1: TEMPLATE_MISFIT on all `reading_pinyin` entries, POOL_CONTAM on all `reverse` entries. Additional unique issue: `zh-hsk-475` (啊) has `correctAnswer="interjection"` — a meta-linguistic label rather than a meaning — which is a POS_TELL pattern where the answer type description leaks its category.

Counts: TEMPLATE_MISFIT×23, POOL_CONTAM×12, LENGTH_TELL×21, FACTUAL_SUSPECT×66 (deck-wide), POS_TELL×1 notable.

---

## Issues

### BLOCKER

- **Fact**: `zh-hsk-1113` @ mastery=2
- **Category**: `TEMPLATE_MISFIT`
- **Rendered**:
  Q: "What is the pinyin reading of '洗衣机'?"
   A) Good night!
   B) portion
   C) washing machine  ✓
   D) face
- **Issue**: Template asks for pinyin (xǐ yī jī) but options are English meanings. Systemic across all `reading_pinyin` template uses.

---

- **Fact**: `zh-hsk-1139` @ mastery=4
- **Category**: `POOL_CONTAM`
- **Rendered**:
  Q: "How do you say 'clear sky' in Chinese?"
   A) height
   B) opinion; view
   C) clear sky  ✓  ← WRONG: should be '晴天' not English
   D) traditional Chinese medicine
- **Issue**: The correct answer in a reverse template should be the Chinese word '晴天', but the pool is supplying the English meaning instead. This fact is showing the English meaning as the correct answer for a "How do you say X in Chinese?" question.

---

### MAJOR

- **Fact**: `zh-hsk-475` @ mastery=0
- **Category**: `TEMPLATE_MISFIT` + `POS-TELL`
- **Rendered**:
  Q: "What does '啊' (ā) mean?"
   Correct answer: "interjection"
   partOfSpeech: "noun" (data error)
- **Issue**: `correctAnswer="interjection"` is a part-of-speech label, not a meaning. The English answer "interjection" tells the player the word's grammatical role, not what it actually communicates ("ah!", "oh!"). Also `partOfSpeech="noun"` is wrong — 啊 is an interjection/particle.

---

- **Fact**: `zh-hsk-553` @ mastery=4
- **Category**: `LENGTH_TELL`
- **Rendered** (reverse template):
   A) 队 (1 char)  ✓
   B) feeling (7)
   C) different (9)
   D) item (4)
- **Issue**: Length ratio = 9×. Single Chinese character trivially distinguishable.

---

### MINOR

- **Fact**: deck-wide (66 facts)
- **Category**: `FACTUAL_SUSPECT`
- **Issue**: CC-CEDICT alternate-reading entries appear in explanation while correctAnswer tests a different reading. Example: 让 (ràng) answer="to yield" but explanation includes senses from other characters. Not all are wrong — most are legitimate secondary meanings — but the pattern affects 9% of the deck.

---

### NIT

- **Fact**: deck-wide
- **Category**: `OTHER`
- **Issue**: `funScore` uniformly 5. No synthetic distractors. Same structural issues as HSK1.

---

## Expected vs Actual
- **Expected**: `zh-hsk-1139` reverse template → correct answer should be '晴天' (Chinese characters).
- **Actual**: Shows "clear sky" (English) as the correct answer in a "How do you say X in Chinese?" question.
- **Expected**: `zh-hsk-475` correctAnswer should be "oh!; ah!" or "exclamatory particle".
- **Actual**: "interjection" — a category label, not a translation.

## Notes
- The `zh-hsk-1139` reverse template issue may indicate a pool wiring bug where some facts' correctAnswer field contains English meaning even when the quiz selects them for the reverse (Chinese→English) context.
- All HSK decks share the same three-pool architecture and template wiring. Fixes to the template system will cascade across HSK1–6.
