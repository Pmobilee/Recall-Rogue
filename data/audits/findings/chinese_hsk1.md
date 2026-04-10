# chinese_hsk1 — Quiz Audit Findings

## Summary
90 quiz entries (30 facts × 3 mastery levels). Two systemic blockers affect every fact rendered via `reading_pinyin` and `reverse` templates. The `reading_pinyin` template asks for pinyin but delivers English meanings as both question and options, making it fundamentally misleading. The `reverse` template mixes Chinese characters with English meaning distractors in the same option list, undermining every "How do you say X in Chinese?" question. Length tells are pervasive wherever Chinese characters appear alongside English options.

Counts: TEMPLATE_MISFIT×18, POOL_CONTAM×18, LENGTH_TELL×30, FACTUAL_SUSPECT×41 (deck-wide).

---

## Issues

### BLOCKER

- **Fact**: `zh-hsk-66` @ mastery=2
- **Category**: `TEMPLATE_MISFIT`
- **Rendered**:
  Q: "What is the pinyin reading of '地'?"
   A) -ly  ✓
   B) yesterday
   C) really
   D) tomorrow
- **Issue**: Template asks for pinyin but correct answer is the English meaning "-ly"; all options are English meanings. Player answering this learns nothing about pronunciation; the question title is false.

---

- **Fact**: `zh-hsk-174` @ mastery=2
- **Category**: `TEMPLATE_MISFIT`
- **Rendered**:
  Q: "What is the pinyin reading of '狗'?"
   A) college
   B) yuan
   C) number
   D) dog  ✓
- **Issue**: Same systemic failure. "gǒu" (the actual pinyin) never appears anywhere in the quiz.

---

- **Fact**: `zh-hsk-66` @ mastery=4
- **Category**: `POOL_CONTAM`
- **Rendered**:
  Q: "How do you say '-ly' in Chinese?"
   A) really
   B) yesterday
   C) tomorrow
   D) 地  ✓
   E) very
- **Issue**: Options mix English meanings (A/B/C/E) with a Chinese character (D). Player can identify the correct answer purely by spotting the one non-English option — no knowledge of Chinese required.

---

- **Fact**: `zh-hsk-321` @ mastery=4
- **Category**: `POOL_CONTAM`
- **Rendered**:
  Q: "How do you say 'worker' in Chinese?"
   A) cup
   B) preparation
   C) 工人  ✓
   D) incorrect
   E) action; movement
- **Issue**: Same pattern. Chinese character trivially identifiable from English noise distractors.

---

### MAJOR

- **Fact**: `zh-hsk-66` @ mastery=4
- **Category**: `LENGTH_TELL`
- **Rendered**:
  Q: "How do you say '-ly' in Chinese?"
   A) really (6)
   B) yesterday (9)
   C) tomorrow (8)
   D) 地 (1) ✓
   E) very (4)
- **Issue**: Max/min length ratio = 9×. The 1-character Chinese option stands out visually from 4–9 character English words, making the correct answer guessable by length alone.

---

- **Fact**: `zh-hsk-2` (deck-wide pattern)
- **Category**: `FACTUAL_SUSPECT`
- **Rendered** (forward template):
  Q: "What does '了' (le) mean?"
   Correct: "completion marker"
   Explanation: "了 (le) — (completed action marker)..."
- **Issue**: correctAnswer="completion marker" but explanation opens with "(completed action marker)" — close variants of the same concept, but 41 facts show correctAnswer that does not appear verbatim in the explanation. Worst cases: '个' answer="measure word" but explanation "个 (gě) — used in 自个儿" (a different reading); '说' answer="to speak; to say" but explanation "说 (shuì) — to persuade" (alternate tone). The explanation shows a different pronunciation/meaning than what the correctAnswer tests.

---

### MINOR

- **Fact**: deck-wide
- **Category**: `OTHER`
- **Issue**: `funScore` is flat 5 for all 466 facts. No variation by interest or pedagogical value. More engaging characters (animals, numbers, colors) deserve higher funScore to drive quiz prioritization.

---

### NIT

- **Fact**: deck-wide
- **Category**: `OTHER`
- **Issue**: No `syntheticDistractors` on any pool. Distractor quality depends entirely on pool membership. With 466 facts in the english_meanings pool, variety is adequate but uncontrolled — unrelated words appear (e.g., "college", "yuan" as distractors for '狗' = "dog").

---

## Expected vs Actual
- **Expected**: `reading_pinyin` template tests pinyin recall — options should be tone-marked pinyin strings (e.g., "de", "gǒu", "gōng rén").
- **Actual**: options are English meaning words; the template is wired to `english_meanings` pool instead of a pinyin-answer pool.
- **Expected**: `reverse` template options are all Chinese characters.
- **Actual**: options mix Chinese characters and English meanings.

## Notes
- These are systemic template wiring failures, not per-fact content errors. Fixing requires either: (a) creating a `reading_pinyin` answer pool where `correctAnswer` is the pinyin string, or (b) repurposing the `reading_pinyin` template to test meaning-from-character (rename template to avoid misleading players).
- The FACTUAL_SUSPECT pattern (explanation shows alternate pronunciation) is a CC-CEDICT artifact: multi-reading characters have the alternate reading as the dictionary's primary entry. Most cases are not wrong per se — both readings are real — but the explanation contradicts the answer being tested.
