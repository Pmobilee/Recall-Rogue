# chinese_hsk4 — Quiz Audit Findings

## Summary
90 quiz entries (30 facts × 3 mastery levels). Systemic TEMPLATE_MISFIT and POOL_CONTAM persist. LENGTH_TELL severity comparable to HSK3. Notable new issue: some facts with two-character answer pool entries (e.g., '辛苦') appearing as distractors against English verb phrases produce particularly confusing option sets.

Counts: TEMPLATE_MISFIT×17, POOL_CONTAM×18, LENGTH_TELL×25, FACTUAL_SUSPECT×79 (deck-wide).

---

## Issues

### BLOCKER

- **Fact**: `zh-hsk-2310` @ mastery=2
- **Category**: `TEMPLATE_MISFIT`
- **Rendered**:
  Q: "What is the pinyin reading of '骗'?"
   A) regarding
   B) to rotate
   C) to divide into
   D) to cheat  ✓
- **Issue**: Pinyin "piàn" never appears. Template asks for pinyin, tests meaning.

---

- **Fact**: `zh-hsk-3089` @ mastery=2
- **Category**: `TEMPLATE_MISFIT`
- **Rendered**:
  Q: "What is the pinyin reading of '片面'?"
   A) inseparable
   B) unilateral  ✓
   C) generous
   D) monotonous
- **Issue**: Same systemic failure. All options are English adjectives. Pinyin "piàn miàn" absent.

---

- **Fact**: `zh-hsk-2399` @ mastery=4
- **Category**: `POOL_CONTAM` + `LENGTH_TELL`
- **Rendered**:
  Q: "How do you say [English word] in Chinese?"
   A) 辛苦 (2 chars)  ✓
   B) to lower (8)
   C) to install (10)
   D) to move (7)
- **Issue**: Two-character Chinese compound against English verb phrases. Length ratio = 5×.

---

- **Fact**: `zh-hsk-3089` @ mastery=4
- **Category**: `POOL_CONTAM` + `LENGTH_TELL`
- **Rendered**:
  Q: "How do you say [English word] in Chinese?"
   A) inseparable (11)
   B) generous (8)
   C) 片面 (2 chars)  ✓
   D) monotonous (10)
   E) careless (8)
- **Issue**: Length ratio = 5.5×.

---

### MAJOR

- **Fact**: deck-wide (79 facts)
- **Category**: `FACTUAL_SUSPECT`
- **Issue**: correctAnswer does not appear in explanation for 8% of facts. The zh-hsk-2135 series includes literary particles (而, 之, 之后) where CC-CEDICT's explanation covers alternate usage that may not match the tested meaning. At upper-intermediate level, students consulting the explanation to learn more will find conflicting information.

---

### MINOR

- **Fact**: deck-wide
- **Category**: `OTHER`
- **Issue**: 之 (zhī) is labeled `partOfSpeech: "preposition"` with `correctAnswer: "of"` but 之 in modern usage is primarily a literary particle, not a preposition. The label may mislead students expecting everyday usage.

---

### NIT

- **Fact**: deck-wide
- **Category**: `OTHER`
- **Issue**: `funScore` uniformly 5. `difficulty` uniformly 3. No variation within the HSK4 range.

---

## Expected vs Actual
- **Expected**: All templates correctly identify what they are testing.
- **Actual**: `reading_pinyin` template tests meaning instead; `reverse` template allows language-type detection.

## Notes
- zh-hsk-2135 (而) and zh-hsk-2136 (之) are literary/classical particles appearing frequently in formal text. Their distractors ("and", "of") should include similar function words for a meaningful challenge, but the pool's English meanings include completely unrelated items.
- POOL_CONTAM is functionally equivalent to a LENGTH_TELL in all reverse template cases — fixing one fixes the other.
