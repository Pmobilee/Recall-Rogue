# spanish_c2 — Quiz Audit Findings

## Summary
90 quiz items sampled (30 facts × 3 mastery levels). 17 flagged items — lowest total among vocab decks. C2 is the most structurally sophisticated vocab deck: it has chain themes, a `spanish_words` pool for reverse mode, and 10 synthetic distractors in `english_meanings`. The primary issues are POOL-CONTAM in reverse mode (9 items) — English meanings appearing as distractors when Spanish words are expected — and LENGTH-TELL (7 items). No POS-TELL detected. No factual accuracy issues found. One gender-form self-answering case noted.

## Issues

### BLOCKER

- **Fact**: `es-cefr-c2-0057` @ mastery=2
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "How do you say 'ambivalence' in Spanish?"
   A) haughtiness, arrogance
   B) dissertation, disquisition
   C) palinode, recantation
   D) ambivalencia  ✓
- **Issue**: Three multi-word English phrases as distractors in a reverse-mode question asking for a Spanish word. All three distractors are English meanings of other C2 facts. `ambivalencia` is trivially identifiable as the only Spanish-form option.

---

- **Fact**: `es-cefr-c2-0615` @ mastery=2
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "How do you say 'outlandish (feminine)' in Spanish?"
   A) estrafalaria  ✓
   B) epistemic, relating to knowledge
   C) complete, exact, thorough
   D) buried, hidden, underlying
- **Issue**: Three English multi-word meanings as distractors. Additionally, the question "(feminine)" parenthetical reveals the gender form of the answer — a partial self-answering issue compounded by the language contamination.

---

- **Fact**: `es-cefr-c2-0590` @ mastery=2
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "How do you say 'eclectic' in Spanish?"
   A) pungent, sharp, piercing
   B) equidistant, neutral
   C) ecléctico  ✓
   D) philanthropic
- **Issue**: "pungent, sharp, piercing" and "equidistant, neutral" are English meanings; `ecléctico` is identifiable by Spanish form and accent mark.

### MAJOR

- **Fact**: `es-cefr-c2-0639` @ mastery=0
- **Category**: `LENGTH-TELL`
- **Rendered**:
  Q: "What does 'fulgurante' mean?"
   A) dazzling, meteoric  ✓
   B) controversial
   C) stoic
- **Issue**: "dazzling, meteoric" (18 chars) vs "controversial" (13 chars) vs "stoic" (5 chars). 3.6x ratio. Answer identifiable by length.

---

- **Fact**: `es-cefr-c2-nepotismo` @ mastery=2
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "How do you say 'nepotism' in Spanish?"
   A) authoritarianism
   B) nepotismo  ✓
   C) mockery, derision
   D) hubbub, clamor, babble
- **Issue**: "mockery, derision" and "hubbub, clamor, babble" are English phrases in a Spanish-answer question. "authoritarianism" could be a Spanish word (`autoritarismo`) or an English word — ambiguous language in the same option set.

### MINOR

- **Fact**: `es-cefr-c2-purgar` @ mastery=2
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "How do you say 'to purge, to atone for' in Spanish?"
   A) to expropriate
   B) purgar  ✓
   C) to reach consensus
   D) to abdicate
- **Issue**: Three English infinitive phrases as distractors. Severe for verbs because "to + [verb]" is an English-only form — the Spanish infinitive `purgar` has no "to" prefix, making it trivially identifiable.

---

- **Fact**: `es-cefr-c2-0615` @ mastery=2
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "How do you say 'outlandish (feminine)' in Spanish?"
   A) estrafalaria  ✓
- **Issue**: The "(feminine)" parenthetical in the question reveals that the answer must be a feminine Spanish adjective. All the English-meaning distractors are automatically eliminatable by language form. The gender specification narrows the target uniquely.

### NIT

- **Fact**: `es-cefr-c2-agravante` @ mastery=2
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "How do you say 'aggravating circumstance' in Spanish?"
   A) joy, elation, rejoicing
   B) agravante  ✓
   C) dogmatism
   D) questioning, challenge
- **Issue**: "joy, elation, rejoicing" and "questioning, challenge" are English phrases; "dogmatism" could be Spanish or English. Mild compared to cases with 3+ English distractors.

## Expected vs Actual

| Issue Type | Expected | Actual (90-item sample) |
|---|---|---|
| POOL-CONTAM (reverse) | Medium | 9 items — confirmed |
| LENGTH-TELL | Low | 7 items — as expected |
| POS-TELL | Low (noun-adjective heavy) | 0 — correct |
| SELF-ANSWERING | Low | 1 gender-form case |
| FACTUAL-SUSPECT | Low (curated C2 list) | 0 — correct |

## Notes
- C2 is the only vocab deck with synthetic distractors (`english_meanings` pool has 10). This may explain the lower LENGTH-TELL count — the synthetic distractors were likely chosen to be length-consistent.
- The POOL-CONTAM pattern in reverse mode is the same structural issue as all other vocab decks, but less severe because C2 has chain themes that group vocabulary semantically — distractors are more likely to be domain-adjacent even when language-contaminated.
- The 9 POOL-CONTAM items (10% of 90 sampled) suggest the `spanish_words` pool's distractor selection is inconsistently drawing from the right pool. Cases like `purgar` (all English infinitive distractors) suggest the engine may fall back to `english_meanings` for some reverse-mode draws.
- Gender-form questions ("outlandish (feminine)") are a C2-specific design choice. They test morphological knowledge but create a self-answering tell when distractors are in a different language.
- `estrafalaria` vs `estrafalario` (feminine vs masculine of the same word) appearing in the same deck is good — but both should appear as distractors for each other's question, not English meanings.
