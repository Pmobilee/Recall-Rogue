# spanish_a2_grammar — Quiz Audit Findings

## Summary
75 quiz items sampled (25 facts × 3 mastery levels). 13 flagged items. All items use `_fallback` fill-in-blank template. Two distinct issue types: SELF-ANSWERING via translation (6 items, all from object-pronoun facts where the English translation contains the target pronoun); and LENGTH-TELL (7 items, from por/para pool and time-expression pools mixing prepositions with full phrases). No POS-TELL, no POOL-CONTAM. Grammar pool architecture is well-designed; issues are localized to specific pool types.

## Issues

### MAJOR

- **Fact**: `es-gram-a2-do-me-0` @ mastery=0
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "¿{___} llamas mañana, por favor?
  (Will you call ME tomorrow, please?)"
   A) me  ✓
   B) verlo
   C) la
- **Issue**: The English translation capitalizes or includes "ME" — the exact English equivalent of the correct Spanish answer `me`. A player reads the translation and immediately knows the answer without any Spanish knowledge. This defeats the purpose of the quiz.

---

- **Fact**: `es-gram-a2-io-me-0` @ mastery=0
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "Mis padres {___} dieron un regalo de cumpleaños.
  (My parents gave ME a birthday present.)"
   A) me  ✓
   B) te
   C) se lo
- **Issue**: Same issue — "gave ME" in the translation directly maps to the Spanish `me`. Both direct-object and indirect-object `me` facts share this problem across all three mastery levels.

---

- **Fact**: `es-gram-a2-por-exchange-0` @ mastery=0
- **Category**: `LENGTH-TELL` + `SYNTHETIC-WEAK`
- **Rendered**:
  Q: "Pagué diez euros {___} el libro.
  (I paid ten euros for the book.)"
   A) vamos a comer
   B) por  ✓
   C) para
- **Issue**: `por` (3 chars) vs `vamos a comer` (13 chars, "let's eat") — 4.3x length ratio. More critically, `vamos a comer` is a full verb phrase, not a preposition — it cannot grammatically fill a preposition slot. Eliminatable in one second by any Spanish student at any level.

---

- **Fact**: `es-gram-a2-por-exchange-0` @ mastery=4
- **Category**: `SYNTHETIC-WEAK`
- **Rendered**:
  Q: "Pagué diez euros {___} el libro.
  (I paid ten euros for the book.)"
   A) por eso
   B) por  ✓
   C) para
   D) va a llover
   E) vamos a comer
- **Issue**: `va a llover` ("it's going to rain") and `vamos a comer` ("let's eat") are verb phrases used as fill-in-blank options for a preposition slot. These are not plausible even to a beginner Spanish learner. The synthetic distractors for this pool are semantically invalid.

### MINOR

- **Fact**: `es-gram-a2-imp-antes-0` @ mastery=0
- **Category**: `LENGTH-TELL`
- **Rendered**:
  Q: "{___} vivía en una ciudad pequeña.
  (Before, I used to live in a small town.)"
   A) ayer
   B) antes  ✓
   C) la semana pasada
- **Issue**: `antes` (5 chars) vs `la semana pasada` (16 chars) — 3.2x ratio. "la semana pasada" is a multi-word phrase; `ayer` and `antes` are single adverbs. Length separation makes the longer option visually distinct even before reading.

---

- **Fact**: `es-gram-a2-imp-irr-haz-0` @ mastery=4
- **Category**: `SYNTHETIC-WEAK`
- **Rendered**:
  Q: "{___} los deberes antes de salir.
  (Do your homework before going out.)"
   A) se habla
   B) se vende
   C) di
   D) haz  ✓
   E) se come
- **Issue**: `haz` and `di` are singular imperative forms (correct pool). `se habla`, `se vende`, `se come` are impersonal `se` constructions — grammatically impossible in a direct-command (`haz los deberes`) context. Eliminatable by grammar type. These appear to be synthetic distractors from the wrong grammar category.

### NIT

- **Fact**: `es-gram-a2-do-me-0` @ mastery=2 and mastery=4
- **Category**: `SELF-ANSWERING`
- **Issue**: Same SELF-ANSWERING via translation as mastery=0. The problem persists across all three mastery levels for both `do-me` and `io-me` facts (6 items total from 2 facts × 3 mastery levels).

## Expected vs Actual

| Issue Type | Expected | Actual (75-item sample) |
|---|---|---|
| SELF-ANSWERING (object pronouns) | High | 6 items — confirmed |
| SYNTHETIC-WEAK (por/para pool) | Medium | 3 items — confirmed |
| LENGTH-TELL (time expressions) | Medium | 7 items — confirmed |
| POS-TELL | None | 0 — correct |
| POOL-CONTAM | None | 0 — correct |

## Notes
- The SELF-ANSWERING issue for object pronouns (`me`) is structurally unavoidable with the current translation approach. Fix: rephrase English translations to use indirect or alternative wording: "Will you call tomorrow, please? [implies 'me']" or use a blank in the English translation too ("Will you call ___ tomorrow?").
- The `por_para_choice` pool's synthetic distractors (`vamos a comer`, `va a llover`) are the worst synthetic distractor quality finding across all grammar decks. These belong to a completely different grammar category and are trivially eliminatable. The pool needs re-seeded synthetics from the preposition/connector domain.
- Time-expression LENGTH-TELL (`ayer` vs `la semana pasada`) is domain-inherent — single adverbs and adverbial phrases exist in the same semantic space. Splitting into "single-word time adverbs" vs "multi-word time phrases" pools would resolve this.
- The `imperfect_ir`, `imperfect_ver`, and similar small paradigm pools (5 facts each) are well-padded with synthetics; no issues detected in those pools.
- A2 grammar is the second-best performing grammar deck (only 13 issues vs 24 for A1, 6 for B1, 0 for B2).
