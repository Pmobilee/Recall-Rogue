# spanish_b1_grammar — Quiz Audit Findings

## Summary
69 quiz items sampled (23 facts × 3 mastery levels). 6 flagged items — the second-cleanest grammar deck (only B2 has fewer). All 69 items use `_fallback` fill-in-blank template. Issues are localized to a single pool (`si_clause_patterns`) and consist of SYNTHETIC-WEAK (3 items) and LENGTH-TELL (3 items) from the same root cause: synthetic distractors in the si-clause pool are meta-linguistic grammar labels rather than valid fill-in-blank forms.

## Issues

### MAJOR

- **Fact**: `es-gram-b1-si-type1-comer-0` @ mastery=0
- **Category**: `SYNTHETIC-WEAK` + `LENGTH-TELL`
- **Rendered**:
  Q: "{___} comes bien, te sentirás mejor.
  (If you eat well, you'll feel better.)"
   A) si  ✓
   B) cuando + subjuntivo
   C) aunque + indicativo
- **Issue**: `cuando + subjuntivo` and `aunque + indicativo` are meta-linguistic descriptions ("when + subjunctive mood") — they are teaching labels, not actual fill-in-blank values. A student filling in a blank would write `cuando` or `aunque`, not `cuando + subjuntivo`. The distractor format is categorically wrong: it mixes grammatical labels with actual words. LENGTH-TELL compounds this: `si` (2 chars) vs `cuando + subjuntivo` (19 chars) = 9.5x ratio — the worst length ratio in all 10 decks.

---

- **Fact**: `es-gram-b1-si-type1-comer-0` @ mastery=2
- **Category**: `SYNTHETIC-WEAK` + `LENGTH-TELL`
- **Rendered**:
  Q: "{___} comes bien, te sentirás mejor.
  (If you eat well, you'll feel better.)"
   A) aunque + indicativo
   B) si  ✓
   C) si llueve, iría
   D) cuando + subjuntivo
- **Issue**: Adds `si llueve, iría` — a full example si-clause sentence as a distractor. Not a valid fill-in-blank option (it's an entire clause, not a conjunction). Additionally, `si llueve, iría` contains a type-2 si-clause form (`iría` = conditional), making it a subtly wrong answer that teaches incorrect grammar — a player might confuse it with a valid "si" usage.

---

- **Fact**: `es-gram-b1-si-type1-comer-0` @ mastery=4
- **Category**: `SYNTHETIC-WEAK` + `LENGTH-TELL`
- **Rendered**:
  Q: "{___} comes bien, te sentirás mejor.
  (If you eat well, you'll feel better.)"
   A) aunque + indicativo
   B) si tienes tiempo, irás
   C) si llueve, iría
   D) si  ✓
   E) cuando + subjuntivo
- **Issue**: At mastery 4, the pool draws two full example si-clause sentences (`si tienes tiempo, irás`, `si llueve, iría`) as distractors. These are entire sentences; the blank requires a single conjunction. The format inconsistency is maximal: one option is 2 chars, one option is 17 chars. Any Spanish student immediately eliminates all options that are not a single word.

### NIT

- **Fact**: All other sampled B1 grammar facts
- **Category**: None
- **Issue**: All other 66 quiz items (across subjunctive, imperative, conditional, future, compound tenses, pronoun, relative pronoun, and periphrasis pools) show no detectable issues. Distractors are syntactically consistent with their pool category.

## Expected vs Actual

| Issue Type | Expected | Actual (69-item sample) |
|---|---|---|
| SYNTHETIC-WEAK (si-clause pool) | Medium | 3 items — confirmed |
| LENGTH-TELL (si-clause pool) | High (inherent) | 3 items — confirmed |
| POS-TELL | None | 0 — correct |
| POOL-CONTAM | None | 0 — correct |
| Self-answering via translation | Low | 0 — correct |

## Notes
- All 6 flagged items are from exactly one fact (`es-gram-b1-si-type1-comer-0`), which appears at mastery 0, 2, and 4. This is the only fact in the `si_clause_patterns` pool that appears in the sample. The 11 synthetic distractors for this pool need to be replaced with actual conjunctions from the si-clause domain: `cuando`, `aunque`, `como si`, `a menos que`, `siempre que` — not meta-linguistic grammar labels or full example sentences.
- The `si llueve, iría` distractor contains a subtly incorrect grammar pattern: using imperfect subjunctive after `si` with conditional in main clause is Type 2 (hypothetical), whereas the question tests Type 1 (open condition). A confused learner might select this thinking it is a valid `si` usage — making the distractor actively harmful rather than merely eliminatable.
- B1 grammar is the second-best performing grammar deck despite having the worst individual length ratio (9.5x). The isolation of the issue to a single fact/pool demonstrates that the overall architecture is sound.
- All 23 pools except `si_clause_patterns` produced clean quiz items in the sample. The subjunctive paradigm pools, imperative pools, conditional/future pools, and pronoun pools are all functioning well.
