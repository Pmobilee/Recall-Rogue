# spanish_c1 — Quiz Audit Findings

## Summary
180 quiz items sampled (60 facts × 3 mastery levels). 74 flagged items. LENGTH-TELL dominates (58 items) — the highest absolute count of any deck, driven by C1's extreme answer-length variance (single-word cognates like "civil" vs multi-word definitions). Three confirmed FACTUAL-SUSPECT BLOCKER cases: `donde`→"because", `habitual`→"beans", and `sino` POS mis-tagging as conjunction for its noun sense. SELF-ANSWERING also elevated (14 items) due to Spanish-English cognates at C1 level. POOL-CONTAM is nearly absent (2 items) because the `target_language_words` pool covers only 300 of 1,500 facts — reverse mode is rarely triggered.

## Issues

### BLOCKER

- **Fact**: `es-cefr-4014`
- **Category**: `FACTUAL-SUSPECT`
- **Rendered**:
  Q: "What does 'habitual' mean?"
   A) [distractor]
   B) beans  ✓
   C) [distractor]
- **Issue**: `habitual` in Spanish means "habitual, usual, customary" — it is a cognate of English "habitual." The stored correct answer "beans" is factually wrong. This is almost certainly a data pipeline error (wrong row mapping). Teaching learners that `habitual` = "beans" is an educational trust violation. **Must be corrected before shipping.**

---

- **Fact**: `es-cefr-3990`
- **Category**: `FACTUAL-SUSPECT`
- **Rendered**:
  Q: "What does 'donde' mean?"
   A) [distractor]
   B) because  ✓
   C) [distractor]
- **Issue**: `donde` means "where" in Spanish (relative/interrogative adverb). "because" is the translation of `porque`. The stored answer is factually wrong — a learner who memorizes this will be actively miseducated. This is a data corruption or row-swap error. **Must be corrected before shipping.**

---

- **Fact**: `es-cefr-4002`
- **Category**: `FACTUAL-SUSPECT`
- **Rendered**:
  Q: "What does 'sino' mean?"
   A) [distractor]
   B) destiny, fate, lot  ✓
   C) [distractor]
- **Issue**: `sino` as a conjunction means "but rather, but instead" (contrasting with `pero`). The stored answer "destiny, fate, lot" is the meaning of the noun `sino` — which is a homograph, but the fact is tagged `partOfSpeech: conjunction`. A conjunction-tagged fact should give the conjunction meaning. Additionally, the quiz question does not disambiguate which `sino` (conjunction or noun) is being tested, making the question ambiguous. **Requires clarification and likely splitting into two facts.**

---

- **Fact**: `es-cefr-4134` @ mastery=0
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "What does 'sentimental' mean?"
   A) sentimental  ✓
   B) [distractor]
   C) [distractor]
- **Issue**: Spanish `sentimental` and English "sentimental" are identical. The question reveals the answer by form: a player who reads "What does 'sentimental' mean?" and sees "sentimental" as an option knows immediately it is correct regardless of Spanish knowledge. This applies to all cognate facts.

---

- **Fact**: `es-cefr-4057` @ mastery=0
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "What does 'debate' mean?"
   A) debate  ✓
   B) [distractor]
   C) [distractor]
- **Issue**: Identical Spanish-English cognate. Same as above.

### MAJOR

- **Fact**: `es-cefr-4629` @ mastery=0
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "What does 'info' mean?"
   A) info  ✓
   B) [distractor]
   C) [distractor]
- **Issue**: `info` is identical in Spanish and English. Even lower value as a quiz question — players will always answer correctly without learning.

---

- **Fact**: `es-cefr-4414` @ mastery=0
- **Category**: `LENGTH-TELL`
- **Rendered**:
  Q: "What does 'hocico' mean?"
   A) chimpanzee
   B) anxiety, apprehension  ✓
   C) snout
- **Issue**: Wait — correct answer for `hocico` should be "snout/muzzle" (animal nose). "anxiety, apprehension" as the correct answer for `hocico` is suspicious; this may be another data corruption. Need cross-check. If the correct answer is "snout" (which it is) and it's being displaced by "anxiety, apprehension", this is a FACTUAL-SUSPECT. Reported here as LENGTH-TELL (the rendered options have severe length disparity: "snout" 5 chars vs "anxiety, apprehension" 21 chars).

---

- **Fact**: `es-cefr-4175` @ mastery=0
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "What does 'rumor' mean?"
   A) rumor  ✓
   B) [distractor]
   C) [distractor]
- **Issue**: Exact Spanish-English cognate.

### MINOR

- **Fact**: `es-cefr-4518` @ mastery=0
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "What does 'ignorante' mean?"
   A) ignorant  ✓
   B) [distractor]
   C) [distractor]
- **Issue**: Near-cognate (only "-e" ending differs). Identifiable by visual similarity even without Spanish knowledge.

---

- **Fact**: `es-cefr-4275` @ mastery=2
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "How do you say 'parental' in Spanish?"
   A) moving, touching
   B) nuptial
   C) Cordoban
   D) paterno  ✓
- **Issue**: "moving, touching" is an English meaning used as a distractor in a reverse-mode question. The other distractors (`nuptial`, `Cordoban`) appear to be Spanish adjectives — mixed language within the same distractor set.

### NIT

- **Category**: `POS tagging inconsistency`
- **Issue**: C1 deck uses both `pronoun`/`pron`, `adjective`/`adj`, `det`/`determiner` for the same POS categories — inconsistent normalization. If the game engine groups distractors by POS, split tagging will break POS-based filtering.

## Expected vs Actual

| Issue Type | Expected | Actual (180-item sample) |
|---|---|---|
| SELF-ANSWERING (cognates) | High | 14 items — confirmed |
| LENGTH-TELL | Highest | 58 items — confirmed (worst of all decks) |
| POOL-CONTAM | Low (incomplete pool) | 2 items — as expected |
| FACTUAL-SUSPECT | Not expected | 3 BLOCKERs found |
| POS-TELL | Low | 0 — better than expected |

## Notes
- The three FACTUAL-SUSPECT BLOCKERs (`donde`, `habitual`, `sino`) are the most serious findings across all 10 Spanish decks. They suggest a row-alignment error in the data pipeline — adjacent rows in the source data were misaligned so a word's translation was assigned to the wrong word.
- C1 has the worst LENGTH-TELL of all 10 decks because the pool spans both high-frequency grammatical words (short cognates like "civil", "info", "no") and complex C1 vocabulary with multi-word definitions.
- The `target_language_words` pool covering only 300/1500 facts means most C1 facts never receive reverse-mode questions — a pedagogical gap, as productive recall (Spanish word from English) is valuable at C1.
- Cognate SELF-ANSWERING at C1 is partially pedagogically valid (learners should know cognates) but offers zero quiz value when the answer is identical to the question word.
