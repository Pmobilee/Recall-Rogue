# spanish_a2 — Quiz Audit Findings

## Summary
90 quiz items sampled (30 facts × 3 mastery levels). 32 flagged items. POS-TELL is absent (unlike A1), suggesting the A2 pool is more noun-dominated and forward-mode distractors happen to be POS-consistent in this sample. POOL-CONTAM (13 items) and LENGTH-TELL (19 items) persist as structural issues from the same root cause as A1. One notable content-quality flag: `estercolero` ("dunghill, dung heap") appears questionable as A2 vocabulary.

## Issues

### BLOCKER

- **Fact**: `es-cefr-1689` @ mastery=2
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "How do you say 'farmer' in Spanish?"
   A) railway
   B) TV news
   C) dunghill, dung heap
   D) campesino  ✓
- **Issue**: Reverse question asks for a Spanish word. All three distractors are English translations of other facts. The single Spanish word `campesino` is trivially identifiable by language form alone.

---

- **Fact**: `es-cefr-2129` @ mastery=4
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "How do you say 'to note, to notice' in Spanish?"
   A) to commit suicide
   B) to confirm
   C) to exaggerate
   D) notar  ✓
   E) [another distractor]
- **Issue**: Distractors are English verb phrases; correct answer is the Spanish word `notar`. Eliminatable by language recognition.

### MAJOR

- **Fact**: `es-cefr-1914` @ mastery=0
- **Category**: `LENGTH-TELL`
- **Rendered**:
  Q: "What does 'estercolero' mean?"
   A) entrance hall
   B) dunghill, dung heap  ✓
   C) cow
- **Issue**: Answer "dunghill, dung heap" (17 chars) vs "cow" (3 chars) — 5.7x ratio. Length-identifiable.

---

- **Fact**: `es-cefr-1914` @ mastery=2
- **Category**: `LENGTH-TELL`
- **Rendered**:
  Q: "What does 'estercolero' mean?"
   A) dunghill, dung heap  ✓
   B) cow
   C) entrance hall
   D) practice
- **Issue**: Same as above; "practice" added doesn't resolve the short-vs-compound tell.

---

- **Fact**: `es-cefr-1796` @ mastery=2
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "How do you say 'painting, picture' in Spanish?"
   A) letter B
   B) cuadro  ✓
   C) responsibility
   D) cellular
- **Issue**: Distractors are English nouns; "letter B" is especially jarring as a distractor for an art vocabulary question.

### MINOR

- **Fact**: `es-cefr-1914` @ mastery=0
- **Category**: `FACTUAL-SUSPECT`
- **Rendered**:
  Q: "What does 'estercolero' mean?"
   Correct answer: "dunghill, dung heap"
- **Issue**: `estercolero` is tagged A2, but it is an extremely low-frequency, domain-specific word (agriculture/livestock) unlikely to appear in A2 CEFR assessments or everyday learner needs. Possible ELELex frequency artifact. Borderline CEFR mismatch.

### NIT

- **Fact**: `es-cefr-2079` @ mastery=4
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "How do you say 'marine, naval' in Spanish?"
   A) marino  ✓
   B) sadness, sorrow
   C) [other English meanings]
- **Issue**: Single English phrase distractor in reverse mode; less severe than 3-English-distractor cases.

## Expected vs Actual

| Issue Type | Expected | Actual (90-item sample) |
|---|---|---|
| POS-TELL | Medium | 0 — better than expected |
| POOL-CONTAM (reverse) | High | 13 items — confirmed |
| LENGTH-TELL | Medium | 19 items — confirmed |
| DUPLICATE-OPT | None | 0 — correct |
| CEFR mismatch | Low | 1 (`estercolero`) |

## Notes
- A2 performs better than A1 on POS-TELL because the higher noun ratio means forward-mode distractors are more likely to also be nouns. This is accidental coherence, not structural fixing.
- POOL-CONTAM in reverse mode is structurally identical to A1 — same fix needed.
- "Letter B" appearing as a distractor for `cuadro` is a content anomaly worth flagging: it appears to be the letter "b" (`b` = "be" in Spanish alphabet) entered as a vocabulary entry and bleeding into unrelated question contexts.
- LENGTH-TELL ratio is better (19 items vs 50 for A1) likely because A2 has more multi-syllable nouns with compound English translations that cluster together.
