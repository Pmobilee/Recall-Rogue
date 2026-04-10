# french_b2 — Quiz Audit Findings

## Summary
4,115 facts, 180 quiz dump entries. Length-tell (33 instances) and compound-answer format issues (29 instances) are the dominant problems. Synonym-leak appears as a structural issue in the habileté pool — three options all share the ", ability" suffix. Self-answering (14 instances) continues at mastery=4. POS-tell is low (1 instance) due to noun-dominated pool.

| Category | Count |
|---|---|
| BLOCKER | 0 |
| MAJOR | 15 (self-answering: 14, POS-tell: 1) |
| MINOR | 62 (length-tell: 33, compound-answer: 29) |
| NIT | 0 |

---

## Issues

### MAJOR

- **Fact**: `fr-cefr-4673` @ mastery=0 and mastery=4
- **Category**: `SYNONYM-LEAK`
- **Rendered** (mastery=0):
  Q: "What does 'habileté' mean?"
   A) skill, ability  ✓
   B) capacity, ability
   C) competence, ability
- **Issue**: All three options share the ", ability" suffix. The shared word "ability" in every option is not a useful discriminator; a student who guesses "the one about skill" has a 1-in-3 chance and all distractors are arguably near-synonyms of the correct answer.

---

- **Fact**: `fr-cefr-4671` @ mastery=4
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "gérer — to manage. Also: to rule, to rock (to excel)"
   A) to manage  ✓  B) to capture, pick up  C) to resorb  D) to fold down, reduce  E) to renovate, renew
- **Issue**: "to manage" appears in the explanation used as question stem.

---

- **Fact**: `fr-cefr-6197` @ mastery=4
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "répercussion — repercussion."
   A) deliverance, relief  B) grantee  C) pan  D) resignation  E) repercussion  ✓
- **Issue**: Definition IS the answer word. Classic cognate self-answering pattern.

---

- **Fact**: `fr-cefr-6315` @ mastery=4
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "sentinelle — sentinel, sentry, guard."
   A) galley  B) design  C) sentinel, sentry  ✓  D) dictionary  E) reduction
- **Issue**: "sentinel, sentry" appears verbatim in the definition.

---

- **Fact**: `fr-cefr-4457` @ mastery=0
- **Category**: `POS-TELL`
- **Rendered**:
  Q: "What does 'fonctionnement' mean?"
   A) to land
   B) working  ✓
   C) to soften
- **Issue**: "fonctionnement" is a noun (gerund-nominalization). Both distractors are infinitive verbs. The lone noun "working" is immediately identifiable.

---

- **Additional self-answering facts** (mastery=4, same pattern): 11 more cognate entries including `fr-cefr-4673` (habileté definition contains "skill"), `fr-cefr-6226` (rétribution/remuneration), and others where explanation contains the answer.

---

### MINOR

- **Fact**: `fr-cefr-4671` @ mastery=2
- **Category**: `LENGTH-TELL`
- **Rendered**:
  Q: "How do you say 'to manage' in French?"
   A) gérer  ✓
   B) to capture, pick up
   C) to resorb
   D) to renovate, renew
- **Issue**: "gérer" (5 chars) vs "to renovate, renew" (19 chars) — ratio 3.8×. Short French word vs long English phrase distractors in reverse mode.

---

- **Fact**: `fr-cefr-6226` @ mastery=0 and mastery=4
- **Category**: `LENGTH-TELL`
- **Rendered** (mastery=0):
  Q: "What does 'rétribution' mean?"
   A) Catholicism
   B) remuneration, reward  ✓
   C) flute
- **Issue**: "flute" (5 chars) vs "remuneration, reward" (20 chars) — ratio 4×.

---

- **Additional length-tell instances**: 31 more across the 180-entry sample. Pervasive in both forward mode (compound answers vs short distractors) and reverse mode (short French words vs long English phrase distractors).

---

- **Fact**: `fr-cefr-6226`, `fr-cefr-4673`, and 27 additional
- **Category**: `OTHER` (compound correct answer with comma)
- **Issue**: Comma-separated answers throughout the B2 deck. At B2 many correct answers are multi-word ("remuneration, reward", "skill, ability") while distractors are single words — format inconsistency is a tell.

---

## Expected vs Actual
- Expected: Larger pool (4,115) would reduce length-tell by providing more length-consistent distractors
- Actual: Length-tell is WORSE at B2 (33/180 = 18%) than B1 (12/180 = 7%). B2 vocabulary inherently has longer compound English translations, and distractors sampled from the same pool include shorter common words.
- Expected: Synonym-leak rare with 4,115-member pool
- Actual: The habileté triple (skill/capacity/competence + ", ability") is a genuine quality issue — these three facts co-exist in the pool and are drawn together at low mastery.

## Notes
- The synonym-leak in habileté is caused by three near-synonymous facts all sharing the compound format "X, ability". The pool sampling algorithm picks semantically similar facts as distractors for each other — exactly correct behavior for distractor selection, but here all three are arguably correct answers.
- Length-tell in B2 is partly inherent to B2 vocabulary (abstract nouns have longer English translations) but could be mitigated by splitting pools into short-answer and long-answer sub-pools.
- The 29 compound-answer instances span 14 unique fact IDs sampled 2× each (mastery=0 and mastery=2/4). Actual distinct compound-answer facts in the full deck is likely proportional: ~14/30 sampled = ~47% of sampled facts have compound answers.
