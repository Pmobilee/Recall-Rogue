# spanish_b2 — Quiz Audit Findings

## Summary
90 quiz items sampled (30 facts × 3 mastery levels). 39 flagged items. POOL-CONTAM (13 items) and LENGTH-TELL (22 items) persist. POS-TELL reduced to 2 items — the lowest among A-B vocab decks — likely because B2's noun-heavy pool (596/964 = 62%) draws noun distractors more consistently. A new template type (`synonym_pick`) appears at higher mastery — bringing its own distractor purity concerns. One recurring anomalous distractor ("banking") appears across multiple unrelated question contexts.

## Issues

### BLOCKER

- **Fact**: `es-cefr-3400` @ mastery=4
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "How do you say 'to drain, to strain' in Spanish?"
   A) escurrir  ✓
   B) to sift, to strain
   C) to sweat
   D) to photograph
   E) to satisfy
- **Issue**: All four distractors are English verb phrases; `escurrir` is trivially identifiable as the Spanish word. Highest severity: 4 contaminating distractors.

---

- **Fact**: `es-cefr-3244` @ mastery=4
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "How do you say 'to entail, to involve' in Spanish?"
   A) to condition
   B) to succumb
   C) to ratify
   D) conllevar  ✓
- **Issue**: Three English distractors for a Spanish-answer reverse question.

### MAJOR

- **Fact**: `es-cefr-3802` @ mastery=0
- **Category**: `LENGTH-TELL`
- **Rendered**:
  Q: "What does 'redondo' mean?"
   A) round  ✓
   B) income, admission
   C) flexibility
- **Issue**: "round" (5 chars) vs "income, admission" (16 chars) vs "flexibility" (11 chars). Answer identifiable by length.

---

- **Fact**: `es-cefr-3123` @ mastery=2
- **Category**: `POS-TELL`
- **Rendered**:
  Q: "What does 'asumir' mean?"
   A) to excuse
   B) to assume, take on  ✓
   C) banking
   D) to return
- **Issue**: "banking" (noun) appears among verb distractors for a verb question. Eliminatable as wrong POS.

---

- **Fact**: `es-cefr-3057` @ mastery=0
- **Category**: `POS-TELL`
- **Rendered**:
  Q: "What does 'agravar' mean?"
   A) to aggravate  ✓
   B) to boost, to strengthen
   C) banking
- **Issue**: "banking" (noun) as distractor for a verb question. Same cross-contaminating distractor as `asumir`.

### MINOR

- **Fact**: `es-cefr-3802` @ mastery=4
- **Category**: `LENGTH-TELL`
- **Rendered**:
  Q: "Which word is closest in meaning to 'redondo'?"
   A) flexibility
   B) income, admission
   C) round  ✓
   D) opposition
   E) spokesperson
- **Issue**: `synonym_pick` template — all options are English, which is correct. But "round" (5 chars) vs "spokesperson" (12 chars) maintains a length tell. Also: "round" as the "synonym" for `redondo` is near-literal translation, not a synonym test.

---

- **Fact**: `es-cefr-3802` @ mastery=2
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "How do you say 'round' in Spanish?"
   A) redondo  ✓
   B) income, admission
   C) spokesperson
   D) flexibility
- **Issue**: "income, admission" and similar English phrases as distractors in a reverse-mode Spanish-answer question.

### NIT

- **Category**: `SYNTHETIC-WEAK` (cross-deck)
- **Issue**: The distractor "banking" appears in at least two unrelated verb questions (`asumir`, `agravar`). This indicates a finance-domain fact answer is bleeding into unrelated question pools. Not technically SYNTHETIC-WEAK (these are real pool facts, not synthetic distractors), but the semantic mismatch signals pool contamination from a single overused distractor fact.

## Expected vs Actual

| Issue Type | Expected | Actual (90-item sample) |
|---|---|---|
| POS-TELL | Low-Medium | 2 items — lower than expected |
| POOL-CONTAM (reverse) | High | 13 items — confirmed |
| LENGTH-TELL | Medium | 22 items — confirmed |
| DUPLICATE-OPT | None | 0 — correct |
| synonym_pick coherence | Medium risk | 1 (literal translation as "synonym") |

## Notes
- The "banking" distractor anomaly: two distinct verb-answer facts both drew "banking" as a distractor. This suggests the finance-domain fact whose `correctAnswer` is "banking" has high usage as a distractor across the pool. In a pool of 964 facts without POS splits, noun finance terms bleed into verb questions frequently.
- `synonym_pick` template (11 items in sample) appears to function correctly — all options are English meanings — but the semantic bar for "synonym" quality is low (literal translations treated as synonyms).
- B2 is the first level to use `definition_match` (5 items in sample); these appear clean in the sampled instances.
- LENGTH-TELL at B2 (22 items) is comparable to B1 (23 items), confirming this is a pool-structural issue not specific to vocabulary complexity.
