# spanish_a1 — Quiz Audit Findings

## Summary
180 quiz items sampled (60 facts × 3 mastery levels). Highest issue count of all vocab decks: 98 flagged items. Three systemic defects dominate: LENGTH-TELL (50 items) from answer length variance across the shared pool; POOL-CONTAM (29 items) from English meanings appearing as distractors on Spanish-answer reverse questions; and POS-TELL (13 items) from verb answers mixed with noun/adjective distractors in the same forward-mode pool. All three share a single root cause: a single flat `english_meanings` pool covering all 1,546 facts across all POS types with zero synthetic distractors.

## Issues

### BLOCKER

- **Fact**: `es-cefr-1307` @ mastery=4
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "How do you say 'to greet' in Spanish?"
   A) to do
   B) saludar  ✓
   C) widowed
   D) to cross, go through
   E) to connect
- **Issue**: Reverse question asks for a Spanish word; options B is correct Spanish, but A/D/E are English verb meanings and C is an English adjective — three languages mixed in one option set. Player can trivially identify the Spanish answer by visual form alone.

---

- **Fact**: `es-cefr-243` @ mastery=2
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "How do you say 'married' in Spanish?"
   A) to remove, take away
   B) to recognize
   C) to fulfil, carry out
   D) casado  ✓
- **Issue**: All three distractors are English verb phrases; the single Spanish word is trivially identifiable by form.

---

- **Fact**: `es-cefr-1307` @ mastery=0
- **Category**: `POS-TELL`
- **Rendered**:
  Q: "What does 'saludar' mean?"
   A) widowed
   B) to greet  ✓
   C) to do
- **Issue**: `saludar` is a verb (correct: "to greet"), but distractor "widowed" is an adjective/past participle — different POS. Player can eliminate "widowed" immediately because the question is about a verb ending in `-ar`.

---

- **Fact**: `es-cefr-243` @ mastery=0
- **Category**: `POS-TELL`
- **Rendered**:
  Q: "What does 'casado' mean?"
   A) to fulfil, carry out
   B) to remove, take away
   C) married  ✓
- **Issue**: `casado` is tagged `partOfSpeech: verb` but correct answer "married" is an adjective/past participle. Distractors are all infinitive verbs ("to fulfil", "to remove") — eliminating them is trivial since the answer is clearly not a verb.

### MAJOR

- **Fact**: `es-cefr-902` @ mastery=4
- **Category**: `LENGTH-TELL`
- **Rendered**:
  Q: "How do you say 'mayonnaise' in Spanish?"
   A) mayonesa  ✓
   B) encounter, meeting
   C) [Spanish word]
   D) [English phrase]
   E) [English phrase]
- **Issue**: Correct answer is a 7-char Spanish word; multiple distractors are English two-word phrases. Answer identifiable by length and language alone.

---

- **Fact**: `es-cefr-1071` @ mastery=2
- **Category**: `POS-TELL`
- **Rendered**:
  Q: "What does 'pasear' mean?"
   A) to learn
   B) to stroll, walk  ✓
   C) to save
   D) married
- **Issue**: Three distractors are infinitive verbs (correct POS), but "married" is an adjective — creates a POS tell for the eliminator.

---

- **Fact**: `es-cefr-415` @ mastery=0
- **Category**: `POS-TELL`
- **Rendered**:
  Q: "What does 'dejar' mean?"
   A) to leave  ✓
   B) to hit, knock
   C) interesting
- **Issue**: "interesting" (adjective) mixed with two infinitive verbs. Verb question with adjective distractor is eliminatable.

### MINOR

- **Fact**: `es-cefr-202` @ mastery=0
- **Category**: `POS-TELL`
- **Rendered**:
  Q: "What does 'calefacción' mean?"
   A) heating  ✓
   B) to wish
   C) to study
- **Issue**: `calefacción` is a noun (heating); distractors "to wish"/"to study" are verbs. Eliminatable even without Spanish knowledge.

---

- **Fact**: `es-cefr-1914` (A2 boundary fact) @ mastery=0
- **Category**: `LENGTH-TELL`
- **Rendered**:
  Q: "What does 'estercolero' mean?"
   A) entrance hall
   B) dunghill, dung heap  ✓
   C) cow
- **Issue**: Answer "dunghill, dung heap" (17 chars) vs distractor "cow" (3 chars) — ratio 5.7x. Answer identifiable by length even without Spanish knowledge.

### NIT

- **Fact**: `es-cefr-1200` @ mastery=0
- **Category**: `POS-TELL`
- **Rendered**:
  Q: "What does 'proponer' mean?"
   A) to start, begin
   B) to propose  ✓
   C) to promise
   D) travelling, itinerant
- **Issue**: Three verb distractors appropriate; "travelling, itinerant" (adjective/gerund) is an odd form mismatch but less immediately eliminatable than pure adjectives.

## Expected vs Actual

| Issue Type | Expected | Actual (180-item sample) |
|---|---|---|
| POS-TELL | High (all-POS pool) | 13 items — confirmed |
| POOL-CONTAM (reverse) | High (structural) | 29 items — confirmed |
| LENGTH-TELL | High (no pool splits) | 50 items — confirmed |
| DUPLICATE-OPT | None | 0 — correct |
| SELF-ANSWERING | Low for vocab | 6 minor cognate cases |

## Notes
- Root cause for all three major issue types is identical: a single flat pool (`english_meanings`) containing 1,546 facts across all POS types with no synthetic distractors and no pool splitting.
- Fix requires: (1) splitting pool by POS (`english_meanings_verbs`, `english_meanings_nouns`, `english_meanings_adjectives`), (2) fixing reverse-mode distractor pool to draw from Spanish words only, (3) adding synthetic distractors per sub-pool.
- The 6 self-answering cases are cognate facts (`casado`→`married`: word root visible in Spanish) — minor severity since players need to know the word, not just pattern-match.
- All POS-TELL items repeat at multiple mastery levels (0, 2, 4) — each unique fact generates 2–3 flagged items.
