# czech_b2 — Quiz Audit Findings

## Summary
180 quiz entries (60 facts × 3 mastery levels). Highest SELF_ANSWERING count of any Czech deck: 32 JSON-level cognate cases, 13 definition_match cases in dump, plus 14 total in the dump rendering. At B2, Czech vocabulary heavily includes Latin/Germanic loanwords that are transparent to English speakers, making them trivially guessable. Zero LENGTH_TELL (clean). Difficulty=2 unchanged from B1.

Counts: SELF_ANSWERING×14 (dump), SELF_ANSWERING×32 (deck-wide cognates), zero LENGTH_TELL, zero TEMPLATE_MISFIT.

---

## Issues

### BLOCKER

- **Fact**: `cs-freq-2259` @ mastery=0
- **Category**: `SELF-ANSWERING`
- **Rendered** (definition_match template):
  Q: "samec — male (animal)."
   A) order
   B) male  ✓
   C) orgasm
   D) yoga
   E) index
- **Issue**: "male" appears in the explanation. Also the distractor set is incongruous (orgasm, yoga, index are wildly unrelated to each other and to animal biology).

---

- **Fact**: `cs-freq-2958` @ mastery=0
- **Category**: `SELF-ANSWERING`
- **Rendered** (definition_match template):
  Q: "Němec — German (person)."
   A) eighth
   B) German  ✓
   C) saddle
   D) muscle
   E) goddess
- **Issue**: "German" verbatim in explanation. This is both self-answering AND has poor distractors — "eighth, saddle, muscle, goddess" are semantically unrelated to nationalities/people.

---

- **Fact**: `cs-freq-3216` @ mastery=0
- **Category**: `SELF-ANSWERING`
- **Rendered** (definition_match template):
  Q: "Bělorusko — Belarus (a country in Eastern Europe; official name: Běloruská republika)."
   A) Belarus  ✓
   B) parent
   C) guest
   D) bread
   E) slide
- **Issue**: "Belarus" verbatim in explanation. Country name in Czech (Bělorusko) is fully explained in the question.

---

- **Fact**: `cs-freq-2240` @ mastery=0
- **Category**: `SELF-ANSWERING`
- **Rendered** (definition_match template):
  Q: "příčka — rung (of a ladder)."
   A) devil
   B) kitten
   C) film
   D) Soviet
   E) rung  ✓
- **Issue**: "rung" in explanation. Distractor "Soviet" is an unusual choice for a B2 vocabulary deck; it appears to be a corpus sample artifact.

---

### MAJOR

- **Fact**: deck-wide (32 facts from JSON analysis)
- **Category**: `SELF-ANSWERING`
- **Issue**: Czech-English cognates where the answer is guessable from the Czech word alone: bomba/bomb, dieta/diet, farma/farm, filmový/film, formulář/form, marka/mark, maska/mask, norma/norm, bomba/bomb, dieta/diet. At B2, students learn words they already recognize — this is appropriate scope, but the quiz cannot test these items meaningfully when the answer is embedded in the question.

---

- **Fact**: `cs-freq-2048` @ mastery=0
- **Category**: `SELF-ANSWERING`
- **Rendered** (definition_match template):
  Q: "červenec — July."
   A) supply
   B) now
   C) slowly
   D) legally
   E) July  ✓
- **Issue**: "July" verbatim. The distractors (supply, now, slowly, legally) are adverbs/abstract nouns — wildly inconsistent with a month name answer.

---

### MINOR

- **Fact**: deck-wide
- **Category**: `SYNTHETIC-WEAK`
- **Issue**: Distractor quality is notably poor in several sampled facts. "orgasm, yoga, index" as distractors for "male (animal)"; "devil, kitten, film, Soviet" for "rung of a ladder"; "supply, now, slowly, legally" for "July". These semantically incoherent distractor sets suggest the pool selection is pulling from distant-difficulty neighbors rather than semantically similar terms.

---

- **Fact**: deck-wide
- **Category**: `OTHER`
- **Issue**: difficulty=2 is unchanged from B1. B2 at CEFR represents a significant jump in lexical sophistication; the deck should use difficulty=3 or 4 to signal advancement.

---

### NIT

- **Fact**: deck-wide
- **Category**: `EXPLANATION-MISSING`
- **Issue**: Many B2 explanations follow the same minimal "word — translation." format as A1, providing no grammatical context, aspect information, or usage notes that B2 learners would benefit from.

---

## Expected vs Actual
- **Expected**: B2 facts challenge upper-intermediate learners; cognates are present but distractors are semantically coherent synonyms/near-misses.
- **Actual**: 32 facts are self-answering by cognate transparency; distractor sets are semantically incoherent in several cases.
- **Expected**: difficulty reflects B2 advancement over B1.
- **Actual**: difficulty=2 unchanged.

## Notes
- The SELF_ANSWERING rate at B2 (32/1382 = 2.3% of facts) is real but not catastrophically high. The main issue is these 32 facts cannot be genuinely tested — they should either be removed from the deck or the quiz engine should skip them.
- Poor distractor quality (orgasm/yoga/Soviet appearing for biology/vocabulary questions) suggests the `similar_difficulty` distractor source is pulling from a frequency-ranked pool without semantic filtering. At B2 level, distractor quality matters more than at A1/A2 because learners have less context to eliminate obviously wrong answers.
