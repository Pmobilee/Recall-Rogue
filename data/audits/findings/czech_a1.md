# czech_a1 — Quiz Audit Findings

## Summary
90 quiz entries (30 facts × 3 mastery levels). Primary issues are SELF_ANSWERING in `definition_match` template (7 cases where explanation text contains the correct answer verbatim) and explanation quality failures (Latin placeholders). No TEMPLATE_MISFIT or POOL_CONTAM — Czech's two-pool structure avoids the language-mixing problems seen in HSK decks.

Counts: SELF_ANSWERING×7, EXPLANATION issues×2, LENGTH_TELL×4, POS_MISLABEL×1 notable.

---

## Issues

### MAJOR

- **Fact**: `cs-freq-3` @ mastery=0
- **Category**: `EXPLANATION-MISSING`
- **Rendered** (definition_match template):
  Q: "ono — id."
   A) school
   B) it  ✓
   C) week
   D) Friday
   E) ...
- **Issue**: Explanation text "ono — id." uses the Latin abbreviation "id." (idem = same). A player reading this as a question sees "id." which is meaningless to English speakers. The answer "it" cannot be derived from "id." — this is a broken explanation serving as the question text in definition_match template.

---

- **Fact**: `cs-freq-5` @ mastery=0
- **Category**: `EXPLANATION-MISSING`
- **Rendered** (definition_match template):
  Q: "já — ego."
   Correct: "I"
- **Issue**: Explanation "ego." is Latin (= "I" in Latin). An English-speaking player sees "ego" and must guess that this means the first-person pronoun. The question is answerable by Latin knowledge, not Czech knowledge.

---

- **Fact**: `cs-freq-448` @ mastery=0
- **Category**: `SELF-ANSWERING`
- **Rendered** (definition_match template):
  Q: "brod — ford (location where a stream is shallow)."
   A) sense
   B) pain
   C) workday
   D) development
   E) ford  ✓
- **Issue**: Correct answer "ford" appears verbatim in the question stem. Guessable without any knowledge of Czech.

---

- **Fact**: `cs-freq-66` @ mastery=0
- **Category**: `SELF-ANSWERING` + `LENGTH_TELL`
- **Rendered** (definition_match template):
  Q: "seznam — list (register of items). Also: list"
   A) place (5)
   B) pain (4)
   C) how long (8)
   D) Mrs., madam, lady (17)  ← LENGTH_TELL
   E) list (4)  ✓
- **Issue**: "list" appears twice in the question. The answer is also the shortest meaningful option alongside the anomalously long "Mrs., madam, lady". Two issues in one question.

---

- **Fact**: `cs-freq-206` @ mastery=0
- **Category**: `SELF-ANSWERING`
- **Rendered** (definition_match template):
  Q: "spolu — together."
   Correct: "together"
- **Issue**: Single-word explanation exactly equals the correct answer. Question and answer are identical text.

---

- **Fact**: `cs-freq-211` @ mastery=0
- **Category**: `SELF-ANSWERING`
- **Rendered** (definition_match template):
  Q: "dříve — formerly."
   Correct: "formerly"
- **Issue**: Same — explanation is just the English translation.

---

### MINOR

- **Fact**: `cs-freq-267` @ mastery=0
- **Category**: `LENGTH_TELL`
- **Rendered**:
  Q: (forward) "What does 'vláda' mean?"
   A) article (7)
   B) far (3)
   C) vláda (5)  ← POOL_CONTAM: Czech word in English meanings options
   D) Czech Republic (14)
- **Issue**: The word "vláda" (= government) appears as an option in what should be an English meanings option set. Also "Czech Republic" (14 chars) vs "far" (3 chars) is a 4.7× length tell.

---

- **Fact**: `cs-freq-1` (deck-wide POS)
- **Category**: `OTHER`
- **Rendered**:
  correctAnswer: "as"
  partOfSpeech: "noun"
- **Issue**: "jako" (as/like) is a conjunction, not a noun. Systemic POS mislabeling from Kaikki.org import.

---

### NIT

- **Fact**: deck-wide
- **Category**: `OTHER`
- **Issue**: Explanations for basic function words (tak, ono, já, jak) are single-line Wiktionary entries that repeat the English meaning with no contextual usage or example. Not wrong, but minimal pedagogical value at A1 level.

---

## Expected vs Actual
- **Expected**: `definition_match` template uses explanation as a clue, answer cannot be read off the question.
- **Actual**: 7 of 30 sampled facts have the correct answer verbatim in the explanation text.
- **Expected**: Explanation provides English-language context for Czech learners.
- **Actual**: "id." and "ego." are Latin placeholders unintelligible to English speakers.

## Notes
- The SELF_ANSWERING issue in `definition_match` is particularly prevalent in Czech/Dutch because Kaikki.org/Wiktionary explanations often use the pattern "word — definition." where definition equals the correctAnswer. The engine should strip the answer from the definition_match question text before presenting it, or the deck should use a different explanation format.
- "vláda" appearing in the english_meanings option pool for cs-freq-267 suggests this fact's `answerTypePoolId` may be misconfigured, or the pool selection logic is pulling from the wrong pool.
