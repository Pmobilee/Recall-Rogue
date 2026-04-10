# chinese_hsk3 — Quiz Audit Findings

## Summary
90 quiz entries (30 facts × 3 mastery levels). Same systemic TEMPLATE_MISFIT and POOL_CONTAM failures as HSK1/2. Length tells worsen at this level because multi-character compounds (2–4 Chinese chars) are even shorter than English translations, making the character-spotting heuristic more reliable. Worst observed ratio: 14× (1-char Chinese '已' vs 10-char English "simply; really").

Counts: TEMPLATE_MISFIT×20, POOL_CONTAM×15, LENGTH_TELL×21, FACTUAL_SUSPECT×69 (deck-wide).

---

## Issues

### BLOCKER

- **Fact**: `zh-hsk-1245` @ mastery=2
- **Category**: `TEMPLATE_MISFIT`
- **Rendered**:
  Q: "What is the pinyin reading of '拍'?"
   A) to clean
   B) to forecast
   C) to get a job
   D) to pat  ✓
- **Issue**: Pinyin "pāi" never appears. Options are English meanings. Asking for pinyin but testing meaning.

---

- **Fact**: `zh-hsk-1245` @ mastery=4
- **Category**: `POOL_CONTAM`
- **Rendered**:
  Q: "How do you say 'to pat' in Chinese?"
   A) to clean
   B) to forecast
   C) to get a job
   D) to announce
   E) 拍  ✓
- **Issue**: Four English verb phrases mixed with one Chinese character. Correct answer instantly identifiable by character type, not knowledge.

---

### MAJOR

- **Fact**: `zh-hsk-1211` @ mastery=4
- **Category**: `LENGTH_TELL`
- **Rendered**:
  Q: "How do you say 'already' in Chinese?"
   A) anyway (6)
   B) usually (7)
   C) simply; really (13)
   D) opportunely (11)
   E) 已 (1)  ✓
- **Issue**: Length ratio = 14×. Single character '已' is trivially distinguishable from multi-word English options. This is the most extreme case in the deck sample.

---

- **Fact**: `zh-hsk-1687` @ mastery=4
- **Category**: `POOL_CONTAM`
- **Rendered**:
  Q: "How do you say 'to conduct' in Chinese?"
   A) to create
   B) 举办  ✓
   C) to develop
   D) to compare
   E) to replenish
- **Issue**: Two-character compound 举办 mixed with English verb phrases.

---

### MINOR

- **Fact**: `zh-hsk-1491` @ mastery=2
- **Category**: `TEMPLATE_MISFIT`
- **Rendered**:
  Q: "What is the pinyin reading of '证'?"
   A) to rise
   B) to prove, certificate  ✓
   C) to overcome
   D) to advocate
- **Issue**: correctAnswer contains comma-separated meanings "to prove, certificate" — a compound answer mixing verb and noun. When used as an option for other questions, this format inconsistency may create confusing distractors.

---

### NIT

- **Fact**: deck-wide
- **Category**: `FACTUAL_SUSPECT`
- **Issue**: 69 facts where correctAnswer does not appear in explanation (7.5% of 915 facts). Predominantly CC-CEDICT alternate-reading entries. At intermediate level, these mismatches become more confusing because students consulting the explanation will find a contradictory primary meaning.

---

## Expected vs Actual
- **Expected**: `reading_pinyin` template → options are pinyin strings with tone marks.
- **Actual**: Options are English meanings; same pool wiring bug as HSK1/2.
- **Expected**: `reverse` template → all options are Chinese characters or character compounds.
- **Actual**: Mix of Chinese characters and English meanings.

## Notes
- zh-hsk-1491 answer "to prove, certificate" uses a comma to separate different parts of speech (verb + noun). This is inconsistent with the semicolon convention used elsewhere ("to hold; to grasp"). Should standardize: either semicolon for same-POS variants or separate facts.
- The LENGTH_TELL severity increases with HSK level as vocabulary becomes more complex (longer English translations, still short Chinese characters).
