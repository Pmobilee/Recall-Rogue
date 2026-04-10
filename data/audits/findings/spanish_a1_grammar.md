# spanish_a1_grammar — Quiz Audit Findings

## Summary
90 quiz items sampled (30 facts × 3 mastery levels). 24 flagged items. All items use the `_fallback` fill-in-blank template (`{___}`). The primary issues are LENGTH-TELL (18 items) from pronoun/article pools mixing 2-char forms (`su`, `mi`, `no`) with 7–9-char forms (`nuestro`, `cualquier`, `ninguna`); and SELF-ANSWERING via translation (6 items) where the English translation in parentheses lexically contains the correct Spanish form. No POS-TELL, no POOL-CONTAM, no factual issues. Grammar pool design is otherwise well-structured.

## Issues

### MAJOR

- **Fact**: `es-gram-a1-art-def-la-0` @ mastery=0
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "Me gusta {___} paella.
  (I like paella.)"
   A) el
   B) la  ✓
   C) al
- **Issue**: The English translation "I like paella" does not contain "la" explicitly — but a Spanish learner who knows `paella` is feminine will fill the blank immediately. However, even a non-Spanish speaker can apply the hint: "paella" ends in `-a` (feminine) → "la". This is partial SELF-ANSWERING: the hint `la` appears implicitly in the gender-agreeable noun. The translation provides no additional benefit here.

---

- **Fact**: `es-gram-a1-neg-no-0` @ mastery=0
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "Yo {___} soy español.
  (I'm not Spanish.)"
   A) nadie
   B) no  ✓
   C) nada
- **Issue**: The English translation "I'm NOT Spanish" contains the word "not" which directly maps to Spanish `no`. A learner can find the answer by reading the English, not by knowing Spanish. The question tests reading comprehension of the hint, not Spanish grammar knowledge.

---

- **Fact**: `es-gram-a1-art-indef-un-1` @ mastery=2
- **Category**: `LENGTH-TELL`
- **Rendered**:
  Q: "Tengo {___} libro.
  (I have a book.)"
   A) un  ✓
   B) una
   C) ninguna
   D) unos
- **Issue**: `un` (2 chars) vs `ninguna` (7 chars) — 3.5x ratio. With 4 options, the short `un` and `una` are grouped together by length against the longer `ninguna` and `unos`.

---

- **Fact**: `es-gram-a1-pron-el-0` @ mastery=0
- **Category**: `LENGTH-TELL`
- **Rendered**:
  Q: "{___} habla español.
  (He speaks Spanish.)"
   A) él  ✓
   B) yo
   C) nosotros
- **Issue**: `él` (2 chars) vs `nosotros` (8 chars) — 4x ratio. Answer identifiable by length for Spanish learners who know `nosotros` means "we" (plural context doesn't match "he speaks").

---

- **Fact**: `es-gram-a1-pron-nosotros-0` @ mastery=0
- **Category**: `LENGTH-TELL`
- **Rendered**:
  Q: "{___} hablamos español.
  (We speak Spanish.)"
   A) él
   B) ellos
   C) nosotros  ✓
- **Issue**: `él` (2 chars) vs `nosotros` (8 chars). However, the verb `hablamos` already contains the 1st-person plural marker — a grammar-aware learner doesn't need to read the options at all. This is mild SELF-ANSWERING via verb agreement.

### MINOR

- **Fact**: `es-gram-a1-pos-su-0` @ mastery=0
- **Category**: `LENGTH-TELL`
- **Rendered**:
  Q: "{___} casa es grande.
  (His/Her house is big.)"
   A) nuestro
   B) su  ✓
   C) tu
- **Issue**: `su` (2 chars) vs `nuestro` (7 chars) — 3.5x ratio. The translation "His/Her" eliminates `nuestro` (our) immediately.

---

- **Fact**: `es-gram-a1-vp-estar-gerundio-1` @ mastery=2
- **Category**: `LENGTH-TELL`
- **Rendered**:
  Q: "Ella {___} comiendo.
  (She is eating.)"
   A) le
   B) estamos
   C) gusta
   D) está  ✓
- **Issue**: `le` (2 chars) vs `estamos` (7 chars). Additionally, `le` is an object pronoun — not a valid form for a "Ella ___ comiendo" slot (which needs an auxiliary verb). Eliminatable by grammar knowledge.

---

- **Fact**: `es-gram-a1-neg-no-0` @ mastery=4
- **Category**: `LENGTH-TELL`
- **Rendered**:
  Q: "Yo {___} soy español.
  (I'm not Spanish.)"
   A) nunca
   B) también
   C) no  ✓
   D) nada
   E) nadie
- **Issue**: `no` (2 chars) vs `también` (7 chars) — 3.5x ratio. At mastery 4, five options make the short answer more obvious.

### NIT

- **Fact**: `es-gram-a1-art-def-la-0` @ mastery=2
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "Me gusta {___} paella.
  (I like paella.)"
   A) al
   B) el
   C) la  ✓
   D) las
- **Issue**: Same as mastery=0 case. Adding `las` as a fourth option adds mild competition but doesn't resolve the gender-agreement tell.

## Expected vs Actual

| Issue Type | Expected | Actual (90-item sample) |
|---|---|---|
| LENGTH-TELL (pronoun pools) | High | 18 items — confirmed |
| SELF-ANSWERING via translation | High | 6 items — confirmed |
| POS-TELL | None (grammar POS only) | 0 — correct |
| POOL-CONTAM | None | 0 — correct |
| SYNTHETIC-WEAK | Low | 0 — distractors appear plausible |

## Notes
- The LENGTH-TELL issue in grammar decks is structurally different from vocab decks. Here, mixing `su`/`mi`/`no` (short function words) with `nuestro`/`cualquier`/`ninguna` (longer forms) is inherent to the grammar domain — short function words are necessarily short. Some `homogeneityExempt` justification applies, but the ratio still exceeds 3x in 18 items.
- SELF-ANSWERING via translation is the more significant pedagogical concern: if the translation directly contains the answer word, the quiz tests English reading, not Spanish grammar. The fix is to rephrase the English translation to avoid including the target word — e.g., "I'm not from Spain" instead of "I'm not Spanish" for a `no` question.
- The article `al` in the `articles_definite` pool is a contraction (`a + el`), not a standalone definite article — mixing it with `el/la/los/las` is slightly misleading, though it is the expected contrast for `la` question types.
- Pool design for grammar is otherwise good: all pools have 5+ real facts and 5–14 synthetic distractors, pools are category-specific, and there is no cross-POS contamination.
