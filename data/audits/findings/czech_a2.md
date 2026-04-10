# czech_a2 — Quiz Audit Findings

## Summary
90 quiz entries (30 facts × 3 mastery levels). Zero LENGTH_TELL flags in the dump (clean on that front). 11 SELF_ANSWERING instances in `definition_match` template. Same EXPLANATION_QUALITY pattern as A1. No TEMPLATE_MISFIT or POOL_CONTAM. The difficulty=1 assignment matching A1 means no leveling signal for players moving between the two decks.

Counts: SELF_ANSWERING×11, EXPLANATION-MISSING (thin)×7+, zero LENGTH_TELL, zero TEMPLATE_MISFIT.

---

## Issues

### MAJOR

- **Fact**: `cs-freq-657` @ mastery=0
- **Category**: `SELF-ANSWERING`
- **Rendered** (definition_match template):
  Q: "scéna — scene."
   A) closer
   B) scene  ✓
   C) green
   D) happy
   E) color
- **Issue**: "scene" appears in the explanation. Correct answer guessable without Czech knowledge.

---

- **Fact**: `cs-freq-726` @ mastery=0
- **Category**: `SELF-ANSWERING`
- **Rendered** (definition_match template):
  Q: "dík — thanks."
   A) present
   B) pope
   C) thanks  ✓
   D) medal
   E) beer
- **Issue**: Same pattern. "dík" is a less formal variant of "díky" — both mean "thanks". Explanation echoes the answer.

---

- **Fact**: `cs-freq-891` @ mastery=0
- **Category**: `SELF-ANSWERING` + `AMBIGUOUS-Q`
- **Rendered** (definition_match template):
  Q: "zelené — leaves, a suit in German playing cards."
   Correct: "leaves"
- **Issue**: "leaves" appears in the question. Additionally, the explanation conflates two very different meanings: botanical "leaves" and a card game suit. A Czech learner seeing "zelené" in context almost always encounters "green" (adjective) not "leaves" — the correctAnswer "leaves" may itself be questionable (zelené = green/verde, not leaves; "leaves" here refers to the German playing card suit where the suit symbol is green leaves, a very specialized usage).

---

### MINOR

- **Fact**: `cs-freq-780` @ mastery=0 (from JSON analysis)
- **Category**: `SELF-ANSWERING`
- **Rendered**: "What does 'moderní' mean?" → correct: "modern"
- **Issue**: Czech-English cognate where word and answer are near-identical. Also identifiable without Czech knowledge.

---

- **Fact**: `cs-freq-802` @ mastery=0 (from JSON analysis)
- **Category**: `SELF-ANSWERING`
- **Rendered**: "What does 'policejní' mean?" → correct: "police"
- **Issue**: Czech adjective derived from police — answer is trivially guessable from the stem.

---

- **Fact**: deck-wide
- **Category**: `OTHER`
- **Issue**: difficulty=1 is identical to A1. Students completing A1 and advancing to A2 receive no visual difficulty signal; both levels feel the same.

---

### NIT

- **Fact**: deck-wide
- **Category**: `EXPLANATION-MISSING`
- **Issue**: Many explanations follow the pattern "word — English translation." with no additional context (e.g., "scéna — scene.", "dík — thanks."). The `definition_match` template uses this as the question text, making SELF_ANSWERING nearly guaranteed for these minimal explanations.

---

## Expected vs Actual
- **Expected**: `definition_match` question text provides context clues without directly containing the answer.
- **Actual**: 11 of 30 sampled facts (37%) have the answer in the question text via minimal explanations.
- **Expected**: A2 difficulty reflects advancement beyond A1.
- **Actual**: difficulty=1 across both A1 and A2.

## Notes
- The `zelené — leaves` case (cs-freq-891) is potentially a content error. The primary meaning of zelené is "green" (neuter adjective), not "leaves". The leaves meaning comes from a specialized playing card context. If this is the Czech A2 answer for zelené, students are learning an obscure secondary meaning over the basic one.
- SELF_ANSWERING rate of 37% in the dump's definition_match entries is alarmingly high. The root cause is systematic: the explanation format "word — translation" always contains the translation which IS the correct answer. This is a template design issue, not an individual fact issue.
