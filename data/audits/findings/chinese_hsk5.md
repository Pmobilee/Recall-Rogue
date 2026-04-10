# chinese_hsk5 — Quiz Audit Findings

## Summary
180 quiz entries (60 facts × 3 mastery levels). Highest absolute issue counts of any HSK deck due to larger dump size. TEMPLATE_MISFIT and POOL_CONTAM are systemic across all HSK decks. HSK5-specific concern: 69 facts have `partOfSpeech: "noun"` despite answers that are clearly modal verbs, particles, or adverbs — metadata inconsistency that could affect template selection logic.

Counts: TEMPLATE_MISFIT×26, POOL_CONTAM×40, LENGTH_TELL×48, FACTUAL_SUSPECT×112 (deck-wide), POS_MISLABEL×69 (deck-wide).

---

## Issues

### BLOCKER

- **Fact**: `zh-hsk-4403` @ mastery=2
- **Category**: `TEMPLATE_MISFIT`
- **Rendered**:
  Q: "What is the pinyin reading of '解说员'?"
   A) at the scene
   B) early morning
   C) commentator  ✓
   D) candle
- **Issue**: Pinyin "jiě shuō yuán" absent. Template falsely claims to test pronunciation.

---

- **Fact**: `zh-hsk-4093` @ mastery=4
- **Category**: `POOL_CONTAM` + `LENGTH_TELL`
- **Rendered**:
  Q: "How do you say 'passive' in Chinese?"
   A) precious (8)
   B) unfavorable (11)
   C) 被动 (2 chars)  ✓
   D) numerous (8)
- **Issue**: Chinese two-character compound instantly identifiable among English adjectives. Length ratio = 5.5×.

---

- **Fact**: `zh-hsk-4385` @ mastery=4
- **Category**: `POOL_CONTAM` + `LENGTH_TELL`
- **Rendered**:
  Q: "How do you say 'inevitably' in Chinese?"
   A) once; in case (12)
   B) lonely (6)
   C) 不免 (2 chars)  ✓
   D) stealthily (10)
- **Issue**: Length ratio = 6.5×. Same structural failure.

---

### MAJOR

- **Fact**: `zh-hsk-3138` (deck-wide POS pattern)
- **Category**: `OTHER`
- **Rendered**:
  Q: "What does '可' (kě) mean?"
   Correct: "can; may"
   partOfSpeech: "noun"
- **Issue**: 可 (kě) is a modal verb/particle, not a noun. 69 facts in this deck have `partOfSpeech: "noun"` with answers describing verbs, particles, or adverbs (can/may, will, like this/so). If any template logic gates on `partOfSpeech`, these will be mis-routed. Also creates confusing data for students who inspect the metadata.

---

- **Fact**: `zh-hsk-3139` (same POS pattern)
- **Category**: `OTHER`
- **Rendered**:
  Q: "What does '将' (jiāng) mean?"
   Correct: "will"
   partOfSpeech: "noun"
- **Issue**: 将 as a modal future marker is clearly not a noun.

---

### MINOR

- **Fact**: deck-wide (112 facts)
- **Category**: `FACTUAL_SUSPECT`
- **Issue**: 9% of facts have correctAnswer that does not appear in explanation text. Worst at HSK5 because advanced vocabulary includes more polysemous characters where CC-CEDICT's primary entry differs from the HSK-tested sense.

---

- **Fact**: `zh-hsk-4278` @ mastery=2
- **Category**: `TEMPLATE_MISFIT`
- **Rendered**:
  Q: "What is the pinyin reading of '入门'?"
   A) posture
   B) excuse me
   C) formula
   D) introduction; basics  ✓
- **Issue**: Compound answer "introduction; basics" is a two-concept meaning — slightly better than single word but still not pinyin.

---

### NIT

- **Fact**: deck-wide
- **Category**: `OTHER`
- **Issue**: `funScore` uniformly 5. At HSK5, some terms (idioms, formal vocabulary) warrant higher engagement scores to prioritize culturally interesting content.

---

## Expected vs Actual
- **Expected**: POS metadata reflects actual grammatical category.
- **Actual**: Modal verbs, particles, and adverbs labeled "noun" across 69 facts.
- **Expected**: `reverse` template → Chinese-character-only option pool.
- **Actual**: English meanings mixed in as 3 of 4 distractors, making Chinese character trivially identifiable.

## Notes
- The POS mislabeling pattern (69 "noun" labels on non-nouns) appears to be a CC-CEDICT import artifact where the parser assigned "noun" as the default POS when the dictionary entry was ambiguous or the parser failed to map the correct POS tag.
- HSK5 is the tipping point where FACTUAL_SUSPECT mismatches start affecting pedagogically important vocabulary. At HSK1–3, alternate-reading mismatches involve common characters students can verify elsewhere. At HSK5, students encountering a contradiction in explanation vs answer may accept the wrong information.
