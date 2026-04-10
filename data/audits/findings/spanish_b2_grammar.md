# spanish_b2_grammar — Quiz Audit Findings

## Summary
75 quiz items sampled (25 facts × 3 mastery levels). **0 flagged items.** B2 grammar is the cleanest deck in the entire Spanish collection. All 75 items use `_fallback` fill-in-blank template. No LENGTH-TELL, no SELF-ANSWERING, no SYNTHETIC-WEAK, no POOL-CONTAM detected. The structural improvements visible in B2 — consistent 10-synthetic-distractor padding per pool, fine-grained pool splitting (25 pools for 176 facts), and careful pool naming — appear to have eliminated the systemic issues found at A1–B1.

## Issues

None detected in the 75-item sample.

## Structural Observations (Not Issues)

### POSITIVE
- 25 pools for 176 facts — more granular than any other grammar deck (A1 has 14 pools for 134 facts, B1 has 23 for 175).
- Every pool has exactly 10 synthetic distractors — highly consistent padding.
- Pool names are precise: `imp_subj_ra_ar` vs `imp_subj_se_ar` vs `imp_subj_ra_irregulars` — no category blending.
- No meta-linguistic grammar labels appear as distractors (unlike B1's `cuando + subjuntivo`).
- Sub-deck chainThemeId values are `None` — sub-decks exist structurally but themes are not linked. Minor structural note, not a quality issue.

### THEORETICAL RISK (Not Observed in Sample)
- Ra vs se paradigm ambiguity: Both `-ra` and `-se` forms of imperfect subjunctive are grammatically valid in standard Spanish. A fill-in-blank with `hubiera` could technically accept `hubiese`. If the quiz marks `hubiese` wrong when `hubiera` is expected, this creates false failures. Not observed in sample but a latent design concern.
- Si-clause Type 2 vs Type 3 overlap: `Si tuviera dinero, viajaría` (Type 2: hypothetical) and `Si hubiera tenido dinero, habría viajado` (Type 3: counterfactual) are fully distinct. The pools `si_clause_type2` and `si_clause_type3` are correctly separated — good design.
- Reported speech tense shift: Some reported-speech contexts admit multiple valid backshifts. Not observed as an issue in the sample.

## Expected vs Actual

| Issue Type | Expected | Actual (75-item sample) |
|---|---|---|
| LENGTH-TELL | Low (well-padded pools) | 0 — better than expected |
| SELF-ANSWERING | Low | 0 — correct |
| SYNTHETIC-WEAK | Low | 0 — correct |
| POS-TELL | None | 0 — correct |
| POOL-CONTAM | None | 0 — correct |

## Notes
- B2 grammar should be the reference model for all grammar deck design. Its pool architecture (25 fine-grained pools, consistent 10-synthetic padding, no meta-linguistic distractors) is the gold standard.
- The progression A1 (24 issues) → A2 (13) → B1 (6) → B2 (0) shows consistent quality improvement as grammar complexity increases — likely because higher-level content required more careful distractor sourcing and pool design.
- B2 grammar being the most complex and cleanest deck simultaneously suggests the issue with lower-level decks is not vocabulary difficulty but pool design choices: A1–B1 used shorter function-word pools (articles, pronouns) with inherent length variance, and some synthetic distractors were poorly chosen (verb phrases in preposition slots).
- No action required on this deck beyond the theoretical risk notes above.
